---
phase: 3
slug: research-system
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-29
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node:test + node:assert) |
| **Config file** | none — existing from Phase 1 |
| **Quick run command** | `node --test bin/tests/` |
| **Full suite command** | `node --test bin/tests/` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test bin/tests/`
- **After every plan wave:** Run `node --test bin/tests/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 3-01-01 | 01 | 1 | RSRCH-02, RSRCH-05, RSRCH-06 | unit | `node --test bin/tests/test-research.cjs` | ⬜ pending |
| 3-01-02 | 01 | 1 | RSRCH-02, RSRCH-05, RSRCH-06 | integration | `node bin/dan-tools.cjs research status && node --test bin/tests/` | ⬜ pending |
| 3-02-01 | 02 | 2 | RSRCH-01, RSRCH-03, RSRCH-04 | grep | `grep -q "spawn_researchers" .claude/skills/dan-research/SKILL.md && grep -q "convergence_check" .claude/skills/dan-research/SKILL.md` | ⬜ pending |
| 3-02-02 | 02 | 2 | RSRCH-03, RSRCH-04, RSRCH-09 | grep | `grep -q "Research Findings" .claude/agents/dan-researcher.md && grep -q "Confidence Assessment" .claude/agents/dan-synthesizer.md` | ⬜ pending |
| 3-03-01 | 03 | 2 | RSRCH-07, RSRCH-08 | grep | `grep -q "gray_area" .claude/skills/dan-discuss/SKILL.md && grep -q "write_context" .claude/skills/dan-discuss/SKILL.md` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All Wave 0 test files created by Plan 01, Task 1:
- [x] `bin/tests/test-research.cjs` — stubs for convergence, gap tracking, diminishing returns

Plans 02 and 03 produce skill/agent markdown files verified via grep commands.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Parallel researchers spawn and return | RSRCH-03 | Requires Claude Code agent runtime | Run `/dan:research` and verify 4 agents spawn |
| Recursive pass triggers on gaps | RSRCH-01 | Requires full research cycle | Run research on a domain, verify second pass fires on gaps |
| Discuss captures decisions in CONTEXT.md | RSRCH-07 | Interactive session | Run `/dan:discuss`, answer questions, verify CONTEXT.md |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are grep-verified
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers unit-testable modules
- [x] No watch-mode flags
- [x] Feedback latency < 10s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
