"""
YouTube Music Router — hybrid YouTube Data API v3 + yt-dlp backend.

Architecture:
  • Search: YouTube API (fast, <200ms) → permanent cache → yt-dlp fallback
  • Play:   yt-dlp audio URL extraction (cached 1h)
  • Snippet: yt-dlp worst-quality video URL for 5s hover preview
  • Related: YouTube API search by tags/channel → DB affinity → yt-dlp fallback
  • Keys:   Multi-key rotation with quota-exceeded auto-switch

Endpoints:
  POST /youtube/search    — Fast search via API, cached
  POST /youtube/play      — Get streamable audio URL (yt-dlp)
  POST /youtube/snippet   — Get low-quality video preview URL (yt-dlp)
  POST /youtube/related   — Recommendations (API tags + affinity)
  POST /youtube/affinity  — Track user listening behavior
  GET  /youtube/status    — Health check
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import re
import shutil
import sys
import time
from collections import defaultdict

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List

logger = logging.getLogger("youtube_router")
router = APIRouter(prefix="/youtube", tags=["youtube"])

# ── Local yt-dlp proxy (Cloudflare tunnel to your machine) ──
YT_LOCAL_PROXY = os.getenv("YT_LOCAL_PROXY_URL", "").strip().rstrip("/")
# e.g. "https://yt.aura-ai.live"

# Resolve yt-dlp: prefer CLI binary, fall back to python -m yt_dlp
_ytdlp_cli = shutil.which("yt-dlp")
if _ytdlp_cli:
    YTDLP_CMD = [_ytdlp_cli]
else:
    # yt-dlp installed as Python package — invoke via module
    YTDLP_CMD = [sys.executable, "-m", "yt_dlp"]

# ══════════════════════════════════════════════════════════════
#  YouTube API Key Manager — multi-key rotation + quota guard
# ══════════════════════════════════════════════════════════════

YT_API_KEYS: list[str] = [
    k.strip() for k in os.environ.get("YT_API_KEYS", "").split(",") if k.strip()
]
_current_key_idx = 0
_exhausted_keys: set[int] = set()
_api_mode = True  # False = emergency yt-dlp-only mode

YT_API_BASE = "https://www.googleapis.com/youtube/v3"
_http_client: httpx.AsyncClient | None = None


def _get_http() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(timeout=10)
    return _http_client


def _get_api_key() -> str | None:
    """Return the current active API key, or None if all exhausted."""
    global _current_key_idx
    if len(_exhausted_keys) >= len(YT_API_KEYS):
        return None
    while _current_key_idx in _exhausted_keys:
        _current_key_idx = (_current_key_idx + 1) % len(YT_API_KEYS)
    return YT_API_KEYS[_current_key_idx]


def _rotate_key():
    """Mark current key as exhausted and switch to next."""
    global _current_key_idx
    _exhausted_keys.add(_current_key_idx)
    _current_key_idx = (_current_key_idx + 1) % len(YT_API_KEYS)
    if len(_exhausted_keys) >= len(YT_API_KEYS):
        global _api_mode
        _api_mode = False
        logger.warning("All API keys exhausted — switching to yt-dlp emergency mode")


async def _yt_api_get(path: str, params: dict, retry: bool = True) -> dict | None:
    """Make a YouTube API GET request with key rotation."""
    key = _get_api_key()
    if not key:
        return None
    params["key"] = key
    try:
        r = await _get_http().get(f"{YT_API_BASE}/{path}", params=params)
        if r.status_code == 200:
            return r.json()
        if r.status_code == 403:
            body = r.json()
            errors = body.get("error", {}).get("errors", [])
            if any(e.get("reason") == "quotaExceeded" for e in errors):
                logger.warning("Quota exceeded for key %d, rotating", _current_key_idx)
                _rotate_key()
                if retry and _get_api_key():
                    return await _yt_api_get(path, {k: v for k, v in params.items() if k != "key"}, retry=False)
        logger.warning("YT API %s returned %d: %s", path, r.status_code, r.text[:200])
    except Exception as e:
        logger.warning("YT API request failed: %s", e)
    return None


# ══════════════════════════════════════════════════════════════
#  Caches — search results (permanent), audio URLs (1h TTL),
#  video metadata/tags (permanent)
# ══════════════════════════════════════════════════════════════

_search_cache: dict[str, tuple[list, float]] = {}  # query_hash → (results, timestamp)
_url_cache: dict[str, tuple[dict, float]] = {}      # video_id → (play_data, timestamp)
_snippet_cache: dict[str, tuple[str, float]] = {}   # video_id → (snippet_url, timestamp)
_meta_cache: dict[str, dict] = {}                    # video_id → {tags, categoryId, channel, ...}
_CACHE_TTL = 3600       # 1 hour for stream URLs
_SEARCH_CACHE_TTL = 86400  # 24 hours for search results


def _hash_query(q: str) -> str:
    return hashlib.md5(q.strip().lower().encode()).hexdigest()


def _cache_get(cache: dict, key: str, ttl: int = _CACHE_TTL):
    if key in cache:
        data, ts = cache[key]
        if time.time() - ts < ttl:
            return data
        del cache[key]
    return None


def _cache_set(cache: dict, key: str, data, max_size: int = 500):
    cache[key] = (data, time.time())
    if len(cache) > max_size:
        oldest = sorted(cache, key=lambda k: cache[k][1] if isinstance(cache[k], tuple) else 0)[:50]
        for k in oldest:
            cache.pop(k, None)


# ══════════════════════════════════════════════════════════════
#  User Affinity — in-memory per-user listening stats
# ══════════════════════════════════════════════════════════════

# user_id → { video_id: {plays, skips, tags[], channel} }
_user_affinity: dict[str, dict[str, dict]] = defaultdict(dict)


def _record_affinity(user_id: str, video_id: str, action: str, meta: dict = {}):
    """Track user listening: 'play', 'finish', 'skip'."""
    if not user_id:
        return
    entry = _user_affinity[user_id].setdefault(video_id, {
        "plays": 0, "finishes": 0, "skips": 0,
        "tags": meta.get("tags", []),
        "channel": meta.get("channel", ""),
        "title": meta.get("title", ""),
    })
    if action == "play":
        entry["plays"] += 1
    elif action == "finish":
        entry["finishes"] += 1
    elif action == "skip":
        entry["skips"] += 1
    # Update tags if provided
    if meta.get("tags"):
        entry["tags"] = list(set(entry["tags"] + meta["tags"]))


def _get_user_favorites(user_id: str, limit: int = 5) -> list[dict]:
    """Get user's top tracks by (finishes - skips) for injection into Up Next."""
    if user_id not in _user_affinity:
        return []
    items = _user_affinity[user_id]
    scored = [(vid, d["finishes"] - d["skips"]) for vid, d in items.items()]
    scored.sort(key=lambda x: -x[1])
    return [{"video_id": vid, "title": items[vid]["title"], "channel": items[vid]["channel"]}
            for vid, score in scored[:limit] if score > 0]


