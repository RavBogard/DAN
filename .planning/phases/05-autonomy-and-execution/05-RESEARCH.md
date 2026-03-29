# Phase 5: Autonomy and Execution - Research

**Researched:** 2026-03-28
**Domain:** Autonomous pipeline chaining, session management, wave-based parallel execution
**Confidence:** HIGH

## Summary

Phase 5 is the capstone that chains all existing DAN capabilities (research, plan, apply, unify, verify, bugsweep) into an autonomous pipeline. The primary challenge is orchestration: `/dan:milestone` must run a complete pipeline per phase across an entire milestone, with only a single user approval at the start. The secondary challenges are session persistence (pause/resume without context loss) and parallel safety (wave-based execution without state corruption).

GSD provides a battle-tested reference implementation. Its `execute-phase.md` demonstrates wave-based plan execution with dependency grouping, auto-advance chaining via `transition.md`, and checkpoint handling. Its `pause-work.md` uses a `.continue-here.md` handoff file pattern. DAN already has all the foundational pieces: `dependency.cjs` with Kahn's topological sort and wave assignment, `lifecycle.cjs` with plan state machines, `state.cjs` with atomic read/write, and `phase.cjs` with phase advancement. The work in Phase 5 is connecting these pieces into orchestration flows, not building new primitives.

The critical architectural constraint is the two-level rule: the `/dan:milestone` skill orchestrates everything, but it cannot delegate orchestration to a subagent. All phase chaining, wave grouping, error recovery, and state updates must happen at the skill level. Subagents (executor, qualifier, verifier, auditor) remain stateless workers. This means the milestone skill will be the most complex skill in the system, but it follows the same pattern as `dan:apply` and `dan:bugsweep` -- a loop at the skill level that spawns agents and reads results via files.

**Primary recommendation:** Build three plans: (1) CLI modules for milestone tracking and session state management, (2) milestone skill with phase chaining and wave execution, (3) status/pause/resume skills and error recovery. Each plan connects existing infrastructure rather than building from scratch.

## Standard Stack

### Core (Already Built)

| Module | Location | Purpose | Phase 5 Usage |
|--------|----------|---------|---------------|
| dependency.cjs | bin/lib/ | Topological sort, wave assignment | Wave grouping for parallel plan execution |
| lifecycle.cjs | bin/lib/ | Plan state machine (DRAFT->COMPLETED) | Transition validation during pipeline |
| state.cjs | bin/lib/ | Atomic STATE.md read/write | Session state persistence, progress tracking |
| phase.cjs | bin/lib/ | Phase find/list/advance/complete | Phase advancement after pipeline stages |
| commit.cjs | bin/lib/ | Atomic git commits | Commit state changes at pipeline boundaries |
| frontmatter.cjs | bin/lib/ | YAML frontmatter parse/set | Plan status reads during pipeline scanning |
| verify.cjs | bin/lib/ | Artifact/key-link/completeness checks | Pipeline stage gating |
| research.cjs | bin/lib/ | Research state management | Research convergence in pipeline |

### New Modules Needed

| Module | Purpose | Complexity |
|--------|---------|------------|
| milestone.cjs | Milestone state tracking, phase pipeline ordering, approval gates | MEDIUM |
| session.cjs | Pause/resume state serialization, handoff file management | LOW-MEDIUM |

### Skills to Complete (Stub -> Full)

| Skill | Current State | Needs |
|-------|--------------|-------|
| dan-milestone | Stub (description only) | Full execution_flow with pipeline chaining |
| dan-status | Stub (description only) | Full execution_flow with progress display and next-action logic |
| dan-pause | Stub (description only) | Full execution_flow with state serialization |
| dan-resume | Stub (description only) | Full execution_flow with context restoration |

## Architecture Patterns

### Pattern 1: Phase Pipeline Chain (AUTO-01, AUTO-02, AUTO-03)

The milestone skill runs a sequential pipeline across phases. Each phase goes through the full cycle: research -> plan -> apply (with waves) -> unify -> verify -> bugsweep. The key insight from GSD's `transition.md` is that auto-advance is a flag-based system, not a recursive call.

