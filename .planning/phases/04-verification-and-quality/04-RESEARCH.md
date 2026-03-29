# Phase 4: Verification and Quality - Research

**Researched:** 2026-03-28
**Domain:** Autonomous verification and recursive bugsweep for agentic development workflow
**Confidence:** HIGH

## Summary

Phase 4 adds two skills (`/dan:verify` and `/dan:bugsweep`) that close the quality loop after plan execution. The verify skill spawns a read-only dan-verifier agent that checks phase deliverables against acceptance criteria and requirements, producing a structured VERIFICATION.md. The bugsweep skill orchestrates a recursive loop: spawn dan-auditor to find and fix issues, re-verify, repeat until clean or circuit breaker trips.

Both skills and both agents already exist as stubs from Phase 1 (01-04-PLAN.md). The agent definitions have role descriptions, tool restrictions, and boundary rules. The skills have names, frontmatter, and placeholder `<execution_flow>` blocks. Phase 4's job is to fill in the execution_flow for both skills, enhance the agent prompts with detailed instructions, and add a new `verify` CLI module to dan-tools.cjs for programmatic artifact/wiring/completeness checks.

The patterns are well-established. GSD has a comprehensive verify.cjs module (820 lines, 8 verification commands) and a goal-backward verify-phase workflow. PAUL has a UAT-driven verify-work workflow. DAN adapts both: GSD's programmatic artifact/key-link/completeness checks become CLI tool functions, while GSD's goal-backward verification (truths -> artifacts -> wiring) becomes the verifier agent's reasoning framework. The bugsweep pattern is DAN-original but follows standard recursive-with-circuit-breaker design from the project research summary.

**Primary recommendation:** Build a verify.cjs CLI module with artifact, key-link, and phase-completeness checks (porting from GSD), then fill in the execution_flow for both skills and enhance both agent prompts. Two plans: (1) CLI tools + verifier, (2) bugsweep orchestration.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| QUAL-01 | `/dan:verify` runs verifier agent that checks deliverables against phase goals and acceptance criteria | Goal-backward verification pattern from GSD; verifier agent prompt with structured output; verify.cjs CLI tools for programmatic checks |
| QUAL-02 | Verification is automated -- no human intervention required | Verifier agent is read-only, spawned by skill, reads plans/summaries, runs tests via Bash, produces VERIFICATION.md autonomously |
| QUAL-03 | `/dan:bugsweep` runs recursive audit loop: find issues -> fix -> re-verify -> loop until clean | Bugsweep skill execution_flow with cycle counter, auditor agent spawn, re-verification after fixes |
| QUAL-04 | Bugsweep has hard iteration cap (max 3 cycles) with escalation to human if issues persist | Circuit breaker pattern: cycle_count >= MAX_CYCLES triggers escalation with structured blocker report |
| QUAL-05 | Bugsweep uses diminishing returns detection -- if same issues recur, stop and escalate | Issue fingerprinting: hash issue descriptions across cycles, detect recurring set, escalate if overlap > 50% |
| QUAL-06 | Verification results written to phase VERIFICATION.md with pass/fail per acceptance criterion | VERIFICATION.md template with frontmatter (status, score), criteria table, artifact table, wiring table, issues list |
</phase_requirements>

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Node.js built-ins | 22+ | fs, path, child_process for verify.cjs module | Zero-dependency constraint from Phase 1 |
| dan-tools.cjs | current | CLI router, subcommand dispatch | Existing pattern: all CLI tools route through single entry point |
| dan-verifier agent | sonnet | Read-only verification against criteria | Already scaffolded in Phase 1 with correct tool restrictions |
| dan-auditor agent | inherit | Find, classify, and fix issues | Already scaffolded in Phase 1 with full tool access |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| qualify.cjs | current | classifyFailure() for diagnostic routing in auditor | Auditor reuses existing intent/spec/code classification |
| phase.cjs | current | findPhase() for resolving phase directories | Both skills need to locate phase dir from phase number argument |
| frontmatter.cjs | current | Parse plan frontmatter for must_haves, requirements | Verifier reads must_haves.truths/artifacts/key_links from plans |
| commit.cjs | current | Atomic commits after auditor fixes | Auditor commits each fix atomically |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| New verify.cjs module | Inline verification in agent prompt | CLI module is testable, reusable, and consistent with existing pattern |
| Issue fingerprinting via hash | LLM-based "same issue" detection | Hash is deterministic and cheap; LLM adds cost and non-determinism |
| Separate VERIFICATION.md | Append to SUMMARY.md | Separate file is cleaner, independently parseable, and matches GSD pattern |

