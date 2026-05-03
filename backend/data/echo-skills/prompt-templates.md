---
name: Prompt Templates
id: prompt_templates
description: Reference templates for generating AI prompts across different tool categories. Use alongside prompt_engineer skill when building prompts.
---

# Prompt Templates Reference

## Template A — Universal Task Prompt
```
Role: [expert identity relevant to the task]
Task: [single precise action verb + what to do]
Context: [relevant background, stack, constraints]
Format: [exact output shape, length, structure]
Constraints: [what MUST and MUST NOT happen]
Done when: [binary success criteria]
```

## Template B — Coding Task (IDE AI)
```
File: [exact file path]
Function: [exact function name or scope]
Current behavior: [what happens now]
Desired behavior: [what should happen instead]
Stack: [language, framework, version]
Do NOT touch: [files, functions, configs to leave alone]
Done when: [tests pass, behavior matches, no regressions]
```

## Template C — Refactor / Debug
```
File: [path]
Problem: [specific error, behavior, or smell]
Root cause (if known): [your hypothesis]
Fix scope: [only this function / only this file / these files]
Constraints: [preserve API, no new deps, maintain backward compat]
Verify: [how to confirm the fix works]
```

## Template D — Research / Analysis
```
Topic: [specific question or comparison]
Scope: [time period, geography, industry, etc.]
Depth: [overview / detailed / comprehensive]
Format: [bullet summary / table comparison / structured report]
Sources: [cite only what you're certain of. Say "uncertain" otherwise]
Length: [word or paragraph count]
Audience: [technical level and role]
```

## Template E — Content / Writing
```
Type: [blog post / email / docs / landing page / etc.]
Audience: [who reads this, their technical level]
Tone: [professional / conversational / technical / persuasive]
Length: [word count or section count]
Structure: [intro-body-conclusion / problem-solution / listicle]
Key points: [what MUST be included]
Avoid: [what to leave out]
CTA: [call to action if applicable]
```

## Template F — Code Review
```
Files to review: [paths]
Focus areas: [security / performance / readability / architecture]
Severity levels: [critical / warning / suggestion]
Format: file:line — severity — issue — suggested fix
Skip: [generated code, tests, vendored deps]
```

## Template G — File-Scope Task (IDE Agents)
```
## Scope
Only modify: [file path(s)]
Do NOT touch: [forbidden files]

## Task
[Precise description of the change]

## Current State
[What exists now — paste relevant code or describe]

## Target State
[What the code should look like or do after the change]

## Constraints
- [Stack version, naming conventions]
- No new dependencies without asking
- Preserve existing tests

## Done When
- [ ] [Specific check 1]
- [ ] [Specific check 2]
```

## Template H — Agentic Task (Autonomous AI)
```
## Starting State
[Current project state — what exists, what's installed]

## Target State
[Specific deliverable — files created, behavior produced, tests passing]

## Allowed Actions
- [Read files, write to src/, run tests]

## Forbidden Actions
- Do NOT delete files
- Do NOT add dependencies without asking
- Do NOT modify configs, .env, or CI

## Stop Conditions
Pause and ask before:
- Deleting any file
- Adding any external service
- Touching database schema
- Error unresolved in 2 attempts

## Checkpoints
After each step output: [step number]. [what was completed]
At the end, output full summary of files changed.
```

## Template I — Visual / Image AI
```
Subject: [specific, not vague]
Action/Pose: [what the subject is doing]
Setting: [where the scene takes place]
Style: [photorealistic / cinematic / anime / oil painting / etc.]
Mood: [dramatic / serene / eerie / joyful]
Lighting: [golden hour / studio / neon / overcast]
Color Palette: [dominant colors]
Composition: [wide shot / close-up / aerial / Dutch angle]
Aspect Ratio: [16:9 / 1:1 / 9:16]
Negative Prompts: [blurry, watermark, extra fingers, distortion]
```

## Template J — Video AI
```
Scene: [what happens in the shot]
Camera: [static / dolly / crane / tracking / handheld]
Duration: [seconds]
Style: [cinematic / documentary / animation]
Mood: [lighting, color grading, atmosphere]
Motion: [slow / moderate / fast / dynamic]
Reference: [film style or aesthetic reference]
```

## Template K — Voice AI (ElevenLabs)
```
Text: [the exact text to speak]
Emotion: [calm / excited / serious / warm]
Pacing: [slow / moderate / fast]
Emphasis: [words to stress]
Pauses: [where to pause, duration]
Voice: [voice ID or description]
```

## Template L — Prompt Decompiler
When user pastes an existing prompt to break down, adapt, simplify, or split:

**Break down:** Analyze structure → Role, Task, Constraints, Format, Weaknesses → Rewrite
**Adapt:** Original [source tool] → Adapted for [target tool] → Key changes
**Split:** Identify N tasks → Output N sequential prompts → "Run in order"