# ══════════════════════════════════════════════════════════════
#  yt-dlp helper
# ══════════════════════════════════════════════════════════════

async def _run_ytdlp(*args: str, timeout: int = 30) -> str:
    cmd = [*YTDLP_CMD, *args]
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    if proc.returncode != 0:
        err = stderr.decode(errors="replace")[:300]
        logger.warning("yt-dlp error: %s", err)
        raise HTTPException(502, f"yt-dlp error: {err[:200]}")
    return stdout.decode(errors="replace")


# ══════════════════════════════════════════════════════════════
#  Models
# ══════════════════════════════════════════════════════════════

class SearchRequest(BaseModel):
    query: str
    max_results: int = 10

class PlayRequest(BaseModel):
    video_id: str
    audio_only: bool = True

class SnippetRequest(BaseModel):
    video_id: str

class RelatedRequest(BaseModel):
    video_id: str
    max_results: int = 12
    user_id: str = ""

class AffinityRequest(BaseModel):
    user_id: str
    video_id: str
    action: str  # "play", "finish", "skip"
    tags: list[str] = []
    channel: str = ""
    title: str = ""

class SearchResult(BaseModel):
    video_id: str
    title: str
    channel: str
    duration: str
    thumbnail: str
    tags: list[str] = []


# ══════════════════════════════════════════════════════════════
#  SEARCH — YouTube API first → cache → yt-dlp fallback
# ══════════════════════════════════════════════════════════════

