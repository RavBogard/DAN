# Domain Pitfalls: DAN

**Domain:** Claude Code autonomous workflow engine (skill system with recursive research, orchestration, wave parallelization)
**Researched:** 2026-03-28
**Confidence:** HIGH (multiple verified sources, real-world GSD/PAUL operational data)

## Critical Pitfalls

Mistakes that cause rewrites, corrupted state, or fundamentally broken workflows.

### Pitfall 1: Context Rot Kills Quality Mid-Execution

**What goes wrong:** Claude Code's output quality degrades at 20-40% context usage due to attention dilution. In long autonomous runs (research -> plan -> apply -> unify -> bugsweep), the model starts cutting corners, forgetting requirements, and hallucinating -- often without obvious signals. By 50%+ context, code contradicts earlier decisions. By 70%+, requirements are actively forgotten.

**Why it happens:** DAN's design chains multiple phases together. If a single orchestrator runs through research -> plan -> apply -> unify -> verify -> bugsweep in one context window, it will degrade before reaching bugsweep. The PAUL-style E/Q qualify step and recursive bugsweep are the phases most likely to suffer because they come last.

**Consequences:** Bugsweep passes broken code. Verify phase rubber-stamps work that doesn't meet acceptance criteria. The entire "autonomous after approval" promise fails silently.

**Prevention:**
- Fresh context per phase is non-negotiable. GSD got this right -- each phase agent gets a clean context window with only the state files it needs.
- Never chain more than one major phase in a single agent invocation.
- Use file-based handoffs (`.planning/` state files) as the communication bridge between phases, not accumulated conversation context.
- Run `/compact` at natural boundaries if any orchestrator must span phases.

**Detection:** Monitor context usage percentage. If any agent reaches 40%+ before completing its phase, the phase scope is too large. Watch for the "being more concise" signal -- Claude openly states it's summarizing when it shouldn't be.

**Phase mapping:** Core architecture decision -- must be settled in Phase 1 (foundation). Every workflow definition must enforce fresh-context-per-agent from day one.

---

### Pitfall 2: Subagent Nesting Impossibility

**What goes wrong:** You design an orchestrator that spawns phase agents, expecting those phase agents to spawn their own subagents (e.g., wave parallelization within a phase). Claude Code subagents cannot spawn other subagents. The architecture silently collapses to monolithic execution.

**Why it happens:** GSD hit this exact issue -- workflow files assumed an orchestration model where auto_advance spawns a plan-phase orchestrator that spawns children, but that subagent can't spawn children. Everything runs monolithically in one context window, defeating the fresh-context architecture.

**Consequences:** Waves can't actually parallelize. Phase agents bloat their context doing everything sequentially. The architecture diagram doesn't match reality.

**Prevention:**
- Design for exactly TWO levels: orchestrator -> leaf agents. No deeper nesting.
- Wave parallelization must be implemented at the orchestrator level -- the orchestrator spawns all parallel agents directly, not through an intermediate coordinator.
- If a phase needs internal parallelism, the top-level orchestrator must handle spawning those parallel agents.
- Test the actual spawning behavior early -- don't assume capabilities from documentation alone.

**Detection:** If any workflow definition has an agent spawning another agent that spawns agents, it's broken. Audit workflow files for nesting depth > 2.

**Phase mapping:** Phase 1 (foundation). The agent spawning model is the most fundamental architectural constraint. Get this wrong and everything built on top is fiction.

---

### Pitfall 3: Race Conditions in File-Based State

**What goes wrong:** Multiple parallel agents (wave execution) read and write the same `.planning/` state files concurrently. JSON files get corrupted with partial writes. Markdown status files show stale data. Agents make decisions based on state that another agent has already changed.

**Why it happens:** Claude Code has a documented race condition with concurrent file access. Version 2.1.59 and earlier had .claude.json corruption from concurrent writes. Wave parallelization inherently creates concurrent access to shared state files.

**Consequences:** Silent state corruption. Agents working on stale data produce conflicting changes. Task status tracking becomes unreliable. In the worst case, the orchestrator loses track of what's complete and re-runs or skips phases.

**Prevention:**
- Atomic write pattern: write to temp file, then rename. Never write directly to shared state files.
- File locking (flock) for any shared state that multiple agents access.
- Design state so each wave agent writes to its OWN file (e.g., `.planning/tasks/task-3-result.md`), and only the orchestrator merges results into shared state.
- Never have two agents write to the same file. Partition state by agent responsibility.

**Detection:** Watch for truncated JSON, backup file accumulation, or agents reporting contradictory status for the same task. Include state integrity checks in the orchestrator between waves.

