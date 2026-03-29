---
name: "dan:resume"
description: "Restore session from STATE.md and continue where work left off"
argument-hint: ""
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:resume

Restore a previous session from STATE.md and continue execution from where work left off. Reads the last position, verifies commits exist, and resumes the appropriate skill.

## What It Does

1. Restores session position from STATE.md via session.cjs CLI
2. Verifies the WIP commit from pause exists in git history
3. Loads accumulated context (decisions, blockers, summaries)
4. Determines which skill to invoke based on pipeline stage
5. Updates status and resumes execution

## Execution Mode

Runs **in-session** initially for state restoration, then delegates to the appropriate skill for continued execution.

## CLI Tools

State operations use the DAN CLI:
```bash
DAN="node $HOME/.claude/dan/bin/dan-tools.cjs --cwd $PROJECT_DIR"

# Restore session (returns position, next_action, decisions, blockers)
$DAN session restore

# Determine next action independently
$DAN session next-action

# Read full state
$DAN state read

# Update status
$DAN state set "Status" "Milestone in progress"
```

<execution_flow>

## Step 1: Restore session state

Call the session restore CLI to retrieve the saved position:

```bash
DAN="node $HOME/.claude/dan/bin/dan-tools.cjs --cwd $PROJECT_DIR"
RESTORE_JSON=$($DAN session restore)
```

The restore command returns:
```json
{
  "position": {"phase": 3, "plan": "03-02", "task": 2, "stage": "apply", "wave": 1},
  "next_action": {"action": "resume", "skill": "dan:apply", "args": "03-02"},
  "decisions": ["...settled decisions..."],
  "blockers": ["...recorded blockers..."]
}
```

**Guard: Check for valid paused session.**
- Read the `status` field from STATE.md frontmatter.
- If status is NOT `paused`, inform the user: "No paused session found. Current status: [STATUS]. Use /dan:status to see project state."
- If status IS `paused` but position fields are empty/missing, inform the user: "Session marked as paused but no position data found. Use /dan:status to inspect STATE.md."
- Only proceed if status is `paused` AND position data exists.

Extract from the restore result:
- `position.phase` -- which phase was active
- `position.plan` -- which plan was being executed
- `position.task` -- which task number (0 = not started, N = mid-task)
- `position.stage` -- pipeline stage name
- `position.wave` -- wave number for parallel execution
- `next_action` -- pre-computed next skill recommendation
- `decisions` -- settled decisions (do NOT re-litigate)
- `blockers` -- issues recorded at pause time

## Step 2: Verify git state

Confirm the pause point is anchored in git history:

```bash
# Check for the WIP commit from pause
git log --oneline -20 | grep -i "wip.*pause"
```

- If a WIP pause commit is found: Good, the save was clean.
- If no WIP commit found: Warn but continue -- the state file is the source of truth.

Check for uncommitted changes that might conflict:

```bash
git status --short
```

- If no uncommitted changes: Clean state, proceed normally.
- If uncommitted changes exist in `.planning/` only: Likely from a manual edit. Note it but proceed.
- If uncommitted changes exist in source files: Warn the user: "Found uncommitted changes in: [files]. These may conflict with resume. Options: (1) commit them first, (2) stash them, (3) proceed anyway." Wait for user direction before continuing.

## Step 3: Load accumulated context

Build a context briefing from STATE.md and completed work. This ensures Claude has the right mental model before continuing execution.

### 3a: Read settled decisions

```bash
$DAN state read
```

From the Decisions section, extract all logged decisions. Display them as a brief list:

```
Settled decisions (do not re-litigate):
- [decision 1]
- [decision 2]
...
```

These are final. They were made during prior sessions and should be treated as constraints, not suggestions.

### 3b: Surface blockers and concerns

From the Blockers/Concerns section, list any that were recorded:

```
Active blockers/concerns:
- [blocker 1]
- [concern 2]
```

If blockers were recorded at pause time, they need attention before resuming. If any blocker is marked as resolved, note that.

### 3c: Read recent summaries

Check for completed plan summaries in the current phase:

```bash
ls .planning/phases/PHASE_DIR/*-SUMMARY.md 2>/dev/null
```

For each summary found, read the one-liner and key decisions to build context about what has already been accomplished in this phase. Do NOT read full summaries -- just the frontmatter `decisions` field and the title one-liner.

### 3d: Display context briefing

Present a compact summary:

```
Resuming session:
  Position: Phase PHASE, plan PLAN_ID, task TASK of TOTAL
  Stage:    STAGE
  Wave:     WAVE

  Completed in this phase:
    - [summary one-liners from 3c]

  Settled decisions: N decisions loaded (see STATE.md)
  Active blockers:   N (or "none")
```

## Step 4: Determine next action

Use the `next_action` from the restore result to identify the correct skill:

```bash
# Or compute independently:
NEXT=$($DAN session next-action)
```

Map the `pipeline_stage` to the correct skill invocation:

| pipeline_stage | Skill to invoke | Arguments |
|----------------|----------------|-----------|
| `research`     | `dan:research`  | Phase number (e.g., `3`) |
| `plan`         | `dan:plan`      | Phase number (e.g., `3`) |
| `apply`        | `dan:apply`     | Plan ID (e.g., `03-02`) |
| `unify`        | `dan:unify`     | Plan ID (e.g., `03-02`) |
| `verify`       | `dan:verify`    | Phase number (e.g., `3`) |
| `bugsweep`     | `dan:bugsweep`  | Phase number (e.g., `3`) |

**Mid-task resume logic:**
- If `position.task > 0` and stage is `apply`, the plan was mid-execution.
- Pass the task offset to the apply skill so it knows to skip already-completed tasks.
- Check for a `<completed_tasks>` context or verify task commits exist:
  ```bash
  git log --oneline -20 | grep "feat(PLAN_ID)\|fix(PLAN_ID)\|test(PLAN_ID)"
  ```
- Count committed tasks to determine the actual resume point.

## Step 5: Update state and invoke

Transition status from paused to active:

```bash
$DAN state set "Status" "Milestone in progress"
```

Note: The `pipeline_*` frontmatter fields are intentionally left in place. They serve as a breadcrumb trail and will be updated by the next `session save` or cleared when the plan completes.

Update the last activity:

```bash
$DAN state set "Last activity" "$(date -u +%Y-%m-%d) -- Resumed STAGE on PLAN_ID from task TASK"
$DAN state set "Last session" "$(date -u +%Y-%m-%d)"
```

**Invoke the next skill:**

Follow the skill mapping from Step 4. Execute the skill's execution_flow with the determined arguments. For example, if resuming mid-apply on plan 03-02 at task 2:

1. Read `03-02-PLAN.md`
2. Note that tasks 1 through (TASK-1) are already committed
3. Begin execution from task TASK
4. Continue the skill's normal flow from that point

The resume is complete once the delegated skill takes over. From that point, normal execution rules apply -- including the ability to pause again via `dan:pause`.

</execution_flow>
