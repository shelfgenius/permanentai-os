"""
Nexus Router — Smart Home device execution + connection setup.

Endpoints:
  POST /nexus/execute       — Execute a device command (from Alexa/voice/frontend)
  GET  /nexus/devices       — List configured devices
  POST /nexus/setup         — Save Home Assistant / device connection settings
  GET  /nexus/setup         — Get current connection config
  POST /nexus/test          — Test Home Assistant connection
"""
from __future__ import annotations

import logging
import os
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("nexus_router")
router = APIRouter(prefix="/nexus", tags=["nexus"])

# Persistent config (loaded from env / settings file)
_CONFIG = {
    "ha_url": os.getenv("HA_URL", ""),
    "ha_token": os.getenv("HA_TOKEN", ""),
    "backend_mode": os.getenv("NEXUS_BACKEND", "mock"),  # mock | ha | custom
    "entities": {
        "ac": os.getenv("HA_ENTITY_AC", "climate.beko_living_room"),
        "ac_bed": os.getenv("HA_ENTITY_AC_BED", "climate.beko_bedroom"),
        "tv": os.getenv("HA_ENTITY_TV", "media_player.lg_tv"),
        "lights": os.getenv("HA_ENTITY_LIGHTS", "light.ledvance_living_room"),
        "vacuum": os.getenv("HA_ENTITY_VACUUM", "vacuum.xiaomi_robot"),
        "alexa": os.getenv("HA_ENTITY_ALEXA", "media_player.alexa_echo"),
    },
}


class SetupRequest(BaseModel):
    ha_url: str = ""
    ha_token: str = ""
    backend_mode: str = "mock"
    entities: Optional[dict] = None


class ExecuteRequest(BaseModel):
    action: str  # lights_toggle, ac_temp, tv_toggle, vacuum_start, scene, etc.
    params: dict = {}


# ── Home Assistant REST helper ──────────────────────────────
async def _ha_call(domain: str, service: str, data: dict) -> dict:
    if not _CONFIG["ha_url"] or not _CONFIG["ha_token"]:
        raise HTTPException(503, "Home Assistant not configured — go to Nexus Settings → Setup")
    url = f"{_CONFIG['ha_url'].rstrip('/')}/api/services/{domain}/{service}"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.post(url, json=data, headers={
            "Authorization": f"Bearer {_CONFIG['ha_token']}",
            "Content-Type": "application/json",
        })
    if r.status_code >= 400:
        logger.warning("HA call %s/%s failed: %s", domain, service, r.text[:200])
        raise HTTPException(502, f"Home Assistant error: {r.status_code}")
    return {"ok": True}


