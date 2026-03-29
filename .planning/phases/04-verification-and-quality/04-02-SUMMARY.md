---
phase: 04-verification-and-quality
plan: 02
subsystem: verification
tags: [verify, bugsweep, agent-prompts, goal-backward, diagnostic-routing]

requires:
  - phase: 04-verification-and-quality
    provides: verify.cjs CLI module with artifact/key-link/completeness/fingerprinting checks
provides:
  - Complete dan:verify skill execution_flow with CLI-backed verification
  - Complete dan:bugsweep skill execution_flow with recursive 3-cycle loop and diminishing returns
  - Enhanced dan-verifier agent with goal-backward framework and VERIFICATION.md template
  - Enhanced dan-auditor agent with classifyFailure diagnostic routing and atomic fix protocol
affects: [05-autonomy-and-polish]

tech-stack:
  added: []
  patterns: [goal-backward-verification, bugsweep-recursive-loop, diagnostic-classification-before-fix]

key-files:
  created: []
  modified:
    - .claude/skills/dan-verify/SKILL.md
    - .claude/skills/dan-bugsweep/SKILL.md
    - .claude/agents/dan-verifier.md
    - .claude/agents/dan-auditor.md

key-decisions:
  - "Verify skill references CLI tools for all deterministic checks (no inline verification logic in agent prompts)"
  - "Bugsweep loop lives in skill, not agent -- agents execute one pass, skill decides loop continuation"
  - "Verifier includes stub detection patterns (TODO, TBD, hardcoded returns, trivially small files)"

patterns-established:
  - "Goal-backward verification: Phase Goal -> Truths -> Artifacts -> Key Links -> Completeness -> Requirements"
  - "Diagnostic classification mandatory before any fix attempt in auditor"
  - "Fresh verifier spawn each bugsweep cycle to prevent stale VERIFICATION.md reads"

requirements-completed: [QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05, QUAL-06]

duration: 4min
completed: 2026-03-29
---

# Phase 4 Plan 02: Skill and Agent Enhancement Summary

**Complete execution_flow for dan:verify and dan:bugsweep skills with enhanced verifier/auditor agent prompts using goal-backward verification and diagnostic classification**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-29T16:32:44Z
- **Completed:** 2026-03-29T16:36:18Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- dan:verify skill has full 5-step execution_flow (parse_phase, load_phase_context, update_state, spawn_verifier with check_must_haves, report_results) referencing CLI verify commands
- dan:bugsweep skill has full 4-step execution_flow (load_phase, bugsweep_loop with MAX_CYCLES=3, escalate, complete) with diminishing returns detection via CLI fingerprinting
- dan-verifier agent enhanced with goal-backward verification framework, CLI command references, VERIFICATION.md template, stub detection, and evidence requirements
- dan-auditor agent enhanced with diagnostic classification protocol via classifyFailure CLI, fix protocol with atomic commits, re-verification, escalation report format, and boundary reinforcement

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify and bugsweep skill execution_flows** - `7de50d3` (feat)
2. **Task 2: Enhance verifier and auditor agent prompts** - `fac1acf` (feat)

## Files Created/Modified
- `.claude/skills/dan-verify/SKILL.md` - Complete execution_flow with 5 steps for spawning verifier and reporting results
- `.claude/skills/dan-bugsweep/SKILL.md` - Complete execution_flow with recursive bugsweep loop, circuit breakers, and escalation
- `.claude/agents/dan-verifier.md` - Goal-backward framework, CLI commands, VERIFICATION.md template, stub detection, evidence requirements
- `.claude/agents/dan-auditor.md` - Diagnostic classification protocol, fix protocol, re-verification, escalation report format, boundaries

## Decisions Made
- Verify skill references CLI tools for all deterministic checks -- keeps agent prompts focused on reasoning, not inline logic
- Bugsweep loop orchestrated at skill level (not agent level) -- respects two-level hierarchy rule
- Verifier includes stub detection patterns to catch incomplete implementations (TODO, TBD, hardcoded returns, small files)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- All Phase 4 plans complete (01: verify CLI module, 02: skill and agent prompts)
- Phase verification and bugsweep skills are fully functional for use on any phase
- Ready for Phase 5 (Autonomy and Polish)

---
*Phase: 04-verification-and-quality*
*Completed: 2026-03-29*
