# Phase 2: Core Loop - Research

**Researched:** 2026-03-28
**Domain:** Plan-Apply-Unify workflow engine with Execute/Qualify separation
**Confidence:** HIGH

## Summary

Phase 2 implements the Plan-Apply-Unify (PAU) loop -- the minimum viable workflow that enables a user to define work, execute it with independent qualification, and close the loop with reconciliation. This is the heart of DAN and draws directly from PAUL's loop protocol (three-phase mandatory closure) and GSD's execution engine (subagent orchestration, deviation rules, checkpoint handling).

The critical design challenge is the Execute/Qualify separation: the executor produces work with full tool access, then a separate qualifier agent re-reads the output with read-only tools and grades it against acceptance criteria. This ensures no self-grading. The qualifier returns one of four statuses (PASS, PASS_WITH_CONCERNS, NEEDS_REVISION, FAIL), and NEEDS_REVISION triggers an automatic retry loop (max 3 attempts). FAIL triggers diagnostic routing that classifies the root cause as intent (wrong goal), spec (wrong plan), or code (wrong implementation) before any fix is attempted.

The three skills (dan:plan, dan:apply, dan:unify) are currently stubs with frontmatter only. This phase fills in the `<execution_flow>` sections with full workflow logic. The plan lifecycle state machine (DRAFT -> APPROVED -> IN_PROGRESS -> COMPLETED/ABANDONED) is tracked in plan frontmatter and STATE.md. Mandatory loop closure is enforced by the unify step -- every PLAN.md must have a corresponding SUMMARY.md, and the system refuses to start a new plan if the previous loop is unclosed.

**Primary recommendation:** Build the three skills sequentially (plan -> apply -> unify), with the apply skill containing the most complexity (E/Q loop, diagnostic routing, retry logic, checkpoint handling). Use PAUL's workflow files as direct templates, adapting for DAN's CLI tools and file structure.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| LOOP-01 | `/dan:plan` creates executable plan with objective, AC, tasks, boundaries | PAUL plan-phase.md provides exact structure; plan template already exists at bin/templates/plan.md |
| LOOP-02 | Plans sized for single context window (2-3 tasks per plan) | PAUL work-units.md defines sizing rules: 2-3 tasks, target 50% context, split signals |
| LOOP-03 | `/dan:apply` executes plan tasks with fresh-context executor agent | GSD execute-plan.md provides Pattern A/B/C routing; PAUL apply-phase.md provides task-by-task execution |
| LOOP-04 | Execute/Qualify separation -- independent qualifier re-reads and grades | dan-qualifier agent already scaffolded with read-only tools; E/Q protocol defined in dan-workflow SKILL.md |
| LOOP-05 | Four-status task reporting: PASS, PASS_WITH_CONCERNS, NEEDS_REVISION, FAIL | dan-workflow SKILL.md already defines the four statuses and their meanings |
| LOOP-06 | Qualifier triggers fix loop on NEEDS_REVISION (max 3 attempts before escalation) | PAUL quality-principles.md establishes retry pattern; implementation needs retry counter in apply skill |
| LOOP-07 | `/dan:unify` creates SUMMARY.md comparing plan vs actual | PAUL unify-phase.md provides exact reconciliation process; summary template exists at bin/templates/summary.md |
| LOOP-08 | Mandatory loop closure -- every PLAN gets a SUMMARY, no orphan plans | PAUL loop-phases.md: "Never leave a loop incomplete"; enforced by precondition check in plan skill |
| LOOP-09 | Plan lifecycle states: DRAFT -> APPROVED -> IN_PROGRESS -> COMPLETED/ABANDONED | Tracked via plan frontmatter `status` field + STATE.md position tracking |
| LOOP-10 | Atomic task checkpointing -- task status saved after each completion | GSD task_commit protocol + dan-tools state patch for progress updates |
| LOOP-11 | Diagnostic failure routing -- classify root cause before fix | dan-workflow SKILL.md defines intent/spec/code classification; needs implementation in apply skill |
</phase_requirements>

