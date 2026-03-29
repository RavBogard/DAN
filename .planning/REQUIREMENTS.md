# Requirements: DAN

**Defined:** 2026-03-28
**Core Value:** Research 5x, build once. Human labor happens upfront. Everything after approval is autonomous.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Foundation

- [ ] **FOUND-01**: CLI tools library (dan-tools.cjs) provides atomic state read/write operations with JSON output for agent consumption
- [ ] **FOUND-02**: CLI tools handle template filling from `.planning/` templates
- [ ] **FOUND-03**: CLI tools provide atomic git commit operations (temp file + rename pattern for state safety)
- [ ] **FOUND-04**: CLI tools provide dependency analysis for plan execution ordering
- [ ] **FOUND-05**: File-based state in `.planning/` with defined schemas (PROJECT.md, STATE.md, ROADMAP.md, dan.config.json)
- [ ] **FOUND-06**: State files are human-readable markdown + JSON, git-tracked
- [ ] **FOUND-07**: ~12 skill entry points installed under `.claude/skills/dan-*/` with frontmatter invocation control
- [ ] **FOUND-08**: ~7 subagent definitions installed under `.claude/agents/` with tool restrictions and model selection per role
- [ ] **FOUND-09**: Two-level agent hierarchy enforced — commands/skills orchestrate, agents execute, no nested spawning
- [ ] **FOUND-10**: Progress tracking in STATE.md with atomic updates per task completion
- [ ] **FOUND-11**: dan.config.json stores simplified preferences (mode, granularity, autonomy level, model profile)

### Research System

- [ ] **RSRCH-01**: `/dan:research` runs recursive multi-pass research (research → synthesize → find gaps → research again)
- [ ] **RSRCH-02**: Research system has hard iteration cap (max 4 passes) with diminishing returns detection
- [ ] **RSRCH-03**: Each research pass spawns parallel researcher agents (stack, features, architecture, pitfalls)
- [ ] **RSRCH-04**: Synthesizer agent merges findings into SUMMARY.md with confidence assessments and gap identification
- [ ] **RSRCH-05**: Gap detection drives subsequent research passes — only unresolved gaps get re-researched
- [ ] **RSRCH-06**: Research terminates when gap count trends to zero or confidence reaches HIGH across all dimensions
- [ ] **RSRCH-07**: `/dan:discuss` runs deep interview phase that surfaces decisions, tradeoffs, and assumptions
- [ ] **RSRCH-08**: Discuss phase captures structured decision log in CONTEXT.md per phase
- [ ] **RSRCH-09**: Project-level init research runs 4 parallel researchers (same as GSD pattern)

### Core Loop

- [ ] **LOOP-01**: `/dan:plan` creates executable plan with objective, acceptance criteria, tasks, and boundaries
- [ ] **LOOP-02**: Plans are sized for single context window (2-3 tasks per plan)
- [ ] **LOOP-03**: `/dan:apply` executes plan tasks with fresh-context executor agent
- [ ] **LOOP-04**: Execute/Qualify separation — independent qualifier agent re-reads output and grades against acceptance criteria
- [ ] **LOOP-05**: Four-status task reporting: PASS, PASS_WITH_CONCERNS, NEEDS_REVISION, FAIL
- [ ] **LOOP-06**: Qualifier triggers fix loop on NEEDS_REVISION (max 3 attempts before escalation)
- [ ] **LOOP-07**: `/dan:unify` creates SUMMARY.md documenting what was built, comparing plan vs actual
- [ ] **LOOP-08**: Mandatory loop closure — every PLAN gets a SUMMARY, no orphan plans ever
- [ ] **LOOP-09**: Plan lifecycle states: DRAFT → APPROVED → IN_PROGRESS → COMPLETED/ABANDONED
- [ ] **LOOP-10**: Atomic task checkpointing — task status saved to state after each completion
- [ ] **LOOP-11**: Diagnostic failure routing — classify root cause (intent vs spec vs code) before applying fix

### Verification & Quality

- [ ] **QUAL-01**: `/dan:verify` runs verifier agent that checks deliverables against phase goals and acceptance criteria
- [ ] **QUAL-02**: Verification is automated — no human intervention required
- [ ] **QUAL-03**: `/dan:bugsweep` runs recursive audit loop: find issues → fix → re-verify → loop until clean
- [ ] **QUAL-04**: Bugsweep has hard iteration cap (max 3 cycles) with escalation to human if issues persist
- [ ] **QUAL-05**: Bugsweep uses diminishing returns detection — if same issues recur, stop and escalate
- [ ] **QUAL-06**: Verification results written to phase VERIFICATION.md with pass/fail per acceptance criterion

### Autonomy & Execution

