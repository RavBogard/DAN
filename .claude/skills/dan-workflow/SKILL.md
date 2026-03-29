---
name: dan-workflow
description: "Core DAN workflow protocol and conventions injected into all agent contexts"
disable-model-invocation: true
---

# DAN Workflow Protocol

This skill defines the shared protocols and conventions that all DAN agents and skills follow. It is referenced via `agent-skills: [dan-workflow]` in skill frontmatter and injected into agent contexts automatically.

---

## 1. Loop Protocol

Every unit of work follows the PLAN -> APPLY -> UNIFY -> SUMMARY loop.

- **PLAN**: A PLAN.md file defines tasks, dependencies, verification, and success criteria.
- **APPLY**: Tasks are executed sequentially (or in dependency waves). Each task is committed atomically.
- **UNIFY**: After all tasks complete, a SUMMARY.md is produced that closes the loop.
- **SUMMARY**: The summary captures accomplishments, deviations, decisions, and metrics.

**No orphan plans.** Every PLAN.md must have a corresponding SUMMARY.md. A plan without a summary is incomplete work.

**No skipping unify.** Even if all tasks pass, the loop is not closed until SUMMARY.md exists and STATE.md is updated.

---

## 2. E/Q Protocol (Executor/Qualifier)

For plans requiring independent verification, the Executor and Qualifier operate as separate roles:

- **Executor**: Produces code, files, and artifacts. Has full tool access (Read, Write, Edit, Bash).
- **Qualifier**: Independently re-reads the output and grades it. Has **read-only** access (no Write tool).

### Qualification Statuses

| Status | Meaning | Action |
|--------|---------|--------|
| **PASS** | Output meets all criteria | Proceed to next task |
| **PASS_WITH_CONCERNS** | Output works but has minor issues | Log concerns, proceed |
| **NEEDS_REVISION** | Output has fixable problems | Executor revises, qualifier re-grades |
| **FAIL** | Output fundamentally wrong | Trigger diagnostic routing |

The qualifier never modifies files. The qualifier's judgment is based solely on reading the output and verification results.

---

## 3. Diagnostic Routing

When a task fails or produces incorrect output, classify the root cause **before** applying any fix:

| Root Cause | Description | Action |
|------------|-------------|--------|
| **Intent** | Wrong goal -- the plan targets the wrong thing | Escalate to user (checkpoint) |
| **Spec** | Wrong plan -- the task description is incorrect or incomplete | Revise task spec, re-execute |
| **Code** | Wrong implementation -- the code doesn't match the spec | Fix code, re-verify |

**Always classify first.** Fixing code when the spec is wrong wastes effort. Fixing the spec when the intent is wrong compounds the error.

---

## 4. State Protocol

All state reads and writes go through `dan-tools.cjs`. Never parse STATE.md with inline regex in agents.

```bash
# Read full state
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state read

# Get specific field
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state get "Status"

# Set specific field
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state set "Status" "In progress"

# Patch multiple fields
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR state patch '{"Status":"In progress","Plan":"2 of 4"}'

# Parse frontmatter from any file
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR frontmatter parse path/to/file.md

# Commit with structured result
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd $PROJECT_DIR commit "message" --files file1.md file2.md
```

**Why:** Regex parsing is fragile and duplicates logic. The CLI centralizes state format knowledge.

---

## 5. Two-Level Rule

DAN operates at exactly two levels:

- **Skills** orchestrate. They read state, decide what to do next, spawn agents, and update state.
- **Agents** execute. They receive a scoped task, produce output, and return. They do NOT spawn other agents.

**Agents MUST NOT spawn other agents.** If an agent needs work done by another agent, it returns to the skill level, which handles the orchestration.

**Why:** Nested agent spawning creates uncontrollable recursion, context fragmentation, and unpredictable costs. The two-level rule keeps the system debuggable.

---

## 6. Fresh Context Rule

Each agent gets a clean context window. State is passed via files, not agent memory.

- Agents do not inherit conversation history from the skill that spawned them.
- All context an agent needs must be passed via file paths in the agent prompt.
- Agents write their output to files. The skill reads those files after the agent completes.
- Session continuity across agents is maintained through STATE.md, not shared memory.

**Why:** Agent context windows are finite and degrade with length. Fresh context ensures each agent operates at peak quality. Files are the universal interface.