## Architecture Patterns

### Recommended Project Structure

```
bin/
  lib/
    verify.cjs          # NEW: Verification CLI module (artifact checks, completeness, key-links)
  tests/
    test-verify.cjs     # NEW: Unit tests for verify.cjs
  dan-tools.cjs         # MODIFIED: Add 'verify' command routing

.claude/
  skills/
    dan-verify/SKILL.md    # MODIFIED: Fill in <execution_flow>
    dan-bugsweep/SKILL.md  # MODIFIED: Fill in <execution_flow>
  agents/
    dan-verifier.md        # MODIFIED: Enhance with detailed verification instructions
    dan-auditor.md         # MODIFIED: Enhance with fix-verify loop instructions

.planning/phases/XX-name/
  XX-VERIFICATION.md       # OUTPUT: Written by verifier, read by bugsweep
```

### Pattern 1: Goal-Backward Verification (from GSD verify-phase.md)

**What:** Instead of checking "did tasks complete?", verify "is the goal achieved?" by working backward from observable truths to artifacts to wiring.

**When to use:** Every `/dan:verify` invocation.

**How it works:**
1. Load phase goal from ROADMAP.md
2. Load must_haves from each plan's frontmatter (truths, artifacts, key_links)
3. For each truth: check supporting artifacts exist, are substantive, and are wired
4. For each artifact: check file exists, has expected exports/patterns, is not a stub
5. For each key_link: check source file references target via expected pattern
6. Aggregate results into pass/fail per criterion

**Verifier agent reasoning flow:**
```
Phase Goal (from ROADMAP.md)
  -> Must-Have Truths (from PLAN.md frontmatter must_haves.truths)
    -> Required Artifacts (from must_haves.artifacts)
      -> File exists? (CLI: verify artifacts <plan>)
      -> Substantive? (CLI: verify artifacts <plan> checks exports/patterns)
    -> Key Links (from must_haves.key_links)
      -> Wired? (CLI: verify key-links <plan>)
  -> Phase Completeness
    -> All plans have summaries? (CLI: verify phase-completeness <phase>)
  -> Requirements Coverage
    -> Each QUAL-XX requirement satisfied? (manual check against criteria)
```

### Pattern 2: Recursive Bugsweep with Circuit Breakers

**What:** Orchestrate find-fix-verify cycles with three termination conditions: clean pass, max cycles, or recurring issues.

**When to use:** Every `/dan:bugsweep` invocation.

**Orchestration loop (in skill, NOT in agent):**
```
cycle = 0
MAX_CYCLES = 3
previous_issues = []

while cycle < MAX_CYCLES:
  cycle += 1

  # Spawn verifier to get current issue list
  issues = spawn dan-verifier -> parse VERIFICATION.md

  if issues.length == 0:
    break  # Clean pass

  # Check for recurring issues (diminishing returns)
  if cycle > 1:
    recurring = issues that match previous_issues
    if recurring.length / issues.length > 0.5:
      escalate("Same issues recurring across cycles")
      break

  previous_issues = issues

  # Spawn auditor to fix issues
  spawn dan-auditor with issues list

  # Auditor commits fixes, returns fix report
```

**Key insight:** The skill orchestrates the loop, not the agent. This respects the two-level rule (skills orchestrate, agents execute) and gives the skill control over termination.

### Pattern 3: Issue Fingerprinting for Diminishing Returns Detection

**What:** Create stable identifiers for issues so they can be compared across bugsweep cycles.

**How:** Normalize issue descriptions to fingerprints:
1. Extract the issue's file path + issue type (e.g., "bin/lib/verify.cjs:STUB")
2. Lowercase and strip whitespace
3. Compare fingerprint sets across cycles

**Thresholds:**
- If > 50% of current cycle's issues match previous cycle's fingerprints -> escalate
- This catches fix-break-fix cycles where the auditor's fix introduces a new instance of the same problem

### Pattern 4: VERIFICATION.md Structure (from GSD template)

**What:** Structured verification report with machine-parseable sections.