def _api_item_to_result(item: dict) -> SearchResult:
    """Convert a YouTube API search/video item to SearchResult."""
    snippet = item.get("snippet", {})
    vid = item.get("id", {})
    video_id = vid.get("videoId", "") if isinstance(vid, dict) else str(vid)
    # Duration from contentDetails (if available)
    dur_str = item.get("contentDetails", {}).get("duration", "")
    dur_display = ""
    if dur_str:
        # Parse ISO 8601 duration like PT4M33S
        import re as _re
        m = _re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', dur_str)
        if m:
            h, mi, s = int(m.group(1) or 0), int(m.group(2) or 0), int(m.group(3) or 0)
            dur_display = f"{h}:{mi:02d}:{s:02d}" if h else f"{mi}:{s:02d}"
    thumb = snippet.get("thumbnails", {}).get("high", {}).get("url", "")
    if not thumb:
        thumb = snippet.get("thumbnails", {}).get("medium", {}).get("url", "")
    if not thumb:
        thumb = snippet.get("thumbnails", {}).get("default", {}).get("url", "")
    tags = item.get("tags", snippet.get("tags", []))
    return SearchResult(
        video_id=video_id,
        title=snippet.get("title", "Unknown"),
        channel=snippet.get("channelTitle", "Unknown"),
        duration=dur_display,
        thumbnail=thumb,
        tags=tags[:10] if tags else [],
    )


def _ytdlp_to_result(j: dict) -> SearchResult | None:
    vid = j.get("id", "")
    if not vid:
        return None
    dur = j.get("duration") or 0
    minutes = int(dur) // 60
    seconds = int(dur) % 60
    tags = j.get("tags", [])[:10]
    return SearchResult(
        video_id=vid,
        title=j.get("title", "Unknown"),
        channel=j.get("channel", j.get("uploader", "Unknown")),
        duration=f"{minutes}:{seconds:02d}",
        thumbnail=j.get("thumbnail", j.get("thumbnails", [{}])[-1].get("url", "")),
        tags=tags,
    )


@router.post("/search")
async def youtube_search(req: SearchRequest):
    """Search YouTube — API first (fast), then yt-dlp fallback."""
    query = req.query.strip()
    if not query:
        raise HTTPException(400, "Empty query")

    qhash = _hash_query(query)

    # 1) Check permanent search cache
    cached = _cache_get(_search_cache, qhash, _SEARCH_CACHE_TTL)
    if cached:
        logger.info("Search cache hit: %s", query)
        return {"results": cached, "source": "cache"}

    # 2) Try YouTube API (fast)
    if _api_mode:
        data = await _yt_api_get("search", {
            "part": "snippet",
            "type": "video",
            "videoCategoryId": "10",  # Music
            "q": query,
            "maxResults": req.max_results,
            "fields": "items(id/videoId,snippet/title,snippet/channelTitle,snippet/thumbnails/high/url,snippet/thumbnails/medium/url)",
        })
        if data and "items" in data:
            results = [_api_item_to_result(item).dict() for item in data["items"]]
            # Batch fetch durations + tags
            video_ids = [r["video_id"] for r in results if r["video_id"]]
            if video_ids:
                details = await _yt_api_get("videos", {
                    "part": "contentDetails,snippet",
                    "id": ",".join(video_ids),
                    "fields": "items(id,contentDetails/duration,snippet/tags,snippet/categoryId)",
                })
                if details and "items" in details:
                    detail_map = {}
                    for item in details["items"]:
                        vid = item.get("id", "")
                        dur_str = item.get("contentDetails", {}).get("duration", "")
                        tags = item.get("snippet", {}).get("tags", [])[:10]
                        cat = item.get("snippet", {}).get("categoryId", "")
                        dur_display = ""
                        if dur_str:
                            m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', dur_str)
                            if m:
                                h, mi, s = int(m.group(1) or 0), int(m.group(2) or 0), int(m.group(3) or 0)
                                dur_display = f"{h}:{mi:02d}:{s:02d}" if h else f"{mi}:{s:02d}"
                        detail_map[vid] = {"duration": dur_display, "tags": tags, "categoryId": cat}
                        # Cache metadata for recommendations
                        _meta_cache[vid] = {"tags": tags, "categoryId": cat, "channel": "", "title": ""}
                    for r in results:
                        d = detail_map.get(r["video_id"], {})
                        if d.get("duration"):
                            r["duration"] = d["duration"]
                        if d.get("tags"):
                            r["tags"] = d["tags"]

            _cache_set(_search_cache, qhash, results, max_size=1000)
            return {"results": results, "source": "api"}

    # 3) Fallback: yt-dlp search
    logger.info("Using yt-dlp fallback for search: %s", query)
    try:
        raw = await _run_ytdlp(
            f"ytsearch{req.max_results}:{query}",
            "--dump-json", "--flat-playlist", "--no-download",
            "--no-warnings", "--no-playlist",
            "--extractor-args", "youtube:player_client=web",
            timeout=20,
        )
    except Exception:
        raise HTTPException(503, "Search failed — yt-dlp unavailable")

    results = []
    for line in raw.strip().split("\n"):
        if not line.strip():
            continue
        try:
            r = _ytdlp_to_result(json.loads(line))
            if r:
                results.append(r.dict())
        except Exception:
            continue

    if results:
        _cache_set(_search_cache, qhash, results, max_size=1000)
    return {"results": results, "source": "ytdlp"}