## Standard Stack

### Core

| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| dan:plan skill | `.claude/skills/dan-plan/SKILL.md` | Orchestrate plan creation | Stub exists, needs execution_flow |
| dan:apply skill | `.claude/skills/dan-apply/SKILL.md` | Orchestrate task execution with E/Q | Stub exists, needs execution_flow |
| dan:unify skill | `.claude/skills/dan-unify/SKILL.md` | Orchestrate loop closure | Stub exists, needs execution_flow |
| dan-planner agent | `.claude/agents/dan-planner.md` | Generate plan files | Scaffolded with tool restrictions |
| dan-executor agent | `.claude/agents/dan-executor.md` | Execute individual tasks | Scaffolded with full tool access |
| dan-qualifier agent | `.claude/agents/dan-qualifier.md` | Independent qualification | Scaffolded with read-only tools |
| dan-workflow skill | `.claude/skills/dan-workflow/SKILL.md` | Shared protocols (loop, E/Q, diagnostic) | Already has content, may need enhancement |
| dan-tools.cjs | `bin/dan-tools.cjs` | State read/write, frontmatter, commit | 7 subcommands operational |
| plan.md template | `bin/templates/plan.md` | Plan file structure | Template exists with XML task format |
| summary.md template | `bin/templates/summary.md` | Summary file structure | Template exists with plan-vs-actual |

### Supporting

| Component | Location | Purpose | When to Use |
|-----------|----------|---------|-------------|
| dan-tools state patch | CLI | Atomic multi-field state updates | After each task completion |
| dan-tools frontmatter parse | CLI | Read plan frontmatter (status, wave, deps) | Plan loading and lifecycle tracking |
| dan-tools commit | CLI | Atomic git commits per task | Task commit protocol |
| dan-tools dependency analyze | CLI | Task ordering by dependencies | Wave-based execution (future) |

### What's Missing (Must Build)

| Gap | Where | Purpose |
|-----|-------|---------|
| Plan lifecycle tracking | State module or frontmatter | DRAFT/APPROVED/IN_PROGRESS/COMPLETED/ABANDONED states |
| E/Q retry counter | Apply skill logic | Track revision attempts per task, cap at 3 |
| Diagnostic routing logic | Apply skill or workflow references | Classify failures as intent/spec/code |
| Orphan plan detection | Plan skill precondition | Check for unclosed loops before new plan |
| Qualifier output format | Qualifier agent prompt | Structured JSON/markdown for status parsing |

## Architecture Patterns

### Recommended Approach: Skill-as-Orchestrator

Each skill (plan, apply, unify) follows the same pattern:

```
Skill receives user invocation
  -> Read STATE.md to validate preconditions
  -> Read plan/phase files for context
  -> Execute workflow steps (spawn agents or work in-session)
  -> Update STATE.md with results
  -> Offer next action
```

### Pattern 1: Plan Lifecycle State Machine

**What:** Track plan status through lifecycle states in plan frontmatter.
**When to use:** Every plan file from creation to closure.

```yaml
---
phase: 02-core-loop
plan: 01
status: DRAFT          # DRAFT -> APPROVED -> IN_PROGRESS -> COMPLETED | ABANDONED
approved_at: null
started_at: null
completed_at: null
---
```

State transitions:
- `DRAFT`: Plan created by planner, awaiting user review
- `APPROVED`: User explicitly approved, ready for execution
- `IN_PROGRESS`: At least one task has started execution
- `COMPLETED`: All tasks done, SUMMARY.md exists
- `ABANDONED`: User chose to abandon (still gets a SUMMARY noting abandonment)

**How to track:** Use `dan-tools frontmatter parse` to read current status, and a new frontmatter `set` subcommand (or direct file edit) to update status. State transitions are also reflected in STATE.md via `dan-tools state set`.

### Pattern 2: Execute/Qualify Loop

**What:** After each task, spawn a qualifier agent to independently grade the output.
**When to use:** During `/dan:apply` for every task (qualification is not optional).

