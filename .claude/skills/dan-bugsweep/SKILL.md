---
name: "dan:bugsweep"
description: "Spawn auditor agent in a recursive loop to find and fix bugs across a phase"
argument-hint: "[phase-number]"
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:bugsweep

Spawn a dan-auditor agent in a recursive loop to find and fix bugs across all code produced in a phase. The auditor runs until no more issues are found or the iteration limit is reached.

## What It Does

1. Reads all files created/modified in the target phase (from SUMMARY.md key-files)
2. Spawns dan-auditor agent to:
   - Run static analysis and test suites
   - Identify bugs, type errors, logic errors
   - Apply fixes with atomic commits
   - Re-run verification after each fix
3. Loops until clean pass or max iterations (default: 3)
4. Produces a bugsweep report

## Execution Mode

Spawns **dan-auditor** subagent. Recursive loop orchestrated from skill level.

## CLI Tools

State operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Status" "Bug sweeping"
```

<execution_flow>

<step name="load_phase">
## Step 1: Load Phase

Parse the phase number argument. Resolve the phase directory. Collect key files from all SUMMARY.md files.

```bash
# Resolve phase directory
PHASE_DIR=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" phase find "$PHASE_NUM")
PADDED=$(printf '%02d' "$PHASE_NUM")
```

Read all `*-SUMMARY.md` files in the phase directory. Extract the `key-files` frontmatter from each to build the list of files the auditor should inspect.

Initialize loop state:
```
MAX_CYCLES = 3
cycle = 0
previous_issues = []
```

```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Status" "Bug sweeping phase $PHASE_NUM"
```
</step>

<step name="bugsweep_loop">
## Step 2: Bugsweep Loop (bugsweep_loop)

Core recursive loop. Runs while `cycle < MAX_CYCLES`:

### 2a. Increment cycle

```
cycle += 1
```

### 2b. Spawn Verifier (fresh each cycle)

Spawn a **dan-verifier** agent to produce a fresh VERIFICATION.md. This ensures the auditor always works from current state, not stale results.

```
Task(
  prompt="You are verifying Phase {PHASE_NUM} deliverables (bugsweep cycle {cycle}).

Read the plan files and run verification commands:
  node \"$HOME/.claude/dan/bin/dan-tools.cjs\" --cwd \"$PROJECT_DIR\" verify artifacts {plan-path}
  node \"$HOME/.claude/dan/bin/dan-tools.cjs\" --cwd \"$PROJECT_DIR\" verify key-links {plan-path}
  node \"$HOME/.claude/dan/bin/dan-tools.cjs\" --cwd \"$PROJECT_DIR\" verify phase-completeness {PHASE_NUM}
  node --test bin/tests/

Write results to: {PHASE_DIR}/{PADDED}-VERIFICATION.md",
  subagent_type="dan-verifier",
  description="verify cycle {cycle}"
)
```

### 2c. Parse VERIFICATION.md

Read the generated VERIFICATION.md. Extract:
- `status` from frontmatter
- Issues list from the "Issues Found" section (numbered list items)

### 2d. Check for clean pass

If no issues found (status == "passed" and issues list is empty): go to `complete`.

### 2e. Check for diminishing returns (cycle > 1)

If `cycle > 1`, compare current issues to previous cycle's issues using the CLI fingerprinting tool:

```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" verify recurring \
  --current '["issue 1 text", "issue 2 text"]' \
  --previous '["prev issue 1", "prev issue 2"]'
```

Parse the JSON output: `{ recurring_count, total_current, ratio, should_escalate }`.

If `should_escalate` is true (recurring ratio > 50%): go to `escalate`.

### 2f. Update previous issues

Set `previous_issues = current_issues` (the raw issue text list).

### 2g. Spawn Auditor

Spawn a **dan-auditor** agent with the issues to fix:

```
Task(
  prompt="You are fixing issues found during Phase {PHASE_NUM} verification (bugsweep cycle {cycle}).

Read the verification report: {PHASE_DIR}/{PADDED}-VERIFICATION.md

Issues to address:
{numbered issues list}

Key files in this phase:
{key_files list from SUMMARY.md files}

For each issue:
1. Classify it first:
   node \"$HOME/.claude/dan/bin/dan-tools.cjs\" --cwd \"$PROJECT_DIR\" qualify classify-failure \"<issue-description>\"
2. If classification is 'code': fix it, run tests, commit atomically:
   node \"$HOME/.claude/dan/bin/dan-tools.cjs\" --cwd \"$PROJECT_DIR\" commit \"fix(phase-{N}): <description>\" --files <changed-files>
3. If classification is 'intent' or 'spec': escalate (do not fix).

After all fixes, run the test suite: node --test bin/tests/
Report what was fixed and what was escalated.",
  subagent_type="dan-auditor",
  description="fix cycle {cycle}"
)
```

### 2h. Check cycle limit

If `cycle == MAX_CYCLES`: go to `escalate`.
Otherwise: go back to step 2a (next cycle).
</step>

<step name="escalate">
## Step 3: Escalate

Reached when: max cycles exhausted OR diminishing returns detected.

Update VERIFICATION.md bugsweep history table with cycle results.

```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Status" "Bugsweep escalated after $cycle cycles"
```

Report to user:
```
## Bugsweep Escalated

**Phase:** {PHASE_NUM}
**Cycles completed:** {cycle}
**Reason:** {max cycles reached | diminishing returns detected}
**Remaining issues:** {count}

### Issues Requiring Human Attention

{numbered list of remaining issues with classification and evidence}

### Bugsweep History

| Cycle | Issues Found | Issues Fixed | Recurring | Action |
|-------|-------------|-------------|-----------|--------|
| 1     | N           | M           | -         | fix    |
| 2     | N           | M           | K         | fix/escalate |
```
</step>

<step name="complete">
## Step 4: Complete

Reached when verification passes with no issues.

Update VERIFICATION.md: set `status: passed`, `bugsweep_cycles: {cycle}`.

```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Status" "Phase $PHASE_NUM verified clean after $cycle cycles"
```

Report to user:
```
## Bugsweep Complete

**Phase:** {PHASE_NUM}
**Status:** Clean pass
**Cycles:** {cycle}
**All issues resolved.** Phase deliverables verified.
```
</step>

## Constraints

- **Skill orchestrates the loop:** The bugsweep cycle lives in this skill, NOT in the auditor agent. Agents execute one pass; the skill decides whether to loop.
- **Fresh verifier each cycle:** Every cycle spawns a NEW dan-verifier to prevent stale results.
- **Hard cap:** Maximum 3 cycles. Non-negotiable.
- **Diminishing returns:** Uses CLI fingerprinting to detect recurring issues. Escalates if > 50% of issues recur.
- **Two-level hierarchy:** This skill spawns dan-verifier and dan-auditor. Neither agent spawns sub-agents.
- **Auditor classifies before fixing:** Every issue goes through diagnostic routing (intent/spec/code) before any fix attempt.

</execution_flow>