# ══════════════════════════════════════════════════════════════
#  PLAY — yt-dlp audio URL extraction (cached 1h)
# ══════════════════════════════════════════════════════════════

def _extract_with_ytdlp_lib(url: str, audio_only: bool = True) -> dict:
    """Use yt-dlp as a Python library.

    Tries multiple player clients to bypass YouTube bot detection on
    cloud server IPs (Render, Railway, etc.).
    """
    import yt_dlp
    fmt = "bestaudio[ext=m4a]/bestaudio/best" if audio_only else "best"

    # Player clients to try, in order of reliability on cloud servers
    client_chains = [
        ["android_music", "android"],
        ["tv_embedded", "android"],
        ["ios", "android"],
        ["default"],
    ]

    last_err = None
    for clients in client_chains:
        opts = {
            "format": fmt,
            "noplaylist": True,
            "no_warnings": True,
            "quiet": True,
            "extract_flat": False,
            "extractor_args": {"youtube": {"player_client": clients}},
            "http_headers": {
                "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36",
            },
        }
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=False)
            if info and info.get("url"):
                return info
            # For merged formats, check requested_formats
            if info and info.get("requested_formats"):
                return info
            if info:
                return info
        except Exception as e:
            last_err = e
            logger.warning("yt-dlp client %s failed: %s", clients, str(e)[:120])
            continue

    if last_err:
        raise last_err
    return {}


# ── Piped API fallback (public YouTube proxy) ────────────────
PIPED_INSTANCES = [
    "https://pipedapi.kavin.rocks",
    "https://pipedapi.adminforge.de",
    "https://pipedapi.in.projectsegfau.lt",
]

async def _extract_with_piped(vid: str) -> dict:
    """Fallback: use Piped public API when yt-dlp is blocked."""
    for base in PIPED_INSTANCES:
        try:
            async with httpx.AsyncClient(timeout=20) as client:
                r = await client.get(f"{base}/streams/{vid}")
                if r.status_code != 200:
                    continue
                data = r.json()
                # Pick best audio stream (prefer m4a/mp4)
                streams = data.get("audioStreams", [])
                if not streams:
                    continue
                # Sort: prefer m4a, then by bitrate descending
                def score(s):
                    mime = s.get("mimeType", "")
                    br = s.get("bitrate", 0)
                    is_m4a = 1 if "mp4a" in mime or "m4a" in mime or "mp4" in mime else 0
                    return (is_m4a, br)
                streams.sort(key=score, reverse=True)
                best = streams[0]
                audio_url = best.get("url", "")
                if not audio_url:
                    continue
                ext = "m4a" if "mp4" in best.get("mimeType", "") else "webm"
                return {
                    "audio_url": audio_url,
                    "title": data.get("title", ""),
                    "channel": data.get("uploader", ""),
                    "duration": data.get("duration", 0),
                    "thumbnail": data.get("thumbnailUrl", ""),
                    "video_id": vid,
                    "tags": [],
                    "ext": ext,
                    "source": "piped",
                }
        except Exception as e:
            logger.warning("Piped %s failed: %s", base, str(e)[:80])
            continue
    return {}


