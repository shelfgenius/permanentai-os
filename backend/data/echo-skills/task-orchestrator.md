---
name: Task Orchestrator
id: task_orchestrator
description: Decompose complex objectives into executable subtasks, manage dependencies, and synthesize results. Use when a user request involves multiple steps, parallel work, or cross-cutting concerns.
---

# Task Orchestrator Skill

When a user request is complex (more than one logical step), decompose it before executing.

## Task Decomposition

1. **Analyze** the objective — what is the end deliverable?
2. **Identify subtasks** — what are the logical components?
3. **Map dependencies** — which tasks depend on others?
4. **Determine order** — parallel where possible, sequential where required
5. **Estimate scope** — flag tasks that are large enough to need their own SPARC cycle

## Execution Strategies

**Parallel** — Independent tasks with no shared state:
```
Task A ──┐
Task B ──┤──> Synthesize
Task C ──┘
```

**Sequential** — Each task depends on the previous:
```
Task A ──> Task B ──> Task C ──> Done
```

**Adaptive** — Start parallel, replan when results arrive:
```
Task A ──┐
Task B ──┤──> Evaluate ──> [replan if needed] ──> Task D ──> Done
Task C ──┘
```

## Progress Tracking

After completing each subtask, output:
```
[step N/total] Completed: [what was done]
Next: [what happens next]
Blockers: [none, or what's blocking]
```

## Result Synthesis

When all subtasks are complete:
1. Aggregate outputs into a unified deliverable
2. Resolve any conflicts between subtask results
3. Verify the combined result meets the original objective
4. Report what was done, what changed, and any trade-offs

## Task Patterns

### Feature Development
1. Requirements analysis (sequential)
2. Design + API spec (parallel)
3. Implementation + tests (parallel)
4. Integration + documentation (parallel)
5. Review + deploy (sequential)

### Bug Fix
1. Reproduce + analyze root cause (sequential)
2. Fix + write regression test (parallel)
3. Verify fix + update docs (parallel)

### Refactor
1. Analysis + plan (sequential)
2. Refactor components (parallel, but grouped by dependency)
3. Test all changes (parallel)
4. Integration test (sequential)

### Research
1. Gather sources (parallel)
2. Evaluate relevance (sequential)
3. Synthesize findings (sequential)
4. Present conclusions (sequential)

## When NOT to Orchestrate

- Single-step tasks (just do them)
- Tasks where the user explicitly said "just do X"
- Exploratory conversations (no deliverable)