**Pipeline pseudocode:**
```
for each phase in milestone (dependency order):
  1. dan:research {phase}     -- spawn researcher agents
  2. dan:plan {phase}         -- spawn planner agent
  3. for each plan in dependency order (waves):
     a. dan:apply {plan}      -- execute tasks, qualify
     b. dan:unify {plan}      -- produce SUMMARY.md
  4. dan:verify {phase}       -- spawn verifier agent
  5. dan:bugsweep {phase}     -- spawn auditor in loop
  6. Update STATE.md, advance phase
```

**How chaining works:** The milestone skill directly invokes each sub-skill's logic. Since skills are markdown with execution_flow instructions (not callable functions), the milestone skill reads each sub-skill's execution_flow and follows the same steps. This is the same pattern GSD's `execute-phase.md` uses -- it reads `execute-plan.md` context and follows it.

**Approval gates (AUTO-02, AUTO-03):**
- Milestone-level: User approves once before pipeline starts. After that, all phases chain without stopping.
- Roadmap-level: User can approve the entire roadmap, and DAN runs all milestones. This is an extension -- milestone approval with `--all` flag.

### Pattern 2: Wave-Based Parallel Execution (AUTO-04, AUTO-05)

Within each phase, plans may have dependencies. The existing `dependency.cjs` module already computes waves via `assignWaves()`. Plans in the same wave can execute in parallel (when `parallelization: true` in config).

**Wave execution at the skill level:**
```
waves = dan-tools.cjs dependency waves {phaseDir}
for each wave (sequential):
  for each plan in wave:
    if parallelization:
      spawn executor agents in parallel (Task() calls)
    else:
      execute sequentially (in-session or single agent)
  wait for all agents in wave to complete
  verify all SUMMARY.md files exist (spot-check)
  proceed to next wave
```

**File-level partitioning (AUTO-05):**
- Each executor agent writes to its own plan's files (defined in plan frontmatter `files_modified`)
- No two plans in the same wave should modify the same files (planner enforces this via file partitioning in task definitions)
- STATE.md updates happen at the orchestrator level only, after agent returns -- agents never write to STATE.md directly during parallel execution
- Each agent writes its own SUMMARY.md (unique path: `{phase}-{plan}-SUMMARY.md`)

**GSD reference:** GSD's `execute-phase.md` uses exactly this pattern: "Orchestrator coordinates, not executes. Each subagent loads the full execute-plan context."

### Pattern 3: Session Pause/Resume (AUTO-06, AUTO-07)

GSD uses `.continue-here.md` files with structured handoff data. DAN already has STATE.md with session continuity fields (`Last session`, `Stopped at`, `Resume file`). The pause/resume pattern combines both:

**Pause flow:**
1. Capture current position: which phase, which plan, which task, which pipeline stage
2. Capture pipeline state: which phases are complete, which is in progress, what's next
3. Write to STATE.md frontmatter (machine-readable) + body (human-readable)
4. Optionally create a `.continue-here.md` for mid-plan granularity
5. Commit as WIP

**Resume flow:**
1. Read STATE.md frontmatter for machine position
2. Read body sections for accumulated context (decisions, blockers)
3. Determine which skill to invoke next based on position:
   - Mid-task in a plan -> resume dan:apply at that task
   - Between plans -> resume dan:milestone at next plan
   - Between pipeline stages -> resume at next stage (e.g., verify after all applies)
   - Between phases -> resume at next phase in pipeline
4. Invoke the appropriate skill with resume context

**STATE.md frontmatter additions for session state:**
```yaml
---
gsd_state_version: 1.0
milestone: v1.0
status: paused
stopped_at: "Phase 3, plan 03-02, task 2 of 3, stage: apply"
pipeline_position:
  phase: 3
  plan: "03-02"
  task: 2
  stage: apply  # research|plan|apply|unify|verify|bugsweep
  wave: 1
phases_complete: [1, 2]
phases_remaining: [3, 4, 5]
last_updated: "2026-03-29T16:00:00Z"
---
```

### Pattern 4: Status Display and Next-Action (AUTO-08)

