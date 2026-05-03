"""
Session Telemetry — Privacy-safe usage analytics for Echo sessions.

Ported from jcode's TELEMETRY.md:
  - Session start/end events with coarse metrics
  - Turn-level tracking (tool usage, response times, token counts)
  - Feature usage tracking (memory, personas, skills, browser, workflows)
  - No PII, no prompts, no file paths — only aggregate counters
  - Local-first storage with optional export

All telemetry is stored locally in JSON. No external calls are made.
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("session_telemetry")


class TurnMetrics:
    """Metrics for a single user turn (prompt → response cycle)."""

    def __init__(self, turn_index: int):
        self.turn_index = turn_index
        self.started_at = time.time()
        self.ended_at: Optional[float] = None
        self.first_response_ms: Optional[float] = None
        self.input_tokens: int = 0
        self.output_tokens: int = 0
        self.tool_calls: int = 0
        self.tool_failures: int = 0
        self.model_used: str = ""
        self.skill_used: Optional[str] = None
        self.persona_used: Optional[str] = None
        self.features_used: Dict[str, bool] = {}

    def end(self):
        self.ended_at = time.time()

    @property
    def duration_ms(self) -> Optional[float]:
        if self.ended_at:
            return round((self.ended_at - self.started_at) * 1000, 1)
        return None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "turn_index": self.turn_index,
            "duration_ms": self.duration_ms,
            "first_response_ms": self.first_response_ms,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "total_tokens": self.input_tokens + self.output_tokens,
            "tool_calls": self.tool_calls,
            "tool_failures": self.tool_failures,
            "model_used": self.model_used,
            "skill_used": self.skill_used,
            "persona_used": self.persona_used,
            "features_used": self.features_used,
        }


class SessionTelemetry:
    """Tracks metrics for a single Echo session."""

    def __init__(self, session_id: Optional[str] = None, user_id: str = "default"):
        self.session_id = session_id or str(uuid.uuid4())[:12]
        self.user_id = user_id
        self.started_at = time.time()
        self.ended_at: Optional[float] = None
        self.turns: List[TurnMetrics] = []
        self.current_turn: Optional[TurnMetrics] = None

        # Aggregate counters
        self.total_input_tokens: int = 0
        self.total_output_tokens: int = 0
        self.total_tool_calls: int = 0
        self.total_tool_failures: int = 0
        self.models_used: Dict[str, int] = {}
        self.skills_used: Dict[str, int] = {}
        self.personas_used: Dict[str, int] = {}
        self.features_used: Dict[str, int] = {
            "memory": 0,
            "persona": 0,
            "skill": 0,
            "browser": 0,
            "workflow": 0,
            "compression": 0,
            "injection_blocked": 0,
        }

        # Error tracking (coarse categories only)
        self.errors: Dict[str, int] = {}

    def start_turn(self) -> TurnMetrics:
        """Begin tracking a new turn."""
        turn = TurnMetrics(len(self.turns))
        self.current_turn = turn
        return turn

    def end_turn(
        self,
        input_tokens: int = 0,
        output_tokens: int = 0,
        tool_calls: int = 0,
        tool_failures: int = 0,
        model: str = "",
        skill: Optional[str] = None,
        persona: Optional[str] = None,
        features: Optional[Dict[str, bool]] = None,
    ):
        """End the current turn and record metrics."""
        if not self.current_turn:
            return

        turn = self.current_turn
        turn.end()
        turn.input_tokens = input_tokens
        turn.output_tokens = output_tokens
        turn.tool_calls = tool_calls
        turn.tool_failures = tool_failures
        turn.model_used = model
        turn.skill_used = skill
        turn.persona_used = persona
        turn.features_used = features or {}

        self.turns.append(turn)
        self.current_turn = None

        # Update aggregates
        self.total_input_tokens += input_tokens
        self.total_output_tokens += output_tokens
        self.total_tool_calls += tool_calls
        self.total_tool_failures += tool_failures

        if model:
            self.models_used[model] = self.models_used.get(model, 0) + 1
        if skill:
            self.skills_used[skill] = self.skills_used.get(skill, 0) + 1
            self.features_used["skill"] += 1
        if persona:
            self.personas_used[persona] = self.personas_used.get(persona, 0) + 1
            self.features_used["persona"] += 1

        if features:
            for feat, used in features.items():
                if used and feat in self.features_used:
                    self.features_used[feat] += 1

    def record_error(self, category: str):
        """Record an error by coarse category (no details)."""
        self.errors[category] = self.errors.get(category, 0) + 1

    def end_session(self):
        """End the session and finalize metrics."""
        self.ended_at = time.time()

    @property
    def duration_seconds(self) -> Optional[float]:
        if self.ended_at:
            return round(self.ended_at - self.started_at, 1)
        return round(time.time() - self.started_at, 1)

    def summary(self) -> Dict[str, Any]:
        """Generate session summary (privacy-safe, no PII)."""
        return {
            "session_id": self.session_id,
            "duration_seconds": self.duration_seconds,
            "total_turns": len(self.turns),
            "total_input_tokens": self.total_input_tokens,
            "total_output_tokens": self.total_output_tokens,
            "total_tokens": self.total_input_tokens + self.total_output_tokens,
            "total_tool_calls": self.total_tool_calls,
            "total_tool_failures": self.total_tool_failures,
            "models_used": self.models_used,
            "skills_used": self.skills_used,
            "personas_used": self.personas_used,
            "features_used": self.features_used,
            "errors": self.errors,
            "avg_turn_duration_ms": (
                round(sum(t.duration_ms or 0 for t in self.turns) / len(self.turns), 1)
                if self.turns else None
            ),
        }

    def to_dict(self) -> Dict[str, Any]:
        """Full serialization for persistence."""
        return {
            "session_id": self.session_id,
            "user_id": self.user_id,
            "started_at": self.started_at,
            "ended_at": self.ended_at,
            "turns": [t.to_dict() for t in self.turns],
            "summary": self.summary(),
        }


# ═══════════════════════════════════════════════════════════════════
# TELEMETRY STORE
# ═══════════════════════════════════════════════════════════════════

class TelemetryStore:
    """Persists session telemetry data locally."""

    def __init__(self, storage_dir: Path):
        self.storage_dir = storage_dir
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.active_sessions: Dict[str, SessionTelemetry] = {}

    def create_session(self, session_id: Optional[str] = None, user_id: str = "default") -> SessionTelemetry:
        """Create and track a new session."""
        session = SessionTelemetry(session_id, user_id)
        self.active_sessions[session.session_id] = session
        return session

    def get_session(self, session_id: str) -> Optional[SessionTelemetry]:
        """Get an active session by ID."""
        return self.active_sessions.get(session_id)

    def end_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """End a session, persist it, and return the summary."""
        session = self.active_sessions.pop(session_id, None)
        if not session:
            return None

        session.end_session()
        self._persist_session(session)
        return session.summary()

    def _persist_session(self, session: SessionTelemetry):
        """Save session telemetry to disk."""
        path = self.storage_dir / f"{session.session_id}.json"
        try:
            path.write_text(
                json.dumps(session.to_dict(), indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        except Exception as e:
            logger.warning("Failed to persist telemetry for %s: %s", session.session_id, e)

    def get_aggregate_stats(self, days: int = 7) -> Dict[str, Any]:
        """Compute aggregate statistics from persisted sessions."""
        cutoff = time.time() - (days * 86400)
        total_sessions = 0
        total_turns = 0
        total_tokens = 0
        models: Dict[str, int] = {}
        skills: Dict[str, int] = {}
        personas: Dict[str, int] = {}
        features: Dict[str, int] = {}

        for path in self.storage_dir.glob("*.json"):
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                if data.get("started_at", 0) < cutoff:
                    continue
                summary = data.get("summary", {})
                total_sessions += 1
                total_turns += summary.get("total_turns", 0)
                total_tokens += summary.get("total_tokens", 0)
                for m, c in summary.get("models_used", {}).items():
                    models[m] = models.get(m, 0) + c
                for s, c in summary.get("skills_used", {}).items():
                    skills[s] = skills.get(s, 0) + c
                for p, c in summary.get("personas_used", {}).items():
                    personas[p] = personas.get(p, 0) + c
                for f, c in summary.get("features_used", {}).items():
                    features[f] = features.get(f, 0) + c
            except Exception:
                continue

        return {
            "period_days": days,
            "total_sessions": total_sessions,
            "total_turns": total_turns,
            "total_tokens": total_tokens,
            "models_used": models,
            "skills_used": skills,
            "personas_used": personas,
            "features_used": features,
        }


# ═══════════════════════════════════════════════════════════════════
# SINGLETON FACTORY
# ═══════════════════════════════════════════════════════════════════

_telemetry_store: Optional[TelemetryStore] = None


def get_telemetry_store(storage_dir: Optional[Path] = None) -> TelemetryStore:
    """Get or create the telemetry store singleton."""
    global _telemetry_store
    if _telemetry_store is None:
        if storage_dir is None:
            from services.echo_engine import _DATA_DIR
            storage_dir = _DATA_DIR / "telemetry"
        _telemetry_store = TelemetryStore(storage_dir)
    return _telemetry_store