**Phase mapping:** Phase 1 (CLI tools library). The state management utilities must implement atomic writes and file locking before any parallel execution is built.

---

### Pitfall 4: Infinite Recursive Loops Burn Tokens and Time

**What goes wrong:** Recursive research and recursive bugsweep -- two core DAN features -- have no guaranteed termination. Research finds gaps, researches again, finds more gaps, repeats indefinitely. Bugsweep finds issues, fixes them, introduces new issues, fixes those, repeats indefinitely. Each iteration costs real tokens.

**Why it happens:** The termination condition is "confidence" or "all green," both of which are subjective LLM assessments. An agent can perpetually find new things to research or new issues to fix. Infinite loops are documented as the #1 plague of 2026 agentic engineering.

**Consequences:** Token costs spiral. A recursive bugsweep that should take 3 iterations runs 15. Research that should converge in 3 passes runs 8 because each pass surfaces tangential concerns. Total cost for a milestone balloons 5-10x.

**Prevention:**
- Hard iteration caps on every recursive process. Research: max 4 passes. Bugsweep: max 3 fix-verify cycles.
- Implement a "diminishing returns" check: if pass N found fewer issues than pass N-1, and N >= 3, terminate.
- Track what each pass found/fixed. If a bugsweep pass finds only issues it introduced in the previous fix pass, that's a loop signal -- terminate and escalate to human.
- Budget caps per phase: if token usage exceeds threshold, stop and report.

**Detection:** Log iteration counts. Alert on any recursive process exceeding its cap. Track issue counts per pass -- rising issue counts after pass 2 means the agent is creating problems, not solving them.

**Phase mapping:** Phase 2 (recursive systems). Caps and termination logic must be built into the recursive research and bugsweep workflows before they're used in production.

---

### Pitfall 5: Orphan Plans -- Loops That Never Close

**What goes wrong:** A PLAN phase creates a detailed plan, APPLY starts executing, hits a problem mid-way, and the workflow stalls or errors out. The plan is never UNIFIED. There's no closure record. Next session, the system doesn't know if that plan was completed, abandoned, or partially done.

**Why it happens:** Claude Code sessions can be interrupted (terminal closed, token limit hit, network error). If state isn't checkpointed after every task completion, partial progress is lost. PAUL identified this as a core design principle: "Never skip UNIFY."

**Consequences:** Duplicate work on resume. Conflicting partial implementations. State files say "in progress" forever. The system can't distinguish "crashed mid-task" from "completed but didn't record."

**Prevention:**
- Atomic task completion: after each task in APPLY, immediately write its completion status to state files. Don't batch status updates.
- Every plan gets a lifecycle: DRAFT -> APPROVED -> IN_PROGRESS -> COMPLETED / ABANDONED. Never leave a plan in IN_PROGRESS across sessions.
- On session resume, first action is reconciling state: check what files actually changed vs. what tasks claim completion. Trust the filesystem over the status file.
- UNIFY must be able to run on partial completions -- it should summarize what got done and what didn't, not require 100% task completion.

**Detection:** Scan `.planning/` for any plan with status IN_PROGRESS that hasn't been touched in > 1 session. Flag as orphan requiring human decision.

**Phase mapping:** Phase 1 (PAUL loop implementation). The plan lifecycle and atomic checkpointing must be in the core loop, not added later.

---

## Moderate Risks

### Risk 1: Session Restore Loses Implicit Context

**What goes wrong:** `claude --continue` restores message history, but the agent's "understanding" of the project state is shallower than it was mid-session. Files that were read and reasoned about are in the history but the model doesn't re-internalize them with the same depth.

**Why it happens:** Context restoration loads the conversation log, but the model's attention to restored context is weaker than fresh reads. The agent may have read 20 files in the original session but only the last few are given strong attention on restore.

**Prevention:**
- Design session resume to re-read critical state files explicitly, not rely on conversation history.
- Keep a `.planning/session-state.md` that summarizes: current phase, current task, key decisions, what files matter. On resume, the first action is reading this file.
- Prefer starting fresh agents with state files over continuing stale sessions.

**Phase mapping:** Phase 3 (session management).

---

### Risk 2: Over-Engineering the Orchestrator

**What goes wrong:** The orchestrator becomes a complex state machine with dozens of conditional branches, error recovery paths, and special cases. It consumes significant context just reading its own instructions. Bug fixes to the orchestrator itself become the hardest part of the project.

**Why it happens:** Natural tendency to handle every edge case in the orchestrator. Each failure mode gets a special handler. Each workflow variant gets a branch. The orchestrator prompt grows to thousands of tokens.

