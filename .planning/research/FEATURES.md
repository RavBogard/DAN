# Feature Landscape: DAN

**Domain:** Claude Code development workflow engine (personal, single-user)
**Researched:** 2026-03-28

## Table Stakes

Features users (you) expect from any Claude Code workflow system. Missing any of these makes the system feel broken or incomplete compared to existing alternatives like GSD, PAUL, Quantum-Loop, or spec-driven development frameworks.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Slash command entry points | Every workflow system uses `/command` as the trigger. No slash commands = no discoverability. | Low | `.claude/commands/` with markdown prompts. Unified with skills system in current Claude Code. |
| Structured phase progression | Research -> Plan -> Execute -> Verify is the universal pattern (RIPER, GSD, PAUL, Quantum-Loop all do this). Without it, you have unstructured vibe-coding. | Medium | DAN's variant: Discuss -> Research -> Plan -> Apply -> Unify -> Verify -> Bugsweep |
| File-based state in `.planning/` | Every serious system tracks state in files (GSD uses `.planning/`, PAUL uses plan files, spec-driven systems use spec directories). Enables git-tracking and human readability. | Medium | JSON for machine state, Markdown for human-readable artifacts. Both needed. |
| Plan approval gate | Human reviews and approves the plan before execution begins. PAUL, GSD, Quantum-Loop, spec-driven frameworks all have this. Skipping it means the agent builds the wrong thing. | Low | Single approval point at milestone level, not per-phase. |
| Task-level verification | PAUL's Execute/Qualify loop, GSD's per-task verification, Quantum-Loop's two-stage review gates. Every task needs independent verification against its acceptance criteria. | Medium | Must re-read output independently, not just trust the executor's self-report. |
| Subagent architecture | GSD, Ruflo, Claude Squad, Agent Teams, barkain's orchestrator all spawn specialized agents with fresh context. Single-context approaches hit token limits and degrade quality. | High | Thin orchestrator spawning focused agents. Each agent gets only the context it needs. |
| Progress tracking | Knowing where you are in a multi-phase workflow. PAUL has `/paul:progress`, GSD tracks phase completion, Quantum-Loop shows task status. | Low | State file tracking completed/in-progress/pending phases and tasks. |
| Git integration | Atomic commits per task/phase, branch management. Every workflow system does this. Without it, you can't roll back bad changes. | Medium | Commit per completed task with meaningful messages. Branch-per-milestone optional. |
| CLAUDE.md / project instructions | Persistent project context that loads every session. Universal across all Claude Code workflows. | Low | Already built into Claude Code natively. DAN needs to leverage it, not reinvent it. |
| Error handling and recovery | What happens when a task fails, a test breaks, or the agent gets stuck. Ralph loop has circuit breakers, GSD has retry logic, PAUL has diagnostic routing. | Medium | Must not infinite-loop. Must surface failures clearly. |

## Differentiators

Features that set DAN apart from existing systems. These are where DAN's "research 5x, build once" philosophy creates genuine value that GSD, PAUL, and others don't offer.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Recursive research with gap detection** | GSD runs 4 researchers in parallel (single pass). DAN runs research -> synthesize -> identify gaps -> research again, looping until confidence is high. This is the core "research 5x" differentiator. No other system does multi-pass research with explicit gap analysis. | High | Need clear convergence criteria (confidence thresholds, diminishing returns detection) to prevent infinite research loops. |
| **Deep discuss/interview phase** | Most systems jump from "user prompt" to "plan." DAN inserts a structured interview phase that surfaces assumptions, constraints, tradeoffs, and edge cases BEFORE planning. Inspired by PAUL's checkpoint philosophy but pushed earlier in the pipeline. | Medium | Structured question templates per project type. Output: decision log that feeds directly into planning. |
| **Diagnostic failure routing** | PAUL's innovation: when something fails, classify the root cause BEFORE fixing. Is it an intent mismatch (user wanted something different), a spec error (plan was wrong), or a code bug (implementation was wrong)? Different root causes need different fixes. Most systems just retry or escalate. | Medium | Three-way classification: intent vs spec vs code. Each routes to a different correction path. |
| **Milestone-level autonomy gates** | GSD and PAUL both interrupt for human input at phase boundaries. DAN approves at milestone level and then runs Research -> Plan -> Apply -> Unify -> Verify -> Bugsweep without stopping. Fewer interruptions = more autonomous throughput. | Medium | Requires higher confidence in research and planning phases to compensate for fewer human checkpoints. |
| **Recursive bugsweep until green** | Ralph loop (modify -> verify -> keep/discard -> repeat) is similar but general-purpose. DAN's bugsweep is specifically: run full test suite, analyze failures, fix systematically, re-run, loop until zero failures. Quantum-Loop has review gates but not recursive sweep. | Medium | Need circuit breaker (max iterations, stuck detection). Must not silently delete failing tests. |
| **PAUL-style mandatory loop closure** | Every plan must close: PLAN -> APPLY -> UNIFY -> SUMMARY. No orphan plans. No half-applied changes. Most systems don't enforce this — they let you start a plan and abandon it. PAUL's unify step ensures architectural coherence after changes. | Medium | Unify = re-read all changed files, verify consistency, document what changed and why. |
| **Execute/Qualify separation** | After executing a task, a separate qualify step re-reads the output independently. The executor doesn't grade its own work. Most systems skip this — the agent that wrote the code also "verifies" it. PAUL's E/Q pattern catches self-deception. | Medium | Qualify agent gets: task spec, acceptance criteria, and the output files. NOT the executor's reasoning. |
| **Four-status task reporting** | Instead of binary pass/fail, tasks report: PASS, PASS_WITH_CONCERNS, NEEDS_REVISION, FAIL. This surfaces uncertainty honestly. From PAUL. Most systems only do pass/fail which hides ambiguity. | Low | Concerns get logged for review during unify phase. |
| **Decision log from discuss phase** | The discuss phase produces a structured decision log: decision, alternatives considered, rationale, constraints. This feeds into planning and prevents revisiting settled decisions during execution. | Low | Markdown format, referenced by planners and executors. |
| **Wave-based parallel execution** | GSD's wave parallelization: analyze task dependencies, group independent tasks into waves, execute each wave in parallel with file-lock coordination. Not unique to DAN (GSD, barkain, team-tasks do this) but essential when combined with DAN's other features. | High | Dependency analysis must detect data dependencies, file conflicts, and state conflicts. |

