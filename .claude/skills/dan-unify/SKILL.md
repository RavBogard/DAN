---
name: "dan:unify"
description: "Close the loop on a completed plan by writing SUMMARY.md and updating state"
argument-hint: "[plan-path]"
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:unify

Close the execution loop for a completed plan. Reads task commits, deviations, and verification results to produce a SUMMARY.md file. Updates STATE.md and ROADMAP.md.

## What It Does

1. Reads the target PLAN.md and its task commits
2. Gathers deviations, decisions, and issues from execution
3. Produces `{phase}-{plan}-SUMMARY.md` with:
   - Frontmatter (dependency graph, tech-stack, key-files, decisions, metrics)
   - Accomplishments, task commits, files created/modified
   - Deviations from plan, issues encountered
4. Updates STATE.md (advance plan counter, add decisions, record metrics)
5. Updates ROADMAP.md (plan progress row)

## Execution Mode

Runs **in-session** (no agent spawning). Reads git log and plan files to produce summary.

## CLI Tools

State and roadmap operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Plan" "3 of 4 in current phase"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state get "Status"
```

<execution_flow>

<step name="identify_plan">
Determine which plan to unify (close the loop on).

1. If a plan path argument was provided by the user, use it directly:
   ```
   PLAN_FILE=$1   # e.g., ".planning/phases/02-core-loop/02-01-PLAN.md"
   ```

2. Otherwise, read STATE.md for current phase and plan position:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state get "Phase"
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state get "Plan"
   ```
   Determine the phase directory and scan for unclosed plans.

3. Find the most recent PLAN.md without a matching SUMMARY.md:
   ```bash
   PHASE_PATH="$PROJECT_DIR/.planning/phases/${PADDED_PHASE}-${PHASE_NAME}"
   for PLAN in $(ls "$PHASE_PATH"/*-PLAN.md 2>/dev/null); do
     PREFIX=$(basename "$PLAN" | sed 's/-PLAN.md//')
     SUMMARY="$PHASE_PATH/${PREFIX}-SUMMARY.md"
     [ ! -f "$SUMMARY" ] && PLAN_FILE="$PLAN" && break
   done
   ```

4. Parse the plan frontmatter and verify status:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" frontmatter parse "$PLAN_FILE"
   ```
   - If status is `COMPLETED`: proceed (summary is the missing piece)
   - If status is `IN_PROGRESS`: warn "Plan is still IN_PROGRESS. Producing summary anyway -- verify all tasks are done."
   - If status is `DRAFT` or `APPROVED`: error "Plan has not been executed yet. Run `/dan:apply` first."

5. If no unclosed plans found:
   ```
   All plans in phase ${PADDED_PHASE} have summaries. Nothing to unify.
   ```
</step>

<step name="read_plan_and_commits">
Gather all execution evidence for the plan.

1. Read the PLAN.md file and extract:
   - Objective (from `<objective>` block)
   - Tasks (from `<task>` elements): name, type, files, done criteria
   - Success criteria (from `<success_criteria>` block)
   - Requirements covered (from frontmatter `requirements`)
   - Files modified (from frontmatter `files_modified`)

2. Read git log for commits matching this plan's identifier:
   ```bash
   git log --oneline --grep="(${PADDED_PHASE}-${PADDED_PLAN})" --all
   ```
   This captures all task commits (e.g., `feat(02-01): ...`, `test(02-01): ...`).

3. For each task in the plan, determine its status:
   - **Completed**: A commit exists with the task's description or file changes
   - **Skipped**: No matching commit and task was explicitly deferred
   - **Modified**: Commit exists but files or scope differ from plan

4. Check the current state of planned files:
   ```bash
   for FILE in ${FILES_MODIFIED}; do
     [ -f "$PROJECT_DIR/$FILE" ] && echo "EXISTS: $FILE" || echo "MISSING: $FILE"
   done
   ```

5. Count actual files created/modified from the git diff:
   ```bash
   git diff --name-only $(git log --oneline --grep="(${PADDED_PHASE}-${PADDED_PLAN})" --format="%H" | tail -1)^..$(git log --oneline --grep="(${PADDED_PHASE}-${PADDED_PLAN})" --format="%H" | head -1)
   ```
</step>

<step name="gather_qualification_results">
Collect qualification and deviation data from the execution.

1. Check STATE.md decisions section for any qualification results:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state get "Decisions"
   ```
   Look for entries mentioning this plan's identifier or PASS_WITH_CONCERNS.

