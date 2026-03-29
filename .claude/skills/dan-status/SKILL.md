---
name: "dan:status"
description: "Show current project progress, blockers, and suggest the next action"
argument-hint: ""
disable-model-invocation: false
agent-skills:
  - dan-workflow
---

# dan:status

Show the current project state: phase, plan, progress, blockers, recent decisions, and a suggested next action. This is the only skill Claude can auto-invoke (disable-model-invocation is false) to proactively check project status.

## What It Does

1. Reads STATE.md for current position and progress
2. Reads ROADMAP.md for phase/plan overview
3. Reads recent SUMMARY.md files for context
4. Displays:
   - Current phase and plan
   - Progress bar and percentage
   - Active blockers or concerns
   - Recent decisions
   - Suggested next action (e.g., "Run dan:apply on 01-03-PLAN.md")

## Execution Mode

Runs **in-session** (no agent spawning). Read-only operation.

## CLI Tools

State operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state read
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state get "Status"
```

<execution_flow>
Full workflow implementation in Phase 2 (Core Loop).
</execution_flow>