## Anti-Features (Do Not Build)

Features to explicitly NOT build. Including these would add complexity without value for a single-user personal tool, or would contradict DAN's design philosophy.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Multi-runtime support** | GSD v1 supports Claude Code, OpenCode, Gemini CLI, Codex, Cursor, Windsurf, Antigravity. This is massive abstraction overhead for a personal tool that only uses Claude Code. | Hardcode Claude Code assumptions. Use Claude Code's native subagent API directly. |
| **MCP server for rule management** | Ruflo has 259 MCP tools. CARL had dynamic rule injection via MCP. Overcomplicates v1 for a single user. | Config file in `.planning/config.json` or CLAUDE.md preferences. |
| **Web UI / dashboard** | Auto-Claude has a "slick kanban-style UI." Happy Coder has push notifications. DAN is a CLI workflow — adding a UI is a separate product. | Terminal output + file-based state. Read `.planning/` files directly. |
| **Team collaboration features** | Enterprise multi-user, permissions, shared state, team task assignment. Claude Code PM, Agent Teams have these. Single user doesn't need them. | Single-user state. No auth, no permissions, no conflict resolution. |
| **Self-learning / neural routing** | Ruflo v3 claims "self-learning neural capabilities" that learn from task execution. Premature optimization, likely marketing. | Static routing based on task type. Improve routing manually based on experience. |
| **npm package publishing** | Making DAN installable via npm adds packaging, versioning, CI/CD, docs, support burden. | Direct installation into `~/.claude/`. Copy files, done. |
| **Per-phase human approval** | Some systems checkpoint at every phase boundary. Contradicts DAN's milestone-level autonomy. | Single approval at milestone level. Autonomous execution after that. |
| **Dynamic context injection hooks** | Full CARL had runtime hooks that injected rules based on file type, project state, etc. Complex plumbing for marginal value. | Bake preferences into workflow definitions and CLAUDE.md. Static but sufficient. |
| **Cost tracking / token optimization** | GSD v2 tracks cost and tokens. Ruflo claims 75% API cost reduction. Useful for enterprise, not for personal "just make it work" usage. | Trust Claude Code's built-in usage reporting. Don't optimize for cost at the expense of quality. |
| **Infinite agent swarms** | Ruflo deploys 60+ agent swarms. For a single developer, this is absurd. More agents = more coordination overhead, more failure modes. | Small, focused agent count. Orchestrator + 2-4 specialized agents per wave max. |

## Feature Dependencies

```
CLAUDE.md / project instructions (native)
    |
    v
Slash command entry points
    |
    v
File-based state in .planning/
    |
    +---> Deep discuss/interview phase ---> Decision log
    |                                           |
    v                                           v
Recursive research with gap detection ---> Structured phase progression
                                               |
                                               v
                                        Plan approval gate (milestone-level)
                                               |
                                               v
                                   +--- Wave-based parallel execution ---+
                                   |                                     |
                                   v                                     v
                              Subagent architecture              Dependency analysis
                                   |
                                   v
                          Task execution (Apply phase)
                                   |
                                   v
                          Execute/Qualify separation
                                   |
                                   v
                          Four-status task reporting
                                   |
                                   v
                          Diagnostic failure routing (on failure)
                                   |
                                   v
                          Progress tracking
                                   |
                                   v
                          PAUL-style mandatory loop closure (Unify)
                                   |
                                   v
                          Recursive bugsweep until green
                                   |
                                   v
                          Git integration (atomic commits)
                                   |
                                   v
                          Error handling and recovery
```

### Critical Path Dependencies

