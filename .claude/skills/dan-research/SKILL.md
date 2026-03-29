---
name: "dan:research"
description: "Spawn parallel researcher agents to investigate a topic or phase, then synthesize findings"
argument-hint: "[phase-number | topic]"
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:research

Spawn dan-researcher agents in parallel waves to investigate a topic or phase, then spawn a dan-synthesizer agent to merge findings into a coherent research document.

## What It Does

1. Parses the target (phase number or freeform topic)
2. Spawns parallel dan-researcher agents (one per research angle)
3. Each researcher produces a scoped findings file
4. Spawns dan-synthesizer agent to merge findings into `{phase}-RESEARCH.md`
5. Updates STATE.md with research completion status

## Execution Mode

Spawns **subagents** (dan-researcher, dan-synthesizer). Orchestrated from the skill level.

## CLI Tools

State operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Status" "Researching"
```

<execution_flow>
Full workflow implementation in Phase 3 (Research System).
</execution_flow>
