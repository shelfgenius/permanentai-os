"""
ElevenLabs Router — TTS + STT via ElevenLabs API.

Endpoints:
  POST /elevenlabs/tts       — Text-to-Speech (auto language detect → Irish EN / Romanian)
  POST /elevenlabs/stt       — Speech-to-Text (audio file → transcript)
  GET  /elevenlabs/status     — Check API key & voice config

Uses eleven_v3 model, sentence-by-sentence processing for natural pauses.
"""
from __future__ import annotations

import io
import logging
import os
import re
from typing import Optional

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

logger = logging.getLogger("elevenlabs_router")
router = APIRouter(prefix="/elevenlabs", tags=["elevenlabs"])

# ── Config ────────────────────────────────────────────────────────
API_KEY   = os.getenv("ELEVENLABS_API_KEY", "").strip()
VOICE_EN  = os.getenv("ELEVENLABS_VOICE_EN", "DvA6jVPzwhTAbLWwZd0K").strip()  # Irish woman
VOICE_RO  = os.getenv("ELEVENLABS_VOICE_RO", "urzoE6aZYmSRdFQ6215h").strip()  # Romanian woman

# Local proxy URL — if set, all TTS/STT calls go through your local machine
# instead of Render calling ElevenLabs directly (which gets 401 flagged).
# Run local-elevenlabs-proxy/server.py on your PC, expose via ngrok, set this env var.
PROXY_URL = os.getenv("ELEVENLABS_PROXY_URL", "").strip()

TTS_URL   = f"{PROXY_URL}/tts" if PROXY_URL else "https://api.elevenlabs.io/v1/text-to-speech"
STT_URL   = f"{PROXY_URL}/stt" if PROXY_URL else "https://api.elevenlabs.io/v1/speech-to-text"

MODEL_ID  = "eleven_v3"
OUTPUT_FMT = "mp3_44100_128"

# ── Language detection ────────────────────────────────────────────
_RO_CHARS = re.compile(r'[ăâîșțĂÂÎȘȚ]')
_RO_WORDS = re.compile(
    r'\b('
    # Core Romanian words (with and without diacritics)
    r'si|și|este|sunt|pentru|care|sau|dar|cum|unde|cand|când|'
    r'ce|nu|da|bine|foarte|acest|aceasta|această|prin|acum|aici|'
    r'trebuie|poate|atunci|acolo|doar|despre|avea|face|spune|merge|'
    r'lucru|insa|însă|daca|dacă|ori|fie|nici|mai|tot|din|'
    r'la|de|cu|pe|le|se|va|ne|te|ma|mă|'
    r'unui|unei|unor|cele|cel|cea|cei|ale|lui|lor|'
    r'putea|vreau|vrei|vrea|vrem|vreti|vor|'
    r'am|ai|are|avem|aveti|au|era|eram|erai|erau|'
    r'fost|fac|faci|facem|faceti|'
    r'asta|astea|astia|acestea|acestia|'
    r'undeva|nicaieri|nicăieri|oriunde|'
    r'buna|bună|salut|multumesc|mulțumesc|'
    r'stiu|știu|stii|știi|stie|știe|'
    r'cat|cât|cati|câți|cate|câte|'
    r'mult|multa|multă|multi|mulți|multe|'
    r'frumos|frumoasa|frumoasă|mare|mic|mica|mică|'
    r'timp|casa|casă|om|oameni|copil|copii|'
    r'lucrez|lucrezi|lucreaza|lucrează|'
    r'Romania|România|roman|român|romana|română|romanesc|românesc|'
    r'limba|limbă|vorbesc|vorbeste|vorbește'
    r')\b',
    re.IGNORECASE,
)


def _detect_language(text: str) -> str:
    """Detect Romanian vs English. Returns 'ro' or 'en'."""
    if _RO_CHARS.search(text):
        return "ro"
    ro_hits = len(_RO_WORDS.findall(text))
    word_count = max(len(text.split()), 1)
    # Lower threshold + absolute count for short texts
    if ro_hits / word_count > 0.05 or (ro_hits >= 3 and word_count < 30):
        return "ro"
    return "en"