- [ ] **AUTO-01**: `/dan:milestone` chains full pipeline: research → plan → apply → unify → verify → bugsweep for all phases in milestone
- [ ] **AUTO-02**: Milestone-level approval gate — user approves scope/roadmap once, then DAN runs autonomously
- [ ] **AUTO-03**: Roadmap-level approval gate — user can approve entire roadmap and DAN runs all milestones
- [ ] **AUTO-04**: Wave-based parallel execution — dependency analysis groups independent plans into parallel waves
- [ ] **AUTO-05**: Wave execution uses file-level partitioning to prevent state corruption (each agent writes own files, orchestrator merges)
- [ ] **AUTO-06**: Session pause saves structured handoff to STATE.md with current position, context, and next action
- [ ] **AUTO-07**: Session resume reads state files and restores full context without human re-explanation
- [ ] **AUTO-08**: `/dan:status` shows current progress, phase position, and suggests next action
- [ ] **AUTO-09**: Error recovery across phase boundaries — if a phase fails, DAN captures failure context and can retry or escalate

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Advanced Research

- **RSRCH-10**: Research confidence scoring with numeric thresholds (not just HIGH/MEDIUM/LOW)
- **RSRCH-11**: Research caching — reuse prior research when re-planning similar phases

### Advanced Execution

- **LOOP-12**: Cross-plan dependency tracking across phases (not just within a phase)
- **LOOP-13**: Automatic plan splitting when tasks exceed context budget

### Hooks & Automation

- **HOOK-01**: Context monitor hook warns when context usage crosses thresholds
- **HOOK-02**: Loop enforcement hook prevents skipping UNIFY
- **HOOK-03**: Auto-commit hook for planning docs

### Session Intelligence

- **SESS-01**: Session history tracking across multiple DAN projects
- **SESS-02**: Learning from past project patterns (what worked, what didn't)

## Out of Scope

| Feature | Reason |
|---------|--------|
| MCP server | Overcomplicates v1 for single user; config file sufficient |
| Full CARL rule injection | Bake preferences into workflows; add config layer later if needed |
| Multi-runtime support | Claude Code only; no OpenCode/Gemini/Codex adapters |
| npm packaging/publishing | Personal tool, not a product |
| Web UI or dashboard | CLI-native workflow; no browser needed |
| Team collaboration | Single user tool |
| Cost/token tracking | Nice to have but not core to workflow quality |
| Per-phase human approval | Contradicts autonomous execution philosophy |
| 60+ agent swarms | Anti-pattern for single user; 7 focused agents is correct |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Pending |
| FOUND-06 | Phase 1 | Pending |
| FOUND-07 | Phase 1 | Pending |
| FOUND-08 | Phase 1 | Pending |
| FOUND-09 | Phase 1 | Pending |
| FOUND-10 | Phase 1 | Pending |
| FOUND-11 | Phase 1 | Pending |
| LOOP-01 | Phase 2 | Pending |
| LOOP-02 | Phase 2 | Pending |
| LOOP-03 | Phase 2 | Pending |
| LOOP-04 | Phase 2 | Pending |
| LOOP-05 | Phase 2 | Pending |
| LOOP-06 | Phase 2 | Pending |
| LOOP-07 | Phase 2 | Pending |
| LOOP-08 | Phase 2 | Pending |
| LOOP-09 | Phase 2 | Pending |
| LOOP-10 | Phase 2 | Pending |
| LOOP-11 | Phase 2 | Pending |
| RSRCH-01 | Phase 3 | Pending |
| RSRCH-02 | Phase 3 | Pending |
| RSRCH-03 | Phase 3 | Pending |
| RSRCH-04 | Phase 3 | Pending |
| RSRCH-05 | Phase 3 | Pending |
| RSRCH-06 | Phase 3 | Pending |
| RSRCH-07 | Phase 3 | Pending |
| RSRCH-08 | Phase 3 | Pending |
| RSRCH-09 | Phase 3 | Pending |
| QUAL-01 | Phase 4 | Pending |
| QUAL-02 | Phase 4 | Pending |
| QUAL-03 | Phase 4 | Pending |
| QUAL-04 | Phase 4 | Pending |
| QUAL-05 | Phase 4 | Pending |
| QUAL-06 | Phase 4 | Pending |
| AUTO-01 | Phase 5 | Pending |
| AUTO-02 | Phase 5 | Pending |
| AUTO-03 | Phase 5 | Pending |
| AUTO-04 | Phase 5 | Pending |
| AUTO-05 | Phase 5 | Pending |
| AUTO-06 | Phase 5 | Pending |
| AUTO-07 | Phase 5 | Pending |
| AUTO-08 | Phase 5 | Pending |
| AUTO-09 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 46 total (FOUND: 11, LOOP: 11, RSRCH: 9, QUAL: 6, AUTO: 9)
- Mapped to phases: 46
- Unmapped: 0

---
*Requirements defined: 2026-03-28*
*Last updated: 2026-03-28 after roadmap creation*