**Template:**
```markdown
---
phase: XX-name
verified: YYYY-MM-DDTHH:MM:SSZ
status: passed | gaps_found | human_needed
score: N/M must-haves verified
bugsweep_cycles: 0
---

# Phase X: Name - Verification Report

**Phase Goal:** {goal from ROADMAP.md}
**Status:** {passed | gaps_found | human_needed}

## Criteria Results

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | {from must_haves.truths} | PASS/FAIL | {what confirmed or disproved it} |

**Score:** N/M criteria passed

## Artifact Verification

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| {path} | {provides} | VERIFIED/STUB/MISSING | {evidence} |

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| {from} | {to} | {via} | WIRED/NOT_WIRED | {evidence} |

## Requirements Coverage

| Requirement | Status | Evidence |
|-------------|--------|----------|
| QUAL-01 | SATISFIED/BLOCKED | {evidence} |

## Test Results

{Output of automated test runs}

## Issues Found

1. {Issue description with file path and evidence}

## Bugsweep History

| Cycle | Issues Found | Issues Fixed | Recurring | Action |
|-------|-------------|-------------|-----------|--------|
| 1 | N | M | - | fix |
| 2 | N | M | K | fix/escalate |
```

### Anti-Patterns to Avoid

- **Self-grading:** The verifier MUST be read-only and MUST NOT fix issues. The auditor fixes. Mixing roles defeats independent verification.
- **Unbounded loops:** Every loop MUST have a hard cap. Research shows fix-break-fix cycles are the #1 agentic engineering plague.
- **Checking task completion instead of goal achievement:** "Task done" does not mean "feature works". Always verify observable truths.
- **Agent-level loop orchestration:** The bugsweep loop MUST live in the skill, not in the auditor agent. Agents execute one pass; skills decide whether to loop.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Artifact existence + substantive checks | Custom file-reading logic in agent prompt | verify.cjs CLI module (port from GSD) | Consistent, testable, reusable across agents |
| Key-link wiring verification | Inline grep commands in agent prompt | verify.cjs key-links subcommand | Pattern matching is tricky; centralized logic prevents errors |
| Phase completeness check | Manual plan/summary counting | verify.cjs phase-completeness subcommand | Already proven in GSD verify.cjs |
| Plan structure validation | Ad-hoc frontmatter checks | verify.cjs plan-structure subcommand | Catches missing must_haves, missing tasks, bad frontmatter |
| Diagnostic classification | LLM-based classification in auditor | qualify.cjs classifyFailure() | Already exists and tested from Phase 2 |

**Key insight:** GSD's verify.cjs has 820 lines of battle-tested verification logic. Port the patterns, adapt for DAN's structure. Don't reinvent.

## Common Pitfalls

### Pitfall 1: Fix-Break-Fix Cycles
**What goes wrong:** Auditor fixes issue A, but the fix breaks thing B. Next cycle fixes B, which re-breaks A. Loop never converges.
**Why it happens:** Fixes have side effects that the auditor doesn't anticipate.
**How to avoid:** Issue fingerprinting detects recurring issues. Hard cap at 3 cycles prevents infinite loops. Escalation report tells user which issues are cycling.
**Warning signs:** Issue count stays constant or increases across cycles.

### Pitfall 2: Verifier Checking Wrong Things
**What goes wrong:** Verifier checks "does file X exist?" instead of "does the system actually work?"
**Why it happens:** Confusing task completion with goal achievement.
**How to avoid:** Goal-backward verification: start from observable truths, not file lists. Must-haves in plan frontmatter guide the verifier.
**Warning signs:** Verification passes but the feature doesn't actually work.

### Pitfall 3: Auditor Fixing Intent/Spec Issues
**What goes wrong:** Auditor "fixes" code when the real problem is the plan was wrong or the requirement was ambiguous.
**Why it happens:** Without diagnostic routing, all failures look like code bugs.
**How to avoid:** Mandatory classifyFailure() call before any fix. Intent and spec issues are ESCALATED, never fixed by the auditor.
**Warning signs:** Same area being fixed repeatedly; fixes that change behavior rather than fix bugs.

### Pitfall 4: Stale VERIFICATION.md
**What goes wrong:** Bugsweep reads VERIFICATION.md from a previous run, not the current state.
**Why it happens:** VERIFICATION.md is not regenerated between bugsweep cycles.
**How to avoid:** Each bugsweep cycle starts by spawning a fresh verifier that writes a NEW VERIFICATION.md. The auditor reads the latest one.
**Warning signs:** Auditor fixing issues that no longer exist.

