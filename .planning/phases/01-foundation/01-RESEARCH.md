# Phase 1: Foundation - Research

**Researched:** 2026-03-28
**Domain:** Claude Code skill system, CLI tools (Node.js), file-based state management
**Confidence:** HIGH

## Summary

Phase 1 builds the substrate every other DAN component depends on: CLI tools for atomic state operations, skill entry points for user invocation, agent definitions for worker spawning, and state file schemas that define the contract between all components. The primary reference implementation is GSD's `gsd-tools.cjs` (592-line router + 5,421 lines across 11 lib modules), which proves the single-CJS-entry-point pattern with subcommand routing and JSON output for agent consumption.

The critical insight from analyzing GSD's actual code: its "atomic writes" are just `fs.writeFileSync` -- not temp-file-plus-rename. For DAN, which explicitly lists atomic writes as a requirement (FOUND-01, FOUND-03), we should implement the true atomic pattern (write to `.tmp` suffix, then `fs.renameSync`) since Node.js `rename` on the same filesystem is atomic on both POSIX and Windows NTFS. This is cheap insurance against the documented Claude Code race condition issue #28847.

The skill system is well-understood: SKILL.md files with YAML frontmatter live in `~/.claude/skills/dan-*/`, agent definitions in `~/.claude/agents/dan-*.md` with tool restrictions and model selection in frontmatter. GSD's agents demonstrate the exact pattern -- skills referenced via `skills:` frontmatter in agent definitions inject shared context. The two-level orchestration model (skills orchestrate, agents execute) is a hard constraint from Claude Code's architecture.

**Primary recommendation:** Build dan-tools.cjs first with the lib/ module pattern from GSD. Define state file schemas as the first deliverable since every other component reads/writes them. Skills and agents are scaffolding that references the CLI tools and state schemas.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FOUND-01 | CLI tools library (dan-tools.cjs) with atomic state read/write and JSON output | GSD's gsd-tools.cjs is the direct template: 592-line router dispatching to 11 lib modules. DAN needs core.cjs, state.cjs, config.cjs, phase.cjs, template.cjs, frontmatter.cjs at minimum. Add true atomic writes (temp+rename) which GSD lacks. |
| FOUND-02 | CLI tools handle template filling from `.planning/` templates | GSD's template.cjs (222 lines) demonstrates the pattern: `template fill <type> --phase N --plan M` generates pre-filled PLAN.md/SUMMARY.md with frontmatter and body scaffolding. |
| FOUND-03 | CLI tools provide atomic git commit operations | GSD's commands.cjs `cmdCommit` (46 lines): stage files, commit with message, return JSON `{committed, hash, reason}`. Respects `commit_docs` config flag and checks gitignore. |
| FOUND-04 | CLI tools provide dependency analysis for plan execution ordering | Not present in GSD -- this is new for DAN. Needs a `depends_on` field in plan frontmatter and a topological sort to determine execution order. Standard algorithm, Node.js built-in capable. |
| FOUND-05 | File-based state in `.planning/` with defined schemas | GSD's STATE.md uses `**Field:** value` regex-parseable format with frontmatter sync. DAN needs: PROJECT.md (project context), STATE.md (position tracking), ROADMAP.md (phase structure), dan.config.json (preferences). All patterns verified in GSD. |
| FOUND-06 | State files are human-readable markdown + JSON, git-tracked | Inherent in the design. Markdown bodies with YAML frontmatter for machine parsing. JSON for config. GSD proves this works across 82+ markdown files. |
| FOUND-07 | ~12 skill entry points installed under `.claude/skills/dan-*/` | Skill format verified: SKILL.md with `name`, `description`, `argument-hint`, `disable-model-invocation`, `context` frontmatter fields. Supporting files in subdirectories. GSD uses agents not skills for workflows, but the ui-ux-pro-max skill demonstrates the format. |
| FOUND-08 | ~7 subagent definitions installed under `.claude/agents/` | Agent format verified from 12 GSD agents: frontmatter with `name`, `description`, `tools`, `color`, `skills` fields. Body contains role definition in `<role>` tags, execution flow in `<step>` tags. |
| FOUND-09 | Two-level agent hierarchy enforced | Hard constraint from Claude Code: subagents cannot spawn other subagents. GSD enforces this -- all workflow orchestration happens in the top-level conversation, agents are leaf workers. |
| FOUND-10 | Progress tracking in STATE.md with atomic updates per task | GSD's state.cjs provides `cmdStateAdvancePlan`, `cmdStateRecordMetric`, `cmdStateUpdateProgress`. Pattern: read STATE.md, regex-replace field values, write back atomically. |
| FOUND-11 | dan.config.json stores simplified preferences | GSD's core.cjs `loadConfig` (60 lines): read JSON, apply defaults, handle nested sections, support migration. DAN's config is simpler: mode, granularity, autonomy_level, model_profile. |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins (fs, path, child_process, os) | Node 22+ | All file I/O, process execution, path handling | Project constraint: zero npm dependencies |
| Claude Code Skills | Current | User-facing entry points with frontmatter | Official Claude Code extension mechanism, replaces commands |
| Claude Code Agents | Current | Worker definitions with tool restrictions | Official subagent spawning, fresh-context isolation |
| JSON | Native | Config files, CLI output, structured state | Built into Node.js, no parser needed |
| YAML frontmatter (hand-parsed) | N/A | Skill/agent/plan metadata | GSD's frontmatter.cjs (299 lines) implements a complete YAML-subset parser with nested objects and arrays |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `child_process.execSync` | Node built-in | Git operations | All commit, staging, and status operations |
| `fs.renameSync` | Node built-in | Atomic file writes | Every state file write (temp+rename pattern) |
| `path.join` / `path.resolve` | Node built-in | Cross-platform paths | All file path construction |
| `os.tmpdir()` | Node built-in | Temp file location | Large JSON output (>50KB) written to temp files |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-parsed YAML | js-yaml npm package | Violates no-npm-deps constraint. GSD proves hand-parsing works for the subset needed (key-value, arrays, nested objects) |
| fs.writeFileSync (GSD approach) | temp+rename atomic writes | GSD takes the simpler path but DAN requirements explicitly call for atomic writes. Small implementation cost for corruption prevention. |
| Single monolithic CJS | Multiple standalone scripts | GSD proved centralization prevents duplication across 50+ workflow files. One entry point, consistent output format. |

