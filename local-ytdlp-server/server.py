#!/usr/bin/env python3
"""
Local yt-dlp audio proxy — runs on your laptop.
Expose via cloudflared:  cloudflared tunnel run yt-local

iOS Safari REQUIRES:
  1. Content-Length header
  2. Accept-Ranges: bytes
  3. Proper 206 Partial Content for Range requests
Without these, background audio playback silently fails.

Install:  pip install fastapi uvicorn yt-dlp httpx
Run:      python server.py
"""
import asyncio
import json
import logging
import os
import re
import tempfile
import time
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
import httpx

app = FastAPI(title="Nexus YT Local")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Length", "Content-Type", "Accept-Ranges", "Content-Range"],
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [yt-local] %(message)s")
log = logging.getLogger("yt-local")

# ── Cache ──
_meta_cache: dict[str, dict] = {}
META_TTL = 3500          # ~58 min for YouTube URL validity
FILE_TTL = 8 * 3600      # 8 hours for downloaded files (audio doesn't change)

CACHE_DIR = Path(tempfile.gettempdir()) / "yt-local-cache"
CACHE_DIR.mkdir(exist_ok=True)

# ── Per-video download locks — prevent duplicate parallel downloads ──
_download_locks: dict[str, asyncio.Lock] = {}


def _get_lock(video_id: str) -> asyncio.Lock:
    if video_id not in _download_locks:
        _download_locks[video_id] = asyncio.Lock()
    return _download_locks[video_id]


def _extract_sync(video_id: str) -> dict:
    """Synchronous yt-dlp extraction — MUST run in executor."""
    import yt_dlp
    url = f"https://www.youtube.com/watch?v={video_id}"
    opts = {
        "format": "bestaudio[ext=m4a]/bestaudio/best",
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "socket_timeout": 15,
    }
    with yt_dlp.YoutubeDL(opts) as ydl:
        info = ydl.extract_info(url, download=False)
    audio_url = info.get("url", "")
    if not audio_url:
        for f in info.get("requested_formats", []):
            if f.get("acodec") != "none":
                audio_url = f.get("url", "")
                break
    return {
        "url": audio_url,
        "ext": info.get("ext", "m4a"),
        "title": info.get("title", ""),
        "duration": info.get("duration", 0),
        "channel": info.get("channel", info.get("uploader", "")),
        "thumbnail": info.get("thumbnail", ""),
        "filesize": info.get("filesize") or info.get("filesize_approx", 0),
    }


async def _get_meta(video_id: str) -> dict:
    """Get metadata (cached). Runs yt-dlp in executor if needed."""
    cached = _meta_cache.get(video_id)
    if cached and time.time() < cached["_expires"]:
        return cached
    loop = asyncio.get_event_loop()
    info = await loop.run_in_executor(None, _extract_sync, video_id)
    if not info["url"]:
        raise HTTPException(404, "No audio URL found")
    entry = {**info, "_expires": time.time() + META_TTL}
    _meta_cache[video_id] = entry
    return entry


