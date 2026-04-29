"""Sky Weather — real-time weather via Open-Meteo + NVIDIA AI summaries."""
from __future__ import annotations
import os, logging
from datetime import datetime
import httpx
from fastapi import APIRouter, HTTPException
from typing import Optional

logger = logging.getLogger("sky_router")
router = APIRouter(prefix="/sky", tags=["sky"])

NIM_BASE = os.getenv("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
KEY_WEATHER = os.getenv("NVIDIA_API_KEY_WEATHER", "")

CITIES = {
    "san-francisco": {"label": "San Francisco, CA", "country": "US", "lat": 37.7749, "lon": -122.4194, "tz": "America/Los_Angeles"},
    "london":        {"label": "London, UK",        "country": "GB", "lat": 51.5074, "lon": -0.1278,   "tz": "Europe/London"},
    "tokyo":         {"label": "Tokyo, JP",          "country": "JP", "lat": 35.6762, "lon": 139.6503,  "tz": "Asia/Tokyo"},
    "sydney":        {"label": "Sydney, AU",         "country": "AU", "lat": -33.8688,"lon": 151.2093,  "tz": "Australia/Sydney"},
    "new-york":      {"label": "New York, NY",       "country": "US", "lat": 40.7128, "lon": -74.006,   "tz": "America/New_York"},
    "paris":         {"label": "Paris, FR",          "country": "FR", "lat": 48.8566, "lon": 2.3522,    "tz": "Europe/Paris"},
    "dubai":         {"label": "Dubai, AE",          "country": "AE", "lat": 25.2048, "lon": 55.2708,   "tz": "Asia/Dubai"},
    "singapore":     {"label": "Singapore, SG",      "country": "SG", "lat": 1.3521,  "lon": 103.8198,  "tz": "Asia/Singapore"},
    "berlin":        {"label": "Berlin, DE",         "country": "DE", "lat": 52.52,   "lon": 13.405,    "tz": "Europe/Berlin"},
    "mumbai":        {"label": "Mumbai, IN",         "country": "IN", "lat": 19.076,  "lon": 72.8777,   "tz": "Asia/Kolkata"},
    "constanta":     {"label": "Constanța, RO",     "country": "RO", "lat": 44.1598, "lon": 28.6348,   "tz": "Europe/Bucharest"},
    "mangalia":      {"label": "Mangalia, RO",      "country": "RO", "lat": 43.8,    "lon": 28.5833,   "tz": "Europe/Bucharest"},
    "medgidia":      {"label": "Medgidia, RO",      "country": "RO", "lat": 44.25,   "lon": 28.2833,   "tz": "Europe/Bucharest"},
    "eforie":        {"label": "Eforie, RO",         "country": "RO", "lat": 44.0667, "lon": 28.65,     "tz": "Europe/Bucharest"},
}


def _wmo(code, is_night=False):
    if code in (0, 1): return ("clear-night" if is_night else "sunny", "Clear" if code == 0 else "Mostly Clear")
    if code == 2: return ("partly-cloudy", "Partly Cloudy")
    if code == 3: return ("cloudy", "Overcast")
    if code in (45, 48): return ("cloudy", "Foggy")
    if code in (51, 53, 55, 56, 57): return ("rain", "Drizzle")
    if code in (61, 63, 65, 66, 67): return ("rain", "Rain")
    if code in (71, 73, 75, 77): return ("snow", "Snow")
    if code in (80, 81, 82): return ("rain", "Rain Showers")
    if code in (85, 86): return ("snow", "Snow Showers")
    if code in (95, 96, 99): return ("storm", "Thunderstorm")
    return ("cloudy", "Unknown")


def _wind_dir(deg):
    d = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"]
    return d[round(deg / 22.5) % 16]


def _fmt_hour(h):
    if h == 0: return "12 AM"
    if h < 12: return f"{h} AM"
    if h == 12: return "12 PM"
    return f"{h-12} PM"


@router.get("/cities")
async def list_cities():
    return [{"key": k, "label": v["label"], "country": v["country"]} for k, v in CITIES.items()]


@router.get("/weather/{city_key}")
async def get_weather(city_key: str):
    city = CITIES.get(city_key)
    if not city:
        raise HTTPException(404, f"Unknown city: {city_key}")

    params = {
        "latitude": city["lat"], "longitude": city["lon"], "timezone": city["tz"],
        "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure,is_day",
        "hourly": "temperature_2m,weather_code,is_day,visibility",
        "daily": "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max",
        "temperature_unit": "celsius", "wind_speed_unit": "kmh", "forecast_days": 7,
    }
    # Try primary and fallback Open-Meteo endpoints
    urls = ["https://api.open-meteo.com/v1/forecast", "https://archive-api.open-meteo.com/v1/forecast"]
    data = None
    last_err = ""
    for url in urls:
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as c:
                r = await c.get(url, params=params)
            if r.status_code == 200:
                data = r.json()
                break
            last_err = f"{url} returned HTTP {r.status_code}: {r.text[:300]}"
            logger.warning("Open-Meteo error: %s", last_err)
        except Exception as e:
            last_err = f"{url} failed: {e}"
            logger.warning("Open-Meteo error: %s", last_err)
    if data is None:
        raise HTTPException(502, f"Weather data unavailable — {last_err}")

    cur = data["current"]; hourly = data["hourly"]; daily = data["daily"]
    is_night = cur.get("is_day", 1) == 0
    cond_key, cond_text = _wmo(cur["weather_code"], is_night)

    # Sunrise/sunset for today
    sunrise_str = daily.get("sunrise", ["06:00"])[0]
    sunset_str = daily.get("sunset", ["18:00"])[0]
    sr_t = sunrise_str.split("T")[1] if "T" in sunrise_str else "06:00"
    ss_t = sunset_str.split("T")[1] if "T" in sunset_str else "18:00"
    sr_h, sr_m = int(sr_t.split(":")[0]), int(sr_t.split(":")[1])
    ss_h, ss_m = int(ss_t.split(":")[0]), int(ss_t.split(":")[1])

    # Visibility from first hourly slot
    vis_km = (hourly.get("visibility", [10000])[0] or 10000) / 1000
    vis_val = round(vis_km, 1)
    if vis_val >= 10: vis_text = "Excellent"
    elif vis_val >= 5: vis_text = "Good"
    elif vis_val >= 2: vis_text = "Moderate"
    else: vis_text = "Poor"

    # UV
    uv_max = daily.get("uv_index_max", [0])[0] or 0
    if uv_max <= 2: uv_text = "Low"
    elif uv_max <= 5: uv_text = "Moderate"
    elif uv_max <= 7: uv_text = "High"
    elif uv_max <= 10: uv_text = "Very High"
    else: uv_text = "Extreme"

    # Pressure (hPa)
    pressure_hpa = round(cur["surface_pressure"])

    # Dew point approx
    temp_c = cur["temperature_2m"]
    rh = cur["relative_humidity_2m"]
    dew_c = round(temp_c - ((100 - rh) / 5))

    # Hourly
    hourly_out = []
    for i in range(min(24, len(hourly["time"]))):
        h_night = hourly.get("is_day", [1]*48)[i] == 0
        h_cond, _ = _wmo(hourly["weather_code"][i], h_night)
        h_num = int(hourly["time"][i].split("T")[1].split(":")[0])
        hourly_out.append({"hour": i, "time": _fmt_hour(h_num), "temp": round(hourly["temperature_2m"][i]), "condition": h_cond})

    # Daily
    dn = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
    ds = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]
    daily_out = []
    for i in range(min(7, len(daily["time"]))):
        dt = datetime.fromisoformat(daily["time"][i])
        d_cond, _ = _wmo(daily["weather_code"][i])
        daily_out.append({"day": dn[dt.weekday()], "dayShort": ds[dt.weekday()], "low": round(daily["temperature_2m_min"][i]), "high": round(daily["temperature_2m_max"][i]), "condition": d_cond})

    return {
        "city": {"key": city_key, "label": city["label"], "country": city["country"], "timezone": city["tz"]},
        "current": {
            "temp": round(cur["temperature_2m"]), "condition": cond_key, "conditionText": cond_text,
            "high": round(daily["temperature_2m_max"][0]), "low": round(daily["temperature_2m_min"][0]),
        },
        "hourly": hourly_out,
        "daily": daily_out,
        "details": {
            "feelsLike": round(cur["apparent_temperature"]),
            "humidity": round(rh), "dewPoint": dew_c,
            "visibility": vis_val, "visibilityUnit": "km", "visibilityText": vis_text,
            "pressure": pressure_hpa, "pressureUnit": "hPa", "pressureTrend": "Steady",
            "windSpeed": round(cur["wind_speed_10m"]), "windUnit": "km/h", "windDirection": _wind_dir(cur["wind_direction_10m"]),
            "uvIndex": round(uv_max), "uvText": uv_text,
        },
        "sun": {
            "sunrise": f"{sr_h % 12 or 12}:{sr_m:02d} AM" if sr_h < 12 else f"{sr_h % 12 or 12}:{sr_m:02d} PM",
            "sunset": f"{ss_h % 12 or 12}:{ss_m:02d} AM" if ss_h < 12 else f"{ss_h % 12 or 12}:{ss_m:02d} PM",
            "sunriseHour": sr_h, "sunriseMin": sr_m, "sunsetHour": ss_h, "sunsetMin": ss_m,
        },
    }


