---
name: "dan:plan"
description: "Spawn planner agent to create execution plans for a phase based on research findings"
argument-hint: "[phase-number]"
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:plan

Spawn a dan-planner agent to create execution plans for a phase. The planner reads research findings, REQUIREMENTS.md, and PROJECT.md to produce sequenced, dependency-aware PLAN.md files.

## What It Does

1. Reads `{phase}-RESEARCH.md` for the target phase
2. Spawns dan-planner agent to produce plan files
3. Planner creates `{phase}-{plan}-PLAN.md` files with:
   - YAML frontmatter (phase, plan, type, wave, depends_on, requirements)
   - Tasks with types (auto, checkpoint:*, tdd)
   - Verification steps and success criteria
4. Updates STATE.md with planning completion status

## Execution Mode

Spawns **dan-planner** subagent. One planner per phase.

## CLI Tools

State and frontmatter operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR frontmatter parse .planning/phases/01-foundation/01-01-PLAN.md
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Status" "Planning"
```

<execution_flow>

<step name="check_loop_closure" priority="first">
Before creating a new plan, verify all prior loops are closed. No orphan plans allowed.

1. Read STATE.md to get current phase:
   ```bash
   PHASE_DIR=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state get "Phase" | grep -oP '\d+')
   ```

2. Determine the phase directory path:
   ```bash
   PHASE_PATH=$(ls -d "$PROJECT_DIR/.planning/phases/"*"-"* | grep "^.*/${PHASE_DIR}-" | head -1)
   ```

3. List all PLAN.md and SUMMARY.md files in the phase directory:
   ```bash
   PLANS=$(ls "$PHASE_PATH"/*-PLAN.md 2>/dev/null)
   SUMMARIES=$(ls "$PHASE_PATH"/*-SUMMARY.md 2>/dev/null)
   ```

4. For each PLAN.md, check if a matching SUMMARY.md exists:
   - Extract the plan prefix (e.g., `02-01`) from the filename
   - Look for `{prefix}-SUMMARY.md` in the SUMMARIES list
   - If no matching SUMMARY exists:
     a. Parse the plan's frontmatter to get its status:
        ```bash
        node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" frontmatter parse "$PLAN_FILE"
        ```
     b. If status is `IN_PROGRESS` or `APPROVED`:
        **BLOCK** -- tell the user:
        > Previous plan [XX-NN] is [status]. Run `/dan:apply` to complete it, then `/dan:unify` to close the loop.
     c. If status is `ABANDONED`:
        **BLOCK** -- abandoned plans still need summaries:
        > Plan [XX-NN] was abandoned but has no SUMMARY.md. Run `/dan:unify` to close the loop.
     d. If status is `DRAFT`:
        This is a plan that was never approved. It can be overwritten or the user can approve it.
        Inform the user: > Draft plan [XX-NN] exists. Approve it with `/dan:apply` or it will be superseded.

5. Only proceed to step 2 if all prior plans have matching SUMMARY.md files (or are in DRAFT state).
</step>

<step name="determine_phase">
Identify which phase to plan for and determine the next plan number.

1. If a phase number argument was provided by the user, use it:
   ```
   PHASE_NUM=$1   # e.g., "02" or "2"
   ```

2. Otherwise, read the current phase from STATE.md:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state get "Phase"
   ```
   Extract the phase number (e.g., "2 of 5" -> "2"). Zero-pad to two digits.

3. Resolve the phase directory:
   ```bash
   PHASE_PATH=$(ls -d "$PROJECT_DIR/.planning/phases/${PADDED_PHASE}-"* 2>/dev/null | head -1)
   ```
   If it does not exist, error: "Phase directory not found for phase ${PADDED_PHASE}."

4. Check for RESEARCH.md:
   ```bash
   RESEARCH_PATH="$PHASE_PATH/${PADDED_PHASE}-RESEARCH.md"
   [ -f "$RESEARCH_PATH" ] && echo "Research found" || echo "No research -- will use ROADMAP.md phase section"
   ```

5. Determine the next plan number by counting existing PLAN.md files:
   ```bash
   EXISTING_PLANS=$(ls "$PHASE_PATH"/*-PLAN.md 2>/dev/null | wc -l)
   NEXT_PLAN=$((EXISTING_PLANS + 1))
   PADDED_PLAN=$(printf "%02d" $NEXT_PLAN)
   ```

6. Collect paths to existing SUMMARY.md files for context:
   ```bash
   EXISTING_SUMMARIES=$(ls "$PHASE_PATH"/*-SUMMARY.md 2>/dev/null)
   ```
</step>

<step name="spawn_planner">
Spawn the dan-planner agent with all necessary context to produce a PLAN.md file.

1. Assemble the context file list for the planner:
   - `$RESEARCH_PATH` (or `$PROJECT_DIR/.planning/ROADMAP.md` if no research exists)
   - `$PROJECT_DIR/.planning/REQUIREMENTS.md`
   - `$PROJECT_DIR/.planning/PROJECT.md`
   - `$PHASE_PATH` (phase directory path)
   - `$PADDED_PHASE-$PADDED_PLAN` (plan identifier)
   - All `$EXISTING_SUMMARIES` paths (so planner knows what is already done)

2. Spawn the dan-planner agent using the Task tool:
   - Agent definition: `.claude/agents/dan-planner.md`
   - Pass a prompt that includes:
     - The phase number and plan number
     - All context file paths listed above
     - Instruction: "Produce `${PADDED_PHASE}-${PADDED_PLAN}-PLAN.md` in `${PHASE_PATH}/`"
     - Instruction: "Set frontmatter `status: DRAFT`"
     - Instruction: "Size to 2-3 tasks per plan"

3. Wait for the planner to complete. The planner writes the PLAN.md file directly.

4. Verify the plan file was created:
   ```bash
   PLAN_FILE="$PHASE_PATH/${PADDED_PHASE}-${PADDED_PLAN}-PLAN.md"
   [ -f "$PLAN_FILE" ] && echo "Plan created" || echo "ERROR: Planner did not produce plan file"
   ```

5. Verify the plan frontmatter includes `status: DRAFT`:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" frontmatter parse "$PLAN_FILE"
   ```
   Confirm `status` field is `DRAFT`. If missing, set it:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" frontmatter set "$PLAN_FILE" status DRAFT
   ```
</step>

<step name="present_for_approval">
Present the plan to the user for review and handle the approval decision.

1. Read the produced PLAN.md file and extract key information:
   - Objective (from `<objective>` block)
   - Task count and names (from `<task>` elements)
   - Files modified (from frontmatter `files_modified`)
   - Requirements covered (from frontmatter `requirements`)

2. Present a summary to the user:
   ```
   ## Plan ${PADDED_PHASE}-${PADDED_PLAN} Ready for Review

   **Objective:** [extracted objective]
   **Tasks:** [count] tasks
   **Files:** [list of files_modified]
   **Requirements:** [list of requirement IDs]

   [Task list with names]

   Approve this plan? (yes/no/revise)
   ```

3. Wait for user response:

   a. **On approval ("yes"):**
      Transition the plan from DRAFT to APPROVED:
      ```bash
      node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" frontmatter set "$PLAN_FILE" status APPROVED
      ```

   b. **On rejection with feedback ("revise" or "no" with comments):**
      - Collect revision instructions from the user
      - Re-spawn the dan-planner agent with the original context PLUS the revision feedback
      - Return to the beginning of this step (present_for_approval) with the revised plan

   c. **On rejection without feedback ("no"):**
      - Leave the plan as DRAFT
      - Inform: "Plan remains as DRAFT. You can edit it manually or re-run `/dan:plan` to regenerate."
</step>

<step name="update_state">
After approval, update project state and commit the plan file.

1. Update STATE.md to reflect the new plan:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Last activity" "$(date +%Y-%m-%d) -- Plan ${PADDED_PHASE}-${PADDED_PLAN} created and approved"
   ```

2. Commit the plan file:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" commit "plan(${PADDED_PHASE}-${PADDED_PLAN}): [brief objective from plan]" --files "$PLAN_FILE" "$PROJECT_DIR/.planning/STATE.md"
   ```

3. Inform the user of next steps:
   ```
   Plan ${PADDED_PHASE}-${PADDED_PLAN} is approved and committed.
   Next: Run `/dan:apply` to execute this plan.
   ```
</step>

</execution_flow>
