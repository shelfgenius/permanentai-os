from __future__ import annotations

import asyncio
from functools import lru_cache
from typing import List

import numpy as np
from sentence_transformers import SentenceTransformer

from config import get_settings

settings = get_settings()


class EmbeddingService:
    """Wraps a SentenceTransformer model with async batching support."""

    def __init__(self):
        self._model: SentenceTransformer | None = None
        self._lock = asyncio.Lock()

    def _load_model(self) -> SentenceTransformer:
        if self._model is None:
            self._model = SentenceTransformer(settings.embedding_model)
        return self._model

    async def embed_texts(self, texts: List[str]) -> List[List[float]]:
        """Embed a list of texts, returns list of float vectors."""
        if not texts:
            return []

        loop = asyncio.get_event_loop()

        def _encode():
            model = self._load_model()
            vectors = model.encode(
                texts,
                batch_size=settings.embedding_batch_size,
                show_progress_bar=False,
                normalize_embeddings=True,
            )
            return vectors.tolist()

        async with self._lock:
            vectors = await loop.run_in_executor(None, _encode)

        return vectors

    async def embed_query(self, query: str) -> List[float]:
        """Embed a single query string."""
        results = await self.embed_texts([query])
        return results[0]

    @property
    def dimension(self) -> int:
        return settings.embedding_dimension


@lru_cache(maxsize=1)
def get_embedding_service() -> EmbeddingService:
    return EmbeddingService()
