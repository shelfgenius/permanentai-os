"""Scavenger router — trigger web collection jobs."""
from __future__ import annotations

import asyncio
from fastapi import APIRouter
from pydantic import BaseModel

from agents.scavenger import run_scavenger_job

router = APIRouter(prefix="/scavenger", tags=["scavenger"])


class ScavengerRequest(BaseModel):
    domain: str
    query: str
    max_results: int = 10


@router.post("/search")
async def trigger_search(req: ScavengerRequest):
    asyncio.create_task(run_scavenger_job(req.domain, req.query, req.max_results))
    return {"status": "started", "domain": req.domain, "query": req.query}


@router.post("/search/sync")
async def trigger_search_sync(req: ScavengerRequest):
    result = await run_scavenger_job(req.domain, req.query, req.max_results)
    return result