# ── Execute device action ───────────────────────────────────
@router.post("/execute")
async def execute_command(req: ExecuteRequest):
    """Execute a Nexus device command. Called by Alexa, VoiceOrb, or frontend."""
    mode = _CONFIG["backend_mode"]
    ent = _CONFIG["entities"]

    if mode == "mock":
        return {"status": "mock", "action": req.action, "params": req.params,
                "message": f"Mock executed: {req.action}"}

    if mode != "ha":
        raise HTTPException(400, f"Unknown backend mode: {mode}")

    # ── Route action to HA service call ──
    a = req.action
    p = req.params

    if a == "lights_toggle":
        svc = "turn_on" if p.get("on", True) else "turn_off"
        return await _ha_call("light", svc, {"entity_id": ent["lights"]})

    if a == "lights_brightness":
        return await _ha_call("light", "turn_on", {
            "entity_id": ent["lights"], "brightness_pct": p.get("brightness", 75)
        })

    if a == "lights_color":
        color_hex = p.get("color", "#ffffff")
        if color_hex.startswith("#") and len(color_hex) == 7:
            r, g, b = int(color_hex[1:3], 16), int(color_hex[3:5], 16), int(color_hex[5:7], 16)
        else:
            r, g, b = 255, 255, 255
        return await _ha_call("light", "turn_on", {
            "entity_id": ent["lights"], "rgb_color": [r, g, b]
        })

    if a == "ac_temp":
        return await _ha_call("climate", "set_temperature", {
            "entity_id": ent["ac"], "temperature": p.get("temp", 22)
        })

    if a == "ac_toggle":
        svc = "turn_on" if p.get("on", True) else "turn_off"
        return await _ha_call("climate", svc, {"entity_id": ent["ac"]})

    if a == "tv_toggle":
        svc = "turn_on" if p.get("on", True) else "turn_off"
        return await _ha_call("media_player", svc, {"entity_id": ent["tv"]})

    if a == "tv_volume":
        vol = p.get("volume", 40) / 100
        return await _ha_call("media_player", "volume_set", {
            "entity_id": ent["tv"], "volume_level": vol
        })

    if a == "tv_app":
        return await _ha_call("webostv", "command", {
            "entity_id": ent["tv"], "command": f"com.webos.app.{p.get('app', 'netflix')}"
        })

    if a == "vacuum_start":
        return await _ha_call("vacuum", "start", {"entity_id": ent["vacuum"]})

    if a == "vacuum_dock":
        return await _ha_call("vacuum", "return_to_base", {"entity_id": ent["vacuum"]})

    if a == "scene":
        scene = p.get("scene", "")
        # Map scenes to multi-device calls
        scene_cmds = {
            "movie": [
                ("media_player", "turn_on", {"entity_id": ent["tv"]}),
                ("light", "turn_on", {"entity_id": ent["lights"], "brightness_pct": 20}),
                ("climate", "set_temperature", {"entity_id": ent["ac"], "temperature": 22}),
            ],
            "morning": [
                ("light", "turn_on", {"entity_id": ent["lights"], "brightness_pct": 100}),
                ("media_player", "turn_off", {"entity_id": ent["tv"]}),
                ("vacuum", "start", {"entity_id": ent["vacuum"]}),
            ],
            "sleep": [
                ("media_player", "turn_off", {"entity_id": ent["tv"]}),
                ("light", "turn_off", {"entity_id": ent["lights"]}),
                ("climate", "set_temperature", {"entity_id": ent["ac"], "temperature": 20}),
            ],
            "party": [
                ("light", "turn_on", {"entity_id": ent["lights"], "brightness_pct": 100}),
                ("media_player", "turn_on", {"entity_id": ent["tv"]}),
                ("climate", "set_temperature", {"entity_id": ent["ac"], "temperature": 20}),
            ],
            "away": [
                ("light", "turn_off", {"entity_id": ent["lights"]}),
                ("media_player", "turn_off", {"entity_id": ent["tv"]}),
                ("climate", "turn_off", {"entity_id": ent["ac"]}),
                ("vacuum", "start", {"entity_id": ent["vacuum"]}),
            ],
            "focus": [
                ("light", "turn_on", {"entity_id": ent["lights"], "brightness_pct": 80}),
                ("media_player", "turn_off", {"entity_id": ent["tv"]}),
                ("climate", "set_temperature", {"entity_id": ent["ac"], "temperature": 22}),
            ],
        }
        cmds = scene_cmds.get(scene, [])
        for domain, service, data in cmds:
            try:
                await _ha_call(domain, service, data)
            except Exception as e:
                logger.warning("Scene %s partial fail: %s", scene, e)
        return {"status": "ok", "scene": scene, "commands_sent": len(cmds)}

    return {"status": "unknown_action", "action": a}


# ── Device list ─────────────────────────────────────────────
@router.get("/devices")
async def list_devices():
    """List all configured device entities."""
    return {
        "mode": _CONFIG["backend_mode"],
        "ha_url": _CONFIG["ha_url"] or "(not configured)",
        "devices": _CONFIG["entities"],
    }


# ── Setup endpoints ─────────────────────────────────────────
@router.get("/setup")
async def get_setup():
    """Get current Nexus connection config (masks token)."""
    return {
        "backend_mode": _CONFIG["backend_mode"],
        "ha_url": _CONFIG["ha_url"],
        "ha_token_set": bool(_CONFIG["ha_token"]),
        "entities": _CONFIG["entities"],
    }


@router.post("/setup")
async def save_setup(req: SetupRequest):
    """Save Nexus connection settings (in-memory + env update)."""
    _CONFIG["backend_mode"] = req.backend_mode
    if req.ha_url:
        _CONFIG["ha_url"] = req.ha_url.rstrip("/")
    if req.ha_token:
        _CONFIG["ha_token"] = req.ha_token
    if req.entities:
        _CONFIG["entities"].update(req.entities)
    return {"status": "saved", "mode": _CONFIG["backend_mode"]}


@router.post("/test")
async def test_connection():
    """Test Home Assistant connection by fetching API status."""
    if not _CONFIG["ha_url"] or not _CONFIG["ha_token"]:
        return {"connected": False, "error": "HA URL or token not set"}
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                f"{_CONFIG['ha_url'].rstrip('/')}/api/",
                headers={"Authorization": f"Bearer {_CONFIG['ha_token']}"}
            )
        if r.status_code == 200:
            data = r.json()
            return {"connected": True, "message": data.get("message", "OK"), "version": data.get("version", "?")}
        return {"connected": False, "error": f"HTTP {r.status_code}: {r.text[:200]}"}
    except Exception as e:
        return {"connected": False, "error": str(e)[:200]}
