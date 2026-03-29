---
name: "dan:verify"
description: "Spawn verifier agent to validate phase outputs against requirements and success criteria"
argument-hint: "[phase-number]"
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:verify

Spawn a dan-verifier agent to validate all phase outputs against REQUIREMENTS.md and each plan's success criteria.

## What It Does

1. Reads all SUMMARY.md files for the target phase
2. Reads REQUIREMENTS.md for traceable requirements
3. Spawns dan-verifier agent to:
   - Run automated verification commands from each plan
   - Cross-check requirements coverage
   - Validate all artifacts exist and are correct
   - Produce a verification report
4. Updates STATE.md with verification results

## Execution Mode

Spawns **dan-verifier** subagent. Verifier has read-only access (no Write tool).

## CLI Tools

State operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Status" "Verifying"
```

<execution_flow>

<step name="parse_phase">
## Step 1: Parse Phase

Parse the phase number from the user's input argument. Resolve the phase directory.

```bash
# Resolve phase directory
PHASE_DIR=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" phase find "$PHASE_NUM")
PADDED=$(printf '%02d' "$PHASE_NUM")
```

Set `PROJECT_DIR` to the project root (cwd of the invoking session).
</step>

<step name="load_phase_context">
## Step 2: Load Phase Context

Read all context files needed by the verifier:

1. **ROADMAP.md** -- extract phase goal and success criteria for this phase
2. **All *-PLAN.md files** in the phase directory -- each plan's `must_haves` (truths, artifacts, key_links), tasks, and verification commands
3. **All *-SUMMARY.md files** in the phase directory -- completed plan results, key_files, deviations
4. **REQUIREMENTS.md** -- requirement IDs mapped to this phase for coverage checking

Collect the list of plan file paths for passing to the verifier agent.

```bash
# List plan files in phase directory
PLAN_FILES=$(ls "$PHASE_DIR"/*-PLAN.md 2>/dev/null)
SUMMARY_FILES=$(ls "$PHASE_DIR"/*-SUMMARY.md 2>/dev/null)
```
</step>

<step name="update_state">
## Step 3: Update State

Mark the project as actively verifying.

```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Status" "Verifying phase $PHASE_NUM"
```
</step>

<step name="spawn_verifier">
## Step 4: Spawn Verifier (check_must_haves)

Spawn a **dan-verifier** agent with the following instructions:

```
Task(
  prompt="You are verifying Phase {PHASE_NUM} deliverables.

Read these context files:
- .planning/ROADMAP.md (phase goal and success criteria)
- .planning/REQUIREMENTS.md (requirement IDs for this phase)
- {each PLAN file path}
- {each SUMMARY file path}

For each plan, run these CLI verification commands:

  # Artifact verification -- checks must_haves.artifacts exist and are substantive
  node \"$HOME/.claude/dan/bin/dan-tools.cjs\" --cwd \"$PROJECT_DIR\" verify artifacts {plan-path}

  # Key-link verification -- checks must_haves.key_links wiring patterns
  node \"$HOME/.claude/dan/bin/dan-tools.cjs\" --cwd \"$PROJECT_DIR\" verify key-links {plan-path}

Run phase-level checks:

  # Phase completeness -- all plans have matching summaries
  node \"$HOME/.claude/dan/bin/dan-tools.cjs\" --cwd \"$PROJECT_DIR\" verify phase-completeness {PHASE_NUM}

  # Automated test suite
  node --test bin/tests/

Check each must_haves.truths entry against evidence in the codebase.
Check each requirement from REQUIREMENTS.md against deliverable evidence.
Check for stub patterns: TODO, TBD, placeholder text, functions returning hardcoded values, files under 10 lines that should be substantial.

Write your results to: {PHASE_DIR}/{PADDED}-VERIFICATION.md
Use the VERIFICATION.md template (frontmatter with phase/verified/status/score/bugsweep_cycles, criteria table, artifact table, key-link table, requirements table, issues list, test results, bugsweep history).",
  subagent_type="dan-verifier",
  description="verify phase {PHASE_NUM}"
)
```

The verifier agent is read-only. It produces `{PADDED}-VERIFICATION.md` but does NOT fix any issues it finds.
</step>

<step name="report_results">
## Step 5: Report Results

Read the generated VERIFICATION.md. Extract the overall status and score.

```bash
# Update state with verification result
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Status" "Phase $PHASE_NUM verification: $STATUS"
```

Report to user:
```
## Verification Complete

**Phase:** {PHASE_NUM}
**Status:** {passed | gaps_found | human_needed}
**Score:** {N}/{M} must-haves verified
**Issues found:** {count}
**Report:** {PHASE_DIR}/{PADDED}-VERIFICATION.md
```

If status is `gaps_found` or `human_needed`, suggest running `/dan:bugsweep {PHASE_NUM}` to attempt automated fixes.
</step>

## Constraints

- **Read-only verifier:** The dan-verifier agent has NO Write or Edit tools. It can only read and report.
- **CLI tools for deterministic checks:** Artifact verification, key-link verification, and phase completeness use the CLI module (not inline logic in the agent prompt).
- **Evidence required:** Every pass/fail in VERIFICATION.md must include specific evidence (file path, command output, line number).
- **Two-level hierarchy:** This skill spawns the verifier agent. The agent does not spawn sub-agents.

</execution_flow>
