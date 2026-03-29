---
name: "dan:milestone"
description: "Chain the full workflow (research, plan, apply, unify, verify, bugsweep) for a milestone"
argument-hint: "[milestone-name | phase-number] [--all]"
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:milestone

Chain the complete DAN workflow for a milestone or phase: research -> plan -> apply -> unify -> verify -> bugsweep. This is the top-level orchestration command for autonomous execution.

## What It Does

1. Invokes `dan:research` for the target phase
2. Invokes `dan:plan` to generate execution plans
3. For each plan in dependency order:
   a. Invokes `dan:apply` to execute tasks
   b. Invokes `dan:unify` to close the loop
4. Invokes `dan:verify` to validate phase outputs
5. Invokes `dan:bugsweep` to find and fix remaining issues
6. Updates STATE.md to advance to next phase

## Execution Mode

**Orchestrator skill** that chains other skills. Each sub-skill manages its own execution mode (in-session or subagent).

## CLI Tools

State operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state get "Phase"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Status" "Milestone in progress"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR milestone status
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR milestone pipeline-order
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR milestone validate-wave {phaseDir}
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR milestone record-error {phase} {stage} {reason}
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR milestone progress
```

<execution_flow>

<step name="approval_gate" priority="first">
## Step 1: Approval Gate

Determine the scope of execution based on the invocation argument.

### 1a. Roadmap-level approval (--all flag)

<if condition="invoked with --all flag">

This is a roadmap-level execution request. Show the full milestone scope:

```bash
STATUS_JSON=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" milestone status)
PROGRESS_JSON=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" milestone progress)
```

Display to user:
```
## Roadmap-Level Execution

**Milestone:** {milestone name from STATUS_JSON}
**Phases remaining:** {phases_remaining from STATUS_JSON}
**Plans estimated:** {total_plans from PROGRESS_JSON}
**Progress so far:** {percent from PROGRESS_JSON}%

This will run ALL remaining phases autonomously:
{list each remaining phase with name}

After approval, execution proceeds with no further human gates
until completion or error escalation.

Approve? (yes/no)
```

If user declines: stop immediately. Report "Milestone execution declined."

If user approves: record approval in STATE.md:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Status" "Milestone approved for full execution"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state patch '{"milestone_approval": "roadmap", "approved_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}'
```

Set `SCOPE = "all"`.
</if>

### 1b. Milestone-level approval (phase number or name)

<if condition="invoked with phase number or milestone name (no --all)">

This is a single-phase or milestone-scoped execution request.

```bash
STATUS_JSON=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" milestone status)
```

Display to user:
```
## Milestone Execution

**Current phase:** {current_phase from STATUS_JSON}
**Phase status:** {status from STATUS_JSON}
**Pipeline stage:** {pipeline_stage if any}

This will run the complete pipeline (research -> plan -> apply -> unify -> verify -> bugsweep)
for the target phase(s).

After approval, execution proceeds autonomously with no further
human gates until completion or error escalation.

Approve? (yes/no)
```

If user declines: stop immediately.

If user approves: record approval:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Status" "Milestone approved for phase execution"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state patch '{"milestone_approval": "phase", "approved_at": "'"$(date -u +%Y-%m-%dT%H:%M:%SZ)"'"}'
```

Set `SCOPE = "phase"`.
</if>
</step>

<step name="pipeline_order">
## Step 2: Pipeline Order

Get the execution order for all phases by parsing ROADMAP.md dependency graph:

```bash
ORDER_JSON=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" milestone pipeline-order)
```

This returns `{order: [phaseNum, ...]}` with phases topologically sorted by dependency.

Filter to remaining phases only:

```bash
STATUS_JSON=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" milestone status)
```

Extract `phases_complete` from STATUS_JSON. Remove completed phase numbers from the order list to get `REMAINING_PHASES`.

<if condition="SCOPE == 'phase'">
Further filter `REMAINING_PHASES` to only include the target phase (and any phases it depends on that are not yet complete).
</if>

Set `PHASE_QUEUE = REMAINING_PHASES` (ordered list of phase numbers to process).
</step>

<step name="chain_phases">
## Step 3: Phase Pipeline Loop

<for_each collection="PHASE_QUEUE" variable="PHASE_NUM">

Log phase start:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Status" "Running phase $PHASE_NUM pipeline"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Last activity" "$(date +%Y-%m-%d) -- Phase $PHASE_NUM pipeline started"
```