@router.get("/summary/{city_key}")
async def get_ai_summary(city_key: str):
    """Use NVIDIA NIM LLM to generate a weather insight summary."""
    if not KEY_WEATHER:
        return {"summary": "AI summary unavailable — no API key configured."}

    city = CITIES.get(city_key)
    if not city:
        raise HTTPException(404, f"Unknown city: {city_key}")

    # Fetch weather first
    try:
        weather = await get_weather(city_key)
    except Exception:
        return {"summary": "Could not fetch weather data for summary."}

    cur = weather["current"]
    det = weather["details"]
    prompt = (
        f"Give a brief 2-sentence weather summary for {city['label']}. "
        f"Current: {cur['temp']}°C, {cur['conditionText']}, feels like {det['feelsLike']}°C, "
        f"wind {det['windSpeed']} km/h {det['windDirection']}, humidity {det['humidity']}%, "
        f"UV index {det['uvIndex']} ({det['uvText']}). "
        f"High {cur['high']}°C, low {cur['low']}°C. Be concise and helpful."
    )

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                f"{NIM_BASE}/chat/completions",
                headers={"Authorization": f"Bearer {KEY_WEATHER}", "Content-Type": "application/json"},
                json={"model": "meta/llama-3.1-8b-instruct", "messages": [{"role": "user", "content": prompt}], "max_tokens": 120, "temperature": 0.7},
            )
        if r.status_code == 200:
            return {"summary": r.json()["choices"][0]["message"]["content"].strip()}
        logger.warning("NVIDIA summary error %s", r.status_code)
        return {"summary": f"{cur['conditionText']} with a high of {cur['high']}°F and low of {cur['low']}°F."}
    except Exception as e:
        logger.warning("NVIDIA summary failed: %s", e)
        return {"summary": f"{cur['conditionText']} with a high of {cur['high']}°F and low of {cur['low']}°F."}
