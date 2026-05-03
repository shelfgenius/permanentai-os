"""
Soft Interrupt — Non-destructive message injection during agent streaming.

Ported from jcode's SOFT_INTERRUPT.md:
  - Queue user messages while agent is processing (don't cancel/restart)
  - Inject at safe points: after text completion or after tool execution
  - Urgent mode: can abort remaining tool calls
  - Multiple queued messages are combined into one injection
  - Zero lost work — no cancellation, no wasted API calls

This module manages the interrupt queue per session. The actual injection
happens in the streaming endpoint (echo_router.py).
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger("soft_interrupt")


@dataclass
class SoftInterruptMessage:
    """A queued message to inject into the agent's processing stream."""
    content: str
    urgent: bool = False
    queued_at: float = field(default_factory=time.time)
    session_id: str = ""


class InterruptQueue:
    """Per-session queue for soft interrupts.

    Usage:
      1. User types while agent is streaming → queue_interrupt(content)
      2. At safe injection points, check has_pending() / drain()
      3. Injected messages become part of the conversation
    """

    def __init__(self, session_id: str = ""):
        self.session_id = session_id
        self._queue: List[SoftInterruptMessage] = []
        self._injection_log: List[Dict[str, Any]] = []

    def queue(self, content: str, urgent: bool = False):
        """Queue a message for injection at the next safe point."""
        msg = SoftInterruptMessage(
            content=content,
            urgent=urgent,
            session_id=self.session_id,
        )
        self._queue.append(msg)
        logger.debug(
            "Queued %s interrupt for session %s: %.50s...",
            "URGENT" if urgent else "normal",
            self.session_id,
            content,
        )

    def has_pending(self) -> bool:
        """Check if there are any queued interrupts."""
        return len(self._queue) > 0

    def has_urgent(self) -> bool:
        """Check if any queued interrupt is marked urgent."""
        return any(m.urgent for m in self._queue)

    def drain(self) -> Optional[str]:
        """Drain all queued messages into a single combined string.

        Returns None if queue is empty.
        Multiple messages are joined with double newlines.
        """
        if not self._queue:
            return None

        messages = self._queue[:]
        self._queue.clear()

        combined = "\n\n".join(m.content for m in messages)

        # Log the injection
        self._injection_log.append({
            "timestamp": time.time(),
            "message_count": len(messages),
            "had_urgent": any(m.urgent for m in messages),
            "combined_length": len(combined),
        })

        return combined

    def clear(self):
        """Clear the queue without injecting."""
        self._queue.clear()

    @property
    def pending_count(self) -> int:
        return len(self._queue)

    @property
    def injection_history(self) -> List[Dict[str, Any]]:
        """Get log of past injections (for debugging)."""
        return self._injection_log[-20:]  # keep last 20


# ═══════════════════════════════════════════════════════════════════
# SESSION INTERRUPT MANAGER
# ═══════════════════════════════════════════════════════════════════

class InterruptManager:
    """Manages interrupt queues across all active sessions."""

    def __init__(self):
        self._sessions: Dict[str, InterruptQueue] = {}

    def get_queue(self, session_id: str) -> InterruptQueue:
        """Get or create an interrupt queue for a session."""
        if session_id not in self._sessions:
            self._sessions[session_id] = InterruptQueue(session_id)
        return self._sessions[session_id]

    def queue_interrupt(self, session_id: str, content: str, urgent: bool = False):
        """Queue an interrupt for a specific session."""
        q = self.get_queue(session_id)
        q.queue(content, urgent)

    def has_pending(self, session_id: str) -> bool:
        """Check if a session has pending interrupts."""
        if session_id not in self._sessions:
            return False
        return self._sessions[session_id].has_pending()

    def drain(self, session_id: str) -> Optional[str]:
        """Drain pending interrupts for a session."""
        if session_id not in self._sessions:
            return None
        return self._sessions[session_id].drain()

    def remove_session(self, session_id: str):
        """Clean up a session's interrupt queue."""
        self._sessions.pop(session_id, None)

    def active_sessions(self) -> List[str]:
        """List session IDs with active interrupt queues."""
        return list(self._sessions.keys())

    def stats(self) -> Dict[str, Any]:
        """Get interrupt manager statistics."""
        return {
            "active_sessions": len(self._sessions),
            "total_pending": sum(q.pending_count for q in self._sessions.values()),
            "sessions_with_pending": sum(1 for q in self._sessions.values() if q.has_pending()),
        }


# ═══════════════════════════════════════════════════════════════════
# SINGLETON
# ═══════════════════════════════════════════════════════════════════

_manager: Optional[InterruptManager] = None


def get_interrupt_manager() -> InterruptManager:
    """Get the global interrupt manager singleton."""
    global _manager
    if _manager is None:
        _manager = InterruptManager()
    return _manager