**Installation:**
```bash
# No npm install. Files are deployed directly:
cp -r dan-tools/ ~/.claude/dan/
cp -r skills/ ~/.claude/skills/
cp -r agents/ ~/.claude/agents/
```

## Architecture Patterns

### Recommended Project Structure

```
~/.claude/
  dan/
    bin/
      dan-tools.cjs          # CLI router (main entry point)
      lib/
        core.cjs              # Shared utilities, output helpers, path normalization
        state.cjs             # STATE.md read/write/patch/advance operations
        config.cjs            # dan.config.json load/get/set with defaults
        phase.cjs             # Phase directory operations, find, complete
        template.cjs          # Template filling for plans/summaries
        frontmatter.cjs       # YAML frontmatter parse/serialize/CRUD
        commit.cjs            # Git commit operations (atomic)
        dependency.cjs        # Plan dependency analysis and topological sort
    templates/
      plan.md                 # Plan template with frontmatter skeleton
      summary.md              # Summary template
      state.md                # STATE.md initial template
      project.md              # PROJECT.md initial template
      config.json             # dan.config.json defaults

  skills/
    dan-init/
      SKILL.md                # /dan:init entry point
    dan-discuss/
      SKILL.md                # /dan:discuss entry point
    dan-research/
      SKILL.md                # /dan:research entry point
    dan-plan/
      SKILL.md                # /dan:plan entry point
    dan-apply/
      SKILL.md                # /dan:apply entry point
    dan-unify/
      SKILL.md                # /dan:unify entry point
    dan-verify/
      SKILL.md                # /dan:verify entry point
    dan-bugsweep/
      SKILL.md                # /dan:bugsweep entry point
    dan-milestone/
      SKILL.md                # /dan:milestone entry point
    dan-status/
      SKILL.md                # /dan:status entry point
    dan-pause/
      SKILL.md                # /dan:pause entry point
    dan-resume/
      SKILL.md                # /dan:resume entry point

  agents/
    dan-researcher.md         # Research agent (haiku model, read-only tools)
    dan-synthesizer.md        # Research synthesis agent
    dan-planner.md            # Plan generation agent
    dan-executor.md           # Plan execution agent (full tools)
    dan-qualifier.md          # E/Q qualification agent (read-only)
    dan-verifier.md           # Verification agent
    dan-auditor.md            # Bugsweep agent
```

