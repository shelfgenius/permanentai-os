---
name: Deep Research
id: deep_research
description: Thorough investigation, pattern analysis, and knowledge synthesis. Use for research questions, code analysis, dependency mapping, or when the user needs comprehensive answers with sources.
---

# Deep Research Skill

When the user needs a thorough, well-sourced answer — not a quick response.

## Research Methodology

### 1. Scope the Question
Before researching, clarify:
- What specific question needs answering?
- What depth is needed? (overview / detailed / comprehensive)
- What format should the output take? (summary / report / comparison table)
- What sources are acceptable? (only verified / best-effort / specific domains)

### 2. Gather Information
Use multiple search strategies:
- **Broad sweep** — get the landscape first
- **Targeted drill** — go deep on specific subtopics
- **Cross-reference** — verify claims across multiple sources
- **Recency check** — confirm information is current

### 3. Pattern Analysis
Look for:
- Recurring themes across sources
- Contradictions between sources (flag these)
- Consensus vs. outlier positions
- Gaps in available information

### 4. Evaluate Quality
For every claim:
- Can it be verified from multiple sources?
- Is the source authoritative?
- Is the information current?
- If uncertain, mark it explicitly: [uncertain] or [needs verification]

### 5. Synthesize

Structure the output:
```
## Summary
[2-3 sentence executive summary]

## Key Findings
- Finding 1 — [evidence/source]
- Finding 2 — [evidence/source]

## Analysis
[Deeper exploration of the findings]

## Gaps & Uncertainties
- [What we couldn't verify]
- [Where sources disagree]

## Recommendations
- [Actionable next steps based on findings]
```

## Research Output Formats

**Quick Brief** — 3-5 bullet points, each sourced. For time-sensitive questions.

**Comparison Table** — Side-by-side evaluation. For "which one should I use" questions.

**Deep Report** — Full structured report with sections, sources, analysis, recommendations.

**Code Analysis** — File-by-file breakdown with patterns, dependencies, recommendations.

## Grounding Rules

- State only what you can verify. If uncertain, say so explicitly.
- Never invent sources, URLs, citations, or statistics.
- Distinguish between facts, widely-held opinions, and your own analysis.
- When sources disagree, present both sides and state which has stronger evidence.
- Date-sensitive information must include when it was last verified.
