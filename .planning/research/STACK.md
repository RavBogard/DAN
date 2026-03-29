# Technology Stack

**Project:** DAN (Development Autonomy Engine)
**Researched:** 2026-03-28

## Recommended Stack

### Core Platform: Claude Code Skill System

DAN lives entirely within Claude Code's extension ecosystem. There is no external framework, no build system, no package manager. The "stack" is Claude Code's native primitives.

| Layer | Technology | Purpose | Why |
|-------|-----------|---------|-----|
| Skills | `.claude/skills/<name>/SKILL.md` | User-invoked and model-invoked entry points | Current recommended format (replaces `.claude/commands/`). Supports frontmatter for invocation control, `context: fork` for subagent execution, supporting files, dynamic context injection via `!`backtick syntax`. HIGH confidence. |
| Subagents | `.claude/agents/<name>.md` | Specialized workers with isolated context | Fresh-context-per-agent architecture. Each agent gets own context window, custom system prompt, tool restrictions, model selection. Subagents cannot spawn other subagents (prevents infinite nesting). HIGH confidence. |
| Hooks | `settings.json` hooks config | Lifecycle automation | PreToolUse, PostToolUse, SubagentStart, SubagentStop events. Node.js scripts receive JSON via stdin, exit codes control flow (0=proceed, 2=block). HIGH confidence. |
| State | `.planning/` directory | Project memory and workflow state | Markdown + JSON files, git-tracked, human-readable. Both PAUL and GSD use this pattern successfully. HIGH confidence. |
| CLI Tools | Single `.cjs` file | State management, validation, scaffolding | Node.js built-ins only (no npm deps). GSD's `gsd-tools.cjs` is the proven pattern: one entry point, subcommand routing, JSON output for agent consumption. HIGH confidence. |
| Config | `.planning/config.json` | Per-project workflow preferences | JSON config for gates, parallelization, safety settings. Read by CLI tools and referenced in workflows. HIGH confidence. |
| Memory | `CLAUDE.md` files | Persistent context across sessions | Claude Code's native memory system. Loaded automatically at session start. HIGH confidence. |

### File Formats

| Format | Used For | Why |
|--------|----------|-----|
| Markdown with YAML frontmatter | Skills, subagents, plans, summaries | Claude Code's native format. Frontmatter for machine-parseable metadata, markdown body for instructions. Both PAUL and GSD use this extensively. |
| Semantic XML within Markdown | Workflow definitions | PAUL pattern: `<purpose>`, `<process>`, `<step>` elements structure workflow logic. More parseable than plain markdown for complex multi-step instructions. GSD also uses this for agent definitions. |
| JSON | Config, state snapshots, CLI output | Machine-readable state. `config.json` for preferences, CLI tool output as JSON for agent consumption, frontmatter extraction. |
| Plain Markdown | STATE.md, PROJECT.md, ROADMAP.md | Human-readable project state. Regex-parseable fields (`**Field:** value` pattern). |

### Skills (Entry Points)

Skills replace the older `.claude/commands/` pattern. Use skills for all DAN entry points.

| Field | Value | Notes |
|-------|-------|-------|
| Location | `~/.claude/skills/dan-<name>/SKILL.md` | Personal scope (all projects) |
| Naming | `dan:<action>` via `name` frontmatter | Namespace prevents collision with GSD/PAUL |
| Invocation control | `disable-model-invocation: true` for workflow commands | Prevent Claude from auto-triggering discuss, execute, etc. |
| Supporting files | `~/.claude/skills/dan-<name>/templates/`, `references/`, etc. | Keep SKILL.md under 500 lines, move detail to supporting files |
| Arguments | `$ARGUMENTS`, `$0`, `$1` etc. | Positional access for phase numbers, plan paths |
| Dynamic context | `` !`command` `` syntax | Inject state, config, git status before prompt reaches Claude |

**Key skill frontmatter fields for DAN:**

```yaml
---
name: dan:execute
description: Execute approved plans for current phase
argument-hint: "[phase] [--auto]"
disable-model-invocation: true
context: fork
agent: dan-executor
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Agent
---
```

### Subagents (Workers)

Each DAN workflow phase gets a dedicated subagent definition.

| Field | Value | Notes |
|-------|-------|-------|
| Location | `~/.claude/agents/dan-<role>.md` | Personal scope |
| Model selection | `model: inherit` for complex work, `model: haiku` for exploration | Cost/speed tradeoff per agent type |
| Tool restrictions | `tools:` allowlist per agent | Researcher gets Read-only; executor gets full access |
| Permission mode | `permissionMode: dontAsk` or `bypassPermissions` | For autonomous execution after human approval |
| Memory | `memory: user` for cross-project learning | Persistent memory at `~/.claude/agent-memory/dan-<role>/` |
| Max turns | `maxTurns: N` | Prevent runaway agents |
| Skills preloading | `skills: [dan-conventions, ...]` | Inject reference knowledge at subagent startup |
| Hooks | Subagent-scoped hooks in frontmatter | E.g., PostToolUse for context monitoring |

**Recommended subagent roster:**

| Agent | Model | Tools | Purpose |
|-------|-------|-------|---------|
| `dan-researcher` | haiku | Read, Grep, Glob, Bash(read-only) | Codebase exploration, research |
| `dan-planner` | inherit | Read, Grep, Glob, Write | Plan creation from research |
| `dan-executor` | inherit | All | Execute approved plans |
| `dan-qualifier` | inherit | Read, Grep, Glob, Bash | Independent re-read and verify (PAUL's E/Q pattern) |
| `dan-verifier` | sonnet | Read, Grep, Glob, Bash | Post-execution verification |
| `dan-auditor` | inherit | Read, Grep, Glob, Bash, Write | Bugsweep loop |

### CLI Tools

Single Node.js CJS file following GSD's proven pattern.

| Aspect | Recommendation | Why |
|--------|---------------|-----|
| Runtime | Node.js built-ins only | Project constraint: no npm dependencies |
| Format | Single `.cjs` entry point + `lib/` modules | GSD pattern: `dan-tools.cjs` routes to `lib/state.cjs`, `lib/phase.cjs`, etc. |
| Output | JSON to stdout for agent consumption | Agents parse structured output; `--raw` flag for key=value format |
| Error handling | stderr for errors, non-zero exit codes | Agents detect failures via exit codes |
| Commands | Subcommand routing: `node dan-tools.cjs <cmd> [args]` | Single tool, many operations |

**Core CLI subcommands needed:**

```
state load|update|get|patch    State management
phase find|add|complete        Phase operations
plan index|status              Plan inventory
config get|set                 Config management
verify summary|phase           Verification
commit <message>               Atomic planning commits
progress [format]              Progress rendering
loop position|advance          PAUL loop tracking
qualify check                  E/Q verification
```

### State Management

| File | Purpose | Format |
|------|---------|--------|
| `.planning/STATE.md` | Living project memory | Markdown with parseable fields |
| `.planning/PROJECT.md` | Project context, decisions | Markdown |
| `.planning/ROADMAP.md` | Phase structure | Markdown with phase sections |
| `.planning/REQUIREMENTS.md` | Scoped requirements | Markdown with REQ-XX IDs |
| `.planning/config.json` | Workflow preferences | JSON |
| `.planning/phases/NN-name/` | Per-phase plans and summaries | Directory structure |
| `.planning/research/` | Research artifacts | Markdown |
| `.planning/todos/` | Captured ideas | Markdown files |

**State field format** (regex-parseable):
```markdown
**Phase:** 3 of 7 (Authentication)
**Status:** In progress
**Loop position:** APPLY
**Last activity:** 2026-03-28 -- Completed plan 3.2
```

### Hooks

| Hook | Type | Purpose |
|------|------|---------|
| Context monitor | PostToolUse | Warn agents when context window is filling (GSD pattern) |
| Loop enforcer | PreToolUse | Prevent skipping PLAN/APPLY/UNIFY steps |
| Auto-commit | PostToolUse (Write/Edit) | Commit planning docs automatically |
| SubagentStart | SubagentStart | Log agent spawning, inject state |
| SubagentStop | SubagentStop | Collect results, update state |

Hooks are Node.js scripts in `~/.claude/hooks/` referenced from `settings.json`.

### Workflow Definitions

Workflows are the detailed "how to do it" logic. Stored as supporting files within skills.

| Aspect | Pattern | Source |
|--------|---------|--------|
| Structure | Semantic XML: `<purpose>`, `<process>`, `<step>` | PAUL proven pattern |
| Location | `~/.claude/skills/dan-<name>/workflows/` | Supporting files within skill directories |
| Delegation | Skills are thin wrappers, workflows contain logic | PAUL principle: commands answer "what", workflows answer "how" |
| Step format | `<step name="snake_case" priority="first">` | Named steps with optional priority hints |
| Conditionals | `<if autonomous="true">` blocks | Mode-dependent behavior |
| References | `@path/to/file` for context loading | Claude Code native reference syntax |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Entry points | Skills (`.claude/skills/`) | Commands (`.claude/commands/`) | Commands still work but skills are the current standard. Skills support directories of supporting files, invocation control, `context: fork`. Commands are legacy. |
| State format | Markdown + JSON in `.planning/` | SQLite / JSON-only | Project constraint: human-readable, git-trackable. Markdown is debuggable by reading files. SQLite adds complexity for no benefit at single-user scale. |
| CLI tools | Single CJS with lib modules | Multiple standalone scripts | GSD proved that centralizing CLI operations prevents duplication across 50+ workflow files. Single entry point, consistent output format. |
| Agent spawning | Subagents via Agent tool | Agent Teams | Agent Teams (Feb 2026) enable peer-to-peer communication between 2-16 persistent agents. Overkill for DAN's hub-and-spoke orchestration pattern. Subagents are simpler, proven, sufficient. |
| Workflow format | Semantic XML in Markdown | Pure Markdown / YAML | Both PAUL and GSD use XML-in-markdown. It provides structure (parseable step names, conditions) without requiring a separate format parser. |
| Config | JSON in `.planning/config.json` | YAML / TOML | JSON is natively parseable in Node.js, no dependencies needed. YAML would require a parser library (violates no-npm-deps constraint). |

## What NOT to Use

| Technology | Why Not |
|------------|---------|
| npm dependencies | Project constraint. Node.js built-ins are sufficient for file I/O, JSON parsing, path operations, git commands. |
| MCP servers | Explicitly out of scope for v1. Config file gets 80% of CARL's value with 10% complexity. |
| Agent Teams | Peer-to-peer model is wrong for DAN's hub-and-spoke orchestration. Subagents are the right primitive. |
| TypeScript for CLI tools | Adds build step. CJS runs directly with Node.js. GSD's 23K-line `gsd-tools.cjs` works fine without TypeScript. |
| `.claude/commands/` for new work | Legacy format. Skills subsume commands with additional capabilities. Existing command files keep working but new development should use skills. |
| Database (SQLite, etc.) | Violates file-based state constraint. Markdown + JSON is sufficient, git-trackable, human-debuggable. |
| External APIs for state | No external services constraint. Everything local, everything in files. |
| Complex templating engines | Overkill. String replacement (`$ARGUMENTS`, `` !`cmd` ``) and markdown templates are sufficient. |

## Installation

No installation step. DAN is a set of files deployed to `~/.claude/`:

```bash
# Skills (entry points)
~/.claude/skills/dan-discuss/SKILL.md
~/.claude/skills/dan-research/SKILL.md
~/.claude/skills/dan-plan/SKILL.md
~/.claude/skills/dan-execute/SKILL.md
~/.claude/skills/dan-verify/SKILL.md
~/.claude/skills/dan-audit/SKILL.md
# ... etc

