---
name: "dan:apply"
description: "Execute plan tasks with optional E/Q qualification loop"
argument-hint: "[plan-path | phase-number]"
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:apply

Execute plan tasks. Default mode is in-session execution. For plans requiring qualification, spawns a dan-qualifier agent to independently verify each task output.

## What It Does

1. Reads target PLAN.md file (from path or phase number)
2. Parses tasks, dependencies, and verification criteria
3. Executes tasks sequentially (or in waves per `wave` frontmatter)
4. For E/Q-enabled plans: spawns dan-qualifier to independently grade output
5. Commits each task atomically after verification passes
6. Handles deviations per deviation rules (auto-fix bugs, missing functionality, blocking issues)
7. Updates STATE.md progress after each task

## Execution Mode

Default: **in-session** execution. Spawns **dan-qualifier** subagent for E/Q protocol when plan specifies it.

## CLI Tools

State, config, and commit operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Plan" "2 of 4 in current phase"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR commit "feat(01-03): implement skill entry points" --files .claude/skills/dan-plan/SKILL.md
```

<execution_flow>

<step name="load_plan" priority="first">
## Step 1: Load Plan

1. Accept argument: either a file path to a PLAN.md, or a phase number (e.g., `2`).

2. **If phase number:** Find the first actionable plan in the phase directory:
   ```bash
   PHASE_DIR=".planning/phases/$(ls .planning/phases/ | grep "^0${PHASE_NUM}-" | head -1)"
   ```
   For each `*-PLAN.md` in `$PHASE_DIR`, parse frontmatter:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" frontmatter parse "$PLAN_FILE"
   ```
   Select the first plan with `status: APPROVED` (or `status: IN_PROGRESS` for resume).

3. **If file path:** Use the path directly.

4. Parse the plan file:
   - Extract frontmatter: `phase`, `plan`, `status`, `depends_on`, `files_modified`, `requirements`
   - Extract `<objective>` text
   - Extract each `<task>` element: name, type, files, action, verify, done, tdd attribute
   - Count total tasks: `TOTAL_TASKS`

5. **Status check:**
   - If `status` is `APPROVED`: proceed to step 2 (fresh start)
   - If `status` is `IN_PROGRESS`: read STATE.md for checkpoint:
     ```bash
     node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state get "Last activity"
     ```
     Parse the last completed task number from the state activity text (e.g., "Task 2 of 5 complete" means resume from task 3).
   - If `status` is `COMPLETED` or `ABANDONED`: report "Plan already finished" and stop.
   - If `status` is `DRAFT`: report "Plan not yet approved. Run /dan:plan to review." and stop.

6. **Load persisted retry counts** from STATE.md:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state get "retry_counts"
   ```
   If the field exists, parse the JSON map (e.g., `{"task1": 1, "task3": 2}`). Otherwise initialize `RETRY_COUNTS = {}`.
</step>

<step name="start_execution">
## Step 2: Start Execution

1. **Transition plan status** from APPROVED to IN_PROGRESS:
   ```bash
   # Validate the transition is allowed
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" lifecycle validate APPROVED IN_PROGRESS
   # Apply the transition
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" frontmatter set "$PLAN_PATH" status IN_PROGRESS
   ```
   If the plan is already IN_PROGRESS (resume case), skip this step.

2. **Update STATE.md** with execution start:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Last activity" "$(date +%Y-%m-%d) -- Plan ${PHASE}-${PLAN} in progress, Task 0 of ${TOTAL_TASKS}"
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Status" "In progress"
   ```

3. **Initialize retry tracking:**
   - If fresh start: `RETRY_COUNTS = {}`
   - If resume: use the map loaded in step 1.6

4. **Set starting task index:**
   - If fresh start: `CURRENT_TASK = 1`
   - If resume: `CURRENT_TASK = last_completed + 1`
</step>

<step name="execute_and_qualify">
## Step 3: Execute and Qualify (for each task)

Loop from `CURRENT_TASK` to `TOTAL_TASKS`:

### 3a. Execute (in-session, default mode)

1. Read the task's `<action>` instructions from the plan.
2. Read the task's `<files>` list to know which files to create or modify.
3. Follow the action instructions precisely:
   - Create new files using Write tool
   - Modify existing files using Edit tool
   - Run build/test commands using Bash tool as needed
