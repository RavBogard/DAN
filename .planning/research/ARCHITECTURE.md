# Architecture Research: DAN

**Domain:** Claude Code skill system / autonomous development workflow engine
**Researched:** 2026-03-28
**Confidence:** HIGH (based on official Claude Code docs, PAUL source, GSD source)

## System Components

DAN lives entirely within Claude Code's extension points: commands (user-invoked), agents (Task-tool-invoked), skills (context-injected), and a thin CLI tools layer for state management. There is no external runtime.

### Component Map

```
~/.claude/
  commands/           # User-invoked entry points (slash commands)
    dan/
      discuss.md      # /dan:discuss - deep interview/alignment phase
      research.md     # /dan:research - trigger recursive research
      plan.md         # /dan:plan - create executable plan for phase
      apply.md        # /dan:apply - execute approved plan
      unify.md        # /dan:unify - close loop, write summary
      verify.md       # /dan:verify - autonomous verification pass
      bugsweep.md     # /dan:bugsweep - recursive audit loop
      init.md         # /dan:init - initialize DAN in a project
      resume.md       # /dan:resume - restore session from state
      pause.md        # /dan:pause - save state for later
      milestone.md    # /dan:milestone - approve scope, trigger autonomy
      status.md       # /dan:status - show progress + next action

  agents/             # Subagents spawned by orchestrator commands
    dan-researcher.md       # Recursive research agent
    dan-synthesizer.md      # Research synthesis agent
    dan-executor.md         # Plan execution agent
    dan-qualifier.md        # E/Q qualify step (independent re-read)
    dan-verifier.md         # Verification against phase goals
    dan-bugsweeper.md       # Audit/fix loop agent
    dan-planner.md          # Plan generation agent

  skills/             # Context injected into agents
    dan-workflow/
      SKILL.md              # Core workflow rules + preferences
      references/
        loop-protocol.md    # PLAN->APPLY->UNIFY closure rules
        eq-protocol.md      # Execute/Qualify cycle spec
        diagnostic-routing.md # Failure classification rules
        config-schema.md    # User preferences schema

bin/                  # CLI tools (Node.js, no deps)
  dan-tools.cjs       # State management, template filling, dependency analysis
```

### Component Responsibilities

| Component | Type | Responsibility | Talks To |
|-----------|------|---------------|----------|
| `/dan:init` | Command | Initialize `.planning/` in project, run discuss phase | User, state files |
| `/dan:discuss` | Command | Deep interview, surface decisions/tradeoffs | User, `.planning/PROJECT.md` |
| `/dan:research` | Command | Orchestrate recursive research waves | `dan-researcher`, `dan-synthesizer`, state files |
| `/dan:plan` | Command | Generate executable plan for a phase | `dan-planner`, `.planning/phases/` |
| `/dan:apply` | Command | Execute plan with E/Q loop | `dan-executor`, `dan-qualifier`, state files |
| `/dan:unify` | Command | Close loop, write summary, update state | State files, `.planning/phases/` |
| `/dan:verify` | Command | Autonomous verification against phase goals | `dan-verifier`, state files |
| `/dan:bugsweep` | Command | Recursive audit: find -> fix -> re-verify -> loop | `dan-bugsweeper`, `dan-verifier` |
| `/dan:milestone` | Command | Approve scope, trigger autonomous execution chain | All agents via chaining |
| `dan-researcher` | Agent | Single research pass on specific topic | Web tools, Context7, file system |
| `dan-synthesizer` | Agent | Merge research findings, identify gaps | Research output files |
| `dan-executor` | Agent | Execute single task from plan | Full tool access |
| `dan-qualifier` | Agent | Independent re-read and qualify against spec | Read-only tools |
| `dan-verifier` | Agent | Check deliverables against acceptance criteria | Read-only + Bash (tests) |
| `dan-bugsweeper` | Agent | Find issues, fix them, report | Full tool access |
| `dan-planner` | Agent | Generate plan from research + project context | Read-only tools |
| `dan-workflow` | Skill | Inject loop protocol, preferences, diagnostic routing | Loaded into agent context |
| `dan-tools.cjs` | CLI | Atomic state reads/writes, template operations | Called via Bash from agents |

### Key Architectural Decision: Commands as Orchestrators, Agents as Workers

Commands are the user-facing entry points. They contain orchestration logic (what to do, in what order, what agents to spawn). Agents are specialized workers with fresh context windows -- they do one thing well and return results.

