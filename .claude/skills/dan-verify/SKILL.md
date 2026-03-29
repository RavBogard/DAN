---
name: "dan:verify"
description: "Spawn verifier agent to validate phase outputs against requirements and success criteria"
argument-hint: "[phase-number]"
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:verify

Spawn a dan-verifier agent to validate all phase outputs against REQUIREMENTS.md and each plan's success criteria.

## What It Does

1. Reads all SUMMARY.md files for the target phase
2. Reads REQUIREMENTS.md for traceable requirements
3. Spawns dan-verifier agent to:
   - Run automated verification commands from each plan
   - Cross-check requirements coverage
   - Validate all artifacts exist and are correct
   - Produce a verification report
4. Updates STATE.md with verification results

## Execution Mode

Spawns **dan-verifier** subagent. Verifier has read-only access (no Write tool).

## CLI Tools

State operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Status" "Verifying"
```

<execution_flow>
Full workflow implementation in Phase 4 (Verification).
</execution_flow>
