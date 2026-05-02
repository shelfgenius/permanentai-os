"""
Echo Router — Intelligent coding agent API.

Replaces the simple /nvidia/coding/chat proxy with a full agent:
  - Smart system prompts (Karpathy + Superpowers methodology)
  - Persistent memory across sessions
  - Auto model routing by task complexity
  - Context compression for long conversations
  - Skill execution (refactor, debug, test, etc.)
  - Prompt injection protection
"""
from __future__ import annotations

import json
import logging
import os
import time
import uuid
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.echo_engine import (
    build_system_prompt,
    build_memory_context,
    load_user_memory,
    save_user_memory,
    extract_memory_updates,
    select_model,
    classify_task_complexity,
    compress_messages,
    should_compress,
    sanitize_input,
    save_session,
    load_session,
    MODELS,
    ECHO_SKILL_PROMPTS,
)

logger = logging.getLogger("echo_router")
router = APIRouter(prefix="/echo", tags=["echo"])

NIM_BASE = os.getenv("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
KEY_CODING = os.getenv("NVIDIA_API_KEY_CODING", "").strip()
KEY_CHAT = os.getenv("NVIDIA_API_KEY", "").strip()


# ── Request/Response models ──────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str

class EchoChatRequest(BaseModel):
    messages: List[ChatMessage]
    max_tokens: int = 4096
    temperature: float = 0.4
    stream: bool = True
    model: Optional[str] = None       # explicit model selection or "auto"
    reasoning: str = "normal"          # normal, deep, creative
    mode: str = "chat"                 # chat, code
    skill: Optional[str] = None       # refactor, debug, test, explain, etc.
    current_file: Optional[str] = None
    current_content: Optional[str] = None
    session_id: Optional[str] = None
    user_id: str = "default"


# ── Main chat endpoint ───────────────────────────────────────────

@router.post("/chat")
async def echo_chat(req: EchoChatRequest):
    """Intelligent coding agent chat with memory, routing, and skills."""
    api_key = KEY_CODING or KEY_CHAT
    if not api_key:
        raise HTTPException(503, "No NVIDIA API key configured")

    # 1. Sanitize input
    user_msgs = [m for m in req.messages if m.role == "user"]
    latest_user = user_msgs[-1].content if user_msgs else ""
    cleaned_text, injection_warnings = sanitize_input(latest_user)
    if injection_warnings:
        logger.warning("Echo: injection flags on input: %s", injection_warnings)

    # 2. Smart model routing
    if req.model and req.model != "auto":
        model_info = select_model(requested_model=req.model)
    else:
        model_info = select_model(
            user_message=latest_user,
            reasoning_mode=req.reasoning,
        )

    complexity = classify_task_complexity(latest_user, len(req.messages))
    logger.info(
        "Echo: model=%s complexity=%s skill=%s mode=%s msgs=%d",
        model_info["label"], complexity, req.skill, req.mode, len(req.messages),
    )

    # 3. Build memory context
    memory_context = build_memory_context(req.user_id)

    # 4. Build system prompt
    system_prompt = build_system_prompt(
        mode=req.mode,
        skill=req.skill,
        current_file=req.current_file,
        current_content=req.current_content,
        memory_context=memory_context if memory_context.strip() else None,
    )

    # 5. Context compression if needed
    chat_messages = [{"role": m.role, "content": m.content} for m in req.messages]

    # Filter out any existing system messages from frontend
    chat_messages = [m for m in chat_messages if m["role"] != "system"]

    if should_compress(chat_messages):
        recent_msgs, summary_prompt = compress_messages(chat_messages)
        if summary_prompt:
            # Add compression note to system prompt
            system_prompt += (
                "\n\n## Compressed Context\n"
                "[Earlier messages were compressed. Key context preserved below.]\n"
                f"{summary_prompt[:3000]}"
            )
            chat_messages = recent_msgs

    # 6. Build final message list
    final_messages = [
        {"role": "system", "content": system_prompt},
        *chat_messages,
    ]

    # 7. Select max tokens based on model + reasoning
    max_tokens = req.max_tokens
    if req.reasoning == "deep":
        max_tokens = min(max_tokens * 2, model_info["max_tokens"])

    payload = {
        "model": model_info["model_id"],
        "messages": final_messages,
        "max_tokens": max_tokens,
        "temperature": req.temperature,
        "stream": req.stream,
    }

    try:
        if req.stream:
            async def stream_gen():
                full_response = []
                async with httpx.AsyncClient(timeout=180) as client:
                    async with client.stream(
                        "POST",
                        f"{NIM_BASE}/chat/completions",
                        json=payload,
                        headers={
                            "Authorization": f"Bearer {api_key}",
                            "Accept": "text/event-stream",
                        },
                    ) as resp:
                        if resp.status_code != 200:
                            body = await resp.aread()
                            logger.warning("Echo stream error %d: %s", resp.status_code, body[:200])
                            yield f'data: {{"error": "Model returned {resp.status_code}"}}\n\n'
                            return
                        async for line in resp.aiter_lines():
                            if line.startswith("data: "):
                                yield line + "\n\n"
                                # Collect response for memory
                                try:
                                    chunk_data = json.loads(line[6:])
                                    delta = chunk_data.get("choices", [{}])[0].get("delta", {})
                                    if "content" in delta and delta["content"]:
                                        full_response.append(delta["content"])
                                except Exception:
                                    pass

                # Post-stream: update memory asynchronously
                try:
                    assistant_text = "".join(full_response)
                    if assistant_text and len(assistant_text) > 50:
                        user_texts = [m.content for m in req.messages if m.role == "user"]
                        updates = extract_memory_updates(user_texts, [assistant_text])
                        if updates:
                            mem = load_user_memory(req.user_id)
                            mem["profile"].update(updates)
                            save_user_memory(mem, req.user_id)

                        # Save session
                        if req.session_id:
                            all_msgs = [{"role": m.role, "content": m.content} for m in req.messages]
                            all_msgs.append({"role": "assistant", "content": assistant_text[:2000]})
                            save_session(req.session_id, all_msgs, {
                                "model": model_info["label"],
                                "skill": req.skill,
                                "complexity": complexity,
                            })
                except Exception as e:
                    logger.debug("Echo memory update failed: %s", e)

            return StreamingResponse(stream_gen(), media_type="text/event-stream")
        else:
            async with httpx.AsyncClient(timeout=180) as client:
                r = await client.post(
                    f"{NIM_BASE}/chat/completions",
                    json=payload,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Accept": "application/json",
                    },
                )
            if r.status_code != 200:
                logger.warning("Echo error %d: %s", r.status_code, r.text[:300])
                raise HTTPException(r.status_code, f"Model error: {r.text[:200]}")
            return r.json()

    except httpx.TimeoutException:
        raise HTTPException(504, "Echo: model timeout")


