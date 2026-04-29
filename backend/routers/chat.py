from __future__ import annotations

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from db.database import get_db
from db.models import ChatSession, ChatMessage
from services.rag_service import rag_stream

router = APIRouter(prefix="/chat", tags=["chat"])


class ChatRequest(BaseModel):
    message: str
    session_id: Optional[str] = None
    category: Optional[str] = None


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    sources: list
    created_at: str

    class Config:
        from_attributes = True


@router.post("/stream")
async def chat_stream(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Stream a RAG-augmented chat response using SSE."""
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    session_id = req.session_id

    if session_id:
        result = await db.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            session = ChatSession(
                id=session_id,
                title=req.message[:60],
                category=req.category,
            )
            db.add(session)
            await db.flush()
    else:
        session = None

    if session_id:
        history_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at)
            .limit(20)
        )
        history = [
            {"role": msg.role, "content": msg.content}
            for msg in history_result.scalars().all()
        ]
    else:
        history = []

    if session_id:
        user_msg = ChatMessage(
            session_id=session_id,
            role="user",
            content=req.message,
        )
        db.add(user_msg)
        await db.flush()

    async def event_stream():
        full_response = []
        sources_captured = []

        async for chunk in rag_stream(
            query=req.message,
            db=db,
            session_id=session_id,
            category=req.category,
            history=history,
        ):
            if '"sources"' in chunk and '"delta"' not in chunk:
                import json as _json
                try:
                    data = _json.loads(chunk.removeprefix("data: ").strip())
                    sources_captured = data.get("sources", [])
                except Exception:
                    pass
            elif '"delta"' in chunk:
                import json as _json
                try:
                    data = _json.loads(chunk.removeprefix("data: ").strip())
                    full_response.append(data.get("delta", ""))
                except Exception:
                    pass

            yield chunk

        if session_id and full_response:
            assistant_msg = ChatMessage(
                session_id=session_id,
                role="assistant",
                content="".join(full_response),
                sources=sources_captured,
            )
            db.add(assistant_msg)
            try:
                await db.commit()
            except Exception:
                await db.rollback()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/sessions/{session_id}/messages", response_model=List[MessageOut])
async def get_session_messages(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    return [
        MessageOut(
            id=str(m.id),
            role=m.role,
            content=m.content,
            sources=m.sources or [],
            created_at=m.created_at.isoformat(),
        )
        for m in messages
    ]


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChatSession).where(ChatSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    return {"status": "deleted"}
