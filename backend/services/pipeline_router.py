"""
Pipeline Router — Triage agent that classifies user queries and routes
them to the minimal pipeline needed.

Categories:
  greeting  → Brain only, tiny response, no reasoning
  casual    → Brain with AURA persona, moderate tokens
  reasoning → Brain with thinking/reasoning enabled
  code      → Qwen coder model
  research  → Full research pipeline with deep reasoning
  math      → Brain with reasoning for math/physics/logic
"""
from __future__ import annotations

import logging
import os
import re
from typing import Dict, List, Optional

import httpx

logger = logging.getLogger("pipeline_router")

NIM_BASE = os.getenv("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")

# ── Pipeline definitions ──────────────────────────────────────────────
PIPELINES: Dict[str, dict] = {
    "greeting": {
        "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
        "key_env": "NVIDIA_API_KEY",
        "max_tokens": 256,
        "temperature": 0.7,
        "enable_thinking": False,
        "reasoning_budget": 0,
        "label": "Brain (greeting)",
    },
    "casual": {
        "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
        "key_env": "NVIDIA_API_KEY",
        "max_tokens": 2048,
        "temperature": 0.6,
        "enable_thinking": False,
        "reasoning_budget": 0,
        "label": "Brain",
    },
    "reasoning": {
        "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
        "key_env": "NVIDIA_API_KEY",
        "max_tokens": 8192,
        "temperature": 0.5,
        "enable_thinking": True,
        "reasoning_budget": 8192,
        "label": "Brain (deep reasoning)",
    },
    "code": {
        "model": "qwen/qwen2.5-coder-32b-instruct",
        "key_env": "NVIDIA_API_KEY_CODING",
        "max_tokens": 8192,
        "temperature": 0.4,
        "enable_thinking": False,
        "reasoning_budget": 0,
        "label": "Code (Qwen)",
    },
    "research": {
        "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
        "key_env": "NVIDIA_API_KEY",
        "max_tokens": 16384,
        "temperature": 0.4,
        "enable_thinking": True,
        "reasoning_budget": 16384,
        "label": "Research + Brain",
    },
    "math": {
        "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
        "key_env": "NVIDIA_API_KEY",
        "max_tokens": 8192,
        "temperature": 0.3,
        "enable_thinking": True,
        "reasoning_budget": 8192,
        "label": "Math & Logic",
    },
}

# ── Heuristic patterns ────────────────────────────────────────────────
_GREETING_RE = re.compile(
    r"^\s*("
    r"h(i|ello|ey|owdy|ola)"
    r"|good\s*(morning|afternoon|evening|night)"
    r"|what'?s\s*up"
    r"|yo\b"
    r"|sup\b"
    r"|salut"
    r"|bun[aă]"
    r"|ciao"
    r"|thanks?(\s+you)?"
    r"|thank\s+you"
    r"|bye|goodbye|see\s+you"
    r"|how\s+are\s+you"
    r"|who\s+are\s+you"
    r"|what\s+is\s+your\s+name"
    r")\s*[!?.,]*\s*$",
    re.IGNORECASE,
)

_CODE_MARKERS = re.compile(
    r"("
    r"```"
    r"|write\s+(a\s+)?(code|function|script|program|class|component|api|endpoint)"
    r"|debug\s+(this|my|the)"
    r"|fix\s+(this|my|the)\s*(code|bug|error)"
    r"|refactor"
    r"|implement\s+(a\s+)?"
    r"|traceback|stacktrace|stack\s+trace"
    r"|syntax\s+error"
    r"|import\s+\w+|from\s+\w+\s+import"
    r"|def\s+\w+|class\s+\w+|function\s+\w+"
    r"|console\.log|print\(|fmt\.Print"
    r"|\bpython\b|\bjavascript\b|\btypescript\b|\brust\b|\bjava\b|\bc\+\+"
    r"|\breact\b|\bfastapi\b|\bdjango\b|\bflask\b|\bnextjs\b|\bnode\.?js\b"
    r"|html|css|sql|json|yaml|xml"
    r"|algorithm|data\s*structure"
    r")",
    re.IGNORECASE,
)

_MATH_MARKERS = re.compile(
    r"("
    r"calculat(e|ion)"
    r"|solv(e|ing)"
    r"|equat(ion|e)"
    r"|formula"
    r"|deriv(e|ative)"
    r"|integra(l|te)"
    r"|proof|prove|theorem"
    r"|matrix|matrices|vector"
    r"|probability|statistic"
    r"|physics|velocity|acceleration|force|energy|momentum"
    r"|thermodynamic|quantum|relativity"
    r"|algebra|geometry|trigonometry|calculus"
    r"|logarithm|exponent"
    r"|\d+\s*[\+\-\*\/\^]\s*\d+"
    r"|what\s+is\s+\d+"
    r"|how\s+many"
    r")",
    re.IGNORECASE,
)

