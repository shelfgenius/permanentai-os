"""
Voice Command Router — Universal voice-to-action dispatcher.

Maps natural language commands to hub-specific actions.
Used by Alexa Skill, VoiceOrb, and any other voice input.

POST /voice/command  — Parse a voice command and execute the matching action
GET  /voice/status   — List available voice commands
"""
from __future__ import annotations

import json
import logging
import os
import re

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger("voice_command_router")
router = APIRouter(prefix="/voice", tags=["voice"])


class VoiceCommandRequest(BaseModel):
    text: str
    hub: Optional[str] = None  # optional hint: aura, nexus, mappy, sky, echo, lexi, canvas, sculpt


class VoiceCommandResponse(BaseModel):
    action: str
    hub: str
    params: dict
    spoken_reply: str


# ── Intent patterns (order matters — first match wins) ────────────────────────

_PATTERNS = [
    # YouTube / Music
    (r"(?:play|search|find)\s+(?:on\s+youtube\s+)?(.+?)(?:\s+on\s+youtube)?$",
     "youtube", "play", lambda m: {"query": m.group(1).strip()}),
    (r"(?:pause|stop)\s+(?:youtube|music|video|playback)",
     "youtube", "pause", lambda m: {}),
    (r"(?:resume|continue)\s+(?:youtube|music|video|playback)",
     "youtube", "resume", lambda m: {}),

    # Nexus — Lights
    (r"(?:turn\s+)?(on|off)\s+(?:the\s+)?lights?",
     "nexus", "lights_toggle", lambda m: {"on": m.group(1) == "on"}),
    (r"(?:set\s+)?(?:brightness|lights?)\s+(?:to\s+)?(\d+)",
     "nexus", "lights_brightness", lambda m: {"brightness": int(m.group(1))}),
    (r"(?:set\s+)?lights?\s+(?:color|colour)\s+(?:to\s+)?(\S+)",
     "nexus", "lights_color", lambda m: {"color": m.group(1)}),

    # Nexus — AC
    (r"(?:set\s+)?(?:ac|temperature|temp|air\s*con)\s+(?:to\s+)?(\d+)",
     "nexus", "ac_temp", lambda m: {"temp": int(m.group(1))}),
    (r"(?:turn\s+)?(on|off)\s+(?:the\s+)?(?:ac|air\s*con)",
     "nexus", "ac_toggle", lambda m: {"on": m.group(1) == "on"}),

    # Nexus — TV
    (r"(?:turn\s+)?(on|off)\s+(?:the\s+)?tv",
     "nexus", "tv_toggle", lambda m: {"on": m.group(1) == "on"}),
    (r"(?:set\s+)?(?:tv\s+)?volume\s+(?:to\s+)?(\d+)",
     "nexus", "tv_volume", lambda m: {"volume": int(m.group(1))}),
    (r"(?:launch|open)\s+(\w+)\s+(?:on|in)\s+(?:the\s+)?tv",
     "nexus", "tv_app", lambda m: {"app": m.group(1).lower()}),

    # Nexus — Vacuum
    (r"(?:start|begin)\s+(?:the\s+)?(?:vacuum|cleaning|robot)",
     "nexus", "vacuum_start", lambda m: {}),
    (r"(?:stop|dock)\s+(?:the\s+)?(?:vacuum|robot)",
     "nexus", "vacuum_dock", lambda m: {}),

    # Nexus — Scenes
    (r"(?:activate|set)\s+(?:scene\s+)?(?:to\s+)?(movie|morning|sleep|party|away|focus)\s*(?:mode|scene)?",
     "nexus", "scene", lambda m: {"scene": m.group(1).lower()}),

    # Sky — Weather
    (r"(?:what(?:'s|\s+is)\s+the\s+)?weather\s*(?:in\s+)?(.+)?",
     "sky", "weather_query", lambda m: {"location": (m.group(1) or "").strip() or "Constanta"}),
    (r"(?:forecast|weather)\s+(?:for\s+)?(?:tomorrow|next\s+\w+)",
     "sky", "forecast_query", lambda m: {"query": m.group(0)}),

    # Canvas — Image generation
    (r"(?:generate|create|draw|paint)\s+(?:an?\s+)?(?:image|picture|photo)\s+(?:of\s+)?(.+)",
     "canvas", "generate_image", lambda m: {"prompt": m.group(1).strip()}),

    # Lexi — Translation
    (r"(?:translate)\s+(.+?)(?:\s+(?:to|into)\s+(\w+))?$",
     "lexi", "translate", lambda m: {"text": m.group(1).strip(), "target": m.group(2) or "en"}),

    # Sculpt — 3D generation
    (r"(?:sculpt|model|create\s+3d|make\s+3d)\s+(.+)",
     "sculpt", "generate_3d", lambda m: {"prompt": m.group(1).strip()}),

    # Mappy — Navigation
    (r"(?:navigate|directions?|go)\s+(?:to\s+)?(.+)",
     "mappy", "navigate", lambda m: {"destination": m.group(1).strip()}),

    # Echo — Coding
    (r"(?:code|write|create|build)\s+(.+)",
     "echo", "code_query", lambda m: {"query": m.group(1).strip()}),

    # Aura — General fallback
    (r"(.+)", "aura", "chat", lambda m: {"message": m.group(1).strip()}),
]