**Prevention:**
- Thin orchestrators, thick agents. The orchestrator should do exactly: read state -> determine next phase -> spawn agent -> read result -> update state -> repeat.
- Error handling belongs in individual agents, not the orchestrator. If an agent fails, it writes a failure state file. The orchestrator reads the failure and routes to the appropriate recovery.
- Cap orchestrator instructions at ~500 lines. If it's longer, responsibilities need to be pushed down to agents.

**Phase mapping:** Phase 1 (architecture). Establish the thin-orchestrator pattern as a hard constraint.

---

### Risk 3: Diagnostic Failure Routing Gets Skipped Under Pressure

**What goes wrong:** PAUL's root cause classification (intent issue vs spec issue vs code issue) is a valuable pattern, but when bugsweep finds 15 issues, the temptation is to just fix them all as code issues. This leads to patching symptoms while the spec is wrong, creating more bugs.

**Why it happens:** Classification requires reading the plan, the spec, and the code to determine root cause. It's slower than just fixing the code. In recursive bugsweep, agents optimize for closing issues quickly.

**Prevention:**
- Make diagnostic classification mandatory in the bugsweep agent prompt. Not optional, not "when appropriate."
- If classification determines a spec issue, the bugsweep agent must escalate rather than fix. Spec changes need to flow back through the plan.
- Track classification distribution: if > 80% of issues are classified as "code issue," the classifier is probably being lazy.

**Phase mapping:** Phase 2 (bugsweep implementation).

---

### Risk 4: Wave Dependency Analysis Gets Dependencies Wrong

**What goes wrong:** The dependency analyzer determines that tasks A, B, C can run in parallel, but B actually depends on A's output file. Both agents write conflicting versions of the same file. Or B reads a file that A hasn't created yet.

**Why it happens:** Dependency analysis is hard. File-level dependencies aren't always obvious from task descriptions. An agent may generate a utility file that another task's code needs to import.

**Prevention:**
- Conservative parallelization: when in doubt, serialize. The cost of unnecessary serialization is minor; the cost of a bad parallel run is a corrupted codebase.
- Dependency analysis should check: shared files (read/write), shared modules (imports), shared state (`.planning/` files), and ordering constraints from the plan.
- After each wave, run a quick integrity check before starting the next wave.

**Phase mapping:** Phase 2 (wave parallelization).

---

### Risk 5: Config Complexity Creep

**What goes wrong:** The "simplified preferences/config system" gradually accumulates options for every behavior variant. Config parsing and validation becomes its own subsystem. Users (even a single user) forget what options exist and which are set.

**Why it happens:** Every time behavior needs to vary, adding a config option feels cleaner than hardcoding. Over time, config becomes the dumping ground for decisions that should have been design choices.

**Prevention:**
- Start with zero config. Bake decisions into workflow definitions.
- Only add a config option when the same user (Daniel) needs different behavior in different projects -- not for hypothetical flexibility.
- Config should be < 20 options total. If it exceeds that, some options should become hardcoded defaults.

**Phase mapping:** Phase 3 (config system). Intentionally deferred to avoid premature abstraction.

---

## Minor Gotchas

### Gotcha 1: Git Commit Granularity Mismatch

**What goes wrong:** Autonomous execution creates too many tiny commits (one per file change) or too few large commits (one per phase). Neither is useful for debugging or rollback.

**Prevention:** One atomic commit per task in the plan. Each commit should represent a coherent unit of work that can be reverted independently. GSD's pattern of "atomic git commits per task so you can bisect your way out of agent chaos" is correct.

---

### Gotcha 2: CLAUDE.md Conflicts with Workflow Rules

**What goes wrong:** DAN's workflow definitions contain rules, but the project's CLAUDE.md also contains rules. When they conflict, Claude Code prioritizes project CLAUDE.md, silently ignoring DAN's workflow rules.

**Prevention:** DAN's installation process must merge essential rules into the project's CLAUDE.md, or DAN's rules must be structured as CLAUDE.md includes (if supported). Test rule precedence explicitly during setup.

**Phase mapping:** Phase 1 (installation/setup).

---

### Gotcha 3: Overusing Recursive Research for Simple Tasks

**What goes wrong:** DAN's "research 5x, build once" philosophy is applied to trivial tasks. Adding a config option triggers 4 passes of recursive research. Token cost and time are wasted on problems that don't need investigation.

**Prevention:** Implement a task complexity classifier. Simple tasks (< 30 min estimated work) skip research entirely or get a single pass max. Reserve recursive research for milestone-level unknowns and greenfield architecture decisions.

---

### Gotcha 4: Node.js Built-ins Only Constraint Causes Reinvention