async def _extract_via_local_proxy(vid: str) -> dict | None:
    """Try extracting audio via the local yt-dlp proxy (your PC via tunnel)."""
    if not YT_LOCAL_PROXY:
        return None
    try:
        async with httpx.AsyncClient(timeout=25) as client:
            r = await client.get(f"{YT_LOCAL_PROXY}/info/{vid}")
            if r.status_code != 200:
                logger.warning("Local proxy info %d for %s", r.status_code, vid)
                return None
            info = r.json()
            # Return stream URL pointing to local proxy (it handles caching + range)
            stream_url = f"{YT_LOCAL_PROXY}/stream/{vid}"
            return {
                "audio_url": stream_url,
                "title": info.get("title", ""),
                "channel": info.get("channel", ""),
                "duration": info.get("duration", 0),
                "thumbnail": info.get("thumbnail", ""),
                "video_id": vid,
                "tags": [],
                "ext": info.get("ext", "m4a"),
                "source": "local-proxy",
            }
    except Exception as e:
        logger.warning("Local proxy failed for %s: %s", vid, str(e)[:100])
        return None


@router.post("/play")
async def youtube_play(req: PlayRequest):
    """Get a direct audio stream URL for a YouTube video."""
    vid = req.video_id.strip()
    if not re.match(r'^[A-Za-z0-9_-]{11}$', vid):
        raise HTTPException(400, "Invalid video ID")

    cached = _cache_get(_url_cache, vid)
    if cached:
        logger.info("Play cache hit: %s", vid)
        return cached

    # ── Attempt 0: Local proxy (your PC via Cloudflare tunnel) ──
    local = await _extract_via_local_proxy(vid)
    if local:
        logger.info("Play via local proxy: %s", vid)
        _cache_set(_url_cache, vid, local)
        return local

    # ── Attempt 1: yt-dlp on server ────────────────────────────
    url = f"https://www.youtube.com/watch?v={vid}"
    audio_url = ""
    j = {}
    try:
        j = await asyncio.get_event_loop().run_in_executor(
            None, _extract_with_ytdlp_lib, url, req.audio_only
        )
        audio_url = j.get("url", "")
        if not audio_url:
            for fmt in j.get("requested_formats", []):
                if fmt.get("acodec") != "none":
                    audio_url = fmt.get("url", "")
                    break
    except Exception as e:
        logger.warning("yt-dlp failed for %s: %s", vid, str(e)[:120])

    # ── Attempt 2: Piped API fallback ────────────────────────
    if not audio_url:
        logger.info("Trying Piped fallback for %s", vid)
        piped = await _extract_with_piped(vid)
        if piped and piped.get("audio_url"):
            _cache_set(_url_cache, vid, piped)
            return piped

    if not audio_url:
        raise HTTPException(502, "All extraction methods failed — YouTube may be blocking this server")

    # Store tags in meta cache
    tags = j.get("tags", [])[:15] if j.get("tags") else []
    _meta_cache[vid] = {
        "tags": tags,
        "categoryId": j.get("categories", [""])[0] if j.get("categories") else "",
        "channel": j.get("channel", j.get("uploader", "")),
        "title": j.get("title", ""),
    }

    result = {
        "audio_url": audio_url,
        "title": j.get("title", ""),
        "channel": j.get("channel", j.get("uploader", "")),
        "duration": j.get("duration", 0),
        "thumbnail": j.get("thumbnail", ""),
        "video_id": vid,
        "tags": tags,
        "ext": j.get("ext", "m4a"),
    }
    _cache_set(_url_cache, vid, result)
    return result


# ══════════════════════════════════════════════════════════════
#  STREAM — proxy audio through backend (bypasses CORS)
# ══════════════════════════════════════════════════════════════

