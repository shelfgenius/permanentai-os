"""
Knowledge Base router — document ingestion, indexing, and management.

Ingestion pipeline per document:
  1. Upload raw file to storage (MinIO/S3).
  2. Parse text via LangChain document loaders.
  3. Split into chunks (RecursiveCharacterTextSplitter).
  4. Embed chunks in batches.
  5. Store chunks + embeddings in PostgreSQL.
"""

from __future__ import annotations

import asyncio
import io
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from db.database import get_db, AsyncSessionLocal
from db.models import AssetRegistry, DocumentChunk, PartsInventory, TechnicalDocument
from services.embedding_service import get_embedding_service
from services.storage_service import get_storage_service

settings = get_settings()
router = APIRouter(prefix="/knowledge", tags=["knowledge"])

SUPPORTED_TYPES = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "text/plain": "txt",
    "text/markdown": "md",
    "text/csv": "csv",
    "application/json": "json",
}


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class DocumentOut(BaseModel):
    id: str
    filename: str
    title: Optional[str]
    category: Optional[str]
    status: str
    chunk_count: int
    created_at: str

    class Config:
        from_attributes = True


class KBStats(BaseModel):
    total_docs: int
    total_chunks: int
    total_assets: int
    total_parts: int
    indexed_docs: int


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _detect_content_type(filename: str, provided: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    ext_map = {"pdf": "application/pdf", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
               "txt": "text/plain", "md": "text/markdown", "csv": "text/csv", "json": "application/json"}
    return ext_map.get(ext, provided or "application/octet-stream")


async def _parse_document(content: bytes, filename: str, content_type: str) -> str:
    """Extract plain text from various file types."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        try:
            import pypdf
            reader = pypdf.PdfReader(io.BytesIO(content))
            return "\n\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            pass

    if ext == "docx":
        try:
            import docx2txt
            return docx2txt.process(io.BytesIO(content))
        except Exception:
            pass

    if ext == "csv":
        try:
            import csv
            decoded = content.decode("utf-8", errors="replace")
            rows = list(csv.reader(decoded.splitlines()))
            return "\n".join(", ".join(row) for row in rows)
        except Exception:
            pass

    if ext == "json":
        import json
        try:
            data = json.loads(content)
            return json.dumps(data, indent=2)
        except Exception:
            pass

    return content.decode("utf-8", errors="replace")


def _chunk_text(text: str, chunk_size: int, overlap: int) -> List[str]:
    """Simple recursive character splitter."""
    separators = ["\n\n", "\n", ". ", " ", ""]
    chunks: list[str] = []

    def _split(t: str, seps: list[str]):
        if not t.strip():
            return
        if len(t) <= chunk_size:
            chunks.append(t.strip())
            return
        for sep in seps:
            if sep and sep in t:
                parts = t.split(sep)
                buf = ""
                for part in parts:
                    candidate = buf + sep + part if buf else part
                    if len(candidate) > chunk_size:
                        if buf:
                            chunks.append(buf.strip())
                            buf = t[-overlap:] + sep + part if overlap else part
                        else:
                            _split(part, seps[seps.index(sep) + 1:])
                    else:
                        buf = candidate
                if buf:
                    chunks.append(buf.strip())
                return
        chunks.append(t[:chunk_size].strip())
        _split(t[chunk_size - overlap:], seps)

    _split(text, separators)
    return [c for c in chunks if c]


async def _ingest_document(doc_id: uuid.UUID, content: bytes, filename: str, content_type: str):
    """Background ingestion: parse → chunk → embed → store (owns its own DB session)."""
    embed_svc = get_embedding_service()

    async with AsyncSessionLocal() as db:
        await db.execute(
            text("UPDATE technical_docs SET status='processing' WHERE id=:id"),
            {"id": str(doc_id)},
        )
        await db.commit()

        try:
            raw_text = await _parse_document(content, filename, content_type)
            if not raw_text.strip():
                raise ValueError("Could not extract text from document")

            text_chunks = _chunk_text(raw_text, settings.rag_chunk_size, settings.rag_chunk_overlap)
            embeddings = await embed_svc.embed_texts(text_chunks)

            chunk_objects = [
                DocumentChunk(
                    document_id=doc_id,
                    chunk_index=i,
                    content=chunk,
                    content_tokens=len(chunk.split()),
                    embedding=emb,
                )
                for i, (chunk, emb) in enumerate(zip(text_chunks, embeddings))
            ]

            db.add_all(chunk_objects)
            await db.execute(
                text("UPDATE technical_docs SET status='indexed', chunk_count=:n WHERE id=:id"),
                {"n": len(chunk_objects), "id": str(doc_id)},
            )
            await db.commit()

        except Exception as exc:
            await db.rollback()
            await db.execute(
                text("UPDATE technical_docs SET status='error', error_message=:msg WHERE id=:id"),
                {"msg": str(exc)[:1000], "id": str(doc_id)},
            )
            await db.commit()


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post("/upload")
async def upload_documents(
    files: List[UploadFile] = File(...),
    category: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
):
    storage = get_storage_service()
    created = []

    for upload in files:
        ct = _detect_content_type(upload.filename or "", upload.content_type or "")
        content = await upload.read()

        storage_key = None
        try:
            storage_key = storage.upload_file(
                io.BytesIO(content),
                upload.filename or "document",
                category="documents",
                content_type=ct,
                size=len(content),
            )
        except Exception:
            pass

        doc = TechnicalDocument(
            filename=upload.filename or "document",
            title=upload.filename,
            category=category,
            file_type=ct.split("/")[-1],
            file_size_bytes=len(content),
            storage_key=storage_key,
            status="pending",
        )
        db.add(doc)
        await db.flush()

        asyncio.create_task(_ingest_document(doc.id, content, upload.filename or "", ct))
        created.append(str(doc.id))

    await db.commit()
    return {"uploaded": len(created), "document_ids": created}


@router.get("/documents")
async def list_documents(
    category: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(TechnicalDocument)
    if category:
        query = query.where(TechnicalDocument.category == category)
    if status:
        query = query.where(TechnicalDocument.status == status)
    query = query.order_by(TechnicalDocument.created_at.desc())

    result = await db.execute(query)
    docs = result.scalars().all()

    total_docs_q  = await db.execute(select(func.count()).select_from(TechnicalDocument))
    total_chunks_q = await db.execute(select(func.count()).select_from(DocumentChunk))
    total_assets_q = await db.execute(select(func.count()).select_from(AssetRegistry))
    total_parts_q  = await db.execute(select(func.count()).select_from(PartsInventory))
    indexed_q      = await db.execute(
        select(func.count()).select_from(TechnicalDocument)
        .where(TechnicalDocument.status == "indexed")
    )

    stats = {
        "total_docs":   total_docs_q.scalar(),
        "total_chunks": total_chunks_q.scalar(),
        "total_assets": total_assets_q.scalar(),
        "total_parts":  total_parts_q.scalar(),
        "indexed_docs": indexed_q.scalar(),
    }

    return {
        "documents": [
            {
                "id":          str(d.id),
                "filename":    d.filename,
                "title":       d.title,
                "category":    d.category,
                "status":      d.status,
                "chunk_count": d.chunk_count,
                "created_at":  d.created_at.isoformat(),
            }
            for d in docs
        ],
        "stats": stats,
    }


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TechnicalDocument).where(TechnicalDocument.id == uuid.UUID(doc_id))
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if doc.storage_key:
        try:
            get_storage_service().delete_file(doc.storage_key)
        except Exception:
            pass

    await db.delete(doc)
    return {"status": "deleted"}


@router.post("/documents/{doc_id}/reindex")
async def reindex_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(TechnicalDocument).where(TechnicalDocument.id == uuid.UUID(doc_id))
    )
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    await db.execute(
        text("DELETE FROM document_chunks WHERE document_id=:id"),
        {"id": doc_id},
    )

    if doc.storage_key:
        try:
            storage = get_storage_service()
            content = storage.download_file(doc.storage_key)
            ct = f"application/{doc.file_type}" if doc.file_type else "text/plain"
            asyncio.create_task(_ingest_document(doc.id, content, doc.filename, ct))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Could not retrieve file: {exc}")
    else:
        raise HTTPException(status_code=400, detail="No stored file for this document")

    return {"status": "reindexing"}


@router.post("/sync")
async def sync_knowledge_base(db: AsyncSession = Depends(get_db)):
    """Trigger re-indexing of all pending/error documents."""
    result = await db.execute(
        select(TechnicalDocument).where(
            TechnicalDocument.status.in_(["pending", "error"])
        )
    )
    docs = result.scalars().all()
    queued = 0

    storage = get_storage_service()
    for doc in docs:
        if doc.storage_key:
            try:
                content = storage.download_file(doc.storage_key)
                ct = f"application/{doc.file_type}" if doc.file_type else "text/plain"
                asyncio.create_task(_ingest_document(doc.id, content, doc.filename, ct))
                queued += 1
            except Exception:
                continue

    return {"queued": queued}