# ── Text preprocessing for TTS ───────────────────────────────────
# Abbreviations that should NOT be treated as sentence endings
_ABBREVIATIONS = {
    "Mr.": "Mister", "Mrs.": "Missus", "Ms.": "Miss", "Dr.": "Doctor",
    "Prof.": "Professor", "Sr.": "Senior", "Jr.": "Junior",
    "St.": "Saint", "vs.": "versus", "etc.": "etcetera",
    "e.g.": "for example", "i.e.": "that is",
    "a.m.": "A M", "p.m.": "P M",
    "U.S.": "U S", "U.K.": "U K", "E.U.": "E U",
    "Dl.": "Domnul", "Dna.": "Doamna", "Nr.": "Numărul",
}

# Sentence boundary regex — split on .!? followed by whitespace
_SENTENCE_SPLIT = re.compile(
    r'(?<=[.!?])'           # lookbehind for sentence-ending punctuation
    r'(?:["\')\]»])?'       # optional closing quote/bracket
    r'\s+'                   # required whitespace
    r'(?=[A-ZĂÂÎȘȚ"\'\[(])'  # lookahead for uppercase / opening quote
)


def _preprocess(text: str) -> list[str]:
    """Clean text and split into proper sentences for TTS."""
    # Replace abbreviations to avoid false sentence breaks
    for abbr, replacement in _ABBREVIATIONS.items():
        text = text.replace(abbr, replacement)

    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()

    # Remove markdown formatting
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)   # bold
    text = re.sub(r'\*(.+?)\*', r'\1', text)        # italic
    text = re.sub(r'`(.+?)`', r'\1', text)           # code
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)  # headings

    # Normalize ellipses — don't treat as sentence end
    text = text.replace('...', '—')
    text = text.replace('…', '—')

    # Split into sentences
    sentences = _SENTENCE_SPLIT.split(text)

    # Filter empty / too-short fragments
    result = []
    for s in sentences:
        s = s.strip()
        if len(s) > 2:
            result.append(s)

    return result if result else [text.strip()]


# ── TTS request model ────────────────────────────────────────────
class TtsRequest(BaseModel):
    text: str
    voice: Optional[str] = None   # override voice ID
    language: Optional[str] = None  # "en" or "ro", auto-detect if None


# ── TTS endpoint ─────────────────────────────────────────────────
@router.post("/tts")
async def elevenlabs_tts(req: TtsRequest):
    """
    ElevenLabs TTS — auto-detects language, routes to correct voice,
    processes sentence-by-sentence for natural pauses.
    Returns audio/mpeg stream.
    """
    if not API_KEY:
        raise HTTPException(503, "ELEVENLABS_API_KEY not configured")
    if not req.text.strip():
        raise HTTPException(400, "Empty text")

    # Detect language & pick voice
    lang = req.language or _detect_language(req.text)
    voice_id = req.voice or (VOICE_RO if lang == "ro" else VOICE_EN)
    logger.info("ElevenLabs TTS: lang=%s voice=%s len=%d", lang, voice_id, len(req.text))

    # Preprocess into sentences
    sentences = _preprocess(req.text)
    logger.info("ElevenLabs TTS: %d sentences", len(sentences))

    # Generate audio for each sentence, concatenate
    audio_chunks = []

    async with httpx.AsyncClient(timeout=60) as client:
        for i, sentence in enumerate(sentences):
            if not sentence.strip():
                continue

            try:
                if PROXY_URL:
                    # ── Local proxy mode ──
                    # Send to local proxy which calls ElevenLabs from your PC's IP
                    r = await client.post(
                        f"{PROXY_URL}/tts",
                        json={
                            "text": sentence,
                            "voice": voice_id,
                            "language": lang,
                        },
                    )
                else:
                    # ── Direct ElevenLabs API ──
                    headers = {
                        "xi-api-key": API_KEY,
                        "Content-Type": "application/json",
                        "Accept": "audio/mpeg",
                    }
                    payload = {
                        "text": sentence,
                        "model_id": MODEL_ID,
                        "output_format": OUTPUT_FMT,
                        "voice_settings": {
                            "stability": 0.6,
                            "similarity_boost": 0.8,
                        },
                    }
                    r = await client.post(
                        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
                        headers=headers,
                        json=payload,
                    )

                if r.status_code == 200:
                    audio_chunks.append(r.content)
                    logger.debug("Sentence %d OK: %d bytes", i, len(r.content))
                else:
                    logger.warning("ElevenLabs TTS sentence %d error %d: %s",
                                   i, r.status_code, r.text[:200])
            except Exception as e:
                logger.warning("ElevenLabs TTS sentence %d exception: %s", i, e)

    if not audio_chunks:
        raise HTTPException(502, "ElevenLabs TTS failed — no audio generated")

    # Concatenate MP3 chunks (MP3 frames are independently decodable)
    combined = b"".join(audio_chunks)
    logger.info("ElevenLabs TTS: %d bytes total audio", len(combined))

    return StreamingResponse(
        io.BytesIO(combined),
        media_type="audio/mpeg",
        headers={"Content-Length": str(len(combined))},
    )