### Per-Project State Structure

```
.planning/
  PROJECT.md                  # Project context, requirements, decisions
  ROADMAP.md                  # Phase structure with ordering
  STATE.md                    # Current position, progress, session continuity
  REQUIREMENTS.md             # Scoped requirements with IDs
  dan.config.json             # Preferences (mode, granularity, model_profile)
  research/                   # Research artifacts
    SUMMARY.md
    STACK.md
    ARCHITECTURE.md
    PITFALLS.md
    FEATURES.md
  phases/
    01-foundation/
      01-01-PLAN.md
      01-01-SUMMARY.md
    02-core-loop/
      02-01-PLAN.md
      ...
```

### Pattern 1: CLI Subcommand Router

**What:** Single CJS entry point dispatches to lib modules based on first argument.
**When to use:** All CLI tool invocations from agents and skills.
**Example:**

```javascript
// Source: GSD's gsd-tools.cjs pattern (verified from installed source)
#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { error } = require('./lib/core.cjs');
const state = require('./lib/state.cjs');
const config = require('./lib/config.cjs');

function main() {
  const args = process.argv.slice(2);

  // --cwd override for sandboxed subagents
  let cwd = process.cwd();
  const cwdIdx = args.indexOf('--cwd');
  if (cwdIdx !== -1) {
    cwd = path.resolve(args[cwdIdx + 1]);
    args.splice(cwdIdx, 2);
  }

  const rawIndex = args.indexOf('--raw');
  const raw = rawIndex !== -1;
  if (rawIndex !== -1) args.splice(rawIndex, 1);

  const command = args[0];
  switch (command) {
    case 'state': state.handle(cwd, args.slice(1), raw); break;
    case 'config': config.handle(cwd, args.slice(1), raw); break;
    // ... more subcommands
    default: error(`Unknown command: ${command}`);
  }
}

main();
```

### Pattern 2: Atomic File Write

**What:** Write to temp file, then rename. Prevents corruption if process is interrupted.
**When to use:** Every write to STATE.md, dan.config.json, or any shared state file.
**Example:**

```javascript
// DAN-specific: GSD uses plain writeFileSync, DAN adds atomic guarantee
function atomicWriteFileSync(filePath, content) {
  const tmpPath = filePath + '.tmp.' + process.pid;
  fs.writeFileSync(tmpPath, content, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}
```

### Pattern 3: State Field Regex Parsing

**What:** Parse `**Field:** value` patterns from markdown state files.
**When to use:** Reading STATE.md fields without a full markdown parser.
**Example:**

```javascript
// Source: GSD's state.cjs stateExtractField (verified)
function extractField(content, fieldName) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const boldPattern = new RegExp(`\\*\\*${escaped}:\\*\\*\\s*(.+)`, 'i');
  const boldMatch = content.match(boldPattern);
  if (boldMatch) return boldMatch[1].trim();
  const plainPattern = new RegExp(`^${escaped}:\\s*(.+)`, 'im');
  const plainMatch = content.match(plainPattern);
  return plainMatch ? plainMatch[1].trim() : null;
}
```

### Pattern 4: JSON Output with Large Payload Handling

**What:** CLI tools output JSON to stdout. Payloads >50KB go to temp files with `@file:` prefix.
**When to use:** All CLI tool output consumed by agents.
**Example:**

```javascript
// Source: GSD's core.cjs output function (verified)
function output(result, raw, rawValue) {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue));
  } else {
    const json = JSON.stringify(result, null, 2);
    if (json.length > 50000) {
      const tmpPath = path.join(require('os').tmpdir(), `dan-${Date.now()}.json`);
      fs.writeFileSync(tmpPath, json, 'utf-8');
      process.stdout.write('@file:' + tmpPath);
    } else {
      process.stdout.write(json);
    }
  }
  process.exit(0);
}
```

### Pattern 5: Skill Frontmatter

**What:** YAML frontmatter in SKILL.md controls invocation behavior.
**When to use:** Every DAN skill entry point.
**Example:**

```yaml
---
name: dan:plan
description: Create executable plan for current phase
argument-hint: "[phase-number]"
disable-model-invocation: true
---
```

Key fields:
- `name`: How the skill appears in `/dan:plan` autocomplete
- `description`: Used for model-invocable skills (discovery)
- `argument-hint`: Shows user what arguments are accepted
- `disable-model-invocation: true`: Prevent Claude from auto-triggering workflow commands
- `context: fork`: Run in a separate subagent context (for isolation)

