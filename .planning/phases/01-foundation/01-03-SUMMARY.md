---
phase: 01-foundation
plan: 03
subsystem: skill-entry-points
tags: [skills, frontmatter, workflow-protocol, claude-code-skills, orchestration]

# Dependency graph
requires: [01-01]
provides:
  - "12 user-invocable dan:* skill entry points with frontmatter invocation control"
  - "Shared dan-workflow skill with loop, E/Q, diagnostic, state, two-level, and fresh context protocols"
affects: [01-04, core-loop, research-system, verification, autonomy]

# Tech tracking
tech-stack:
  added: [claude-code-skills-frontmatter]
  patterns: [agent-skills-injection, disable-model-invocation-control, two-level-orchestration]

key-files:
  created:
    - .claude/skills/dan-init/SKILL.md
    - .claude/skills/dan-discuss/SKILL.md
    - .claude/skills/dan-research/SKILL.md
    - .claude/skills/dan-plan/SKILL.md
    - .claude/skills/dan-apply/SKILL.md
    - .claude/skills/dan-unify/SKILL.md
    - .claude/skills/dan-verify/SKILL.md
    - .claude/skills/dan-bugsweep/SKILL.md
    - .claude/skills/dan-milestone/SKILL.md
    - .claude/skills/dan-status/SKILL.md
    - .claude/skills/dan-pause/SKILL.md
    - .claude/skills/dan-resume/SKILL.md
    - .claude/skills/dan-workflow/SKILL.md
  modified: []

key-decisions:
  - "dan:status is the only skill with disable-model-invocation: false, allowing Claude to auto-check project status"
  - "dan-workflow is a context skill (no colon in name) injected via agent-skills frontmatter, not user-invocable"
  - "All skills reference dan-tools.cjs via $HOME/.claude/dan/bin/dan-tools.cjs --cwd $PROJECT_DIR pattern"

patterns-established:
  - "Skill frontmatter: name, description, argument-hint, disable-model-invocation, agent-skills"
  - "agent-skills: [dan-workflow] injects shared protocol into any skill or agent context"
  - "execution_flow placeholder pattern for phased implementation"

requirements-completed: [FOUND-07]

# Metrics
duration: 4min
completed: 2026-03-29
---

# Phase 1 Plan 03: Skill Entry Points Summary

**13 SKILL.md files (12 user-invocable dan:* entry points plus shared dan-workflow protocol) with frontmatter invocation control and CLI tool references**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T14:18:13Z
- **Completed:** 2026-03-29T14:22:00Z
- **Tasks:** 1
- **Files created:** 13

## Accomplishments

- 12 skill entry points under `.claude/skills/dan-*/SKILL.md` with valid YAML frontmatter
- Each skill has name, description, argument-hint, disable-model-invocation, and agent-skills fields
- All workflow skills (init, discuss, research, plan, apply, unify, verify, bugsweep, milestone, pause, resume) have disable-model-invocation: true
- dan:status has disable-model-invocation: false (only skill Claude can auto-invoke)
- dan-workflow shared protocol skill with 6 sections: loop protocol, E/Q protocol, diagnostic routing, state protocol, two-level rule, fresh context rule
- All skills reference `bin/dan-tools.cjs` for state operations with `--cwd $PROJECT_DIR` pattern

## Task Commits

1. **Task 1: Skill entry points and shared workflow skill**
   - `33da107` (feat: create 13 skill entry points with shared workflow protocol)

## Files Created/Modified

- `.claude/skills/dan-init/SKILL.md` - Initialize .planning/ and run discuss phase
- `.claude/skills/dan-discuss/SKILL.md` - Deep interview to capture project intent
- `.claude/skills/dan-research/SKILL.md` - Parallel researcher agents + synthesizer
- `.claude/skills/dan-plan/SKILL.md` - Spawn planner for phase plan generation
- `.claude/skills/dan-apply/SKILL.md` - Execute plan tasks with optional E/Q
- `.claude/skills/dan-unify/SKILL.md` - Close loop with SUMMARY.md
- `.claude/skills/dan-verify/SKILL.md` - Validate phase outputs against requirements
- `.claude/skills/dan-bugsweep/SKILL.md` - Recursive auditor for bug detection
- `.claude/skills/dan-milestone/SKILL.md` - Chain full workflow for a milestone
- `.claude/skills/dan-status/SKILL.md` - Show progress and suggest next action
- `.claude/skills/dan-pause/SKILL.md` - Save session state for later
- `.claude/skills/dan-resume/SKILL.md` - Restore session from STATE.md
- `.claude/skills/dan-workflow/SKILL.md` - Shared protocol: loop, E/Q, diagnostic, state, two-level, fresh context

## Decisions Made

- dan:status is the only skill with `disable-model-invocation: false` -- allows Claude to proactively check project status without user explicitly invoking it
- dan-workflow uses no colon in name (it is a context skill, not user-invocable) -- injected via `agent-skills` frontmatter reference
- All skills use `$HOME/.claude/dan/bin/dan-tools.cjs --cwd $PROJECT_DIR` pattern for CLI references -- portable across projects

## Deviations from Plan

None -- plan executed exactly as written.

## Self-Check: PASSED

All 14 files verified present. Commit 33da107 verified in git history.

---
*Phase: 01-foundation*
*Completed: 2026-03-29*