Initialize per-phase error state:
```
PHASE_RETRY_USED = false
```

### 3a. Research Stage

Check if research already exists:
```bash
PHASE_DIR=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" phase find "$PHASE_NUM")
```

<if condition="no *-RESEARCH.md file exists in PHASE_DIR">
Run the research skill:

Follow `dan:research` execution_flow with argument `$PHASE_NUM`.

This produces `{PADDED}-RESEARCH.md` in the phase directory.
</if>

<if condition="RESEARCH.md already exists">
Log: "Research already complete for phase $PHASE_NUM, skipping."
</if>

### 3b. Plan Stage

Check if plans already exist:

<if condition="no *-PLAN.md files exist in PHASE_DIR">
Run the planning skill:

Follow `dan:plan` execution_flow with argument `$PHASE_NUM`.

This produces one or more `{PADDED}-{NN}-PLAN.md` files in the phase directory.
</if>

<if condition="PLAN.md files already exist">
Log: "Plans already exist for phase $PHASE_NUM, skipping plan generation."
</if>

### 3c. Apply Stage (with wave-based execution)

Get wave grouping from plan dependency metadata:
```bash
WAVES_JSON=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" dependency waves "$PHASE_DIR")
```

This returns waves as arrays of plan identifiers grouped by dependency level.

Validate file partitioning for parallel safety:
```bash
VALIDATION_JSON=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" milestone validate-wave "$PHASE_DIR")
```

Parse `{valid: bool, conflicts?: [...]}` from the result.

<if condition="VALIDATION_JSON.valid == false">
Log warning: "Wave partitioning conflicts detected: {conflicts}. Falling back to sequential execution for conflicting waves."
Set `PARALLEL_SAFE = false` for waves containing conflicts.
</if>

<for_each collection="WAVES (in order, wave 1 first)" variable="WAVE">

<if condition="PARALLEL_SAFE for this wave AND wave has multiple plans">
**Parallel execution within wave:**

For each plan in this wave, spawn an executor agent:
```
Task(
  prompt="Execute plan {plan-path} following dan:apply execution_flow.
  Run all tasks, commit each atomically, produce results.",
  subagent_type="dan-executor",
  description="apply {plan-id}"
)
```

Wait for ALL executor agents in this wave to complete.

Then for each plan in this wave, run unify:
Follow `dan:unify` execution_flow with argument `{plan-path}`.
</if>

<if condition="NOT PARALLEL_SAFE or single plan in wave">
**Sequential execution within wave:**

For each plan in this wave (in order):
1. Follow `dan:apply` execution_flow with argument `{plan-path}`.
2. Follow `dan:unify` execution_flow with argument `{plan-path}`.
</if>

</for_each>

### 3d. Verify Stage

Run verification for the entire phase:

Follow `dan:verify` execution_flow with argument `$PHASE_NUM`.

Read the generated VERIFICATION.md to check the result status.

### 3e. Bugsweep Stage (conditional)

<if condition="VERIFICATION.md status is 'gaps_found' or has issues">
Run bugsweep to attempt automated fixes:

Follow `dan:bugsweep` execution_flow with argument `$PHASE_NUM`.

After bugsweep completes, check if issues were resolved or escalated.
</if>

<if condition="VERIFICATION.md status is 'passed'">
Log: "Phase $PHASE_NUM verified clean, no bugsweep needed."
</if>

### 3f. Advance Phase

Mark phase as complete and advance state:

```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Last activity" "$(date +%Y-%m-%d) -- Phase $PHASE_NUM pipeline complete"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" phase complete "$PHASE_NUM"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state patch '{"phases_completed": "'"$PHASE_NUM"'"}'
```

Log: "Phase $PHASE_NUM complete. Advancing to next phase."

</for_each>
</step>

<step name="error_recovery">
## Step 4: Error Recovery

This step wraps every pipeline stage in steps 3a-3e. When any stage fails, this error handling activates.

### On failure at any stage:

