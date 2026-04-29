"""
Multimodal Pipeline — transforms any file (PDF, image, audio, video, docx)
into text chunks and stores them in ChromaDB with SQLite metadata.
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from pathlib import Path
from typing import List

from services.chroma_service import ChromaService
from services.whisper_service import WhisperService
from services.vision_service import VisionService

logger = logging.getLogger("multimodal_pipeline")

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50


def _chunk_text(text: str) -> List[str]:
    words = text.split()
    chunks, buf = [], []
    for word in words:
        buf.append(word)
        if len(buf) >= CHUNK_SIZE:
            chunks.append(" ".join(buf))
            buf = buf[-CHUNK_OVERLAP:]
    if buf:
        chunks.append(" ".join(buf))
    return chunks


class MultimodalPipeline:
    def __init__(self):
        self.chroma = ChromaService()
        self.whisper = WhisperService()
        self.vision = VisionService()

    async def ingest_file(self, path: str, domain: str = "general") -> dict:
        p = Path(path)
        ext = p.suffix.lower()
        text = ""

        try:
            if ext == ".pdf":
                text = await self._extract_pdf(path)
            elif ext == ".docx":
                text = await self._extract_docx(path)
            elif ext in {".txt", ".md", ".csv"}:
                text = p.read_text(encoding="utf-8", errors="replace")
            elif ext in {".jpg", ".jpeg", ".png", ".webp", ".gif"}:
                text = await self.vision.describe_image(path)
            elif ext in {".mp4", ".mkv", ".avi", ".mov", ".webm", ".mp3", ".wav"}:
                text = await self._extract_audio(path)
            else:
                logger.warning("Unsupported file type: %s", ext)
                return {"status": "skipped", "reason": "unsupported_type"}

            if not text.strip():
                return {"status": "skipped", "reason": "empty_content"}

            chunks = _chunk_text(text)
            chunk_dicts = [
                {
                    "id": f"{p.stem}_{i}_{uuid.uuid4().hex[:8]}",
                    "text": chunk,
                    "metadata": {
                        "source": str(path),
                        "domain": domain,
                        "file_type": ext.lstrip("."),
                        "chunk_index": i,
                        "title": p.stem,
                    },
                }
                for i, chunk in enumerate(chunks)
            ]

            count = await self.chroma.upsert_chunks(chunk_dicts, domain)
            logger.info("Ingested %s → %d chunks in ChromaDB (domain=%s)", p.name, count, domain)
            return {"status": "ok", "chunks": count, "file": p.name}

        except Exception as exc:
            logger.error("Pipeline error for %s: %s", path, exc)
            return {"status": "error", "reason": str(exc)}

    async def _extract_pdf(self, path: str) -> str:
        loop = asyncio.get_event_loop()
        def _read():
            import fitz
            doc = fitz.open(path)
            return "\n\n".join(page.get_text() for page in doc)
        return await loop.run_in_executor(None, _read)

    async def _extract_docx(self, path: str) -> str:
        loop = asyncio.get_event_loop()
        def _read():
            import docx2txt
            return docx2txt.process(path) or ""
        return await loop.run_in_executor(None, _read)

    async def _extract_audio(self, path: str) -> str:
        result = await self.whisper.transcribe(path, language="ro")
        return result.get("text", "")
