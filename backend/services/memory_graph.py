"""
Memory Graph — Graph-based persistent memory with confidence decay, tags, and semantic links.

Ported concepts from jcode's MEMORY_ARCHITECTURE:
  - Graph-based storage (nodes + edges) with JSON persistence
  - Confidence decay (time-based with category-specific half-lives)
  - Tag system for organization and retrieval
  - Semantic links between related memories (RelatesTo edges)
  - Cascade retrieval (BFS traversal from initial hits)
  - Reinforcement tracking (boost on use, decay on rejection)
  - Duplicate detection on write
  - Privacy filtering (no secrets stored)

Works alongside echo_engine's flat memory (backward-compatible).
The graph is an opt-in upgrade for richer memory features.
"""
from __future__ import annotations

import hashlib
import json
import logging
import math
import re
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger("memory_graph")

# ── Constants ────────────────────────────────────────────────────

# Confidence half-lives in seconds (how fast memories decay by category)
HALF_LIVES = {
    "fact": 30 * 86400,        # 30 days — facts stay longer
    "preference": 60 * 86400,  # 60 days — preferences are very stable
    "correction": 14 * 86400,  # 14 days — corrections expire faster
    "decision": 21 * 86400,    # 21 days
    "goal": 7 * 86400,         # 7 days — goals change quickly
    "context": 3 * 86400,      # 3 days — session context is ephemeral
}
DEFAULT_HALF_LIFE = 14 * 86400  # 14 days

# Thresholds
DUPLICATE_SIMILARITY_THRESHOLD = 0.85
WEAK_CONFIDENCE_THRESHOLD = 0.05
MAX_MEMORIES_PER_USER = 500
MAX_TAGS = 50

# Privacy: never store content matching these patterns
_SECRET_PATTERNS = [
    re.compile(r'(?:api[_-]?key|secret|token|password|bearer)\s*[:=]\s*\S+', re.I),
    re.compile(r'(?:sk-|ghp_|gho_|glpat-|xox[bpas]-)\S{10,}'),
    re.compile(r'\b[A-Za-z0-9+/]{40,}={0,2}\b'),  # base64 long strings
]


# ═══════════════════════════════════════════════════════════════════
# MEMORY ENTRY
# ═══════════════════════════════════════════════════════════════════

class MemoryEntry:
    """A single memory node in the graph."""

    def __init__(
        self,
        content: str,
        category: str = "fact",
        scope: str = "project",
        tags: Optional[List[str]] = None,
        memory_id: Optional[str] = None,
        confidence: float = 1.0,
        strength: int = 1,
        created_at: Optional[float] = None,
        last_accessed: Optional[float] = None,
        reinforcements: Optional[List[Dict[str, Any]]] = None,
        active: bool = True,
        superseded_by: Optional[str] = None,
    ):
        self.id = memory_id or str(uuid.uuid4())[:12]
        self.content = content
        self.category = category  # fact, preference, correction, decision, goal, context
        self.scope = scope        # project, global
        self.tags = tags or []
        self.confidence = confidence
        self.strength = strength   # how many times this was reinforced
        self.created_at = created_at or time.time()
        self.last_accessed = last_accessed or time.time()
        self.reinforcements = reinforcements or []
        self.active = active
        self.superseded_by = superseded_by

    def decayed_confidence(self) -> float:
        """Calculate current confidence with time-based decay."""
        age = time.time() - self.last_accessed
        half_life = HALF_LIVES.get(self.category, DEFAULT_HALF_LIFE)
        # Exponential decay: C * 0.5^(age/half_life) * strength_boost
        strength_boost = min(2.0, 1.0 + 0.1 * (self.strength - 1))
        decayed = self.confidence * math.pow(0.5, age / half_life) * strength_boost
        return round(max(0.0, min(1.0, decayed)), 4)

    def reinforce(self, session_id: str = "", boost: float = 0.1):
        """Boost confidence when memory is accessed/confirmed."""
        self.confidence = min(1.0, self.confidence + boost)
        self.strength += 1
        self.last_accessed = time.time()
        self.reinforcements.append({
            "session_id": session_id,
            "timestamp": time.time(),
            "type": "boost",
        })

    def decay_on_rejection(self, amount: float = 0.2):
        """Reduce confidence when memory is contradicted or rejected."""
        self.confidence = max(0.0, self.confidence - amount)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "content": self.content,
            "category": self.category,
            "scope": self.scope,
            "tags": self.tags,
            "confidence": self.confidence,
            "strength": self.strength,
            "created_at": self.created_at,
            "last_accessed": self.last_accessed,
            "reinforcements": self.reinforcements[-10:],  # keep last 10
            "active": self.active,
            "superseded_by": self.superseded_by,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "MemoryEntry":
        return cls(
            content=d["content"],
            category=d.get("category", "fact"),
            scope=d.get("scope", "project"),
            tags=d.get("tags", []),
            memory_id=d.get("id"),
            confidence=d.get("confidence", 1.0),
            strength=d.get("strength", 1),
            created_at=d.get("created_at"),
            last_accessed=d.get("last_accessed"),
            reinforcements=d.get("reinforcements", []),
            active=d.get("active", True),
            superseded_by=d.get("superseded_by"),
        )