### Pattern 6: Agent Definition with Tool Restrictions

**What:** Agent markdown with frontmatter defining tools, model, and skill injection.
**When to use:** Every DAN subagent definition.
**Example:**

```yaml
---
name: dan-qualifier
description: Independent re-read and qualify against spec (PAUL E/Q pattern)
tools: Read, Grep, Glob, Bash
color: blue
skills:
  - dan-workflow
---
```

The body contains the agent's role and execution instructions using semantic XML tags (`<role>`, `<step>`, `<execution_flow>`).

### Pattern 7: Dependency Analysis (Topological Sort)

**What:** Read `depends_on` from plan frontmatter, build DAG, return execution order.
**When to use:** FOUND-04 requirement -- determining plan execution ordering.
**Example:**

```javascript
// New for DAN -- not in GSD
function topologicalSort(plans) {
  // plans: [{id, depends_on: []}]
  const visited = new Set();
  const order = [];
  const visiting = new Set(); // cycle detection

  function visit(id) {
    if (visited.has(id)) return;
    if (visiting.has(id)) throw new Error(`Circular dependency: ${id}`);
    visiting.add(id);
    const plan = plans.find(p => p.id === id);
    if (plan) {
      for (const dep of plan.depends_on || []) {
        visit(dep);
      }
    }
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  }

  for (const plan of plans) visit(plan.id);
  return order;
}
```

### Anti-Patterns to Avoid

- **Fat agents:** Do not put orchestration logic (sequencing, state transitions, agent spawning) in agent definitions. Agents are leaf workers. Skills are orchestrators.
- **State in agent memory:** Never use Claude Code `memory:` frontmatter for workflow state. Memory is for cross-session learning, not transactional state.
- **Direct state file parsing in agents:** Agents should call `dan-tools.cjs state get <field>` instead of parsing STATE.md with inline regex. Centralizes the parsing logic.
- **Monolithic commands:** Do not create a single `/dan:run` that does everything. Each phase is independently invocable.
- **Implicit agent selection:** Commands explicitly spawn agents by name. Never rely on Claude's auto-delegation based on description matching.
- **Nested agent spawning:** Never design a workflow where an agent spawns another agent. Two levels only: skill/command -> agent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML frontmatter parsing | Custom tokenizer/lexer | GSD's frontmatter.cjs pattern (regex-based, 299 lines) | Handles the YAML subset actually used: key-value, arrays, nested objects. Full YAML parsing is massively complex. |
| Git operations | Shell command string building | `execGit(cwd, argsArray)` wrapper pattern from GSD's core.cjs | Handles escaping, error codes, stdout/stderr capture. 20 lines that prevent shell injection. |
| State field extraction | Full markdown AST parser | Regex `**Field:** value` pattern from GSD's state.cjs | State files use a deliberately simple format. Regex is correct and sufficient. |
| Config with defaults | Custom merge logic | GSD's `loadConfig` pattern with explicit defaults object | Handles missing file, nested sections, migration of deprecated keys. 60 lines of proven code. |
| Phase directory lookup | glob/find commands | GSD's `findPhaseInternal` with normalized phase names | Handles padding (1 -> 01), decimal phases (2.1), letter phases (12A), archived milestones. |
| Progress bar rendering | ASCII art library | Simple `[====.....]` string generation | 10 lines. No dependency needed. |

**Key insight:** GSD's 6,000+ lines of lib code represent solved problems. DAN should adapt these patterns, not reinvent them. The only genuinely new code is the dependency analysis (topological sort) and the atomic write wrapper.

## Common Pitfalls

### Pitfall 1: Non-Atomic State Writes Cause Corruption

**What goes wrong:** Two agents write to STATE.md simultaneously, or a process is interrupted mid-write, leaving truncated content.
**Why it happens:** GSD uses plain `writeFileSync` which is not atomic. Claude Code issue #28847 documents concurrent file corruption.
**How to avoid:** Implement temp-file-plus-rename for all state writes. `writeFileSync(path + '.tmp.' + pid)` then `renameSync`.
**Warning signs:** Truncated JSON, empty STATE.md, missing fields that were previously present.

### Pitfall 2: Windows Path Separator Issues

