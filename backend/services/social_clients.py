"""
Social Media API Clients — ported from auto-browser.

Provides async clients for YouTube, Instagram, Reddit, and X (Twitter).
All credentials come from environment variables. Each client is
independently usable and designed to be called from routers or agents.

YouTube:  upload, Shorts, thumbnails, search, stats
Instagram: image posts, carousels, Reels
Reddit:   text posts, link posts, image posts, video posts
X/Twitter: tweets, threads, chunked media upload
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import mimetypes
import os
import time
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger("social_clients")


# ═══════════════════════════════════════════════════════════════════
# YouTube Data API v3
# ═══════════════════════════════════════════════════════════════════

_YT_API_BASE = "https://www.googleapis.com/youtube/v3"
_YT_UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3"
_YT_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token"
_YT_CHUNK_SIZE = 5 * 1024 * 1024  # 5 MB


class YouTubeClient:
    """YouTube Data API v3 client with OAuth2 token refresh."""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        refresh_token: str,
        access_token: str = "",
        token_expiry: float = 0.0,
    ) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._refresh_token = refresh_token
        self._access_token = access_token
        self._token_expiry = token_expiry

    @classmethod
    def from_env(cls) -> "YouTubeClient":
        return cls(
            client_id=os.environ["YOUTUBE_CLIENT_ID"],
            client_secret=os.environ["YOUTUBE_CLIENT_SECRET"],
            refresh_token=os.environ["YOUTUBE_REFRESH_TOKEN"],
        )

    async def _ensure_token(self) -> str:
        if self._access_token and time.time() < self._token_expiry - 60:
            return self._access_token
        async with httpx.AsyncClient() as client:
            resp = await client.post(_YT_OAUTH_TOKEN_URL, data={
                "client_id": self._client_id,
                "client_secret": self._client_secret,
                "refresh_token": self._refresh_token,
                "grant_type": "refresh_token",
            })
            resp.raise_for_status()
            data = resp.json()
            self._access_token = data["access_token"]
            self._token_expiry = time.time() + data.get("expires_in", 3600)
        return self._access_token

    async def _headers(self) -> dict[str, str]:
        token = await self._ensure_token()
        return {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    async def upload_video(
        self,
        file_path: str,
        title: str,
        description: str = "",
        tags: list[str] | None = None,
        category_id: str = "22",
        privacy: str = "public",
        is_short: bool = False,
    ) -> dict[str, Any]:
        """Resumable upload. Returns YouTube video resource (includes videoId)."""
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"Video file not found: {file_path}")

        file_size = path.stat().st_size
        mime_type = mimetypes.guess_type(str(path))[0] or "video/mp4"

        body = {
            "snippet": {
                "title": title[:100],
                "description": description[:5000],
                "tags": (tags or [])[:500],
                "categoryId": category_id,
            },
            "status": {"privacyStatus": privacy},
        }

        headers = await self._headers()
        headers["X-Upload-Content-Type"] = mime_type
        headers["X-Upload-Content-Length"] = str(file_size)
        headers["Content-Type"] = "application/json; charset=UTF-8"

        async with httpx.AsyncClient(timeout=30) as client:
            init_resp = await client.post(
                f"{_YT_UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status",
                headers=headers,
                content=json.dumps(body).encode(),
            )
            init_resp.raise_for_status()
            upload_url = init_resp.headers["Location"]

        video_resource = await self._upload_chunks(upload_url, path, file_size, mime_type)
        logger.info("youtube.upload: videoId=%s title=%r", video_resource.get("id"), title)
        return video_resource

    async def _upload_chunks(
        self, upload_url: str, path: Path, file_size: int, mime_type: str,
    ) -> dict[str, Any]:
        offset = 0
        async with httpx.AsyncClient(timeout=120) as client:
            with path.open("rb") as f:
                while offset < file_size:
                    chunk = f.read(_YT_CHUNK_SIZE)
                    end = offset + len(chunk) - 1
                    headers = {
                        "Content-Range": f"bytes {offset}-{end}/{file_size}",
                        "Content-Type": mime_type,
                    }
                    resp = await client.put(upload_url, headers=headers, content=chunk)
                    if resp.status_code in (200, 201):
                        return resp.json()
                    if resp.status_code == 308:
                        offset = int(resp.headers.get("Range", f"bytes=0-{end}").split("-")[1]) + 1
                    else:
                        resp.raise_for_status()
        raise RuntimeError("Upload ended without receiving final response")

    async def create_short(
        self, file_path: str, title: str, description: str = "", tags: list[str] | None = None,
    ) -> dict[str, Any]:
        """Upload as a YouTube Short (≤60s vertical video)."""
        tags = list(tags or [])
        if "#Shorts" not in tags:
            tags.insert(0, "#Shorts")
        return await self.upload_video(
            file_path=file_path, title=title,
            description=f"#Shorts\n\n{description}", tags=tags,
            privacy="public", is_short=True,
        )

    async def set_thumbnail(self, video_id: str, image_path: str) -> dict[str, Any]:
        path = Path(image_path)
        mime_type = mimetypes.guess_type(str(path))[0] or "image/jpeg"
        token = await self._ensure_token()
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{_YT_UPLOAD_BASE}/thumbnails/set?videoId={video_id}&uploadType=media",
                headers={"Authorization": f"Bearer {token}", "Content-Type": mime_type},
                content=path.read_bytes(),
            )
            resp.raise_for_status()
            return resp.json()

    async def search_videos(
        self, query: str, max_results: int = 10, order: str = "viewCount",
    ) -> list[dict[str, Any]]:
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"{_YT_API_BASE}/search", headers=headers,
                params={"part": "snippet", "q": query, "type": "video",
                        "maxResults": max_results, "order": order},
            )
            resp.raise_for_status()
            return [
                {
                    "video_id": item["id"]["videoId"],
                    "title": item["snippet"]["title"],
                    "channel": item["snippet"]["channelTitle"],
                    "published_at": item["snippet"]["publishedAt"],
                    "description": item["snippet"]["description"][:200],
                }
                for item in resp.json().get("items", [])
            ]

    async def get_video_stats(self, video_id: str) -> dict[str, Any]:
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.get(
                f"{_YT_API_BASE}/videos", headers=headers,
                params={"part": "statistics,snippet", "id": video_id},
            )
            resp.raise_for_status()
            items = resp.json().get("items", [])
            if not items:
                return {}
            item = items[0]
            return {
                "video_id": video_id,
                "title": item["snippet"]["title"],
                "view_count": int(item["statistics"].get("viewCount", 0)),
                "like_count": int(item["statistics"].get("likeCount", 0)),
                "comment_count": int(item["statistics"].get("commentCount", 0)),
            }


# ═══════════════════════════════════════════════════════════════════
# Instagram Graph API
# ═══════════════════════════════════════════════════════════════════

_IG_API = "https://graph.instagram.com/v19.0"
_FB_API = "https://graph.facebook.com/v19.0"


class InstagramClient:
    """Instagram Graph API — image posts, Reels, carousels."""

    def __init__(self, access_token: str, ig_user_id: str) -> None:
        self._token = access_token
        self._user_id = ig_user_id

    @classmethod
    def from_env(cls) -> "InstagramClient":
        return cls(
            access_token=os.environ["INSTAGRAM_ACCESS_TOKEN"],
            ig_user_id=os.environ["INSTAGRAM_USER_ID"],
        )

    async def _post(self, url: str, params: dict) -> dict[str, Any]:
        params["access_token"] = self._token
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(url, params=params)
            resp.raise_for_status()
            return resp.json()

    async def _get(self, url: str, params: dict | None = None) -> dict[str, Any]:
        p = dict(params or {})
        p["access_token"] = self._token
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url, params=p)
            resp.raise_for_status()
            return resp.json()

    async def post_image(self, image_url: str, caption: str = "") -> dict[str, Any]:
        """Post a single image. image_url must be publicly accessible."""
        container = await self._post(
            f"{_IG_API}/{self._user_id}/media",
            {"image_url": image_url, "caption": caption[:2200]},
        )
        result = await self._post(
            f"{_IG_API}/{self._user_id}/media_publish",
            {"creation_id": container["id"]},
        )
        logger.info("instagram.post_image: id=%s", result.get("id"))
        return result

    async def post_carousel(self, items: list[dict], caption: str = "") -> dict[str, Any]:
        """Post a carousel. Each item: {"image_url": "..."} or {"video_url": "..."}."""
        children = []
        for item in items[:10]:
            if "video_url" in item:
                child = await self._post(
                    f"{_IG_API}/{self._user_id}/media",
                    {"media_type": "VIDEO", "video_url": item["video_url"]},
                )
            else:
                child = await self._post(
                    f"{_IG_API}/{self._user_id}/media",
                    {"image_url": item["image_url"]},
                )
            children.append(child["id"])
        container = await self._post(
            f"{_IG_API}/{self._user_id}/media",
            {"media_type": "CAROUSEL", "caption": caption[:2200],
             "children": ",".join(children)},
        )
        result = await self._post(
            f"{_IG_API}/{self._user_id}/media_publish",
            {"creation_id": container["id"]},
        )
        logger.info("instagram.carousel: id=%s children=%d", result.get("id"), len(children))
        return result

    async def post_reel(self, video_url: str, caption: str = "", cover_url: str = "") -> dict[str, Any]:
        """Publish a Reel."""
        params: dict[str, Any] = {
            "media_type": "REELS", "video_url": video_url, "caption": caption[:2200],
        }
        if cover_url:
            params["cover_url"] = cover_url
        container = await self._post(f"{_IG_API}/{self._user_id}/media", params)
        creation_id = container["id"]
        # Poll until ready
        for _ in range(30):
            status = await self._get(f"{_IG_API}/{creation_id}", {"fields": "status_code"})
            if status.get("status_code") == "FINISHED":
                break
            await asyncio.sleep(2)
        result = await self._post(
            f"{_IG_API}/{self._user_id}/media_publish",
            {"creation_id": creation_id},
        )
        logger.info("instagram.reel: id=%s", result.get("id"))
        return result


# ═══════════════════════════════════════════════════════════════════
# Reddit API (OAuth2)
# ═══════════════════════════════════════════════════════════════════

_REDDIT_AUTH = "https://www.reddit.com/api/v1/access_token"
_REDDIT_API = "https://oauth.reddit.com"


class RedditClient:
    """Reddit API — text, link, image, and video posts."""

    def __init__(self, client_id: str, client_secret: str, username: str, password: str) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._username = username
        self._password = password
        self._access_token = ""
        self._token_expiry = 0.0

    @classmethod
    def from_env(cls) -> "RedditClient":
        return cls(
            client_id=os.environ["REDDIT_CLIENT_ID"],
            client_secret=os.environ["REDDIT_CLIENT_SECRET"],
            username=os.environ["REDDIT_USERNAME"],
            password=os.environ["REDDIT_PASSWORD"],
        )

    async def _ensure_token(self) -> None:
        if self._access_token and time.time() < self._token_expiry - 60:
            return
        auth = base64.b64encode(f"{self._client_id}:{self._client_secret}".encode()).decode()
        async with httpx.AsyncClient(timeout=20) as client:
            resp = await client.post(
                _REDDIT_AUTH,
                headers={"Authorization": f"Basic {auth}",
                         "User-Agent": "RetailEngine/1.0"},
                data={"grant_type": "password",
                      "username": self._username, "password": self._password},
            )
            resp.raise_for_status()
            data = resp.json()
            self._access_token = data["access_token"]
            self._token_expiry = time.time() + data.get("expires_in", 3600)

    async def _headers(self) -> dict[str, str]:
        await self._ensure_token()
        return {"Authorization": f"Bearer {self._access_token}",
                "User-Agent": "RetailEngine/1.0"}

    async def submit_text(self, subreddit: str, title: str, text: str) -> dict[str, Any]:
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{_REDDIT_API}/api/submit", headers=headers,
                data={"sr": subreddit, "kind": "self",
                      "title": title[:300], "text": text, "resubmit": "true"},
            )
            resp.raise_for_status()
            data = resp.json()
            url = data.get("json", {}).get("data", {}).get("url", "")
            logger.info("reddit.submit_text: subreddit=%s url=%s", subreddit, url)
            return {"url": url, "raw": data}

    async def submit_link(self, subreddit: str, title: str, url: str) -> dict[str, Any]:
        headers = await self._headers()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                f"{_REDDIT_API}/api/submit", headers=headers,
                data={"sr": subreddit, "kind": "link",
                      "title": title[:300], "url": url, "resubmit": "true"},
            )
            resp.raise_for_status()
            data = resp.json()
            post_url = data.get("json", {}).get("data", {}).get("url", "")
            logger.info("reddit.submit_link: subreddit=%s url=%s", subreddit, post_url)
            return {"url": post_url, "raw": data}


# ═══════════════════════════════════════════════════════════════════
# X (Twitter) API v2
# ═══════════════════════════════════════════════════════════════════

_X_API = "https://api.twitter.com/2"
_X_MEDIA_UPLOAD = "https://upload.twitter.com/1.1/media/upload.json"
_X_CHUNK_SIZE = 4 * 1024 * 1024


class XClient:
    """X API v2 — tweets, threads, chunked media upload."""

    def __init__(
        self, api_key: str, api_secret: str,
        access_token: str, access_secret: str,
    ) -> None:
        self._api_key = api_key
        self._api_secret = api_secret
        self._access_token = access_token
        self._access_secret = access_secret

    @classmethod
    def from_env(cls) -> "XClient":
        return cls(
            api_key=os.environ["X_API_KEY"],
            api_secret=os.environ["X_API_SECRET"],
            access_token=os.environ["X_ACCESS_TOKEN"],
            access_secret=os.environ["X_ACCESS_SECRET"],
        )

    def _oauth1_headers(self, method: str, url: str, params: dict | None = None) -> dict[str, str]:
        """Generate OAuth 1.0a Authorization header."""
        import hashlib
        import hmac
        import urllib.parse
        import uuid as _uuid
        params = params or {}
        nonce = _uuid.uuid4().hex
        ts = str(int(time.time()))
        oauth_params = {
            "oauth_consumer_key": self._api_key,
            "oauth_nonce": nonce,
            "oauth_signature_method": "HMAC-SHA1",
            "oauth_timestamp": ts,
            "oauth_token": self._access_token,
            "oauth_version": "1.0",
        }
        all_params = {**params, **oauth_params}
        base_str = "&".join([
            method.upper(),
            urllib.parse.quote(url, safe=""),
            urllib.parse.quote("&".join(
                f"{urllib.parse.quote(k, safe='')}={urllib.parse.quote(str(v), safe='')}"
                for k, v in sorted(all_params.items())
            ), safe=""),
        ])
        signing_key = (f"{urllib.parse.quote(self._api_secret, safe='')}"
                       f"&{urllib.parse.quote(self._access_secret, safe='')}")
        sig = base64.b64encode(
            hmac.new(signing_key.encode(), base_str.encode(), hashlib.sha1).digest()
        ).decode()
        oauth_params["oauth_signature"] = sig
        header = "OAuth " + ", ".join(
            f'{urllib.parse.quote(k, safe="")}="{urllib.parse.quote(str(v), safe="")}"'
            for k, v in sorted(oauth_params.items())
        )
        return {"Authorization": header}

    async def post_tweet(
        self, text: str, media_ids: list[str] | None = None, reply_to_id: str = "",
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"text": text[:280]}
        if media_ids:
            body["media"] = {"media_ids": media_ids}
        if reply_to_id:
            body["reply"] = {"in_reply_to_tweet_id": reply_to_id}
        headers = self._oauth1_headers("POST", f"{_X_API}/tweets")
        headers["Content-Type"] = "application/json"
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(f"{_X_API}/tweets", headers=headers, json=body)
            resp.raise_for_status()
            data = resp.json()
            logger.info("x.post_tweet: id=%s", data.get("data", {}).get("id"))
            return data

    async def post_thread(self, texts: list[str], media_ids: list[str] | None = None) -> list[dict[str, Any]]:
        """Post a thread. First tweet may include media."""
        results = []
        reply_to = ""
        for i, text in enumerate(texts):
            mids = media_ids if i == 0 else None
            result = await self.post_tweet(text, media_ids=mids, reply_to_id=reply_to)
            reply_to = result.get("data", {}).get("id", "")
            results.append(result)
            if i < len(texts) - 1:
                await asyncio.sleep(1.0)
        return results

    async def upload_media(self, file_path: str) -> str:
        """Chunked media upload (INIT/APPEND/FINALIZE). Returns media_id_string."""
        path = Path(file_path)
        file_size = path.stat().st_size
        media_type = "video/mp4" if path.suffix.lower() in (".mp4", ".mov") else "image/jpeg"
        media_category = "tweet_video" if "video" in media_type else "tweet_image"
        auth = self._oauth1_headers("POST", _X_MEDIA_UPLOAD)

        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                _X_MEDIA_UPLOAD, headers=auth,
                data={"command": "INIT", "total_bytes": file_size,
                      "media_type": media_type, "media_category": media_category},
            )
            resp.raise_for_status()
            media_id = resp.json()["media_id_string"]

            with path.open("rb") as f:
                segment = 0
                while chunk := f.read(_X_CHUNK_SIZE):
                    append_auth = self._oauth1_headers("POST", _X_MEDIA_UPLOAD)
                    r = await client.post(
                        _X_MEDIA_UPLOAD, headers=append_auth,
                        data={"command": "APPEND", "media_id": media_id, "segment_index": segment},
                        files={"media": chunk},
                    )
                    r.raise_for_status()
                    segment += 1

            fin_auth = self._oauth1_headers("POST", _X_MEDIA_UPLOAD)
            resp = await client.post(
                _X_MEDIA_UPLOAD, headers=fin_auth,
                data={"command": "FINALIZE", "media_id": media_id},
            )
            resp.raise_for_status()
            fin_data = resp.json()

        if fin_data.get("processing_info"):
            await self._wait_processing(media_id)
        logger.info("x.upload_media: media_id=%s", media_id)
        return media_id

    async def _wait_processing(self, media_id: str, max_wait: int = 120) -> None:
        elapsed = 0
        async with httpx.AsyncClient(timeout=20) as client:
            while elapsed < max_wait:
                auth = self._oauth1_headers("GET", _X_MEDIA_UPLOAD)
                resp = await client.get(
                    _X_MEDIA_UPLOAD, headers=auth,
                    params={"command": "STATUS", "media_id": media_id},
                )
                resp.raise_for_status()
                info = resp.json().get("processing_info", {})
                if info.get("state") == "succeeded":
                    return
                if info.get("state") == "failed":
                    raise RuntimeError(f"X media processing failed: {info}")
                await asyncio.sleep(5)
                elapsed += 5
        raise TimeoutError(f"X media {media_id} not processed after {max_wait}s")