This mirrors GSD's "thin orchestrator" pattern but uses Claude Code's native primitives instead of a custom CLI runtime. The command markdown IS the orchestrator prompt. The agent markdown IS the worker prompt.

**Why not a custom CLI like GSD v2?** DAN is a personal tool. Claude Code's native command/agent system provides orchestration, context isolation, and tool restriction without building a separate runtime. The tradeoff: less control over context injection timing, but dramatically less code to maintain.

## Data Flow

### Initialization Flow

```
User runs /dan:init
  -> Discuss phase: interview user about project
  -> Write .planning/PROJECT.md (requirements, constraints, decisions)
  -> Write .planning/dan.config.json (preferences)
  -> Ready for /dan:research
```

### Research Flow (Recursive)

```
User runs /dan:research [topic]
  -> Spawn dan-researcher agents (wave 1: parallel independent topics)
  -> Each researcher writes to .planning/research/*.md
  -> Spawn dan-synthesizer to merge findings, identify gaps
  -> If gaps found AND confidence < threshold:
      -> Spawn dan-researcher agents (wave 2: targeted gap-filling)
      -> Re-synthesize
      -> Loop until confident or max passes reached
  -> Write final .planning/research/SUMMARY.md
```

### Plan-Apply-Unify Flow

```
User runs /dan:plan [phase]
  -> Read .planning/research/*, .planning/PROJECT.md
  -> Spawn dan-planner to generate plan
  -> Write .planning/phases/NN-name/NN-MM-PLAN.md
  -> Present to user for approval (only approval gate)

User runs /dan:apply [plan-path]
  -> For each task in plan:
      -> Execute task (in-session or via dan-executor for isolation)
      -> Spawn dan-qualifier (fresh context, read-only)
        -> Re-read what was produced
        -> Compare against task spec + acceptance criteria
        -> Return: DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED
      -> If not DONE: diagnostic routing -> classify -> fix -> re-qualify
  -> Update .planning/STATE.md after each task

User runs /dan:unify [plan-path]
  -> Compare plan vs actual
  -> Write .planning/phases/NN-name/NN-MM-SUMMARY.md
  -> Record decisions, deferred items
  -> Update STATE.md
```

### Autonomous Milestone Flow

```
User runs /dan:milestone [name]
  -> Presents scope for approval
  -> On approval, chains: research -> plan -> apply -> unify -> verify -> bugsweep
  -> Each phase auto-triggers next
  -> Bugsweep loops until clean or max iterations
  -> Final status report to user
```

### State File Layout (per-project)

```
.planning/
  PROJECT.md              # Requirements, constraints, key decisions
  ROADMAP.md              # Phase breakdown with ordering
  STATE.md                # Current position, session continuity
  dan.config.json         # User preferences (simplified CARL)
  research/
    SUMMARY.md            # Synthesized research findings
    STACK.md              # Technology recommendations
    FEATURES.md           # Feature landscape
    ARCHITECTURE.md       # Architecture patterns
    PITFALLS.md           # Domain pitfalls
  phases/
    01-foundation/
      01-01-PLAN.md       # Executable plan
      01-01-SUMMARY.md    # Loop closure document
    02-features/
      02-01-PLAN.md
      02-01-SUMMARY.md
```

### State Management Protocol

State files are the single source of truth. Every command reads state before acting and writes state after completing. The CLI tools layer (`dan-tools.cjs`) provides atomic operations:

- **Read state**: Parse STATE.md to determine current position
- **Update state**: Atomic write with position, phase, plan status
- **Session save/restore**: Serialize enough context to resume cold

**Critical rule:** Agents never hold state in memory across invocations. All state lives in `.planning/` files. This makes pause/resume trivial -- the files ARE the state.

## File System Layout

### Global Installation (`~/.claude/`)

```
~/.claude/
  commands/dan/          # 12 slash commands (user entry points)
  agents/                # 7 specialized agents (worker definitions)
  skills/dan-workflow/   # 1 skill with references (injected context)
```

### Per-Project (`.planning/`)

```
.planning/               # Created by /dan:init
  PROJECT.md             # Human-written/refined requirements
  ROADMAP.md             # Phase structure
  STATE.md               # Machine-maintained position tracking
  dan.config.json        # Preferences (formatting, git, etc.)
  research/              # Research outputs (recursive passes)
  phases/                # Plan/summary pairs per phase
```

### CLI Tools

```
~/.claude/bin/           # Or wherever the user prefers
  dan-tools.cjs          # Single file, Node.js built-ins only
```