The `/dan:status` skill reads STATE.md and ROADMAP.md, then computes the next action. This is a pure read-only operation.

**Next-action logic (priority order):**
1. If paused with resume context -> "Resume with /dan:resume"
2. If plan IN_PROGRESS -> "Continue with /dan:apply {plan}"
3. If all plans complete, no VERIFICATION.md -> "Verify with /dan:verify {phase}"
4. If VERIFICATION.md has gaps -> "Fix with /dan:bugsweep {phase}"
5. If phase complete, more phases remain -> "Next phase: /dan:milestone or /dan:plan {next}"
6. If all phases complete -> "Milestone complete: /dan:milestone --complete"
7. If no plans exist -> "Plan with /dan:plan {phase}"
8. If no research exists -> "Research with /dan:research {phase}"

### Pattern 5: Error Recovery Across Phase Boundaries (AUTO-09)

When a phase fails mid-milestone, the system must:
1. Capture failure context (which stage failed, why, what was the error)
2. Mark the phase as failed in STATE.md (not COMPLETED, not ABANDONED -- a new transient state)
3. Preserve all completed phases' progress
4. Offer three options:
   - Retry the failed phase from the beginning
   - Retry from the failed stage (e.g., re-run bugsweep only)
   - Skip the phase and continue (with warning about downstream dependencies)
   - Escalate to user

**Error state in STATE.md:**
```yaml
stopped_at: "Phase 3, stage: bugsweep, error: max cycles exceeded"
error_context:
  phase: 3
  stage: bugsweep
  reason: "Recurring issues after 3 cycles"
  verification_path: ".planning/phases/03-research-system/03-VERIFICATION.md"
```

### Anti-Patterns to Avoid

- **Recursive skill invocation:** Skills cannot call themselves. The milestone skill must contain the full pipeline loop, not call itself recursively per phase.
- **Agent-level orchestration:** Agents must NOT decide what to execute next. The skill reads state and decides. Agents just execute their scoped task and return.
- **Shared state during parallel execution:** Never let two parallel agents write to STATE.md. The orchestrator reads agent outputs and does a single STATE.md update.
- **Over-engineering approval gates:** Approval is a simple boolean check at the start. Don't build approval workflows with multi-step confirmation -- the philosophy is "approve once, run autonomously."

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Topological sort | Custom graph algorithm | dependency.cjs topologicalSort() | Already built and tested with cycle detection |
| Wave grouping | Manual dependency resolution | dependency.cjs assignWaves() | Already groups plans by wave number |
| Plan state transitions | Inline state checks | lifecycle.cjs validateTransition() | Enforces valid DRAFT->APPROVED->IN_PROGRESS->COMPLETED chain |
| Atomic state writes | Direct fs.writeFileSync | core.cjs atomicWriteFileSync() | Temp+rename pattern prevents corruption |
| Phase advancement | Manual STATE.md editing | phase.cjs completePhase() | Already increments phase counter and resets plan counter |
| Progress calculation | Manual counting | phase.cjs countAllPlans() | Already counts across all phases |
| Frontmatter parsing | Regex parsing in skills | frontmatter.cjs parse()/set() | Centralized format knowledge, handles edge cases |

## Common Pitfalls

### Pitfall 1: Context Rot During Long Milestone Chains
**What goes wrong:** Running all pipeline stages for multiple phases in a single context window degrades quality. Research found quality drops at 20-40% context usage.
**Why it happens:** The milestone skill accumulates context from each phase's research, planning, and execution.
**How to avoid:** The milestone skill is the orchestrator only. Each pipeline stage spawns fresh agents. Between phases, the orchestrator's context grows only by the state file updates and brief result summaries, not the full execution context.
**Warning signs:** Orchestrator context exceeding 30%. Agent outputs becoming generic or missing specifics.

### Pitfall 2: Parallel Agents Writing Same Files
**What goes wrong:** Two agents in the same wave modify the same file, causing data loss (last write wins).
**Why it happens:** Plans in the same wave have overlapping `files_modified` lists.
**How to avoid:** The planner must partition files across plans in the same wave. The milestone skill should validate non-overlapping file sets before spawning parallel agents. If overlap detected, fall back to sequential execution for that wave.
**Warning signs:** Missing code sections after parallel execution, merge-conflict-like symptoms.

