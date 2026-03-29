---
name: "dan:unify"
description: "Close the loop on a completed plan by writing SUMMARY.md and updating state"
argument-hint: "[plan-path]"
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:unify

Close the execution loop for a completed plan. Reads task commits, deviations, and verification results to produce a SUMMARY.md file. Updates STATE.md and ROADMAP.md.

## What It Does

1. Reads the target PLAN.md and its task commits
2. Gathers deviations, decisions, and issues from execution
3. Produces `{phase}-{plan}-SUMMARY.md` with:
   - Frontmatter (dependency graph, tech-stack, key-files, decisions, metrics)
   - Accomplishments, task commits, files created/modified
   - Deviations from plan, issues encountered
4. Updates STATE.md (advance plan counter, add decisions, record metrics)
5. Updates ROADMAP.md (plan progress row)

## Execution Mode

Runs **in-session** (no agent spawning). Reads git log and plan files to produce summary.

## CLI Tools

State and roadmap operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Plan" "3 of 4 in current phase"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state get "Status"
```

<execution_flow>
Full workflow implementation in Phase 2 (Core Loop).
</execution_flow>
