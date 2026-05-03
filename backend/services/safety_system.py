"""
Safety System — Action classification and permission management for AI agents.

Ported from jcode's SAFETY_SYSTEM.md:
  - Three-tier action classification (auto-allowed, notify, requires-permission)
  - Permission request queue with approve/deny
  - Action logging and session transcripts
  - Decision history for pattern learning

Prevents AI agents from performing destructive actions without user approval.
"""
from __future__ import annotations

import json
import logging
import time
import uuid
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("safety_system")


# ═══════════════════════════════════════════════════════════════════
# ACTION TIERS
# ═══════════════════════════════════════════════════════════════════

class ActionTier(str, Enum):
    AUTO_ALLOWED = "auto_allowed"       # Safe, no approval needed
    NOTIFY = "notify"                    # Allowed but user is notified
    REQUIRES_PERMISSION = "requires_permission"  # Must get explicit approval


class Urgency(str, Enum):
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"


class Decision(str, Enum):
    APPROVED = "approved"
    DENIED = "denied"
    PENDING = "pending"
    TIMEOUT = "timeout"


# ═══════════════════════════════════════════════════════════════════
# ACTION CLASSIFIER
# ═══════════════════════════════════════════════════════════════════

# Default action classifications
_DEFAULT_CLASSIFICATIONS: Dict[str, ActionTier] = {
    # Auto-allowed: read-only, analysis, safe outputs
    "read_file": ActionTier.AUTO_ALLOWED,
    "search": ActionTier.AUTO_ALLOWED,
    "list_files": ActionTier.AUTO_ALLOWED,
    "analyze_code": ActionTier.AUTO_ALLOWED,
    "generate_response": ActionTier.AUTO_ALLOWED,
    "recall_memory": ActionTier.AUTO_ALLOWED,
    "search_web": ActionTier.AUTO_ALLOWED,
    "scrape_page": ActionTier.AUTO_ALLOWED,

    # Notify: write operations that are reversible
    "write_file": ActionTier.NOTIFY,
    "edit_file": ActionTier.NOTIFY,
    "create_file": ActionTier.NOTIFY,
    "remember": ActionTier.NOTIFY,
    "forget_memory": ActionTier.NOTIFY,
    "run_safe_command": ActionTier.NOTIFY,
    "post_social": ActionTier.NOTIFY,

    # Requires permission: destructive or external-facing
    "delete_file": ActionTier.REQUIRES_PERMISSION,
    "delete_database": ActionTier.REQUIRES_PERMISSION,
    "send_email": ActionTier.REQUIRES_PERMISSION,
    "make_payment": ActionTier.REQUIRES_PERMISSION,
    "deploy": ActionTier.REQUIRES_PERMISSION,
    "run_dangerous_command": ActionTier.REQUIRES_PERMISSION,
    "modify_config": ActionTier.REQUIRES_PERMISSION,
    "create_pull_request": ActionTier.REQUIRES_PERMISSION,
    "publish": ActionTier.REQUIRES_PERMISSION,
    "bulk_operation": ActionTier.REQUIRES_PERMISSION,
}


class ActionClassifier:
    """Classifies actions into safety tiers."""

    def __init__(self, custom_rules: Optional[Dict[str, str]] = None):
        self.rules = dict(_DEFAULT_CLASSIFICATIONS)
        if custom_rules:
            for action, tier in custom_rules.items():
                self.rules[action] = ActionTier(tier)

    def classify(self, action: str, context: Optional[Dict[str, Any]] = None) -> ActionTier:
        """Classify an action into a safety tier.

        Uses explicit rules first, then heuristic classification for unknown actions.
        """
        # Exact match
        if action in self.rules:
            return self.rules[action]

        # Heuristic: check for dangerous keywords
        action_lower = action.lower()
        dangerous_keywords = ["delete", "drop", "destroy", "remove", "purge", "wipe",
                              "send", "email", "payment", "deploy", "publish", "push"]
        for kw in dangerous_keywords:
            if kw in action_lower:
                return ActionTier.REQUIRES_PERMISSION

        write_keywords = ["write", "create", "edit", "modify", "update", "set", "add"]
        for kw in write_keywords:
            if kw in action_lower:
                return ActionTier.NOTIFY

        # Default: auto-allowed for unknown read-like actions
        return ActionTier.AUTO_ALLOWED

    def promote(self, action: str, new_tier: ActionTier):
        """Change the classification of an action (e.g., after user always approves)."""
        self.rules[action] = new_tier

    def get_all_rules(self) -> Dict[str, str]:
        """Get all classification rules."""
        return {k: v.value for k, v in self.rules.items()}