# ═══════════════════════════════════════════════════════════════════
# MEMORY EDGE
# ═══════════════════════════════════════════════════════════════════

class MemoryEdge:
    """A directed edge between two memory nodes."""

    def __init__(
        self,
        from_id: str,
        to_id: str,
        relation: str = "relates_to",
        weight: float = 1.0,
    ):
        self.from_id = from_id
        self.to_id = to_id
        self.relation = relation  # relates_to, supersedes, has_tag, in_cluster
        self.weight = weight

    def to_dict(self) -> Dict[str, Any]:
        return {
            "from": self.from_id,
            "to": self.to_id,
            "relation": self.relation,
            "weight": self.weight,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "MemoryEdge":
        return cls(
            from_id=d["from"],
            to_id=d["to"],
            relation=d.get("relation", "relates_to"),
            weight=d.get("weight", 1.0),
        )


# ═══════════════════════════════════════════════════════════════════
# MEMORY GRAPH
# ═══════════════════════════════════════════════════════════════════

class MemoryGraph:
    """Graph-based memory store with persistence, decay, and retrieval."""

    def __init__(self, storage_path: Path):
        self.storage_path = storage_path
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self.nodes: Dict[str, MemoryEntry] = {}
        self.edges: List[MemoryEdge] = []
        self.tag_index: Dict[str, Set[str]] = {}  # tag → set of memory IDs
        self._load()

    # ── Persistence ─────────────────────────────────────────────

    def _graph_file(self) -> Path:
        return self.storage_path / "graph.json"

    def _load(self):
        path = self._graph_file()
        if not path.exists():
            return
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            for nd in data.get("nodes", []):
                entry = MemoryEntry.from_dict(nd)
                self.nodes[entry.id] = entry
            for ed in data.get("edges", []):
                self.edges.append(MemoryEdge.from_dict(ed))
            # Rebuild tag index
            for mem in self.nodes.values():
                for tag in mem.tags:
                    self.tag_index.setdefault(tag, set()).add(mem.id)
            logger.info("Loaded memory graph: %d nodes, %d edges", len(self.nodes), len(self.edges))
        except Exception as e:
            logger.warning("Failed to load memory graph: %s", e)

    def save(self):
        """Persist graph to disk (atomic write)."""
        data = {
            "schema_version": 1,
            "saved_at": time.time(),
            "nodes": [n.to_dict() for n in self.nodes.values()],
            "edges": [e.to_dict() for e in self.edges],
        }
        path = self._graph_file()
        tmp = path.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(path)

    # ── Privacy Filter ──────────────────────────────────────────

    @staticmethod
    def _contains_secret(content: str) -> bool:
        """Check if content contains secrets that should not be stored."""
        for pattern in _SECRET_PATTERNS:
            if pattern.search(content):
                return True
        return False

    # ── Write Operations ────────────────────────────────────────

    def remember(
        self,
        content: str,
        category: str = "fact",
        scope: str = "project",
        tags: Optional[List[str]] = None,
        session_id: str = "",
    ) -> Optional[str]:
        """Store a new memory. Returns memory ID, or None if filtered/duplicate.

        Performs duplicate detection: if a very similar memory exists,
        reinforce it instead of creating a new one.
        """
        # Privacy filter
        if self._contains_secret(content):
            logger.info("Memory blocked by privacy filter")
            return None

        # Empty/trivial content filter
        if len(content.strip()) < 5:
            return None

        # Duplicate detection — reinforce instead of duplicate
        existing = self._find_duplicate(content)
        if existing:
            existing.reinforce(session_id=session_id)
            # Merge new tags
            for tag in (tags or []):
                if tag not in existing.tags:
                    existing.tags.append(tag)
                    self.tag_index.setdefault(tag, set()).add(existing.id)
            self.save()
            logger.debug("Reinforced existing memory %s (strength=%d)", existing.id, existing.strength)
            return existing.id

        # Enforce capacity limit
        if len(self.nodes) >= MAX_MEMORIES_PER_USER:
            self._prune_weakest()

        # Create new memory
        entry = MemoryEntry(
            content=content,
            category=category,
            scope=scope,
            tags=tags or [],
        )
        entry.reinforcements.append({
            "session_id": session_id,
            "timestamp": time.time(),
            "type": "created",
        })

        self.nodes[entry.id] = entry

        # Update tag index
        for tag in entry.tags:
            self.tag_index.setdefault(tag, set()).add(entry.id)

        self.save()
        logger.debug("Created memory %s [%s] tags=%s", entry.id, category, entry.tags)
        return entry.id

    def forget(self, memory_id: str) -> bool:
        """Deactivate a memory (soft delete)."""
        if memory_id in self.nodes:
            self.nodes[memory_id].active = False
            self.save()
            return True
        return False

    def link(self, from_id: str, to_id: str, relation: str = "relates_to", weight: float = 1.0):
        """Create a semantic link between two memories."""
        if from_id not in self.nodes or to_id not in self.nodes:
            return
        # Avoid duplicate edges
        for edge in self.edges:
            if edge.from_id == from_id and edge.to_id == to_id and edge.relation == relation:
                edge.weight = max(edge.weight, weight)
                self.save()
                return
        self.edges.append(MemoryEdge(from_id, to_id, relation, weight))
        self.save()

    def tag(self, memory_id: str, tags: List[str]):
        """Add tags to a memory."""
        if memory_id not in self.nodes:
            return
        mem = self.nodes[memory_id]
        for t in tags:
            if t not in mem.tags and len(mem.tags) < MAX_TAGS:
                mem.tags.append(t)
                self.tag_index.setdefault(t, set()).add(memory_id)
        self.save()

    def supersede(self, old_id: str, new_content: str, **kwargs) -> Optional[str]:
        """Replace a memory with a new version (contradiction handling)."""
        if old_id in self.nodes:
            self.nodes[old_id].active = False
            new_id = self.remember(new_content, **kwargs)
            if new_id:
                self.nodes[old_id].superseded_by = new_id
                self.link(new_id, old_id, relation="supersedes")
            self.save()
            return new_id
        return None

    # ── Read Operations ─────────────────────────────────────────

    def recall(self, query: str = "", limit: int = 10, min_confidence: float = 0.05) -> List[Dict[str, Any]]:
        """Retrieve relevant memories using keyword matching + BFS cascade.

        Returns memories sorted by relevance, with decayed confidence applied.
        """
        active = {mid: mem for mid, mem in self.nodes.items() if mem.active}

        if not active:
            return []

        # Score each memory against query
        query_words = set(re.findall(r'\w{3,}', query.lower())) if query else set()
        scored: List[Tuple[float, str]] = []

        for mid, mem in active.items():
            conf = mem.decayed_confidence()
            if conf < min_confidence:
                continue

            if query_words:
                mem_words = set(re.findall(r'\w{3,}', mem.content.lower()))
                tag_words = set(t.lower() for t in mem.tags)
                overlap = len(query_words & (mem_words | tag_words))
                relevance = overlap / max(len(query_words), 1)
            else:
                relevance = 0.5  # no query = return by confidence only

            score = relevance * 0.6 + conf * 0.4
            if score > 0.01:
                scored.append((score, mid))

        # Sort by score
        scored.sort(key=lambda x: x[0], reverse=True)
        initial_hits = [mid for _, mid in scored[:limit]]

        # BFS cascade: traverse graph for related memories
        result_ids = set(initial_hits)
        bfs_queue = list(initial_hits)
        visited = set(initial_hits)
        depth = 0
        max_depth = 2

        while bfs_queue and depth < max_depth:
            next_queue = []
            for mid in bfs_queue:
                for edge in self.edges:
                    neighbor = None
                    if edge.from_id == mid and edge.to_id not in visited:
                        neighbor = edge.to_id
                    elif edge.to_id == mid and edge.from_id not in visited:
                        neighbor = edge.from_id

                    if neighbor and neighbor in active:
                        n_conf = active[neighbor].decayed_confidence()
                        if n_conf >= min_confidence and edge.weight > 0.3:
                            result_ids.add(neighbor)
                            visited.add(neighbor)
                            next_queue.append(neighbor)
            bfs_queue = next_queue
            depth += 1

        # Build result with decayed confidence
        results = []
        for mid in result_ids:
            mem = self.nodes[mid]
            mem.last_accessed = time.time()  # touch on access
            d = mem.to_dict()
            d["effective_confidence"] = mem.decayed_confidence()
            results.append(d)

        # Sort by effective confidence
        results.sort(key=lambda x: x["effective_confidence"], reverse=True)

        self.save()  # persist access timestamps
        return results[:limit]

    def search(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Keyword search across all memories (including inactive)."""
        query_words = set(re.findall(r'\w{3,}', query.lower()))
        if not query_words:
            return []

        results = []
        for mem in self.nodes.values():
            mem_words = set(re.findall(r'\w{3,}', mem.content.lower()))
            tag_words = set(t.lower() for t in mem.tags)
            overlap = len(query_words & (mem_words | tag_words))
            if overlap > 0:
                d = mem.to_dict()
                d["match_score"] = overlap / len(query_words)
                results.append(d)

        results.sort(key=lambda x: x["match_score"], reverse=True)
        return results[:limit]

    def list_by_tag(self, tag: str) -> List[Dict[str, Any]]:
        """List all active memories with a specific tag."""
        ids = self.tag_index.get(tag, set())
        return [
            self.nodes[mid].to_dict()
            for mid in ids
            if mid in self.nodes and self.nodes[mid].active
        ]

    def list_tags(self) -> Dict[str, int]:
        """List all tags with their memory counts."""
        result = {}
        for tag, ids in self.tag_index.items():
            active_count = sum(1 for mid in ids if mid in self.nodes and self.nodes[mid].active)
            if active_count > 0:
                result[tag] = active_count
        return result

    def stats(self) -> Dict[str, Any]:
        """Get graph statistics."""
        active = sum(1 for m in self.nodes.values() if m.active)
        categories = {}
        for m in self.nodes.values():
            if m.active:
                categories[m.category] = categories.get(m.category, 0) + 1
        return {
            "total_nodes": len(self.nodes),
            "active_nodes": active,
            "inactive_nodes": len(self.nodes) - active,
            "edges": len(self.edges),
            "tags": len(self.tag_index),
            "categories": categories,
        }

    # ── Maintenance ─────────────────────────────────────────────

    def consolidate(self) -> Dict[str, int]:
        """Run maintenance: prune weak memories, discover links.

        Inspired by jcode's ambient mode garden cycle.
        Returns counts of actions taken.
        """
        actions = {"pruned": 0, "links_discovered": 0}

        # 1. Prune weak memories (confidence < threshold AND low strength)
        for mid, mem in list(self.nodes.items()):
            if mem.active and mem.decayed_confidence() < WEAK_CONFIDENCE_THRESHOLD and mem.strength <= 1:
                mem.active = False
                actions["pruned"] += 1

        # 2. Discover links between co-tagged memories
        tag_pairs_checked: Set[Tuple[str, str]] = set()
        for tag, ids in self.tag_index.items():
            active_ids = [mid for mid in ids if mid in self.nodes and self.nodes[mid].active]
            for i, a in enumerate(active_ids):
                for b in active_ids[i+1:]:
                    pair = (min(a, b), max(a, b))
                    if pair not in tag_pairs_checked:
                        tag_pairs_checked.add(pair)
                        # Check if link already exists
                        exists = any(
                            (e.from_id == pair[0] and e.to_id == pair[1]) or
                            (e.from_id == pair[1] and e.to_id == pair[0])
                            for e in self.edges
                        )
                        if not exists:
                            self.edges.append(MemoryEdge(pair[0], pair[1], "co_tagged", 0.5))
                            actions["links_discovered"] += 1

        if actions["pruned"] > 0 or actions["links_discovered"] > 0:
            self.save()
            logger.info("Consolidation: pruned=%d, links=%d", actions["pruned"], actions["links_discovered"])

        return actions

    def _find_duplicate(self, content: str) -> Optional[MemoryEntry]:
        """Simple keyword-overlap duplicate detection."""
        new_words = set(re.findall(r'\w{3,}', content.lower()))
        if not new_words:
            return None

        for mem in self.nodes.values():
            if not mem.active:
                continue
            mem_words = set(re.findall(r'\w{3,}', mem.content.lower()))
            if not mem_words:
                continue
            # Jaccard similarity
            intersection = len(new_words & mem_words)
            union = len(new_words | mem_words)
            if union > 0 and (intersection / union) >= DUPLICATE_SIMILARITY_THRESHOLD:
                return mem
        return None

    def _prune_weakest(self, count: int = 10):
        """Remove the weakest memories to make room."""
        active = [(mid, mem.decayed_confidence()) for mid, mem in self.nodes.items() if mem.active]
        active.sort(key=lambda x: x[1])
        for mid, _ in active[:count]:
            self.nodes[mid].active = False

    def export_to_memory_context(self, query: str = "", max_chars: int = 2000) -> str:
        """Export relevant memories as a text block for injection into system prompt.

        This bridges the graph-based memory with echo_engine's build_memory_context.
        """
        memories = self.recall(query=query, limit=15)
        if not memories:
            return ""

        parts = []
        used = 0
        for mem in memories:
            conf = mem.get("effective_confidence", mem.get("confidence", 0))
            tags_str = ", ".join(mem.get("tags", [])[:5])
            entry = f"[{mem['category']}] {mem['content']}"
            if tags_str:
                entry += f" (tags: {tags_str})"
            if used + len(entry) + 1 > max_chars:
                break
            parts.append(entry)
            used += len(entry) + 1

        return "\n".join(parts)


# ═══════════════════════════════════════════════════════════════════
# GRAPH STORE FACTORY
# ═══════════════════════════════════════════════════════════════════

_graph_cache: Dict[str, MemoryGraph] = {}


def get_memory_graph(user_id: str = "default", base_dir: Optional[Path] = None) -> MemoryGraph:
    """Get or create a memory graph for a user."""
    if user_id in _graph_cache:
        return _graph_cache[user_id]

    if base_dir is None:
        from services.echo_engine import _MEMORY_DIR
        base_dir = _MEMORY_DIR

    uid_hash = hashlib.md5(user_id.encode()).hexdigest()[:12]
    graph_dir = base_dir / "graphs" / uid_hash
    graph = MemoryGraph(graph_dir)
    _graph_cache[user_id] = graph
    return graph
