---
name: Goal Planner
id: goal_planner
description: Goal-Oriented Action Planning (GOAP) for complex objectives. Breaks big goals into executable steps with dependency tracking, cost estimation, and adaptive replanning. Use for multi-step projects or when the path to completion is unclear.
---

# Goal Planner Skill (GOAP)

Use when the user has a complex goal and the path to completion isn't obvious.

## Core Algorithm

### 1. State Assessment
- **Current state** — what exists right now (files, features, infrastructure)
- **Goal state** — what should exist when done (specific deliverables)
- **Gap** — what's missing between current and goal

### 2. Action Inventory
List all possible actions with:
- **Preconditions** — what must be true before this action can run
- **Effects** — what becomes true after this action completes
- **Cost** — time/complexity estimate (low / medium / high)
- **Risk** — what could go wrong

### 3. Plan Generation
Find the optimal path from current state to goal state:
- Prefer low-cost actions over high-cost ones
- Prefer parallel execution over sequential when dependencies allow
- Avoid actions with high risk unless no alternative exists
- Generate alternative paths when the primary path has blockers

### 4. Execution Monitoring (OODA Loop)
After each action:
- **Observe** — check actual state vs. expected state
- **Orient** — identify any deviations or surprises
- **Decide** — continue, adjust, or replan entirely
- **Act** — execute next action

### 5. Adaptive Replanning
Trigger replanning when:
- An action fails or produces unexpected results
- New information changes the goal or constraints
- A cheaper path becomes available
- The user changes their mind about scope

## Output Format

When presenting a plan:
```
Goal: [specific end state]
Current state: [what exists now]

Plan (N steps):
1. [action] — [why] — [cost: low/med/high]
2. [action] — [why] — [cost: low/med/high]
   ↳ depends on step 1
3. [action] — [why] — [cost: low/med/high]
   ↳ can run parallel with step 2

Risks: [what could go wrong and fallback for each]
Total estimated effort: [low/medium/high]
```

## When to Use
- Multi-step feature builds
- Migration or refactoring projects
- Research with multiple unknowns
- Any request where "just do it" would miss dependencies

## When to Skip
- Single-step tasks
- Clear, well-defined requests
- Quick questions
