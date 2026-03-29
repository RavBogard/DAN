# DAN

## What This Is

A personal Claude Code skill set that combines the best of PAUL, CARL, and GSD into a single autonomous development workflow engine. DAN front-loads human thinking through deep recursive research and thorough discuss phases, then executes the full development pipeline (research, plan, apply, unify, verify, bugsweep) autonomously without human intervention. Built for one user, optimized for quality through exhaustive upfront alignment.

## Core Value

Research 5x, build once. Human labor happens upfront in deep discussion and recursive research. Everything after approval is autonomous.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Recursive research system that runs multiple passes (research → synthesize → find gaps → research again) until confident
- [ ] Deep discuss/interview phase that surfaces decisions, tradeoffs, and assumptions before any planning begins
- [ ] PAUL-style Plan → Apply → Unify loop with mandatory closure
- [ ] Execute/Qualify pattern from PAUL — independent re-read and qualify step after each task
- [ ] GSD-style fresh-context-per-agent architecture — specialized agents with clean context windows
- [ ] Wave-based parallel execution with dependency analysis (from GSD)
- [ ] Autonomous verification that checks against phase goals without human intervention
- [ ] Recursive bugsweep/audit loop that finds issues, fixes them, re-verifies, and loops until all green
- [ ] CLI tools library for state management, atomic commits, template filling, dependency analysis
- [ ] File-based state in `.planning/` — human-readable markdown + JSON, git-tracked
- [ ] Milestone-level and roadmap-level autonomy gates — approve scope, then DAN runs everything
- [ ] Simplified preferences/config system (config file, not full CARL injection system)
- [ ] Session management — pause/resume with full context restoration across sessions
- [ ] Diagnostic failure routing from PAUL — classify root cause before fixing (intent vs spec vs code issue)

### Out of Scope

- MCP server for rule management — overcomplicates v1 for a single user
- Dynamic rule injection hook system (full CARL) — bake preferences into workflow definitions instead
- Multi-runtime support — Claude Code only, no need for OpenCode/Gemini/Codex adapters
- Publishing/packaging as npm module — personal tool, not a product
- UI design phases (GSD's ui-phase/ui-review) — can add later if needed
- Enterprise features (team state, multi-user, permissions)

## Context

DAN draws from three existing systems:
- **PAUL** (Plan-Apply-Unify Loop) — disciplined loop structure, E/Q qualify step, acceptance-driven development, in-session quality focus, diagnostic failure routing
- **CARL** (Context Augmentation & Reinforcement Layer) — dynamic rule injection concept, context-aware behavior adaptation (simplified for DAN)
- **GSD** (Get Shit Done) — fresh-context-per-agent architecture, wave parallelization, 4-researcher project init (extended to recursive), specialized agent types, file-based state

Key repos:
- https://github.com/ChristopherKahler/paul
- https://github.com/ChristopherKahler/carl
- https://github.com/gsd-build/get-shit-done

Design philosophy: front-load human effort in discussion and research phases. Once aligned, the system executes autonomously through plan → apply → unify → verify → bugsweep without stopping for human input. Autonomy gates exist at milestone or roadmap level — not per-phase.

## Constraints

- **Runtime**: Claude Code only — installed as commands/workflows/agents under `~/.claude/`
- **State**: File-based in `.planning/` directory — no databases, no external services
- **Dependencies**: Node.js built-ins only for CLI tools (no npm dependencies)
- **Architecture**: Thin orchestrators that spawn specialized agents with fresh context
- **Quality**: Every loop must close (PLAN → APPLY → UNIFY → SUMMARY). No orphan plans.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Skip MCP server for v1 | Config file gets 80% of value with 10% of complexity for single user | — Pending |
| Skip full CARL rule injection | Bake preferences into workflow definitions; add config layer later if needed | — Pending |
| Recursive research (not single-pass) | "Research 5x, build once" — cost of research rounds is nothing vs rework from bad assumptions | — Pending |
| Milestone-level autonomy gates | Human labor upfront, autonomous execution after. Per-phase approval is too interruptive | — Pending |
| CLI tools library included | State management bugs silently corrupt workflows; thin CLI layer prevents that | — Pending |
| Claude Code only | Personal tool, no need for multi-runtime abstraction overhead | — Pending |

---
*Last updated: 2026-03-28 after initialization*
