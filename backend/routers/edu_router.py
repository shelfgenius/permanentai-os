"""Education router — spaced repetition scheduler + subject sessions."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.sqlite_service import get_sqlite_service

logger = logging.getLogger("edu_router")
router = APIRouter(prefix="/edu", tags=["education"])

INTERVALS_DAYS = [1, 3, 7, 21, 60]

SUBJECTS = [
    {"id": "ro",      "label": "Română",              "icon": "🇷🇴"},
    {"id": "math",    "label": "Matematică",           "icon": "📐"},
    {"id": "bio",     "label": "Biologie",             "icon": "🧬"},
    {"id": "en",      "label": "Engleză Oral",         "icon": "🗣️"},
    {"id": "digital", "label": "Competențe Digitale",  "icon": "💻"},
]


class ConceptIn(BaseModel):
    user_id:  int = 1
    concept:  str
    subject:  str
    domain:   str = "educatie"


class ReviewDoneIn(BaseModel):
    user_id:       int = 1
    repetition_id: int
    success:       bool = True


@router.get("/subjects")
async def list_subjects():
    return {"subjects": SUBJECTS}


@router.get("/reviews/due")
async def get_due_reviews(user_id: int = 1):
    db = get_sqlite_service()
    reviews = await db.get_reviews_due(user_id)
    return {"reviews": reviews, "count": len(reviews)}


@router.post("/concepts")
async def add_concept(body: ConceptIn):
    db = get_sqlite_service()
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()
    conn = db._conn()
    with conn:
        conn.execute(
            """INSERT INTO spaced_repetition
               (user_id, concept, domain, subject, first_studied, next_review, interval_days, repetition_count)
               VALUES (?,?,?,?,?,?,1,0)""",
            (body.user_id, body.concept, body.domain, body.subject,
             datetime.now(timezone.utc).date().isoformat(), tomorrow),
        )
        conn.commit()
    return {"status": "added", "concept": body.concept, "next_review": tomorrow}


@router.post("/reviews/done")
async def mark_review_done(body: ReviewDoneIn):
    db = get_sqlite_service()
    conn = db._conn()
    with conn:
        row = conn.execute(
            "SELECT * FROM spaced_repetition WHERE id=? AND user_id=?",
            (body.repetition_id, body.user_id),
        ).fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Review not found")

        current_interval = row["interval_days"]
        count = row["repetition_count"]

        if body.success:
            next_idx = min(count + 1, len(INTERVALS_DAYS) - 1)
            next_interval = INTERVALS_DAYS[next_idx]
        else:
            next_interval = 1

        next_review = (datetime.now(timezone.utc) + timedelta(days=next_interval)).date().isoformat()

        conn.execute(
            """UPDATE spaced_repetition
               SET next_review=?, interval_days=?, repetition_count=repetition_count+1
               WHERE id=?""",
            (next_review, next_interval, body.repetition_id),
        )
        conn.commit()

    return {
        "status": "updated",
        "next_review": next_review,
        "next_interval_days": next_interval,
    }


@router.get("/progress/{user_id}")
async def get_progress(user_id: int):
    db = get_sqlite_service()
    conn = db._conn()
    with conn:
        rows = conn.execute(
            "SELECT subject, COUNT(*) as total, SUM(repetition_count) as reps FROM spaced_repetition WHERE user_id=? GROUP BY subject",
            (user_id,),
        ).fetchall()
    return {
        "user_id": user_id,
        "progress": [dict(r) for r in rows],
    }
