"""
Multi-provider Orchestrator: Groq (fastest) → Gemini → Mistral → Together → Ollama (local fallback).
All free APIs. No OpenAI dependency.
Uses httpx directly.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import AsyncIterator, Optional

import httpx
import yaml

from config import get_settings
from services.chroma_service import ChromaService
from services.tts_service import TTSService

logger = logging.getLogger("orchestrator")
settings = get_settings()

_CONFIG_PATH = Path(__file__).parent.parent.parent / "config.yaml"
try:
    with open(_CONFIG_PATH, encoding="utf-8") as f:
        CONFIG = yaml.safe_load(f)
except Exception:
    CONFIG = {}

SYSTEM_PROMPT = (
    "You are Echo, a real-time coding agent. Structure every response with these headers:\n"
    "[READING] — Context examined\n"
    "[THINKING] — Your reasoning (concise, step-by-step)\n"
    "[PLANNING] — Next actions\n"
    "[CODING] — Code or technical output\n"
    "[CHECKING] — Verification steps\n\n"
    "Be incremental: Read → Think → Plan → Code → Check → Repeat.\n"
    "Keep each section short. Always include all five headers.\n"
    "If the user writes in Romanian, respond in Romanian."
)


def _split_sentences(buffer):
    """Extract complete sentences from buffer, return (sentences, remaining_buffer)."""
    sentences = []
    while "." in buffer:
        dot = buffer.index(".")
        s = buffer[:dot + 1].strip()
        buffer = buffer[dot + 1:]
        if s:
            sentences.append(s)
    return sentences, buffer


class PersonalAIOrchestrator:
    def __init__(self):
        self.chroma = ChromaService()
        self.tts = TTSService()

    # ── Groq (fastest, free) ──────────────────────────────────────────
    async def _stream_groq(self, messages, domain):
        api_key = getattr(settings, "groq_api_key", "")
        if not api_key:
            raise Exception("No Groq API key")
        idx = 0
        buf = ""
        async with httpx.AsyncClient(timeout=60) as c:
            async with c.stream("POST", "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": "llama-3.3-70b-versatile", "messages": messages, "stream": True, "temperature": 0.3, "max_tokens": 256},
            ) as r:
                if r.status_code != 200:
                    raise Exception(f"Groq {r.status_code}")
                async for line in r.aiter_lines():
                    if not line.startswith("data: "): continue
                    p = line[6:].strip()
                    if p == "[DONE]": break
                    try:
                        buf += json.loads(p)["choices"][0]["delta"].get("content", "")
                    except Exception: continue
                    sents, buf = _split_sentences(buf)
                    for s in sents:
                        yield {"type": "text_fragment", "content": s, "index": idx, "domain": domain}
                        idx += 1
        if buf.strip():
            yield {"type": "text_fragment", "content": buf.strip(), "index": idx, "domain": domain}

    # ── Google Gemini (free, 15 req/min) ──────────────────────────────
    async def _stream_gemini(self, messages, domain):
        api_key = getattr(settings, "gemini_api_key", "")
        if not api_key:
            raise Exception("No Gemini API key")
        # Convert messages to Gemini format
        contents = []
        for m in messages:
            role = "user" if m["role"] in ("user", "system") else "model"
            contents.append({"role": role, "parts": [{"text": m["content"]}]})
        idx = 0
        buf = ""
        async with httpx.AsyncClient(timeout=60) as c:
            async with c.stream("POST",
                f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?alt=sse&key={api_key}",
                json={"contents": contents, "generationConfig": {"temperature": 0.3, "maxOutputTokens": 256}},
            ) as r:
                if r.status_code != 200:
                    raise Exception(f"Gemini {r.status_code}")
                async for line in r.aiter_lines():
                    if not line.startswith("data: "): continue
                    try:
                        data = json.loads(line[6:])
                        text = data["candidates"][0]["content"]["parts"][0]["text"]
                    except Exception: continue
                    buf += text
                    sents, buf = _split_sentences(buf)
                    for s in sents:
                        yield {"type": "text_fragment", "content": s, "index": idx, "domain": domain}
                        idx += 1
        if buf.strip():
            yield {"type": "text_fragment", "content": buf.strip(), "index": idx, "domain": domain}

    # ── Mistral (free tier) ───────────────────────────────────────────
    async def _stream_mistral(self, messages, domain):
        api_key = getattr(settings, "mistral_api_key", "")
        if not api_key:
            raise Exception("No Mistral API key")
        idx = 0
        buf = ""
        async with httpx.AsyncClient(timeout=60) as c:
            async with c.stream("POST", "https://api.mistral.ai/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": "mistral-small-latest", "messages": messages, "stream": True, "temperature": 0.3, "max_tokens": 256},
            ) as r:
                if r.status_code != 200:
                    raise Exception(f"Mistral {r.status_code}")
                async for line in r.aiter_lines():
                    if not line.startswith("data: "): continue
                    p = line[6:].strip()
                    if p == "[DONE]": break
                    try:
                        buf += json.loads(p)["choices"][0]["delta"].get("content", "")
                    except Exception: continue
                    sents, buf = _split_sentences(buf)
                    for s in sents:
                        yield {"type": "text_fragment", "content": s, "index": idx, "domain": domain}
                        idx += 1
        if buf.strip():
            yield {"type": "text_fragment", "content": buf.strip(), "index": idx, "domain": domain}

    # ── Together AI ($5 free credit) ──────────────────────────────────
    async def _stream_together(self, messages, domain):
        api_key = getattr(settings, "together_api_key", "")
        if not api_key:
            raise Exception("No Together API key")
        idx = 0
        buf = ""
        async with httpx.AsyncClient(timeout=60) as c:
            async with c.stream("POST", "https://api.together.xyz/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={"model": "meta-llama/Llama-3.3-70B-Instruct-Turbo", "messages": messages, "stream": True, "temperature": 0.3, "max_tokens": 256},
            ) as r:
                if r.status_code != 200:
                    raise Exception(f"Together {r.status_code}")
                async for line in r.aiter_lines():
                    if not line.startswith("data: "): continue
                    p = line[6:].strip()
                    if p == "[DONE]": break
                    try:
                        buf += json.loads(p)["choices"][0]["delta"].get("content", "")
                    except Exception: continue
                    sents, buf = _split_sentences(buf)
                    for s in sents:
                        yield {"type": "text_fragment", "content": s, "index": idx, "domain": domain}
                        idx += 1
        if buf.strip():
            yield {"type": "text_fragment", "content": buf.strip(), "index": idx, "domain": domain}

    # ── Ollama (local, always available) ──────────────────────────────
    async def _stream_ollama(self, messages, domain):
        base_url = getattr(settings, "ollama_base_url", "http://localhost:11434")
        model = getattr(settings, "ollama_model", "llama3.2")
        idx = 0
        buf = ""
        async with httpx.AsyncClient(timeout=120) as c:
            async with c.stream("POST", f"{base_url}/api/chat",
                json={"model": model, "messages": messages, "stream": True, "options": {"temperature": 0.3, "num_predict": 256}},
            ) as r:
                if r.status_code != 200:
                    raise Exception(f"Ollama {r.status_code}")
                async for line in r.aiter_lines():
                    if not line.strip(): continue
                    try:
                        buf += json.loads(line).get("message", {}).get("content", "")
                    except Exception: continue
                    sents, buf = _split_sentences(buf)
                    for s in sents:
                        yield {"type": "text_fragment", "content": s, "index": idx, "domain": domain}
                        idx += 1
        if buf.strip():
            yield {"type": "text_fragment", "content": buf.strip(), "index": idx, "domain": domain}

    # ── Main query — cascade through providers ────────────────────────
    async def query(
        self, message: str, domain: str = "general",
        session_id: str = "default", history: Optional[list] = None,
    ) -> AsyncIterator[dict]:
        try:
            persona = CONFIG.get("domains", {}).get(domain, {}).get("voice_style", "profesional")
        except Exception:
            persona = "profesional"

        system_msg = SYSTEM_PROMPT + f"\nDomeniu: {domain}. Stil: {persona}."
        messages = [{"role": "system", "content": system_msg}]
        if history:
            for msg in history[-5:]:
                messages.append({"role": msg.get("role", "user"), "content": msg.get("content", "")})
        messages.append({"role": "user", "content": message})

        # Cascade: Groq → Gemini → Mistral → Together → Ollama
        providers = [
            ("Groq",     self._stream_groq),
            ("Gemini",   self._stream_gemini),
            ("Mistral",  self._stream_mistral),
            ("Together", self._stream_together),
            ("Ollama",   self._stream_ollama),
        ]

        for name, fn in providers:
            try:
                logger.info(f"Trying {name}...")
                async for ev in fn(messages, domain):
                    yield ev
                logger.info(f"{name} succeeded")
                return
            except Exception as e:
                logger.warning(f"{name} failed: {e}")
                continue

        yield {"type": "info", "content": "⚠️ Toți providerii AI au eșuat. Verifică cheile API sau Ollama."}


_orchestrator = None

def get_orchestrator() -> PersonalAIOrchestrator:
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = PersonalAIOrchestrator()
    return _orchestrator

def set_online_mode(enabled: bool):
    pass
