"""
Auth Service — JWT + bcrypt password hashing, SQLite-backed user store.
"""
from __future__ import annotations

import logging
import sqlite3
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Optional

from jose import JWTError, jwt
import bcrypt as _bcrypt

logger = logging.getLogger("auth_service")

SECRET_KEY   = "personal-ai-os-secret-change-in-production-2025"
ALGORITHM    = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 30  # 30 days

DB_PATH = Path(__file__).parent.parent / "db" / "auth.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

_INIT_SQL = """
CREATE TABLE IF NOT EXISTS auth_users (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    username             TEXT    NOT NULL UNIQUE,
    display_name         TEXT    NOT NULL,
    password_hash        TEXT    NOT NULL DEFAULT '',
    preferred_domain     TEXT    DEFAULT 'general',
    theme_color          TEXT    DEFAULT '#0071e3',
    provider             TEXT    DEFAULT 'local',
    email                TEXT,
    tc_accepted_version  TEXT,
    tc_accepted_at       TEXT,
    created_at           TEXT    NOT NULL
);
"""

_MIGRATE_SQL = [
    "ALTER TABLE auth_users ADD COLUMN provider TEXT DEFAULT 'local'",
    "ALTER TABLE auth_users ADD COLUMN email TEXT",
    "ALTER TABLE auth_users ADD COLUMN tc_accepted_version TEXT",
    "ALTER TABLE auth_users ADD COLUMN tc_accepted_at TEXT",
]


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(str(DB_PATH))
    c.row_factory = sqlite3.Row
    return c


def _init():
    with _conn() as c:
        c.executescript(_INIT_SQL)
        c.commit()


def _migrate():
    """Apply additive column migrations (idempotent — ignore 'duplicate column' errors)."""
    with _conn() as c:
        for sql in _MIGRATE_SQL:
            try:
                c.execute(sql)
                c.commit()
            except Exception:
                pass  # column already exists


_init()
_migrate()


def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(plain.encode("utf-8"), _bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        return None


def register_user(username: str, display_name: str, password: str,
                  preferred_domain: str = "constructii",
                  theme_color: str = "#ff8c00") -> dict:
    with _conn() as c:
        existing = c.execute("SELECT id FROM auth_users WHERE username=?", (username,)).fetchone()
        if existing:
            raise ValueError("Username already taken")
        pw_hash = hash_password(password)
        c.execute(
            """INSERT INTO auth_users (username, display_name, password_hash,
               preferred_domain, theme_color, created_at)
               VALUES (?,?,?,?,?,?)""",
            (username, display_name, pw_hash, preferred_domain,
             theme_color, datetime.utcnow().isoformat()),
        )
        c.commit()
        row = c.execute("SELECT * FROM auth_users WHERE username=?", (username,)).fetchone()
        return _row_to_dict(row)


def authenticate_user(username: str, password: str) -> Optional[dict]:
    with _conn() as c:
        row = c.execute("SELECT * FROM auth_users WHERE username=?", (username,)).fetchone()
        if not row:
            return None
        if not verify_password(password, row["password_hash"]):
            return None
        return _row_to_dict(row)


def get_user(username: str) -> Optional[dict]:
    with _conn() as c:
        row = c.execute("SELECT * FROM auth_users WHERE username=?", (username,)).fetchone()
        return _row_to_dict(row) if row else None


def update_user_profile(username: str, preferred_domain: str, theme_color: str) -> dict:
    with _conn() as c:
        c.execute(
            "UPDATE auth_users SET preferred_domain=?, theme_color=? WHERE username=?",
            (preferred_domain, theme_color, username),
        )
        c.commit()
        row = c.execute("SELECT * FROM auth_users WHERE username=?", (username,)).fetchone()
        return _row_to_dict(row)


def upsert_oauth_user(
    email: str,
    display_name: str,
    provider: str = "oauth",
    tc_accepted_version: Optional[str] = None,
    tc_accepted_at: Optional[str] = None,
) -> dict:
    """Insert or update an OAuth-sourced user (no password required)."""
    username = email.split("@")[0].lower().replace(".", "_").replace("+", "_")[:32]
    # Ensure uniqueness if the derived username is taken by a different email
    with _conn() as c:
        existing = c.execute("SELECT * FROM auth_users WHERE email=?", (email,)).fetchone()
        if existing:
            row = existing
            # Refresh tc acceptance if provided
            if tc_accepted_version:
                c.execute(
                    "UPDATE auth_users SET tc_accepted_version=?, tc_accepted_at=? WHERE email=?",
                    (tc_accepted_version, tc_accepted_at, email),
                )
                c.commit()
                row = c.execute("SELECT * FROM auth_users WHERE email=?", (email,)).fetchone()
            return _row_to_dict(row)

        # Handle username collision
        base = username
        suffix = 1
        while c.execute("SELECT id FROM auth_users WHERE username=?", (username,)).fetchone():
            username = f"{base}{suffix}"
            suffix += 1

        c.execute(
            """INSERT INTO auth_users
               (username, display_name, password_hash, preferred_domain, theme_color,
                provider, email, tc_accepted_version, tc_accepted_at, created_at)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                username, display_name, "",
                "general", "#0071e3",
                provider, email,
                tc_accepted_version, tc_accepted_at,
                datetime.utcnow().isoformat(),
            ),
        )
        c.commit()
        row = c.execute("SELECT * FROM auth_users WHERE username=?", (username,)).fetchone()
        return _row_to_dict(row)


def _row_to_dict(row) -> dict:
    d = dict(row)
    d.pop("password_hash", None)
    return d
