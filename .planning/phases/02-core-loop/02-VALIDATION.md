---
phase: 2
slug: core-loop
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-29
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node:test + node:assert) |
| **Config file** | none — existing from Phase 1 |
| **Quick run command** | `node --test bin/tests/` |
| **Full suite command** | `node --test bin/tests/` |
| **Estimated runtime** | ~8 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test bin/tests/`
- **After every plan wave:** Run `node --test bin/tests/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 8 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 2-01-01 | 01 | 1 | LOOP-05, LOOP-06, LOOP-09, LOOP-11 | unit | `node --test bin/tests/test-plan-lifecycle.cjs bin/tests/test-eq-protocol.cjs bin/tests/test-diagnostic-routing.cjs` | ⬜ pending |
| 2-01-02 | 01 | 1 | LOOP-05, LOOP-06, LOOP-09 | integration | `node bin/dan-tools.cjs lifecycle validate DRAFT APPROVED && node bin/dan-tools.cjs qualify should-retry NEEDS_REVISION 1 && node --test bin/tests/` | ⬜ pending |
| 2-02-01 | 02 | 2 | LOOP-01, LOOP-02, LOOP-08 | grep | `grep -q "check_loop_closure" .claude/skills/dan-plan/SKILL.md && grep -q "spawn_planner" .claude/skills/dan-plan/SKILL.md` | ⬜ pending |
| 2-02-02 | 02 | 2 | LOOP-07, LOOP-08 | grep | `grep -q "identify_plan" .claude/skills/dan-unify/SKILL.md && grep -q "produce_summary" .claude/skills/dan-unify/SKILL.md` | ⬜ pending |
| 2-03-01 | 03 | 2 | LOOP-03, LOOP-04, LOOP-10 | grep | `grep -q "execute_and_qualify" .claude/skills/dan-apply/SKILL.md && grep -q "retry_counts" .claude/skills/dan-apply/SKILL.md` | ⬜ pending |
| 2-03-02 | 03 | 2 | LOOP-03, LOOP-04 | grep | `grep -q "Rule 1" .claude/agents/dan-executor.md && grep -q "Qualification Result" .claude/agents/dan-qualifier.md` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All Wave 0 test files are created by Plan 01, Task 1:
- [x] `bin/tests/test-plan-lifecycle.cjs` — tests for LOOP-09 (lifecycle state transitions)
- [x] `bin/tests/test-eq-protocol.cjs` — tests for LOOP-05, LOOP-06 (four-status reporting, retry logic)
- [x] `bin/tests/test-diagnostic-routing.cjs` — tests for LOOP-11 (failure classification)

Plans 02 and 03 produce skill/agent markdown files verified via grep commands (no test files needed).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Executor spawns and runs tasks | LOOP-03 | Requires Claude Code agent runtime | Run `/dan:apply` on a test plan, verify tasks execute |
| Qualifier grades independently | LOOP-04 | Requires Claude Code agent runtime | Verify qualifier agent spawns and produces structured output |
| Diagnostic routing classifies correctly | LOOP-11 | LLM judgment, not deterministic | Introduce intentional failures, verify classification |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are grep-verified skill/agent markdown
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all unit-testable modules (lifecycle.cjs, qualify.cjs)
- [x] No watch-mode flags
- [x] Feedback latency < 8s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