### Pitfall 3: Resume Losing Pipeline Position
**What goes wrong:** After pause/resume, DAN restarts from the beginning of a phase instead of from where it stopped.
**Why it happens:** STATE.md only tracks phase and plan numbers, not pipeline stage (research/plan/apply/verify/bugsweep).
**How to avoid:** Add pipeline stage to STATE.md frontmatter. The `stopped_at` field must capture the full position: phase + plan + task + stage.
**Warning signs:** Redundant research or planning after resume.

### Pitfall 4: Orphan Plans During Milestone Abort
**What goes wrong:** If the milestone is aborted mid-phase, plans may be left IN_PROGRESS without summaries.
**Why it happens:** The apply skill marks plans IN_PROGRESS at start but doesn't create SUMMARY.md until completion.
**How to avoid:** The milestone skill's error recovery should check for orphan IN_PROGRESS plans on startup. If found, offer to resume or abandon them. This is already partially handled by dan:apply's resume logic (status check in step 1.5).
**Warning signs:** `dan:plan` reporting orphan plans when trying to create new ones.

### Pitfall 5: Infinite Pipeline Retry
**What goes wrong:** If a phase consistently fails bugsweep, the milestone retries forever.
**Why it happens:** No retry cap at the phase level (bugsweep has its own cap, but the milestone might re-run the whole phase).
**How to avoid:** Phase-level retry cap of 1 (retry once, then escalate). The milestone skill tracks retry counts per phase.
**Warning signs:** The same phase failing bugsweep on consecutive attempts.

## Code Examples

### Wave Execution from Existing dependency.cjs

```javascript
// Source: bin/lib/dependency.cjs (already built)
// Get wave grouping for a phase's plans
const waves = assignWaves(plans);
// Returns: [{id: "03-01", wave: 1}, {id: "03-02", wave: 1}, {id: "03-03", wave: 2}]

// Group by wave for sequential wave execution
const grouped = {};
for (const w of waveData) {
  if (!grouped[w.wave]) grouped[w.wave] = [];
  grouped[w.wave].push(w.id);
}
// grouped = { 1: ["03-01", "03-02"], 2: ["03-03"] }
```

### CLI Command for Wave Analysis

```bash
# Already available via dan-tools.cjs
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" dependency waves "$PHASE_DIR"
# Output: {"waves": [{"wave": 1, "plans": ["03-01", "03-02"]}, {"wave": 2, "plans": ["03-03"]}], "count": 3}
```

### State Frontmatter Update Pattern

```bash
# Existing state patch supports multiple fields at once
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" state patch \
  '{"Status":"Milestone in progress","Last activity":"2026-03-29 -- Running phase 3 pipeline"}'
```

### Milestone CLI Module (New -- milestone.cjs)

```javascript
// New module: milestone tracking
// Subcommands: status, start, advance-phase, complete, error

function getMilestoneStatus(cwd) {
  const phases = listPhases(cwd);
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const content = fs.readFileSync(statePath, 'utf-8');
  const frontmatter = parseFrontmatter(content);

  return {
    milestone: frontmatter.milestone || 'v1.0',
    status: frontmatter.status,
    phases_complete: phases.filter(p => p.plans_complete === p.plans_total && p.plans_total > 0),
    phases_remaining: phases.filter(p => p.plans_complete < p.plans_total || p.plans_total === 0),
    current_phase: extractField(content, 'Phase'),
    pipeline_stage: frontmatter.pipeline_position?.stage || null
  };
}

function startMilestone(cwd, milestoneName) {
  // Update STATE.md frontmatter with milestone tracking fields
  // Set status to 'in_progress'
  // Record start timestamp
}

function recordPhaseError(cwd, phaseNum, stage, reason) {
  // Write error context to STATE.md frontmatter
  // Preserve completed phases
  // Set status to 'error'
}
```

### Session State Module (New -- session.cjs)

