"""
Supabase Client — thin async wrapper around the Supabase REST API.

Uses the SERVICE_ROLE key for full backend access (bypasses RLS).
For frontend/user-scoped access, use the anon key + user JWT.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("supabase_client")

SUPABASE_URL = os.getenv("SUPABASE_URL", "https://mpzvaicxzbnfocytwpxk.supabase.co")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")


def _headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


async def sb_insert(table: str, rows: List[Dict[str, Any]]) -> List[dict]:
    """Insert one or more rows. Returns inserted rows."""
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/{table}",
            json=rows,
            headers=_headers(),
        )
    if r.status_code not in (200, 201):
        logger.error("sb_insert %s failed %d: %s", table, r.status_code, r.text[:300])
        return []
    return r.json()


async def sb_upsert(table: str, rows: List[Dict[str, Any]], on_conflict: str = "id") -> List[dict]:
    """Upsert rows (insert or update on conflict)."""
    headers = _headers()
    headers["Prefer"] = "resolution=merge-duplicates,return=representation"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/{table}?on_conflict={on_conflict}",
            json=rows,
            headers=headers,
        )
    if r.status_code not in (200, 201):
        logger.error("sb_upsert %s failed %d: %s", table, r.status_code, r.text[:300])
        return []
    return r.json()


async def sb_select(
    table: str,
    select: str = "*",
    filters: Optional[Dict[str, str]] = None,
    order: Optional[str] = None,
    limit: Optional[int] = None,
) -> List[dict]:
    """Select rows with optional filters, ordering, and limit."""
    url = f"{SUPABASE_URL}/rest/v1/{table}?select={select}"
    if filters:
        for col, val in filters.items():
            url += f"&{col}={val}"
    if order:
        url += f"&order={order}"
    if limit:
        url += f"&limit={limit}"

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(url, headers=_headers())
    if r.status_code != 200:
        logger.error("sb_select %s failed %d: %s", table, r.status_code, r.text[:300])
        return []
    return r.json()


async def sb_update(table: str, filters: Dict[str, str], data: Dict[str, Any]) -> List[dict]:
    """Update rows matching filters."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    for col, val in filters.items():
        url += f"?{col}={val}" if "?" not in url else f"&{col}={val}"

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.patch(url, json=data, headers=_headers())
    if r.status_code not in (200, 204):
        logger.error("sb_update %s failed %d: %s", table, r.status_code, r.text[:300])
        return []
    return r.json() if r.text else []


async def sb_delete(table: str, filters: Dict[str, str]) -> bool:
    """Delete rows matching filters."""
    url = f"{SUPABASE_URL}/rest/v1/{table}"
    for col, val in filters.items():
        url += f"?{col}={val}" if "?" not in url else f"&{col}={val}"

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.delete(url, headers=_headers())
    return r.status_code in (200, 204)


async def sb_rpc(function_name: str, params: Dict[str, Any] = None) -> Any:
    """Call a Supabase RPC function."""
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{SUPABASE_URL}/rest/v1/rpc/{function_name}",
            json=params or {},
            headers=_headers(),
        )
    if r.status_code != 200:
        logger.error("sb_rpc %s failed %d: %s", function_name, r.status_code, r.text[:300])
        return None
    return r.json()
