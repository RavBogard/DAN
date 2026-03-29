---
name: "dan:bugsweep"
description: "Spawn auditor agent in a recursive loop to find and fix bugs across a phase"
argument-hint: "[phase-number]"
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:bugsweep

Spawn a dan-auditor agent in a recursive loop to find and fix bugs across all code produced in a phase. The auditor runs until no more issues are found or the iteration limit is reached.

## What It Does

1. Reads all files created/modified in the target phase (from SUMMARY.md key-files)
2. Spawns dan-auditor agent to:
   - Run static analysis and test suites
   - Identify bugs, type errors, logic errors
   - Apply fixes with atomic commits
   - Re-run verification after each fix
3. Loops until clean pass or max iterations (default: 3)
4. Produces a bugsweep report

## Execution Mode

Spawns **dan-auditor** subagent. Recursive loop orchestrated from skill level.

## CLI Tools

State operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Status" "Bug sweeping"
```

<execution_flow>
Full workflow implementation in Phase 4 (Verification).
</execution_flow>