1. **Record the error:**
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" milestone record-error "$PHASE_NUM" "$STAGE" "$REASON"
```

Where `$STAGE` is one of: `research`, `plan`, `apply`, `unify`, `verify`, `bugsweep`.
Where `$REASON` is a concise description of the failure.

2. **Determine recovery action:**

<if condition="PHASE_RETRY_USED == false">
**Option A: Retry from failed stage (default first attempt)**

Set `PHASE_RETRY_USED = true`.

Log: "Error in phase $PHASE_NUM at $STAGE stage: $REASON. Retrying from $STAGE."

```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Last activity" "$(date +%Y-%m-%d) -- Phase $PHASE_NUM retrying $STAGE after error: $REASON"
```

Resume the phase pipeline from the failed stage (do not re-run earlier stages).
</if>

<if condition="PHASE_RETRY_USED == true">
**Retry exhausted. Present three options:**

```
## Error Recovery: Phase {PHASE_NUM}

**Stage:** {STAGE}
**Error:** {REASON}
**Retry:** Already attempted once (cap reached)

### Options

1. **Skip phase** -- Continue to next phase in queue.
   WARNING: Downstream phases that depend on phase {PHASE_NUM} may also fail.
   Dependent phases: {list from ROADMAP.md}

2. **Escalate to user** -- Stop execution and present the error for manual resolution.
   The milestone can be resumed later from this exact point.

3. **Retry with fresh approach** -- Reset the failed stage entirely and try again.
   This is a second retry and the last automatic attempt.
```

<if condition="user selects skip">
Log skip decision:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Last activity" "$(date +%Y-%m-%d) -- Phase $PHASE_NUM skipped after error at $STAGE"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" milestone record-error "$PHASE_NUM" "$STAGE" "Skipped by user: $REASON"
```
Continue to next phase in PHASE_QUEUE.
</if>

<if condition="user selects escalate">
Log escalation:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Status" "Blocked: phase $PHASE_NUM $STAGE error"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" session save '{"phase": '"$PHASE_NUM"', "stage": "'"$STAGE"'", "error": "'"$REASON"'"}'
```
Stop execution. Return detailed error report to user.
</if>

<if condition="user selects retry">
Reset the stage and attempt once more. If this also fails, force escalation.
</if>

</if>
</step>

<step name="completion">
## Step 5: Completion

Reached when all phases in PHASE_QUEUE have completed (or been skipped).

### 5a. Update final state

```bash
PROGRESS_JSON=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" milestone progress)
```

<if condition="all phases completed successfully (none skipped)">
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Status" "Milestone complete"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Last activity" "$(date +%Y-%m-%d) -- Milestone execution complete"
```
</if>

<if condition="some phases were skipped">
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Status" "Milestone complete with gaps"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Last activity" "$(date +%Y-%m-%d) -- Milestone complete, skipped phases: {list}"
```
</if>

### 5b. Display final progress

```bash
PROGRESS_JSON=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" milestone progress)
```

```
## Milestone Execution Complete

**Phases processed:** {total from PHASE_QUEUE}
**Phases completed:** {count successful}
**Phases skipped:** {count skipped}
**Total plans executed:** {total_plans from PROGRESS_JSON}
**Overall progress:** {percent from PROGRESS_JSON}%

### Phase Results

| Phase | Status | Plans | Errors |
|-------|--------|-------|--------|
| 1     | done   | 3/3   | 0      |
| 2     | done   | 3/3   | 0      |
| ...   | ...    | ...   | ...    |

{progress bar from PROGRESS_JSON}
```
</step>

## Constraints

- **Single approval gate:** User approves once at the start. No further human interaction unless error escalation is needed.
- **Phase retry cap:** Each phase gets exactly 1 automatic retry per failed stage. After that, user decision is required.
- **Wave validation before parallel:** Never run plans in parallel without first validating file partitioning via `milestone validate-wave`.
- **Sequential waves:** Waves always execute in order (wave 1 before wave 2). Parallelism is only within a single wave.
- **Two-level hierarchy:** This skill chains other skills. Skills spawn agents. This skill never directly spawns agents (it delegates to dan:apply, dan:verify, dan:bugsweep which manage their own agents).
- **Idempotent stages:** Each stage checks for existing output before running (research checks for RESEARCH.md, plan checks for PLAN.md files). Re-running a milestone resumes from where it left off.

</execution_flow>
