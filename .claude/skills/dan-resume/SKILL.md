---
name: "dan:resume"
description: "Restore session from STATE.md and continue where work left off"
argument-hint: ""
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:resume

Restore a previous session from STATE.md and continue execution from where work left off. Reads the last position, verifies commits exist, and resumes the appropriate skill.

## What It Does

1. Reads STATE.md for "Stopped at" position
2. Verifies previous commits exist in git history
3. Determines which skill to invoke (e.g., dan:apply for in-progress plan)
4. Loads accumulated context (decisions, blockers, pending todos)
5. Resumes execution from the saved position

## Execution Mode

Runs **in-session** initially, then delegates to the appropriate skill for continued execution.

## CLI Tools

State operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state get "Stopped at"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state read
```

<execution_flow>
Full workflow implementation in Phase 5 (Autonomy).
</execution_flow>