**What goes wrong:** Paths built with `path.join` on Windows use backslashes, but git and Claude Code expect forward slashes.
**Why it happens:** Node.js `path.join` uses OS-native separators.
**How to avoid:** Use GSD's `toPosixPath()` helper: `p.split(path.sep).join('/')` for all paths that appear in output, state files, or git commands.
**Warning signs:** Git commands failing with "pathspec did not match," file-not-found errors on paths that exist.

### Pitfall 3: Large CLI Output Exceeds Bash Tool Buffer

**What goes wrong:** Agent calls `dan-tools.cjs` and gets truncated output because the JSON exceeds Claude Code's ~50KB Bash tool buffer.
**Why it happens:** State snapshots, plan indexes, or history digests can produce large JSON.
**How to avoid:** GSD's pattern: if `JSON.stringify` output > 50,000 chars, write to temp file and output `@file:/path`. Callers check for `@file:` prefix and use `cat` to read.
**Warning signs:** JSON parse errors in agents, truncated output, missing closing braces.

### Pitfall 4: Skill Frontmatter Field Errors

**What goes wrong:** A skill doesn't appear in autocomplete, or Claude auto-triggers a workflow command at wrong times.
**Why it happens:** Missing `name` field (no autocomplete), missing `disable-model-invocation: true` (auto-trigger), wrong `argument-hint` format.
**How to avoid:** Test each skill's discoverability after creation. Verify `disable-model-invocation: true` on all workflow skills (init, plan, apply, etc.). Only leave it off for informational skills (status).
**Warning signs:** Skills not appearing in `/dan:` autocomplete, Claude triggering `/dan:apply` unprompted.

### Pitfall 5: Agent Tool Restrictions Too Tight or Too Loose

