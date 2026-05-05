"""
Async Worker — Background job processor for the Global Brain.

Processes jobs from the async_jobs table:
  - chat: Complete a pending AI response (survives tab close)
  - research: Run deep research pipeline
  - embed: Generate embeddings for knowledge base entries
  - ingest: Ingest documents into knowledge base

Runs as a background asyncio task inside the FastAPI process.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import httpx

from services.supabase_client import sb_select, sb_update, sb_insert
from services.chat_persistence import update_message
from services.nvidia_embeddings import get_nvidia_embedding_service

logger = logging.getLogger("async_worker")

NIM_BASE = os.getenv("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
POLL_INTERVAL = 3  # seconds between job queue checks


async def process_chat_job(job: dict) -> str:
    """Process a pending chat completion job."""
    inp = job.get("input", {})
    messages = inp.get("messages", [])
    pipeline = job.get("pipeline", "casual")
    model = inp.get("model", "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning")
    max_tokens = inp.get("max_tokens", 2048)
    api_key = os.getenv(inp.get("key_env", "NVIDIA_API_KEY"), "").strip()

    if not api_key:
        raise RuntimeError("No API key for chat job")

    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": inp.get("temperature", 0.6),
        "stream": False,
    }

    if inp.get("enable_thinking"):
        payload["extra_body"] = {
            "chat_template_kwargs": {"enable_thinking": True},
            "reasoning_budget": inp.get("reasoning_budget", 8192),
        }

    async with httpx.AsyncClient(timeout=180) as client:
        r = await client.post(
            f"{NIM_BASE}/chat/completions",
            json=payload,
            headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
        )

    if r.status_code != 200:
        raise RuntimeError(f"Model returned {r.status_code}: {r.text[:200]}")

    data = r.json()
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return content


async def process_embed_job(job: dict) -> dict:
    """Generate embeddings for knowledge base entries."""
    inp = job.get("input", {})
    texts = inp.get("texts", [])
    kb_ids = inp.get("kb_ids", [])

    if not texts:
        return {"embedded": 0}

    embed_svc = get_nvidia_embedding_service()
    embeddings = await embed_svc.embed_texts(texts, input_type="passage")

    # Update knowledge_base rows with embeddings
    for kb_id, emb in zip(kb_ids, embeddings):
        emb_str = "[" + ",".join(map(str, emb)) + "]"
        await sb_update(
            "knowledge_base",
            {"id": f"eq.{kb_id}"},
            {"embedding": emb_str},
        )

    return {"embedded": len(embeddings)}


async def process_job(job: dict):
    """Route and execute a single job."""
    job_id = job["id"]
    job_type = job["job_type"]
    message_id = job.get("message_id")

    logger.info("Processing job %s type=%s", job_id[:8], job_type)

    # Mark as processing
    await sb_update(
        "async_jobs",
        {"id": f"eq.{job_id}"},
        {"status": "processing", "started_at": datetime.now(timezone.utc).isoformat()},
    )
    if message_id:
        await update_message(message_id, status="processing")

    try:
        if job_type == "chat":
            content = await process_chat_job(job)
            await sb_update(
                "async_jobs",
                {"id": f"eq.{job_id}"},
                {
                    "status": "completed",
                    "output": json.dumps({"content": content}),
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            if message_id:
                await update_message(message_id, content=content, status="completed")

        elif job_type == "embed":
            result = await process_embed_job(job)
            await sb_update(
                "async_jobs",
                {"id": f"eq.{job_id}"},
                {
                    "status": "completed",
                    "output": json.dumps(result),
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            )

        elif job_type == "research":
            # Research uses the same chat pipeline with research prompt
            content = await process_chat_job(job)
            await sb_update(
                "async_jobs",
                {"id": f"eq.{job_id}"},
                {
                    "status": "completed",
                    "output": json.dumps({"content": content}),
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                },
            )
            if message_id:
                await update_message(message_id, content=content, status="completed")

        else:
            raise ValueError(f"Unknown job type: {job_type}")

        logger.info("Job %s completed", job_id[:8])

    except Exception as e:
        logger.error("Job %s failed: %s", job_id[:8], e)
        await sb_update(
            "async_jobs",
            {"id": f"eq.{job_id}"},
            {
                "status": "failed",
                "error": str(e)[:1000],
                "completed_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        if message_id:
            await update_message(
                message_id,
                content=f"[Error: {str(e)[:200]}]",
                status="failed",
            )


async def worker_loop():
    """Main worker loop — polls for pending jobs and processes them."""
    logger.info("Async worker started (poll every %ds)", POLL_INTERVAL)

    while True:
        try:
            jobs = await sb_select(
                "async_jobs",
                select="*",
                filters={"status": "eq.pending"},
                order="created_at.asc",
                limit=5,
            )

            for job in jobs:
                await process_job(job)

        except Exception as e:
            logger.error("Worker loop error: %s", e)

        await asyncio.sleep(POLL_INTERVAL)


def start_worker(loop: Optional[asyncio.AbstractEventLoop] = None):
    """Start the async worker as a background task."""
    if loop is None:
        loop = asyncio.get_event_loop()
    loop.create_task(worker_loop())
    logger.info("Async worker task created")
