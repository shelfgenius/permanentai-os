"""
Shared Skill Loader — loads .md skill files for use by ALL AI systems.

Used by:
  - Echo (coding assistant)
  - Aura (voice AI companion)
  - Slide generator (presentation AI)
  - Any future AI-powered feature

Skills are loaded from backend/data/echo-skills/*.md (shared directory).
Each .md file has YAML frontmatter (name, id, description) + markdown body.
"""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Dict, List, Optional

logger = logging.getLogger("skill_loader")

_SKILLS_DIR = Path(__file__).resolve().parent.parent / "data" / "echo-skills"

_skill_cache: Dict[str, Dict[str, str]] = {}


def _parse_skill_file(path: Path) -> Dict[str, str]:
    """Parse a skill .md file with YAML frontmatter + markdown body."""
    raw = path.read_text(encoding="utf-8")
    meta: Dict[str, str] = {}
    body = raw

    if raw.startswith("---"):
        parts = raw.split("---", 2)
        if len(parts) >= 3:
            for line in parts[1].strip().splitlines():
                if ":" in line:
                    key, _, val = line.partition(":")
                    meta[key.strip()] = val.strip()
            body = parts[2].strip()

    return {
        "id": meta.get("id", path.stem),
        "name": meta.get("name", path.stem.replace("-", " ").title()),
        "description": meta.get("description", ""),
        "body": body,
    }


def load_all_skills() -> Dict[str, Dict[str, str]]:
    """Load all skill files. Returns dict keyed by skill_id."""
    global _skill_cache
    if _skill_cache:
        return _skill_cache

    if not _SKILLS_DIR.exists():
        return {}

    for p in sorted(_SKILLS_DIR.glob("*.md")):
        try:
            skill = _parse_skill_file(p)
            _skill_cache[skill["id"]] = skill
        except Exception as e:
            logger.warning("Failed to load skill %s: %s", p.name, e)

    logger.info("Loaded %d shared skills from %s", len(_skill_cache), _SKILLS_DIR)
    return _skill_cache


def get_skill(skill_id: str) -> Optional[Dict[str, str]]:
    """Get a specific skill by ID."""
    return load_all_skills().get(skill_id)


def get_skill_body(skill_id: str) -> Optional[str]:
    """Get just the body text of a skill."""
    skill = get_skill(skill_id)
    return skill["body"] if skill else None


def list_skills() -> List[Dict[str, str]]:
    """List all skills (id, name, description)."""
    return [
        {"id": s["id"], "name": s["name"], "description": s["description"]}
        for s in load_all_skills().values()
    ]


def get_skills_for_context(context: str) -> str:
    """
    Given a context hint (e.g. 'aura', 'echo', 'slide', 'research'),
    return a combined skill prompt with the most relevant skills.
    
    Context mapping:
      - 'aura'  → karpathy_guidelines, prompt_engineer, deep_research, task_orchestrator, goal_planner
      - 'echo'  → all skills
      - 'slide' → karpathy_guidelines, prompt_engineer, sparc_workflow
      - 'research' → karpathy_guidelines, deep_research, task_orchestrator
    """
    skills = load_all_skills()
    if not skills:
        return ""

    context_map = {
        "aura": ["karpathy_guidelines", "prompt_engineer", "deep_research", "task_orchestrator", "goal_planner"],
        "echo": list(skills.keys()),  # Echo gets everything
        "slide": ["karpathy_guidelines", "prompt_engineer", "sparc_workflow"],
        "research": ["karpathy_guidelines", "deep_research", "task_orchestrator"],
    }

    relevant_ids = context_map.get(context, [])
    if not relevant_ids:
        return ""

    parts = []
    for sid in relevant_ids:
        skill = skills.get(sid)
        if skill:
            parts.append(f"### Skill: {skill['name']}\n{skill['body']}")

    if not parts:
        return ""

    return "\n\n---\n\n".join(parts)


def reload_skills() -> int:
    """Force reload from disk. Returns count loaded."""
    global _skill_cache
    _skill_cache = {}
    return len(load_all_skills())
