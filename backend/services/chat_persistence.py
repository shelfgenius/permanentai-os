"""
Chat Persistence Service — saves and loads AURA chat history to/from Supabase.

Every message is persisted immediately. Supports:
  - Creating sessions
  - Saving user + assistant messages
  - Loading session history (for context window)
  - Marking async messages as completed
  - Listing user sessions
"""
from __future__ import annotations

import logging
import uuid
from typing import Dict, List, Optional

from services.supabase_client import sb_insert, sb_select, sb_update

logger = logging.getLogger("chat_persistence")


async def create_session(user_id: str) -> str:
    """Create a new chat session, returns session_id."""
    session_id = str(uuid.uuid4())
    logger.info("New session %s for user %s", session_id[:8], user_id[:8])
    return session_id


async def save_message(
    session_id: str,
    user_id: str,
    role: str,
    content: str,
    status: str = "completed",
    pipeline: Optional[str] = None,
    metadata: Optional[Dict] = None,
) -> Optional[str]:
    """Save a single message to chat_history. Returns message id."""
    row = {
        "session_id": session_id,
        "user_id": user_id,
        "role": role,
        "content": content,
        "status": status,
        "pipeline": pipeline,
        "metadata": metadata or {},
    }
    result = await sb_insert("chat_history", [row])
    if result:
        msg_id = result[0].get("id")
        logger.debug("Saved %s message %s", role, str(msg_id)[:8] if msg_id else "?")
        return msg_id
    return None


async def update_message(
    message_id: str,
    content: Optional[str] = None,
    status: Optional[str] = None,
    pipeline: Optional[str] = None,
    metadata: Optional[Dict] = None,
) -> bool:
    """Update an existing message (used by async workers)."""
    data = {}
    if content is not None:
        data["content"] = content
    if status is not None:
        data["status"] = status
    if pipeline is not None:
        data["pipeline"] = pipeline
    if metadata is not None:
        data["metadata"] = metadata
    if not data:
        return False

    result = await sb_update("chat_history", {"id": f"eq.{message_id}"}, data)
    return bool(result)


async def load_session_messages(
    session_id: str,
    limit: int = 50,
) -> List[Dict]:
    """Load messages for a session, ordered by creation time."""
    rows = await sb_select(
        "chat_history",
        select="id,role,content,pipeline,status,metadata,created_at",
        filters={
            "session_id": f"eq.{session_id}",
            "status": "neq.failed",
        },
        order="created_at.asc",
        limit=limit,
    )
    return rows


async def list_user_sessions(
    user_id: str,
    limit: int = 20,
) -> List[Dict]:
    """List recent sessions for a user with the first message as preview."""
    rows = await sb_select(
        "chat_history",
        select="session_id,content,created_at",
        filters={
            "user_id": f"eq.{user_id}",
            "role": "eq.user",
        },
        order="created_at.desc",
        limit=limit * 3,  # get extra to group by session
    )

    # Group by session, take first user message as preview
    seen = {}
    sessions = []
    for row in rows:
        sid = row["session_id"]
        if sid not in seen:
            seen[sid] = True
            sessions.append({
                "session_id": sid,
                "preview": (row.get("content") or "")[:120],
                "created_at": row.get("created_at"),
            })
        if len(sessions) >= limit:
            break

    return sessions


async def get_context_window(
    session_id: str,
    max_messages: int = 20,
    max_chars: int = 6000,
) -> List[Dict]:
    """Get the last N messages from a session, capped by character count.
    This is the 'Context Engineering' core — returns only what's needed."""
    messages = await load_session_messages(session_id, limit=max_messages)

    # Take from the end, respecting character budget
    result = []
    char_count = 0
    for msg in reversed(messages):
        content_len = len(msg.get("content", ""))
        if char_count + content_len > max_chars and result:
            break
        result.insert(0, {"role": msg["role"], "content": msg["content"]})
        char_count += content_len

    return result
