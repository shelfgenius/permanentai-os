"""
Browser Agent — AI-driven browser automation using Playwright.

Ported from auto-browser's visual/structured/action plane architecture.
Provides an observe→decide→act loop where an LLM sees the page state
(URL, title, interactable elements, text excerpt) and decides what to do.

Features:
  - Stealth mode (hides webdriver, patches navigator)
  - Page observation (interactables, headings, forms, text)
  - Screenshot capture
  - LLM-driven step-by-step browsing
  - Session management with persistent auth state
"""
from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("browser_agent")

_DATA_DIR = Path(os.getenv("BROWSER_AGENT_DATA", str(Path(__file__).resolve().parent.parent / "data" / "browser-agent")))
_SCREENSHOTS_DIR = _DATA_DIR / "screenshots"
_AUTH_DIR = _DATA_DIR / "auth"

for d in [_SCREENSHOTS_DIR, _AUTH_DIR]:
    d.mkdir(parents=True, exist_ok=True)


# ── JS scripts (from auto-browser's browser_scripts.py) ──────────

STEALTH_INIT_SCRIPT = r"""
() => {
  try { Object.defineProperty(navigator, 'webdriver', { get: () => undefined, configurable: true }); } catch (_) {}
  if (!window.chrome) {
    window.chrome = { runtime: { onMessage: { addListener: () => {}, removeListener: () => {} }, connect: () => ({ onDisconnect: { addListener: () => {} }, postMessage: () => {} }), sendMessage: () => {}, id: undefined }, loadTimes: () => ({}), csi: () => ({}), app: { isInstalled: false } };
  }
  try { Object.defineProperty(navigator, 'languages', { get: () => ['en-US', 'en'] }); } catch (_) {}
}
"""

INTERACTABLES_SCRIPT = r"""
(limit) => {
  function isVisible(el) {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
  }
  function getLabel(el) {
    const raw = el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.innerText || el.value || el.getAttribute('name') || el.id || el.href || '';
    return String(raw).replace(/\s+/g, ' ').trim().slice(0, 160);
  }
  const selector = 'a, button, input, textarea, select, [role="button"], [role="link"], [role="textbox"], [contenteditable="true"], [tabindex]';
  const out = [];
  for (const el of document.querySelectorAll(selector)) {
    if (!isVisible(el) || el.closest('[aria-hidden="true"]')) continue;
    if (!el.dataset.operatorId) el.dataset.operatorId = `op-${Math.random().toString(36).slice(2, 10)}`;
    const rect = el.getBoundingClientRect();
    out.push({
      element_id: el.dataset.operatorId,
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type'),
      role: el.getAttribute('role') || el.tagName.toLowerCase(),
      label: getLabel(el),
      disabled: Boolean(el.disabled || el.getAttribute('aria-disabled') === 'true'),
      href: el.href || null,
      bbox: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) }
    });
    if (out.length >= limit) break;
  }
  return out;
}
"""

PAGE_SUMMARY_SCRIPT = r"""
(textLimit) => {
  const squash = (v, m = textLimit) => String(v || '').replace(/\s+/g, ' ').trim().slice(0, m);
  const headings = Array.from(document.querySelectorAll('h1,h2,h3')).slice(0, 8).map(el => ({ level: el.tagName.toLowerCase(), text: squash(el.innerText, 160) })).filter(i => i.text);
  const forms = Array.from(document.forms).slice(0, 3).map(form => ({
    action: form.getAttribute('action') || null,
    method: (form.getAttribute('method') || 'get').toLowerCase(),
    fields: Array.from(form.querySelectorAll('input, textarea, select, button')).slice(0, 8).map(f => ({ tag: f.tagName.toLowerCase(), type: f.getAttribute('type'), name: f.getAttribute('name'), label: squash(f.getAttribute('aria-label') || f.getAttribute('placeholder') || f.innerText || f.value || f.getAttribute('name') || f.id, 80) }))
  }));
  return {
    text_excerpt: squash(document.body?.innerText || '', textLimit),
    dom_outline: { headings, forms, counts: { links: document.querySelectorAll('a').length, buttons: document.querySelectorAll('button, [role="button"]').length, inputs: document.querySelectorAll('input, textarea, select').length } }
  };
}
"""


# ── Browser Session ───────────────────────────────────────────────

