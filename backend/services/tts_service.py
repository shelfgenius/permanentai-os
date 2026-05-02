"""
TTS Service — Voce umană, fluent.

Lanț de fallback (în ordine):
  1. ElevenLabs API  (ELEVENLABS_API_KEY setat în .env) — cea mai naturală voce
  2. Edge TTS        (gratuit, fără cheie, voce Microsoft Neural)
"""
from __future__ import annotations

import asyncio
import io
import logging
import os
from functools import lru_cache

logger = logging.getLogger("tts_service")

# ElevenLabs voice IDs — toate au accent neutru, sună uman
# https://api.elevenlabs.io/v1/voices
ELEVENLABS_VOICES = {
    "maritim":         "onwK4e9ZLuTAKqWW03F9",  # Daniel  — voce masculină clară
    "constructii":     "onwK4e9ZLuTAKqWW03F9",  # Daniel
    "design_interior": "21m00Tcm4TlvDq8ikWAM",  # Rachel  — voce feminină
    "condus":          "onwK4e9ZLuTAKqWW03F9",  # Daniel
    "educatie":        "21m00Tcm4TlvDq8ikWAM",  # Rachel
    "3d_printing":     "TxGEqnHWrfWFTfGW9XjX",  # Josh    — voce tânără
    "3d_modeling":     "TxGEqnHWrfWFTfGW9XjX",  # Josh
    "default":         "onwK4e9ZLuTAKqWW03F9",  # Daniel
}

# Edge TTS voice maps (Microsoft Neural — gratuit, fără API key)
EDGE_VOICES = {
    "maritim":         "en-US-GuyNeural",
    "constructii":     "en-US-GuyNeural",
    "design_interior": "en-US-JennyNeural",
    "condus":          "en-US-GuyNeural",
    "educatie":        "en-US-JennyNeural",
    "3d_printing":     "en-US-GuyNeural",
    "3d_modeling":     "en-US-GuyNeural",
    "default":         "en-US-JennyNeural",
}

# Kokoro TTS voice maps (local, free, high-quality)
KOKORO_URL = os.getenv("KOKORO_TTS_URL", "http://localhost:8880")
KOKORO_VOICES = {
    "default":         "bf_emma",      # British Female — elegant, F.R.I.D.A.Y.-like (Aura default)
    "maritim":         "am_adam",      # American Male — deep
    "constructii":     "am_adam",
    "design_interior": "af_heart",
    "condus":          "am_michael",
    "educatie":        "af_heart",
    "3d_printing":     "am_michael",
    "3d_modeling":     "am_michael",
}


