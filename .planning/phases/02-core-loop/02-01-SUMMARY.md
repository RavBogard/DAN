---
phase: 02-core-loop
plan: 01
subsystem: core-loop-modules
tags: [lifecycle, qualifier, state-machine, retry-logic, diagnostic-routing, cli]
dependency_graph:
  requires: [bin/lib/core.cjs, bin/lib/frontmatter.cjs]
  provides: [bin/lib/lifecycle.cjs, bin/lib/qualify.cjs, frontmatter-set-subcommand]
  affects: [bin/dan-tools.cjs]
tech_stack:
  added: []
  patterns: [frozen-constants, keyword-heuristic-classifier, dot-notation-nested-field-access]
key_files:
  created:
    - bin/lib/lifecycle.cjs
    - bin/lib/qualify.cjs
    - bin/tests/test-plan-lifecycle.cjs
    - bin/tests/test-eq-protocol.cjs
    - bin/tests/test-diagnostic-routing.cjs
  modified:
    - bin/dan-tools.cjs
    - bin/lib/frontmatter.cjs
decisions:
  - "classifyFailure uses keyword heuristics (not LLM); skills can override with LLM judgment"
  - "parseYamlValue reused for frontmatter set type coercion (consistent with existing parse)"
  - "frontmatter set supports dot-notation for nested fields (e.g., must_haves.truths)"
metrics:
  duration: 4min
  completed: "2026-03-29T15:09:35Z"
  tasks_completed: 2
  tasks_total: 2
  tests_added: 56
  tests_total: 126
---

# Phase 02 Plan 01: Lifecycle & Qualifier Modules Summary

Plan lifecycle state machine with 5-state transitions, qualifier output parser with 4-status routing, retry cap at 3 with escalation, keyword-based diagnostic classifier (intent/spec/code), and frontmatter set CLI subcommand for in-place field updates.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Plan lifecycle state machine and qualifier output parser modules (TDD) | 7dbb401, 5f29d72 | lifecycle.cjs, qualify.cjs, 3 test files |
| 2 | Register lifecycle, qualify, and frontmatter set in CLI router | 0c2261f | dan-tools.cjs, frontmatter.cjs |

## Implementation Details

### lifecycle.cjs
- PLAN_STATES: DRAFT, APPROVED, IN_PROGRESS, COMPLETED, ABANDONED (frozen)
- VALID_TRANSITIONS: frozen map enforcing allowed transitions
- validateTransition(from, to): returns { valid, reason } with descriptive errors for unknown/invalid states
- getNextStates(state): returns array of allowed next states
- isTerminal(state): returns true for COMPLETED and ABANDONED
- handle() for CLI dispatch: validate and next subcommands

### qualify.cjs
- QUALIFICATION_STATUSES: PASS, PASS_WITH_CONCERNS, NEEDS_REVISION, FAIL (frozen)
- parseQualifierOutput(text): regex-based extraction of task, status (or Grade alias), criteria checklist, evidence, issues from structured markdown
- shouldRetry(status, retryCount, maxRetries=3): PASS/PASS_WITH_CONCERNS stop, NEEDS_REVISION retries up to cap then escalates, FAIL always escalates
- classifyFailure(taskSpec, evidence, objective): keyword heuristic checking all three inputs for intent patterns (wrong goal, wrong problem, not what was asked), spec patterns (ambiguous, incomplete, contradicts, missing requirement), defaulting to code
- handle() for CLI dispatch: parse, should-retry, classify subcommands

### frontmatter set subcommand
- `dan-tools.cjs frontmatter set <file> <field> <value>` reads, parses, updates, serializes, and atomically writes
- Supports dot-notation for nested fields (e.g., `must_haves.truths`)
- Uses parseYamlValue for type coercion consistent with existing frontmatter parsing

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- 56 new tests across 3 test files all passing
- 126 total tests (70 existing + 56 new) all passing
- CLI subcommands manually verified: lifecycle validate, lifecycle next, qualify should-retry, frontmatter set

## Self-Check: PASSED

All 7 files verified present. All 3 commits verified in git log.