class BrowserSession:
    """Manages a single Playwright browser session."""

    def __init__(self, session_id: str, headless: bool = True):
        self.session_id = session_id
        self.headless = headless
        self._playwright = None
        self._browser = None
        self._context = None
        self._page = None

    async def start(self, auth_profile: str = "") -> None:
        from playwright.async_api import async_playwright
        self._playwright = await async_playwright().start()
        self._browser = await self._playwright.chromium.launch(headless=self.headless)

        context_opts: Dict[str, Any] = {
            "viewport": {"width": 1280, "height": 720},
            "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        }

        # Load saved auth state if available
        auth_path = _AUTH_DIR / f"{auth_profile}.json" if auth_profile else None
        if auth_path and auth_path.exists():
            context_opts["storage_state"] = str(auth_path)
            logger.info("browser[%s]: loaded auth profile %r", self.session_id, auth_profile)

        self._context = await self._browser.new_context(**context_opts)
        await self._context.add_init_script(STEALTH_INIT_SCRIPT)
        self._page = await self._context.new_page()
        logger.info("browser[%s]: session started (headless=%s)", self.session_id, self.headless)

    async def close(self) -> None:
        if self._browser:
            await self._browser.close()
        if self._playwright:
            await self._playwright.stop()
        logger.info("browser[%s]: session closed", self.session_id)

    async def save_auth(self, profile_name: str) -> str:
        """Save cookies/storage as a reusable auth profile."""
        path = _AUTH_DIR / f"{profile_name}.json"
        state = await self._context.storage_state()
        path.write_text(json.dumps(state, indent=2))
        logger.info("browser[%s]: auth saved as %r", self.session_id, profile_name)
        return str(path)

    @property
    def page(self):
        return self._page

    # ── Observation ───────────────────────────────────────────────

    async def observe(self, element_limit: int = 40, text_limit: int = 2000) -> Dict[str, Any]:
        """Get structured page observation (what the LLM sees)."""
        page = self._page
        interactables = await page.evaluate(INTERACTABLES_SCRIPT, element_limit)
        summary = await page.evaluate(PAGE_SUMMARY_SCRIPT, text_limit)

        return {
            "url": page.url,
            "title": await page.title(),
            "interactables": interactables,
            "page_summary": summary,
        }

    async def screenshot(self, full_page: bool = False) -> str:
        """Take screenshot, return base64-encoded PNG."""
        buf = await self._page.screenshot(full_page=full_page)
        path = _SCREENSHOTS_DIR / f"{self.session_id}_latest.png"
        path.write_bytes(buf)
        return base64.b64encode(buf).decode()

    # ── Actions ───────────────────────────────────────────────────

    async def navigate(self, url: str, wait_until: str = "domcontentloaded") -> Dict[str, Any]:
        resp = await self._page.goto(url, wait_until=wait_until, timeout=30000)
        return {"url": self._page.url, "status": resp.status if resp else None}

    async def click(self, selector: str, timeout: int = 5000) -> Dict[str, Any]:
        await self._page.click(selector, timeout=timeout)
        await self._page.wait_for_load_state("domcontentloaded", timeout=10000)
        return {"action": "click", "selector": selector, "url": self._page.url}

    async def type_text(self, selector: str, text: str, clear: bool = True) -> Dict[str, Any]:
        if clear:
            await self._page.fill(selector, text)
        else:
            await self._page.type(selector, text)
        return {"action": "type", "selector": selector, "length": len(text)}

    async def press(self, key: str) -> Dict[str, Any]:
        await self._page.keyboard.press(key)
        return {"action": "press", "key": key}

    async def scroll(self, direction: str = "down", amount: int = 300) -> Dict[str, Any]:
        delta = amount if direction == "down" else -amount
        await self._page.mouse.wheel(0, delta)
        await asyncio.sleep(0.5)
        return {"action": "scroll", "direction": direction, "amount": amount}

    async def wait(self, seconds: float = 2.0) -> Dict[str, Any]:
        await asyncio.sleep(min(seconds, 10.0))
        return {"action": "wait", "seconds": seconds}

    async def get_text(self, selector: str = "body") -> str:
        """Extract text content from an element."""
        el = await self._page.query_selector(selector)
        if el:
            return (await el.inner_text())[:5000]
        return ""

    async def execute_action(self, action: Dict[str, Any]) -> Dict[str, Any]:
        """Execute a single action from an LLM decision."""
        action_type = action.get("type", "")
        try:
            if action_type == "navigate":
                return await self.navigate(action["url"])
            elif action_type == "click":
                return await self.click(action["selector"])
            elif action_type == "type":
                return await self.type_text(action["selector"], action["text"])
            elif action_type == "press":
                return await self.press(action["key"])
            elif action_type == "scroll":
                return await self.scroll(action.get("direction", "down"), action.get("amount", 300))
            elif action_type == "wait":
                return await self.wait(action.get("seconds", 2))
            elif action_type == "screenshot":
                b64 = await self.screenshot()
                return {"action": "screenshot", "size": len(b64)}
            elif action_type == "extract":
                text = await self.get_text(action.get("selector", "body"))
                return {"action": "extract", "text": text}
            elif action_type == "done":
                return {"action": "done", "result": action.get("result", "")}
            else:
                return {"error": f"Unknown action type: {action_type}"}
        except Exception as e:
            return {"error": str(e)[:300], "action_type": action_type}


# ── Agent Loop ────────────────────────────────────────────────────

BROWSER_AGENT_PROMPT = """You are a browser automation agent. You see the current page state and decide the next action.

Current page:
URL: {url}
Title: {title}

Interactable elements:
{elements}

Page text excerpt:
{text_excerpt}

User goal: {goal}

Previous steps: {previous_steps}

Respond with ONLY a JSON object for the next action. Available actions:
- {{"type": "navigate", "url": "..."}}
- {{"type": "click", "selector": "[data-operator-id=\\"..\\"]"}}
- {{"type": "type", "selector": "[data-operator-id=\\"..\\"]", "text": "..."}}
- {{"type": "press", "key": "Enter"}}
- {{"type": "scroll", "direction": "down", "amount": 500}}
- {{"type": "wait", "seconds": 2}}
- {{"type": "extract", "selector": "body"}}
- {{"type": "done", "result": "description of what was accomplished"}}

Pick exactly ONE action. Prefer clicking specific elements by their data-operator-id selector.
JSON:"""


async def run_browser_agent(
    goal: str,
    start_url: str = "",
    max_steps: int = 15,
    api_key: str = "",
    nim_base: str = "",
    model_id: str = "qwen/qwen2.5-coder-32b-instruct",
    headless: bool = True,
    auth_profile: str = "",
) -> Dict[str, Any]:
    """Run an AI-driven browser agent to accomplish a goal.

    Returns the full step history and final result.
    """
    import httpx
    import uuid

    session_id = str(uuid.uuid4())[:8]
    session = BrowserSession(session_id, headless=headless)
    steps: List[Dict[str, Any]] = []

    try:
        await session.start(auth_profile=auth_profile)

        if start_url:
            await session.navigate(start_url)

        for step_num in range(max_steps):
            # 1. Observe
            obs = await session.observe()
            elements_str = "\n".join(
                f"  [{e['element_id']}] <{e['tag']}> {e['label'][:80]}"
                + (f" → {e['href']}" if e.get('href') else "")
                for e in obs["interactables"][:30]
            )
            text_excerpt = obs["page_summary"].get("text_excerpt", "")[:1500]

            prev_str = "\n".join(
                f"  Step {i+1}: {s.get('action', {}).get('type', '?')} → {json.dumps(s.get('result', {}))[:100]}"
                for i, s in enumerate(steps[-5:])
            ) or "None yet"

            # 2. Decide (LLM call)
            prompt = BROWSER_AGENT_PROMPT.format(
                url=obs["url"], title=obs["title"],
                elements=elements_str or "(no interactable elements)",
                text_excerpt=text_excerpt[:1500],
                goal=goal, previous_steps=prev_str,
            )

            action = await _llm_decide(prompt, api_key, nim_base, model_id)
            if not action:
                steps.append({"step": step_num + 1, "error": "LLM returned no valid action"})
                break

            # 3. Act
            result = await session.execute_action(action)
            steps.append({
                "step": step_num + 1,
                "url": obs["url"],
                "action": action,
                "result": result,
            })
            logger.info("browser_agent[%s] step %d: %s", session_id, step_num + 1, action.get("type"))

            if action.get("type") == "done":
                break

            # Brief pause between actions
            await asyncio.sleep(0.5)

    finally:
        await session.close()

    return {
        "session_id": session_id,
        "goal": goal,
        "steps": steps,
        "total_steps": len(steps),
        "final_url": steps[-1].get("url", "") if steps else "",
        "completed": any(s.get("action", {}).get("type") == "done" for s in steps),
    }


async def _llm_decide(prompt: str, api_key: str, nim_base: str, model_id: str) -> Optional[Dict[str, Any]]:
    """Ask the LLM to decide the next browser action."""
    import httpx

    if not api_key or not nim_base:
        return None

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{nim_base}/chat/completions",
                json={
                    "model": model_id,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 256,
                    "temperature": 0.1,
                },
                headers={"Authorization": f"Bearer {api_key}"},
            )
        if r.status_code == 200:
            content = r.json()["choices"][0]["message"]["content"]
            json_match = re.search(r'\{[^{}]*\}', content)
            if json_match:
                return json.loads(json_match.group())
    except Exception as e:
        logger.warning("browser_agent LLM decide failed: %s", e)

    return None