@router.get("/stream/{video_id}")
async def youtube_stream(video_id: str):
    """Proxy audio stream through backend to bypass browser CORS restrictions."""
    vid = video_id.strip()
    if not re.match(r'^[A-Za-z0-9_-]{11}$', vid):
        raise HTTPException(400, "Invalid video ID")

    # ── Local proxy: redirect stream directly ──
    cached = _cache_get(_url_cache, vid)
    if cached and cached.get("source") == "local-proxy":
        # Redirect to local proxy stream
        from starlette.responses import RedirectResponse
        return RedirectResponse(f"{YT_LOCAL_PROXY}/stream/{vid}", status_code=307)

    if not cached and YT_LOCAL_PROXY:
        local = await _extract_via_local_proxy(vid)
        if local:
            _cache_set(_url_cache, vid, local)
            from starlette.responses import RedirectResponse
            return RedirectResponse(f"{YT_LOCAL_PROXY}/stream/{vid}", status_code=307)

    # Reuse cached audio URL from /play endpoint, or extract fresh
    if cached:
        audio_url = cached.get("audio_url", "")
    else:
        url = f"https://www.youtube.com/watch?v={vid}"
        audio_url = ""
        j = {}
        try:
            j = await asyncio.get_event_loop().run_in_executor(
                None, _extract_with_ytdlp_lib, url, True
            )
            audio_url = j.get("url", "")
            if not audio_url:
                for fmt in j.get("requested_formats", []):
                    if fmt.get("acodec") != "none":
                        audio_url = fmt.get("url", "")
                        break
        except Exception as e:
            logger.warning("Stream yt-dlp failed: %s", str(e)[:120])
        # Piped fallback
        if not audio_url:
            piped = await _extract_with_piped(vid)
            if piped and piped.get("audio_url"):
                audio_url = piped["audio_url"]
                _cache_set(_url_cache, vid, piped)
        if not audio_url:
            raise HTTPException(502, "All extraction methods failed")
        if not cached:
            result = {
                "audio_url": audio_url,
                "title": j.get("title", ""),
                "channel": j.get("channel", j.get("uploader", "")),
                "duration": j.get("duration", 0),
                "thumbnail": j.get("thumbnail", ""),
                "video_id": vid,
                "tags": j.get("tags", [])[:15] if j.get("tags") else [],
            }
            _cache_set(_url_cache, vid, result)

    if not audio_url:
        raise HTTPException(404, "No audio URL available")

    # Stream the audio through the backend
    async def _proxy():
        async with httpx.AsyncClient(timeout=httpx.Timeout(10, read=300)) as client:
            async with client.stream("GET", audio_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Referer": "https://www.youtube.com/",
                "Origin": "https://www.youtube.com",
            }) as resp:
                async for chunk in resp.aiter_bytes(chunk_size=65536):
                    yield chunk

    # Detect MIME type from cached format info or URL
    mime = "audio/mp4"
    if cached:
        ext = cached.get("ext", "")
        if ext == "webm":
            mime = "audio/webm"
        elif ext == "opus":
            mime = "audio/ogg"
    elif ".webm" in audio_url:
        mime = "audio/webm"

    return StreamingResponse(
        _proxy(),
        media_type=mime,
        headers={
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
        },
    )


# ══════════════════════════════════════════════════════════════
#  SNIPPET — low-quality video URL for 5s hover preview
# ══════════════════════════════════════════════════════════════

@router.post("/snippet")
async def youtube_snippet(req: SnippetRequest):
    """Get the worst-quality video stream URL for hover preview."""
    vid = req.video_id.strip()
    if not re.match(r'^[A-Za-z0-9_-]{11}$', vid):
        raise HTTPException(400, "Invalid video ID")

    cached = _cache_get(_snippet_cache, vid)
    if cached:
        return {"snippet_url": cached, "video_id": vid}

    url = f"https://www.youtube.com/watch?v={vid}"
    try:
        raw = await _run_ytdlp(
            url, "--get-url", "-f", "worst[ext=mp4]/worstvideo[ext=mp4]/worst",
            "--no-warnings", "--no-playlist",
            timeout=15,
        )
        snippet_url = raw.strip().split("\n")[0].strip()
        if snippet_url and snippet_url.startswith("http"):
            _cache_set(_snippet_cache, vid, snippet_url)
            return {"snippet_url": snippet_url, "video_id": vid}
    except Exception as e:
        logger.warning("Snippet fetch failed for %s: %s", vid, e)

    raise HTTPException(404, "No video preview available")


# ══════════════════════════════════════════════════════════════
#  RELATED — tag-based + API search + user affinity injection
# ══════════════════════════════════════════════════════════════

