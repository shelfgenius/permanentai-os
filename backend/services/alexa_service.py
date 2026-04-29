"""
Alexa Bridge Service
  Modul A2DP — Python redă TTS direct prin Bluetooth pe Echo, captează vocea prin stream audio.
  Modul ASK SDK — Alexa Skill în Amazon Developer Console → FastAPI ca fulfillment backend.
"""
from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Optional

import yaml

logger = logging.getLogger("alexa_service")

_CONFIG_PATH = Path(__file__).parent.parent.parent / "config.yaml"
try:
    with open(_CONFIG_PATH, "r", encoding="utf-8") as _f:
        _cfg = yaml.safe_load(_f) or {}
except FileNotFoundError:
    _cfg = {}

ALEXA_CFG = _cfg.get("alexa", {})
_current_mode = ALEXA_CFG.get("mode", "a2dp")


def get_mode() -> str:
    return _current_mode


def set_mode(mode: str) -> None:
    global _current_mode
    _current_mode = mode
    logger.info("Alexa mode set to: %s", mode)


# ── A2DP (Bluetooth) mode ─────────────────────────────────────────────────────
class A2DPBridge:
    """Stream TTS audio directly to a paired Bluetooth speaker (Echo or similar)."""

    async def play_audio(self, wav_bytes: bytes) -> None:
        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(None, self._play_sync, wav_bytes)
        except Exception as exc:
            logger.warning("A2DP play failed: %s", exc)

    def _play_sync(self, wav_bytes: bytes) -> None:
        try:
            import sounddevice as sd
            import soundfile as sf
            import io
            data, samplerate = sf.read(io.BytesIO(wav_bytes))
            sd.play(data, samplerate)
            sd.wait()
        except ImportError:
            try:
                import subprocess, tempfile, pathlib
                with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                    tmp.write(wav_bytes)
                    tmp_path = tmp.name
                subprocess.run(["aplay", tmp_path], check=True, capture_output=True)
                pathlib.Path(tmp_path).unlink(missing_ok=True)
            except Exception as exc:
                logger.warning("Audio playback fallback failed: %s", exc)

    async def capture_voice(self, duration_s: float = 5.0) -> Optional[bytes]:
        """Record audio from Bluetooth microphone (if available)."""
        loop = asyncio.get_event_loop()
        try:
            return await loop.run_in_executor(None, self._record_sync, duration_s)
        except Exception as exc:
            logger.warning("A2DP capture failed: %s", exc)
            return None

    def _record_sync(self, duration_s: float) -> bytes:
        import sounddevice as sd
        import soundfile as sf
        import io
        samplerate = 16000
        recording = sd.rec(int(duration_s * samplerate), samplerate=samplerate, channels=1, dtype="int16")
        sd.wait()
        buf = io.BytesIO()
        sf.write(buf, recording, samplerate, format="WAV")
        return buf.getvalue()


# ── ASK SDK (Amazon Skill) mode ───────────────────────────────────────────────
def build_ask_response(text: str, reprompt: Optional[str] = None, end_session: bool = True) -> dict:
    """Build an Alexa JSON response payload for ASK SDK."""
    response = {
        "version": "1.0",
        "response": {
            "outputSpeech": {
                "type": "SSML",
                "ssml": f"<speak>{text}</speak>",
            },
            "shouldEndSession": end_session,
        },
    }
    if reprompt:
        response["response"]["reprompt"] = {
            "outputSpeech": {"type": "PlainText", "text": reprompt}
        }
    return response


def parse_ask_intent(body: dict) -> dict:
    """Extract intent name and slots from an Alexa request body."""
    request = body.get("request", {})
    intent  = request.get("intent", {})
    slots   = {k: v.get("value", "") for k, v in intent.get("slots", {}).items()}
    return {
        "type":        request.get("type", ""),
        "intent_name": intent.get("name", ""),
        "slots":       slots,
        "raw_query":   slots.get("query", slots.get("text", "")),
    }


_a2dp_bridge = A2DPBridge()


def get_a2dp_bridge() -> A2DPBridge:
    return _a2dp_bridge
