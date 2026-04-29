"""
Search router — exposes the hybrid RRF search endpoint independently,
plus parts inventory and asset registry search.
"""

from __future__ import annotations

import asyncio
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from db.database import get_db
from db.models import AssetRegistry, PartsInventory
from services.embedding_service import get_embedding_service
from services.rag_service import (
    keyword_search,
    reciprocal_rank_fusion,
    semantic_search,
)

settings = get_settings()
router = APIRouter(prefix="/search", tags=["search"])


class SearchResult(BaseModel):
    chunk_id: str
    document_id: str
    title: Optional[str]
    filename: str
    category: Optional[str]
    content: str
    rrf_score: float
    score: Optional[float] = None


class SearchResponse(BaseModel):
    query: str
    results: List[SearchResult]
    total: int
    semantic_count: int
    keyword_count: int


@router.get("/", response_model=SearchResponse)
async def hybrid_search(
    q: str = Query(..., min_length=1, description="Search query"),
    category: Optional[str] = Query(None),
    top_k: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    """Hybrid semantic + keyword search using Reciprocal Rank Fusion."""
    embed_svc = get_embedding_service()
    query_embedding = await embed_svc.embed_query(q)

    sem_task = asyncio.create_task(
        semantic_search(db, query_embedding, settings.rag_top_k_semantic, category)
    )
    kw_task = asyncio.create_task(
        keyword_search(db, q, settings.rag_top_k_keyword, category)
    )
    semantic_results, keyword_results = await asyncio.gather(sem_task, kw_task, return_exceptions=True)

    if isinstance(semantic_results, Exception):
        semantic_results = []
    if isinstance(keyword_results, Exception):
        keyword_results = []

    fused = reciprocal_rank_fusion(
        semantic_results, keyword_results, k=settings.rag_rrf_k
    )[:top_k]

    return SearchResponse(
        query=q,
        results=[
            SearchResult(
                chunk_id=r["chunk_id"],
                document_id=r["document_id"],
                title=r.get("title"),
                filename=r.get("filename", ""),
                category=r.get("category"),
                content=r["content"][:500],
                rrf_score=r["rrf_score"],
                score=r.get("score"),
            )
            for r in fused
        ],
        total=len(fused),
        semantic_count=len(semantic_results),
        keyword_count=len(keyword_results),
    )


@router.get("/parts")
async def search_parts(
    q: str = Query(..., min_length=1),
    category: Optional[str] = Query(None),
    top_k: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Search parts inventory using semantic similarity."""
    embed_svc = get_embedding_service()
    query_embedding = await embed_svc.embed_query(q)
    embedding_literal = "[" + ",".join(map(str, query_embedding)) + "]"

    cat_filter = "AND category = :cat" if category else ""
    sql = text(f"""
        SELECT
            id::text, part_number, name, description, category,
            manufacturer, specifications, unit, quantity_on_hand, unit_cost,
            1 - (embedding <=> '{embedding_literal}'::vector) AS similarity
        FROM parts_inventory
        WHERE embedding IS NOT NULL {cat_filter}
        ORDER BY embedding <=> '{embedding_literal}'::vector
        LIMIT :top_k
    """)

    params = {"top_k": top_k}
    if category:
        params["cat"] = category

    result = await db.execute(sql, params)
    rows = [dict(r._mapping) for r in result]

    return {"query": q, "results": rows, "total": len(rows)}


@router.get("/assets")
async def search_assets(
    q: str = Query(..., min_length=1),
    asset_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    top_k: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """Search asset registry for 3D models, blueprints, etc."""
    embed_svc = get_embedding_service()
    query_embedding = await embed_svc.embed_query(q)
    embedding_literal = "[" + ",".join(map(str, query_embedding)) + "]"

    filters = ["embedding IS NOT NULL"]
    params: dict = {"top_k": top_k}

    if asset_type:
        filters.append("asset_type = :asset_type")
        params["asset_type"] = asset_type
    if category:
        filters.append("category = :category")
        params["category"] = category

    where_clause = " AND ".join(filters)
    sql = text(f"""
        SELECT
            id::text, name, description, asset_type, category,
            storage_key, file_format, file_size_bytes, version, tags,
            1 - (embedding <=> '{embedding_literal}'::vector) AS similarity
        FROM asset_registry
        WHERE {where_clause}
        ORDER BY embedding <=> '{embedding_literal}'::vector
        LIMIT :top_k
    """)

    result = await db.execute(sql, params)
    rows = [dict(r._mapping) for r in result]

    return {"query": q, "results": rows, "total": len(rows)}
