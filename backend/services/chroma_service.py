"""ChromaDB semantic search service."""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import List, Optional

from config import get_settings

logger = logging.getLogger("chroma_service")
settings = get_settings()


class ChromaService:
    def __init__(self):
        self._client = None
        self._collections: dict = {}

    def _get_client(self):
        if self._client is None:
            import chromadb
            self._client = chromadb.HttpClient(
                host=settings.__dict__.get("chroma_host", "chromadb"),
                port=int(settings.__dict__.get("chroma_port", 8001)),
            )
        return self._client

    def _get_collection(self, domain: str):
        key = f"techquery_{domain}"
        if key not in self._collections:
            client = self._get_client()
            self._collections[key] = client.get_or_create_collection(
                name=key,
                metadata={"hnsw:space": "cosine"},
            )
        return self._collections[key]

    async def semantic_search(
        self, query: str, domain: str = "general", top_k: int = 5
    ) -> List[dict]:
        try:
            from sentence_transformers import SentenceTransformer
            import asyncio
            model = SentenceTransformer("all-MiniLM-L6-v2")
            loop = asyncio.get_event_loop()
            embedding = await loop.run_in_executor(None, lambda: model.encode([query])[0].tolist())

            collection = self._get_collection(domain)
            results = collection.query(
                query_embeddings=[embedding],
                n_results=top_k,
                include=["documents", "metadatas", "distances"],
            )

            items = []
            for i, doc in enumerate(results["documents"][0]):
                score = 1 - results["distances"][0][i]
                items.append({
                    "content": doc,
                    "metadata": results["metadatas"][0][i] if results["metadatas"] else {},
                    "score": round(score, 4),
                })
            return items
        except Exception as exc:
            logger.warning("ChromaDB search failed: %s", exc)
            return []

    async def upsert_chunks(self, chunks: List[dict], domain: str) -> int:
        """Insert or update text chunks with their embeddings."""
        try:
            from sentence_transformers import SentenceTransformer
            import asyncio
            model = SentenceTransformer("all-MiniLM-L6-v2")
            texts = [c["text"] for c in chunks]
            loop = asyncio.get_event_loop()
            embeddings = await loop.run_in_executor(
                None, lambda: model.encode(texts, batch_size=32, normalize_embeddings=True).tolist()
            )

            collection = self._get_collection(domain)
            collection.upsert(
                ids=[c.get("id", f"chunk_{i}") for i, c in enumerate(chunks)],
                documents=texts,
                embeddings=embeddings,
                metadatas=[c.get("metadata", {}) for c in chunks],
            )
            return len(chunks)
        except Exception as exc:
            logger.error("ChromaDB upsert failed: %s", exc)
            return 0

    async def delete_by_source(self, source_path: str, domain: str) -> None:
        try:
            collection = self._get_collection(domain)
            collection.delete(where={"source": source_path})
        except Exception as exc:
            logger.warning("ChromaDB delete failed: %s", exc)


@lru_cache(maxsize=1)
def get_chroma_service() -> ChromaService:
    return ChromaService()
