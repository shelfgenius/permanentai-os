---
name: SPARC Workflow
id: sparc_workflow
description: Structured 5-phase development methodology for complex implementations. Use when building new features, making architectural changes, or working through unclear requirements. Ensures thorough planning before coding.
---

# SPARC Development Workflow

Use this workflow when a task is complex, architectural, or has unclear requirements. Skip for simple bug fixes, config changes, or well-defined small tasks.

## Phase 1 — Specification

Define the problem completely before writing any code.

- **What** — precise description of the desired outcome
- **Why** — the user need or business reason driving this
- **Acceptance criteria** — binary pass/fail conditions (not vibes)
- **Constraints** — stack, performance, compatibility, security limits
- **Out of scope** — what this task explicitly does NOT include
- **Prior attempts** — what was tried before and why it failed

Output: A spec document the user can approve before work begins.

## Phase 2 — Pseudocode

Write the logic before writing the implementation.

- Map out the control flow in plain language
- Identify all data structures and their shapes
- Mark decision points and edge cases
- Note which parts are uncertain and need research
- Keep it language-agnostic — focus on the algorithm

Output: Pseudocode that a developer could implement in any language.

## Phase 3 — Architecture

Design the system structure, not just the code.

- **Components** — what modules/services/files are involved
- **Interfaces** — how components communicate (APIs, events, shared state)
- **Dependencies** — what external packages/services are needed
- **Data flow** — how data moves through the system
- **Error handling** — what fails and how each failure is handled
- **File map** — which files to create, modify, or leave alone

Output: Architecture diagram (as text) + file-level plan.

## Phase 4 — Refinement

Iterate based on feedback before finalizing.

- Review architecture against acceptance criteria
- Identify gaps, edge cases, performance concerns
- Add missing error handling, validation, security checks
- Simplify where possible — remove unnecessary abstractions
- Verify backward compatibility

Output: Refined architecture with all concerns addressed.

## Phase 5 — Completion

Implement, test, verify.

- Implement according to the refined architecture
- Write or update tests for all new behavior
- Verify all acceptance criteria are met
- Check for regressions in existing functionality
- Document any decisions or trade-offs made

Output: Working code + passing tests + brief summary of what changed.

## When to Skip Phases

- **Bug fix** — skip to Phase 3 (Architecture = where is the bug) then Phase 5
- **Config change** — skip directly to Phase 5
- **Refactor** — Phase 3 (what to restructure) + Phase 5
- **New feature** — all 5 phases

## Quality Gates

Between each phase, verify:
1. Does this still match the user's original intent?
2. Have we introduced any scope creep?
3. Are there any blocking unknowns?
4. Is the plan still achievable within constraints?
