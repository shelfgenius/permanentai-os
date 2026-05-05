"""
Brain Router — Global Brain endpoints for knowledge management and chat persistence.

Endpoints:
  POST /brain/ingest       — Ingest content into knowledge base (code, notes, research)
  POST /brain/search       — Search knowledge base (RAG query)
  GET  /brain/sessions     — List user chat sessions
  GET  /brain/session/{id} — Load messages for a session
  POST /brain/session/new  — Create a new session
  GET  /brain/jobs/{sid}   — Check async job status for a session
  GET  /brain/knowledge    — List knowledge base entries
  DELETE /brain/knowledge/{id} — Delete a knowledge entry
"""
from __future__ import annotations

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.chat_persistence import (
    create_session,
    list_user_sessions,
    load_session_messages,
)
from services.brain_rag import retrieve_context
from services.nvidia_embeddings import get_nvidia_embedding_service
from services.supabase_client import sb_insert, sb_select, sb_delete, sb_update

logger = logging.getLogger("brain_router")
router = APIRouter(prefix="/brain", tags=["brain"])


# ── Models ────────────────────────────────────────────────────────────
class IngestRequest(BaseModel):
    content: str
    source_type: str = "note"  # code | note | research | chat
    title: Optional[str] = None
    source_url: Optional[str] = None
    user_id: Optional[str] = None
    metadata: Optional[dict] = None
    auto_embed: bool = True


class IngestBatchRequest(BaseModel):
    items: List[IngestRequest]


class SearchRequest(BaseModel):
    query: str
    user_id: Optional[str] = None
    source_type: Optional[str] = None
    top_k: int = 5


# ── Ingest ────────────────────────────────────────────────────────────
@router.post("/ingest")
async def ingest_knowledge(req: IngestRequest):
    """Ingest a single piece of knowledge into the knowledge base."""
    if not req.content.strip():
        raise HTTPException(400, "Content cannot be empty")

    row = {
        "content": req.content.strip(),
        "source_type": req.source_type,
        "title": req.title,
        "source_url": req.source_url,
        "user_id": req.user_id,
        "metadata": req.metadata or {},
    }

    # Generate embedding if requested
    if req.auto_embed:
        try:
            embed_svc = get_nvidia_embedding_service()
            embedding = await embed_svc.embed_passage(req.content.strip()[:2000])
            row["embedding"] = "[" + ",".join(map(str, embedding)) + "]"
        except Exception as e:
            logger.warning("Auto-embed failed, ingesting without embedding: %s", e)

    result = await sb_insert("knowledge_base", [row])
    if not result:
        raise HTTPException(500, "Failed to ingest knowledge")

    return {"id": result[0].get("id"), "embedded": "embedding" in row}


@router.post("/ingest/batch")
async def ingest_batch(req: IngestBatchRequest):
    """Ingest multiple items at once."""
    if not req.items:
        raise HTTPException(400, "No items to ingest")

    results = []
    embed_svc = get_nvidia_embedding_service()

    # Batch embed all texts
    texts = [item.content.strip()[:2000] for item in req.items]
    try:
        embeddings = await embed_svc.embed_texts(texts, input_type="passage")
    except Exception as e:
        logger.warning("Batch embed failed: %s", e)
        embeddings = [None] * len(texts)

    rows = []
    for item, emb in zip(req.items, embeddings):
        row = {
            "content": item.content.strip(),
            "source_type": item.source_type,
            "title": item.title,
            "source_url": item.source_url,
            "user_id": item.user_id,
            "metadata": item.metadata or {},
        }
        if emb:
            row["embedding"] = "[" + ",".join(map(str, emb)) + "]"
        rows.append(row)

    result = await sb_insert("knowledge_base", rows)
    return {"ingested": len(result), "embedded": sum(1 for r in rows if "embedding" in r)}


# ── Search ────────────────────────────────────────────────────────────
@router.post("/search")
async def search_knowledge(req: SearchRequest):
    """Search the knowledge base using RAG (vector + keyword + RRF)."""
    context = await retrieve_context(
        query=req.query,
        user_id=req.user_id,
        source_type=req.source_type,
        top_k=req.top_k,
    )
    return {"context": context, "has_results": bool(context)}


# ── Chat Sessions ─────────────────────────────────────────────────────
@router.post("/session/new")
async def new_session(user_id: str = None):
    """Create a new chat session."""
    if not user_id:
        raise HTTPException(400, "user_id required")
    session_id = await create_session(user_id)
    return {"session_id": session_id}


@router.get("/sessions")
async def get_sessions(user_id: str, limit: int = 20):
    """List user's recent chat sessions."""
    sessions = await list_user_sessions(user_id, limit)
    return {"sessions": sessions}


@router.get("/session/{session_id}")
async def get_session_messages(session_id: str, limit: int = 50):
    """Load all messages for a chat session."""
    messages = await load_session_messages(session_id, limit)
    return {"messages": messages, "count": len(messages)}


# ── Async Jobs ────────────────────────────────────────────────────────
@router.get("/jobs/{session_id}")
async def get_session_jobs(session_id: str):
    """Check status of async jobs for a session."""
    jobs = await sb_select(
        "async_jobs",
        select="id,job_type,status,pipeline,error,created_at,completed_at",
        filters={"session_id": f"eq.{session_id}"},
        order="created_at.desc",
        limit=10,
    )
    return {"jobs": jobs}


# ── Knowledge Management ──────────────────────────────────────────────
@router.get("/knowledge")
async def list_knowledge(
    user_id: str = None,
    source_type: str = None,
    limit: int = 50,
):
    """List knowledge base entries."""
    filters = {}
    if user_id:
        filters["user_id"] = f"eq.{user_id}"
    if source_type:
        filters["source_type"] = f"eq.{source_type}"

    rows = await sb_select(
        "knowledge_base",
        select="id,title,source_type,source_url,metadata,created_at",
        filters=filters if filters else None,
        order="created_at.desc",
        limit=limit,
    )
    return {"entries": rows, "count": len(rows)}


@router.delete("/knowledge/{entry_id}")
async def delete_knowledge(entry_id: str):
    """Delete a knowledge base entry."""
    ok = await sb_delete("knowledge_base", {"id": f"eq.{entry_id}"})
    if not ok:
        raise HTTPException(404, "Entry not found")
    return {"deleted": True}