_RESEARCH_MARKERS = re.compile(
    r"("
    r"research|investigat(e|ion)"
    r"|analyz(e|sis)|in[\-\s]depth"
    r"|comprehensive|thorough|detailed\s+(analysis|report|overview)"
    r"|compare\s+(and\s+contrast|these|the)"
    r"|pros?\s+(and|&)\s+cons?"
    r"|state\s+of\s+the\s+art"
    r"|literature\s+review"
    r"|what\s+are\s+the\s+(latest|current|recent)"
    r"|explain\s+(in\s+detail|thoroughly|everything)"
    r"|deep\s+dive"
    r"|summarize\s+(the\s+)?(research|paper|article|study)"
    r"|market\s+(analysis|research)"
    r")",
    re.IGNORECASE,
)

_REASONING_MARKERS = re.compile(
    r"("
    r"why\s+(does|do|is|are|would|should|can)"
    r"|explain\s+why"
    r"|what\s+would\s+happen"
    r"|think\s+(about|through|step)"
    r"|reason(ing)?\s+(about|through)"
    r"|implication|consequence"
    r"|trade[\-\s]?off"
    r"|advantage|disadvantage"
    r"|opinion|perspective"
    r"|should\s+I|would\s+you\s+recommend"
    r"|what\s+do\s+you\s+think"
    r"|hypothetical"
    r"|if\s+.{10,}\s+then"
    r")",
    re.IGNORECASE,
)


def classify_heuristic(text: str) -> Optional[str]:
    """Fast regex-based classification. Returns pipeline name or None if ambiguous."""
    stripped = text.strip()

    # Very short messages that are greetings
    if len(stripped) < 40 and _GREETING_RE.match(stripped):
        return "greeting"

    # Code-related
    if _CODE_MARKERS.search(stripped):
        return "code"

    # Math / physics
    if _MATH_MARKERS.search(stripped):
        return "math"

    # Research
    if _RESEARCH_MARKERS.search(stripped):
        return "research"

    # Reasoning questions
    if _REASONING_MARKERS.search(stripped):
        return "reasoning"

    # Short messages → casual, long messages → reasoning
    if len(stripped) < 80:
        return "casual"

    return None  # ambiguous — let LLM decide


async def classify_llm(text: str, api_key: str) -> str:
    """Use a fast LLM call to classify ambiguous queries."""
    try:
        payload = {
            "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a query classifier. Classify the user's message into exactly one category. "
                        "Respond with ONLY the category name, nothing else.\n\n"
                        "Categories:\n"
                        "- greeting: greetings, small talk, thanks, goodbye\n"
                        "- casual: simple questions, general chat, quick facts\n"
                        "- reasoning: questions requiring analysis, opinions, trade-offs, explanations\n"
                        "- code: programming, debugging, code generation, technical implementation\n"
                        "- math: math, physics, calculations, equations, proofs\n"
                        "- research: deep analysis, comparisons, market research, comprehensive overviews"
                    ),
                },
                {"role": "user", "content": text[:500]},
            ],
            "max_tokens": 10,
            "temperature": 0.1,
        }
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.post(
                f"{NIM_BASE}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
            )
        if r.status_code == 200:
            result = r.json()["choices"][0]["message"]["content"].strip().lower()
            # Extract the category from the response
            for cat in PIPELINES:
                if cat in result:
                    return cat
    except Exception as e:
        logger.warning("LLM classify failed: %s", e)

    return "casual"  # safe default


async def classify_query(text: str) -> str:
    """Classify a user query into a pipeline category.
    Uses fast heuristics first, falls back to LLM for ambiguous cases."""
    # Step 1: heuristic
    result = classify_heuristic(text)
    if result:
        logger.info("Pipeline classify [heuristic]: %s → %s", text[:60], result)
        return result

    # Step 2: LLM fallback
    api_key = os.getenv("NVIDIA_API_KEY", "").strip()
    if api_key:
        result = await classify_llm(text, api_key)
        logger.info("Pipeline classify [llm]: %s → %s", text[:60], result)
        return result

    logger.info("Pipeline classify [default]: %s → casual", text[:60])
    return "casual"


def get_pipeline(category: str) -> dict:
    """Return pipeline config for a category."""
    return PIPELINES.get(category, PIPELINES["casual"])
