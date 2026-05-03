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
from pydantic import BaseModel, field_validator

from services.echo_engine import (
    build_system_prompt,
    build_memory_context,
    load_user_memory,
    save_user_memory,
    extract_memory_updates,
    extract_memory_updates_llm,
    select_model,
    classify_task_complexity,
    compress_messages,
    compress_messages_llm,
    should_compress,
    sanitize_input,
    save_session,
    load_session,
    get_user_lock,
    _default_memory,
    list_personas,
    reload_personas,
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
    persona: Optional[str] = None     # agent persona id (e.g. "code_reviewer", "security_engineer")

    @field_validator("current_content")
    @classmethod
    def limit_content_size(cls, v):
        if v and len(v) > 50_000:
            raise ValueError("current_content exceeds 50 KB limit")
        return v

    @field_validator("messages")
    @classmethod
    def limit_message_count(cls, v):
        if len(v) > 100:
            return v[-50:]
        return v


# ── Main chat endpoint ───────────────────────────────────────────

@router.post("/chat")
async def echo_chat(req: EchoChatRequest):
    """Intelligent coding agent chat with memory, routing, and skills."""
    api_key = KEY_CODING or KEY_CHAT
    if not api_key:
        raise HTTPException(503, "No NVIDIA API key configured")

    trace_id = str(uuid.uuid4())[:8]

    # 1. Sanitize input
    user_msgs = [m for m in req.messages if m.role == "user"]
    latest_user = user_msgs[-1].content if user_msgs else ""
    cleaned_text, injection_warnings = sanitize_input(latest_user)
    if injection_warnings:
        logger.warning("Echo[%s]: injection flags: %s", trace_id, injection_warnings)
        # Block critical injection attempts
        blocked = [w for w in injection_warnings if w.startswith("blocked:")]
        if blocked:
            raise HTTPException(400, f"Request blocked by safety filter: {blocked}")
        # Use cleaned text for non-critical warnings
        if user_msgs:
            req.messages[-1] = ChatMessage(role="user", content=cleaned_text)

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
        "Echo[%s]: model=%s complexity=%s skill=%s mode=%s user=%s msgs=%d",
        trace_id, model_info["label"], complexity, req.skill, req.mode, req.user_id, len(req.messages),
    )

    # 3. Build memory context (relevance-scored against current query)
    #    Combines flat memory + graph-based memory for richer context
    memory_context = build_memory_context(req.user_id, current_query=latest_user)
    try:
        from services.memory_graph import get_memory_graph
        graph = get_memory_graph(req.user_id)
        graph_context = graph.export_to_memory_context(query=latest_user, max_chars=1000)
        if graph_context:
            memory_context = memory_context + "\n" + graph_context if memory_context else graph_context
    except Exception:
        pass  # graph is optional enhancement

    # 4. Build system prompt (with optional persona)
    system_prompt = build_system_prompt(
        mode=req.mode,
        skill=req.skill,
        current_file=req.current_file,
        current_content=req.current_content,
        memory_context=memory_context if memory_context.strip() else None,
        persona_id=req.persona,
    )

    # 5. Context compression if needed
    chat_messages = [{"role": m.role, "content": m.content} for m in req.messages]

    # Filter out any existing system messages from frontend
    chat_messages = [m for m in chat_messages if m["role"] != "system"]

    if should_compress(chat_messages):
        recent_msgs, summary = await compress_messages_llm(
            chat_messages, api_key=api_key, nim_base=NIM_BASE,
        )
        if summary:
            # Inject the actual summary (LLM-generated or raw prompt fallback)
            system_prompt += (
                "\n\n## Compressed Context\n"
                "[Earlier messages were compressed. Key context preserved below.]\n"
                f"{summary[:3000]}"
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
                usage = {}
                yield f'data: {{"trace_id": "{trace_id}", "model": "{model_info["label"]}"}}'  + "\n\n"
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
                                    if chunk_data.get("usage"):
                                        usage = chunk_data["usage"]
                                except Exception:
                                    pass

                # Post-stream: update memory with LLM-powered extraction
                try:
                    assistant_text = "".join(full_response)
                    if assistant_text and len(assistant_text) > 50:
                        async with get_user_lock(req.user_id):
                            user_texts = [m.content for m in req.messages if m.role == "user"]
                            # Use LLM extraction (falls back to heuristics)
                            updates = await extract_memory_updates_llm(
                                user_texts, [assistant_text],
                                api_key=api_key, nim_base=NIM_BASE,
                            )
                            if updates:
                                mem = load_user_memory(req.user_id)
                                # Store structured facts in appropriate sections
                                for k in ("user_name", "tech_stack", "recent_files"):
                                    if k in updates:
                                        mem["profile"][k] = updates[k]
                                if updates.get("project_name"):
                                    mem["project_context"]["name"] = updates["project_name"]
                                if updates.get("current_goal"):
                                    mem["project_context"]["current_goal"] = updates["current_goal"]
                                if updates.get("key_decisions"):
                                    existing = mem["project_context"].get("key_decisions", [])
                                    merged = list({d for d in existing + updates["key_decisions"]})
                                    mem["project_context"]["key_decisions"] = merged[-10:]
                                if updates.get("preferences"):
                                    mem["preferences"].update(updates["preferences"])
                                # Auto-generate session summary
                                if updates.get("_session_summary"):
                                    import datetime
                                    mem.setdefault("session_summaries", []).append({
                                        "date": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
                                        "summary": updates["_session_summary"],
                                    })
                                save_user_memory(mem, req.user_id)

                            # Also store key facts in memory graph
                            try:
                                from services.memory_graph import get_memory_graph
                                g = get_memory_graph(req.user_id)
                                sid = req.session_id or trace_id
                                if updates.get("tech_stack"):
                                    g.remember(f"Tech stack: {', '.join(updates['tech_stack'])}", "fact", "project", ["tech_stack"], sid)
                                if updates.get("project_name"):
                                    g.remember(f"Project: {updates['project_name']}", "fact", "project", ["project"], sid)
                                if updates.get("current_goal"):
                                    g.remember(f"Goal: {updates['current_goal']}", "goal", "project", ["goal"], sid)
                                if updates.get("preferences"):
                                    for pk, pv in updates["preferences"].items():
                                        g.remember(f"Preference: {pk} = {pv}", "preference", "global", ["preference", pk], sid)
                                for dec in (updates.get("key_decisions") or [])[:3]:
                                    g.remember(f"Decision: {dec}", "decision", "project", ["decision"], sid)
                            except Exception as ge:
                                logger.debug("Echo[%s]: graph memory update failed: %s", trace_id, ge)

                        # Save session
                        if req.session_id:
                            all_msgs = [{"role": m.role, "content": m.content} for m in req.messages]
                            all_msgs.append({"role": "assistant", "content": assistant_text[:2000]})
                            save_session(req.session_id, all_msgs, {
                                "model": model_info["label"],
                                "skill": req.skill,
                                "complexity": complexity,
                            })
                    if usage:
                        logger.info(
                            "Echo[%s]: tokens prompt=%d completion=%d",
                            trace_id,
                            usage.get("prompt_tokens", 0),
                            usage.get("completion_tokens", 0),
                        )
                except Exception as e:
                    logger.debug("Echo[%s]: memory update failed: %s", trace_id, e)

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
    async with get_user_lock(user_id):
        save_user_memory(_default_memory(user_id), user_id)
    return {"status": "cleared"}


@router.post("/memory/{user_id}/note")
async def echo_add_memory(user_id: str, note: dict):
    """Manually add a memory note."""
    key = note.get("key", "")
    value = note.get("value", "")
    if key and value:
        async with get_user_lock(user_id):
            mem = load_user_memory(user_id)
            mem["profile"][key] = value
            save_user_memory(mem, user_id)
    return {"status": "saved", "key": key}


# ── Persona endpoints ──────────────────────────────────────────────

@router.get("/personas")
async def echo_list_personas():
    """List all available agent personas."""
    return {"personas": list_personas()}


@router.post("/personas/reload")
async def echo_reload_personas():
    """Reload personas from disk (after adding/editing .md files)."""
    count = reload_personas()
    return {"status": "reloaded", "count": count}


# ── Memory Graph endpoints ─────────────────────────────────────────

@router.post("/memory-graph/{user_id}/remember")
async def echo_graph_remember(user_id: str, body: dict):
    """Store a memory in the graph. Deduplicates automatically."""
    from services.memory_graph import get_memory_graph
    graph = get_memory_graph(user_id)
    mid = graph.remember(
        content=body.get("content", ""),
        category=body.get("category", "fact"),
        scope=body.get("scope", "project"),
        tags=body.get("tags", []),
        session_id=body.get("session_id", ""),
    )
    if mid:
        return {"status": "stored", "id": mid}
    return {"status": "filtered", "id": None}


@router.get("/memory-graph/{user_id}/recall")
async def echo_graph_recall(user_id: str, query: str = "", limit: int = 10):
    """Recall relevant memories from the graph (BFS cascade retrieval)."""
    from services.memory_graph import get_memory_graph
    graph = get_memory_graph(user_id)
    return {"memories": graph.recall(query=query, limit=limit)}


@router.get("/memory-graph/{user_id}/search")
async def echo_graph_search(user_id: str, query: str = ""):
    """Search all memories by keyword."""
    from services.memory_graph import get_memory_graph
    graph = get_memory_graph(user_id)
    return {"results": graph.search(query=query)}


@router.get("/memory-graph/{user_id}/tags")
async def echo_graph_tags(user_id: str):
    """List all tags in the memory graph."""
    from services.memory_graph import get_memory_graph
    graph = get_memory_graph(user_id)
    return {"tags": graph.list_tags()}


@router.get("/memory-graph/{user_id}/stats")
async def echo_graph_stats(user_id: str):
    """Get memory graph statistics."""
    from services.memory_graph import get_memory_graph
    graph = get_memory_graph(user_id)
    return graph.stats()


@router.post("/memory-graph/{user_id}/consolidate")
async def echo_graph_consolidate(user_id: str):
    """Run memory maintenance (prune weak, discover links)."""
    from services.memory_graph import get_memory_graph
    graph = get_memory_graph(user_id)
    return graph.consolidate()


@router.post("/memory-graph/{user_id}/forget/{memory_id}")
async def echo_graph_forget(user_id: str, memory_id: str):
    """Deactivate a specific memory."""
    from services.memory_graph import get_memory_graph
    graph = get_memory_graph(user_id)
    ok = graph.forget(memory_id)
    return {"status": "forgotten" if ok else "not_found"}


@router.post("/memory-graph/{user_id}/link")
async def echo_graph_link(user_id: str, body: dict):
    """Create a semantic link between two memories."""
    from services.memory_graph import get_memory_graph
    graph = get_memory_graph(user_id)
    graph.link(
        from_id=body.get("from_id", ""),
        to_id=body.get("to_id", ""),
        relation=body.get("relation", "relates_to"),
        weight=body.get("weight", 1.0),
    )
    return {"status": "linked"}


# ── Safety System endpoints ────────────────────────────────────────

@router.post("/safety/check")
async def echo_safety_check(body: dict):
    """Check if an action is allowed by the safety system."""
    from services.safety_system import get_safety_system
    ss = get_safety_system()
    return ss.check_action(body.get("action", ""), body.get("context"))


@router.post("/safety/request-permission")
async def echo_safety_request(body: dict):
    """Request permission for a restricted action."""
    from services.safety_system import get_safety_system, Urgency
    ss = get_safety_system()
    req = ss.request_permission(
        action=body.get("action", ""),
        description=body.get("description", ""),
        rationale=body.get("rationale", ""),
        urgency=Urgency(body.get("urgency", "normal")),
        context=body.get("context"),
    )
    return req.to_dict()


@router.post("/safety/decide/{request_id}")
async def echo_safety_decide(request_id: str, body: dict):
    """Approve or deny a permission request."""
    from services.safety_system import get_safety_system, Decision
    ss = get_safety_system()
    ok = ss.record_decision(
        request_id=request_id,
        decision=Decision(body.get("decision", "denied")),
        reason=body.get("reason", ""),
    )
    return {"status": "recorded" if ok else "not_found"}


@router.get("/safety/pending")
async def echo_safety_pending():
    """Get all pending permission requests."""
    from services.safety_system import get_safety_system
    ss = get_safety_system()
    return {"pending": ss.pending_requests()}


@router.get("/safety/rules")
async def echo_safety_rules():
    """Get all action classification rules."""
    from services.safety_system import get_safety_system
    ss = get_safety_system()
    return {"rules": ss.get_classification_rules()}


# ── Telemetry endpoints ───────────────────────────────────────────

@router.get("/telemetry/stats")
async def echo_telemetry_stats(days: int = 7):
    """Get aggregate session telemetry statistics."""
    from services.session_telemetry import get_telemetry_store
    store = get_telemetry_store()
    return store.get_aggregate_stats(days=days)


# ── Soft Interrupt endpoints ──────────────────────────────────────

@router.post("/interrupt/{session_id}")
async def echo_queue_interrupt(session_id: str, body: dict):
    """Queue a soft interrupt to inject into a running session.

    The message will be injected at the next safe point in streaming,
    not by cancelling the current generation.
    """
    from services.soft_interrupt import get_interrupt_manager
    mgr = get_interrupt_manager()
    mgr.queue_interrupt(
        session_id=session_id,
        content=body.get("content", ""),
        urgent=body.get("urgent", False),
    )
    return {
        "status": "queued",
        "pending": mgr.get_queue(session_id).pending_count,
        "urgent": body.get("urgent", False),
    }


@router.get("/interrupt/{session_id}/status")
async def echo_interrupt_status(session_id: str):
    """Check interrupt queue status for a session."""
    from services.soft_interrupt import get_interrupt_manager
    mgr = get_interrupt_manager()
    q = mgr.get_queue(session_id)
    return {
        "session_id": session_id,
        "pending": q.pending_count,
        "has_urgent": q.has_urgent(),
        "injection_history": q.injection_history,
    }


@router.get("/interrupt/stats")
async def echo_interrupt_stats():
    """Get global interrupt manager statistics."""
    from services.soft_interrupt import get_interrupt_manager
    return get_interrupt_manager().stats()


# ── Ambient Engine endpoints ──────────────────────────────────────

@router.post("/ambient/run")
async def echo_ambient_run(body: dict = {}):
    """Trigger an ambient maintenance cycle (garden + scout).

    Gardens the memory graph (prune weak, discover links) and
    scouts recent sessions for unextracted memories.
    """
    from services.ambient_engine import get_ambient_engine
    engine = get_ambient_engine()
    result = await engine.run_cycle(user_id=body.get("user_id", "default"))
    return result


@router.get("/ambient/status")
async def echo_ambient_status():
    """Get ambient engine status and last cycle info."""
    from services.ambient_engine import get_ambient_engine
    return get_ambient_engine().status()