The CLI tools file handles:
- State file parsing and atomic updates
- Template filling for plan/summary generation
- Dependency analysis between tasks/phases
- Git operations (atomic commits with conventional messages)

## Build Order

Build order follows the dependency chain. Each layer depends on the one before it.

### Layer 0: Foundation (no dependencies)

**Build first -- everything else depends on these.**

1. **State file schemas** -- Define the exact format of `PROJECT.md`, `STATE.md`, `ROADMAP.md`, `dan.config.json`. These are the contract between all components.
2. **CLI tools (`dan-tools.cjs`)** -- State read/write, template fill. Every command and agent calls these. Build and test independently.
3. **Skill definition (`dan-workflow/SKILL.md`)** -- Core workflow rules, loop protocol, E/Q protocol, diagnostic routing, preferences schema. This is injected into every agent.

### Layer 1: Core Loop (depends on Layer 0)

**The PAUL-derived Plan-Apply-Unify loop. This is the minimum viable workflow.**

4. **`/dan:init`** -- Project initialization, discuss phase, write PROJECT.md
5. **`/dan:plan`** + `dan-planner` agent -- Generate executable plans
6. **`/dan:apply`** + `dan-executor` + `dan-qualifier` agents -- Execute with E/Q loop
7. **`/dan:unify`** -- Close loop, write summary

At this point you can manually run plan-apply-unify cycles.

### Layer 2: Research System (depends on Layer 0)

**Can be built in parallel with Layer 1.**

8. **`dan-researcher` agent** -- Single research pass
9. **`dan-synthesizer` agent** -- Merge and gap-detect
10. **`/dan:research` command** -- Orchestrate recursive research waves

### Layer 3: Verification (depends on Layers 1-2)

11. **`dan-verifier` agent** + `/dan:verify` command -- Check against acceptance criteria
12. **`dan-bugsweeper` agent** + `/dan:bugsweep` command -- Recursive audit loop

### Layer 4: Autonomy (depends on Layers 1-3)

**The capstone: milestone-level autonomous execution.**

13. **`/dan:milestone`** -- Chain research -> plan -> apply -> unify -> verify -> bugsweep
14. **Session management** (`/dan:pause`, `/dan:resume`, `/dan:status`) -- Save/restore across sessions

### Layer 5: Polish

15. **`/dan:discuss`** as standalone command (deeper interview capabilities)
16. **Preferences system** refinement (`dan.config.json` driving behavior)
17. **Error recovery** -- What happens when agents fail mid-chain

### Build Order Rationale

- **State schemas first** because every component reads/writes them. Changing schemas later forces rewrites across all commands and agents.
- **CLI tools early** because they prevent state corruption bugs that are hard to diagnose later.
- **Skill before agents** because agents load the skill; the skill defines what "correct behavior" means.
- **Core loop before research** because you can manually provide research and still use plan-apply-unify. Research is an enhancement to plan quality, not a prerequisite.
- **Verification after core loop** because there is nothing to verify until plans execute.
- **Autonomy last** because it chains everything else. If any link is broken, the chain fails.

## Key Architecture Decisions

### Decision 1: Native Claude Code Primitives Over Custom Runtime

**Use:** Claude Code commands, agents, and skills as the orchestration layer.
**Not:** A custom CLI/SDK like GSD v2's Pi SDK approach.

**Rationale:** DAN is a personal tool. Claude Code already provides context isolation (agents), user invocation (commands), and context injection (skills). Building a custom runtime adds hundreds of lines of code for capabilities that already exist. The tradeoff is less fine-grained control over context injection timing, but for a single user this is acceptable.

**Confidence:** HIGH -- based on official Claude Code docs showing commands/agents/skills cover all required patterns.

### Decision 2: Commands = Orchestrators, Agents = Workers

Commands contain the orchestration logic (sequencing, decision-making, state transitions). Agents are stateless workers with focused responsibilities and fresh context windows.

**Why not agents orchestrating agents?** Claude Code subagents cannot spawn other subagents. The command (running in the main conversation) is the only entity that can spawn agents. This is a hard constraint from Claude Code's architecture.

**Confidence:** HIGH -- explicitly documented in Claude Code subagent docs: "Subagents cannot spawn other subagents."

### Decision 3: In-Session Execution with Selective Agent Isolation

PAUL's philosophy: keep implementation in-session (subagents lose 30% quality from missing context). GSD's philosophy: fresh context per agent (prevents context rot).

