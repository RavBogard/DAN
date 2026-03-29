---
phase: 2
slug: core-loop
status: draft
nyquist_compliant: false
wave_0_complete: false
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

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 2-01-01 | 01 | 1 | LOOP-01 | integration | `node --test bin/tests/test-plan-workflow.cjs` | ❌ W0 | ⬜ pending |
| 2-01-02 | 01 | 1 | LOOP-02 | integration | `node --test bin/tests/test-plan-workflow.cjs` | ❌ W0 | ⬜ pending |
| 2-01-03 | 01 | 1 | LOOP-09 | unit | `node --test bin/tests/test-plan-lifecycle.cjs` | ❌ W0 | ⬜ pending |
| 2-02-01 | 02 | 2 | LOOP-03 | manual | Verify executor spawns and runs tasks | ❌ | ⬜ pending |
| 2-02-02 | 02 | 2 | LOOP-04 | manual | Verify qualifier grades independently | ❌ | ⬜ pending |
| 2-02-03 | 02 | 2 | LOOP-05 | unit | `node --test bin/tests/test-eq-protocol.cjs` | ❌ W0 | ⬜ pending |
| 2-02-04 | 02 | 2 | LOOP-06 | unit | `node --test bin/tests/test-eq-protocol.cjs` | ❌ W0 | ⬜ pending |
| 2-02-05 | 02 | 2 | LOOP-10 | unit | `node --test bin/tests/test-task-checkpoint.cjs` | ❌ W0 | ⬜ pending |
| 2-02-06 | 02 | 2 | LOOP-11 | manual | Verify diagnostic routing classifies correctly | ❌ | ⬜ pending |
| 2-03-01 | 03 | 3 | LOOP-07 | integration | `node --test bin/tests/test-unify-workflow.cjs` | ❌ W0 | ⬜ pending |
| 2-03-02 | 03 | 3 | LOOP-08 | unit | `node --test bin/tests/test-loop-closure.cjs` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `bin/tests/test-plan-workflow.cjs` — stubs for LOOP-01, LOOP-02 (plan creation and sizing)
- [ ] `bin/tests/test-plan-lifecycle.cjs` — stubs for LOOP-09 (lifecycle state transitions)
- [ ] `bin/tests/test-eq-protocol.cjs` — stubs for LOOP-05, LOOP-06 (four-status reporting, retry logic)
- [ ] `bin/tests/test-task-checkpoint.cjs` — stubs for LOOP-10 (atomic task checkpointing)
- [ ] `bin/tests/test-unify-workflow.cjs` — stubs for LOOP-07 (SUMMARY.md creation)
- [ ] `bin/tests/test-loop-closure.cjs` — stubs for LOOP-08 (orphan plan detection)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Executor spawns and runs tasks | LOOP-03 | Requires Claude Code agent runtime | Run `/dan:apply` on a test plan, verify tasks execute |
| Qualifier grades independently | LOOP-04 | Requires Claude Code agent runtime | Verify qualifier agent spawns and produces structured output |
| Diagnostic routing classifies correctly | LOOP-11 | LLM judgment, not deterministic | Introduce intentional failures, verify classification |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 8s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
