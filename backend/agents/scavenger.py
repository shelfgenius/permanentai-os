"""
Scavenger Agent — discovers and downloads relevant content from the web.
Uses BeautifulSoup4 for static pages and Selenium headless for dynamic ones.
yt-dlp handles all video downloads at ≥1080p quality.
"""
from __future__ import annotations

import hashlib
import logging
import os
import re
import time
from pathlib import Path
from typing import List, Optional
from urllib.parse import urljoin, urlparse

import requests
import yaml
from bs4 import BeautifulSoup

logger = logging.getLogger("scavenger")

_CONFIG_PATH = Path(__file__).parent.parent.parent / "config.yaml"
with open(_CONFIG_PATH, "r", encoding="utf-8") as _f:
    CONFIG = yaml.safe_load(_f)

DATA_ROOT = Path(os.environ.get("DATA_ROOT", "/data"))

VIDEO_FORMATS = {".mp4", ".mkv", ".avi", ".mov", ".webm"}
IMAGE_FORMATS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
DOC_FORMATS = {".pdf", ".docx", ".txt", ".md", ".csv"}

DOMAIN_FOLDERS = {
    "maritim":        "Maritim",
    "constructii":    "Constructii",
    "design_interior":"Design_Interior",
    "condus":         "Condus",
    "educatie":       "Educatie",
}


def _md5(path: Path) -> str:
    h = hashlib.md5()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def _get_folder(domain: str, file_type: str) -> Path:
    base_folder = DOMAIN_FOLDERS.get(domain.lower(), domain.capitalize())
    sub = "Imagini" if file_type in IMAGE_FORMATS else \
          "Video" if file_type in VIDEO_FORMATS else \
          "Documente"
    folder = DATA_ROOT / base_folder / sub
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def search_urls_static(query: str, domain: str, max_results: int = 10) -> List[str]:
    """Cauta URL-uri relevante prin DuckDuckGo (fara API key)."""
    search_query = f"{query} {domain} filetype:pdf OR site:youtube.com"
    headers = {"User-Agent": "Mozilla/5.0 (compatible; TechQuery/2.0)"}
    try:
        resp = requests.get(
            "https://html.duckduckgo.com/html/",
            params={"q": search_query},
            headers=headers,
            timeout=15,
        )
        soup = BeautifulSoup(resp.text, "html.parser")
        links = []
        for a in soup.select("a.result__url")[:max_results]:
            href = a.get("href", "")
            if href.startswith("http"):
                links.append(href)
        return links
    except Exception as exc:
        logger.warning("Static search failed: %s", exc)
        return []


def search_urls_selenium(query: str, domain: str, max_results: int = 5) -> List[str]:
    """Cauta URL-uri relevante cu Selenium headless (pentru pagini dinamice)."""
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.common.by import By

        opts = Options()
        opts.add_argument("--headless=new")
        opts.add_argument("--no-sandbox")
        opts.add_argument("--disable-dev-shm-usage")
        opts.binary_location = os.environ.get("CHROME_BIN", "/usr/bin/chromium")

        driver = webdriver.Chrome(options=opts)
        driver.get(f"https://duckduckgo.com/?q={query}+{domain}&ia=web")
        time.sleep(2)

        links = []
        for el in driver.find_elements(By.CSS_SELECTOR, "a[data-testid='result-title-a']")[:max_results]:
            href = el.get_attribute("href")
            if href and href.startswith("http"):
                links.append(href)
        driver.quit()
        return links
    except Exception as exc:
        logger.warning("Selenium search failed: %s — fallback to static", exc)
        return []


def download_file(url: str, domain: str) -> Optional[Path]:
    """Descarca un fisier si il salveaza in folderul de domeniu."""
    try:
        parsed = urlparse(url)
        ext = Path(parsed.path).suffix.lower()

        if ext in VIDEO_FORMATS or "youtube.com" in url or "youtu.be" in url:
            return download_video_ytdlp(url, domain)

        headers = {"User-Agent": "Mozilla/5.0 (compatible; TechQuery/2.0)"}
        resp = requests.get(url, headers=headers, timeout=30, stream=True)
        if resp.status_code != 200:
            return None

        content_type = resp.headers.get("content-type", "")
        if "pdf" in content_type:
            ext = ".pdf"
        elif "image" in content_type:
            ext = ".jpg"
        else:
            ext = ext or ".bin"

        folder = _get_folder(domain, ext)
        fname = re.sub(r"[^a-zA-Z0-9_.-]", "_", Path(parsed.path).name)[:80] or "file"
        dest = folder / (fname if fname.endswith(ext) else fname + ext)

        with open(dest, "wb") as f:
            for chunk in resp.iter_content(8192):
                f.write(chunk)

        logger.info("Downloaded: %s → %s", url, dest)
        return dest

    except Exception as exc:
        logger.warning("Download failed %s: %s", url, exc)
        return None


def download_video_ytdlp(url: str, domain: str) -> Optional[Path]:
    """Descarca video la calitate minima 1080p cu yt-dlp."""
    try:
        import yt_dlp
        folder = _get_folder(domain, ".mp4")
        ydl_opts = {
            "format": "bestvideo[height>=1080][ext=mp4]+bestaudio/best[height>=1080]/best",
            "outtmpl": str(folder / "%(title)s.%(ext)s"),
            "quiet": True,
            "no_warnings": True,
            "merge_output_format": "mp4",
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            fname = ydl.prepare_filename(info)
            return Path(fname)
    except Exception as exc:
        logger.warning("yt-dlp failed %s: %s", url, exc)
        return None


def scrape_page_content(url: str) -> str:
    """Extrage textul principal dintr-o pagina web."""
    try:
        headers = {"User-Agent": "Mozilla/5.0 (compatible; TechQuery/2.0)"}
        resp = requests.get(url, headers=headers, timeout=15)
        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
            tag.decompose()
        text = soup.get_text(separator=" ", strip=True)
        return text[:5000]
    except Exception as exc:
        logger.warning("Scrape failed %s: %s", url, exc)
        return ""


async def run_scavenger_job(domain: str, query: str, max_results: int = 10) -> dict:
    """Executa un job complet de Scavenger pentru un domeniu si query."""
    logger.info("Scavenger job: domain=%s query=%s", domain, query)

    urls = search_urls_static(query, domain, max_results)
    if len(urls) < 3:
        urls += search_urls_selenium(query, domain, 5)

    downloaded = []
    scraped_texts = []

    for url in set(urls):
        path = download_file(url, domain)
        if path:
            downloaded.append(str(path))

        text = scrape_page_content(url)
        if text:
            scraped_texts.append({"url": url, "text": text[:2000]})

    return {
        "domain": domain,
        "query": query,
        "urls_found": len(urls),
        "files_downloaded": len(downloaded),
        "paths": downloaded,
        "scraped": scraped_texts,
    }