**DAN's approach:** Default to in-session execution for the apply phase. Use agents for:
- Research (naturally parallel, independent)
- Qualification (must be independent to catch drift)
- Verification (must be independent to be honest)
- Bugsweep (benefits from fresh eyes)

The `/dan:apply` command runs tasks directly in the main conversation unless the task is explicitly marked for isolation. The E/Q qualify step always uses a separate agent (fresh context is the whole point).

**Confidence:** MEDIUM -- this is a design judgment call. May need tuning based on real usage.

### Decision 4: File-Based State, No Database

All state in `.planning/` as markdown and JSON. No SQLite, no external services.

**Why:** Human-readable, git-trackable, trivially inspectable. The CLI tools layer prevents corruption. For a single user, there are no concurrency concerns that would require a database.

**Confidence:** HIGH -- both PAUL and GSD use this pattern successfully.

### Decision 5: Recursive Research via Wave Parallelization

Research spawns multiple researcher agents in parallel (wave 1), synthesizes findings, identifies gaps, then spawns targeted researchers (wave 2), repeating until confident.

**Implementation:** The `/dan:research` command is the orchestrator. It reads the synthesis output after each wave, checks for explicit "LOW confidence" or "gaps" markers, and decides whether to spawn another wave. Maximum 3-4 waves to prevent infinite loops.

**Confidence:** MEDIUM -- the pattern is sound (GSD uses wave parallelization), but the "confident enough" heuristic needs real-world tuning.

### Decision 6: Skill Injection for Shared Rules

The `dan-workflow` skill contains all shared protocol (loop rules, E/Q spec, diagnostic routing, preferences). It is listed in the `skills:` frontmatter of every agent definition so it loads automatically.

**Why a skill instead of CLAUDE.md?** Skills are scoped to specific agents. CLAUDE.md applies globally. DAN's rules should only apply when DAN agents are running, not during normal Claude Code usage.

**Confidence:** HIGH -- official Claude Code docs confirm skills are injected into agent context at startup.

### Decision 7: Simplified Preferences (Config File)

A single `dan.config.json` in `.planning/` holds user preferences:
- Code style preferences
- Git commit conventions
- Testing requirements
- Preferred libraries/patterns

The skill reads this file and adapts behavior. No dynamic rule injection, no keyword matching, no CARL-style domain system. Just a config file.

**Confidence:** HIGH -- explicitly scoped in PROJECT.md as a design decision.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Fat Agents
**What:** Putting orchestration logic in agent definitions.
**Why bad:** Agents cannot spawn other agents. Orchestration logic in an agent is dead code.
**Instead:** Keep agents focused on one task. Put sequencing in commands.

### Anti-Pattern 2: State in Agent Memory
**What:** Using Claude Code's `memory:` frontmatter for workflow state.
**Why bad:** Agent memory is for learning/preferences across sessions, not transactional state. It is unstructured and not atomically updatable.
**Instead:** All workflow state in `.planning/STATE.md` via CLI tools.

### Anti-Pattern 3: Monolithic Commands
**What:** A single `/dan:run` command that does everything.
**Why bad:** When something fails mid-run, there is no way to resume from the failure point. The user cannot inspect intermediate state.
**Instead:** Separate commands for each phase. `/dan:milestone` chains them but each phase is independently invocable.

### Anti-Pattern 4: Implicit Agent Selection
**What:** Letting Claude auto-delegate based on descriptions.
**Why bad:** Non-deterministic. The wrong agent might handle a task based on description similarity.
**Instead:** Commands explicitly spawn specific agents by name. No reliance on auto-delegation.

## Scalability Considerations

| Concern | Now (personal use) | If shared later |
|---------|--------------------|-----------------|
| State conflicts | N/A (single user) | Would need file locking or move to structured store |
| Agent definitions | Static markdown | Could generate from templates for project-specific tuning |
| Research quality | Human reviews synthesis | Would need automated quality scoring |
| Config format | Single JSON file | Would need validation, migration, defaults |

## Sources

- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents) -- HIGH confidence, official docs
- [Claude Code Slash Commands](https://code.claude.com/docs/en/slash-commands) -- HIGH confidence, official docs
- [Claude Code Skills](https://code.claude.com/docs/en/skills) -- HIGH confidence, official docs
- [PAUL Repository](https://github.com/ChristopherKahler/paul) -- HIGH confidence, source system
- [GSD Repository](https://github.com/gsd-build/get-shit-done) -- HIGH confidence, source system
- [GSD Documentation](https://github.com/gsd-build/get-shit-done/blob/main/docs/README.md) -- HIGH confidence, source docs