# ═══════════════════════════════════════════════════════════════════
# PERMISSION REQUEST
# ═══════════════════════════════════════════════════════════════════

class PermissionRequest:
    """A request for user permission to perform an action."""

    def __init__(
        self,
        action: str,
        description: str,
        rationale: str = "",
        urgency: Urgency = Urgency.NORMAL,
        context: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None,
    ):
        self.id = request_id or str(uuid.uuid4())[:12]
        self.action = action
        self.description = description
        self.rationale = rationale
        self.urgency = urgency
        self.context = context or {}
        self.created_at = time.time()
        self.decision = Decision.PENDING
        self.decided_at: Optional[float] = None
        self.decided_reason: Optional[str] = None

    def approve(self, reason: str = ""):
        self.decision = Decision.APPROVED
        self.decided_at = time.time()
        self.decided_reason = reason

    def deny(self, reason: str = ""):
        self.decision = Decision.DENIED
        self.decided_at = time.time()
        self.decided_reason = reason

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "action": self.action,
            "description": self.description,
            "rationale": self.rationale,
            "urgency": self.urgency.value,
            "context": self.context,
            "created_at": self.created_at,
            "decision": self.decision.value,
            "decided_at": self.decided_at,
            "decided_reason": self.decided_reason,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "PermissionRequest":
        req = cls(
            action=d["action"],
            description=d["description"],
            rationale=d.get("rationale", ""),
            urgency=Urgency(d.get("urgency", "normal")),
            context=d.get("context", {}),
            request_id=d.get("id"),
        )
        req.created_at = d.get("created_at", time.time())
        req.decision = Decision(d.get("decision", "pending"))
        req.decided_at = d.get("decided_at")
        req.decided_reason = d.get("decided_reason")
        return req


# ═══════════════════════════════════════════════════════════════════
# ACTION LOG
# ═══════════════════════════════════════════════════════════════════

class ActionLog:
    """Log entry for an action taken by the agent."""

    def __init__(
        self,
        action: str,
        description: str,
        tier: ActionTier,
        details: Optional[Dict[str, Any]] = None,
        session_id: str = "",
    ):
        self.id = str(uuid.uuid4())[:12]
        self.action = action
        self.description = description
        self.tier = tier
        self.details = details or {}
        self.session_id = session_id
        self.timestamp = time.time()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "action": self.action,
            "description": self.description,
            "tier": self.tier.value,
            "details": self.details,
            "session_id": self.session_id,
            "timestamp": self.timestamp,
        }


# ═══════════════════════════════════════════════════════════════════
# SAFETY SYSTEM
# ═══════════════════════════════════════════════════════════════════

