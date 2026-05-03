"""
Autopilot Router — Social media publishing + workflow automation.

Ported from auto-browser. Provides:
  - /autopilot/social/{platform}/{action} — Direct social media actions
  - /autopilot/workflow/run — Execute multi-step workflows
  - /autopilot/workflow/list — List workflow runs
  - /autopilot/workflow/status/{run_id} — Get run status

All social credentials come from env vars. The workflow engine supports
step dependencies, retries, and template chaining between steps.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger("autopilot_router")
router = APIRouter(prefix="/autopilot", tags=["autopilot"])


# ── Social client lazy init ──────────────────────────────────────

def _get_youtube():
    from services.social_clients import YouTubeClient
    try:
        return YouTubeClient.from_env()
    except KeyError as e:
        raise HTTPException(503, f"YouTube not configured: missing {e}")

def _get_instagram():
    from services.social_clients import InstagramClient
    try:
        return InstagramClient.from_env()
    except KeyError as e:
        raise HTTPException(503, f"Instagram not configured: missing {e}")

def _get_reddit():
    from services.social_clients import RedditClient
    try:
        return RedditClient.from_env()
    except KeyError as e:
        raise HTTPException(503, f"Reddit not configured: missing {e}")

def _get_x():
    from services.social_clients import XClient
    try:
        return XClient.from_env()
    except KeyError as e:
        raise HTTPException(503, f"X/Twitter not configured: missing {e}")


# ── Request models ───────────────────────────────────────────────

class YouTubeUploadRequest(BaseModel):
    file_path: str
    title: str
    description: str = ""
    tags: List[str] = []
    privacy: str = "public"
    is_short: bool = False

class YouTubeSearchRequest(BaseModel):
    query: str
    max_results: int = 10

class InstagramPostRequest(BaseModel):
    image_url: str = ""
    video_url: str = ""
    caption: str = ""
    cover_url: str = ""

class RedditPostRequest(BaseModel):
    subreddit: str
    title: str
    text: str = ""
    url: str = ""

class TweetRequest(BaseModel):
    text: str
    media_path: str = ""

class ThreadRequest(BaseModel):
    texts: List[str]
    media_path: str = ""

class WorkflowRunRequest(BaseModel):
    workflow_id: str
    steps: List[Dict[str, Any]]
    initial_context: Dict[str, Any] = {}


# ═══════════════════════════════════════════════════════════════════
# Social Endpoints
# ═══════════════════════════════════════════════════════════════════

# ── YouTube ───────────────────────────────────────────────────────

@router.post("/social/youtube/upload")
async def youtube_upload(req: YouTubeUploadRequest):
    yt = _get_youtube()
    if req.is_short:
        result = await yt.create_short(
            file_path=req.file_path, title=req.title,
            description=req.description, tags=req.tags,
        )
    else:
        result = await yt.upload_video(
            file_path=req.file_path, title=req.title,
            description=req.description, tags=req.tags, privacy=req.privacy,
        )
    return {"status": "uploaded", "video": result}


@router.post("/social/youtube/search")
async def youtube_search(req: YouTubeSearchRequest):
    yt = _get_youtube()
    results = await yt.search_videos(req.query, max_results=req.max_results)
    return {"results": results}


@router.get("/social/youtube/stats/{video_id}")
async def youtube_stats(video_id: str):
    yt = _get_youtube()
    return await yt.get_video_stats(video_id)


# ── Instagram ────────────────────────────────────────────────────

@router.post("/social/instagram/post")
async def instagram_post(req: InstagramPostRequest):
    ig = _get_instagram()
    if req.video_url:
        result = await ig.post_reel(req.video_url, caption=req.caption, cover_url=req.cover_url)
        return {"status": "reel_posted", "result": result}
    elif req.image_url:
        result = await ig.post_image(req.image_url, caption=req.caption)
        return {"status": "image_posted", "result": result}
    raise HTTPException(400, "Provide image_url or video_url")


# ── Reddit ───────────────────────────────────────────────────────

@router.post("/social/reddit/post")
async def reddit_post(req: RedditPostRequest):
    rd = _get_reddit()
    if req.url:
        result = await rd.submit_link(req.subreddit, req.title, req.url)
    else:
        result = await rd.submit_text(req.subreddit, req.title, req.text)
    return {"status": "posted", "result": result}


# ── X / Twitter ──────────────────────────────────────────────────

@router.post("/social/x/tweet")
async def x_tweet(req: TweetRequest):
    x = _get_x()
    media_ids = None
    if req.media_path:
        mid = await x.upload_media(req.media_path)
        media_ids = [mid]
    result = await x.post_tweet(req.text, media_ids=media_ids)
    return {"status": "tweeted", "result": result}


@router.post("/social/x/thread")
async def x_thread(req: ThreadRequest):
    x = _get_x()
    media_ids = None
    if req.media_path:
        mid = await x.upload_media(req.media_path)
        media_ids = [mid]
    results = await x.post_thread(req.texts, media_ids=media_ids)
    return {"status": "thread_posted", "tweets": len(results), "results": results}


# ── Platform availability ────────────────────────────────────────

@router.get("/social/status")
async def social_status():
    """Check which social platforms have credentials configured."""
    platforms = {}
    env = os.environ
    platforms["youtube"] = all(k in env for k in ("YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"))
    platforms["instagram"] = all(k in env for k in ("INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_USER_ID"))
    platforms["reddit"] = all(k in env for k in ("REDDIT_CLIENT_ID", "REDDIT_CLIENT_SECRET", "REDDIT_USERNAME", "REDDIT_PASSWORD"))
    platforms["x"] = all(k in env for k in ("X_API_KEY", "X_API_SECRET", "X_ACCESS_TOKEN", "X_ACCESS_SECRET"))
    return {"platforms": platforms}


# ═══════════════════════════════════════════════════════════════════
# Workflow Endpoints
# ═══════════════════════════════════════════════════════════════════

_engine = None

def _get_engine():
    global _engine
    if _engine is None:
        from services.workflow_engine import WorkflowEngine
        _engine = WorkflowEngine()
        _register_social_actions(_engine)
    return _engine


def _register_social_actions(engine):
    """Register social media actions as workflow step handlers."""

    async def _yt_upload(action: str, params: dict, ctx: dict) -> dict:
        yt = _get_youtube()
        return await yt.upload_video(**params)

    async def _yt_short(action: str, params: dict, ctx: dict) -> dict:
        yt = _get_youtube()
        return await yt.create_short(**params)

    async def _yt_search(action: str, params: dict, ctx: dict) -> dict:
        yt = _get_youtube()
        results = await yt.search_videos(**params)
        return {"results": results}

    async def _ig_image(action: str, params: dict, ctx: dict) -> dict:
        ig = _get_instagram()
        return await ig.post_image(**params)

    async def _ig_reel(action: str, params: dict, ctx: dict) -> dict:
        ig = _get_instagram()
        return await ig.post_reel(**params)

    async def _reddit_text(action: str, params: dict, ctx: dict) -> dict:
        rd = _get_reddit()
        return await rd.submit_text(**params)

    async def _reddit_link(action: str, params: dict, ctx: dict) -> dict:
        rd = _get_reddit()
        return await rd.submit_link(**params)

    async def _x_tweet(action: str, params: dict, ctx: dict) -> dict:
        x = _get_x()
        return await x.post_tweet(**params)

    async def _x_thread(action: str, params: dict, ctx: dict) -> dict:
        x = _get_x()
        return await x.post_thread(**params)

    engine.register_action("social.youtube.upload", _yt_upload)
    engine.register_action("social.youtube.short", _yt_short)
    engine.register_action("social.youtube.search", _yt_search)
    engine.register_action("social.instagram.image", _ig_image)
    engine.register_action("social.instagram.reel", _ig_reel)
    engine.register_action("social.reddit.text", _reddit_text)
    engine.register_action("social.reddit.link", _reddit_link)
    engine.register_action("social.x.tweet", _x_tweet)
    engine.register_action("social.x.thread", _x_thread)


@router.post("/workflow/run")
async def run_workflow(req: WorkflowRunRequest):
    """Execute a multi-step workflow."""
    engine = _get_engine()
    if len(req.steps) > 20:
        raise HTTPException(400, "Max 20 steps per workflow")
    wf_run = await engine.run(req.workflow_id, req.steps, req.initial_context)
    return {
        "run_id": wf_run.run_id,
        "status": wf_run.status.value,
        "step_statuses": {k: v.value for k, v in wf_run.step_statuses.items()},
        "step_results": wf_run.step_results,
        "step_errors": wf_run.step_errors,
        "error": wf_run.error,
        "duration_seconds": round(wf_run.finished_at - wf_run.started_at, 2),
    }


@router.get("/workflow/list")
async def list_workflows(workflow_id: str = ""):
    engine = _get_engine()
    return {"runs": engine.list_runs(workflow_id)}


@router.get("/workflow/status/{run_id}")
async def workflow_status(run_id: str):
    engine = _get_engine()
    result = engine.get_run(run_id)
    if not result:
        raise HTTPException(404, "Workflow run not found")
    return result


@router.get("/workflow/actions")
async def list_actions():
    """List all registered workflow actions."""
    engine = _get_engine()
    return {"actions": engine.list_actions()}


# ═══════════════════════════════════════════════════════════════════
# Browser Agent Endpoints
# ═══════════════════════════════════════════════════════════════════

class BrowserAgentRequest(BaseModel):
    goal: str
    start_url: str = ""
    max_steps: int = 10
    auth_profile: str = ""

class BrowserScrapeRequest(BaseModel):
    url: str
    extract_selector: str = "body"


@router.post("/browser/run")
async def browser_agent_run(req: BrowserAgentRequest):
    """Run an AI-driven browser agent to accomplish a goal."""
    from services.browser_agent import run_browser_agent

    api_key = os.getenv("NVIDIA_API_KEY_CODING", "") or os.getenv("NVIDIA_API_KEY", "")
    nim_base = os.getenv("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")

    if not api_key:
        raise HTTPException(503, "No NVIDIA API key configured for browser agent")
    if req.max_steps > 25:
        raise HTTPException(400, "max_steps cannot exceed 25")

    result = await run_browser_agent(
        goal=req.goal,
        start_url=req.start_url,
        max_steps=req.max_steps,
        api_key=api_key,
        nim_base=nim_base,
        auth_profile=req.auth_profile,
    )
    return result


@router.post("/browser/scrape")
async def browser_scrape(req: BrowserScrapeRequest):
    """Quick scrape: navigate to URL and extract content using Playwright."""
    from services.browser_agent import BrowserSession
    import uuid

    session = BrowserSession(str(uuid.uuid4())[:8])
    try:
        await session.start()
        await session.navigate(req.url)
        obs = await session.observe()
        text = await session.get_text(req.extract_selector)
        screenshot_b64 = await session.screenshot()
        return {
            "url": obs["url"],
            "title": obs["title"],
            "text": text[:10000],
            "interactables_count": len(obs["interactables"]),
            "screenshot_b64": screenshot_b64[:100] + "..." if screenshot_b64 else None,
            "page_summary": obs["page_summary"],
        }
    finally:
        await session.close()
