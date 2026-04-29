"""Auth router — register, login, me, profile update, OAuth bridge."""
from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import Optional

from services.auth_service import (
    register_user, authenticate_user, get_user,
    create_access_token, decode_token, update_user_profile,
    upsert_oauth_user,
)
from utils.operator_logger import get_logger

log = get_logger("auth")

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


class RegisterRequest(BaseModel):
    username: str
    display_name: str
    password: str
    preferred_domain: str = "constructii"
    theme_color: str = "#ff8c00"


class LoginRequest(BaseModel):
    username: str
    password: str


class ProfileUpdate(BaseModel):
    preferred_domain: str
    theme_color: str


def current_user(token: str = Depends(oauth2_scheme)) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = get_user(payload.get("sub", ""))
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.post("/register", status_code=201)
def register(req: RegisterRequest):
    try:
        user = register_user(
            username=req.username,
            display_name=req.display_name,
            password=req.password,
            preferred_domain=req.preferred_domain,
            theme_color=req.theme_color,
        )
        token = create_access_token({"sub": user["username"]})
        return {"access_token": token, "token_type": "bearer", "user": user}
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/login")
def login(form: OAuth2PasswordRequestForm = Depends()):
    user = authenticate_user(form.username, form.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nume de utilizator sau parolă incorecte",
        )
    token = create_access_token({"sub": user["username"]})
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.post("/login/json")
def login_json(req: LoginRequest):
    user = authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Nume de utilizator sau parolă incorecte")
    token = create_access_token({"sub": user["username"]})
    return {"access_token": token, "token_type": "bearer", "user": user}


@router.get("/me")
def me(user: dict = Depends(current_user)):
    return user


@router.put("/profile")
def profile(req: ProfileUpdate, user: dict = Depends(current_user)):
    updated = update_user_profile(user["username"], req.preferred_domain, req.theme_color)
    return updated


# ── OAuth bridge ─────────────────────────────────────────────────────────────

class OAuthRequest(BaseModel):
    supabase_access_token: str
    tc_accepted_version: Optional[str] = None
    tc_accepted_at: Optional[str] = None


SUPABASE_URL = "https://mpzvaicxzbnfocytwpxk.supabase.co"


@router.post("/oauth")
async def oauth_exchange(req: OAuthRequest):
    """
    Exchange a Supabase access token for a backend JWT.

    Flow:
      1. Call Supabase /auth/v1/user with the bearer token to verify it.
      2. Extract email + user metadata.
      3. Upsert a local auth_users row (no password — provider = 'oauth').
      4. Issue our own JWT and return it with the user dict.
    """
    # 1) Verify token with Supabase
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            resp = await client.get(
                f"{SUPABASE_URL}/auth/v1/user",
                headers={"Authorization": f"Bearer {req.supabase_access_token}",
                         "apikey": "sb_publishable_t6nWUP1Fj45JNR7yLM8wIw_bvHakKk-"},
            )
    except Exception as exc:
        log.error("Supabase verify request failed: %s", exc)
        raise HTTPException(status_code=502, detail="Cannot reach Supabase to verify token")

    if resp.status_code != 200:
        log.warn("Supabase token rejected: %s", resp.status_code)
        raise HTTPException(status_code=401, detail="Token Supabase invalid sau expirat")

    supa_user = resp.json()
    email = supa_user.get("email", "")
    meta  = supa_user.get("user_metadata", {})
    name  = meta.get("full_name") or meta.get("name") or meta.get("user_name") or email.split("@")[0]
    provider = (supa_user.get("app_metadata", {}).get("provider") or "oauth")

    log.info("OAuth exchange: provider=%s email=%s", provider, email)

    # 2) Upsert local user
    try:
        user = upsert_oauth_user(
            email=email,
            display_name=name,
            provider=provider,
            tc_accepted_version=req.tc_accepted_version,
            tc_accepted_at=req.tc_accepted_at,
        )
    except Exception as exc:
        log.error("upsert_oauth_user failed: %s", exc)
        raise HTTPException(status_code=500, detail="Eroare la crearea profilului local")

    token = create_access_token({"sub": user["username"]})
    return {"access_token": token, "token_type": "bearer", "user": user}