def _download_sync(audio_url: str, fp: Path) -> bool:
    """Synchronous file download — MUST run in executor."""
    tmp = fp.with_suffix(".tmp")
    try:
        with httpx.Client(
            timeout=httpx.Timeout(15, read=120, write=30, pool=15),
            follow_redirects=True,
            limits=httpx.Limits(max_connections=5),
        ) as client:
            with client.stream("GET", audio_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Referer": "https://www.youtube.com/",
            }) as resp:
                resp.raise_for_status()
                total = 0
                with open(tmp, "wb") as f:
                    for chunk in resp.iter_bytes(131072):
                        f.write(chunk)
                        total += len(chunk)
        if total < 10000:
            log.warning("Download too small (%d bytes), discarding", total)
            tmp.unlink(missing_ok=True)
            return False
        # Atomic rename — prevents serving half-written files
        tmp.rename(fp)
        log.info("Downloaded → %s (%d KB)", fp.name, total // 1024)
        return True
    except Exception as exc:
        log.error("Download failed: %s", exc)
        tmp.unlink(missing_ok=True)
        return False


async def _ensure_file(video_id: str) -> Path:
    """Return path to cached audio file, downloading if needed. Uses per-video lock."""
    fp = CACHE_DIR / f"{video_id}.m4a"

    # Fast path: file already cached and fresh
    if fp.exists() and fp.stat().st_size > 10000:
        age = time.time() - fp.stat().st_mtime
        if age < FILE_TTL:
            return fp

    # Acquire per-video lock so only one download happens at a time
    lock = _get_lock(video_id)
    async with lock:
        # Re-check after acquiring lock (another request may have downloaded it)
        if fp.exists() and fp.stat().st_size > 10000:
            age = time.time() - fp.stat().st_mtime
            if age < FILE_TTL:
                return fp

        # Need to download
        meta = await _get_meta(video_id)
        audio_url = meta["url"]
        log.info("Downloading %s ...", video_id)
        loop = asyncio.get_event_loop()
        ok = await loop.run_in_executor(None, _download_sync, audio_url, fp)
        if not ok:
            # Retry with fresh URL (meta may have been stale)
            if video_id in _meta_cache:
                del _meta_cache[video_id]
            meta = await _get_meta(video_id)
            ok = await loop.run_in_executor(None, _download_sync, meta["url"], fp)
        if not ok:
            raise HTTPException(502, "Audio download failed — try again")
        return fp


# ═══════════════════════════════════════════════════════════════════
#  ENDPOINTS
# ═══════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {"status": "ok", "service": "nexus-yt-local", "cache_dir": str(CACHE_DIR)}


@app.get("/info/{video_id}")
async def get_info(video_id: str):
    """Fast metadata only — no download. Responds in 3-5s."""
    if not re.match(r"^[A-Za-z0-9_-]{11}$", video_id):
        raise HTTPException(400, "Invalid video ID")
    meta = await _get_meta(video_id)
    fp = CACHE_DIR / f"{video_id}.m4a"
    cached = fp.exists() and fp.stat().st_size > 10000
    return {
        "title": meta["title"],
        "channel": meta["channel"],
        "duration": meta["duration"],
        "thumbnail": meta["thumbnail"],
        "ext": meta["ext"],
        "video_id": video_id,
        "ready": cached,
        "size_kb": fp.stat().st_size // 1024 if cached else 0,
    }


@app.get("/prepare/{video_id}")
async def prepare_audio(video_id: str):
    """Download audio file and return when ready. Frontend waits on this."""
    if not re.match(r"^[A-Za-z0-9_-]{11}$", video_id):
        raise HTTPException(400, "Invalid video ID")
    fp = await _ensure_file(video_id)
    return {
        "status": "ready",
        "video_id": video_id,
        "size_kb": fp.stat().st_size // 1024,
    }


@app.get("/stream/{video_id}")
async def stream_audio(video_id: str, request: Request):
    """
    Serve cached audio file with Range support.
    If file not cached, return 202 to tell frontend to call /prepare first.
    """
    if not re.match(r"^[A-Za-z0-9_-]{11}$", video_id):
        raise HTTPException(400, "Invalid video ID")

    fp = CACHE_DIR / f"{video_id}.m4a"
    if not fp.exists() or fp.stat().st_size < 10000:
        return Response(
            content=json.dumps({"status": "not_ready", "hint": "Call /prepare/{video_id} first"}),
            status_code=202,
            media_type="application/json",
        )
    file_size = fp.stat().st_size
    if file_size == 0:
        raise HTTPException(502, "Audio file is empty")
    mime = "audio/mp4"

    range_header = request.headers.get("range")

    if range_header:
        m = re.match(r"bytes=(\d+)-(\d*)", range_header)
        if not m:
            raise HTTPException(416, "Invalid range")
        start = int(m.group(1))
        end = int(m.group(2)) if m.group(2) else file_size - 1
        end = min(end, file_size - 1)
        if start >= file_size:
            raise HTTPException(416, "Range out of bounds")
        length = end - start + 1

        with open(fp, "rb") as f:
            f.seek(start)
            body = f.read(length)

        return Response(
            content=body,
            status_code=206,
            media_type=mime,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Content-Length": str(length),
                "Accept-Ranges": "bytes",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=7200",
            },
        )
    else:
        body = fp.read_bytes()
        return Response(
            content=body,
            media_type=mime,
            headers={
                "Content-Length": str(file_size),
                "Accept-Ranges": "bytes",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=7200",
            },
        )


