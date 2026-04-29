"""XTTS Voice Router — Multi-agent TTS with stream buffering.

Each agent has a distinct voice profile. The frontend sends text with
an agent tag [AgentName]: and this router loads the correct speaker
embedding for Coqui XTTS voice cloning.

Stream buffering: sentences are sent to TTS as they arrive from the LLM,
not waiting for the full paragraph — achieving low-latency voice output.
"""
from __future__ import annotations
import os, re, logging, io
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger("xtts_router")
router = APIRouter(prefix="/xtts", tags=["xtts"])

# Voice reference audio directory
VOICES_DIR = Path(os.getenv("XTTS_VOICES_DIR", "voices"))

# Kokoro TTS (local, free, high-quality) — OpenAI-compatible API
KOKORO_URL = os.getenv("KOKORO_TTS_URL", "http://localhost:8880")

# Kokoro voice mapping per agent (distinct personality voices)
KOKORO_AGENT_VOICES = {
    "aura":  {"voice": "bf_emma",     "speed": 0.95},  # British Female — elegant, F.R.I.D.A.Y.-like
    "nexus": {"voice": "am_adam",     "speed": 0.95},  # American Male — deep, steady
    "mappy": {"voice": "bm_lewis",    "speed": 1.15},  # British Male — casual, hurried
    "sky":   {"voice": "af_sky",      "speed": 1.05},  # American Female — smooth, worried
    "echo":  {"voice": "am_michael",  "speed": 1.0},   # American Male — warm, pragmatic
}

# Agent voice profiles — maps to reference audio files (legacy Coqui XTTS)
AGENT_PROFILES = {
    "aura":  {"voice": "female_calm",     "ref": "aura_calm.wav",     "speed": 1.0,  "temperature": 0.65},
    "nexus": {"voice": "male_deep",       "ref": "nexus_deep.wav",    "speed": 0.95, "temperature": 0.5},
    "mappy": {"voice": "male_highpitch",  "ref": "mappy_agitated.wav","speed": 1.15, "temperature": 0.8},
    "sky":   {"voice": "female_anxious",  "ref": "sky_anxious.wav",   "speed": 1.05, "temperature": 0.75},
    "echo":  {"voice": "male_normal",     "ref": "echo_normal.wav",   "speed": 1.0,  "temperature": 0.6},
}


class XTTSRequest(BaseModel):
    text: str
    agent: str = "aura"       # aura | nexus | mappy | sky | echo
    language: str = "en"


class XTTSStreamRequest(BaseModel):
    """For sentence-by-sentence streaming from the LLM pipeline."""
    sentences: list[str]
    agent: str = "aura"
    language: str = "en"


_kokoro_pipeline = None

def _kokoro_generate_sync(text: str, voice_id: str, speed: float) -> bytes:
    """Synchronous Kokoro generation (called via run_in_executor)."""
    global _kokoro_pipeline
    from kokoro_onnx import Kokoro
    import soundfile as sf

    if _kokoro_pipeline is None:
        model_dir = Path(__file__).resolve().parent.parent / "kokoro-models"
        model_path = model_dir / "model.onnx"
        if not model_path.exists():
            model_path = model_dir / "kokoro-v1.0.onnx"
        voices_path = model_dir / "voices-v1.0.bin"
        if not model_path.exists() or not voices_path.exists():
            logger.warning("Kokoro model files not found in %s", model_dir)
            return b""
        logger.info("Loading Kokoro ONNX model (first call)...")
        _kokoro_pipeline = Kokoro(str(model_path), str(voices_path))
        logger.info("Kokoro ONNX model loaded.")

    samples, sample_rate = _kokoro_pipeline.create(
        text, voice=voice_id, speed=speed, lang="en-us"
    )

    buf = io.BytesIO()
    sf.write(buf, samples, sample_rate, format='WAV', subtype='PCM_16')
    return buf.getvalue()


async def _kokoro_synthesize(text: str, voice_id: str, speed: float = 0.95) -> bytes:
    """Try direct Python Kokoro, then HTTP Docker fallback."""
    # Direct Python
    try:
        import asyncio
        loop = asyncio.get_event_loop()
        audio = await loop.run_in_executor(None, _kokoro_generate_sync, text, voice_id, speed)
        if audio:
            return audio
    except ImportError:
        pass
    except Exception as exc:
        logger.debug("Kokoro direct failed: %s", exc)

    # HTTP fallback (Docker container)
    try:
        import httpx
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(f"{KOKORO_URL}/v1/audio/speech", json={
                "input": text, "voice": voice_id, "model": "kokoro",
                "response_format": "mp3", "speed": speed,
            })
        if r.status_code == 200 and len(r.content) > 100:
            return r.content
    except Exception:
        pass

    return b""


def _parse_agent_tag(text: str) -> tuple[str, str]:
    """Extract [AgentName]: prefix from text.
    Returns (agent_id, cleaned_text).
    """
    m = re.match(r"^\[(\w+)\]:\s*(.*)", text, re.DOTALL)
    if m:
        name = m.group(1).lower()
        if name in AGENT_PROFILES:
            return name, m.group(2)
    return "aura", text