### Pitfall 5: Agent Prompt Too Long
**What goes wrong:** Overloading the verifier or auditor agent prompt with all verification logic causes context degradation.
**Why it happens:** Trying to embed complex logic in agent prompts instead of CLI tools.
**How to avoid:** Put programmatic checks in verify.cjs CLI module. Agent prompt references CLI commands, not inline logic. Keep agent prompts focused on reasoning and judgment.
**Warning signs:** Agent prompt exceeds ~3000 words.

## Code Examples

### verify.cjs: Artifact Verification (adapted from GSD)

```javascript
// Source: GSD verify.cjs cmdVerifyArtifacts, adapted for DAN
function verifyArtifacts(cwd, planFilePath) {
  const content = fs.readFileSync(path.join(cwd, planFilePath), 'utf-8');
  const { parseFrontmatter } = require('./frontmatter.cjs');
  const fm = parseFrontmatter(content);

  // Extract must_haves.artifacts from frontmatter
  const artifacts = fm.must_haves?.artifacts || [];

  const results = [];
  for (const artifact of artifacts) {
    const artPath = path.join(cwd, artifact.path);
    const exists = fs.existsSync(artPath);
    const check = { path: artifact.path, exists, issues: [], passed: false };

    if (exists) {
      const fileContent = fs.readFileSync(artPath, 'utf-8');
      // Check exports exist
      if (artifact.exports) {
        for (const exp of artifact.exports) {
          if (!fileContent.includes(exp)) {
            check.issues.push('Missing export: ' + exp);
          }
        }
      }
      check.passed = check.issues.length === 0;
    } else {
      check.issues.push('File not found');
    }
    results.push(check);
  }

  const passed = results.filter(r => r.passed).length;
  return { all_passed: passed === results.length, passed, total: results.length, artifacts: results };
}
```

### verify.cjs: Key-Link Verification (adapted from GSD)

```javascript
// Source: GSD verify.cjs cmdVerifyKeyLinks, adapted for DAN
function verifyKeyLinks(cwd, planFilePath) {
  const content = fs.readFileSync(path.join(cwd, planFilePath), 'utf-8');
  const { parseFrontmatter } = require('./frontmatter.cjs');
  const fm = parseFrontmatter(content);

  const keyLinks = fm.must_haves?.key_links || [];
  const results = [];

  for (const link of keyLinks) {
    const check = { from: link.from, to: link.to, via: link.via || '', verified: false, detail: '' };
    const sourcePath = path.join(cwd, link.from);

    if (!fs.existsSync(sourcePath)) {
      check.detail = 'Source file not found';
    } else {
      const sourceContent = fs.readFileSync(sourcePath, 'utf-8');
      if (link.pattern) {
        const regex = new RegExp(link.pattern);
        check.verified = regex.test(sourceContent);
        check.detail = check.verified ? 'Pattern found' : 'Pattern not found: ' + link.pattern;
      } else {
        check.verified = sourceContent.includes(link.to);
        check.detail = check.verified ? 'Target referenced in source' : 'Target not referenced';
      }
    }
    results.push(check);
  }

  const verified = results.filter(r => r.verified).length;
  return { all_verified: verified === results.length, verified, total: results.length, links: results };
}
```

### verify.cjs: Phase Completeness Check

```javascript
// Source: GSD verify.cjs cmdVerifyPhaseCompleteness, adapted for DAN
function verifyPhaseCompleteness(cwd, phaseNum) {
  const { findPhase } = require('./phase.cjs');
  const phaseDir = findPhase(cwd, phaseNum);
  const files = fs.readdirSync(phaseDir);

  const plans = files.filter(f => f.match(/-PLAN\.md$/));
  const summaries = files.filter(f => f.match(/-SUMMARY\.md$/));

  const planIds = new Set(plans.map(p => p.replace(/-PLAN\.md$/, '')));
  const summaryIds = new Set(summaries.map(s => s.replace(/-SUMMARY\.md$/, '')));

  const incompletePlans = [...planIds].filter(id => !summaryIds.has(id));

  return {
    complete: incompletePlans.length === 0,
    plan_count: plans.length,
    summary_count: summaries.length,
    incomplete_plans: incompletePlans,
  };
}
```