# ── STT endpoint ─────────────────────────────────────────────────
@router.post("/stt")
async def elevenlabs_stt(audio: UploadFile = File(...)):
    """
    ElevenLabs Speech-to-Text — accepts audio file, returns transcript.
    """
    if not API_KEY:
        raise HTTPException(503, "ELEVENLABS_API_KEY not configured")

    audio_bytes = await audio.read()
    content_type = audio.content_type or "audio/webm"
    filename = audio.filename or "recording.webm"
    logger.info("ElevenLabs STT: %d bytes, type=%s", len(audio_bytes), content_type)

    headers = {
        "xi-api-key": API_KEY,
    }

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                STT_URL,
                headers=headers,
                files={"file": (filename, audio_bytes, content_type)},
                data={"model_id": "scribe_v1"},
            )
        if r.status_code == 200:
            data = r.json()
            text = data.get("text", "")
            lang = data.get("language_code", "en")
            logger.info("ElevenLabs STT OK: lang=%s text=%s", lang, text[:80])
            return {"text": text, "language": lang}
        else:
            logger.warning("ElevenLabs STT error %d: %s", r.status_code, r.text[:200])
            raise HTTPException(r.status_code, f"ElevenLabs STT error: {r.text[:200]}")
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("ElevenLabs STT exception: %s", e)
        raise HTTPException(502, f"ElevenLabs STT failed: {e}")


# ── Config endpoint (for direct browser calls) ──────────────────
@router.get("/config")
async def elevenlabs_config():
    """
    Return ElevenLabs config so the frontend can call the API directly
    from the browser. This bypasses Render's IP which gets flagged on
    the free tier. The browser's own IP won't be flagged.
    """
    if not API_KEY:
        raise HTTPException(503, "ELEVENLABS_API_KEY not configured")
    return {
        "key": API_KEY,
        "voice_en": VOICE_EN,
        "voice_ro": VOICE_RO,
        "model": MODEL_ID,
        "output_format": OUTPUT_FMT,
        "proxy_url": PROXY_URL or None,
    }


# ── Status endpoint ──────────────────────────────────────────────
@router.get("/status")
async def elevenlabs_status():
    """Check ElevenLabs configuration."""
    return {
        "configured": bool(API_KEY),
        "proxy_active": bool(PROXY_URL),
        "proxy_url": PROXY_URL or None,
        "voice_en": VOICE_EN,
        "voice_ro": VOICE_RO,
        "model": MODEL_ID,
        "output_format": OUTPUT_FMT,
    }