class TTSService:
    def __init__(self):
        self._lock = asyncio.Lock()

    # ── PUBLIC ────────────────────────────────────────────────────────
    async def synthesize(self, text: str, domain: str = "default") -> bytes:
        """Returnează bytes audio MP3/WAV pentru textul dat."""
        if not text or not text.strip():
            return b""

        domain_key = domain.lower().replace("-", "_")

        # 1. Kokoro TTS (local, free, high-quality)
        result = await self._synth_kokoro(text, domain_key)
        if result:
            return result

        # 2. Edge TTS (Microsoft Neural, free, always works)
        result = await self._synth_edge(text, domain_key)
        if result:
            return result

        # 3. XTTS v2 (local voice-cloning TTS)
        result = await self._synth_xtts(text, domain_key)
        if result:
            return result

        # NOTE: ElevenLabs is called directly from the browser (bypasses
        # Render's IP which gets flagged on the free tier). The backend
        # elevenlabs_router.py serves the config for direct browser calls.

        logger.error("All TTS methods failed for: %r", text[:50])
        return b""

    async def synthesize_streaming(self, text: str, domain: str = "default"):
        """Yield chunks per propoziție pentru latență redusă."""
        sentences = [s.strip() for s in text.replace("!", ".").replace("?", ".").split(".") if s.strip()]
        for sentence in sentences:
            chunk = await self.synthesize(sentence, domain)
            if chunk:
                yield chunk

    # ── KOKORO TTS (direct Python — no Docker needed) ─────────────────
    async def _synth_kokoro(self, text: str, domain: str) -> bytes:
        voice_id = KOKORO_VOICES.get(domain, KOKORO_VOICES["default"])
        # Try direct Python package first
        result = await self._synth_kokoro_direct(text, voice_id)
        if result:
            return result
        # Fallback: HTTP endpoint (Docker container if running)
        return await self._synth_kokoro_http(text, voice_id)

    async def _synth_kokoro_direct(self, text: str, voice_id: str) -> bytes:
        """Direct Kokoro synthesis via installed Python package."""
        try:
            loop = asyncio.get_event_loop()
            audio = await loop.run_in_executor(None, self._kokoro_generate, text, voice_id)
            return audio
        except ImportError:
            return b""
        except Exception as exc:
            logger.debug("Kokoro direct TTS failed: %s", exc)
            return b""

    def _kokoro_generate(self, text: str, voice_id: str) -> bytes:
        """Synchronous Kokoro generation (runs in thread pool)."""
        from kokoro_onnx import Kokoro
        import soundfile as sf

        if not hasattr(self, "_kokoro_instance"):
            model_dir = os.path.join(os.path.dirname(__file__), "..", "kokoro-models")
            # Try both filenames (model.onnx is the primary)
            model_path = os.path.join(model_dir, "model.onnx")
            if not os.path.exists(model_path):
                model_path = os.path.join(model_dir, "kokoro-v1.0.onnx")
            voices_path = os.path.join(model_dir, "voices-v1.0.bin")
            if not os.path.exists(model_path) or not os.path.exists(voices_path):
                logger.warning("Kokoro model files not found in %s", model_dir)
                return b""
            logger.info("Loading Kokoro ONNX model (first call)...")
            self._kokoro_instance = Kokoro(model_path, voices_path)
            logger.info("Kokoro ONNX model loaded.")

        samples, sample_rate = self._kokoro_instance.create(
            text, voice=voice_id, speed=0.95, lang="en-us"
        )

        buf = io.BytesIO()
        sf.write(buf, samples, sample_rate, format='WAV', subtype='PCM_16')
        audio_bytes = buf.getvalue()
        logger.info("Kokoro TTS OK (%d bytes, voice=%s)", len(audio_bytes), voice_id)
        return audio_bytes

    async def _synth_kokoro_http(self, text: str, voice_id: str) -> bytes:
        """Fallback: Kokoro via HTTP (Docker container)."""
        try:
            import httpx
            payload = {
                "input": text,
                "voice": voice_id,
                "model": "kokoro",
                "response_format": "mp3",
                "speed": 0.95,
            }
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.post(
                    f"{KOKORO_URL}/v1/audio/speech",
                    json=payload,
                    headers={"Content-Type": "application/json"},
                )
            if r.status_code == 200 and len(r.content) > 100:
                logger.info("Kokoro HTTP TTS OK (%d bytes, voice=%s)", len(r.content), voice_id)
                return r.content
            return b""
        except Exception:
            return b""

    # ── ELEVENLABS ────────────────────────────────────────────────────
    async def _synth_elevenlabs(self, text: str, domain: str) -> bytes:
        try:
            import httpx
            from config import get_settings
            settings = get_settings()
            api_key = getattr(settings, "elevenlabs_api_key", "") or os.getenv("ELEVENLABS_API_KEY", "")
            if not api_key:
                return b""

            voice_id = ELEVENLABS_VOICES.get(domain, ELEVENLABS_VOICES["default"])
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"

            payload = {
                "text": text,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {
                    "stability": 0.45,
                    "similarity_boost": 0.82,
                    "style": 0.35,
                    "use_speaker_boost": True,
                },
            }
            headers = {
                "xi-api-key": api_key,
                "Content-Type": "application/json",
                "Accept": "audio/mpeg",
            }

            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.post(url, json=payload, headers=headers)
                if r.status_code == 200:
                    logger.info("ElevenLabs TTS OK (%d bytes)", len(r.content))
                    return r.content
                else:
                    logger.warning("ElevenLabs TTS %d: %s", r.status_code, r.text[:200])
                    return b""
        except Exception as exc:
            logger.warning("ElevenLabs TTS excepție: %s", exc)
            return b""

    # ── XTTS v2 (Coqui TTS — local voice cloning) ─────────────────────
    async def _synth_xtts(self, text: str, domain: str) -> bytes:
        """XTTS v2 local TTS with voice cloning. Requires `pip install TTS`."""
        try:
            speaker_wav = os.getenv("XTTS_SPEAKER_WAV", "")
            if not speaker_wav or not os.path.exists(speaker_wav):
                return b""

            lang = os.getenv("XTTS_LANGUAGE", "en")
            loop = asyncio.get_event_loop()
            audio = await loop.run_in_executor(None, self._xtts_generate, text, speaker_wav, lang)
            return audio
        except ImportError:
            logger.debug("TTS package not installed — skip XTTS")
            return b""
        except Exception as exc:
            logger.warning("XTTS exception: %s", exc)
            return b""

    def _xtts_generate(self, text: str, speaker_wav: str, language: str) -> bytes:
        """Synchronous XTTS generation (called via run_in_executor)."""
        import tempfile
        from TTS.api import TTS  # pip install TTS

        if not hasattr(self, "_xtts_model"):
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
            logger.info("Loading XTTS v2 model on %s…", device)
            self._xtts_model = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            self._xtts_model.tts_to_file(
                text=text,
                speaker_wav=speaker_wav,
                language=language,
                file_path=tmp_path,
            )
            with open(tmp_path, "rb") as f:
                audio = f.read()
            if audio:
                logger.info("XTTS OK (%d bytes)", len(audio))
            return audio
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

    # ── EDGE TTS (Microsoft Neural, gratuit) ─────────────────────────
    async def _synth_edge(self, text: str, domain: str) -> bytes:
        try:
            import edge_tts  # pip install edge-tts
            voice = EDGE_VOICES.get(domain, EDGE_VOICES["default"])
            communicate = edge_tts.Communicate(text, voice)
            buf = io.BytesIO()
            async for chunk in communicate.stream():
                if chunk["type"] == "audio":
                    buf.write(chunk["data"])
            audio = buf.getvalue()
            if audio:
                logger.info("Edge TTS OK (%d bytes, %s)", len(audio), voice)
                return audio
            return b""
        except ImportError:
            logger.debug("edge-tts nu e instalat — skip")
            return b""
        except Exception as exc:
            logger.warning("Edge TTS excepție: %s", exc)
            return b""



@lru_cache(maxsize=1)
def get_tts_service() -> TTSService:
    return TTSService()
