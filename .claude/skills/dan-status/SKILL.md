---
name: "dan:status"
description: "Show current project progress, blockers, and suggest the next action"
argument-hint: ""
disable-model-invocation: false
agent-skills:
  - dan-workflow
---

# dan:status

Show the current project state: phase, plan, progress, blockers, recent decisions, and a suggested next action. This is the only skill Claude can auto-invoke (disable-model-invocation is false) to proactively check project status.

## What It Does

1. Reads STATE.md for current position and progress
2. Reads ROADMAP.md for phase/plan overview
3. Reads recent SUMMARY.md files for context
4. Displays:
   - Current phase and plan
   - Progress bar and percentage
   - Active blockers or concerns
   - Recent decisions
   - Suggested next action (e.g., "Run dan:apply on 01-03-PLAN.md")

## Execution Mode

Runs **in-session** (no agent spawning). Read-only operation.

## CLI Tools

State operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state read
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR milestone progress
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR milestone status
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR session next-action
```

<execution_flow>

<step name="gather_state" priority="first">
## Step 1: Gather State

Read all state sources needed for the status display.

### 1a. Read STATE.md

```bash
STATE_JSON=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state read)
```

Extract from STATE_JSON:
- `phase`: current phase number (e.g., "3 of 5")
- `plan`: current plan position (e.g., "2 of 4 in current phase")
- `status`: current status (e.g., "in_progress", "verifying", "blocked")
- `last_activity`: most recent activity description
- `blockers`: list of active blockers/concerns
- `decisions`: list of accumulated decisions

### 1b. Get milestone progress

```bash
PROGRESS_JSON=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" milestone progress)
```

Extract from PROGRESS_JSON:
- `total_phases`: total number of phases
- `completed_phases`: number of completed phases
- `total_plans`: total plans across all phases
- `completed_plans`: number of completed plans
- `percent`: overall progress percentage

### 1c. Get milestone status

```bash
STATUS_JSON=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" milestone status)
```

Extract from STATUS_JSON:
- `milestone`: milestone name
- `current_phase`: name of current phase
- `pipeline_stage`: current pipeline stage if milestone is running (e.g., "apply", "verify")
- `phases_remaining`: list of remaining phase numbers
</step>

<step name="determine_next_action">
## Step 2: Determine Next Action

Call the session module to compute the recommended next action based on the 8-priority state machine:

```bash
NEXT_JSON=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" session next-action)
```

Extract from NEXT_JSON:
- `action`: human-readable description (e.g., "Apply next plan", "Verify phase", "Resume paused task")
- `skill`: the DAN skill to invoke (e.g., "dan:apply", "dan:verify", "dan:milestone")
- `args`: arguments to pass to the skill (e.g., plan path, phase number)

The priority order is:
1. Paused session exists -> resume
2. Plan IN_PROGRESS -> continue apply
3. All plans done, no verification -> verify
4. Verification has gaps -> bugsweep
5. Phase done, more phases remain -> next phase
6. All phases done -> complete
7. No plans exist -> plan
8. No research exists -> research
</step>

<step name="display_status">
## Step 3: Display Status

Format and display the status report using the gathered data.

### Phase position

Show the current phase with its name:
```
## Project Status

**Phase {completed_phases + 1} of {total_phases}:** {current_phase name}
```

### Progress bar

Render the progress bar using the same format as the CLI (10-character width):

```
Progress: [{filled}{empty}] {percent}%
          [{completed_plans}/{total_plans} plans complete]
```

Where `filled` = number of filled blocks proportional to percent, `empty` = remaining blocks.

Example: `Progress: [######....] 60%  [9/15 plans complete]`

### Current activity

<if condition="status indicates a plan is IN_PROGRESS">
```
**Current plan:** {plan identifier}
**Status:** {status description}
**Last activity:** {last_activity text}
```
</if>

<if condition="status indicates milestone pipeline is running">
```
**Pipeline stage:** {pipeline_stage} (phase {current phase})
**Last activity:** {last_activity text}
```
</if>

<if condition="status is idle or complete">
```
**Status:** {status}
**Last activity:** {last_activity text}
```
</if>

### Blockers and concerns

<if condition="blockers list is non-empty">
```
### Blockers

{numbered list of each blocker/concern from STATE.md}
```
</if>

<if condition="blockers list is empty">
```
### Blockers

None.
```
</if>

### Recent decisions

Show the last 3 decisions from the STATE.md decisions list:

```
### Recent Decisions

{last 3 decisions, most recent first}
```

If no decisions exist, show "No decisions recorded yet."

### Suggested next action

Highlight the recommended next action from Step 2:

```
### Next Action

> **{action description}**
> Run: `/dan:{skill} {args}`
```

If the project is complete (no next action), show:
```
### Next Action

Project milestone is complete. No further actions needed.
```
</step>

<step name="format_output">
## Step 4: Format Output

Assemble the complete status display as a single markdown block. Use clean formatting with headers and consistent spacing.

Full output template:

```markdown
## Project Status

**Phase {N} of {total}:** {phase name}

Progress: [{bar}] {percent}%  [{completed_plans}/{total_plans} plans]

**Status:** {status}
**Last activity:** {last_activity}

### Blockers

{blockers or "None."}

### Recent Decisions

{last 3 decisions or "No decisions recorded yet."}

### Next Action

> **{action}**
> Run: `/dan:{skill} {args}`
```

This skill is read-only. It does NOT modify STATE.md, ROADMAP.md, or any other file. It only reads and displays.
</step>

## Constraints

- **Read-only:** This skill never modifies any project state. It only reads and displays.
- **Auto-invocable:** `disable-model-invocation: false` allows Claude to proactively call this skill to check status when context suggests it would be helpful.
- **No agent spawning:** Runs entirely in-session. No subagents needed for read-only display.
- **Concise output:** The status display should fit in a single screen (roughly 20-30 lines). Do not dump raw JSON or full STATE.md contents.
- **Graceful degradation:** If any CLI call fails (e.g., no STATE.md exists yet), show what is available and note what is missing rather than failing entirely.

</execution_flow>
