"""
Archivist Agent — receives downloaded files, deduplicates via MD5,
validates relevance via Vision LLM, and sends to multimodal pipeline.
"""
from __future__ import annotations

import hashlib
import logging
import os
from pathlib import Path
from typing import Optional

import yaml

logger = logging.getLogger("archivist")

_CONFIG_PATH = Path(__file__).parent.parent.parent / "config.yaml"
with open(_CONFIG_PATH, "r", encoding="utf-8") as _f:
    CONFIG = yaml.safe_load(_f)


def _md5_file(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


class Archivist:
    def __init__(self, db_service=None, vision_service=None, pipeline=None):
        self.db = db_service
        self.vision = vision_service
        self.pipeline = pipeline

    async def process_file(self, path: Path, domain: str, source_url: str = "") -> dict:
        if not path.exists():
            return {"status": "error", "reason": "file_not_found"}

        md5 = _md5_file(path)

        if self.db:
            existing = await self.db.find_by_hash(md5)
            if existing:
                path.unlink(missing_ok=True)
                logger.info("Duplicate skipped: %s (md5=%s)", path.name, md5)
                return {"status": "duplicate", "md5": md5}

        relevance_score = 1.0
        if self.vision and path.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
            try:
                result = await self.vision.check_relevance(str(path), domain)
                relevance_score = result.get("score", 1.0)
            except Exception as exc:
                logger.warning("Vision relevance check failed: %s", exc)

        min_score = CONFIG["quality"]["chroma_similarity_threshold"]
        if relevance_score < min_score:
            path.unlink(missing_ok=True)
            logger.info("Irrelevant file removed: %s (score=%.2f)", path.name, relevance_score)
            return {"status": "rejected", "reason": "low_relevance", "score": relevance_score}

        if self.db:
            await self.db.insert_file(
                md5_hash=md5,
                filename=path.name,
                filepath=str(path),
                domain=domain,
                source_url=source_url,
                relevance_score=relevance_score,
                file_type=path.suffix.lstrip("."),
            )

        if self.pipeline:
            await self.pipeline.ingest_file(str(path), domain=domain)

        logger.info("Archived: %s (domain=%s score=%.2f)", path.name, domain, relevance_score)
        return {"status": "archived", "path": str(path), "md5": md5, "score": relevance_score}

    async def process_batch(self, paths: list[Path], domain: str, source_urls: list[str] = None) -> list[dict]:
        results = []
        source_urls = source_urls or [""] * len(paths)
        for path, url in zip(paths, source_urls):
            result = await self.process_file(path, domain, url)
            results.append(result)
        return results
