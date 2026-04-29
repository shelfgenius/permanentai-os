"""Vision LLM service — LLaVA via Ollama for image description and relevance checking."""
from __future__ import annotations

import asyncio
import base64
import logging
from functools import lru_cache

import httpx

from config import get_settings

logger = logging.getLogger("vision_service")
settings = get_settings()

OLLAMA_URL = getattr(settings, "ollama_base_url", "http://localhost:11434")


class VisionService:
    async def describe_image(self, image_path: str, prompt: str = "Descrie imaginea în detaliu.") -> str:
        try:
            with open(image_path, "rb") as f:
                b64 = base64.b64encode(f.read()).decode()
            payload = {
                "model": "llava",
                "prompt": prompt,
                "images": [b64],
                "stream": False,
            }
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
                return resp.json().get("response", "")
        except Exception as exc:
            logger.warning("LLaVA describe failed %s: %s", image_path, exc)
            return ""

    async def check_relevance(self, image_path: str, domain: str) -> dict:
        prompt = (
            f"Imaginea este relevantă pentru domeniul '{domain}'? "
            "Răspunde cu un scor de la 0.0 la 1.0 și o scurtă justificare. "
            "Format: SCOR: 0.X | MOTIVARE: ..."
        )
        response = await self.describe_image(image_path, prompt)
        score = 0.5
        try:
            if "SCOR:" in response:
                score_str = response.split("SCOR:")[1].split("|")[0].strip()
                score = float(score_str)
        except Exception:
            pass
        return {"score": max(0.0, min(1.0, score)), "raw_response": response}

    async def extract_text_from_image(self, image_path: str) -> str:
        return await self.describe_image(
            image_path,
            "Extrage tot textul vizibil din imagine. Dacă nu există text, descrie conținutul.",
        )


@lru_cache(maxsize=1)
def get_vision_service() -> VisionService:
    return VisionService()
