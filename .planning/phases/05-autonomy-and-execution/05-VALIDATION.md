---
phase: 5
slug: autonomy-and-execution
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-29
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node:test + node:assert) |
| **Quick run command** | `node --test bin/tests/` |
| **Full suite command** | `node --test bin/tests/` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test bin/tests/`
- **After every plan wave:** Run `node --test bin/tests/`
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 5-01-01 | 01 | 1 | AUTO-04, AUTO-05, AUTO-08 | unit | `node --test bin/tests/test-milestone.cjs` | ⬜ pending |
| 5-01-02 | 01 | 1 | AUTO-06, AUTO-07, AUTO-08 | unit | `node --test bin/tests/test-session.cjs` | ⬜ pending |
| 5-02-01 | 02 | 2 | AUTO-01, AUTO-02, AUTO-03, AUTO-09 | grep | `grep -q "chain_phases" .claude/skills/dan-milestone/SKILL.md && grep -q "error_recovery" .claude/skills/dan-milestone/SKILL.md` | ⬜ pending |
| 5-02-02 | 02 | 2 | AUTO-08 | grep | `grep -q "phase_position" .claude/skills/dan-status/SKILL.md && grep -q "next_action" .claude/skills/dan-status/SKILL.md` | ⬜ pending |
| 5-03-01 | 03 | 2 | AUTO-06, AUTO-07 | grep | `grep -q "save_state" .claude/skills/dan-pause/SKILL.md && grep -q "restore_context" .claude/skills/dan-resume/SKILL.md` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All Wave 0 test files created by Plan 01 tasks (TDD):
- [x] `bin/tests/test-milestone.cjs` — stubs for AUTO-04, AUTO-05, AUTO-08 (wave execution, partitioning, progress)
- [x] `bin/tests/test-session.cjs` — stubs for AUTO-06, AUTO-07 (pause/resume state serialization)

Plans 02 and 03 produce skill markdown files verified via grep commands.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Milestone chains full pipeline | AUTO-01 | Requires full Claude Code agent orchestration | Run `/dan:milestone` on a test project |
| Parallel wave execution | AUTO-04 | Requires concurrent agent spawning | Run phase with 2+ independent plans |
| Error recovery across phases | AUTO-09 | Requires induced failure | Kill mid-phase, verify resume works |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are grep-verified
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers unit-testable modules
- [x] No watch-mode flags
- [x] Feedback latency < 15s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
