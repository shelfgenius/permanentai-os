"""
auto_tunnel.py — launches cloudflared and publishes the resulting URL.

Publishing is attempted against two endpoints, so the frontend picks it up
no matter which one is reachable:

    1. Supabase `tunnel_registry` table  (primary, realtime push to UI)
    2. Cloudflare Worker KV registry     (fallback, legacy endpoint)
    3. Optional: email notification      (last-resort, opt-in)

Configuration (via .env or real environment variables):

    SUPABASE_URL                 https://mpzvaicxzbnfocytwpxk.supabase.co
    SUPABASE_SERVICE_ROLE_KEY    service-role JWT (KEEP SECRET, local only)

    CF_TUNNEL_WORKER_URL         https://pai-tunnel-registry.maherboss23.workers.dev
    CF_TUNNEL_TOKEN              pai-tunnel-2024

    TUNNEL_EMAIL_TO              user@example.com  (if set, sends email via SMTP)
    SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / SMTP_FROM
"""
from __future__ import annotations

import json
import os
import re
import smtplib
import subprocess
import sys
import tempfile
import threading
import time
import urllib.parse
import urllib.request
from email.message import EmailMessage
from pathlib import Path

# ── Load .env (best-effort, no external dep) ────────────────────────────
def _load_dotenv():
    p = Path(__file__).with_name(".env")
    if not p.exists():
        return
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

_load_dotenv()

# ── Config ──────────────────────────────────────────────────────────────
SUPABASE_URL           = os.getenv("SUPABASE_URL",           "https://mpzvaicxzbnfocytwpxk.supabase.co")
SUPABASE_SERVICE_KEY   = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
CF_WORKER_URL          = os.getenv("CF_TUNNEL_WORKER_URL",   "https://pai-tunnel-registry.maherboss23.workers.dev")
CF_WORKER_TOKEN        = os.getenv("CF_TUNNEL_TOKEN",        "pai-tunnel-2024")
EMAIL_TO               = os.getenv("TUNNEL_EMAIL_TO",        "")
SMTP_HOST              = os.getenv("SMTP_HOST",              "")
SMTP_PORT              = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER              = os.getenv("SMTP_USER",              "")
SMTP_PASS              = os.getenv("SMTP_PASS",              "")
SMTP_FROM              = os.getenv("SMTP_FROM", SMTP_USER or "tunnel@localhost")
# Static override: set this in .env if you use a named/persistent tunnel with a
# fixed hostname (e.g. tunnel.yourdomain.com). auto_tunnel will publish it
# immediately without waiting for a URL in stdout.
TUNNEL_STATIC_URL      = os.getenv("TUNNEL_STATIC_URL",     "").strip()

# Primary: matches the real quick-tunnel hostname (trycloudflare.com).
TUNNEL_RE = re.compile(r"https://[a-z0-9\-]+\.trycloudflare\.com", re.IGNORECASE)
# Secondary: extracts any https URL from the cloudflared banner box:
#   |  https://some-host.trycloudflare.com                                |
BANNER_RE = re.compile(r"\|\s+(https://[^\s|]+)\s+\|", re.IGNORECASE)