@router.post("/speak")
async def xtts_speak(req: XTTSRequest):
    """Single-shot TTS for one text block. Tries Kokoro first, then Coqui XTTS."""
    agent_id, clean_text = _parse_agent_tag(req.text)
    if not clean_text.strip():
        raise HTTPException(400, "Empty text")

    # Use explicitly provided agent if no tag found
    if agent_id == "aura" and req.agent != "aura":
        agent_id = req.agent

    # ── Try Kokoro TTS first (direct Python, then HTTP fallback) ──
    kokoro_voice = KOKORO_AGENT_VOICES.get(agent_id, KOKORO_AGENT_VOICES["aura"])
    kokoro_audio = await _kokoro_synthesize(clean_text, kokoro_voice["voice"], kokoro_voice["speed"])
    if kokoro_audio:
        logger.info("Kokoro TTS OK (%d bytes, voice=%s, agent=%s)", len(kokoro_audio), kokoro_voice["voice"], agent_id)
        return Response(content=kokoro_audio, media_type="audio/wav")

    # ── Fallback: Coqui XTTS ──
    profile = AGENT_PROFILES.get(agent_id, AGENT_PROFILES["aura"])
    xtts_url = os.getenv("XTTS_SERVER_URL", "http://localhost:8020")

    try:
        import httpx
        ref_path = VOICES_DIR / profile["ref"]

        # If we have a reference audio file, use voice cloning
        if ref_path.exists():
            with open(ref_path, "rb") as f:
                ref_audio = f.read()

            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    f"{xtts_url}/tts_to_audio/",
                    json={
                        "text": clean_text,
                        "speaker_wav": str(ref_path),
                        "language": req.language,
                        "speed": profile["speed"],
                        "temperature": profile["temperature"],
                    },
                )
        else:
            # Fallback: use default XTTS voice
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    f"{xtts_url}/tts_to_audio/",
                    json={
                        "text": clean_text,
                        "language": req.language,
                        "speed": profile["speed"],
                    },
                )

        if r.status_code != 200:
            logger.warning("XTTS error %s: %s", r.status_code, r.text[:200])
            raise HTTPException(r.status_code, f"XTTS error: {r.text[:200]}")

        return Response(content=r.content, media_type="audio/wav")

    except ImportError:
        raise HTTPException(503, "httpx not installed")
    except httpx.ConnectError:
        raise HTTPException(503, f"XTTS server not reachable at {xtts_url}")
    except httpx.TimeoutException:
        raise HTTPException(504, "XTTS timeout")


@router.post("/stream")
async def xtts_stream(req: XTTSStreamRequest):
    """Stream-buffered TTS — processes sentences as they arrive.
    Returns concatenated WAV audio for all sentences.
    This is the low-latency path: the frontend sends sentences
    one by one as the LLM generates them.
    """
    profile = AGENT_PROFILES.get(req.agent, AGENT_PROFILES["aura"])
    xtts_url = os.getenv("XTTS_SERVER_URL", "http://localhost:8020")

    audio_chunks = []

    try:
        import httpx
        ref_path = VOICES_DIR / profile["ref"]

        async with httpx.AsyncClient(timeout=30) as client:
            for sentence in req.sentences:
                if not sentence.strip():
                    continue

                payload = {
                    "text": sentence,
                    "language": req.language,
                    "speed": profile["speed"],
                    "temperature": profile["temperature"],
                }
                if ref_path.exists():
                    payload["speaker_wav"] = str(ref_path)

                r = await client.post(f"{xtts_url}/tts_to_audio/", json=payload)
                if r.status_code == 200:
                    audio_chunks.append(r.content)

        if not audio_chunks:
            raise HTTPException(400, "No audio generated")

        # Concatenate WAV chunks (simple concat — assumes same format)
        combined = b"".join(audio_chunks)
        return Response(content=combined, media_type="audio/wav")

    except ImportError:
        raise HTTPException(503, "httpx not installed")
    except httpx.ConnectError:
        raise HTTPException(503, f"XTTS server not reachable at {xtts_url}")


@router.get("/agents")
async def list_agents():
    """Return all available voice agent profiles."""
    # Check Kokoro availability
    kokoro_available = False
    try:
        import httpx
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(f"{KOKORO_URL}/v1/audio/voices")
            kokoro_available = r.status_code == 200
    except Exception:
        pass

    return {
        "kokoro_available": kokoro_available,
        "kokoro_url": KOKORO_URL,
        "agents": {
            k: {
                "voice": v["voice"],
                "speed": v["speed"],
                "reference_exists": (VOICES_DIR / v["ref"]).exists(),
                "kokoro_voice": KOKORO_AGENT_VOICES.get(k, {}).get("voice", "af_heart"),
            }
            for k, v in AGENT_PROFILES.items()
        },
        "xtts_url": os.getenv("XTTS_SERVER_URL", "http://localhost:8020"),
    }
