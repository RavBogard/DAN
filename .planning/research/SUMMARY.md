# Project Research Summary

**Project:** DAN (Development Autonomy Engine)
**Domain:** Claude Code skill system / autonomous development workflow engine
**Researched:** 2026-03-28
**Confidence:** HIGH

## Executive Summary

DAN is a personal autonomous development workflow engine that lives entirely within Claude Code's native extension points -- skills, subagents, hooks, and file-based state. The proven approach, validated by two production systems (GSD and PAUL), is a hub-and-spoke architecture: thin orchestrator commands dispatch to specialized subagents with fresh context windows, communicating exclusively through `.planning/` state files. There is no external runtime, no npm dependencies, no database. The "stack" is Claude Code itself, and the entire system is a set of markdown and JavaScript files deployed to `~/.claude/`.

DAN's core differentiator over existing systems is its "research 5x, build once" philosophy: recursive multi-pass research with gap detection, a structured discuss/interview phase before planning, and PAUL-derived Execute/Qualify separation where the executor never grades its own work. Combined with milestone-level autonomy gates (approve once, then research-plan-apply-unify-verify-bugsweep runs without stopping), this creates a workflow that is both more thorough in preparation and more autonomous in execution than GSD or PAUL individually.

The critical risks are context rot during long autonomous chains (quality degrades at 20-40% context usage), infinite recursive loops in research and bugsweep (the #1 agentic engineering plague of 2026), and the hard constraint that Claude Code subagents cannot spawn other subagents (forcing a strict two-level orchestration model). All three are well-understood and have proven mitigations: fresh context per phase, hard iteration caps with diminishing returns detection, and designing for exactly two levels of agent hierarchy from day one.

## Key Findings

### Recommended Stack

DAN uses Claude Code's native primitives as its entire technology stack. No external frameworks, build systems, or package managers. See [STACK.md](./STACK.md) for full details.

**Core technologies:**
- **Skills** (`.claude/skills/dan-*/SKILL.md`): User-invoked entry points with frontmatter for invocation control, `context: fork` for subagent execution, and supporting file directories
- **Subagents** (`.claude/agents/dan-*.md`): Specialized workers with fresh context windows, tool restrictions, and model selection per agent type (haiku for exploration, inherit for complex work)
- **CLI Tools** (`dan-tools.cjs`): Single CJS entry point with subcommand routing, Node.js built-ins only, JSON output for agent consumption -- following GSD's proven 23K-line pattern
- **Hooks** (`settings.json`): Lifecycle automation for context monitoring, loop enforcement, and auto-commit
- **File-based state** (`.planning/`): Markdown + JSON, git-tracked, human-readable, the single source of truth
- **Semantic XML in Markdown**: Workflow definitions use `<step>`, `<if>`, `<purpose>` elements for parseable structure without a custom format

**Critical constraint:** No npm dependencies. Node.js built-ins only. Node 22+ has native glob which covers the main utility gap.

### Expected Features

See [FEATURES.md](./FEATURES.md) for the complete feature landscape and dependency graph.

**Must have (table stakes):**
- Slash command / skill entry points (discoverability)
- Structured phase progression (research -> plan -> execute -> verify)
- File-based state in `.planning/` (git-trackable project memory)
- Plan approval gate at milestone level (human reviews before autonomous execution)
- Subagent architecture with fresh context per worker
- Task-level verification (independent qualification, not self-grading)
- Progress tracking and atomic git commits per task

**Should have (differentiators):**
- Recursive research with gap detection (multi-pass, confidence-driven convergence)
- Deep discuss/interview phase with structured decision log
- Execute/Qualify separation (PAUL pattern -- separate agent re-reads output independently)
- Milestone-level autonomy gates (approve once, run the full chain)
- Diagnostic failure routing (classify root cause as intent/spec/code before fixing)
- PAUL-style mandatory loop closure (PLAN -> APPLY -> UNIFY -> SUMMARY, no orphan plans)
- Four-status task reporting (PASS, PASS_WITH_CONCERNS, NEEDS_REVISION, FAIL)
- Recursive bugsweep with circuit breakers

**Defer (v2+):**
- Wave-based parallel execution (sequential is correct for v1; parallelization is optimization)
- Advanced session management with pause/resume
- Expanded config/preferences system (start with zero config, add options only when needed)

**Do NOT build:** Multi-runtime support, MCP servers, web UI, team collaboration, npm packaging, per-phase human approval, cost tracking, infinite agent swarms.

### Architecture Approach

The architecture follows a strict two-level model: commands/skills are orchestrators (user-facing, contain sequencing logic, spawn agents), and agents are stateless workers (focused responsibility, fresh context, return results via files). This is a hard constraint from Claude Code -- subagents cannot spawn other subagents. See [ARCHITECTURE.md](./ARCHITECTURE.md) for component map and data flows.

**Major components:**
1. **12 Skills/Commands** (`/dan:init`, `/dan:discuss`, `/dan:research`, `/dan:plan`, `/dan:apply`, `/dan:unify`, `/dan:verify`, `/dan:bugsweep`, `/dan:milestone`, `/dan:status`, `/dan:pause`, `/dan:resume`) -- orchestration layer
2. **7 Subagents** (researcher, synthesizer, planner, executor, qualifier, verifier, bugsweeper) -- worker layer with tool restrictions per role
3. **CLI Tools** (`dan-tools.cjs`) -- atomic state operations, template filling, dependency analysis, git operations
4. **Skill** (`dan-workflow/SKILL.md`) -- shared rules injected into all agents: loop protocol, E/Q protocol, diagnostic routing
5. **State Files** (`.planning/`) -- PROJECT.md, ROADMAP.md, STATE.md, dan.config.json, research/, phases/

**Key architectural decisions:**
- Default to in-session execution for the apply phase (PAUL insight: subagents lose ~30% quality from missing context). Use separate agents for research, qualification, verification, and bugsweep where independence is the priority.
- State is never held in agent memory across invocations. All state lives in `.planning/` files. Pause/resume is trivial because files ARE the state.
- Thin orchestrators, thick agents. Commands do: read state -> determine next action -> spawn agent -> read result -> update state. Agents contain the domain logic.

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for the full prevention matrix and phase-specific warnings.

1. **Context rot kills quality mid-execution** -- Output degrades at 20-40% context usage. Prevention: fresh context per phase agent, file-based handoffs between phases, never chain multiple major phases in one agent invocation.
2. **Subagent nesting impossibility** -- Claude Code subagents cannot spawn subagents. Prevention: design for exactly two levels from day one. Wave parallelization must be orchestrated from the top-level command, not from an intermediate agent.
3. **Race conditions in file-based state** -- Parallel agents writing to the same state files causes corruption. Prevention: atomic writes (temp file + rename), partition state by agent (each writes its own file), orchestrator merges results.
4. **Infinite recursive loops** -- Research and bugsweep have no guaranteed termination. Prevention: hard iteration caps (research: 4 passes max, bugsweep: 3 cycles max), diminishing returns detection, budget limits per phase.
5. **Orphan plans from interrupted sessions** -- Plans left IN_PROGRESS with no closure record. Prevention: atomic task checkpointing after each completion, plan lifecycle states (DRAFT -> APPROVED -> IN_PROGRESS -> COMPLETED/ABANDONED), reconciliation on resume.

## Implications for Roadmap

Based on combined research, the build order follows a clear dependency chain. Each layer depends on the one before it.

### Phase 1: Foundation
**Rationale:** Everything depends on state schemas, CLI tools, and the skill definition. Changing these later forces rewrites across all commands and agents. The two-level agent model and fresh-context pattern must be established here as non-negotiable architecture.
**Delivers:** State file schemas (PROJECT.md, STATE.md, ROADMAP.md, dan.config.json), CLI tools with atomic read/write operations, core skill definition with loop protocol and E/Q spec, `/dan:init` command, progress tracking
**Addresses features:** File-based state system, slash command entry points, subagent architecture skeleton, progress tracking
**Avoids pitfalls:** Context rot (fresh-context-per-agent baked in), subagent nesting (two-level model enforced), orphan plans (plan lifecycle states defined), file race conditions (atomic writes in CLI tools), CLAUDE.md conflicts (merge strategy defined during init)

### Phase 2: Core Loop (Plan-Apply-Unify)
**Rationale:** The PAUL-derived Plan-Apply-Unify loop is the minimum viable workflow. Once this works, you can manually provide research and run real development cycles. This is the highest-value functionality to validate early.
**Delivers:** `/dan:plan` + planner agent, `/dan:apply` + executor + qualifier agents, `/dan:unify` command, Execute/Qualify separation, four-status task reporting, mandatory loop closure
**Addresses features:** Structured phase progression, plan approval gate, task-level verification, PAUL-style loop closure, E/Q separation, four-status reporting
**Avoids pitfalls:** Over-engineered orchestrator (thin commands, logic in agents), orphan plans (atomic checkpointing per task)

### Phase 3: Research System
**Rationale:** Can be built in parallel with Phase 2 (independent dependency chain). The recursive research system is DAN's core differentiator. Needs iteration caps and convergence criteria from the start.
**Delivers:** Researcher agent, synthesizer agent, `/dan:research` command with recursive wave orchestration, gap detection, confidence-driven termination, `/dan:discuss` command with structured decision log
**Addresses features:** Recursive research with gap detection, deep discuss/interview phase, decision log
**Avoids pitfalls:** Infinite recursive loops (hard caps built in), overusing research for simple tasks (complexity classifier)

### Phase 4: Verification and Quality
**Rationale:** Depends on Phases 2-3 being functional. There is nothing to verify until plans execute. The bugsweep loop is the last phase in autonomous chains and must be robust against fix-break-fix cycles.
**Delivers:** Verifier agent + `/dan:verify`, bugsweeper agent + `/dan:bugsweep` with recursive audit loop, diagnostic failure routing (intent vs spec vs code classification)
**Addresses features:** Recursive bugsweep, diagnostic failure routing, error handling and recovery
**Avoids pitfalls:** Skipping diagnostic classification (mandatory in agent prompt), fix-break-fix cycles (diminishing returns detection, escalation to human)

### Phase 5: Autonomy and Polish
**Rationale:** The capstone: milestone-level autonomous execution chains everything together. If any earlier phase is broken, the chain fails. Build this last.
**Delivers:** `/dan:milestone` (chains research -> plan -> apply -> unify -> verify -> bugsweep), session management (pause/resume/status), preferences system refinement, error recovery across phase boundaries
**Addresses features:** Milestone-level autonomy gates, session management, config refinement
**Avoids pitfalls:** Session restore losing context (re-read state files on resume, maintain session-state.md), config complexity creep (start minimal, max 20 options)

### Phase Ordering Rationale

- **State schemas first** because every component reads/writes them. Late schema changes cascade across all commands and agents.
- **CLI tools in Phase 1** because they prevent state corruption bugs that are nearly impossible to diagnose later. The atomic write pattern must exist before any agent writes state.
- **Core loop before research** because you can manually provide research and still use plan-apply-unify. Research enhances plan quality but is not a prerequisite for the core loop.
- **Phases 2 and 3 can overlap** -- they share only the foundation layer as a dependency. The core loop and research system are architecturally independent.
- **Verification after core loop** because there is nothing to verify until plans execute.
- **Autonomy last** because `/dan:milestone` chains all other phases. Every link must work independently before chaining.
- **Wave parallelization deferred** to v2. Sequential execution is correct. Parallelization is optimization, not correctness. The dependency analysis and file-locking complexity is high relative to value for a single user.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Core Loop):** The in-session vs subagent execution decision for `/dan:apply` needs validation. PAUL says in-session preserves ~30% more quality; GSD says fresh context prevents rot. Real-world testing needed to find the right balance.
- **Phase 3 (Research System):** Convergence criteria for recursive research are subjective LLM assessments. The heuristics for diminishing returns detection need experimentation. The subagent nesting constraint means all research waves must be spawned from the orchestrator skill, not from an intermediate agent.
- **Phase 5 (Autonomy):** Session resume with `--continue` has documented attention degradation on restored context. The session-state.md approach needs validation.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** State schemas, CLI tools, and skill definitions follow well-established GSD and PAUL patterns. GSD's `gsd-tools.cjs` is a direct template. HIGH confidence.
- **Phase 4 (Verification):** The verify/bugsweep pattern is well-documented in PAUL and Ralph Loop. Standard implementation with circuit breakers. HIGH confidence.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All components verified against official Claude Code docs and two installed production systems (GSD, PAUL). No speculative elements. |
| Features | HIGH | Feature landscape derived from direct analysis of 10+ open-source workflow systems. Table stakes are universal. Differentiators are proven individually in source systems. |
| Architecture | HIGH | Two-level orchestration is a hard constraint from Claude Code docs. Commands-as-orchestrators, agents-as-workers is proven by GSD's 12-agent architecture. File-based state is proven by both systems. |
| Pitfalls | HIGH | Every critical pitfall is documented with real incidents (GSD's context rot issue, Claude Code race condition bug #28847, PAUL's orphan plan principle). Not theoretical risks. |

