"""
RAG Service — Hybrid Semantic + Keyword Search with Reciprocal Rank Fusion (RRF).

Pipeline:
  1. Embed the query via EmbeddingService.
  2. Run semantic search (pgvector cosine similarity) in parallel with
     keyword search (PostgreSQL full-text search / tsvector).
  3. Merge ranked results using RRF: score = Σ 1/(k + rank_i).
  4. Build a prompt with the top-k fused chunks.
  5. Stream the LLM response back to the caller.
"""

from __future__ import annotations

import asyncio
import json
import re
from typing import AsyncIterator, List, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from services.embedding_service import get_embedding_service

settings = get_settings()


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------

async def semantic_search(
    db: AsyncSession,
    query_embedding: List[float],
    top_k: int,
    category: Optional[str] = None,
) -> List[dict]:
    """Return top-k chunks ranked by cosine similarity."""
    embedding_literal = "[" + ",".join(map(str, query_embedding)) + "]"
    cat_filter = "AND d.category = :category" if category else ""

    sql = text(f"""
        SELECT
            c.id::text        AS chunk_id,
            c.document_id::text,
            c.chunk_index,
            c.content,
            d.title,
            d.filename,
            d.category,
            1 - (c.embedding <=> '{embedding_literal}'::vector) AS score,
            ROW_NUMBER() OVER (
                ORDER BY c.embedding <=> '{embedding_literal}'::vector
            ) AS rank
        FROM document_chunks c
        JOIN technical_docs d ON d.id = c.document_id
        WHERE c.embedding IS NOT NULL
          AND d.status = 'indexed'
          {cat_filter}
        ORDER BY c.embedding <=> '{embedding_literal}'::vector
        LIMIT :top_k
    """)

    params = {"top_k": top_k}
    if category:
        params["category"] = category

    result = await db.execute(sql, params)
    return [dict(row._mapping) for row in result]


async def keyword_search(
    db: AsyncSession,
    query: str,
    top_k: int,
    category: Optional[str] = None,
) -> List[dict]:
    """Return top-k chunks ranked by full-text search (tsvector BM25-like)."""
    cat_filter = "AND d.category = :category" if category else ""

    sql = text(f"""
        SELECT
            c.id::text        AS chunk_id,
            c.document_id::text,
            c.chunk_index,
            c.content,
            d.title,
            d.filename,
            d.category,
            ts_rank_cd(c.fts_vector, query) AS score,
            ROW_NUMBER() OVER (
                ORDER BY ts_rank_cd(c.fts_vector, query) DESC
            ) AS rank
        FROM document_chunks c
        JOIN technical_docs d ON d.id = c.document_id,
        to_tsquery('techquery_fts', :tsquery) query
        WHERE c.fts_vector @@ query
          AND d.status = 'indexed'
          {cat_filter}
        ORDER BY ts_rank_cd(c.fts_vector, query) DESC
        LIMIT :top_k
    """)

    tsquery = _to_tsquery(query)
    params = {"tsquery": tsquery, "top_k": top_k}
    if category:
        params["category"] = category

    result = await db.execute(sql, params)
    return [dict(row._mapping) for row in result]


def _to_tsquery(query: str) -> str:
    """Convert a natural-language query to a tsquery string."""
    tokens = re.findall(r'\w+', query.lower())
    if not tokens:
        return "unknown"
    return " & ".join(tokens[:20])


def reciprocal_rank_fusion(
    semantic_results: List[dict],
    keyword_results: List[dict],
    k: int = 60,
) -> List[dict]:
    """
    Merge two ranked lists using RRF.
    score(d) = 1/(k + rank_semantic) + 1/(k + rank_keyword)
    """
    scores: dict[str, float] = {}
    meta: dict[str, dict] = {}

    for item in semantic_results:
        cid = item["chunk_id"]
        scores[cid] = scores.get(cid, 0) + 1.0 / (k + item["rank"])
        meta[cid] = item

    for item in keyword_results:
        cid = item["chunk_id"]
        scores[cid] = scores.get(cid, 0) + 1.0 / (k + item["rank"])
        if cid not in meta:
            meta[cid] = item

    ranked = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    results = []
    for cid, rrf_score in ranked:
        entry = meta[cid].copy()
        entry["rrf_score"] = rrf_score
        results.append(entry)

    return results


# ---------------------------------------------------------------------------
# Context builder
# ---------------------------------------------------------------------------

def build_context(chunks: List[dict], max_tokens: int = 3000) -> tuple[str, List[dict]]:
    """Pack the top chunks into a context string, respecting token budget."""
    context_parts: list[str] = []
    sources: list[dict] = []
    token_count = 0

    for chunk in chunks:
        approx_tokens = len(chunk["content"].split()) + 20
        if token_count + approx_tokens > max_tokens:
            break

        source_label = chunk.get("title") or chunk.get("filename") or "Document"
        context_parts.append(f"[Source: {source_label}]\n{chunk['content']}")
        sources.append({
            "title":   source_label,
            "source":  chunk.get("filename", ""),
            "excerpt": chunk["content"][:200].strip(),
            "score":   chunk.get("rrf_score", chunk.get("score", 0)),
            "category": chunk.get("category", ""),
        })
        token_count += approx_tokens

    return "\n\n---\n\n".join(context_parts), sources