### Issue Fingerprinting for Diminishing Returns

```javascript
// Normalize issue to stable fingerprint for cross-cycle comparison
function fingerprintIssue(issue) {
  // Extract file path and issue type
  const normalized = issue
    .toLowerCase()
    .replace(/line \d+/g, '')          // Remove line numbers (may shift)
    .replace(/\s+/g, ' ')              // Normalize whitespace
    .replace(/['"][^'"]*['"]/g, '""')  // Normalize string literals
    .trim();
  return normalized;
}

function detectRecurringIssues(currentIssues, previousIssues) {
  const currentFingerprints = new Set(currentIssues.map(fingerprintIssue));
  const previousFingerprints = new Set(previousIssues.map(fingerprintIssue));

  let recurring = 0;
  for (const fp of currentFingerprints) {
    if (previousFingerprints.has(fp)) recurring++;
  }

  const ratio = currentFingerprints.size > 0 ? recurring / currentFingerprints.size : 0;
  return {
    recurring_count: recurring,
    total_current: currentFingerprints.size,
    ratio,
    should_escalate: ratio > 0.5
  };
}
```

### Bugsweep Skill Orchestration Pseudocode

```
# In dan-bugsweep/SKILL.md <execution_flow>

<step name="load_phase">
  Parse phase argument, find phase directory
  Read all SUMMARY.md files to get list of key_files
  Set: MAX_CYCLES = 3, cycle = 0, previous_issues = []
</step>

<step name="verify_cycle">
  cycle += 1

  Spawn dan-verifier agent:
    - Input: phase dir, plan files, summary files
    - Output: VERIFICATION.md at {phase_dir}/{padded}-VERIFICATION.md

  Parse VERIFICATION.md:
    - Extract status and issues list
    - If status == "passed": go to complete
    - If cycle > 1: check diminishing returns
</step>

<step name="check_diminishing_returns">
  Compare current issues to previous_issues using fingerprinting
  If recurring ratio > 0.5:
    Report: "Same issues recurring across cycles. Escalating."
    List the recurring issues
    Go to escalate
</step>

<step name="fix_cycle">
  Spawn dan-auditor agent:
    - Input: VERIFICATION.md issues, phase dir, key_files
    - Instructions: classify each issue, fix code issues, escalate intent/spec
    - Output: fix report (what was fixed, what was escalated)

  Read auditor's fix report
  Update previous_issues = current issues

  If cycle < MAX_CYCLES: go to verify_cycle
  Else: go to escalate
</step>

<step name="escalate">
  Update VERIFICATION.md with bugsweep history
  Update STATE.md: "Bugsweep escalated after {cycle} cycles"
  Report remaining issues to user
</step>

<step name="complete">
  Update VERIFICATION.md: status = passed, bugsweep_cycles = cycle
  Update STATE.md: "Phase {N} verified clean after {cycle} cycles"
  Report success
</step>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Self-grading (executor checks own work) | Independent verifier (read-only agent) | PAUL E/Q pattern | Eliminates confirmation bias in verification |
| Task-completion checking | Goal-backward verification | GSD verify-phase.md | Catches stubs, orphaned files, unwired components |
| Manual bug fixing | Recursive bugsweep with circuit breakers | DAN research phase | Autonomous quality improvement with guaranteed termination |
| Single verification pass | Multi-cycle verify-fix-verify | DAN Phase 4 design | Catches regression from fixes |

## Open Questions

1. **Should the auditor run tests before and after fixes?**
   - What we know: The auditor has Bash access and can run tests. Running tests before fixing provides baseline; running after confirms fix.
   - What's unclear: Whether this adds meaningful signal or just slows cycles.
   - Recommendation: Have auditor run verification commands from plan's `<verify>` elements before and after. Keep it lightweight.

2. **How should the verifier handle plans without must_haves?**
   - What we know: GSD falls back to deriving must-haves from phase goal. DAN plans should always have must_haves (it is a required frontmatter field per GSD verify.cjs).
   - What's unclear: Whether early DAN plans might be missing must_haves.
   - Recommendation: Verifier derives truths from plan objective and acceptance criteria as fallback. Log a warning if must_haves is absent.

3. **Should bugsweep commit after each individual fix or batch at end of cycle?**
   - What we know: Atomic commits per fix is the existing DAN pattern. Batching risks losing work on crash.
   - What's unclear: Whether many small commits clutter history.
   - Recommendation: Atomic commit per fix (consistent with dan-apply pattern). The auditor agent prompt should instruct this.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in assert + custom test runner (test-*.cjs pattern) |
| Config file | None -- tests use `node bin/tests/test-*.cjs` directly |
| Quick run command | `node bin/tests/test-verify.cjs` |
| Full suite command | `for f in bin/tests/test-*.cjs; do node "$f"; done` |

### Phase Requirements -> Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| QUAL-01 | Verifier checks deliverables against phase goals | unit | `node bin/tests/test-verify.cjs` | No -- Wave 0 |
| QUAL-02 | Verification is automated (no human intervention) | integration | Manual: run `/dan:verify 4` on completed phase | No -- manual |
| QUAL-03 | Bugsweep recursive loop runs correctly | unit | `node bin/tests/test-verify.cjs` (cycle logic) | No -- Wave 0 |
| QUAL-04 | Hard iteration cap at 3 cycles | unit | `node bin/tests/test-verify.cjs::max_cycles` | No -- Wave 0 |
| QUAL-05 | Diminishing returns detection | unit | `node bin/tests/test-verify.cjs::fingerprinting` | No -- Wave 0 |
| QUAL-06 | VERIFICATION.md written with pass/fail per criterion | unit | `node bin/tests/test-verify.cjs::report_format` | No -- Wave 0 |

### Sampling Rate

- **Per task commit:** `node bin/tests/test-verify.cjs`
- **Per wave merge:** `for f in bin/tests/test-*.cjs; do node "$f"; done`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `bin/tests/test-verify.cjs` -- covers QUAL-01, QUAL-03, QUAL-04, QUAL-05, QUAL-06
- [ ] `bin/lib/verify.cjs` -- new CLI module (artifact verification, key-links, phase-completeness, issue fingerprinting, diminishing returns detection)
- [ ] `verify` subcommand wired into `bin/dan-tools.cjs` router

## Sources

### Primary (HIGH confidence)
- GSD verify.cjs (`~/.claude/get-shit-done/bin/lib/verify.cjs`) -- 820 lines, 8 verification commands: artifacts, key-links, phase-completeness, plan-structure, references, commits, summary, consistency, health
- GSD verify-phase.md (`~/.claude/get-shit-done/workflows/verify-phase.md`) -- Goal-backward verification workflow with must-haves -> truths -> artifacts -> wiring pattern
- GSD verification-patterns.md (`~/.claude/get-shit-done/references/verification-patterns.md`) -- Stub detection patterns, wiring verification, artifact checklists
- GSD verification-report.md (`~/.claude/get-shit-done/templates/verification-report.md`) -- VERIFICATION.md template with frontmatter, criteria table, artifact table, wiring table
- DAN dan-verifier.md (`~/.claude/agents/dan-verifier.md`) -- Existing stub with role, tool restrictions, output format
- DAN dan-auditor.md (`~/.claude/agents/dan-auditor.md`) -- Existing stub with diagnostic routing, fix-verify loop, boundaries
- DAN qualify.cjs (`bin/lib/qualify.cjs`) -- Existing classifyFailure() for intent/spec/code classification
- DAN dan-workflow SKILL.md -- E/Q protocol, diagnostic routing, two-level rule, fresh context rule

### Secondary (MEDIUM confidence)
- DAN project research SUMMARY.md (`.planning/research/SUMMARY.md`) -- Documents fix-break-fix as #1 agentic engineering risk, recommends 3-cycle cap
- PAUL verify-work.md (`~/.claude/paul-framework/workflows/verify-work.md`) -- UAT-driven verification with manual user testing (DAN automates this)

### Tertiary (LOW confidence)
- Issue fingerprinting approach is DAN-original design. No external source validates the 50% threshold for escalation. This threshold should be tunable via dan.config.json if needed.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all components exist or are direct ports from GSD
- Architecture: HIGH -- goal-backward verification and recursive bugsweep are proven patterns from GSD and project research
- Pitfalls: HIGH -- fix-break-fix cycles documented as real incident in project research; circuit breaker pattern is standard
- Issue fingerprinting: MEDIUM -- novel approach, threshold needs validation

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable domain, no external dependencies)
