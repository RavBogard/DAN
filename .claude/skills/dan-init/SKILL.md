---
name: "dan:init"
description: "Initialize .planning/ directory structure and run the discuss phase to capture project intent"
argument-hint: "[project-name]"
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:init

Initialize a new DAN-managed project. Creates the `.planning/` directory structure (PROJECT.md, STATE.md, ROADMAP.md, REQUIREMENTS.md, CONTEXT.md) and immediately enters the discuss phase to interview the user about their project.

## What It Does

1. Creates `.planning/` directory with all required files
2. Creates `.planning/dan.config.json` with default settings
3. Transitions into `dan:discuss` to capture project intent

## Execution Mode

Runs **in-session** (no agent spawning). This is an interactive skill that requires user input.

## CLI Tools

State operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Status" "In progress"
```

<execution_flow>
Full workflow implementation in Phase 2 (Core Loop).
</execution_flow>
