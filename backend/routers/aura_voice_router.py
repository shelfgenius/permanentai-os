"""AURA Voice Pipeline — Local NIM containers (Parakeet STT + Magpie TTS Zeroshot).

Pipeline:  mic WAV → Parakeet (~200-400ms) → Nemotron Omni (~500-1500ms) → Magpie TTS (~300-800ms)

Endpoints:
  POST /aura/voice/stt          — Audio → transcript (local Parakeet)
  POST /aura/voice/tts          — Text  → audio WAV  (local Magpie, Irish female voice)
  POST /aura/voice/tts/builtin  — Text  → audio WAV  (built-in voice, no reference)
  GET  /aura/voice/health       — Health check for both containers
  GET  /aura/voice/voices       — List available built-in voices

Falls back gracefully to cloud NIM endpoints if local containers are unavailable.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional

logger = logging.getLogger("aura_voice_router")
router = APIRouter(prefix="/aura/voice", tags=["aura-voice"])

# ── Local NIM container endpoints ─────────────────────────────────
PARAKEET_URL = os.getenv("AURA_PARAKEET_URL", "http://localhost:9200")
MAGPIE_URL   = os.getenv("AURA_MAGPIE_URL", "http://localhost:9300")

# ── Cloud NIM fallback endpoints ──────────────────────────────────
NIM_BASE     = os.getenv("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
KEY_ASR      = os.getenv("NVIDIA_API_KEY_ASR", "")
KEY_TTS      = os.getenv("NVIDIA_API_KEY_TTS", "")

# ── Irish voice reference WAV for zero-shot cloning ───────────────
# Place a 5-10s clear recording of an Irish female voice at this path.
# Requirements: 16-bit mono WAV, 22.05kHz or higher, minimal background noise.
IRISH_VOICE_PATH = os.getenv("AURA_IRISH_VOICE_WAV", "voices/aura_irish.wav")

# ── Default voice settings ────────────────────────────────────────
DEFAULT_VOICE    = "Magpie-ZeroShot.Female-Calm"    # built-in fallback
DEFAULT_LANGUAGE = "en-US"
DEFAULT_QUALITY  = 25   # 1-40, higher = closer voice match but slower


# ── Models ────────────────────────────────────────────────────────

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = None       # built-in voice name (ignored if Irish reference exists)
    language: str = "en-US"
    quality: int = DEFAULT_QUALITY     # zero-shot quality 1-40
    use_reference: bool = True         # whether to use Irish voice reference


class TTSResponse(BaseModel):
    source: str         # "local-magpie" | "cloud-magpie" | "fallback"
    voice_used: str
    audio_size: int


# ── Helpers ───────────────────────────────────────────────────────

def _get_irish_voice_bytes() -> bytes | None:
    """Load the Irish voice reference WAV if it exists."""
    p = Path(IRISH_VOICE_PATH)
    if p.exists() and p.stat().st_size > 1000:
        return p.read_bytes()
    # Also check inside backend dir
    alt = Path(__file__).resolve().parent.parent / IRISH_VOICE_PATH
    if alt.exists() and alt.stat().st_size > 1000:
        return alt.read_bytes()
    return None


async def _check_container(url: str) -> bool:
    """Check if a NIM container is healthy."""
    try:
        async with httpx.AsyncClient(timeout=3) as c:
            r = await c.get(f"{url}/v1/health/ready")
            return r.status_code == 200
    except Exception:
        return False


# ── STT: Parakeet (local → cloud fallback) ────────────────────────

@router.post("/stt")
async def aura_stt(audio: UploadFile = File(...)):
    """Transcribe audio via local Parakeet NIM container.
    Falls back to cloud Parakeet if local is unavailable.
    """
    audio_bytes = await audio.read()
    content_type = audio.content_type or "audio/wav"
    filename = audio.filename or "audio.wav"

    # 1. Try local Parakeet
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(
                f"{PARAKEET_URL}/v1/audio/transcriptions",
                files={"file": (filename, audio_bytes, content_type)},
            )
        if r.status_code == 200:
            data = r.json()
            return {"text": data.get("text", ""), "source": "local-parakeet"}
    except Exception as e:
        logger.info("Local Parakeet unavailable (%s), falling back to cloud", e)

    # 2. Fallback: cloud Parakeet via NVIDIA NIM
    if KEY_ASR:
        try:
            async with httpx.AsyncClient(timeout=30) as c:
                r = await c.post(
                    f"{NIM_BASE}/audio/transcriptions",
                    files={"file": (filename, audio_bytes, content_type)},
                    data={"model": "nvidia/parakeet-ctc-0.6b-asr", "language": "en"},
                    headers={"Authorization": f"Bearer {KEY_ASR}"},
                )
            if r.status_code == 200:
                data = r.json()
                return {"text": data.get("text", ""), "source": "cloud-parakeet"}
        except Exception as e:
            logger.warning("Cloud Parakeet also failed: %s", e)

    raise HTTPException(503, "Speech recognition unavailable — both local and cloud Parakeet failed")


# ── TTS: Magpie Zeroshot (local → cloud fallback) ─────────────────

@router.post("/tts")
async def aura_tts(req: TTSRequest):
    """Synthesize speech via local Magpie TTS Zeroshot NIM container.

    Strategy:
      1. If Irish voice reference WAV exists → zero-shot voice cloning (local)
      2. Else → built-in Female-Calm voice (local)
      3. If local container down → cloud Magpie TTS Multilingual fallback
    """
    if not req.text.strip():
        raise HTTPException(400, "Empty text")

    irish_wav = _get_irish_voice_bytes() if req.use_reference else None

    # 1. Try local Magpie Zeroshot
    try:
        if irish_wav:
            # Zero-shot voice cloning with Irish reference
            async with httpx.AsyncClient(timeout=30) as c:
                r = await c.post(
                    f"{MAGPIE_URL}/v1/audio/synthesize",
                    data={
                        "text": req.text,
                        "language": req.language,
                    },
                    files={
                        "audio_prompt": ("aura_irish.wav", irish_wav, "audio/wav"),
                    },
                )
            if r.status_code == 200 and len(r.content) > 100:
                return Response(
                    content=r.content,
                    media_type="audio/wav",
                    headers={
                        "X-TTS-Source": "local-magpie-zeroshot",
                        "X-TTS-Voice": "irish-zeroshot",
                    },
                )
            logger.warning("Local Magpie zeroshot error %s", r.status_code)
        else:
            # Built-in voice (Female-Calm by default)
            voice = req.voice or DEFAULT_VOICE
            async with httpx.AsyncClient(timeout=30) as c:
                r = await c.post(
                    f"{MAGPIE_URL}/v1/audio/synthesize",
                    data={
                        "text": req.text,
                        "language": req.language,
                        "voice": voice,
                    },
                )
            if r.status_code == 200 and len(r.content) > 100:
                return Response(
                    content=r.content,
                    media_type="audio/wav",
                    headers={
                        "X-TTS-Source": "local-magpie-builtin",
                        "X-TTS-Voice": voice,
                    },
                )
            logger.warning("Local Magpie builtin error %s", r.status_code)
    except Exception as e:
        logger.info("Local Magpie unavailable (%s), falling back to cloud", e)

    # 2. Fallback: cloud Magpie TTS Multilingual
    if KEY_TTS:
        try:
            async with httpx.AsyncClient(timeout=30) as c:
                r = await c.post(
                    f"{NIM_BASE}/audio/speech",
                    json={
                        "model": "magpie-tts-multilingual",
                        "input": req.text,
                        "voice": "multilingual_female",
                        "language": "en",
                    },
                    headers={
                        "Authorization": f"Bearer {KEY_TTS}",
                        "Accept": "audio/wav",
                    },
                )
            if r.status_code == 200 and len(r.content) > 100:
                return Response(
                    content=r.content,
                    media_type="audio/wav",
                    headers={
                        "X-TTS-Source": "cloud-magpie-multilingual",
                        "X-TTS-Voice": "multilingual_female",
                    },
                )
            logger.warning("Cloud Magpie error %s: %s", r.status_code, r.text[:200])
        except Exception as e:
            logger.warning("Cloud Magpie also failed: %s", e)

    raise HTTPException(503, "TTS unavailable — both local and cloud Magpie failed")


@router.post("/tts/builtin")
async def aura_tts_builtin(req: TTSRequest):
    """Force built-in voice (no reference audio). Useful for testing voices."""
    req.use_reference = False
    return await aura_tts(req)


# ── Health / Status ───────────────────────────────────────────────

@router.get("/health")
async def voice_health():
    """Check health of local NIM containers + voice reference status."""
    parakeet_ok = await _check_container(PARAKEET_URL)
    magpie_ok = await _check_container(MAGPIE_URL)
    irish_wav = _get_irish_voice_bytes()

    return {
        "pipeline": "ready" if (parakeet_ok and magpie_ok) else "degraded",
        "parakeet": {
            "status": "online" if parakeet_ok else "offline",
            "url": PARAKEET_URL,
            "fallback": "cloud" if KEY_ASR else "none",
        },
        "magpie": {
            "status": "online" if magpie_ok else "offline",
            "url": MAGPIE_URL,
            "fallback": "cloud" if KEY_TTS else "none",
        },
        "voice": {
            "irish_reference": "loaded" if irish_wav else "not found",
            "irish_reference_path": IRISH_VOICE_PATH,
            "irish_reference_size": len(irish_wav) if irish_wav else 0,
            "default_builtin": DEFAULT_VOICE,
            "quality": DEFAULT_QUALITY,
        },
    }


@router.get("/voices")
async def list_voices():
    """List available built-in Magpie TTS Zeroshot voices."""
    return {
        "builtin_voices": [
            {"id": "Magpie-ZeroShot.Female-1", "gender": "female", "emotion": "default"},
            {"id": "Magpie-ZeroShot.Female-Calm", "gender": "female", "emotion": "calm"},
            {"id": "Magpie-ZeroShot.Female-Neutral", "gender": "female", "emotion": "neutral"},
            {"id": "Magpie-ZeroShot.Female-Happy", "gender": "female", "emotion": "happy"},
            {"id": "Magpie-ZeroShot.Female-Angry", "gender": "female", "emotion": "angry"},
            {"id": "Magpie-ZeroShot.Female-Fearful", "gender": "female", "emotion": "fearful"},
            {"id": "Magpie-ZeroShot.Male-1", "gender": "male", "emotion": "default"},
            {"id": "Magpie-ZeroShot.Male-Calm", "gender": "male", "emotion": "calm"},
            {"id": "Magpie-ZeroShot.Male-Neutral", "gender": "male", "emotion": "neutral"},
            {"id": "Magpie-ZeroShot.Male-Angry", "gender": "male", "emotion": "angry"},
            {"id": "Magpie-ZeroShot.Male-Fearful", "gender": "male", "emotion": "fearful"},
        ],
        "zero_shot": {
            "supported": True,
            "reference_requirements": {
                "format": "16-bit mono WAV",
                "sample_rate": "22.05 kHz or higher",
                "duration": "3-10 seconds (5s ideal)",
                "content": "Clear speech, minimal background noise",
            },
        },
        "active_voice": "irish-zeroshot" if _get_irish_voice_bytes() else DEFAULT_VOICE,
    }