**What goes wrong:** Qualifier agent has Write tool access (defeats independence). Executor agent lacks Bash access (can't run tests).
**Why it happens:** Copy-paste errors in agent frontmatter `tools:` field.
**How to avoid:** Define tool restrictions per agent role upfront. Qualifier/verifier: Read, Grep, Glob, Bash (read-only). Executor: full access. Researcher: Read, Grep, Glob, WebSearch.
**Warning signs:** Qualifier modifying files it's reviewing, executor failing on test commands.

### Pitfall 6: Forgetting --cwd in Subagent Bash Calls

**What goes wrong:** Subagent's working directory is reset between Bash calls, so `dan-tools.cjs` runs in the wrong directory.
**Why it happens:** Claude Code subagents don't maintain cwd across Bash invocations.
**How to avoid:** Always use absolute paths or pass `--cwd` to dan-tools.cjs. GSD implements this: `node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd /abs/path state load`.
**Warning signs:** "STATE.md not found" errors in subagents that work fine in the main conversation.

## Code Examples

### STATE.md Schema

```markdown
# Project State

## Project Reference

See: .planning/PROJECT.md (updated YYYY-MM-DD)

**Core value:** [from PROJECT.md]
**Current focus:** Phase N - [Name]

## Current Position

Phase: N of M ([Name])
Plan: X of Y in current phase
Status: [Ready to plan | In progress | Phase complete]
Last activity: YYYY-MM-DD -- [description]

Progress: [=====.....] XX%

## Performance Metrics

**Velocity:**
- Total plans completed: N
- Average duration: Xmin
- Total execution time: X hours

## Accumulated Context

### Decisions

- [Phase N]: [decision description]

### Pending Todos

- [todo item]

### Blockers/Concerns

- [blocker description]

## Session Continuity

Last session: YYYY-MM-DD
Stopped at: [description]
Resume file: [path or None]
```

### dan.config.json Schema

```json
{
  "mode": "yolo",
  "granularity": "standard",
  "autonomy_level": "milestone",
  "model_profile": "quality",
  "commit_docs": true,
  "workflow": {
    "research": true,
    "plan_check": true,
    "verifier": true,
    "nyquist_validation": true
  }
}
```

Fields:
- `mode`: "yolo" (minimal prompts) | "careful" (confirm before major actions)
- `granularity`: "coarse" (fewer, larger tasks) | "standard" | "fine" (more, smaller tasks)
- `autonomy_level`: "task" | "plan" | "phase" | "milestone" (how far to run without stopping)
- `model_profile`: "quality" (opus everywhere) | "balanced" (opus for complex, sonnet for standard) | "budget" (haiku where possible)
- `commit_docs`: whether to git-commit planning docs automatically
- `workflow.*`: toggle individual workflow steps

### Git Commit Pattern

```javascript
// Source: Adapted from GSD's commands.cjs cmdCommit
function cmdCommit(cwd, message, files, raw) {
  const config = loadConfig(cwd);
  if (!config.commit_docs) {
    return output({ committed: false, reason: 'skipped_commit_docs_false' }, raw);
  }

  // Stage specific files (never `git add .`)
  const filesToStage = files.length > 0 ? files : ['.planning/'];
  for (const file of filesToStage) {
    execGit(cwd, ['add', file]);
  }

  const result = execGit(cwd, ['commit', '-m', message]);
  if (result.exitCode !== 0) {
    if (result.stdout.includes('nothing to commit') || result.stderr.includes('nothing to commit')) {
      return output({ committed: false, reason: 'nothing_to_commit' }, raw);
    }
    return output({ committed: false, reason: 'commit_failed', error: result.stderr }, raw);
  }

  const hash = execGit(cwd, ['rev-parse', '--short', 'HEAD']);
  output({ committed: true, hash: hash.stdout, reason: 'committed' }, raw);
}
```

### execGit Wrapper Pattern

```javascript
// Source: GSD's core.cjs (verified) - safe git command execution
function execGit(cwd, args) {
  try {
    const escaped = args.map(a => {
      if (/^[a-zA-Z0-9._\-/=:@]+$/.test(a)) return a;
      return "'" + a.replace(/'/g, "'\\''") + "'";
    });
    const stdout = require('child_process').execSync(
      'git ' + escaped.join(' '),
      { cwd, stdio: 'pipe', encoding: 'utf-8' }
    );
    return { exitCode: 0, stdout: stdout.trim(), stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status || 1,
      stdout: (err.stdout || '').toString().trim(),
      stderr: (err.stderr || '').toString().trim(),
    };
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `.claude/commands/` | `.claude/skills/` | 2025 | Skills support frontmatter, directories, invocation control. Commands still work but skills are recommended. |
| Agent Teams (peer-to-peer) | Subagents (hub-and-spoke) | Feb 2026 | Agent Teams exist but are overkill for DAN's orchestration pattern. Subagents are simpler and proven. |
| Direct state file parsing in agents | CLI tools with JSON output | GSD v2 (2025) | Centralizes parsing logic, prevents regex duplication across 50+ files. |
| Single context window | Fresh context per agent | GSD/PAUL 2025 | Quality degrades at 20-40% context. Fresh context per phase is non-negotiable. |

**Deprecated/outdated:**
- `.claude/commands/`: Still functional but `.claude/skills/` is the current standard with more capabilities
- Global CLAUDE.md for workflow rules: Use skills injection instead -- scopes rules to specific agents

## Open Questions

1. **Skill `context: fork` behavior for orchestrator skills**
   - What we know: `context: fork` runs the skill in a subagent. GSD's workflows run in-session.
   - What's unclear: Should DAN orchestrator skills (plan, apply) use `context: fork` or run in the main conversation?
   - Recommendation: Run orchestrator skills in-session (no `context: fork`). They need to spawn subagents, which requires being in the main conversation. Only use `context: fork` for leaf operations that benefit from isolation.

2. **Skills referencing in agent `skills:` frontmatter**
   - What we know: GSD agents reference skills like `skills: [gsd-executor-workflow]` but no corresponding SKILL.md files exist in `~/.claude/skills/`.
   - What's unclear: How Claude Code resolves skill references in agent frontmatter when no SKILL.md exists.
   - Recommendation: Create actual SKILL.md files for any skill referenced in agent frontmatter. The `dan-workflow` skill should exist as `~/.claude/skills/dan-workflow/SKILL.md` with loop protocol, E/Q spec, and diagnostic routing as referenced content.

3. **Template directory location**
   - What we know: GSD stores templates in `~/.claude/get-shit-done/templates/`. Skills support `~/.claude/skills/<name>/templates/`.
   - What's unclear: Whether templates used by CLI tools should live with the CLI tools or within skill directories.
   - Recommendation: Templates used by `dan-tools.cjs template fill` should live with the CLI tools at `~/.claude/dan/templates/`. Skill-specific templates (workflow instructions) live within skill directories.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in `node:test` + `node:assert` (Node 22+) |
| Config file | None needed -- `node:test` works out of the box |
| Quick run command | `node --test ~/.claude/dan/tests/` |
| Full suite command | `node --test ~/.claude/dan/tests/ --test-reporter spec` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| FOUND-01 | CLI tools read/write state atomically with JSON output | unit | `node --test tests/test-state.cjs` | -- Wave 0 |
| FOUND-02 | Template filling produces valid plan/summary files | unit | `node --test tests/test-template.cjs` | -- Wave 0 |
| FOUND-03 | Git commit operations work atomically | integration | `node --test tests/test-commit.cjs` | -- Wave 0 |
| FOUND-04 | Dependency analysis returns correct topological order | unit | `node --test tests/test-dependency.cjs` | -- Wave 0 |
| FOUND-05 | State file schemas parse correctly | unit | `node --test tests/test-schemas.cjs` | -- Wave 0 |
| FOUND-06 | State files are valid markdown/JSON | unit | `node --test tests/test-schemas.cjs` | -- Wave 0 |
| FOUND-07 | Skill SKILL.md files have valid frontmatter | smoke | `node --test tests/test-skills.cjs` | -- Wave 0 |
| FOUND-08 | Agent .md files have valid frontmatter and tool restrictions | smoke | `node --test tests/test-agents.cjs` | -- Wave 0 |
| FOUND-09 | No agent definition references agent spawning | smoke | `node --test tests/test-agents.cjs` | -- Wave 0 |
| FOUND-10 | Progress tracking updates STATE.md correctly | unit | `node --test tests/test-state.cjs` | -- Wave 0 |
| FOUND-11 | dan.config.json loads with defaults and handles missing file | unit | `node --test tests/test-config.cjs` | -- Wave 0 |

### Sampling Rate

- **Per task commit:** `node --test ~/.claude/dan/tests/`
- **Per wave merge:** `node --test ~/.claude/dan/tests/ --test-reporter spec`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps

- [ ] `~/.claude/dan/tests/test-state.cjs` -- covers FOUND-01, FOUND-05, FOUND-06, FOUND-10
- [ ] `~/.claude/dan/tests/test-template.cjs` -- covers FOUND-02
- [ ] `~/.claude/dan/tests/test-commit.cjs` -- covers FOUND-03
- [ ] `~/.claude/dan/tests/test-dependency.cjs` -- covers FOUND-04
- [ ] `~/.claude/dan/tests/test-config.cjs` -- covers FOUND-11
- [ ] `~/.claude/dan/tests/test-skills.cjs` -- covers FOUND-07
- [ ] `~/.claude/dan/tests/test-agents.cjs` -- covers FOUND-08, FOUND-09
- [ ] `~/.claude/dan/tests/test-schemas.cjs` -- covers FOUND-05, FOUND-06
- [ ] Framework: Node 22+ `node:test` -- no install needed, verify with `node --version`

## Sources

### Primary (HIGH confidence)
- GSD source: `~/.claude/get-shit-done/bin/gsd-tools.cjs` -- CLI router pattern, subcommand structure (592 lines)
- GSD lib modules: `~/.claude/get-shit-done/bin/lib/*.cjs` -- state management, config, frontmatter, template patterns (5,421 lines total)
- GSD agents: `~/.claude/agents/gsd-*.md` -- Agent definition format with frontmatter (12 agents)
- Claude Code skills: `~/.claude/skills/ui-ux-pro-max/SKILL.md` -- Skill SKILL.md format with frontmatter
- Project research: `.planning/research/STACK.md`, `ARCHITECTURE.md`, `PITFALLS.md` -- Stack decisions, architecture patterns, known risks

### Secondary (MEDIUM confidence)
- Claude Code Race Condition Issue #28847 -- File corruption in concurrent writes (referenced in PITFALLS.md)
- Context degradation at 20-40% usage (referenced in SUMMARY.md from The New Stack article)

### Tertiary (LOW confidence)
- Node.js `fs.renameSync` atomicity on Windows NTFS -- Generally documented as atomic for same-filesystem renames, but edge cases may exist with antivirus software intercepting file operations

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components verified against installed GSD source and Claude Code docs
- Architecture: HIGH - Two-level model is a hard constraint, file layout matches proven GSD pattern
- Pitfalls: HIGH - Every pitfall sourced from real GSD/PAUL operational data or documented Claude Code issues
- Dependency analysis: MEDIUM - Standard topological sort algorithm, but the `depends_on` frontmatter field format needs definition during implementation

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable domain, patterns unlikely to change)
