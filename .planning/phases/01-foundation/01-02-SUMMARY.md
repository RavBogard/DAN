---
phase: 01-foundation
plan: 02
subsystem: cli-tools
tags: [nodejs, cjs, templates, dependency-graph, topological-sort, progress-tracking]
dependency_graph:
  requires: [01-01]
  provides: [template-fill, dependency-analyze, phase-operations, progress-tracking]
  affects: [STATE.md, plan-generation, execution-ordering]
tech_stack:
  added: []
  patterns: [kahns-algorithm, wave-assignment, placeholder-templates, progress-bar-rendering]
key_files:
  created:
    - bin/lib/template.cjs
    - bin/lib/dependency.cjs
    - bin/lib/phase.cjs
    - bin/templates/plan.md
    - bin/templates/summary.md
    - bin/templates/state.md
    - bin/templates/project.md
    - bin/templates/config.json
    - bin/tests/test-template.cjs
    - bin/tests/test-dependency.cjs
    - bin/tests/test-phase.cjs
  modified:
    - bin/dan-tools.cjs
decisions:
  - "Kahn's algorithm for topological sort (deterministic, detects cycles naturally)"
  - "Wave assignment via recursive max-depth calculation"
  - "Templates use __dirname-relative paths (works regardless of cwd)"
  - "Progress bar width fixed at 10 characters for consistency"
metrics:
  duration: 6min
  completed: 2026-03-29
---

# Phase 1 Plan 2: Template, Dependency & Phase Operations Summary

**One-liner:** Template filling with placeholder replacement, Kahn's algorithm dependency analysis with wave grouping, and phase operations with atomic STATE.md progress tracking

## Objective

Build template filling, dependency analysis, phase operations, and progress tracking -- the remaining CLI tool capabilities that skills and agents need for plan generation and execution ordering.

## What Was Built

- **Template module** (bin/lib/template.cjs): Fills plan, summary, state, project, and config templates with placeholder replacement (PHASE, PLAN, PHASE_NAME, DATE, PADDED_PHASE, PADDED_PLAN)
- **5 template files** (bin/templates/): Plan skeleton with full frontmatter and XML task structure, summary with plan-vs-actual sections, state with all schema fields, project scaffold, default config
- **Dependency module** (bin/lib/dependency.cjs): Topological sort via Kahn's algorithm with cycle detection, wave assignment (wave 1 = no deps, wave N = max dep wave + 1), phase directory scanning with frontmatter parsing
- **Phase module** (bin/lib/phase.cjs): Find phase by number with auto-padding, list all phases with plan counts, advance-plan with atomic STATE.md updates (plan counter, progress bar, last activity), complete phase with advancement
- **Test coverage**: 39 new tests across 3 test files (template, dependency, phase), all passing. Full suite: 70 tests green.

## Plan vs Actual

| Aspect | Planned | Actual |
|--------|---------|--------|
| Tasks | 2 | 2 |
| Files created | 11 | 11 |
| Files modified | 1 | 1 |
| Duration | ~10min | 6min |
| TDD cycles | 2 | 2 (RED-GREEN for each) |

## Decisions Made

- **Kahn's algorithm** for topological sort: deterministic output with natural cycle detection via remaining-node check
- **Wave assignment** via recursive max-depth: simple, correct, no extra data structures needed
- **Templates use __dirname-relative paths**: works regardless of working directory, no config needed
- **Progress bar width 10 chars**: compact, readable, consistent rendering at all percentages
- **Deterministic sort order**: when plans have equal priority, sort by ID for reproducible output

## Deviations from Plan

None - plan executed exactly as written.

## Deferred Items

None.
