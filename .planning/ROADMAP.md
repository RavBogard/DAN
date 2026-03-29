# Roadmap: DAN

## Overview

DAN builds from the ground up: state schemas and CLI tools first (everything reads/writes them), then the core Plan-Apply-Unify loop (the minimum viable workflow), then the recursive research system (DAN's differentiator), then verification and quality gates (nothing to verify until plans execute), and finally milestone-level autonomy that chains everything together. Each phase delivers a complete, independently verifiable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Foundation** - State schemas, CLI tools, skill/agent scaffolding, and two-level architecture
- [x] **Phase 2: Core Loop** - Plan-Apply-Unify workflow with E/Q separation and diagnostic routing
- [x] **Phase 3: Research System** - Recursive multi-pass research, discuss phase, and decision logging
- [x] **Phase 4: Verification and Quality** - Autonomous verify and recursive bugsweep with circuit breakers (completed 2026-03-29)
- [ ] **Phase 5: Autonomy and Execution** - Milestone chaining, wave parallelization, session management

## Phase Details

### Phase 1: Foundation
**Goal**: Every DAN component can read/write state files atomically, skills and agents are discoverable, and the two-level orchestration model is enforced
**Depends on**: Nothing (first phase)
**Requirements**: FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, FOUND-09, FOUND-10, FOUND-11
**Success Criteria** (what must be TRUE):
  1. Running `dan-tools.cjs state read STATE.md` returns structured JSON; running `dan-tools.cjs state write` atomically updates a state file without corruption even if interrupted
  2. All skill entry points are discoverable via `/dan:` prefix in Claude Code and each skill's frontmatter correctly controls invocation behavior
  3. Agent definitions exist under `.claude/agents/` with appropriate tool restrictions, and spawning an agent from a skill works while spawning an agent from another agent is architecturally prevented
  4. `.planning/` directory contains valid STATE.md, PROJECT.md, ROADMAP.md, and dan.config.json with defined schemas, all human-readable and git-trackable
  5. Progress updates via CLI tools are reflected immediately in STATE.md with correct phase/plan position
**Plans**: 4 plans

Plans:
- [x] 01-01-PLAN.md — CLI tools foundation: dan-tools.cjs router, core utilities, state/config/frontmatter/commit modules
- [x] 01-02-PLAN.md — Template filling, dependency analysis, phase operations, and progress tracking
- [x] 01-03-PLAN.md — Skill entry points (12) and shared workflow skill
- [x] 01-04-PLAN.md — Agent definitions (7) with tool restrictions and two-level hierarchy

### Phase 2: Core Loop
**Goal**: A user can run the full Plan-Apply-Unify cycle on real code, with independent qualification of every task and mandatory loop closure
**Depends on**: Phase 1
**Requirements**: LOOP-01, LOOP-02, LOOP-03, LOOP-04, LOOP-05, LOOP-06, LOOP-07, LOOP-08, LOOP-09, LOOP-10, LOOP-11
**Success Criteria** (what must be TRUE):
  1. `/dan:plan` produces a plan file with objective, acceptance criteria, sized tasks (2-3), and boundaries -- and the plan transitions through DRAFT to APPROVED states
  2. `/dan:apply` executes each task and a separate qualifier agent independently re-reads output and grades it as PASS, PASS_WITH_CONCERNS, NEEDS_REVISION, or FAIL -- the executor never grades its own work
  3. When qualifier returns NEEDS_REVISION, the system automatically retries (up to 3 attempts) before escalating; FAIL tasks escalate immediately
  4. `/dan:unify` creates a SUMMARY.md that documents what was built vs what was planned, and every plan that reaches IN_PROGRESS eventually gets a SUMMARY (no orphan plans)
  5. When a task fails, diagnostic routing classifies the root cause as intent, spec, or code issue before any fix is attempted
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Lifecycle state machine and qualifier output parser modules with CLI integration and tests
- [x] 02-02-PLAN.md — dan:plan and dan:unify skill workflows with planner agent enhancement
- [x] 02-03-PLAN.md — dan:apply skill workflow with E/Q loop, executor and qualifier agent enhancements

### Phase 3: Research System
**Goal**: DAN can recursively research a problem domain until confident, and surface all decisions/tradeoffs through structured discussion before any planning begins
**Depends on**: Phase 1
**Requirements**: RSRCH-01, RSRCH-02, RSRCH-03, RSRCH-04, RSRCH-05, RSRCH-06, RSRCH-07, RSRCH-08, RSRCH-09
**Success Criteria** (what must be TRUE):
  1. `/dan:research` spawns parallel researcher agents, synthesizes findings into SUMMARY.md with confidence assessments, identifies gaps, and automatically triggers additional research passes on unresolved gaps
  2. Research terminates autonomously -- either when gap count trends to zero, confidence reaches HIGH across all dimensions, or hard cap of 4 passes is reached (no infinite loops)
  3. `/dan:discuss` runs an interactive interview that surfaces decisions, tradeoffs, and assumptions, and captures them in a structured CONTEXT.md decision log
  4. A second research pass only re-researches identified gaps (not the full domain), demonstrating diminishing returns detection
**Plans**: 3 plans

Plans:
- [x] 03-01-PLAN.md — Research CLI module (init, record-pass, check-convergence, status) with tests and router wiring
- [x] 03-02-PLAN.md — dan:research skill execution_flow with recursive loop, researcher and synthesizer agent enhancements
- [x] 03-03-PLAN.md — dan:discuss skill execution_flow with interactive interview protocol and CONTEXT.md output

### Phase 4: Verification and Quality
**Goal**: After any plan executes, DAN can autonomously verify deliverables against acceptance criteria and recursively sweep for bugs until clean
**Depends on**: Phase 2
**Requirements**: QUAL-01, QUAL-02, QUAL-03, QUAL-04, QUAL-05, QUAL-06
**Success Criteria** (what must be TRUE):
  1. `/dan:verify` checks deliverables against phase goals and acceptance criteria without human intervention, writing results to VERIFICATION.md with pass/fail per criterion
  2. `/dan:bugsweep` finds issues, fixes them, re-verifies, and loops -- terminating when all checks pass or after max 3 cycles (whichever comes first)
  3. If bugsweep detects the same issues recurring across cycles, it stops and escalates to the user instead of looping forever
**Plans**: 2 plans

Plans:
- [x] 04-01-PLAN.md — Verify CLI module (artifact, key-link, phase-completeness checks, issue fingerprinting, report formatting) with tests and router wiring
- [ ] 04-02-PLAN.md — dan:verify and dan:bugsweep skill execution_flows with verifier and auditor agent enhancements

### Phase 5: Autonomy and Execution
**Goal**: User approves scope once, then DAN chains the entire pipeline (research through bugsweep) across all phases in a milestone without human intervention
**Depends on**: Phase 2, Phase 3, Phase 4
**Requirements**: AUTO-01, AUTO-02, AUTO-03, AUTO-04, AUTO-05, AUTO-06, AUTO-07, AUTO-08, AUTO-09
**Success Criteria** (what must be TRUE):
  1. `/dan:milestone` runs the full chain (research, plan, apply, unify, verify, bugsweep) across all phases in a milestone after a single user approval
  2. Independent plans within a phase execute in parallel waves based on dependency analysis, with file-level partitioning preventing state corruption between concurrent agents
  3. `/dan:pause` saves current position and context to STATE.md; `/dan:resume` restores full context and continues from exactly where it stopped -- no human re-explanation needed
  4. `/dan:status` shows current progress, phase position, and suggests the next action
  5. If a phase fails mid-milestone, DAN captures failure context and can retry or escalate without losing progress on completed phases
**Plans**: 3 plans

Plans:
- [x] 05-01-PLAN.md — Milestone and session CLI modules (milestone.cjs, session.cjs) with TDD tests and router wiring
- [ ] 05-02-PLAN.md — dan:milestone and dan:status skill execution_flows with pipeline chaining and progress display
- [ ] 05-03-PLAN.md — dan:pause and dan:resume skill execution_flows with session persistence

## Progress

**Execution Order:**
Phases execute in numeric order. Phases 2 and 3 can execute in parallel (independent dependency chains from Phase 1). Phase 4 depends on Phase 2. Phase 5 depends on Phases 2, 3, and 4.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete | 2026-03-29 |
| 2. Core Loop | 3/3 | Complete | 2026-03-29 |
| 3. Research System | 3/3 | Complete | 2026-03-29 |
| 4. Verification and Quality | 2/2 | Complete   | 2026-03-29 |
| 5. Autonomy and Execution | 1/3 | In progress | - |