# ── Metadata endpoints ───────────────────────────────────────────

@router.get("/models")
async def echo_models():
    """Return available models with routing info."""
    return {
        "models": [
            {
                "id": k,
                "label": v["label"],
                "tier": v["tier"],
                "max_tokens": v["max_tokens"],
            }
            for k, v in MODELS.items()
        ],
        "auto_routing": True,
    }


@router.get("/skills")
async def echo_skills():
    """Return available skills."""
    return {
        "skills": [
            {"id": k, "label": k.replace("_", " ").title()}
            for k in ECHO_SKILL_PROMPTS.keys()
        ]
    }


@router.get("/memory/{user_id}")
async def echo_memory(user_id: str = "default"):
    """Get user memory."""
    return load_user_memory(user_id)


@router.delete("/memory/{user_id}")
async def echo_clear_memory(user_id: str = "default"):
    """Clear user memory."""
    save_user_memory({
        "user_id": user_id,
        "profile": {},
        "preferences": {},
        "project_context": {},
        "session_summaries": [],
        "created_at": time.time(),
    }, user_id)
    return {"status": "cleared"}


@router.post("/memory/{user_id}/note")
async def echo_add_memory(user_id: str, note: dict):
    """Manually add a memory note."""
    mem = load_user_memory(user_id)
    key = note.get("key", "")
    value = note.get("value", "")
    if key and value:
        mem["profile"][key] = value
        save_user_memory(mem, user_id)
    return {"status": "saved", "key": key}
