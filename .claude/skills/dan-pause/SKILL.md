---
name: "dan:pause"
description: "Save current session state for later resumption"
argument-hint: ""
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:pause

Save the current session state so work can be resumed later. Captures the current position, in-progress tasks, and any accumulated context into STATE.md.

## What It Does

1. Records current position (phase, plan, task) in STATE.md
2. Saves any in-progress work state
3. Updates "Last session" and "Stopped at" fields
4. Optionally creates a resume file with context snapshot

## Execution Mode

Runs **in-session** (no agent spawning). Quick state-save operation.

## CLI Tools

State operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Last session" "$(date -u +%Y-%m-%d)"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Stopped at" "Task 3 of 01-02-PLAN.md"
```

<execution_flow>
Full workflow implementation in Phase 5 (Autonomy).
</execution_flow>