SYSTEM_PROMPT = """You are Echo, a real-time coding and technical agent. Your task is to make your internal workflow visible as you operate.

You MUST structure every response using these section headers in order:
[READING] — What files, code, documents, or inputs you are currently examining
[THINKING] — Your reasoning about what needs to be done (concise, step-by-step)
[PLANNING] — The next actions you intend to take
[CODING] — The actual code, calculations, or technical content you are producing
[CHECKING] — Any validation, debugging, or verification steps

Rules:
1. STREAM YOUR PROCESS — Break output into small, frequent steps. Do not produce one large final answer.
2. BE INCREMENTAL — Read → Think → Plan → Code → Check → Repeat
3. BE CONCISE BUT CONTINUOUS — Keep each section short but include all five headers.
4. DO NOT SKIP STEPS — Even if something seems obvious, show it briefly.
5. FORMAT CONSISTENTLY — Always use the exact section headers above.

Domain expertise: Maritime engineering, electrical engineering, construction, DIY repairs, 3D modeling (Blender, SolidWorks, Fusion 360), 3D printing, interior design, rapid prototyping.

When you use information from provided context documents, cite the source using [Source: <name>] notation. Format calculations clearly. If the answer is not in the context, say so and rely on your training knowledge, noting the distinction. Use markdown for structured output."""


def build_messages(query: str, context: str, history: list[dict]) -> list[dict]:
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]

    for msg in history[-8:]:
        messages.append({"role": msg["role"], "content": msg["content"]})

    user_content = query
    if context:
        user_content = (
            f"<context>\n{context}\n</context>\n\n"
            f"Question: {query}"
        )

    messages.append({"role": "user", "content": user_content})
    return messages


# ---------------------------------------------------------------------------
# LLM streaming
# ---------------------------------------------------------------------------

async def stream_llm(messages: list[dict]) -> AsyncIterator[str]:
    """Yield text deltas from the configured LLM provider."""
    provider = settings.llm_provider.lower()

    if provider == "openai":
        async for delta in _stream_openai(messages):
            yield delta
    elif provider == "anthropic":
        async for delta in _stream_anthropic(messages):
            yield delta
    elif provider == "ollama":
        async for delta in _stream_ollama(messages):
            yield delta
    else:
        yield f"[Error: unknown LLM provider '{provider}']"


async def _stream_openai(messages: list[dict]) -> AsyncIterator[str]:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    stream = await client.chat.completions.create(
        model=settings.openai_model,
        messages=messages,
        stream=True,
        temperature=0.2,
        max_tokens=2048,
    )
    async for chunk in stream:
        delta = chunk.choices[0].delta.content
        if delta:
            yield delta


async def _stream_anthropic(messages: list[dict]) -> AsyncIterator[str]:
    import anthropic

    system_msg = next((m["content"] for m in messages if m["role"] == "system"), "")
    human_messages = [m for m in messages if m["role"] != "system"]

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    async with client.messages.stream(
        model=settings.anthropic_model,
        max_tokens=2048,
        system=system_msg,
        messages=human_messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text


async def _stream_ollama(messages: list[dict]) -> AsyncIterator[str]:
    import httpx

    payload = {
        "model": settings.ollama_model,
        "messages": messages,
        "stream": True,
        "options": {"temperature": 0.2},
    }
    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            f"{settings.ollama_base_url}/api/chat",
            json=payload,
        ) as response:
            async for line in response.aiter_lines():
                if line:
                    try:
                        data = json.loads(line)
                        content = data.get("message", {}).get("content", "")
                        if content:
                            yield content
                    except json.JSONDecodeError:
                        pass


# ---------------------------------------------------------------------------
# High-level RAG entry point
# ---------------------------------------------------------------------------

async def rag_stream(
    query: str,
    db: AsyncSession,
    session_id: Optional[str] = None,
    category: Optional[str] = None,
    history: Optional[list[dict]] = None,
) -> AsyncIterator[str]:
    """
    Full RAG pipeline: retrieve → fuse → build prompt → stream LLM response.
    Yields SSE-formatted strings: 'data: {"delta": "...", "sources": [...]}\n\n'
    """
    embed_svc = get_embedding_service()

    query_embedding = await embed_svc.embed_query(query)

    semantic_task = asyncio.create_task(
        semantic_search(db, query_embedding, settings.rag_top_k_semantic, category)
    )
    keyword_task = asyncio.create_task(
        keyword_search(db, query, settings.rag_top_k_keyword, category)
    )

    semantic_results, keyword_results = await asyncio.gather(
        semantic_task, keyword_task, return_exceptions=True
    )

    if isinstance(semantic_results, Exception):
        semantic_results = []
    if isinstance(keyword_results, Exception):
        keyword_results = []

    fused = reciprocal_rank_fusion(
        semantic_results,
        keyword_results,
        k=settings.rag_rrf_k,
    )
    top_chunks = fused[:settings.rag_top_k_semantic]

    context, sources = build_context(top_chunks, settings.rag_max_context_tokens)
    messages = build_messages(query, context, history or [])

    sources_sent = False
    async for delta in stream_llm(messages):
        if not sources_sent and sources:
            sources_payload = json.dumps({"sources": sources})
            yield f"data: {sources_payload}\n\n"
            sources_sent = True

        payload = json.dumps({"delta": delta})
        yield f"data: {payload}\n\n"

    yield "data: [DONE]\n\n"
