"""TTS router — generate audio and return WAV bytes.

Endpoints:
  POST /tts/speak          — full text → full audio (legacy)
  POST /tts/synthesize     — alias
  POST /tts/stream-chunks  — streaming: splits text into sentences,
                             yields each audio chunk as multipart so the
                             frontend can start playing immediately (< 500ms).
"""
from __future__ import annotations

import re

from fastapi import APIRouter
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from typing import Optional

from services.tts_service import get_tts_service

router = APIRouter(prefix="/tts", tags=["tts"])


class TTSRequest(BaseModel):
    text: str
    domain: str = "constructii"


class TTSStreamRequest(BaseModel):
    text: str
    domain: str = "general"
    first_buffer_words: int = 5  # send first N words immediately


def _split_sentences(text: str, first_n: int = 5) -> list[str]:
    """Split text into short sentences for streaming.
    The "first buffer" trick: peel off the first N words as a tiny chunk
    so audio starts playing almost instantly, then split the rest normally."""
    words = text.split()
    if not words:
        return []

    chunks = []
    # First buffer: first N words regardless of punctuation
    if len(words) > first_n:
        first = " ".join(words[:first_n])
        rest = " ".join(words[first_n:])
        chunks.append(first)
        # Split remainder by sentence-ending punctuation
        parts = re.split(r'(?<=[.!?;,])\s+', rest)
        chunks.extend([p.strip() for p in parts if p.strip()])
    else:
        chunks.append(text.strip())

    return chunks


@router.post("/synthesize")
async def synthesize(req: TTSRequest):
    tts = get_tts_service()
    wav_bytes = await tts.synthesize(req.text, req.domain)
    return Response(content=wav_bytes, media_type="audio/wav")


@router.post("/speak")
async def speak(req: TTSRequest):
    tts = get_tts_service()
    wav_bytes = await tts.synthesize(req.text, req.domain)
    return Response(content=wav_bytes, media_type="audio/wav")


@router.post("/stream-chunks")
async def stream_chunks(req: TTSStreamRequest):
    """Streaming TTS — returns audio in chunked transfer encoding.
    Each chunk is a complete playable audio segment for one sentence.
    The first chunk is intentionally small (first N words) so the frontend
    hears audio within ~300-500ms even if the full text is long.

    Format: multipart chunks separated by a 4-byte length prefix (big-endian uint32).
    Frontend reads: [4 bytes len][len bytes audio][4 bytes len][len bytes audio]...
    """
    tts = get_tts_service()
    sentences = _split_sentences(req.text, req.first_buffer_words)

    async def generate():
        for sentence in sentences:
            audio = await tts.synthesize(sentence, req.domain)
            if audio and len(audio) > 0:
                # Prefix each chunk with its length (4 bytes big-endian)
                yield len(audio).to_bytes(4, "big") + audio

    return StreamingResponse(
        generate(),
        media_type="application/octet-stream",
        headers={"X-TTS-Chunks": str(len(sentences))},
    )


@router.post("/transcribe")
async def transcribe_audio(audio_bytes: bytes):
    from services.whisper_service import get_whisper_service
    whisper = get_whisper_service()
    result = await whisper.transcribe_bytes(audio_bytes)
    return result
