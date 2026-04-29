"""
Knowledge Base Lite — SQLite-based, no PostgreSQL needed.
Handles document upload, listing, deletion, and text extraction.
"""
from __future__ import annotations

import asyncio
import io
import json
import os
import sqlite3
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, File, Form, HTTPException, UploadFile

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

DB_PATH = Path(__file__).parent.parent / "data" / "knowledge.db"
UPLOAD_DIR = Path(__file__).parent.parent / "data" / "uploads"

def _ensure_dirs():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

def _get_db():
    _ensure_dirs()
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("""CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        title TEXT,
        category TEXT,
        file_type TEXT,
        file_size INTEGER DEFAULT 0,
        status TEXT DEFAULT 'indexed',
        chunk_count INTEGER DEFAULT 0,
        content TEXT DEFAULT '',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )""")
    conn.commit()
    return conn


async def _parse_document(content: bytes, filename: str) -> str:
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
            import csv as csv_mod
            decoded = content.decode("utf-8", errors="replace")
            rows = list(csv_mod.reader(decoded.splitlines()))
            return "\n".join(", ".join(row) for row in rows)
        except Exception:
            pass

    return content.decode("utf-8", errors="replace")


@router.post("/upload")
async def upload_documents(
    files: List[UploadFile] = File(...),
    category: Optional[str] = Form(None),
):
    _ensure_dirs()
    conn = _get_db()
    created = []

    for upload in files:
        content = await upload.read()
        doc_id = str(uuid.uuid4())
        filename = upload.filename or "document"
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else "txt"

        # Save file locally
        file_path = UPLOAD_DIR / f"{doc_id}.{ext}"
        file_path.write_bytes(content)

        # Extract text
        text = await _parse_document(content, filename)
        chunk_count = max(1, len(text) // 512)

        conn.execute(
            "INSERT INTO documents (id, filename, title, category, file_type, file_size, status, chunk_count, content, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (doc_id, filename, filename, category or "", ext, len(content), "indexed", chunk_count, text[:10000], datetime.now().isoformat()),
        )
        created.append(doc_id)

    conn.commit()
    conn.close()
    return {"uploaded": len(created), "document_ids": created}


@router.get("/documents")
async def list_documents(
    category: Optional[str] = None,
    status: Optional[str] = None,
):
    conn = _get_db()

    query = "SELECT * FROM documents"
    params = []
    conditions = []
    if category:
        conditions.append("category = ?")
        params.append(category)
    if status:
        conditions.append("status = ?")
        params.append(status)
    if conditions:
        query += " WHERE " + " AND ".join(conditions)
    query += " ORDER BY created_at DESC"

    docs = conn.execute(query, params).fetchall()

    total_docs = conn.execute("SELECT COUNT(*) FROM documents").fetchone()[0]
    total_chunks = conn.execute("SELECT COALESCE(SUM(chunk_count), 0) FROM documents").fetchone()[0]

    conn.close()

    return {
        "documents": [
            {
                "id": d["id"],
                "filename": d["filename"],
                "title": d["title"] or d["filename"],
                "category": d["category"] or "general",
                "status": d["status"],
                "chunk_count": d["chunk_count"],
                "content": (d["content"] or "")[:200],
                "created_at": d["created_at"],
            }
            for d in docs
        ],
        "stats": {
            "total_docs": total_docs,
            "total_chunks": total_chunks,
            "total_assets": 0,
            "total_parts": 0,
            "indexed_docs": total_docs,
        },
    }


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    conn = _get_db()
    doc = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete file
    ext = doc["file_type"] or "txt"
    file_path = UPLOAD_DIR / f"{doc_id}.{ext}"
    if file_path.exists():
        file_path.unlink()

    conn.execute("DELETE FROM documents WHERE id = ?", (doc_id,))
    conn.commit()
    conn.close()
    return {"status": "deleted"}


@router.get("/search")
async def search_documents(q: str = "", category: Optional[str] = None):
    conn = _get_db()
    query = "SELECT * FROM documents WHERE content LIKE ?"
    params = [f"%{q}%"]
    if category:
        query += " AND category = ?"
        params.append(category)
    query += " ORDER BY created_at DESC LIMIT 20"

    docs = conn.execute(query, params).fetchall()
    conn.close()

    return {
        "results": [
            {
                "id": d["id"],
                "filename": d["filename"],
                "title": d["title"] or d["filename"],
                "category": d["category"],
                "snippet": (d["content"] or "")[:300],
                "score": 1.0,
            }
            for d in docs
        ]
    }


@router.post("/sync")
async def sync_knowledge():
    return {"queued": 0, "message": "SQLite knowledge base - no sync needed"}
