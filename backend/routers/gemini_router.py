"""
Gemini Live Audio Router — Multimodal audio-to-audio via Gemini 1.5 Flash/Pro.

Endpoints:
  POST /gemini/audio   — Send base64 audio, get streamed text + optional TTS audio back
  POST /gemini/chat    — Text-only chat via Gemini (fallback when audio isn't available)
  GET  /gemini/status  — Check if Gemini key is configured

Requires GEMINI_API_KEY in backend/.env
"""
from __future__ import annotations

import os
import json
import logging
import base64

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, JSONResponse
from pydantic import BaseModel
from typing import List, Optional

logger = logging.getLogger("gemini_router")
router = APIRouter(prefix="/gemini", tags=["gemini"])

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.0-flash"
GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta"


# ── Models ────────────────────────────────────────────────────────────────────

class GeminiMessage(BaseModel):
    role: str  # "user" | "model"
    content: str

class GeminiChatRequest(BaseModel):
    messages: List[GeminiMessage]
    max_tokens: int = 4096
    temperature: float = 0.7
    stream: bool = False

class GeminiAudioRequest(BaseModel):
    audio_b64: str  # base64-encoded audio (webm/ogg/wav)
    mime_type: str = "audio/webm"
    messages: Optional[List[GeminiMessage]] = None  # optional conversation history
    system_prompt: Optional[str] = None


# ── Helpers ───────────────────────────────────────────────────────────────────

def _build_contents(messages: List[GeminiMessage]) -> list:
    """Convert our message format to Gemini's content format."""
    contents = []
    for m in messages:
        role = "user" if m.role == "user" else "model"
        contents.append({
            "role": role,
            "parts": [{"text": m.content}]
        })
    return contents


# ── Text Chat ─────────────────────────────────────────────────────────────────

@router.post("/chat")
async def gemini_chat(req: GeminiChatRequest):
    """Text chat via Gemini. Supports streaming SSE."""
    if not GEMINI_API_KEY:
        raise HTTPException(503, "GEMINI_API_KEY not configured")

    contents = _build_contents(req.messages)

    if req.stream:
        url = f"{GEMINI_BASE}/models/{GEMINI_MODEL}:streamGenerateContent?alt=sse&key={GEMINI_API_KEY}"

        async def stream_gen():
            async with httpx.AsyncClient(timeout=120) as client:
                async with client.stream("POST", url, json={
                    "contents": contents,
                    "generationConfig": {
                        "maxOutputTokens": req.max_tokens,
                        "temperature": req.temperature,
                    }
                }) as resp:
                    async for line in resp.aiter_lines():
                        if not line.startswith("data: "):
                            continue
                        payload = line[6:].strip()
                        if payload == "[DONE]":
                            yield "data: [DONE]\n\n"
                            break
                        try:
                            j = json.loads(payload)
                            text = j.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                            if text:
                                # Re-emit in OpenAI-compatible SSE format
                                sse = json.dumps({
                                    "choices": [{"delta": {"content": text}}]
                                })
                                yield f"data: {sse}\n\n"
                        except Exception:
                            continue
                    yield "data: [DONE]\n\n"

        return StreamingResponse(stream_gen(), media_type="text/event-stream")
    else:
        url = f"{GEMINI_BASE}/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, json={
                "contents": contents,
                "generationConfig": {
                    "maxOutputTokens": req.max_tokens,
                    "temperature": req.temperature,
                }
            })
        if r.status_code != 200:
            logger.warning("Gemini error %s: %s", r.status_code, r.text[:300])
            raise HTTPException(r.status_code, f"Gemini error: {r.text[:200]}")

        data = r.json()
        text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
        return {
            "choices": [{"message": {"role": "assistant", "content": text}}]
        }


# ── Audio (Multimodal) ───────────────────────────────────────────────────────

@router.post("/audio")
async def gemini_audio(req: GeminiAudioRequest):
    """
    Send audio to Gemini multimodal → get text response.
    Audio is sent as inline_data in the Gemini content format.
    """
    if not GEMINI_API_KEY:
        raise HTTPException(503, "GEMINI_API_KEY not configured")

    # Build content: conversation history + audio part
    contents = []
    if req.messages:
        contents = _build_contents(req.messages)

    # System instruction
    system_parts = []
    if req.system_prompt:
        system_parts = [{"text": req.system_prompt}]

    # Audio part as the latest user message
    audio_part = {
        "role": "user",
        "parts": [
            {"inline_data": {"mime_type": req.mime_type, "data": req.audio_b64}},
            {"text": "Please respond to this audio message naturally and conversationally."}
        ]
    }
    contents.append(audio_part)

    url = f"{GEMINI_BASE}/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"

    body = {
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": 2048,
            "temperature": 0.7,
        }
    }
    if system_parts:
        body["systemInstruction"] = {"parts": system_parts}

    async with httpx.AsyncClient(timeout=90) as client:
        r = await client.post(url, json=body)

    if r.status_code != 200:
        logger.warning("Gemini audio error %s: %s", r.status_code, r.text[:300])
        raise HTTPException(r.status_code, f"Gemini audio error: {r.text[:200]}")

    data = r.json()
    text = data.get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")

    return {"text": text, "role": "assistant"}


# ── Status ────────────────────────────────────────────────────────────────────

@router.get("/status")
async def gemini_status():
    return {
        "configured": bool(GEMINI_API_KEY),
        "model": GEMINI_MODEL,
    }