```
For each task in plan:
  1. Execute task (in-session or via dan-executor agent)
  2. Commit task output atomically
  3. Spawn dan-qualifier agent with:
     - Path to plan file (for task spec and done criteria)
     - Task number being qualified
     - Paths to modified files
  4. Qualifier returns: { status, criteria_results, evidence, issues }
  5. Route based on status:
     - PASS -> proceed to next task
     - PASS_WITH_CONCERNS -> log concerns, proceed
     - NEEDS_REVISION -> increment retry counter
       - If retries < 3: fix issues, re-execute, re-qualify
       - If retries >= 3: escalate to user
     - FAIL -> diagnostic routing -> escalate
```

**Key detail from PAUL:** The qualifier's judgment is based solely on reading the output and verification results. It never modifies files. It assesses against STATED criteria only (does not invent additional requirements).

### Pattern 3: Diagnostic Failure Routing

**What:** Before fixing a failed task, classify the root cause.
**When to use:** On FAIL status or after 3 failed NEEDS_REVISION retries.

```
Failure detected:
  1. Read the original task spec (intent)
  2. Read the qualifier's evidence (what went wrong)
  3. Classify:
     - INTENT: The plan targets the wrong thing
       -> Escalate to user (cannot fix autonomously)
     - SPEC: The task description is incorrect/incomplete
       -> Revise task spec, re-execute from scratch
     - CODE: The implementation doesn't match the spec
       -> Fix implementation, re-qualify
  4. Log classification in STATE.md decisions
```

**Key insight from PAUL:** "Always classify first. Fixing code when the spec is wrong wastes effort. Fixing the spec when the intent is wrong compounds the error."

### Pattern 4: Mandatory Loop Closure

**What:** Enforce that every PLAN gets a SUMMARY.
**When to use:** As a precondition check in `/dan:plan` before creating new plans.

```
Before creating a new plan:
  1. List all PLAN.md files in current phase directory
  2. List all SUMMARY.md files in current phase directory
  3. For each PLAN without a matching SUMMARY:
     - Check plan status in frontmatter
     - If IN_PROGRESS: "Previous plan not completed. Run /dan:apply or /dan:unify first."
     - If APPROVED: "Previous plan approved but not started. Run /dan:apply first."
     - If ABANDONED: should already have an abandonment SUMMARY
  4. Only proceed if all prior plans are closed (COMPLETED or ABANDONED with SUMMARY)
```

### Pattern 5: In-Session Execution with Agent Qualification

**What:** Execute tasks in the main session but always use a subagent for qualification.
**When to use:** Default execution mode for `/dan:apply`.

PAUL insight: subagents lose ~30% quality from missing context. GSD insight: fresh context prevents rot.

**DAN's approach:** Execute in-session (preserves full context for implementation), qualify via subagent (independence is the entire point of qualification). This gives the best of both: full-context execution quality + independent verification.

The executor and qualifier NEVER share context. The qualifier gets a fresh window with only the plan spec and the file paths to review.

### Anti-Patterns to Avoid

- **Self-grading:** The executor NEVER assesses its own work. Even if the executor runs tests and they pass, the qualifier still independently verifies.
- **Skipping unify:** "Tasks done, moving on" without SUMMARY.md breaks traceability. Even abandoned plans get a summary.
- **Implicit approval:** Plans in DRAFT state require explicit user approval before execution starts. PAUL: "Do NOT assume approval."
- **Fat retry loops:** Retrying the same approach repeatedly without diagnostic routing. If it failed 3 times, the problem is likely not the code but the spec or intent.
- **Monolithic plans:** Plans with 4+ tasks will hit context rot. Split aggressively. PAUL: "2-3 tasks per plan maximum."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom regex per field | `dan-tools frontmatter parse` | Already handles edge cases (zero-prefixed numbers, arrays, nested objects) |
| State file updates | Direct regex replace | `dan-tools state set/patch` | Atomic writes prevent corruption |
| Git commits | Manual git commands | `dan-tools commit` | Uses execFileSync (no shell injection), atomic temp+rename |
| Progress tracking | Custom progress calculation | `dan-tools phase` module | renderProgressBar, plan counting already exist |
| Plan template structure | Inventing XML format | Existing `bin/templates/plan.md` | Template with all required sections already exists |
| Task dependency ordering | Custom topological sort | `dan-tools dependency analyze` | Kahn's algorithm already implemented |

