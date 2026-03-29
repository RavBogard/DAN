---
phase: 1
slug: foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-28
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node:test + node:assert) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `node --test tests/` |
| **Full suite command** | `node --test tests/` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test tests/`
- **After every plan wave:** Run `node --test tests/`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 1-01-01 | 01 | 1 | FOUND-01 | unit | `node --test tests/cli-state.test.cjs` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | FOUND-02 | unit | `node --test tests/cli-template.test.cjs` | ❌ W0 | ⬜ pending |
| 1-01-03 | 01 | 1 | FOUND-03 | unit | `node --test tests/cli-git.test.cjs` | ❌ W0 | ⬜ pending |
| 1-01-04 | 01 | 1 | FOUND-04 | unit | `node --test tests/cli-deps.test.cjs` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | FOUND-05 | unit | `node --test tests/state-schema.test.cjs` | ❌ W0 | ⬜ pending |
| 1-02-02 | 02 | 1 | FOUND-06 | unit | `node --test tests/state-schema.test.cjs` | ❌ W0 | ⬜ pending |
| 1-02-03 | 02 | 1 | FOUND-10 | unit | `node --test tests/state-progress.test.cjs` | ❌ W0 | ⬜ pending |
| 1-02-04 | 02 | 1 | FOUND-11 | unit | `node --test tests/config.test.cjs` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 2 | FOUND-07 | manual | Verify skills discoverable via `/dan:` | ❌ | ⬜ pending |
| 1-03-02 | 03 | 2 | FOUND-08 | manual | Verify agent spawning works | ❌ | ⬜ pending |
| 1-03-03 | 03 | 2 | FOUND-09 | integration | Verify two-level hierarchy enforcement | ❌ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/` directory created
- [ ] `tests/cli-state.test.cjs` — stubs for FOUND-01 (atomic state read/write)
- [ ] `tests/cli-template.test.cjs` — stubs for FOUND-02 (template filling)
- [ ] `tests/cli-git.test.cjs` — stubs for FOUND-03 (atomic git commits)
- [ ] `tests/cli-deps.test.cjs` — stubs for FOUND-04 (dependency analysis)
- [ ] `tests/state-schema.test.cjs` — stubs for FOUND-05, FOUND-06 (state schemas)
- [ ] `tests/state-progress.test.cjs` — stubs for FOUND-10 (progress tracking)
- [ ] `tests/config.test.cjs` — stubs for FOUND-11 (config management)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Skills discoverable via `/dan:` prefix | FOUND-07 | Requires Claude Code runtime | Open Claude Code, type `/dan:` and verify completion list |
| Agent spawning from skills | FOUND-08 | Requires Claude Code runtime | Run a skill that spawns an agent, verify execution |
| Two-level hierarchy enforcement | FOUND-09 | Architecture verification | Confirm agent definitions don't reference subagent spawning |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