# ── Publishers ──────────────────────────────────────────────────────────
def push_to_supabase(url: str) -> bool:
    """Upsert row id=1 in public.tunnel_registry. Requires SERVICE_ROLE key."""
    if not SUPABASE_SERVICE_KEY:
        print("[tunnel] Supabase: no SUPABASE_SERVICE_ROLE_KEY set, skipping.")
        return False
    endpoint = f"{SUPABASE_URL.rstrip('/')}/rest/v1/tunnel_registry?on_conflict=id"
    payload = json.dumps([{"id": 1, "url": url}]).encode()
    req = urllib.request.Request(
        endpoint,
        data=payload,
        method="POST",
        headers={
            "apikey":        SUPABASE_SERVICE_KEY,
            "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
            "Content-Type":  "application/json",
            "Prefer":        "resolution=merge-duplicates,return=minimal",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            if 200 <= resp.status < 300:
                print(f"[tunnel] Supabase OK ({resp.status})")
                return True
            print(f"[tunnel] Supabase HTTP {resp.status}: {resp.read()[:200]!r}")
    except Exception as e:
        print(f"[tunnel] Supabase ERROR: {e}")
    return False


def push_to_cf_worker(url: str) -> bool:
    try:
        endpoint = f"{CF_WORKER_URL.rstrip('/')}/set?url={urllib.parse.quote(url)}&token={CF_WORKER_TOKEN}"
        req = urllib.request.Request(endpoint, data=b"", method="POST",
                                     headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=15) as resp:
            body = json.loads(resp.read() or b"{}")
            if body.get("ok"):
                print(f"[tunnel] Worker OK: {url}")
                return True
            print(f"[tunnel] Worker response: {body}")
    except Exception as e:
        print(f"[tunnel] Worker ERROR: {e}")
    return False


def send_email_notification(url: str) -> bool:
    if not (EMAIL_TO and SMTP_HOST):
        return False
    try:
        msg = EmailMessage()
        msg["Subject"] = "[AURA] Backend tunnel URL"
        msg["From"]    = SMTP_FROM
        msg["To"]      = EMAIL_TO
        msg.set_content(f"Backend tunnel URL:\n\n{url}\n")
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=20) as s:
            s.starttls()
            if SMTP_USER:
                s.login(SMTP_USER, SMTP_PASS)
            s.send_message(msg)
        print(f"[tunnel] Email sent to {EMAIL_TO}")
        return True
    except Exception as e:
        print(f"[tunnel] Email ERROR: {e}")
        return False


def publish(url: str):
    # Primary: Supabase realtime — live site picks up instantly.
    ok_supa = push_to_supabase(url)
    # Fallback: legacy Cloudflare Worker (only try if Supabase failed).
    if not ok_supa:
        push_to_cf_worker(url)
    # Always email when configured so the user has a copy in their inbox.
    # (Fires silently if SMTP creds are missing — see .env SMTP_PASS.)
    send_email_notification(url)


# ── Tunnel process monitor ─────────────────────────────────────────────
def _extract_tunnel_url(text: str) -> str | None:
    """Return the first real tunnel URL found in a log line, or None."""
    # 1. Banner box  |  https://xyz.trycloudflare.com  |  (highest confidence)
    bm = BANNER_RE.search(text)
    if bm:
        candidate = bm.group(1).rstrip("/")
        # Must not be a generic cloudflare.com informational link
        if "trycloudflare.com" in candidate or "cfargotunnel.com" in candidate:
            return candidate
    # 2. Plain trycloudflare.com URL anywhere on the line
    m = TUNNEL_RE.search(text)
    if m:
        return m.group(0).rstrip("/")
    return None


def monitor(proc: subprocess.Popen):
    sent = False
    assert proc.stdout is not None
    for line in proc.stdout:
        text = line.decode("utf-8", errors="ignore").strip()
        if text:
            print(f"[cloudflared] {text}")
        if not sent:
            url = _extract_tunnel_url(text)
            if url:
                print("\n" + "=" * 60)
                print(f"  TUNNEL URL: {url}")
                print("  Publishing to Supabase + Cloudflare Worker...")
                print("=" * 60 + "\n")
                threading.Thread(target=publish, args=(url,), daemon=True).start()
                sent = True


# ── Entrypoint ─────────────────────────────────────────────────────────
if __name__ == "__main__":
    # ── Static URL override (named / persistent tunnels) ─────────────
    # If TUNNEL_STATIC_URL is set in .env, we skip cloudflared entirely
    # (or still run it) but immediately publish the known URL.
    if TUNNEL_STATIC_URL:
        print(f"[tunnel] Using static URL from env: {TUNNEL_STATIC_URL}")
        publish(TUNNEL_STATIC_URL)
        # Fall through and still launch cloudflared so the backend is reachable.

    # ── Force quick-tunnel mode ───────────────────────────────────────
    # Problem 1: cloudflared reads ~/.cloudflared/config.yml automatically
    # and switches to named-tunnel mode (no URL printed to stdout → our regex
    # never fires).  Fix: throwaway empty config with --config.
    # Problem 2: If cert.pem exists at ~/.cloudflared/cert.pem (from a previous
    # `cloudflared tunnel login`), cloudflared may try to use it for named
    # tunnel auth and fail with a cert.pem error.  Fix: --origincert pointing
    # to a dummy empty file so it doesn't look for the real cert.
    tmp_cfg = None
    tmp_cert = None
    try:
        fd, tmp_cfg = tempfile.mkstemp(suffix=".yml", prefix="cloudflared_quick_")
        os.close(fd)
        with open(tmp_cfg, "w", encoding="ascii") as f:
            f.write("# empty config - forces quick-tunnel mode\n")
        fd2, tmp_cert = tempfile.mkstemp(suffix=".pem", prefix="cloudflared_nocert_")
        os.close(fd2)
    except Exception as e:
        print(f"[tunnel] WARNING: could not create temp files ({e}), proceeding without them")

    cmd = ["cloudflared"]
    if tmp_cfg:
        cmd += ["--config", tmp_cfg]
    if tmp_cert:
        cmd += ["--origincert", tmp_cert]
    cmd += [
        "tunnel",
        "--no-autoupdate",
        "--protocol", "http2",
        "--edge-ip-version", "auto",
        "--url", "http://localhost:8000",
    ]

    print(f"[tunnel] Starting cloudflared Quick Tunnel (HTTP/2)…")
    print(f"[tunnel] CMD: {' '.join(cmd)}")

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
    except FileNotFoundError:
        print("[tunnel] ERROR: cloudflared not found on PATH.")
        for f in (tmp_cfg, tmp_cert):
            if f:
                try: os.unlink(f)
                except: pass
        sys.exit(1)

    try:
        monitor(proc)
        proc.wait()
    except KeyboardInterrupt:
        proc.terminate()
    finally:
        for f in (tmp_cfg, tmp_cert):
            if f:
                try: os.unlink(f)
                except: pass