**Key insight:** Phase 1 built all the atomic operations. Phase 2 should be pure orchestration logic -- sequencing calls to existing CLI tools and spawning agents with the right prompts.

## Common Pitfalls

### Pitfall 1: Qualifier Returns Unstructured Text
**What goes wrong:** The qualifier agent returns a prose paragraph instead of a parseable status.
**Why it happens:** LLM agents naturally produce conversational output unless constrained.
**How to avoid:** The qualifier agent prompt must specify an exact output format. Use a structured template:
```
## Qualification Result
**Task:** [number]
**Status:** PASS | PASS_WITH_CONCERNS | NEEDS_REVISION | FAIL
**Criteria:**
- [criterion 1]: PASS/FAIL
- [criterion 2]: PASS/FAIL
**Evidence:** [specific file references, test output]
**Issues:** [numbered list if any]
```
**Warning signs:** Apply skill fails to parse qualifier output and treats every response as PASS.

### Pitfall 2: Retry Loop Without State
**What goes wrong:** A NEEDS_REVISION retry loses track of how many attempts have been made.
**Why it happens:** Retry count held in memory, not persisted. If session restarts, count resets.
**How to avoid:** Track retry count in STATE.md or a temporary file per task. On resume, read retry count and continue where left off.
**Warning signs:** Same task retried indefinitely after session restart.

### Pitfall 3: Orphan Plans on Session Interruption
**What goes wrong:** User's session ends during apply phase. Plan stuck in IN_PROGRESS forever.
**Why it happens:** No checkpoint after each task. State only updated at end of apply.
**How to avoid:** LOOP-10 requires atomic task checkpointing. After each task completes and is qualified, update STATE.md with the task number. On resume, pick up from the last checkpointed task.
**Warning signs:** STATE.md shows "In progress" but no specific task position.

### Pitfall 4: Context Rot During Long Apply Sessions
**What goes wrong:** Plan with 3 tasks takes a while. By task 3, quality degrades.
**Why it happens:** Context usage crosses 30-50% threshold during in-session execution.
**How to avoid:** Plans are already sized to 2-3 tasks (LOOP-02). If the apply skill detects it's running long, it can note this in the summary. For v1, trust the plan sizing. Context monitoring hooks are a Phase 5 concern.
**Warning signs:** Task 3 output consistently lower quality than Task 1 output.

### Pitfall 5: Diagnostic Routing Misclassification
**What goes wrong:** A spec problem is classified as code, leading to repeated failed code fixes.
**Why it happens:** The diagnostic routing logic doesn't have enough context to distinguish spec vs code issues.
**How to avoid:** Diagnostic routing should compare the qualifier's evidence against both the task spec AND the plan objective. If the evidence shows the code does what the spec says but the result is wrong, it's a spec issue. If the code doesn't do what the spec says, it's a code issue. If the spec itself is wrong for the objective, it's an intent issue.
**Warning signs:** Same task fails 3 times with different "code fixes" that all technically match the spec.

### Pitfall 6: Frontmatter Status Not Updated Atomically
**What goes wrong:** Plan status shows APPROVED in frontmatter but IN_PROGRESS in STATE.md (or vice versa).
**Why it happens:** Two separate write operations to different files, one fails.
**How to avoid:** Update both in sequence with atomic writes. If the second fails, the system can detect the inconsistency on next read and reconcile. The plan skill should check for inconsistencies as a precondition.
**Warning signs:** `/dan:status` shows contradictory information about plan state.

## Code Examples

### Example 1: Precondition Check (Orphan Plan Detection)

