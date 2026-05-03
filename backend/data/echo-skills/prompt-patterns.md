---
name: Prompt Diagnostics
id: prompt_fix
description: Use when the user pastes a bad prompt and wants it fixed, or when diagnosing why a prompt is underperforming. Detects and fixes 37 credit-killing anti-patterns.
---

# Prompt Diagnostics — Anti-Pattern Detection and Repair

When the user pastes a prompt that is underperforming, scan for these 37 patterns and fix them silently. Flag only if the fix changes the user's original intent.

## Task Patterns (7)
1. **Vague task verb** — "help me with my code" → "Refactor getUserData() to use async/await and handle null returns"
2. **Two tasks in one** — "explain AND rewrite" → Split into Prompt 1 and Prompt 2
3. **No success criteria** — "make it better" → "Done when function passes tests and handles null"
4. **Over-permissive agent** — "do whatever it takes" → Explicit allowed + forbidden actions
5. **Emotional description** — "it's totally broken" → "Throws TypeError on line 43 when user is null"
6. **Build-the-whole-thing** — "build my entire app" → Decompose into scaffold → feature → polish
7. **Implicit reference** — "add the other thing" → Always restate the full task

## Context Patterns (6)
8. **Assumed prior knowledge** — "continue where we left off" → Include Memory Block
9. **No project context** — missing stack, role, experience → Add specifics
10. **Forgotten stack** — contradicts prior tech choice → Include Memory Block
11. **Hallucination invite** — "what do experts say?" → "Cite only sources you're certain of"
12. **Undefined audience** — "write for users" → "Non-technical B2B buyers, decision-maker level"
13. **No prior failures** — blank → "I already tried X, it failed because Y. Don't suggest X."

## Format Patterns (6)
14. **Missing output format** — "explain this" → "3 bullets, under 20 words each, summary at top"
15. **Implicit length** — "write a summary" → "Exactly 3 sentences"
16. **No role assignment** — blank → "You are a senior backend engineer specializing in X"
17. **Vague aesthetics** — "make it professional" → "Monochrome, 16px font, no decorative elements"
18. **No negative prompts (image)** — add: "no watermark, no blur, no extra fingers"
19. **Prose for Midjourney** — use comma-separated descriptors + flags

## Scope Patterns (6)
20. **No scope boundary** — "fix my app" → "Fix only login validation in src/auth.js"
21. **No stack constraints** — "build a React component" → "React 18, TS strict, Tailwind only"
22. **No stop conditions** — "build the feature" → Add checkpoints + review triggers
23. **No file path for IDE** — "update login" → "Update handleLogin() in src/pages/Login.tsx"
24. **Wrong template for tool** — adapt to tool-specific format
25. **Pasting entire codebase** — scope to relevant function only

## Reasoning Patterns (5)
26. **No CoT for logic task** — "which approach?" → "Think through both step by step"
27. **CoT on reasoning models** — "think step by step" on o3/R1 → REMOVE IT
28. **No self-check** — add "Verify output against constraints before finishing"
29. **Expects inter-session memory** — always re-provide Memory Block
30. **Contradicts prior decisions** — flag, resolve, include memory

## Agentic Patterns (7)
31. **No starting state** — "build REST API" → "Empty Node project, Express installed"
32. **No target state** — "add auth" → "auth.js with JWT verify, POST /login and /register"
33. **Silent agent** — add "After each step output: what was completed"
34. **Unlocked filesystem** — add "Only edit files inside src/"
35. **No human review trigger** — add "Stop and ask before deleting/adding deps/touching DB"
36. **Vague first turn** — front-load intent, scope, constraints, acceptance criteria
37. **Context rot** — new task = new session, compact at 50% context

## Output Format for Fixes

When fixing a prompt, output:
```
**Original issue:** [which patterns were detected]
**Fixed prompt:** [the rewritten prompt]
**Changes made:** [bullet list of what was fixed and why]
```