2. Check for deviation patterns in commit messages:
   ```bash
   git log --oneline --grep="(${PADDED_PHASE}-${PADDED_PLAN})" --all | grep -iE "fix|deviat|missing|bug"
   ```

3. Collect any PASS_WITH_CONCERNS notes -- these become items in the "Deviations" or "Deferred" sections.

4. Note any auto-fixed bugs, added missing functionality, or blocking issues resolved during execution. These map to deviation rules:
   - Rule 1 (Bug fixes)
   - Rule 2 (Missing critical functionality)
   - Rule 3 (Blocking issues)
</step>

<step name="produce_summary">
Create the SUMMARY.md file using the summary template structure.

1. Determine the summary file path:
   ```bash
   SUMMARY_FILE="$PHASE_PATH/${PADDED_PHASE}-${PADDED_PLAN}-SUMMARY.md"
   ```

2. Build the summary content following `bin/templates/summary.md` structure:

   **Frontmatter:**
   ```yaml
   ---
   phase: {PADDED_PHASE}
   plan: {PADDED_PLAN}
   completed: {YYYY-MM-DD}
   ---
   ```

   **Title:** `# Phase {PHASE} Plan {PLAN}: [Name] Summary`

   **One-liner:** Substantive description of what was built (not "X implemented" but "JWT auth with refresh rotation using jose library").

   **Sections:**
   - **Objective**: Copied from the plan's `<objective>` block
   - **What Was Built**: List actual deliverables with file paths from git evidence
   - **Plan vs Actual**: Table comparing:
     | Aspect | Planned | Actual |
     |--------|---------|--------|
     | Tasks | {planned_count} | {actual_count} |
     | Files | {planned_files} | {actual_files} |
     | Duration | {estimated} | {actual_duration} |
   - **Decisions Made**: Any decisions logged during execution (from STATE.md or commit messages)
   - **Deviations from Plan**: Differences between planned and actual work. If none: "None - plan executed exactly as written."
   - **Deferred Items**: Anything planned but not completed. If none: "None."

3. Write the summary file:
   Use the Write tool to create `$SUMMARY_FILE` with the assembled content.
</step>

<step name="update_state_and_roadmap">
Transition the plan to COMPLETED and update all tracking files.

1. Transition the plan status to COMPLETED:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" frontmatter set "$PLAN_FILE" status COMPLETED
   ```
   The lifecycle module validates the transition (IN_PROGRESS -> COMPLETED or COMPLETED -> COMPLETED is idempotent).

2. Update STATE.md -- advance the plan counter:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Plan" "${NEXT_PLAN_NUM} of ${TOTAL_PLANS} in current phase"
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Last activity" "$(date +%Y-%m-%d) -- Completed plan ${PADDED_PHASE}-${PADDED_PLAN}"
   ```

3. Add any new decisions to STATE.md:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state get "Decisions"
   ```
   Append new decisions from the execution if not already present.

4. Update ROADMAP.md -- mark the plan as complete:
   Find the plan's entry in ROADMAP.md and change `[ ]` to `[x]`:
   ```bash
   # Read ROADMAP.md, find the line for this plan, mark complete
   # Use Edit tool to change "- [ ] Plan XX-NN" to "- [x] Plan XX-NN"
   ```

5. Commit all changes:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" commit "unify(${PADDED_PHASE}-${PADDED_PLAN}): close loop with summary" --files "$SUMMARY_FILE" "$PROJECT_DIR/.planning/STATE.md" "$PROJECT_DIR/.planning/ROADMAP.md" "$PLAN_FILE"
   ```
</step>

<step name="offer_next">
Suggest the appropriate next action based on phase progress.

1. Check if more plans exist in the current phase:
   ```bash
   TOTAL_PLANS=$(ls "$PHASE_PATH"/*-PLAN.md 2>/dev/null | wc -l)
   COMPLETED_PLANS=$(ls "$PHASE_PATH"/*-SUMMARY.md 2>/dev/null | wc -l)
   ```

2. If uncompleted plans remain:
   ```
   Loop closed for plan ${PADDED_PHASE}-${PADDED_PLAN}.
   Next: Run `/dan:apply` on plan ${PADDED_PHASE}-${NEXT_PADDED_PLAN} to continue.
   ```

3. If all plans in the phase are complete:
   ```
   Phase ${PADDED_PHASE} complete -- all plans have summaries.
   Next: Run `/dan:verify` to validate phase deliverables, or `/dan:plan` for the next phase.
   ```

4. Always confirm closure:
   ```
   The loop is now closed for plan ${PADDED_PHASE}-${PADDED_PLAN}.
   ```
</step>

</execution_flow>
