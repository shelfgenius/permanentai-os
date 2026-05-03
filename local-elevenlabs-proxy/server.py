"""
Local ElevenLabs Proxy — runs on your PC for dev/testing.

This lightweight FastAPI server proxies ElevenLabs TTS + STT calls
from your local machine's IP (which won't be flagged like Render's).

Usage:
  1. pip install fastapi uvicorn httpx python-multipart
  2. python server.py
  3. Expose via ngrok:  ngrok http 8765
  4. Set your frontend to use the ngrok URL as the ElevenLabs proxy

The proxy runs on port 8765 by default.
"""
import io
import os
import logging
import re
from typing import Optional

import httpx
import uvicorn
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("elevenlabs-proxy")

app = FastAPI(title="ElevenLabs Local Proxy")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Config ────────────────────────────────────────────────────────
API_KEY  = os.getenv("ELEVENLABS_API_KEY", "")
VOICE_EN = os.getenv("ELEVENLABS_VOICE_EN", "DvA6jVPzwhTAbLWwZd0K")
VOICE_RO = os.getenv("ELEVENLABS_VOICE_RO", "urzoE6aZYmSRdFQ6215h")
MODEL_ID = "eleven_v3"

# ── Language detection ────────────────────────────────────────────
_RO_CHARS = re.compile(r'[ăâîșțĂÂÎȘȚ]')
_RO_WORDS = re.compile(
    r'\b(și|este|sunt|pentru|care|sau|dar|cum|unde|când|'
    r'ce|nu|da|bine|foarte|acest|această|prin|acum|aici|trebuie)\b',
    re.IGNORECASE,
)

def detect_lang(text: str) -> str:
    if _RO_CHARS.search(text): return "ro"
    hits = len(_RO_WORDS.findall(text))
    if hits / max(len(text.split()), 1) > 0.08: return "ro"
    return "en"


class TtsRequest(BaseModel):
    text: str
    voice: Optional[str] = None
    language: Optional[str] = None


@app.post("/elevenlabs/tts")
async def tts(req: TtsRequest):
    lang = req.language or detect_lang(req.text)
    voice_id = req.voice or (VOICE_RO if lang == "ro" else VOICE_EN)
    logger.info("TTS: lang=%s voice=%s text=%s", lang, voice_id, req.text[:60])

    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            headers={
                "xi-api-key": API_KEY,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            },
            json={
                "text": req.text,
                "model_id": MODEL_ID,
                "output_format": "mp3_44100_128",
                "voice_settings": {"stability": 0.6, "similarity_boost": 0.8},
            },
        )
    if r.status_code != 200:
        logger.warning("TTS error %d: %s", r.status_code, r.text[:200])
        raise HTTPException(r.status_code, r.text[:200])

    return StreamingResponse(
        io.BytesIO(r.content),
        media_type="audio/mpeg",
        headers={"Content-Length": str(len(r.content))},
    )


@app.post("/elevenlabs/stt")
async def stt(audio: UploadFile = File(...)):
    data = await audio.read()
    logger.info("STT: %d bytes", len(data))

    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.elevenlabs.io/v1/speech-to-text",
            headers={"xi-api-key": API_KEY},
            files={"file": (audio.filename or "rec.webm", data, audio.content_type or "audio/webm")},
            data={"model_id": "scribe_v1"},
        )
    if r.status_code != 200:
        logger.warning("STT error %d: %s", r.status_code, r.text[:200])
        raise HTTPException(r.status_code, r.text[:200])

    result = r.json()
    return {"text": result.get("text", ""), "language": result.get("language_code", "en")}


@app.get("/elevenlabs/config")
async def config():
    return {
        "key_set": bool(API_KEY),
        "voice_en": VOICE_EN,
        "voice_ro": VOICE_RO,
        "model": MODEL_ID,
        "output_format": "mp3_44100_128",
    }


@app.get("/health")
async def health():
    return {"status": "ok", "service": "elevenlabs-local-proxy"}


if __name__ == "__main__":
    print("\n  ElevenLabs Local Proxy")
    print("  ─────────────────────")
    print(f"  API Key: {'configured' if API_KEY else 'NOT SET — set ELEVENLABS_API_KEY env var'}")
    print(f"  Voice EN: {VOICE_EN}")
    print(f"  Voice RO: {VOICE_RO}")
    print(f"  Running on http://localhost:8766\n")
    uvicorn.run(app, host="0.0.0.0", port=8766)
