"""Social integrations: Gmail polling, WhatsApp & Instagram webhooks."""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel

logger = logging.getLogger("social_router")
router = APIRouter(prefix="/social", tags=["social"])

_notification_queue: list[dict] = []


def get_notifications() -> list[dict]:
    return list(_notification_queue)


def push_notification(notif: dict):
    _notification_queue.append(notif)
    if len(_notification_queue) > 50:
        _notification_queue.pop(0)


# ── Gmail IMAP (App Password — fara OAuth) ────────────────────────────────────
@router.get("/gmail/poll")
async def poll_gmail(background_tasks: BackgroundTasks):
    import os
    user = os.getenv("GMAIL_USER", "")
    pwd  = os.getenv("GMAIL_APP_PASSWORD", "")
    if not user or not pwd:
        return {"status": "not_configured", "detail": "Seteaza GMAIL_USER si GMAIL_APP_PASSWORD in .env"}
    background_tasks.add_task(_poll_gmail_imap, user, pwd)
    return {"status": "polling_started"}


@router.get("/gmail/status")
async def gmail_status():
    import os
    user = os.getenv("GMAIL_USER", "")
    pwd  = os.getenv("GMAIL_APP_PASSWORD", "")
    if not user or not pwd:
        return {"configured": False}
    return {"configured": True, "user": user}


def _poll_gmail_imap(user: str, password: str):
    import imaplib, email
    from email.header import decode_header
    try:
        mail = imaplib.IMAP4_SSL("imap.gmail.com", 993)
        mail.login(user, password)
        mail.select("INBOX")
        _, data = mail.search(None, "UNSEEN")
        ids = data[0].split()[-5:]  # ultimele 5 necitite
        for uid in reversed(ids):
            _, msg_data = mail.fetch(uid, "(RFC822)")
            msg = email.message_from_bytes(msg_data[0][1])
            subject_raw, enc = decode_header(msg.get("Subject", ""))[0]
            subject = subject_raw.decode(enc or "utf-8") if isinstance(subject_raw, bytes) else subject_raw
            push_notification({
                "type": "gmail",
                "from": msg.get("From", "unknown"),
                "subject": subject or "(fara subiect)",
            })
        mail.logout()
        logger.info("Gmail IMAP poll OK: %d mesaje", len(ids))
    except Exception as exc:
        logger.warning("Gmail IMAP poll failed: %s", exc)


# ── WhatsApp / Instagram Webhooks ─────────────────────────────────────────────
@router.get("/whatsapp/webhook")
async def whatsapp_verify(request: Request):
    params = dict(request.query_params)
    if params.get("hub.mode") == "subscribe" and params.get("hub.challenge"):
        return int(params["hub.challenge"])
    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/whatsapp/webhook")
async def whatsapp_incoming(request: Request):
    body = await request.json()
    try:
        entry = body.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        messages = changes.get("value", {}).get("messages", [])
        for msg in messages:
            push_notification({
                "type": "whatsapp",
                "from": msg.get("from", "unknown"),
                "text": msg.get("text", {}).get("body", ""),
                "timestamp": msg.get("timestamp"),
            })
    except Exception as exc:
        logger.warning("WhatsApp webhook parse error: %s", exc)
    return {"status": "ok"}


@router.post("/instagram/webhook")
async def instagram_incoming(request: Request):
    body = await request.json()
    try:
        entry = body.get("entry", [{}])[0]
        messaging = entry.get("messaging", [{}])[0]
        push_notification({
            "type": "instagram",
            "from": messaging.get("sender", {}).get("id", "unknown"),
            "text": messaging.get("message", {}).get("text", ""),
        })
    except Exception as exc:
        logger.warning("Instagram webhook parse error: %s", exc)
    return {"status": "ok"}


@router.get("/notifications")
async def get_all_notifications():
    return {"notifications": get_notifications()}


@router.delete("/notifications")
async def clear_notifications():
    _notification_queue.clear()
    return {"status": "cleared"}
