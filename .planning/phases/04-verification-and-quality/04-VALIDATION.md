---
phase: 4
slug: verification-and-quality
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-29
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node:test + node:assert) |
| **Quick run command** | `node --test bin/tests/` |
| **Full suite command** | `node --test bin/tests/` |
| **Estimated runtime** | ~12 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test bin/tests/`
- **After every plan wave:** Run `node --test bin/tests/`
- **Max feedback latency:** 12 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 4-01-01 | 01 | 1 | QUAL-01, QUAL-06 | unit | `node --test bin/tests/test-verify.cjs` | ⬜ pending |
| 4-01-02 | 01 | 1 | QUAL-04, QUAL-05 | integration | `node --test bin/tests/` | ⬜ pending |
| 4-02-01 | 02 | 2 | QUAL-01, QUAL-02 | grep | `grep -q "check_must_haves" .claude/skills/dan-verify/SKILL.md && grep -q "write_verification" .claude/skills/dan-verify/SKILL.md` | ⬜ pending |
| 4-02-02 | 02 | 2 | QUAL-03, QUAL-04, QUAL-05 | grep | `grep -q "bugsweep_loop" .claude/skills/dan-bugsweep/SKILL.md && grep -q "escalate" .claude/skills/dan-bugsweep/SKILL.md` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All Wave 0 test files created by Plan 01, Task 1 (TDD):
- [x] `bin/tests/test-verify.cjs` — covers QUAL-01, QUAL-04, QUAL-05, QUAL-06 (verification checks, fingerprinting, diminishing returns, report formatting)

Bugsweep cycle/fingerprint behaviors consolidated into test-verify.cjs (all logic lives in verify.cjs module).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Verifier agent checks deliverables autonomously | QUAL-02 | Requires Claude Code agent runtime | Run `/dan:verify` after a completed phase |
| Auditor agent finds and fixes issues | QUAL-03 | Requires Claude Code agent runtime | Run `/dan:bugsweep` with known issues |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are grep-verified
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers unit-testable modules
- [x] No watch-mode flags
- [x] Feedback latency < 12s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