@router.post("/related")
async def youtube_related(req: RelatedRequest):
    """Smart recommendations: API search by tags/channel + affinity injection."""
    vid = req.video_id.strip()
    if not re.match(r'^[A-Za-z0-9_-]{11}$', vid):
        raise HTTPException(400, "Invalid video ID")

    results: list[dict] = []
    seen_ids = {vid}
    meta = _meta_cache.get(vid, {})

    # 1) Search by tags/channel via API
    if _api_mode and meta:
        tags = meta.get("tags", [])
        channel = meta.get("channel", "")
        title = meta.get("title", "")
        # Build a smart query from tags + channel
        query_parts = []
        if channel:
            query_parts.append(channel)
        if tags:
            query_parts.extend(tags[:3])
        elif title:
            # Strip parenthetical info from title
            clean_title = re.sub(r'[\(\[\{].*?[\)\]\}]', '', title).strip()
            query_parts.append(clean_title[:40])

        search_q = " ".join(query_parts)[:80]
        if search_q.strip():
            data = await _yt_api_get("search", {
                "part": "snippet",
                "type": "video",
                "videoCategoryId": "10",
                "q": search_q,
                "maxResults": req.max_results + 5,
                "fields": "items(id/videoId,snippet/title,snippet/channelTitle,snippet/thumbnails/high/url,snippet/thumbnails/medium/url)",
            })
            if data and "items" in data:
                for item in data["items"]:
                    r = _api_item_to_result(item)
                    if r.video_id and r.video_id not in seen_ids:
                        seen_ids.add(r.video_id)
                        results.append(r.dict())

    # 2) Inject user favorites every ~4 tracks (the "Supermix" feel)
    if req.user_id:
        favs = _get_user_favorites(req.user_id, limit=3)
        inject_positions = [3, 7, 11]
        for i, fav in enumerate(favs):
            if fav["video_id"] not in seen_ids:
                pos = inject_positions[i] if i < len(inject_positions) else len(results)
                pos = min(pos, len(results))
                results.insert(pos, {
                    "video_id": fav["video_id"],
                    "title": fav["title"],
                    "channel": fav["channel"],
                    "duration": "",
                    "thumbnail": f"https://i.ytimg.com/vi/{fav['video_id']}/hqdefault.jpg",
                    "tags": [],
                })
                seen_ids.add(fav["video_id"])

    # 3) Fallback: yt-dlp search if we still have no results
    if not results:
        title = meta.get("title", "")
        channel = meta.get("channel", "")
        fallback_q = f"{channel} {title.split('(')[0].strip()}"[:60] if (title or channel) else ""
        if not fallback_q:
            # Try to get info from yt-dlp
            try:
                raw = await _run_ytdlp(
                    f"https://www.youtube.com/watch?v={vid}",
                    "--dump-json", "--no-download", "--no-warnings",
                    "--no-playlist", "--extractor-args", "youtube:player_client=web",
                    timeout=15,
                )
                j = json.loads(raw.strip().split("\n")[0])
                fallback_q = f"{j.get('channel', '')} {j.get('title', '').split('(')[0].strip()}"[:60]
                _meta_cache[vid] = {
                    "tags": j.get("tags", [])[:15],
                    "categoryId": "",
                    "channel": j.get("channel", ""),
                    "title": j.get("title", ""),
                }
            except Exception:
                pass

        if fallback_q.strip():
            try:
                raw2 = await _run_ytdlp(
                    f"ytsearch{req.max_results}:{fallback_q}",
                    "--dump-json", "--flat-playlist", "--no-download",
                    "--no-warnings", "--no-playlist",
                    "--extractor-args", "youtube:player_client=web",
                    timeout=15,
                )
                for line in raw2.strip().split("\n"):
                    if not line.strip():
                        continue
                    try:
                        r = _ytdlp_to_result(json.loads(line))
                        if r and r.video_id not in seen_ids:
                            seen_ids.add(r.video_id)
                            results.append(r.dict())
                    except Exception:
                        continue
            except Exception:
                pass

    return {"results": results[:req.max_results]}


# ══════════════════════════════════════════════════════════════
#  AFFINITY — track user behavior for recommendations
# ══════════════════════════════════════════════════════════════

@router.post("/affinity")
async def youtube_affinity(req: AffinityRequest):
    """Record user listening behavior for recommendation engine."""
    _record_affinity(req.user_id, req.video_id, req.action, {
        "tags": req.tags,
        "channel": req.channel,
        "title": req.title,
    })
    return {"ok": True}


# ══════════════════════════════════════════════════════════════
#  STATUS
# ══════════════════════════════════════════════════════════════

@router.get("/status")
async def youtube_status():
    key = _get_api_key()
    return {
        "yt_dlp_installed": shutil.which("yt-dlp") is not None,
        "binary": YTDLP_BIN,
        "api_mode": _api_mode,
        "active_key_index": _current_key_idx,
        "exhausted_keys": len(_exhausted_keys),
        "total_keys": len(YT_API_KEYS),
        "search_cache_size": len(_search_cache),
        "url_cache_size": len(_url_cache),
        "local_proxy": YT_LOCAL_PROXY or None,
    }