class SafetySystem:
    """Central safety system for action classification and permission management."""

    def __init__(self, storage_dir: Optional[Path] = None):
        self.classifier = ActionClassifier()
        self.queue: Dict[str, PermissionRequest] = {}
        self.history: List[Dict[str, Any]] = []
        self.action_log: List[ActionLog] = []
        self.storage_dir = storage_dir

        if storage_dir:
            storage_dir.mkdir(parents=True, exist_ok=True)
            self._load_state()

    def _load_state(self):
        """Load persisted queue and history."""
        if not self.storage_dir:
            return

        queue_file = self.storage_dir / "queue.json"
        if queue_file.exists():
            try:
                data = json.loads(queue_file.read_text(encoding="utf-8"))
                for rd in data.get("requests", []):
                    req = PermissionRequest.from_dict(rd)
                    if req.decision == Decision.PENDING:
                        self.queue[req.id] = req
            except Exception as e:
                logger.warning("Failed to load safety queue: %s", e)

        history_file = self.storage_dir / "history.json"
        if history_file.exists():
            try:
                self.history = json.loads(history_file.read_text(encoding="utf-8"))[-100:]  # keep last 100
            except Exception:
                pass

    def _save_state(self):
        """Persist queue and history."""
        if not self.storage_dir:
            return

        queue_file = self.storage_dir / "queue.json"
        queue_data = {"requests": [r.to_dict() for r in self.queue.values()]}
        queue_file.write_text(json.dumps(queue_data, indent=2), encoding="utf-8")

        history_file = self.storage_dir / "history.json"
        history_file.write_text(json.dumps(self.history[-100:], indent=2), encoding="utf-8")

    # ── Core API ────────────────────────────────────────────────

    def is_auto_allowed(self, action: str, context: Optional[Dict[str, Any]] = None) -> bool:
        """Check if an action can proceed without permission."""
        tier = self.classifier.classify(action, context)
        return tier == ActionTier.AUTO_ALLOWED

    def check_action(self, action: str, context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Classify an action and return its tier + whether it can proceed.

        Returns: {"tier": "auto_allowed|notify|requires_permission",
                  "allowed": bool, "message": str}
        """
        tier = self.classifier.classify(action, context)
        return {
            "tier": tier.value,
            "allowed": tier != ActionTier.REQUIRES_PERMISSION,
            "needs_notification": tier == ActionTier.NOTIFY,
            "message": {
                ActionTier.AUTO_ALLOWED: "Action is safe to proceed.",
                ActionTier.NOTIFY: "Action will proceed. User will be notified.",
                ActionTier.REQUIRES_PERMISSION: "Action requires user permission before proceeding.",
            }[tier],
        }

    def request_permission(
        self,
        action: str,
        description: str,
        rationale: str = "",
        urgency: Urgency = Urgency.NORMAL,
        context: Optional[Dict[str, Any]] = None,
    ) -> PermissionRequest:
        """Create a permission request for a restricted action."""
        req = PermissionRequest(
            action=action,
            description=description,
            rationale=rationale,
            urgency=urgency,
            context=context,
        )
        self.queue[req.id] = req
        self._save_state()
        logger.info("Permission requested: %s — %s", action, description)
        return req

    def record_decision(self, request_id: str, decision: Decision, reason: str = "") -> bool:
        """Record a user's approval/denial of a permission request."""
        if request_id not in self.queue:
            return False

        req = self.queue[request_id]
        if decision == Decision.APPROVED:
            req.approve(reason)
        else:
            req.deny(reason)

        # Move to history
        self.history.append({
            "request_id": request_id,
            "action": req.action,
            "decision": decision.value,
            "decided_at": time.time(),
            "response_time_seconds": round(time.time() - req.created_at, 1),
        })

        del self.queue[request_id]
        self._save_state()
        return True

    def log_action(self, action: str, description: str, details: Optional[Dict[str, Any]] = None,
                   session_id: str = ""):
        """Log an action that was taken (for transcript/audit)."""
        tier = self.classifier.classify(action)
        log = ActionLog(action, description, tier, details, session_id)
        self.action_log.append(log)

    # ── Query ───────────────────────────────────────────────────

    def pending_requests(self) -> List[Dict[str, Any]]:
        """Get all pending permission requests."""
        return [r.to_dict() for r in self.queue.values() if r.decision == Decision.PENDING]

    def recent_history(self, limit: int = 20) -> List[Dict[str, Any]]:
        """Get recent decision history."""
        return self.history[-limit:]

    def session_summary(self, session_id: str = "") -> Dict[str, Any]:
        """Generate a summary of actions taken in a session."""
        session_actions = [a for a in self.action_log if a.session_id == session_id] if session_id else self.action_log
        by_tier = {"auto_allowed": 0, "notify": 0, "requires_permission": 0}
        for a in session_actions:
            by_tier[a.tier.value] = by_tier.get(a.tier.value, 0) + 1

        return {
            "total_actions": len(session_actions),
            "by_tier": by_tier,
            "pending_permissions": len(self.queue),
            "actions": [a.to_dict() for a in session_actions[-20:]],
        }

    def get_classification_rules(self) -> Dict[str, str]:
        """Get all current action classification rules."""
        return self.classifier.get_all_rules()

    def update_rule(self, action: str, tier: str):
        """Update a classification rule (e.g., promote an action after repeated approval)."""
        self.classifier.promote(action, ActionTier(tier))


# ═══════════════════════════════════════════════════════════════════
# SINGLETON FACTORY
# ═══════════════════════════════════════════════════════════════════

_safety_instance: Optional[SafetySystem] = None


def get_safety_system(storage_dir: Optional[Path] = None) -> SafetySystem:
    """Get or create the safety system singleton."""
    global _safety_instance
    if _safety_instance is None:
        if storage_dir is None:
            from services.echo_engine import _DATA_DIR
            storage_dir = _DATA_DIR / "safety"
        _safety_instance = SafetySystem(storage_dir)
    return _safety_instance
