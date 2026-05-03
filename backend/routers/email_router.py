"""
Email Router — Send files (3D models, PDFs) to the user's email.

Endpoints:
  POST /email/send-file  — Send a file (URL or base64) as email attachment

Uses SMTP (Gmail App Password) configured in backend/.env
"""
from __future__ import annotations

import base64
import ipaddress
import logging
import os
import smtplib
import socket
import tempfile
from email.mime.application import MIMEApplication
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("email_router")
router = APIRouter(prefix="/email", tags=["email"])

GMAIL_USER = os.getenv("GMAIL_USER", "")
GMAIL_APP_PASSWORD = os.getenv("GMAIL_APP_PASSWORD", "")

BASE_DIR = Path(__file__).resolve().parent.parent


def _resolve_local_path(url: str) -> Path | None:
    """If the URL is a local backend route like /blender/file/xxx.glb or
    http://localhost:8000/blender/file/xxx.glb, resolve to the actual file on disk."""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    path = parsed.path if parsed.scheme else url

    # /blender/file/<name>
    if path.startswith("/blender/file/"):
        name = path.split("/blender/file/")[-1]
        sculpts_dir = (BASE_DIR / "data" / "sculpts").resolve()
        candidate = (sculpts_dir / name).resolve()
        if candidate.is_relative_to(sculpts_dir):
            return candidate

    # /nvidia/image/<name>  or /nvidia/file/<name>
    if path.startswith("/nvidia/"):
        parts = path.split("/")
        name = parts[-1] if len(parts) > 2 else None
        if name:
            images_dir = (BASE_DIR / "data" / "images").resolve()
            candidate = (images_dir / name).resolve()
            if candidate.is_relative_to(images_dir) and candidate.exists():
                return candidate

    return None


def _is_safe_url(url: str) -> bool:
    """Block SSRF: reject private/internal/link-local IP targets."""
    from urllib.parse import urlparse
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False
    hostname = parsed.hostname
    if not hostname:
        return False
    try:
        resolved = socket.getaddrinfo(hostname, None)
        for _, _, _, _, addr in resolved:
            ip = ipaddress.ip_address(addr[0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
                return False
    except (socket.gaierror, ValueError):
        return False
    return True

# Auto-detect SMTP server from email domain
def _smtp_config(email: str) -> tuple[str, int]:
    domain = email.split("@")[-1].lower() if "@" in email else ""
    if "icloud" in domain or "me.com" in domain or "mac.com" in domain:
        return ("smtp.mail.me.com", 587)
    if "outlook" in domain or "hotmail" in domain or "live" in domain:
        return ("smtp.office365.com", 587)
    if "yahoo" in domain:
        return ("smtp.mail.yahoo.com", 465)
    return ("smtp.gmail.com", 465)  # default Gmail


class SendFileRequest(BaseModel):
    to: Optional[str] = None  # defaults to GMAIL_USER (send to self)
    subject: str = "Your file from AI OS"
    body: str = "Here's the file you requested from Personal AI OS."
    file_url: Optional[str] = None  # URL to download and attach
    file_b64: Optional[str] = None  # base64-encoded file
    filename: str = "attachment.glb"


@router.post("/send-file")
async def send_file(req: SendFileRequest):
    """Send a file as email attachment. Requires GMAIL_USER + GMAIL_APP_PASSWORD in .env"""
    if not GMAIL_USER or not GMAIL_APP_PASSWORD:
        raise HTTPException(503, "Email not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD in backend/.env")

    recipient = req.to or GMAIL_USER

    # Get file bytes
    file_bytes = None
    if req.file_b64:
        try:
            file_bytes = base64.b64decode(req.file_b64)
        except Exception:
            raise HTTPException(400, "Invalid base64 data")
    elif req.file_url:
        # Check if this is a local backend path (e.g. /blender/file/xxx.glb)
        local_path = _resolve_local_path(req.file_url)
        if local_path and local_path.exists():
            file_bytes = local_path.read_bytes()
        else:
            if not _is_safe_url(req.file_url):
                raise HTTPException(400, "URL blocked: only public HTTP(S) URLs are allowed")
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    r = await client.get(req.file_url)
                if r.status_code != 200:
                    raise HTTPException(502, f"Could not download file from URL (HTTP {r.status_code})")
                file_bytes = r.content
            except httpx.RequestError as e:
                raise HTTPException(502, f"Download failed: {str(e)[:200]}")
    else:
        raise HTTPException(400, "Provide either file_url or file_b64")

    if not file_bytes or len(file_bytes) == 0:
        raise HTTPException(400, "Empty file")

    # Build email
    msg = MIMEMultipart()
    msg["From"] = GMAIL_USER
    msg["To"] = recipient
    msg["Subject"] = req.subject
    msg.attach(MIMEText(req.body, "plain"))

    attachment = MIMEApplication(file_bytes, Name=req.filename)
    attachment["Content-Disposition"] = f'attachment; filename="{req.filename}"'
    msg.attach(attachment)

    # Send via SMTP (auto-detect server from email domain)
    smtp_host, smtp_port = _smtp_config(GMAIL_USER)
    try:
        if smtp_port == 465:
            # SSL (Gmail, Yahoo)
            with smtplib.SMTP_SSL(smtp_host, smtp_port) as smtp:
                smtp.login(GMAIL_USER, GMAIL_APP_PASSWORD)
                smtp.send_message(msg)
        else:
            # STARTTLS (iCloud, Outlook)
            with smtplib.SMTP(smtp_host, smtp_port) as smtp:
                smtp.ehlo()
                smtp.starttls()
                smtp.ehlo()
                smtp.login(GMAIL_USER, GMAIL_APP_PASSWORD)
                smtp.send_message(msg)
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(401, "SMTP auth failed — check GMAIL_USER and GMAIL_APP_PASSWORD (use an App-Specific Password for iCloud)")
    except Exception as e:
        logger.error("Email send failed: %s", e)
        raise HTTPException(502, f"Email send failed: {str(e)[:200]}")

    return {"status": "sent", "to": recipient, "filename": req.filename}


@router.get("/status")
async def email_status():
    return {"configured": bool(GMAIL_USER and GMAIL_APP_PASSWORD), "user": GMAIL_USER or "(not set)"}