4. If the task has `tdd="true"`:
   - **RED**: Write failing tests from `<behavior>` spec, run them, confirm they fail
   - **GREEN**: Write minimal implementation to pass tests, run them, confirm they pass
   - **REFACTOR**: Clean up if needed, run tests, confirm still passing
5. Run the task's `<verify>` command:
   ```bash
   # Execute the automated verification from the task
   ${VERIFY_COMMAND}
   ```
   If verification fails, diagnose and fix (deviation Rule 1: auto-fix bugs).
6. Commit the task output:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" commit "${TYPE}(${PHASE}-${PLAN}): ${TASK_NAME}" --files ${FILE_LIST}
   ```
   Record the commit hash: `TASK_COMMIT=$(git rev-parse --short HEAD)`

### 3b. Qualify (always via dan-qualifier subagent)

1. **Spawn dan-qualifier agent** with this context:
   - Path to the PLAN.md file
   - Task number being qualified (e.g., "Task 2")
   - List of file paths modified by the task
   - The task's `<done>` criteria text
   - Instruction: "Grade this task output against the done criteria. Use the exact output format specified in your role definition."

2. **Parse qualifier output** using `parseQualifierOutput()` logic:
   - Extract `status`, `task`, `criteria`, `evidence`, `issues` from the qualifier's markdown response
   - The qualifier output must contain `**Status:** <VALUE>` with one of: PASS, PASS_WITH_CONCERNS, NEEDS_REVISION, FAIL

3. **Route based on status:**

   **PASS:**
   - Log: "Task ${N} qualified: PASS"
   - Proceed to checkpoint (3c)

   **PASS_WITH_CONCERNS:**
   - Log concerns in STATE.md decisions:
     ```bash
     node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Last activity" "$(date +%Y-%m-%d) -- Task ${N}: PASS_WITH_CONCERNS - ${CONCERNS_SUMMARY}"
     ```
   - Proceed to checkpoint (3c)

   **NEEDS_REVISION:**
   - Check retry count for this task:
     ```bash
     node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" qualify should-retry NEEDS_REVISION ${RETRY_COUNTS[taskN]} 3
     ```
   - If `retry: true` (retries < 3):
     1. Read the qualifier's `issues` list
     2. Fix the identified problems in the task's files
     3. Re-run verification
     4. Re-commit with amended message: `fix(${PHASE}-${PLAN}): revise task ${N} - attempt ${RETRY_COUNT}`
     5. Increment retry count: `RETRY_COUNTS[taskN] += 1`
     6. Persist retry count to STATE.md:
        ```bash
        node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state patch '{"retry_counts": ${JSON.stringify(RETRY_COUNTS)}}'
        ```
     7. Loop back to step 3b (re-qualify)
   - If `retry: false` (retries >= 3):
     1. Log: "Task ${N} failed after 3 revision attempts. Running diagnostic classification."
     2. Go to step 4 (diagnostic_classify)
     3. Based on diagnostic result, either escalate to user or retry with fresh approach

   **FAIL:**
   - Log: "Task ${N} qualified: FAIL. Running diagnostic classification."
   - Go to step 4 (diagnostic_classify) immediately
   - Do NOT retry without classification

### 3c. Checkpoint (after each successful task)

1. Update STATE.md with progress:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Last activity" "$(date +%Y-%m-%d) -- Plan ${PHASE}-${PLAN} in progress, Task ${N} of ${TOTAL_TASKS} complete"
   ```

