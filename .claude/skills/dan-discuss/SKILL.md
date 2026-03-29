---
name: "dan:discuss"
description: "Deep interview phase to capture project intent, constraints, and success criteria"
argument-hint: "<phase-number>"
disable-model-invocation: true
agent-skills:
  - dan-workflow
---

# dan:discuss

Run the discuss phase for a specific phase -- a structured interview that surfaces decisions, tradeoffs, constraints, and preferences before any planning begins. Produces a phase-level CONTEXT.md that downstream skills (research, plan, apply) consume.

## What It Does

1. Parses the target phase from the argument
2. Loads project vision, roadmap, state, requirements, and any existing context from other phases
3. Identifies 3-7 gray areas -- implementation decisions where multiple valid approaches exist
4. Presents gray areas for user selection (all, some, or user-defined additions)
5. Runs a multi-round interactive interview on each selected area (up to 4 questions per area)
6. Enforces scope guardrail: discussion clarifies HOW to implement what is scoped, never WHETHER to add new capabilities
7. Captures deferred ideas so the user feels heard without expanding scope
8. Writes structured CONTEXT.md with decisions, deferred ideas, and open questions
9. Updates state and commits

## Execution Mode

Runs **in-session** (interactive). Requires multiple rounds of user input. No agent spawning -- the skill IS the interviewer. This is a conversation, not a delegation.

## CLI Tools

State operations use the DAN CLI:
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "last_activity" "2026-03-28 -- Discuss phase 03"
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR commit "docs(03): capture discussion context" --files .planning/phases/03-research-system/03-CONTEXT.md
```

<execution_flow>

<step name="parse_target">
## Step 1: Parse Target

Determine the phase number from the user's argument (e.g., `/dan:discuss 03`).

**Actions:**
1. Extract phase number from argument. If no argument, ask the user which phase to discuss.
2. Validate that the phase directory exists: `.planning/phases/{phase-dir}/`
3. Set the output path: `.planning/phases/{phase-dir}/{phase}-CONTEXT.md`
4. If a CONTEXT.md already exists for this phase, inform the user and ask whether to overwrite or append to it.

**Error handling:**
- No argument and user does not specify: list available phases from ROADMAP.md and ask.
- Phase directory does not exist: inform user and stop.
</step>

<step name="load_prior_context">
## Step 2: Load Prior Context

Read background files to understand what is already known. This prevents re-litigating settled decisions and ensures continuity.

**Files to load:**
1. `.planning/PROJECT.md` -- project vision, core value, key decisions
2. `.planning/ROADMAP.md` -- phase goal, requirements list, success criteria for target phase
3. `.planning/STATE.md` -- current position, accumulated decisions (never re-litigate these)
4. `.planning/REQUIREMENTS.md` -- requirement details for target phase (requirement IDs, descriptions)
5. Any existing `*-CONTEXT.md` files from other phases -- for cross-phase awareness (e.g., if phase 2 already discussed error handling, phase 3 should not contradict it)
6. Any existing `*-RESEARCH.md` for this phase -- if research ran before discuss, its findings inform gray area identification

**Key principle:** Prior decisions from STATE.md and PROJECT.md are SETTLED. If the user brings up a settled decision, acknowledge it and reference where it was decided. Do not reopen it unless the user explicitly requests reconsideration.
</step>

<step name="identify_gray_areas">
## Step 3: Identify Gray Areas

Analyze the phase goal, requirements, and loaded context to identify 3-7 gray areas.

**What is a gray area?**
A gray area is an implementation decision where multiple valid approaches exist and the user's preference matters. These are NOT yes/no questions -- they are design choices with real tradeoffs.

**Examples of gray areas:**
- "How should research convergence be measured -- gap count trending, confidence thresholds, or both?"
- "What tradeoffs matter for multi-pass research -- depth vs breadth vs speed?"
- "How should the discuss phase handle conflicting requirements?"
- "What level of autonomy should the research loop have before escalating?"

**How to identify them:**
1. Read the phase goal and requirements carefully
2. For each requirement, ask: "Is there an obvious single implementation, or could this go multiple ways?"
3. Look for tension between requirements (e.g., thoroughness vs speed)
4. Consider integration points with existing phases -- where do assumptions from prior phases need validation?
5. Think about what a planner would need to know to write good tasks

**Presentation:**
Present gray areas as a numbered list with brief descriptions. Then ask:

"Which of these would you like to discuss? You can:
- Select all (just say 'all')
- Pick specific numbers (e.g., '1, 3, 5')
- Add your own topics
- Skip any that feel obvious"

Wait for user selection before proceeding.
</step>

<step name="discuss_selected_areas">
## Step 4: Discuss Each Selected Area

For each selected gray area, run a focused mini-interview.

**Protocol per area:**
1. Ask up to 4 focused questions, one at a time
2. Each question should build on the previous answer -- follow the thread, do not follow a script
3. Questions should surface: decisions, tradeoffs, constraints, preferences, and non-obvious implications
4. After 4 questions (or when the area feels resolved), ask: "Anything else on this, or move to the next area?"
5. If the user says "move on" at any point, respect that immediately

**Questioning philosophy (from questioning.md):**
- You are a thinking partner, not an interviewer
- Follow energy -- whatever the user emphasizes, dig into that
- Challenge vagueness -- "good" means what? "simple" means how?
- Make the abstract concrete -- "walk me through that" / "what does that actually look like?"
- Do not interrogate. Collaborate. Do not follow a script. Follow the thread.

**Question types to draw from:**
- Tradeoff questions: "If you had to choose between X and Y, which matters more?"
- Concrete scenario questions: "Walk me through what happens when Z occurs"
- Constraint questions: "Are there hard limits on X, or is it a preference?"
- Prior art questions: "You mentioned A in phase N -- does that pattern apply here too?"
- Edge case questions: "What should happen when X goes wrong?"

**Scope guardrail (scope_guardrail) enforcement:**
If the user mentions something outside this phase's scope, apply this test:
> "Does this clarify HOW to implement what is already scoped, or does it add a new capability?"

- If it clarifies HOW: continue the discussion, it is in scope.
- If it adds new capability: acknowledge the idea, say "That is a great idea -- I will capture it in deferred ideas so it is not lost. For now, let us focus on [current phase goal]." Then redirect.
- If ambiguous: ask the user -- "Is this something you want in this phase, or is it a future idea?"

**Deferred idea capture:**
When capturing a deferred idea, mentally note it with enough context to be actionable later. The user should feel heard -- their idea is valued, just not for this phase.
</step>

<step name="write_context">
## Step 5: Write CONTEXT.md

After all selected areas are discussed, synthesize the conversation into a structured CONTEXT.md file.

**Output path:** `.planning/phases/{phase-dir}/{phase}-CONTEXT.md`

**Format:**
```markdown
---
phase: {phase-number}
created: {YYYY-MM-DD}
areas_discussed: {count}
decisions_captured: {count}
deferred_count: {count}
---

