"""Orchestrator router — SSE streaming chat endpoint + kill-switch."""
from __future__ import annotations

import json
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from orchestrator.orchestrator import get_orchestrator, set_online_mode

router = APIRouter(prefix="/ai", tags=["orchestrator"])


class QueryRequest(BaseModel):
    message: str
    domain: str = "constructii"
    session_id: str = "default"
    history: Optional[list] = None


class KillSwitchRequest(BaseModel):
    online: bool


@router.post("/query/stream")
async def query_stream(req: QueryRequest):
    """SSE stream: yields JSON events (text_fragment, formula, sources, animation, done)."""
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Mesajul nu poate fi gol")

    orchestrator = get_orchestrator()

    async def event_generator():
        async for event in orchestrator.query(
            message=req.message,
            domain=req.domain,
            session_id=req.session_id,
            history=req.history,
        ):
            yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/killswitch")
async def kill_switch(req: KillSwitchRequest):
    set_online_mode(req.online)
    return {"online_mode": req.online, "status": "updated"}


@router.get("/status")
async def status():
    from orchestrator.orchestrator import ONLINE_MODE
    return {"online_mode": ONLINE_MODE, "status": "running"}
