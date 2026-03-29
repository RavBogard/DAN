---
name: "dan:research"
description: "Spawn parallel researcher agents to investigate a topic or phase, then synthesize findings"
argument-hint: "[phase-number | topic]"
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:research

Spawn dan-researcher agents in parallel waves to investigate a topic or phase, then spawn a dan-synthesizer agent to merge findings into a coherent research document.

## What It Does

1. Parses the target (phase number or freeform topic)
2. Spawns parallel dan-researcher agents (one per research angle)
3. Each researcher produces a scoped findings file
4. Spawns dan-synthesizer agent to merge findings into `{phase}-RESEARCH.md`
5. Updates STATE.md with research completion status

## Execution Mode

Spawns **subagents** (dan-researcher, dan-synthesizer). Orchestrated from the skill level.

## CLI Tools

State operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Status" "Researching"
```

<execution_flow>

<step name="parse_target">
## Step 1: Parse Target

Determine the research target from the user's input:
- **Project-level**: target = "project"
  - Output dir: `.planning/research/` (with `pass-N/` subdirs, `state.json`, `SUMMARY.md`)
- **Phase-level**: target = phase number (e.g., "3" or "03")
  - Output dir: `.planning/phases/{phase-dir}/research/` (same structure)

```bash
# Resolve phase directory name for phase targets
RESEARCH_DIR=$( [ "$TARGET" = "project" ] \
  && echo ".planning/research" \
  || echo ".planning/phases/$(ls .planning/phases/ | grep "^$(printf '%02d' $TARGET)-")/research" )
```
</step>

<step name="load_prior_context">
## Step 2: Load Prior Context

Read project context files to pass to researchers:
- Always read: `PROJECT.md`, `ROADMAP.md`, `STATE.md`
- For phase targets: also read phase requirements from ROADMAP.md and any existing `{phase}-RESEARCH.md`
- For project targets: this is initial research (no prior research exists)

Store file paths for injection into researcher prompts.
</step>

<step name="init_research_state">
## Step 3: Initialize Research State

```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" research init "$TARGET" --max-passes 4
```

This creates `state.json` in the research directory with `max_passes: 4`, `current_pass: 0`, empty passes array.
</step>

<step name="research_loop">
## Step 4: Research Loop

The core recursive loop. Runs while convergence check says continue AND pass count < 4 (hard cap).

```
PASS = 1
while PASS <= 4:
    run step spawn_researchers(PASS)
    run step spawn_synthesizer(PASS)
    run step extract_and_record(PASS)
    run step convergence_check(PASS)
    if converged: break
    PASS += 1
