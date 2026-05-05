"""
Brain RAG Service — Context Engineering core.

Given a user query, retrieves the perfect ~2000 tokens of context from
the knowledge_base (vector search + keyword search) and injects it into
the system prompt. This replaces brute-force 200k context windows.

Pipeline:
  1. Embed the query via NVIDIA NIM (nv-embedqa-e5-v5)
  2. Vector search: cosine similarity on knowledge_base.embedding
  3. Keyword search: full-text search on knowledge_base.fts
  4. Reciprocal Rank Fusion (RRF) to merge results
  5. Build a context block capped at max_tokens
"""
from __future__ import annotations

import logging
import os
from typing import Dict, List, Optional

from services.nvidia_embeddings import get_nvidia_embedding_service
from services.supabase_client import sb_rpc, sb_select

logger = logging.getLogger("brain_rag")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://mpzvaicxzbnfocytwpxk.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


async def _vector_search(
    query_embedding: List[float],
    user_id: Optional[str] = None,
    source_type: Optional[str] = None,
    top_k: int = 6,
) -> List[dict]:
    """Vector similarity search via the match_knowledge RPC function."""
    params = {
        "query_embedding": "[" + ",".join(map(str, query_embedding)) + "]",
        "match_count": top_k,
    }
    if user_id:
        params["filter_user_id"] = user_id
    if source_type:
        params["filter_source_type"] = source_type

    result = await sb_rpc("match_knowledge", params)
    if result and isinstance(result, list):
        return result
    return []


async def _keyword_search(
    query: str,
    user_id: Optional[str] = None,
    source_type: Optional[str] = None,
    top_k: int = 6,
) -> List[dict]:
    """Full-text keyword search via PostgREST."""
    # Build tsquery from the input
    words = [w.strip() for w in query.split() if len(w.strip()) > 2][:8]
    tsquery = " | ".join(words) if words else query

    filters = {
        "fts": f"fts.{tsquery}",
    }
    if user_id:
        filters["user_id"] = f"eq.{user_id}"
    if source_type:
        filters["source_type"] = f"eq.{source_type}"

    return await sb_select(
        "knowledge_base",
        select="id,content,title,source_type,source_url,metadata",
        filters=filters,
        limit=top_k,
    )


def _rrf_merge(
    semantic_results: List[dict],
    keyword_results: List[dict],
    k: int = 60,
) -> List[dict]:
    """Reciprocal Rank Fusion: merge two ranked lists."""
    scores: Dict[str, float] = {}
    docs: Dict[str, dict] = {}

    for rank, item in enumerate(semantic_results):
        item_id = str(item.get("id", rank))
        scores[item_id] = scores.get(item_id, 0) + 1.0 / (k + rank + 1)
        docs[item_id] = item

    for rank, item in enumerate(keyword_results):
        item_id = str(item.get("id", f"kw_{rank}"))
        scores[item_id] = scores.get(item_id, 0) + 1.0 / (k + rank + 1)
        docs[item_id] = item

    # Sort by fused score descending
    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return [docs[item_id] for item_id, _ in ranked if item_id in docs]


async def retrieve_context(
    query: str,
    user_id: Optional[str] = None,
    source_type: Optional[str] = None,
    top_k: int = 5,
    max_chars: int = 4000,
) -> str:
    """
    The Context Engineering function.

    Returns a formatted context block (capped at max_chars) that should be
    injected into the system prompt. If no relevant knowledge is found,
    returns an empty string (so the pipeline runs without RAG overhead).
    """
    try:
        embed_svc = get_nvidia_embedding_service()
        query_embedding = await embed_svc.embed_query(query)

        # Parallel: vector search + keyword search
        import asyncio
        semantic_task = _vector_search(query_embedding, user_id, source_type, top_k)
        keyword_task = _keyword_search(query, user_id, source_type, top_k)
        semantic_results, keyword_results = await asyncio.gather(
            semantic_task, keyword_task, return_exceptions=True
        )

        # Handle exceptions gracefully
        if isinstance(semantic_results, Exception):
            logger.warning("Semantic search failed: %s", semantic_results)
            semantic_results = []
        if isinstance(keyword_results, Exception):
            logger.warning("Keyword search failed: %s", keyword_results)
            keyword_results = []

        if not semantic_results and not keyword_results:
            return ""

        # Fuse and rank
        fused = _rrf_merge(semantic_results, keyword_results)[:top_k]

        # Build context block
        blocks = []
        char_count = 0
        for item in fused:
            content = item.get("content", "")
            title = item.get("title", "")
            stype = item.get("source_type", "")
            header = f"[{stype.upper()}] {title}" if title else f"[{stype.upper()}]"
            block = f"---\n{header}\n{content}\n"

            if char_count + len(block) > max_chars:
                break
            blocks.append(block)
            char_count += len(block)

        if not blocks:
            return ""

        context = "## Relevant Knowledge\n" + "\n".join(blocks) + "---"
        logger.info("RAG retrieved %d chunks (%d chars) for: %s", len(blocks), char_count, query[:60])
        return context

    except Exception as e:
        logger.warning("RAG retrieve_context failed: %s", e)
        return ""