```markdown
<!-- In dan:plan skill <execution_flow> -->

<step name="check_loop_closure" priority="first">
1. Read STATE.md to get current phase
2. List plan files in phase directory:
   ```bash
   ls .planning/phases/02-core-loop/*-PLAN.md 2>/dev/null | sort
   ```
3. List summary files:
   ```bash
   ls .planning/phases/02-core-loop/*-SUMMARY.md 2>/dev/null | sort
   ```
4. For each PLAN without matching SUMMARY:
   - Parse frontmatter to check status
   - If status is IN_PROGRESS or APPROVED:
     ```
     BLOCKED: Previous plan [NN-MM] is [status].
     Run /dan:apply to complete or /dan:unify to close the loop.
     ```
   - Do NOT create a new plan until all prior loops are closed
</step>
```

### Example 2: E/Q Loop Implementation

```markdown
<!-- In dan:apply skill <execution_flow> -->

<step name="execute_and_qualify">
For each task in plan:

1. Execute task (in-session):
   - Follow task <action> instructions
   - Create/modify files per <files> list
   - Run <verify> commands
   - Commit atomically:
     ```bash
     node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" commit "feat(02-01): [task description]" --files [file list]
     ```

2. Qualify task (spawn dan-qualifier):
   - Provide: plan path, task number, modified file paths
   - Qualifier reads files, runs verify commands, grades against done criteria
   - Parse qualifier output for status

3. Route on status:
   - PASS: Update STATE.md, proceed to next task
   - PASS_WITH_CONCERNS: Log concerns in STATE.md decisions, proceed
   - NEEDS_REVISION:
     - Read retry count from STATE.md or tracking file
     - If retries < 3:
       - Fix issues per qualifier feedback
       - Re-commit
       - Re-qualify (go to step 2)
       - Increment retry count
     - If retries >= 3:
       - Run diagnostic routing (step: diagnostic_classify)
       - Escalate to user with classification
   - FAIL:
     - Run diagnostic routing immediately
     - Escalate to user

4. After each task, checkpoint:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state patch '{"Plan":"Task 2 of 3 complete"}'
   ```
</step>
```

### Example 3: Diagnostic Routing Classification

```markdown
<!-- In dan:apply skill <execution_flow> -->

<step name="diagnostic_classify">
When a task fails qualification:

1. Gather evidence:
   - Task spec from PLAN.md (what should happen)
   - Qualifier evidence (what actually happened)
   - Modified files (what was produced)

2. Classify root cause:

   **INTENT** (escalate immediately):
   - Qualifier says the output does what the spec asks, but the result is wrong for the objective
   - The plan's acceptance criteria don't match what the user actually needs
   - Signal: "This meets the spec but solves the wrong problem"
   - Action: Present to user with recommendation to revise plan objective

   **SPEC** (revise and re-execute):
   - The task description is ambiguous, incomplete, or contradicts other tasks
   - Signal: "The spec doesn't describe what's needed" or "Task dependencies are wrong"
   - Action: Note spec issue, revise task description, re-execute from scratch

   **CODE** (fix and re-qualify):
   - The implementation simply has bugs or doesn't follow the spec
   - Signal: "Code doesn't do what the spec says"
   - Action: Fix implementation bugs, re-qualify

3. Log classification:
   ```bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state set "Last activity" "Diagnostic: Task N classified as [INTENT|SPEC|CODE] issue"
   ```
</step>
```

### Example 4: Plan Status Transitions

```markdown
<!-- Status updates during plan lifecycle -->

# On plan creation (dan:plan):
# Set frontmatter status to DRAFT
# STATE.md: "Plan: NN-MM created, awaiting approval"

# On user approval (dan:apply precondition):
# Set frontmatter status to APPROVED
# STATE.md: "Plan: NN-MM approved, ready for execution"

# On first task start (dan:apply):
# Set frontmatter status to IN_PROGRESS
# STATE.md: "Plan: NN-MM in progress, Task 1 of N"

# On all tasks complete (dan:apply finalize):
# Set frontmatter status to COMPLETED
# STATE.md: "Plan: NN-MM complete, ready for unify"

# On abandonment:
# Set frontmatter status to ABANDONED
# Create minimal SUMMARY.md noting abandonment reason
# STATE.md: "Plan: NN-MM abandoned"
```

## State of the Art

| Old Approach (PAUL) | DAN's Approach | Rationale |
|---------------------|----------------|-----------|
| Loop position tracked as ASCII art in STATE.md | Loop position tracked in frontmatter `status` field + STATE.md | Machine-parseable status enables automated precondition checks |
| Checkpoints as task types in plan | Checkpoints as task types in plan (same) | Pattern proven, no need to change |
| No independent qualification | E/Q separation with subagent qualifier | DAN's core differentiator -- prevents self-grading |
| Deviation rules 1-4 (auto-fix / ask) | Same deviation rules + diagnostic routing on failures | Adds root cause classification before fix attempts |
| Plan approval via conversational signal | Plan approval via explicit status transition (DRAFT -> APPROVED) | More trackable, survives session interruption |
| SUMMARY by memory recall from apply session | SUMMARY by reading git log + plan + qualifier results | More reliable, works even after session restart |

## Open Questions

1. **Frontmatter status updates**
   - What we know: `dan-tools frontmatter parse` exists for reading
   - What's unclear: No `frontmatter set` subcommand exists yet for updating individual fields
   - Recommendation: Either add a `frontmatter set` subcommand to dan-tools, or have the skill directly edit the frontmatter block via Write/Edit tool. Adding a CLI subcommand is cleaner but may be overengineered for v1. The skill can parse the file, modify the YAML block, and rewrite it.

2. **Qualifier output parsing**
   - What we know: The qualifier agent returns markdown-formatted qualification
   - What's unclear: How reliably can the apply skill parse the qualifier's text output to extract the status?
   - Recommendation: Define a strict output format in the qualifier agent prompt (see Pitfall 1). The apply skill looks for a specific line pattern like `**Status:** PASS`. If parsing fails, treat as NEEDS_REVISION and log the parsing failure.

3. **In-session vs subagent execution decision**
   - What we know: Research recommends in-session by default for quality. PAUL says subagents lose ~30% quality.
   - What's unclear: What's the actual context cost of 2-3 tasks in a DAN plan?
   - Recommendation: Start with in-session execution for v1. The plan sizing (2-3 tasks) should keep context usage manageable. Add subagent executor option in v2 if needed.

4. **Retry state persistence**
   - What we know: Retry count must survive session restarts
   - What's unclear: Best storage location -- STATE.md field, temporary file, or plan frontmatter annotation?
   - Recommendation: Use a lightweight approach: add a `retries` field to STATE.md's current task tracking (e.g., "Plan: 02-01 in progress, Task 2 of 3, Retry 1 of 3"). This is human-readable and survives restarts.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) |
| Config file | None needed (uses node --test) |
| Quick run command | `node --test bin/tests/test-core.cjs` |
| Full suite command | `node --test bin/tests/*.cjs` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| LOOP-01 | Plan skill creates valid plan files | integration | `node --test bin/tests/test-plan-workflow.cjs -x` | No - Wave 0 |
| LOOP-02 | Plans sized to 2-3 tasks | unit (plan template validation) | `node --test bin/tests/test-plan-workflow.cjs::test_plan_sizing -x` | No - Wave 0 |
| LOOP-03 | Apply skill executes tasks sequentially | integration | `node --test bin/tests/test-apply-workflow.cjs -x` | No - Wave 0 |
| LOOP-04 | Qualifier grades independently (read-only, separate context) | integration | `node --test bin/tests/test-eq-protocol.cjs -x` | No - Wave 0 |
| LOOP-05 | Four-status reporting parsed correctly | unit | `node --test bin/tests/test-eq-protocol.cjs::test_status_parsing -x` | No - Wave 0 |
| LOOP-06 | Retry loop caps at 3, then escalates | unit | `node --test bin/tests/test-eq-protocol.cjs::test_retry_cap -x` | No - Wave 0 |
| LOOP-07 | Unify creates SUMMARY.md with plan-vs-actual | integration | `node --test bin/tests/test-unify-workflow.cjs -x` | No - Wave 0 |
| LOOP-08 | Orphan detection blocks new plan creation | unit | `node --test bin/tests/test-plan-workflow.cjs::test_orphan_detection -x` | No - Wave 0 |
| LOOP-09 | Plan lifecycle states transition correctly | unit | `node --test bin/tests/test-plan-lifecycle.cjs -x` | No - Wave 0 |
| LOOP-10 | Task checkpoint persists to STATE.md | unit | `node --test bin/tests/test-apply-workflow.cjs::test_checkpoint -x` | No - Wave 0 |
| LOOP-11 | Diagnostic routing classifies correctly | unit | `node --test bin/tests/test-diagnostic-routing.cjs -x` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test bin/tests/test-core.cjs` (existing tests still pass)
- **Per wave merge:** `node --test bin/tests/*.cjs` (full suite)
- **Phase gate:** Full suite green before `/dan:verify`

### Wave 0 Gaps

Note: Most Phase 2 deliverables are skill/agent markdown files (workflow definitions), not executable code. The testable surface is:
- Any new CLI tool subcommands added (frontmatter set, plan lifecycle operations)
- State management logic extensions
- The skill workflow logic itself is tested by running the actual workflow (integration test = using `/dan:plan`, `/dan:apply`, `/dan:unify` on a test project)

Concrete test files needed:
- [ ] `bin/tests/test-plan-lifecycle.cjs` -- covers LOOP-09 (plan status transitions via frontmatter)
- [ ] `bin/tests/test-eq-protocol.cjs` -- covers LOOP-04, LOOP-05, LOOP-06 (qualifier output parsing, status routing, retry cap)
- [ ] `bin/tests/test-diagnostic-routing.cjs` -- covers LOOP-11 (root cause classification logic)

If plan lifecycle and diagnostic routing are implemented as pure functions in `bin/lib/`, they are fully unit-testable. If they exist only as skill markdown instructions (no new JS code), testing is manual integration testing of the workflow end-to-end.

**Recommendation:** Extract any non-trivial logic into `bin/lib/` modules where possible. Specifically:
- Plan lifecycle state machine (validate transitions) -> `bin/lib/lifecycle.cjs`
- Qualifier output parsing (extract status from markdown) -> `bin/lib/qualify.cjs`
- Diagnostic routing decision tree -> can remain as skill instructions (human judgment)

## Sources

### Primary (HIGH confidence)
- PAUL `workflows/apply-phase.md` -- Task execution protocol, deviation rules, checkpoint handling
- PAUL `workflows/plan-phase.md` -- Plan creation workflow, precondition validation, sizing
- PAUL `workflows/unify-phase.md` -- Reconciliation process, state updates, phase transitions
- PAUL `references/loop-phases.md` -- Three-phase loop semantics, invariants, anti-patterns
- PAUL `references/work-units.md` -- Plan sizing rules, context budget, split signals
- PAUL `references/quality-principles.md` -- Plans-are-prompts, deviation rules, acceptance-driven
- PAUL `references/subagent-criteria.md` -- When to use subagents vs in-session
- GSD `workflows/execute-plan.md` -- Pattern A/B/C routing, agent tracking, task commit protocol
- DAN `dan-workflow SKILL.md` -- Loop protocol, E/Q protocol, diagnostic routing, state protocol
- DAN `dan-planner.md`, `dan-executor.md`, `dan-qualifier.md` -- Agent scaffolding with tool restrictions

### Secondary (MEDIUM confidence)
- DAN project-level research SUMMARY.md -- Architecture decisions, in-session vs subagent tradeoffs
- DAN ARCHITECTURE.md -- Component map, data flow, build order

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components are scaffolded from Phase 1, patterns verified against PAUL and GSD source
- Architecture: HIGH - Two-level model, E/Q separation, and loop protocol are proven patterns with source code available
- Pitfalls: HIGH - Every pitfall derives from documented issues in PAUL/GSD or follows directly from the architecture

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable domain, no external dependencies)
