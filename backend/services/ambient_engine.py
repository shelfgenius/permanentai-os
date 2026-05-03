"""
Ambient Engine — Background memory consolidation and maintenance.

Ported from jcode's AMBIENT_MODE.md:
  - Gardens: consolidate, prune, and strengthen the memory graph
  - Scouts: analyze recent sessions to discover useful context
  - Self-scheduling: runs periodically, respects resource limits
  - Session transcript extraction: recover memories from past sessions

This is a lightweight Python adaptation. Instead of an always-on daemon,
it runs as an async background task triggered by the API or scheduled timer.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("ambient_engine")


class AmbientCycle:
    """A single ambient maintenance cycle result."""

    def __init__(self):
        self.started_at = time.time()
        self.ended_at: Optional[float] = None
        self.actions: List[Dict[str, Any]] = []
        self.memories_extracted: int = 0
        self.memories_pruned: int = 0
        self.links_discovered: int = 0
        self.sessions_scanned: int = 0

    def log_action(self, action_type: str, description: str, details: Optional[Dict[str, Any]] = None):
        self.actions.append({
            "type": action_type,
            "description": description,
            "details": details or {},
            "timestamp": time.time(),
        })

    def finish(self):
        self.ended_at = time.time()

    @property
    def duration_seconds(self) -> float:
        end = self.ended_at or time.time()
        return round(end - self.started_at, 2)

    def summary(self) -> Dict[str, Any]:
        return {
            "duration_seconds": self.duration_seconds,
            "memories_extracted": self.memories_extracted,
            "memories_pruned": self.memories_pruned,
            "links_discovered": self.links_discovered,
            "sessions_scanned": self.sessions_scanned,
            "total_actions": len(self.actions),
            "actions": self.actions[-20:],
        }


class AmbientEngine:
    """Background engine for memory garden, scout, and consolidation tasks."""

    def __init__(self, data_dir: Optional[Path] = None):
        if data_dir is None:
            from services.echo_engine import _DATA_DIR
            data_dir = _DATA_DIR
        self.data_dir = data_dir
        self.sessions_dir = data_dir / "sessions"
        self.last_cycle: Optional[AmbientCycle] = None
        self.cycle_count: int = 0
        self._running: bool = False

    async def run_cycle(self, user_id: str = "default") -> Dict[str, Any]:
        """Run a full ambient maintenance cycle.

        1. Garden: consolidate memory graph (prune weak, discover links)
        2. Scout: scan recent sessions for unextracted memories
        3. Report: generate cycle summary
        """
        if self._running:
            return {"status": "already_running"}

        self._running = True
        cycle = AmbientCycle()

        try:
            # Phase 1: Garden — memory consolidation
            await self._garden(user_id, cycle)

            # Phase 2: Scout — session scanning
            await self._scout(user_id, cycle)

            cycle.finish()
            self.last_cycle = cycle
            self.cycle_count += 1

            summary = cycle.summary()
            summary["cycle_number"] = self.cycle_count
            logger.info(
                "Ambient cycle #%d complete: pruned=%d, links=%d, extracted=%d, sessions=%d (%.1fs)",
                self.cycle_count, cycle.memories_pruned, cycle.links_discovered,
                cycle.memories_extracted, cycle.sessions_scanned, cycle.duration_seconds,
            )
            return summary

        except Exception as e:
            logger.error("Ambient cycle failed: %s", e)
            cycle.log_action("error", f"Cycle failed: {e}")
            cycle.finish()
            return {"status": "error", "error": str(e)}
        finally:
            self._running = False

    async def _garden(self, user_id: str, cycle: AmbientCycle):
        """Consolidate the memory graph: prune weak, discover links, merge dupes."""
        from services.memory_graph import get_memory_graph

        graph = get_memory_graph(user_id)
        result = graph.consolidate()

        cycle.memories_pruned = result.get("pruned", 0)
        cycle.links_discovered = result.get("links_discovered", 0)

        if cycle.memories_pruned > 0:
            cycle.log_action(
                "memory_prune",
                f"Pruned {cycle.memories_pruned} weak memories (confidence < threshold)",
            )
        if cycle.links_discovered > 0:
            cycle.log_action(
                "link_discovery",
                f"Discovered {cycle.links_discovered} new co-tag links",
            )

        # Log graph stats
        stats = graph.stats()
        cycle.log_action("garden_stats", "Memory graph status", stats)

    async def _scout(self, user_id: str, cycle: AmbientCycle):
        """Scan recent sessions for facts worth extracting into memory.

        Looks at session files that haven't been processed yet and
        extracts key information using heuristic extraction.
        """
        from services.echo_engine import extract_memory_updates
        from services.memory_graph import get_memory_graph

        if not self.sessions_dir.exists():
            return

        graph = get_memory_graph(user_id)

        # Find recent session files (last 10, sorted by modification time)
        session_files = sorted(
            self.sessions_dir.glob("*.json"),
            key=lambda p: p.stat().st_mtime,
            reverse=True,
        )[:10]

        for path in session_files:
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                messages = data.get("messages", [])
                if not messages:
                    continue

                cycle.sessions_scanned += 1

                # Extract user and assistant messages
                user_msgs = [m["content"] for m in messages if m.get("role") == "user"]
                asst_msgs = [m["content"] for m in messages if m.get("role") == "assistant"]

                if not user_msgs:
                    continue

                # Use heuristic extraction
                updates = extract_memory_updates(user_msgs, asst_msgs)

                # Store extracted facts in graph
                if updates.get("tech_stack"):
                    mid = graph.remember(
                        content=f"Tech stack: {', '.join(updates['tech_stack'])}",
                        category="fact",
                        tags=["tech_stack"] + updates["tech_stack"][:3],
                        session_id=data.get("session_id", ""),
                    )
                    if mid:
                        cycle.memories_extracted += 1

                if updates.get("project_name"):
                    mid = graph.remember(
                        content=f"Working on project: {updates['project_name']}",
                        category="fact",
                        tags=["project"],
                        session_id=data.get("session_id", ""),
                    )
                    if mid:
                        cycle.memories_extracted += 1

                if updates.get("current_goal"):
                    mid = graph.remember(
                        content=f"Current goal: {updates['current_goal']}",
                        category="goal",
                        tags=["goal"],
                        session_id=data.get("session_id", ""),
                    )
                    if mid:
                        cycle.memories_extracted += 1

                if updates.get("key_decisions"):
                    for decision in updates["key_decisions"][:3]:
                        mid = graph.remember(
                            content=f"Decision: {decision}",
                            category="decision",
                            tags=["decision"],
                            session_id=data.get("session_id", ""),
                        )
                        if mid:
                            cycle.memories_extracted += 1

            except Exception as e:
                logger.debug("Failed to scout session %s: %s", path.name, e)

        if cycle.memories_extracted > 0:
            cycle.log_action(
                "session_extraction",
                f"Extracted {cycle.memories_extracted} memories from {cycle.sessions_scanned} sessions",
            )

    def status(self) -> Dict[str, Any]:
        """Get current ambient engine status."""
        return {
            "running": self._running,
            "total_cycles": self.cycle_count,
            "last_cycle": self.last_cycle.summary() if self.last_cycle else None,
        }


# ═══════════════════════════════════════════════════════════════════
# SINGLETON
# ═══════════════════════════════════════════════════════════════════

_engine: Optional[AmbientEngine] = None


def get_ambient_engine() -> AmbientEngine:
    """Get the ambient engine singleton."""
    global _engine
    if _engine is None:
        _engine = AmbientEngine()
    return _engine