**Overall confidence:** HIGH

### Gaps to Address

- **In-session vs subagent execution balance:** PAUL and GSD disagree. The ~30% quality loss from subagent context isolation vs context rot from long sessions is a real tradeoff. Needs empirical testing during Phase 2 implementation. Recommend starting with in-session execution and switching to subagent isolation only when context usage crosses 30%.
- **Research convergence heuristics:** "Confident enough to stop researching" is inherently subjective. Initial implementation should use simple heuristics (iteration count + gap count trending down) and expect tuning over first 3-5 real projects.
- **Skills vs commands terminology:** STACK.md recommends skills (current standard), ARCHITECTURE.md describes commands. Both work in Claude Code. Skills are the forward-looking choice with better features (frontmatter, supporting files, invocation control). Recommend skills for all new DAN entry points.
- **Node.js built-in coverage:** The no-npm-deps constraint may cause friction for YAML parsing or complex glob patterns. Node 22+ native glob helps. Revisit if reimplementation bugs consume more than 1 day of effort.
- **Hook reliability on Windows:** GSD's context monitor has a 3-second stdin timeout workaround for Windows/Git Bash. DAN's hooks need similar defensive coding.

## Sources

### Primary (HIGH confidence)
- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) -- skills system, frontmatter, supporting files
- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents) -- agent spawning, nesting constraint, tool restrictions
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) -- lifecycle hooks, exit code semantics
- GSD source (`~/.claude/get-shit-done/`) -- CLI tools pattern, wave parallelization, fresh-context architecture, 23K-line battle-tested CLI
- PAUL source (`~/.claude/paul-framework/`) -- E/Q pattern, loop closure, diagnostic routing, four-status reporting

### Secondary (MEDIUM confidence)
- [Beating Context Rot in Claude Code - The New Stack](https://thenewstack.io/beating-the-rot-and-getting-stuff-done/) -- context degradation at 20-40% usage
- [Claude Code Race Condition Issue #28847](https://github.com/anthropics/claude-code/issues/28847) -- file corruption in concurrent writes
- [Quantum-Loop](https://github.com/andyzengmath/quantum-loop) -- dependency DAG execution, two-stage review gates
- [Ralph Loop](https://github.com/frankbria/ralph-claude-code) -- autonomous iteration with exit detection
- [Awesome Claude Code](https://github.com/hesreallyhim/awesome-claude-code) -- ecosystem catalog, feature landscape context

### Tertiary (LOW confidence)
- [Ruflo](https://github.com/ruvnet/ruflo) -- referenced as anti-pattern for scope (60+ agent swarms is wrong for single-user)
- [Claude Code Session Management](https://stevekinney.com/courses/ai-development/claude-code-session-management) -- `--continue` behavior, attention degradation on restore

---
*Research completed: 2026-03-28*
*Ready for roadmap: yes*