**What goes wrong:** The "no npm dependencies" constraint means reimplementing glob matching, YAML parsing, or other common utilities from scratch. The reimplementation has bugs. Time is spent debugging infrastructure instead of workflow logic.

**Prevention:** Audit what utilities are actually needed before committing to zero dependencies. If glob and YAML parsing are needed, either use Node.js built-ins that cover the use case (Node 22+ has native glob) or allow 1-2 zero-dependency utility packages. The constraint should serve quality, not dogma.

---

## Prevention Matrix

| Phase | Pitfall | Severity | Prevention Strategy |
|-------|---------|----------|---------------------|
| Phase 1 (Foundation) | Context rot from chained phases | CRITICAL | Fresh-context-per-agent architecture, file-based handoffs |
| Phase 1 (Foundation) | Subagent nesting impossibility | CRITICAL | Two-level max: orchestrator -> leaf agents only |
| Phase 1 (Foundation) | Orphan plans / broken loop closure | CRITICAL | Atomic task checkpointing, plan lifecycle states |
| Phase 1 (Foundation) | Over-engineered orchestrator | MODERATE | Thin orchestrators (< 500 lines), push logic to agents |
| Phase 1 (Foundation) | CLAUDE.md rule conflicts | MINOR | Merge DAN rules into project CLAUDE.md on install |
| Phase 1 (CLI Tools) | File-based state race conditions | CRITICAL | Atomic writes, file locking, partitioned state per agent |
| Phase 2 (Recursive Systems) | Infinite recursive loops | CRITICAL | Hard iteration caps, diminishing returns checks, budget limits |
| Phase 2 (Bugsweep) | Skipping diagnostic classification | MODERATE | Mandatory classification in agent prompt, escalation for spec issues |
| Phase 2 (Waves) | Bad dependency analysis | MODERATE | Conservative parallelization, integrity checks between waves |
| Phase 3 (Sessions) | Session restore loses context | MODERATE | Re-read state files on resume, maintain session-state.md |
| Phase 3 (Config) | Config complexity creep | MODERATE | Start with zero config, max 20 options, design choices over options |
| All Phases | Overusing recursive research | MINOR | Complexity classifier, skip research for simple tasks |
| All Phases | Git commit granularity | MINOR | One atomic commit per plan task |
| Phase 1 (CLI Tools) | Reinventing Node.js utilities | MINOR | Audit needed utilities, use Node 22+ built-ins, allow minimal deps if needed |

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Early Warning Sign |
|-------------|---------------|--------------------|
| Agent spawning model | Designing for 3+ nesting levels | Workflow file shows agent -> agent -> agent chains |
| State management | No file locking in CLI tools | Two agents writing to same JSON file in tests |
| Recursive research | No iteration cap in workflow | Research agent running > 4 passes on any topic |
| Recursive bugsweep | Fix-break-fix cycles | Issue count rising after pass 2 |
| Wave parallelization | Tasks touching same files in parallel | Git merge conflicts after wave completion |
| Session resume | Agent seems confused after `--continue` | Agent re-asks questions answered in previous session |
| Orchestrator design | Orchestrator prompt > 500 lines | Adding special-case branches for error recovery |

## Sources

- [GSD Framework - GitHub](https://github.com/gsd-build/get-shit-done)
- [PAUL Framework - GitHub](https://github.com/ChristopherKahler/paul)
- [Beating Context Rot in Claude Code with GSD - The New Stack](https://thenewstack.io/beating-the-rot-and-getting-stuff-done/)
- [Claude Code Race Condition Issue #28847](https://github.com/anthropics/claude-code/issues/28847)
- [Why Claude Code Produces Bad Output Before Context Limit - BSWEN](https://docs.bswen.com/blog/2026-03-19-claude-context-window-degradation/)
- [Infinite Agent Loop - Agent Patterns](https://www.agentpatterns.tech/en/failures/infinite-loop)
- [Agentic Resource Exhaustion - Medium](https://medium.com/@instatunnel/agentic-resource-exhaustion-the-infinite-loop-attack-of-the-ai-era-76a3f58c62e3)
- [Context Window Overflow - Redis](https://redis.io/blog/context-window-overflow/)
- [Claude Code Subagent Best Practices - claudefast](https://claudefa.st/blog/guide/agents/sub-agent-best-practices)
- [Claude Code Best Practices - Official Docs](https://code.claude.com/docs/en/best-practices)
- [Create Custom Subagents - Claude Code Docs](https://code.claude.com/docs/en/sub-agents)
- [GSD --auto Implementation Issue #780](https://github.com/gsd-build/get-shit-done/issues/780)
