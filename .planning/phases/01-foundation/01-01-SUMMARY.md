---
phase: 01-foundation
plan: 01
subsystem: cli-tools
tags: [nodejs, cjs, atomic-writes, git, yaml-parser, state-management]

# Dependency graph
requires: []
provides:
  - "CLI router (dan-tools.cjs) with subcommand dispatch"
  - "Core utilities: atomicWriteFileSync, execGit, output, error, toPosixPath, loadConfig"
  - "State read/get/set/patch operations on STATE.md"
  - "Config get/set with defaults merge on dan.config.json"
  - "YAML frontmatter parse/serialize for plans, skills, agents"
  - "Git commit wrapper with structured JSON result"
affects: [01-02, 01-03, 01-04, core-loop, research-system, verification, autonomy]

# Tech tracking
tech-stack:
  added: [node-built-ins-only]
  patterns: [atomic-temp-rename-write, cli-subcommand-router, regex-state-parsing, execFileSync-git]

key-files:
  created:
    - bin/dan-tools.cjs
    - bin/lib/core.cjs
    - bin/lib/state.cjs
    - bin/lib/config.cjs
    - bin/lib/frontmatter.cjs
    - bin/lib/commit.cjs
    - bin/tests/test-core.cjs
    - bin/tests/test-modules.cjs
    - .planning/dan.config.json
  modified: []

key-decisions:
  - "Used execFileSync instead of execSync for git operations to prevent shell injection"
  - "YAML parser preserves zero-prefixed numbers as strings (01 stays '01' not 1)"
  - "Atomic writes use temp+rename pattern (PID-based temp file) unlike GSD's plain writeFileSync"

patterns-established:
  - "CLI subcommand router: dan-tools.cjs dispatches to lib/*.cjs modules via switch"
  - "Atomic write: all state file writes go through atomicWriteFileSync (temp+rename)"
  - "JSON output: all CLI tools output JSON to stdout, @file: for >50KB payloads"
  - "State field regex: **Field:** value and Field: value patterns parsed by extractField"
  - "TDD workflow: RED (failing tests) -> GREEN (implementation) -> commit per phase"

requirements-completed: [FOUND-01, FOUND-03, FOUND-05, FOUND-06, FOUND-11]

# Metrics
duration: 6min
completed: 2026-03-29
---

# Phase 1 Plan 01: CLI Tools Foundation Summary

**dan-tools.cjs CLI router with core utilities, state/config/frontmatter/commit modules using atomic temp+rename writes and execFileSync git operations**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-29T14:08:01Z
- **Completed:** 2026-03-29T14:14:22Z
- **Tasks:** 2
- **Files created:** 9

## Accomplishments
- CLI router (dan-tools.cjs) with --cwd and --raw flags dispatching to 4 lib modules
- Core utilities with true atomic writes (temp+rename), safe git via execFileSync, and large payload handling
- State module reading/writing STATE.md with regex field parsing and atomic updates
- Config module with defaults merge, dot notation access, and atomic writes
- Frontmatter parser handling YAML subset: key-value, arrays, nested objects, booleans, zero-prefixed strings
- Git commit module with structured JSON result and commit_docs config check
- 31 tests across 2 test files, all passing

## Task Commits

Each task was committed atomically (TDD: test then implementation):

1. **Task 1: Core utilities and CLI router**
   - `1bd07a7` (test: failing tests for core + router)
   - `536c098` (feat: implement core.cjs and dan-tools.cjs)
2. **Task 2: State, config, frontmatter, and commit modules**
   - `5788c2f` (test: failing tests for all 4 modules)
   - `0cf587b` (feat: implement all 4 modules + dan.config.json)

## Files Created/Modified
- `bin/dan-tools.cjs` - CLI router with --cwd, --raw flags and subcommand dispatch
- `bin/lib/core.cjs` - 6 shared utilities: output, error, atomicWriteFileSync, execGit, toPosixPath, loadConfig
- `bin/lib/state.cjs` - STATE.md read/get/set/patch with regex field parsing
- `bin/lib/config.cjs` - dan.config.json get/set with defaults merge
- `bin/lib/frontmatter.cjs` - YAML frontmatter parse/serialize with nested object support
- `bin/lib/commit.cjs` - Git commit with file staging and structured JSON result
- `bin/tests/test-core.cjs` - 15 tests for core utilities and router
- `bin/tests/test-modules.cjs` - 16 tests for state, config, frontmatter, commit
- `.planning/dan.config.json` - Default config with mode, granularity, autonomy_level, model_profile, workflow

## Decisions Made
- Used execFileSync (not execSync) for git operations to prevent shell injection -- plan specified this explicitly
- YAML parser preserves zero-prefixed numbers as strings (e.g., plan "01" stays "01" not number 1) -- discovered during TDD when test caught the coercion
- Implemented true atomic writes (temp file with PID suffix + rename) as specified, unlike GSD's plain writeFileSync

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Zero-prefixed number coercion in YAML parser**
- **Found during:** Task 2 (frontmatter module implementation)
- **Issue:** YAML parser converted `plan: 01` to number 1 instead of string "01"
- **Fix:** Added check for zero-prefixed strings in parseYamlValue to preserve them as strings
- **Files modified:** bin/lib/frontmatter.cjs
- **Verification:** Test "frontmatter parse extracts YAML and body" passes with strict equality
- **Committed in:** 0cf587b (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug fix)
**Impact on plan:** Essential correctness fix for plan frontmatter parsing. No scope creep.

## Issues Encountered
- `node --test bin/tests/` directory syntax not supported in Node v24 -- resolved by specifying test files explicitly

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- CLI tools foundation is complete and tested
- Plan 01-02 (template filling, dependency analysis, phase operations) can proceed -- it depends on core.cjs and state.cjs which are now available
- All lib modules export their handle functions for router dispatch
- All write operations use atomicWriteFileSync as required by FOUND-01

---
*Phase: 01-foundation*
*Completed: 2026-03-29*
