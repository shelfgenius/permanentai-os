"""
AURA Pipeline Router — Smart chat endpoint that auto-selects the right
AI pipeline based on query complexity.

POST /aura/pipeline/chat → classifies the query, picks the minimal
pipeline, streams the response. Returns pipeline info in the first SSE event.
"""
from __future__ import annotations

import json
import logging
import os
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from services.pipeline_router import classify_query, get_pipeline, PIPELINES

logger = logging.getLogger("aura_pipeline_router")
router = APIRouter(prefix="/aura/pipeline", tags=["aura-pipeline"])

NIM_BASE = os.getenv("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")

# ── AURA system prompts per pipeline ──────────────────────────────────
_AURA_GREETING_PROMPT = (
    "You are AURA, a personal AI assistant. The user is greeting you. "
    "Respond warmly but briefly — one or two short sentences. "
    "Be natural and conversational."
)

_AURA_CASUAL_PROMPT = (
    "You are AURA, a sophisticated personal AI assistant — inspired by F.R.I.D.A.Y. "
    "You speak with calm confidence, composure, and subtle warmth.\n"
    "Be concise and direct. Prefer short, clear sentences over long paragraphs.\n"
    "Sound composed and slightly formal, but never cold or robotic.\n"
    "If you don't know something, say so plainly. Never fabricate facts."
)

_AURA_REASONING_PROMPT = (
    "You are AURA, a sophisticated personal AI assistant with deep reasoning abilities.\n"
    "Think step by step through complex problems. Break down your reasoning clearly.\n"
    "Consider multiple perspectives. Identify assumptions and potential flaws.\n"
    "Be thorough but structured — use clear logical steps."
)

_AURA_CODE_PROMPT = (
    "You are AURA, an expert software engineer and coding assistant.\n"
    "Write clean, production-quality code. Follow best practices and conventions.\n"
    "When debugging, identify root causes, not just symptoms.\n"
    "Include necessary imports and handle edge cases.\n"
    "Explain your approach briefly, then provide the code."
)

_AURA_RESEARCH_PROMPT = (
    "You are AURA Deep Research — a comprehensive research agent.\n"
    "Provide thorough, well-structured analysis with:\n"
    "- Clear executive summary\n- Key findings with evidence\n"
    "- Multiple perspectives\n- Actionable recommendations\n"
    "Cite sources where possible. Be factual and thorough."
)

_AURA_MATH_PROMPT = (
    "You are AURA, an expert in mathematics, physics, and formal reasoning.\n"
    "Show your work step by step. Use proper notation.\n"
    "Verify your answers. Explain the intuition behind the solution.\n"
    "If there are multiple approaches, mention the most elegant one."
)

SYSTEM_PROMPTS = {
    "greeting": _AURA_GREETING_PROMPT,
    "casual": _AURA_CASUAL_PROMPT,
    "reasoning": _AURA_REASONING_PROMPT,
    "code": _AURA_CODE_PROMPT,
    "research": _AURA_RESEARCH_PROMPT,
    "math": _AURA_MATH_PROMPT,
}


# ── Request model ─────────────────────────────────────────────────────
class PipelineChatMessage(BaseModel):
    role: str
    content: str


class PipelineChatRequest(BaseModel):
    messages: List[PipelineChatMessage]
    stream: bool = True
    force_pipeline: Optional[str] = None  # override auto-classification


# ── Endpoint ──────────────────────────────────────────────────────────
@router.post("/chat")
async def aura_pipeline_chat(req: PipelineChatRequest):
    """Smart chat: auto-classifies the query and routes to the optimal pipeline."""

    # Get latest user message for classification
    user_msgs = [m for m in req.messages if m.role == "user"]
    if not user_msgs:
        raise HTTPException(400, "No user message provided")
    latest = user_msgs[-1].content

    # Classify
    if req.force_pipeline and req.force_pipeline in PIPELINES:
        category = req.force_pipeline
    else:
        category = await classify_query(latest)

    pipeline = get_pipeline(category)
    api_key = os.getenv(pipeline["key_env"], "").strip()
    if not api_key:
        # Fallback to main key
        api_key = os.getenv("NVIDIA_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(503, "No API key configured")

    # Build message list with appropriate system prompt
    system_prompt = SYSTEM_PROMPTS.get(category, _AURA_CASUAL_PROMPT)
    msgs = [{"role": m.role, "content": m.content} for m in req.messages]
    # Replace or prepend system prompt
    if not msgs or msgs[0].get("role") != "system":
        msgs.insert(0, {"role": "system", "content": system_prompt})
    else:
        msgs[0]["content"] = system_prompt

    payload = {
        "model": pipeline["model"],
        "messages": msgs,
        "max_tokens": pipeline["max_tokens"],
        "temperature": pipeline["temperature"],
        "stream": req.stream,
    }

    # Add reasoning config if enabled
    if pipeline.get("enable_thinking"):
        payload["extra_body"] = {
            "chat_template_kwargs": {"enable_thinking": True},
            "reasoning_budget": pipeline["reasoning_budget"],
        }

    logger.info(
        "Pipeline [%s]: model=%s max_tokens=%d thinking=%s msg=%s",
        category,
        pipeline["model"],
        pipeline["max_tokens"],
        pipeline.get("enable_thinking", False),
        latest[:80],
    )

    if req.stream:
        async def stream_gen():
            # First event: pipeline metadata
            yield f'data: {json.dumps({"pipeline": category, "label": pipeline["label"]})}\n\n'

            async with httpx.AsyncClient(timeout=180) as client:
                async with client.stream(
                    "POST",
                    f"{NIM_BASE}/chat/completions",
                    json=payload,
                    headers={"Authorization": f"Bearer {api_key}", "Accept": "text/event-stream"},
                ) as resp:
                    if resp.status_code != 200:
                        body = await resp.aread()
                        logger.warning("Pipeline stream error %d: %s", resp.status_code, body[:300])
                        yield f'data: {json.dumps({"error": f"Model returned {resp.status_code}"})}\n\n'
                        return
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            yield line + "\n\n"

        return StreamingResponse(stream_gen(), media_type="text/event-stream")
    else:
        try:
            async with httpx.AsyncClient(timeout=180) as client:
                r = await client.post(
                    f"{NIM_BASE}/chat/completions",
                    json=payload,
                    headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
                )
            if r.status_code != 200:
                logger.warning("Pipeline error %d: %s", r.status_code, r.text[:300])
                raise HTTPException(r.status_code, f"Model error: {r.text[:200]}")
            data = r.json()
            data["pipeline"] = {"category": category, "label": pipeline["label"]}
            return data
        except httpx.TimeoutException:
            raise HTTPException(504, "Pipeline: model timeout")


@router.get("/pipelines")
async def list_pipelines():
    """List available pipeline categories and their configs."""
    return {
        name: {"label": p["label"], "model": p["model"], "thinking": p.get("enable_thinking", False)}
        for name, p in PIPELINES.items()
    }
