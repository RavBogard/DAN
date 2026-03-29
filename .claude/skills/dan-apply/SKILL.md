---
name: "dan:apply"
description: "Execute plan tasks with optional E/Q qualification loop"
argument-hint: "[plan-path | phase-number]"
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:apply

Execute plan tasks. Default mode is in-session execution. For plans requiring qualification, spawns a dan-qualifier agent to independently verify each task output.

## What It Does

1. Reads target PLAN.md file (from path or phase number)
2. Parses tasks, dependencies, and verification criteria
3. Executes tasks sequentially (or in waves per `wave` frontmatter)
4. For E/Q-enabled plans: spawns dan-qualifier to independently grade output
5. Commits each task atomically after verification passes
6. Handles deviations per deviation rules (auto-fix bugs, missing functionality, blocking issues)
7. Updates STATE.md progress after each task

## Execution Mode

Default: **in-session** execution. Spawns **dan-qualifier** subagent for E/Q protocol when plan specifies it.

## CLI Tools

State, config, and commit operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Plan" "2 of 4 in current phase"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR commit "feat(01-03): implement skill entry points" --files .claude/skills/dan-plan/SKILL.md
```

<execution_flow>
Full workflow implementation in Phase 2 (Core Loop).
</execution_flow>
