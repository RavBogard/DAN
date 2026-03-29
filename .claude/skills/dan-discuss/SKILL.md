---
name: "dan:discuss"
description: "Deep interview phase to capture project intent, constraints, and success criteria"
argument-hint: "[topic]"
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:discuss

Run the discuss phase -- a structured interview that captures the user's intent, constraints, non-goals, and success criteria. Produces PROJECT.md, CONTEXT.md, and initial REQUIREMENTS.md.

## What It Does

1. Asks structured questions about project goals, constraints, tech preferences
2. Captures non-goals and anti-patterns to avoid
3. Produces `.planning/PROJECT.md` with key decisions table
4. Produces `.planning/CONTEXT.md` with user's vision
5. Produces `.planning/REQUIREMENTS.md` with traceable requirements

## Execution Mode

Runs **in-session** (interactive). Requires multiple rounds of user input. No agent spawning.

## CLI Tools

State operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Status" "Discussing"
```

<execution_flow>
Full workflow implementation in Phase 2 (Core Loop).
</execution_flow>
