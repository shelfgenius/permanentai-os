"""
SQLite file index — stores metadata for every archived file.
Schema: id, md5_hash, filename, filepath, domain, subdomain,
        file_type, resolution, download_date, source_url, relevance_score
"""
from __future__ import annotations

import asyncio
import logging
import sqlite3
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import List, Optional

logger = logging.getLogger("sqlite_service")

DB_PATH = Path("/db/techquery_index.db")
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

CREATE_SQL = """
CREATE TABLE IF NOT EXISTS file_index (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    md5_hash        TEXT    NOT NULL UNIQUE,
    filename        TEXT    NOT NULL,
    filepath        TEXT    NOT NULL,
    domain          TEXT    NOT NULL,
    subdomain       TEXT,
    file_type       TEXT,
    resolution      TEXT,
    download_date   TEXT    NOT NULL,
    source_url      TEXT,
    relevance_score REAL    DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS users (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    username         TEXT    NOT NULL UNIQUE,
    display_name     TEXT,
    preferred_domain TEXT    DEFAULT 'general',
    voice_preference TEXT,
    avatar_mascot    TEXT,
    theme_color      TEXT    DEFAULT '#ff8c00',
    created_at       TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS spaced_repetition (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id      INTEGER NOT NULL,
    concept      TEXT    NOT NULL,
    domain       TEXT    NOT NULL,
    subject      TEXT,
    first_studied TEXT   NOT NULL,
    next_review  TEXT    NOT NULL,
    interval_days INTEGER DEFAULT 1,
    repetition_count INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS ix_file_md5      ON file_index(md5_hash);
CREATE INDEX IF NOT EXISTS ix_file_domain   ON file_index(domain);
CREATE INDEX IF NOT EXISTS ix_sr_next_review ON spaced_repetition(next_review);
"""


class SQLiteService:
    def __init__(self, db_path: str = str(DB_PATH)):
        self._path = db_path
        self._init_db()

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        with self._conn() as conn:
            for stmt in CREATE_SQL.strip().split(";"):
                stmt = stmt.strip()
                if stmt:
                    conn.execute(stmt)
            conn.commit()
        logger.info("SQLite DB initialised at %s", self._path)

    async def find_by_hash(self, md5: str) -> Optional[dict]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._find_by_hash_sync, md5)

    def _find_by_hash_sync(self, md5: str) -> Optional[dict]:
        with self._conn() as conn:
            row = conn.execute("SELECT * FROM file_index WHERE md5_hash=?", (md5,)).fetchone()
            return dict(row) if row else None

    async def insert_file(self, md5_hash: str, filename: str, filepath: str,
                          domain: str, source_url: str = "", relevance_score: float = 1.0,
                          file_type: str = "", subdomain: str = "", resolution: str = "") -> int:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._insert_file_sync,
                                          md5_hash, filename, filepath, domain,
                                          source_url, relevance_score, file_type,
                                          subdomain, resolution)

    def _insert_file_sync(self, md5_hash, filename, filepath, domain,
                          source_url, relevance_score, file_type, subdomain, resolution) -> int:
        with self._conn() as conn:
            cursor = conn.execute(
                """INSERT OR IGNORE INTO file_index
                   (md5_hash, filename, filepath, domain, subdomain, file_type,
                    resolution, download_date, source_url, relevance_score)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (md5_hash, filename, filepath, domain, subdomain, file_type,
                 resolution, datetime.now(timezone.utc).isoformat(), source_url, relevance_score),
            )
            conn.commit()
            return cursor.lastrowid

    async def list_files(self, domain: Optional[str] = None,
                         file_type: Optional[str] = None, limit: int = 100) -> List[dict]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._list_files_sync, domain, file_type, limit)

    def _list_files_sync(self, domain, file_type, limit) -> List[dict]:
        sql = "SELECT * FROM file_index WHERE 1=1"
        params = []
        if domain:
            sql += " AND domain=?"
            params.append(domain)
        if file_type:
            sql += " AND file_type=?"
            params.append(file_type)
        sql += f" ORDER BY download_date DESC LIMIT {limit}"
        with self._conn() as conn:
            rows = conn.execute(sql, params).fetchall()
            return [dict(r) for r in rows]

    async def get_reviews_due(self, user_id: int) -> List[dict]:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._get_reviews_due_sync, user_id)

    def _get_reviews_due_sync(self, user_id: int) -> List[dict]:
        today = datetime.now(timezone.utc).date().isoformat()
        with self._conn() as conn:
            rows = conn.execute(
                "SELECT * FROM spaced_repetition WHERE user_id=? AND next_review<=?",
                (user_id, today),
            ).fetchall()
            return [dict(r) for r in rows]

    async def upsert_user(self, username: str, display_name: str = "",
                          preferred_domain: str = "general",
                          theme_color: str = "#ff8c00") -> int:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, self._upsert_user_sync,
                                          username, display_name, preferred_domain, theme_color)

    def _upsert_user_sync(self, username, display_name, preferred_domain, theme_color) -> int:
        with self._conn() as conn:
            conn.execute(
                """INSERT INTO users (username, display_name, preferred_domain, theme_color, created_at)
                   VALUES (?,?,?,?,?)
                   ON CONFLICT(username) DO UPDATE SET
                     preferred_domain=excluded.preferred_domain,
                     theme_color=excluded.theme_color""",
                (username, display_name, preferred_domain, theme_color, datetime.now(timezone.utc).isoformat()),
            )
            conn.commit()
            row = conn.execute("SELECT id FROM users WHERE username=?", (username,)).fetchone()
            return row["id"] if row else -1


@lru_cache(maxsize=1)
def get_sqlite_service() -> SQLiteService:
    return SQLiteService()
