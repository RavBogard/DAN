---
name: "dan:pause"
description: "Save current session state for later resumption"
argument-hint: ""
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:pause

Save the current session state so work can be resumed later. Captures the current position, in-progress tasks, and any accumulated context into STATE.md.

## What It Does

1. Records current position (phase, plan, task, stage, wave) in STATE.md
2. Saves any in-progress work state via session.cjs CLI
3. Updates "Last session" and "Stopped at" fields
4. Commits a WIP snapshot so resume has a clean starting point

## Execution Mode

Runs **in-session** (no agent spawning). Quick state-save operation.

## CLI Tools

State operations use the DAN CLI:
```bash
DAN="node $HOME/.claude/dan/bin/dan-tools.cjs --cwd $PROJECT_DIR"

# Save session position
$DAN session save '{"phase":3,"plan":"03-02","task":2,"stage":"apply","wave":1}'

# Read current state
$DAN state read

# Set individual fields
$DAN state set "Last session" "2026-03-29"
$DAN state set "Last activity" "Paused mid-apply on plan 03-02"

# Commit WIP
$DAN commit "wip: pause session at Phase 3, plan 03-02, task 2, stage: apply" --files .planning/STATE.md
```

<execution_flow>

## Step 1: Determine current position

Read the current project state to understand where execution is.

```bash
DAN="node $HOME/.claude/dan/bin/dan-tools.cjs --cwd $PROJECT_DIR"
STATE_JSON=$($DAN state read)
```

From the state JSON, extract:
- **phase**: Current phase number from the "Phase" field (e.g., "3" from "3 of 5")
- **plan**: Current plan ID from the "Plan" field and phase context (e.g., "03-02")
- **task**: Current task number within the plan (if mid-execution)
- **stage**: Pipeline stage -- which skill was running when pause was requested. One of: `research`, `plan`, `apply`, `unify`, `verify`, `bugsweep`
- **wave**: Current wave number if executing parallel plans (default: 1)

Position inference rules:
- If the user provides explicit context (e.g., "pausing mid-apply on task 2"), use that directly.
- If no explicit position, infer from STATE.md:
  - `status` field tells if work is in progress
  - `stopped_at` field has the last known position
  - `last_activity` field describes what was happening
  - `pipeline_*` frontmatter fields contain prior position if set
- If the stage cannot be determined, default to the most recent skill context visible in conversation.

Build the position object:
```
POSITION='{"phase": PHASE, "plan": "PLAN_ID", "task": TASK_NUM, "stage": "STAGE", "wave": WAVE}'
```

## Step 2: Save session state

Call the session save CLI with the constructed position JSON:

```bash
$DAN session save "$POSITION"
```

This command performs the following atomically:
- Sets `status: paused` in STATE.md frontmatter
- Writes `pipeline_phase`, `pipeline_plan`, `pipeline_task`, `pipeline_stage`, `pipeline_wave` to frontmatter
- Updates `stopped_at` body field with human-readable position string
- Updates `last_updated` timestamp

Verify the save succeeded by checking the CLI output for `{"saved": true, ...}`.

## Step 3: Record accumulated context

Capture any runtime context that would be lost when the session ends:

```bash
# Update last session date
$DAN state set "Last session" "$(date -u +%Y-%m-%d)"

# Update last activity with what was happening
$DAN state set "Last activity" "$(date -u +%Y-%m-%d) -- Paused at STAGE on PLAN_ID"
```

Additionally, if there are any of the following, append them to the appropriate STATE.md sections:

- **In-progress observations**: Anything discovered during current execution that has not been committed. Record via `state set` to the "Pending Todos" section.
- **Discovered blockers**: Issues that prevent progress. Record via: `$DAN state add-blocker "description"` (if available) or manually append to Blockers/Concerns section.
- **Pending decisions**: Choices that need human input before resuming. Note in the "Accumulated Context" area.

If none of these exist, skip -- do not write placeholder text.

## Step 4: Commit WIP state

Create a WIP commit so the pause point is anchored in git history:

```bash
STOPPED_AT="Phase $PHASE, plan $PLAN_ID, task $TASK_NUM, stage: $STAGE"
$DAN commit "wip: pause session at $STOPPED_AT" --files .planning/STATE.md
```

This commit serves as:
- A restore point for `dan:resume` to verify
- Evidence of the pause in git log
- A clean boundary between pre-pause and post-resume work

## Step 5: Confirm to user

Display a summary of what was saved:

```
Session paused.

  Position: Phase PHASE, plan PLAN_ID, task TASK_NUM of TOTAL
  Stage:    STAGE
  Status:   paused
  Commit:   [WIP_COMMIT_HASH]

  Next: Run /dan:resume to continue from this point.
```

The confirmation must include the `dan:resume` instruction so the user knows how to pick up later. If there are recorded blockers or pending decisions, mention them as items that will be surfaced on resume.

</execution_flow>
