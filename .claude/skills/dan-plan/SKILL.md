---
name: "dan:plan"
description: "Spawn planner agent to create execution plans for a phase based on research findings"
argument-hint: "[phase-number]"
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:plan

Spawn a dan-planner agent to create execution plans for a phase. The planner reads research findings, REQUIREMENTS.md, and PROJECT.md to produce sequenced, dependency-aware PLAN.md files.

## What It Does

1. Reads `{phase}-RESEARCH.md` for the target phase
2. Spawns dan-planner agent to produce plan files
3. Planner creates `{phase}-{plan}-PLAN.md` files with:
   - YAML frontmatter (phase, plan, type, wave, depends_on, requirements)
   - Tasks with types (auto, checkpoint:*, tdd)
   - Verification steps and success criteria
4. Updates STATE.md with planning completion status

## Execution Mode

Spawns **dan-planner** subagent. One planner per phase.

## CLI Tools

State and frontmatter operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR frontmatter parse .planning/phases/01-foundation/01-01-PLAN.md
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Status" "Planning"
```

<execution_flow>
Full workflow implementation in Phase 2 (Core Loop).
</execution_flow>
