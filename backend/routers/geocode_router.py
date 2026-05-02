"""Geocode Proxy — relays Nominatim requests to bypass CORS."""
import logging
import httpx
from fastapi import APIRouter, HTTPException
from typing import Optional

logger = logging.getLogger("geocode_router")
router = APIRouter(prefix="/geocode", tags=["geocode"])

NOMINATIM_URL = "https://nominatim.openstreetmap.org"
HEADERS = {"User-Agent": "PermanentAI/1.0 (https://aura-ai.live)"}


@router.get("/search")
async def geocode_search(
    q: Optional[str] = None,
    street: Optional[str] = None,
    city: Optional[str] = None,
    country: Optional[str] = None,
    countrycodes: Optional[str] = None,
    limit: int = 8,
    viewbox: Optional[str] = None,
    bounded: Optional[int] = None,
):
    """Proxy Nominatim search to avoid CORS."""
    params = {"format": "jsonv2", "addressdetails": "1", "limit": str(limit)}
    if q:
        params["q"] = q
    if street:
        params["street"] = street
    if city:
        params["city"] = city
    if country:
        params["country"] = country
    if countrycodes:
        params["countrycodes"] = countrycodes
    if viewbox:
        params["viewbox"] = viewbox
    if bounded is not None:
        params["bounded"] = str(bounded)

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{NOMINATIM_URL}/search", params=params, headers=HEADERS)
        if r.status_code != 200:
            logger.warning("Nominatim %d: %s", r.status_code, r.text[:200])
            raise HTTPException(r.status_code, "Nominatim error")
        return r.json()
    except httpx.TimeoutException:
        raise HTTPException(504, "Geocode timeout")


@router.get("/reverse")
async def geocode_reverse(lat: float, lon: float):
    """Proxy Nominatim reverse geocode."""
    params = {"format": "jsonv2", "lat": str(lat), "lon": str(lon), "addressdetails": "1"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{NOMINATIM_URL}/reverse", params=params, headers=HEADERS)
        if r.status_code != 200:
            raise HTTPException(r.status_code, "Nominatim reverse error")
        return r.json()
    except httpx.TimeoutException:
        raise HTTPException(504, "Geocode timeout")
