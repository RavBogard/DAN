---
name: "dan:milestone"
description: "Chain the full workflow (research, plan, apply, unify, verify, bugsweep) for a milestone"
argument-hint: "[milestone-name | phase-number]"
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:milestone

Chain the complete DAN workflow for a milestone or phase: research -> plan -> apply -> unify -> verify -> bugsweep. This is the top-level orchestration command for autonomous execution.

## What It Does

1. Invokes `dan:research` for the target phase
2. Invokes `dan:plan` to generate execution plans
3. For each plan in dependency order:
   a. Invokes `dan:apply` to execute tasks
   b. Invokes `dan:unify` to close the loop
4. Invokes `dan:verify` to validate phase outputs
5. Invokes `dan:bugsweep` to find and fix remaining issues
6. Updates STATE.md to advance to next phase

## Execution Mode

**Orchestrator skill** that chains other skills. Each sub-skill manages its own execution mode (in-session or subagent).

## CLI Tools

State operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state get "Phase"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Status" "Milestone in progress"
```

<execution_flow>
Full workflow implementation in Phase 5 (Autonomy).
</execution_flow>