```javascript
// New module: session pause/resume
// Subcommands: save, restore, handoff

function saveSession(cwd, position) {
  // position = { phase, plan, task, stage, wave }
  // Update STATE.md frontmatter with full position
  // Write .continue-here.md if mid-plan
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  let content = fs.readFileSync(statePath, 'utf-8');

  // Update frontmatter fields
  content = updateFrontmatter(content, {
    status: 'paused',
    stopped_at: formatPosition(position),
    pipeline_position: position,
    last_updated: new Date().toISOString()
  });

  atomicWriteFileSync(statePath, content);
}

function restoreSession(cwd) {
  // Read STATE.md frontmatter for position
  // Read .continue-here.md if exists
  // Return { position, next_action, accumulated_context }
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  const content = fs.readFileSync(statePath, 'utf-8');
  const frontmatter = parseFrontmatter(content);

  return {
    position: frontmatter.pipeline_position,
    next_action: determineNextAction(frontmatter),
    decisions: parseSection(content, 'Decisions'),
    blockers: parseSection(content, 'Blockers/Concerns')
  };
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual phase-by-phase invocation | Milestone-level autonomous chaining | DAN Phase 5 | User approves once, pipeline runs all phases |
| Sequential plan execution only | Wave-based parallel with dependency analysis | GSD execute-phase (current) | Independent plans run simultaneously |
| Context-sharing between pipeline stages | Fresh agent per stage with file-based handoff | PAUL insight (2025) | Prevents context rot in long chains |
| In-memory session state | File-based STATE.md with frontmatter | GSD/PAUL (current) | Survives session crashes, enables pause/resume |

## Open Questions

1. **STATE.md Frontmatter Complexity**
   - What we know: STATE.md currently uses simple YAML frontmatter (6 fields). Phase 5 needs nested objects (`pipeline_position`, `error_context`).
   - What's unclear: Whether the existing `frontmatter.cjs` handles nested YAML objects, or if it only supports flat key-value pairs.
   - Recommendation: Test frontmatter.cjs with nested objects. If it doesn't support them, add support or use a separate `session-state.json` file alongside STATE.md. LOW risk -- flat fields with dot-notation may suffice (e.g., `pipeline_stage: apply` instead of nested object).

2. **Parallel Agent Spawn Limits**
   - What we know: Claude Code can spawn multiple agents in parallel via multiple `Task()` calls. GSD uses this pattern.
   - What's unclear: Whether there's a practical limit on concurrent agents (memory, rate limits, cost).
   - Recommendation: Start with 2-3 concurrent agents per wave. DAN plans are sized small (2-3 tasks), so waves rarely have more than 2-3 plans. Not a blocking concern.

3. **Milestone Scope Discovery**
   - What we know: ROADMAP.md lists phases per milestone. STATE.md tracks current milestone.
   - What's unclear: How to determine which phases belong to the current milestone vs a future one.
   - Recommendation: Parse ROADMAP.md milestone grouping. For v1, all 5 phases belong to "v1.0". Add a `milestone` field to phase details in ROADMAP.md if multi-milestone support is needed later.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTO-01 | `/dan:milestone` chains full pipeline across all phases in milestone | Pattern 1 (Phase Pipeline Chain) -- sequential phase loop with per-phase pipeline stages |
| AUTO-02 | Milestone-level approval gate -- user approves scope once | Pattern 1 approval gates -- boolean check at start, then autonomous |
| AUTO-03 | Roadmap-level approval gate -- user can approve entire roadmap | Extension of AUTO-02 with `--all` flag on milestone command |
| AUTO-04 | Wave-based parallel execution with dependency analysis | Pattern 2 (Wave-Based Parallel) -- uses existing dependency.cjs assignWaves() |
| AUTO-05 | File-level partitioning for state corruption prevention | Pattern 2 file partitioning -- each agent writes own files, orchestrator merges state |
| AUTO-06 | Session pause saves to STATE.md | Pattern 3 (Session Pause/Resume) -- pipeline_position in frontmatter + .continue-here.md |
| AUTO-07 | Session resume restores full context | Pattern 3 restore flow -- read position, determine next skill, invoke with context |
| AUTO-08 | `/dan:status` shows progress and next action | Pattern 4 (Status Display) -- priority-based next-action logic |
| AUTO-09 | Error recovery across phase boundaries | Pattern 5 (Error Recovery) -- capture error context, retry/skip/escalate options |
</phase_requirements>

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) v24.11.1 |
| Config file | None (uses `node --test` directly) |
| Quick run command | `node --test bin/tests/test-milestone.cjs` |
| Full suite command | `node --test bin/tests/*.cjs` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTO-01 | Milestone pipeline chains stages in order | unit | `node --test bin/tests/test-milestone.cjs -x` | No -- Wave 0 |
| AUTO-02 | Approval gate blocks pipeline until approved | unit | `node --test bin/tests/test-milestone.cjs -x` | No -- Wave 0 |
| AUTO-03 | Roadmap approval runs all milestones | unit | `node --test bin/tests/test-milestone.cjs -x` | No -- Wave 0 |
| AUTO-04 | Wave grouping from dependency analysis | unit | `node --test bin/tests/test-dependency.cjs -x` | Yes (existing) |
| AUTO-05 | File partitioning validation (no overlap check) | unit | `node --test bin/tests/test-milestone.cjs -x` | No -- Wave 0 |
| AUTO-06 | Session save captures pipeline position | unit | `node --test bin/tests/test-session.cjs -x` | No -- Wave 0 |
| AUTO-07 | Session restore determines next action | unit | `node --test bin/tests/test-session.cjs -x` | No -- Wave 0 |
| AUTO-08 | Status displays progress and next action | unit | `node --test bin/tests/test-milestone.cjs -x` | No -- Wave 0 |
| AUTO-09 | Error recovery captures context, offers retry/skip | unit | `node --test bin/tests/test-milestone.cjs -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** `node --test bin/tests/test-milestone.cjs bin/tests/test-session.cjs`
- **Per wave merge:** `node --test bin/tests/*.cjs`
- **Phase gate:** Full suite green before `/dan:verify`

### Wave 0 Gaps
- [ ] `bin/tests/test-milestone.cjs` -- covers AUTO-01, AUTO-02, AUTO-03, AUTO-05, AUTO-08, AUTO-09
- [ ] `bin/tests/test-session.cjs` -- covers AUTO-06, AUTO-07
- [ ] Existing `test-dependency.cjs` already covers wave grouping (AUTO-04)

## Sources

### Primary (HIGH confidence)
- GSD `execute-phase.md` -- wave-based parallel execution, auto-advance chaining, checkpoint handling pattern
- GSD `transition.md` -- phase completion and auto-advance flag propagation
- GSD `pause-work.md` -- `.continue-here.md` handoff file pattern
- GSD `resume-project.md` -- state reconstruction and next-action determination
- GSD `complete-milestone.md` -- milestone completion and archival
- DAN `dependency.cjs` -- existing topological sort and wave assignment (bin/lib/dependency.cjs)
- DAN `lifecycle.cjs` -- existing plan state machine (bin/lib/lifecycle.cjs)
- DAN `state.cjs` -- existing atomic state read/write (bin/lib/state.cjs)
- DAN `phase.cjs` -- existing phase advancement (bin/lib/phase.cjs)
- DAN skill stubs -- existing dan-milestone, dan-status, dan-pause, dan-resume SKILL.md files

### Secondary (MEDIUM confidence)
- DAN project research SUMMARY.md -- context rot at 20-40% usage, two-level rule, fresh-context-per-agent
- Claude Code race condition issue #28847 -- file corruption in concurrent writes (motivates file-level partitioning)

### Tertiary (LOW confidence)
- Parallel agent spawn limits -- no official documentation found on concurrent agent limits; recommendation based on practical GSD usage patterns

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all modules already built, verified with 161 passing tests
- Architecture: HIGH -- patterns directly derived from GSD production workflows (execute-phase, transition, pause-work, resume-project)
- Pitfalls: HIGH -- every pitfall documented from real incidents (context rot, race conditions, orphan plans) in GSD and PAUL
- New modules: MEDIUM -- milestone.cjs and session.cjs are new but follow established patterns from existing modules

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable domain, patterns well-established)