```

### Step 4a: Determine Dimensions

- **Pass 1** (project or phase): 4 parallel dimensions for broad domain coverage:
  - `stack` -- standard technology choices for this domain
  - `features` -- core features users expect, what's table-stakes vs differentiating
  - `architecture` -- common architectural patterns, data models, system boundaries
  - `pitfalls` -- common mistakes, anti-patterns, things that waste time

- **Pass 2+** (any target): only dimensions with gaps from previous synthesis.
  Each gap has a `dimension`, `topic`, `priority`, and `reason` extracted from the synthesizer's `<gaps>` block.
  Only HIGH and MEDIUM priority gaps spawn researchers. LOW priority gaps are deferred.

### Step 4b: Spawn Researchers {#spawn_researchers}

One `Task()` call per dimension. All researchers run in parallel.

**Pass 1 researcher spawn:**
```
Task(
  prompt="You are researching the '{dimension}' dimension for {target_description}.

Read these context files first:
- {PROJECT_MD_PATH}
- {ROADMAP_MD_PATH}
{PHASE_REQUIREMENTS if phase-level}

Research mode: BROAD (Pass 1)
Dimension: {dimension}

Write your findings to: {RESEARCH_DIR}/pass-1/{dimension}.md

Follow the structured output format in your agent definition.",
  subagent_type="dan-researcher",
  description="{dimension} research (pass 1)"
)
```

**Pass 2+ gap-targeted researcher spawn:**
```
Task(
  prompt="You are researching a specific gap identified in previous research.

Read these context files first:
- {PROJECT_MD_PATH}
- {PRIOR_FINDINGS_PATH} (your dimension's previous findings)

Research mode: GAP-TARGETED (Pass {N})
Gap dimension: {gap.dimension}
Gap topic: {gap.topic}
Gap reason: {gap.reason}

Do NOT repeat already-covered topics. Focus specifically on the gap.

Write your findings to: {RESEARCH_DIR}/pass-{N}/gap-{dimension}.md

Follow the structured output format in your agent definition.",
  subagent_type="dan-researcher",
  description="gap research: {gap.topic} (pass {N})"
)
```

**CRITICAL:** Each researcher writes to a uniquely-named file. No shared output paths.

### Step 4c: Spawn Synthesizer {#spawn_synthesizer}

One `Task()` call after all researchers complete.

**Pass 1 synthesizer spawn:**
```
Task(
  prompt="Synthesize the following Pass 1 research findings into a unified synthesis.

Read these research files:
- {RESEARCH_DIR}/pass-1/stack.md
- {RESEARCH_DIR}/pass-1/features.md
- {RESEARCH_DIR}/pass-1/architecture.md
- {RESEARCH_DIR}/pass-1/pitfalls.md

Target: {target_description}
Pass: 1

Write your synthesis to: {RESEARCH_DIR}/synthesis.md

Follow the structured output format in your agent definition.
Include a machine-parseable <gaps> block with any remaining gaps.",
  subagent_type="dan-synthesizer",
  description="synthesis (pass 1)"
)
```

**Pass 2+ synthesizer spawn:**
```
Task(
  prompt="Update the research synthesis with new gap-targeted findings.

Read these files:
- {RESEARCH_DIR}/synthesis.md (PREVIOUS synthesis -- your starting point)
- {RESEARCH_DIR}/pass-{N}/gap-{dim1}.md (new gap findings)
- {RESEARCH_DIR}/pass-{N}/gap-{dim2}.md (new gap findings)

Do NOT re-read raw files from earlier passes. Use the previous synthesis as your baseline.
Update confidence levels. Check if gaps are now resolved.

Target: {target_description}
Pass: {N}

Write your updated synthesis to: {RESEARCH_DIR}/synthesis.md

Follow the structured output format in your agent definition.
Include a machine-parseable <gaps> block with any remaining gaps.",
  subagent_type="dan-synthesizer",
  description="synthesis (pass {N})"
)
```

**CRITICAL:** Pass 2+ synthesizer reads PREVIOUS synthesis + NEW gap findings ONLY. Not cumulative raw files from all passes. This prevents context overload.

### Step 4d: Extract Results

Read `{RESEARCH_DIR}/synthesis.md`. Extract:
- **Gaps**: Parse the `<gaps>` block. Each gap has dimension, topic, priority, reason.
- **Confidence**: Parse the "Confidence by Dimension" table. Map dimension -> HIGH/MEDIUM/LOW.

### Step 4e: Record Pass

```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" \
  research record-pass "$TARGET" \
  --pass $PASS \
  --gaps '$GAPS_JSON' \
  --confidence '$CONFIDENCE_JSON'
```

### Step 4f: Check Convergence {#convergence_check}

```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" \
  research check-convergence "$TARGET"
```

Parse the JSON output: `{should_continue, reason}`.
- If `should_continue` is false: exit the loop. Research is complete.
- If `should_continue` is true: increment pass counter, loop back to 4a.

Convergence is checked in priority order by the CLI module:
1. Hard cap (max 4 passes) -- terminates unconditionally
2. No gaps remaining -- ideal convergence
3. All dimensions HIGH confidence -- sufficient even with minor gaps
4. Diminishing returns (gap count not decreasing) -- prevents infinite loops
</step>

<step name="finalize">
## Step 5: Finalize Output

Copy/organize research artifacts to their final locations:

**Project-level target:**
- `{RESEARCH_DIR}/SUMMARY.md` -- final synthesis (copy from synthesis.md)
- `{RESEARCH_DIR}/STACK.md` -- stack findings (copy from pass-1/stack.md)
- `{RESEARCH_DIR}/FEATURES.md` -- features findings (copy from pass-1/features.md)
- `{RESEARCH_DIR}/ARCHITECTURE.md` -- architecture findings (copy from pass-1/architecture.md)
- `{RESEARCH_DIR}/PITFALLS.md` -- pitfalls findings (copy from pass-1/pitfalls.md)

**Phase-level target:**
- `.planning/phases/{phase-dir}/{phase}-RESEARCH.md` -- final synthesis (copy from synthesis.md)
</step>

<step name="update_state">
## Step 6: Update State

```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Status" "Research complete"

# Commit research artifacts
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" commit \
  "research($TARGET): complete multi-pass research" \
  --files {all research output files}
```
</step>

<step name="report">
## Step 7: Report

Display research summary to the user:

```
## Research Complete

**Target:** {target_description}
**Passes completed:** {pass_count}
**Convergence reason:** {convergence_reason}
**Confidence by dimension:**
| Dimension | Confidence |
|-----------|------------|
| stack     | HIGH       |
| features  | HIGH       |
| ...       | ...        |

**Gaps resolved:** {total_gaps_found - remaining_gaps}
**Output:** {final output path}
```
</step>

## Constraints

- **Two-level hierarchy:** This skill is the ONLY entity that spawns agents. No agent spawns another agent.
- **Hard cap:** Maximum 4 passes enforced both in the loop condition AND by the CLI module.
- **Unique output paths:** Each researcher writes to a uniquely-named file (dimension name in filename).
- **Context discipline:** Pass 2+ synthesizer reads previous synthesis + new gap findings only (not cumulative raw files from all passes).
- **Both targets supported:** Project-level (`dan:research project`) and phase-level (`dan:research 3`) use the same loop with different output paths.

</execution_flow>