# Subagents (workers)
~/.claude/agents/dan-researcher.md
~/.claude/agents/dan-planner.md
~/.claude/agents/dan-executor.md
~/.claude/agents/dan-qualifier.md
~/.claude/agents/dan-verifier.md
~/.claude/agents/dan-auditor.md

# CLI tools
~/.claude/dan/bin/dan-tools.cjs
~/.claude/dan/bin/lib/*.cjs

# Hooks
~/.claude/hooks/dan-context-monitor.js
~/.claude/hooks/dan-loop-enforcer.js

# References and templates (within skill directories)
~/.claude/skills/dan-execute/workflows/execute-phase.md
~/.claude/skills/dan-execute/templates/plan.md
# ... etc
```

## Key Design Principles (from PAUL + GSD analysis)

1. **Skills are thin, workflows are deep.** Skills answer "what to do" in one screen. Workflows answer "how to do it" comprehensively. (PAUL principle)

2. **Fresh context per agent.** Each subagent gets a clean context window with only what it needs. Prevents context pollution. (GSD principle)

3. **CLI tools centralize state operations.** One tool, many subcommands. Agents call the CLI for state reads/writes instead of parsing markdown directly. (GSD's `gsd-tools.cjs` pattern)

4. **Semantic XML structures workflow logic.** `<step>`, `<if>`, `<purpose>` elements make workflows parseable and organized without requiring a custom format. (PAUL + GSD pattern)

5. **State is always human-readable.** Every state file can be opened in a text editor and understood. No binary formats, no encoded state. (Both systems)

6. **Every loop must close.** PLAN -> APPLY -> UNIFY -> SUMMARY. No orphan plans, no skipped phases. (PAUL principle)

## Confidence Levels

| Area | Confidence | Rationale |
|------|------------|-----------|
| Skills as entry points | HIGH | Official Claude Code docs confirm skills are the current standard, subsuming commands |
| Subagents for workers | HIGH | Official docs, proven by GSD's agent roster |
| CLI tools pattern | HIGH | GSD's `gsd-tools.cjs` (23K lines) is battle-tested across dozens of workflow files |
| Semantic XML in workflows | HIGH | Both PAUL and GSD use this pattern extensively and successfully |
| File-based state in `.planning/` | HIGH | Both systems prove this works. Project constraint confirms it. |
| Hooks for lifecycle | HIGH | Official Claude Code docs, GSD's context monitor hook is proven |
| Skills supporting files layout | MEDIUM | Official docs describe it but the exact organization for a system this complex needs iteration |
| Subagent memory for cross-session learning | MEDIUM | Feature exists per docs, but effectiveness for workflow state accumulation is unproven |

## Sources

- [Claude Code Skills Documentation](https://code.claude.com/docs/en/skills) - Official, current
- [Claude Code Subagents Documentation](https://code.claude.com/docs/en/sub-agents) - Official, current
- [Claude Code Hooks Guide](https://code.claude.com/docs/en/hooks-guide) - Official, current
- GSD source: `~/.claude/get-shit-done/` - Direct analysis of installed system
- PAUL source: `~/.claude/paul-framework/` - Direct analysis of installed system
- GSD CLI tools: `~/.claude/get-shit-done/bin/gsd-tools.cjs` - Direct analysis
- GSD hooks: `~/.claude/hooks/gsd-context-monitor.js` - Direct analysis
