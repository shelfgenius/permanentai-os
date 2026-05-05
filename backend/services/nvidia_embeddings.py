"""
NVIDIA Cloud Embedding Service — uses nv-embedqa-e5-v5 (1024 dims) via NVIDIA NIM.

Zero local GPU required. $0 with NVIDIA Build credits.
"""
from __future__ import annotations

import asyncio
import logging
import os
from typing import List

import httpx

logger = logging.getLogger("nvidia_embeddings")

NIM_BASE = os.getenv("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
EMBED_MODEL = "nvidia/nv-embedqa-e5-v5"
EMBED_DIM = 1024
MAX_BATCH = 50  # NIM limit per request


class NvidiaEmbeddingService:
    """Cloud embedding via NVIDIA NIM — 1024-dim vectors, async, batched."""

    def __init__(self):
        self._api_key = os.getenv("NVIDIA_API_KEY", "").strip()

    @property
    def dimension(self) -> int:
        return EMBED_DIM

    async def embed_texts(self, texts: List[str], input_type: str = "passage") -> List[List[float]]:
        """Embed a list of texts. input_type: 'passage' for docs, 'query' for search queries."""
        if not texts:
            return []
        if not self._api_key:
            raise RuntimeError("NVIDIA_API_KEY not set — cannot generate embeddings")

        all_embeddings: List[List[float]] = []

        # Batch to respect API limits
        for i in range(0, len(texts), MAX_BATCH):
            batch = texts[i : i + MAX_BATCH]
            payload = {
                "model": EMBED_MODEL,
                "input": batch,
                "input_type": input_type,
                "encoding_format": "float",
            }
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    r = await client.post(
                        f"{NIM_BASE}/embeddings",
                        json=payload,
                        headers={
                            "Authorization": f"Bearer {self._api_key}",
                            "Accept": "application/json",
                        },
                    )
                if r.status_code != 200:
                    logger.error("NVIDIA embed error %d: %s", r.status_code, r.text[:300])
                    raise RuntimeError(f"Embedding API returned {r.status_code}")

                data = r.json()
                batch_embeddings = [item["embedding"] for item in data["data"]]
                all_embeddings.extend(batch_embeddings)

            except httpx.TimeoutException:
                logger.error("NVIDIA embed timeout for batch %d-%d", i, i + len(batch))
                raise RuntimeError("Embedding API timeout")

        return all_embeddings

    async def embed_query(self, query: str) -> List[float]:
        """Embed a single search query (uses 'query' input type for asymmetric search)."""
        results = await self.embed_texts([query], input_type="query")
        return results[0]

    async def embed_passage(self, text: str) -> List[float]:
        """Embed a single document/passage."""
        results = await self.embed_texts([text], input_type="passage")
        return results[0]


# Singleton
_instance: NvidiaEmbeddingService | None = None


def get_nvidia_embedding_service() -> NvidiaEmbeddingService:
    global _instance
    if _instance is None:
        _instance = NvidiaEmbeddingService()
    return _instance