@app.get("/search")
async def search_youtube(q: str, max_results: int = 15):
    """Search YouTube via yt-dlp — no API key needed."""
    if not q or not q.strip():
        raise HTTPException(400, "Empty query")
    import json as _json
    loop = asyncio.get_event_loop()

    def _search_sync():
        import yt_dlp
        results = []
        opts = {
            "quiet": True,
            "no_warnings": True,
            "extract_flat": True,
            "noplaylist": True,
            "socket_timeout": 15,
        }
        with yt_dlp.YoutubeDL(opts) as ydl:
            data = ydl.extract_info(f"ytsearch{max_results}:{q.strip()}", download=False)
        for entry in (data or {}).get("entries", []):
            if not entry:
                continue
            vid = entry.get("id", "")
            dur = entry.get("duration") or 0
            minutes = int(dur) // 60
            seconds = int(dur) % 60
            thumb = entry.get("thumbnail", "")
            if not thumb:
                thumbs = entry.get("thumbnails", [])
                thumb = thumbs[-1].get("url", "") if thumbs else ""
            results.append({
                "video_id": vid,
                "title": entry.get("title", "Unknown"),
                "channel": entry.get("channel", entry.get("uploader", "Unknown")),
                "duration": f"{minutes}:{seconds:02d}" if dur else "",
                "thumbnail": thumb,
                "tags": (entry.get("tags") or [])[:10],
            })
        return results

    try:
        results = await loop.run_in_executor(None, _search_sync)
        log.info("Search '%s' → %d results", q.strip(), len(results))
        return {"results": results, "source": "ytdlp-local"}
    except Exception as exc:
        log.error("Search failed: %s", exc)
        raise HTTPException(502, f"Search failed: {exc}")


# ── Cleanup stale cache on startup ──
@app.on_event("startup")
async def _cleanup_cache():
    now = time.time()
    removed = 0
    for f in CACHE_DIR.glob("*.m4a"):
        if now - f.stat().st_mtime > FILE_TTL:
            f.unlink(missing_ok=True)
            removed += 1
    if removed:
        log.info("Cleaned %d stale cache files", removed)


def _kill_existing_on_port(port: int):
    """Kill any process already listening on the given port (Windows)."""
    import subprocess, sys
    if sys.platform != "win32":
        return
    try:
        result = subprocess.run(
            ["netstat", "-ano"], capture_output=True, text=True, timeout=5
        )
        for line in result.stdout.splitlines():
            if f":{port}" in line and "LISTENING" in line:
                parts = line.split()
                pid = int(parts[-1])
                if pid > 0:
                    print(f"  Killing old process on port {port} (PID {pid})...")
                    subprocess.run(["taskkill", "/F", "/PID", str(pid)],
                                   capture_output=True, timeout=5)
                    import time; time.sleep(1)
                    break
    except Exception as exc:
        print(f"  Warning: Could not check port {port}: {exc}")


if __name__ == "__main__":
    import uvicorn
    PORT = 8765
    _kill_existing_on_port(PORT)
    print("\n  Nexus YT Local Server")
    print(f"  http://localhost:{PORT}")
    print(f"  Cache dir: {CACHE_DIR}")
    print("  Expose with: cloudflared tunnel run yt-local\n")
    uvicorn.run(app, host="0.0.0.0", port=PORT, timeout_keep_alive=120)
