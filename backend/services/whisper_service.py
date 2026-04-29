"""Whisper speech-to-text service (local model)."""
from __future__ import annotations

import asyncio
import logging
import tempfile
from functools import lru_cache
from pathlib import Path

logger = logging.getLogger("whisper_service")


class WhisperService:
    def __init__(self, model_name: str = "base"):
        self._model = None
        self._model_name = model_name
        self._lock = asyncio.Lock()

    def _load(self):
        if self._model is None:
            import whisper
            self._model = whisper.load_model(self._model_name)
            logger.info("Whisper model '%s' loaded", self._model_name)
        return self._model

    async def transcribe(self, audio_path: str, language: str = "ro") -> dict:
        loop = asyncio.get_event_loop()
        async with self._lock:
            model = await loop.run_in_executor(None, self._load)
        result = await loop.run_in_executor(
            None,
            lambda: model.transcribe(audio_path, language=language, fp16=False),
        )
        return {
            "text": result.get("text", "").strip(),
            "language": result.get("language", language),
            "segments": result.get("segments", []),
        }

    async def transcribe_bytes(self, audio_bytes: bytes, language: str = "ro") -> dict:
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        try:
            return await self.transcribe(tmp_path, language)
        finally:
            Path(tmp_path).unlink(missing_ok=True)


@lru_cache(maxsize=1)
def get_whisper_service() -> WhisperService:
    return WhisperService(model_name="base")