def _match_intent(text: str) -> VoiceCommandResponse:
    """Match text against intent patterns and return the first hit."""
    cleaned = text.strip().lower()

    for pattern, hub, action, extract in _PATTERNS:
        m = re.match(pattern, cleaned, re.IGNORECASE)
        if m:
            params = extract(m)
            spoken = _build_reply(hub, action, params)
            return VoiceCommandResponse(
                action=action, hub=hub, params=params, spoken_reply=spoken
            )

    # Should never reach here because of the catch-all pattern
    return VoiceCommandResponse(
        action="chat", hub="aura",
        params={"message": text},
        spoken_reply="Let me think about that."
    )


def _build_reply(hub: str, action: str, params: dict) -> str:
    """Generate a natural spoken reply for the matched action."""
    replies = {
        ("youtube", "play"): f"Playing {params.get('query', 'music')} on YouTube.",
        ("youtube", "pause"): "Pausing playback.",
        ("youtube", "resume"): "Resuming playback.",
        ("nexus", "lights_toggle"): f"Turning lights {'on' if params.get('on') else 'off'}.",
        ("nexus", "lights_brightness"): f"Setting brightness to {params.get('brightness')}%.",
        ("nexus", "lights_color"): f"Changing light color to {params.get('color')}.",
        ("nexus", "ac_temp"): f"Setting temperature to {params.get('temp')} degrees.",
        ("nexus", "ac_toggle"): f"Turning AC {'on' if params.get('on') else 'off'}.",
        ("nexus", "tv_toggle"): f"Turning TV {'on' if params.get('on') else 'off'}.",
        ("nexus", "tv_volume"): f"Setting TV volume to {params.get('volume')}.",
        ("nexus", "tv_app"): f"Launching {params.get('app')} on TV.",
        ("nexus", "vacuum_start"): "Starting the vacuum.",
        ("nexus", "vacuum_dock"): "Sending vacuum to dock.",
        ("nexus", "scene"): f"Activating {params.get('scene')} scene.",
        ("sky", "weather_query"): f"Getting weather for {params.get('location', 'your area')}.",
        ("sky", "forecast_query"): "Fetching the forecast.",
        ("canvas", "generate_image"): f"Generating an image of {params.get('prompt', 'your request')}.",
        ("lexi", "translate"): f"Translating to {params.get('target', 'English')}.",
        ("sculpt", "generate_3d"): f"Creating a 3D model of {params.get('prompt', 'your request')}.",
        ("mappy", "navigate"): f"Getting directions to {params.get('destination', 'your destination')}.",
        ("echo", "code_query"): "Working on that code.",
        ("aura", "chat"): "Let me think about that.",
    }
    return replies.get((hub, action), "Processing your request.")


@router.post("/command")
async def voice_command(req: VoiceCommandRequest):
    """Parse a voice command, EXECUTE it, and return the result."""
    if not req.text.strip():
        raise HTTPException(400, "Empty command")

    result = _match_intent(req.text)

    # Actually execute the command on the real backend
    execution_result = None
    try:
        from routers.alexa_router import (
            _exec_aura, _exec_canvas, _exec_echo, _exec_lexi,
            _exec_mappy, _exec_nexus, _exec_sculpt, _exec_sky,
        )

        if result.hub == "nexus":
            execution_result = await _exec_nexus(result.action, result.params)
        elif result.hub == "aura":
            execution_result = await _exec_aura(result.params.get("message", req.text))
        elif result.hub == "canvas":
            execution_result = await _exec_canvas(result.params)
        elif result.hub == "sculpt":
            execution_result = await _exec_sculpt(result.params)
        elif result.hub == "echo":
            execution_result = await _exec_echo(result.params)
        elif result.hub == "lexi":
            execution_result = await _exec_lexi(result.params)
        elif result.hub == "sky":
            execution_result = await _exec_sky(result.params)
        elif result.hub == "mappy":
            execution_result = await _exec_mappy(result.params)
        # YouTube is handled on the frontend / Alexa side (AudioPlayer)
    except Exception as exc:
        logger.warning("Voice command execution failed (%s:%s): %s", result.hub, result.action, exc)
        execution_result = f"Command matched but execution failed: {str(exc)[:150]}"

    resp = result.dict()
    if execution_result:
        resp["execution_result"] = execution_result
        resp["spoken_reply"] = execution_result if isinstance(execution_result, str) else result.spoken_reply
    return resp


@router.get("/status")
async def voice_status():
    """List all available voice command categories."""
    categories = set()
    for _, hub, action, _ in _PATTERNS:
        if action != "chat":  # skip catch-all
            categories.add(f"{hub}:{action}")
    return {"available_commands": sorted(categories), "total": len(categories)}