2. Persist current retry_counts map to STATE.md:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state patch '{"retry_counts": ${JSON.stringify(RETRY_COUNTS)}}'
   ```
   This ensures retry state survives session restarts.

3. Increment `CURRENT_TASK` and continue to next task.
</step>

<step name="diagnostic_classify">
## Step 4: Diagnostic Classification (triggered by FAIL or exhausted retries)

1. **Gather evidence:**
   - Task spec: the full `<task>` XML element from the plan
   - Qualifier evidence: the `evidence` and `issues` fields from qualifier output
   - Plan objective: the `<objective>` text from the plan

2. **Classify the failure** using `classifyFailure()` logic:
   ```bash
   # Write task spec and evidence to temp files, then classify
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" qualify classify "$TASK_SPEC_FILE" "$EVIDENCE_FILE" "$OBJECTIVE_TEXT"
   ```
   Returns `{ classification: "intent"|"spec"|"code", reasoning: string }`

3. **Route based on classification:**

   **INTENT** (wrong goal -- the plan targets the wrong thing):
   - Log classification in STATE.md:
     ```bash
     node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Last activity" "$(date +%Y-%m-%d) -- Task ${N} FAIL: intent mismatch. Plan objective needs revision."
     ```
   - Present to user: "The plan targets the wrong thing. The qualifier found: ${EVIDENCE}. Recommendation: revise plan objective via /dan:plan."
   - Leave plan as IN_PROGRESS with checkpoint at current task
   - Stop execution

   **SPEC** (wrong plan -- the task description is incorrect or incomplete):
   - Log classification in STATE.md
   - If the spec issue is clear and the correct spec can be inferred:
     1. Note the spec revision needed
     2. Reset retry counter for this task: `RETRY_COUNTS[taskN] = 0`
     3. Re-execute the task from scratch with the corrected understanding
     4. Loop back to step 3b (qualify the fresh attempt)
   - If the spec issue is ambiguous:
     1. Present to user: "Task ${N} spec is ambiguous: ${REASONING}. Please clarify."
     2. Leave plan as IN_PROGRESS with checkpoint
     3. Stop execution

   **CODE** (wrong implementation -- the code does not match the spec):
   - Log classification in STATE.md
   - This uses the normal retry counter:
     1. Fix the implementation based on diagnostic reasoning
     2. Re-commit and re-qualify (loop back to step 3b)
     3. If retry count already exhausted, escalate to user

4. **Log classification** in STATE.md decisions:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Last activity" "$(date +%Y-%m-%d) -- Diagnostic: Task ${N} classified as ${CLASSIFICATION}: ${REASONING}"
   ```
</step>

<step name="finalize">
## Step 5: Finalize

### 5a. All tasks completed successfully:

1. **Transition plan status** to COMPLETED:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" lifecycle validate IN_PROGRESS COMPLETED
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" frontmatter set "$PLAN_PATH" status COMPLETED
   ```

2. **Clear retry_counts** from STATE.md (loop is complete):
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state patch '{"retry_counts": null}'
   ```

3. **Update STATE.md** with completion:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Last activity" "$(date +%Y-%m-%d) -- Plan ${PHASE}-${PLAN} complete, ready for unify"
   ```

4. **Offer next action:**
   Report: "Plan ${PHASE}-${PLAN} complete. All ${TOTAL_TASKS} tasks passed qualification. Run /dan:unify to close the loop and produce SUMMARY.md."

### 5b. Execution interrupted (user stop or escalation):

1. **Leave plan as IN_PROGRESS** -- do not transition to COMPLETED or ABANDONED.

2. **Persist checkpoint** with last completed task:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Last activity" "$(date +%Y-%m-%d) -- Plan ${PHASE}-${PLAN} paused at Task ${LAST_COMPLETED} of ${TOTAL_TASKS}"
   ```

3. **Persist retry_counts** to STATE.md so next session can resume:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state patch '{"retry_counts": ${JSON.stringify(RETRY_COUNTS)}}'
   ```

4. **Log reason** for interruption in STATE.md.
</step>

</execution_flow>

## Execution Mode

**Default: in-session execution.** Tasks are executed directly in the current session with full tool access (Read, Write, Edit, Bash, Glob, Grep). This preserves maximum context for best implementation quality.

**Qualification: always via dan-qualifier subagent.** After each task, a dan-qualifier agent is spawned in a separate context to independently grade the output. The qualifier has read-only tools (Read, Grep, Glob, Bash for verification only). The executor and qualifier NEVER share context -- this separation is the core quality guarantee.

**Why in-session?** Research shows subagent execution loses approximately 30% quality due to context loss. The executor operates in-session by default. The dan-executor agent definition exists as future-prep for Phase 5 wave parallelization, where multiple tasks may need to execute in parallel subagents.