# Phase {N}: {Phase Name} -- Discussion Context

## Domain
{Brief description of what this phase covers and the key challenge it addresses.
This should be 2-3 sentences that orient a reader who has not seen the discussion.}

## Decisions

{Numbered list of decisions made during discussion. Each decision is a concrete choice, not a vague preference.}

1. **{Decision title}**
   - Decision: {what was decided, stated as a clear directive}
   - Rationale: {why this choice over alternatives}
   - Alternatives considered: {what else was discussed and why it was not chosen}

2. **{Decision title}**
   - Decision: {what was decided}
   - Rationale: {why}
   - Alternatives considered: {what else}

## Code Context

{Technical context relevant to implementation. Reference existing patterns, files, and conventions that implementers need to know about. Include specific file paths and function names where relevant.}

## Specifics

{Detailed implementation guidance captured from discussion. These are the "how" details that go beyond what requirements specify. Organized by topic or requirement.}

## Deferred Ideas

{Ideas mentioned during discussion but explicitly deferred to a future phase. Each item has enough context to be actionable later without re-discussing.}

- **{Idea title}**: {description} -- Deferred because: {reason}

## Open Questions

{Questions that came up during discussion but were not resolved. These may need research, experimentation, or a future discussion. Each question includes enough context to understand why it matters.}

- **{Question}**: {context for why this matters and what depends on the answer}
```

**Writing principles:**
- Decisions must be specific enough to act on. "Use X approach" not "consider X approach."
- Rationale must explain WHY, not just restate the decision.
- Deferred ideas must have enough context to be actionable in a future phase without re-asking the user.
- Open questions must explain what depends on the answer so research can prioritize them.
- Code context should reference actual file paths and patterns from the codebase.
</step>

<step name="update_state_and_commit">
## Step 6: Update State and Commit

After writing CONTEXT.md, update project state and commit.

**State update:**
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "last_activity" "{date} -- Discuss phase {N}"
```

**Commit:**
```bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR commit "docs({phase}): capture discussion context" --files .planning/phases/{phase-dir}/{phase}-CONTEXT.md
```

**Error handling:**
- If commit fails, report the error to the user and suggest manual commit.
- If state update fails, proceed with commit anyway -- state is advisory, context file is the critical artifact.
</step>

<step name="report">
## Step 7: Report

Summarize the discussion session for the user.

**Report format:**
```
Discussion complete for Phase {N}: {Phase Name}

- Areas discussed: {count}
- Decisions captured: {count}
- Items deferred: {count}
- Open questions: {count}

Output: .planning/phases/{phase-dir}/{phase}-CONTEXT.md

Suggested next step: {recommendation}
```

**Next step recommendations:**
- If the phase has no RESEARCH.md yet: "Run `/dan:research {phase}` to investigate open questions and validate decisions."
- If research already exists: "Run `/dan:plan {phase}` to create implementation plans informed by this context."
- If there are many open questions: "Consider running `/dan:research {phase}` to resolve open questions before planning."
- If discussion was thorough and no open questions remain: "Ready for `/dan:plan {phase}` -- the context is clear."
</step>

</execution_flow>