1. **File-based state** must exist before anything else works. All phases read/write state.
2. **Subagent architecture** must exist before wave-based parallel execution. Can't parallelize without separate agents.
3. **Execute/Qualify separation** requires subagent architecture (qualifier is a different agent than executor).
4. **Recursive research** requires file-based state (to track what's been researched, where gaps are).
5. **Discuss phase** should precede research (decisions inform what to research).
6. **Bugsweep** requires verification infrastructure (test runner, success criteria).

### Independence Groups (can be built in parallel)

- Group A: Discuss phase + Decision log
- Group B: Research system + Gap detection
- Group C: Wave parallelization + Dependency analysis
- Group D: Diagnostic routing + Four-status reporting

## Complexity Estimates

| Feature | Complexity | Effort Estimate | Risk |
|---------|------------|-----------------|------|
| Slash command entry points | Low | 1-2 days | Low — well-documented pattern |
| File-based state system | Medium | 3-5 days | Medium — schema design matters, hard to change later |
| Structured phase progression | Medium | 3-5 days | Low — orchestrator dispatching to phases |
| Subagent architecture | High | 5-8 days | High — context engineering, prompt design, fresh context per agent |
| Recursive research | High | 5-8 days | High — convergence criteria, gap detection, preventing infinite loops |
| Deep discuss/interview | Medium | 2-4 days | Low — structured prompts, decision log output |
| Plan approval gate | Low | 1 day | Low — pause and wait for input |
| Wave-based parallel execution | High | 5-8 days | High — dependency analysis, file locking, failure handling in parallel |
| Execute/Qualify separation | Medium | 2-3 days | Medium — qualifier needs clean context, not executor's reasoning |
| Task-level verification | Medium | 2-3 days | Medium — defining what "verified" means per task type |
| Four-status task reporting | Low | 1 day | Low — status enum + logging |
| Diagnostic failure routing | Medium | 2-3 days | Medium — classification heuristics need tuning |
| PAUL-style loop closure | Medium | 2-3 days | Low — enforce unify step, prevent orphan plans |
| Recursive bugsweep | Medium | 3-5 days | Medium — circuit breaker logic, stuck detection |
| Decision log | Low | 1 day | Low — structured markdown output |
| Git integration | Medium | 2-3 days | Low — atomic commits, branch management |
| Progress tracking | Low | 1-2 days | Low — state file updates |
| Error handling and recovery | Medium | 3-5 days | Medium — many failure modes to handle |
| Session management (pause/resume) | Medium | 3-5 days | Medium — context serialization, state restoration |

**Total estimated effort:** 45-70 days (solo development with Claude Code assistance)

## MVP Recommendation

### Phase 1: Foundation (must work first)
1. File-based state system (everything depends on this)
2. Slash command entry points (discoverability)
3. Subagent architecture (thin orchestrator + agent spawning)
4. Structured phase progression (the skeleton)
5. Progress tracking

### Phase 2: Research & Planning (the "research 5x" differentiator)
1. Deep discuss/interview phase
2. Decision log
3. Recursive research with gap detection
4. Plan approval gate (milestone-level)

### Phase 3: Execution Engine
1. Execute/Qualify separation
2. Four-status task reporting
3. Git integration (atomic commits)
4. PAUL-style mandatory loop closure (Unify)

### Phase 4: Quality & Robustness
1. Recursive bugsweep until green
2. Diagnostic failure routing
3. Error handling and recovery
4. Wave-based parallel execution

### Phase 5: Polish
1. Session management (pause/resume)
2. Tuning convergence criteria for research loops
3. Tuning circuit breakers for bugsweep

**Defer indefinitely:** Wave-based parallel execution could move to Phase 3 if the foundation supports it, but sequential execution works fine for v1. Parallelization is optimization, not correctness.

## Sources

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) - Official skills system docs
- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents) - Official subagent architecture
- [PAUL - Plan-Apply-Unify Loop](https://github.com/ChristopherKahler/paul) - E/Q pattern, diagnostic routing, four-status reporting, mandatory closure
- [GSD - Get Shit Done](https://github.com/gsd-build/get-shit-done) - Wave parallelization, fresh-context agents, file-based state, 4-researcher pattern
- [GSD v2](https://github.com/gsd-build/gsd-2) - CLI-based orchestration, auto-advance through milestones
- [Quantum-Loop](https://github.com/andyzengmath/quantum-loop) - Dependency DAG execution, two-stage review gates
- [Ruflo](https://github.com/ruvnet/ruflo) - Multi-agent swarm orchestration (anti-pattern reference for DAN's scope)
- [Awesome Claude Code](https://github.com/hesreallyhim/awesome-claude-code) - Comprehensive ecosystem catalog
- [Ralph Loop for Claude Code](https://github.com/frankbria/ralph-claude-code) - Autonomous iteration with exit detection
- [Spec-Driven Development Workflows](https://github.com/Pimzino/claude-code-spec-workflow) - Requirements -> Design -> Tasks -> Implementation pattern
- [Claude Code Session Management](https://stevekinney.com/courses/ai-development/claude-code-session-management) - Native --continue and --resume capabilities
- [DAG Executor Skill](https://lobehub.com/skills/erichowens-some_claude_skills-dag-executor) - Task dependency graph execution
- [Barkain Workflow Orchestration](https://github.com/barkain/claude-code-workflow-orchestration) - Parallel agent execution with file-lock coordination
