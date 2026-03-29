# Phase 3: Research System - Research

**Researched:** 2026-03-28
**Domain:** Recursive multi-pass research orchestration, discuss/interview phase, gap detection, convergence heuristics
**Confidence:** HIGH

## Summary

Phase 3 implements DAN's core differentiator: recursive research with gap detection and a structured discuss/interview phase. The proven pattern from GSD spawns 4 parallel researcher agents (stack, features, architecture, pitfalls) then a synthesizer to merge findings. DAN extends this with multi-pass recursion: the synthesizer identifies gaps, and the orchestrator spawns targeted researchers for unresolved gaps only, looping until confidence is high or a hard cap of 4 passes is reached. The critical constraint is that subagents cannot spawn subagents -- the skill (orchestrator) must directly spawn all researchers and synthesizers across all passes.

The discuss phase is an interactive in-session interview (no subagent spawning) that captures user decisions, tradeoffs, and constraints into a structured CONTEXT.md. This feeds directly into the research and planning phases. GSD's discuss-phase workflow is a complete, battle-tested reference implementation covering gray area identification, prior decision loading, scope creep guardrails, and multi-round question loops.

The main technical challenges are: (1) designing the convergence heuristic so research terminates reliably (gap count trending + confidence thresholds + hard cap), (2) structuring research state files so the synthesizer can identify what was already covered vs what needs re-investigation, and (3) adding a new `research` CLI module to track research pass state (pass number, gaps, confidence per dimension). All of these have clear solutions based on GSD patterns and the existing DAN CLI architecture.

**Primary recommendation:** Follow GSD's 4-researcher + synthesizer pattern exactly for pass 1. Add a research state tracker (new CLI module) that persists pass number, gap list, and confidence scores. The skill orchestrator reads this state after each synthesis pass and decides whether to loop. Discuss phase runs in-session using GSD's discuss-phase workflow as the template, adapted for DAN's skill structure.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RSRCH-01 | `/dan:research` runs recursive multi-pass research (research -> synthesize -> find gaps -> research again) | GSD's new-project workflow provides the single-pass pattern; DAN extends with loop in skill orchestrator reading synthesizer gap output |
| RSRCH-02 | Research system has hard iteration cap (max 4 passes) with diminishing returns detection | Implemented as pass counter in research state + gap count comparison between passes |
| RSRCH-03 | Each research pass spawns parallel researcher agents (stack, features, architecture, pitfalls) | Direct adoption of GSD's 4-researcher parallel spawn pattern via Task() calls |
| RSRCH-04 | Synthesizer agent merges findings into SUMMARY.md with confidence assessments and gap identification | GSD's gsd-research-synthesizer provides the base; DAN's adds structured gap list and per-dimension confidence |
| RSRCH-05 | Gap detection drives subsequent research passes -- only unresolved gaps get re-researched | Synthesizer outputs structured gap list; orchestrator filters researcher prompts to target only gaps |
| RSRCH-06 | Research terminates when gap count trends to zero or confidence reaches HIGH across all dimensions | Convergence check in orchestrator: (gaps === 0 OR all dimensions HIGH OR pass >= 4) |
| RSRCH-07 | `/dan:discuss` runs deep interview phase that surfaces decisions, tradeoffs, and assumptions | GSD's discuss-phase.md is a complete reference; adapt for DAN's skill structure and CLI tools |
| RSRCH-08 | Discuss phase captures structured decision log in CONTEXT.md per phase | GSD's CONTEXT.md template with domain, decisions, code_context, specifics, deferred sections |
| RSRCH-09 | Project-level init research runs 4 parallel researchers (same as GSD pattern) | GSD's new-project.md Step 6 is the exact implementation; integrate into `/dan:init` or `/dan:research` |
</phase_requirements>

## Standard Stack

### Core

This phase adds no new external libraries. Everything is built with Node.js built-ins and DAN's existing CLI tool architecture.

| Component | Type | Purpose | Why Standard |
|-----------|------|---------|--------------|
| dan-tools.cjs `research` module | New CLI module | Track research pass state (pass #, gaps, confidence) | Follows existing module pattern (state.cjs, phase.cjs) |
| dan-researcher agent | Enhanced agent MD | Detailed execution flow with structured output format | Stub exists; needs prompt engineering for gap-targeted passes |
| dan-synthesizer agent | Enhanced agent MD | Gap identification + confidence scoring output format | Stub exists; needs structured gap output format |
| dan:research skill | Enhanced skill MD | Full execution_flow with recursive loop orchestration | Stub exists; needs complete workflow implementation |
| dan:discuss skill | Enhanced skill MD | Full execution_flow with interview protocol | Stub exists; needs complete workflow implementation |

### Supporting

| Component | Type | Purpose | When Used |
|-----------|------|---------|-----------|
| dan:init skill | Modified skill | Integrate project-level research (RSRCH-09) into init flow | During project initialization |
| dan-workflow skill | Context skill | Already loaded into all agents; no changes needed | Always |

### What NOT to Build

| Instead of | Do This | Why |
|------------|---------|-----|
| Custom research database | JSON state in `.planning/research/state.json` | File-based state is DAN's pattern; no database needed |
| Research scheduling system | Simple loop counter in skill orchestrator | Max 4 passes; a counter is sufficient |
| NLP-based gap detection | LLM-generated structured gap list from synthesizer | The synthesizer IS the gap detector; no separate NLP tool needed |
| Research caching/dedup | Researcher reads prior findings via file paths | Pass prior output files to subsequent researchers; they skip covered topics |

## Architecture Patterns

### Research State File Structure

```
.planning/
  research/                    # Project-level research (RSRCH-09)
    STACK.md
    FEATURES.md
    ARCHITECTURE.md
    PITFALLS.md
    SUMMARY.md
    state.json                 # NEW: research pass tracking
  phases/
    03-research-system/
      03-RESEARCH.md           # Phase-level research (from /dan:research 3)
      03-CONTEXT.md            # From /dan:discuss 3
      research/                # NEW: per-phase research workspace
        pass-1/
          stack.md
          features.md
          architecture.md
          pitfalls.md
        pass-2/
          gap-pitfalls.md      # Only gaps get re-researched
          gap-architecture.md
        synthesis.md           # Latest synthesis with gaps + confidence
        state.json             # Per-phase research state
```

### Pattern 1: Recursive Research Orchestration (dan:research skill)

**What:** The skill orchestrator manages the research loop. It spawns researchers, then a synthesizer, reads the synthesis output, checks convergence, and either terminates or spawns targeted researchers for another pass.

**When to use:** Every `/dan:research` invocation.

**Pseudocode flow:**
```
function research(target):
  pass = 1
  gaps = ["stack", "features", "architecture", "pitfalls"]  # full scope on pass 1

  while pass <= 4:
    # Spawn researchers for current gaps only
    for each gap in gaps:
      Task(researcher, topic=gap, pass=pass, prior_findings=prior_files)

    # Spawn synthesizer to merge ALL findings (cumulative)
    Task(synthesizer, all_findings=all_files_across_passes)

    # Read synthesis output
    synthesis = read("synthesis.md")
    new_gaps = synthesis.gaps
    confidence = synthesis.confidence

    # Convergence check
    if new_gaps.length == 0:
      break  # No gaps remain
    if all(confidence[dim] == "HIGH" for dim in dimensions):
      break  # All dimensions confident
    if new_gaps.length >= gaps.length:
      break  # Diminishing returns: not making progress

    gaps = new_gaps
    pass += 1

  # Write final SUMMARY.md / RESEARCH.md
  commit_research()
```

**Key design decision:** The synthesizer reads ALL findings from ALL passes (cumulative), not just the latest pass. This ensures it has full context for gap detection. Each pass's findings are stored in separate directories (pass-1/, pass-2/) so nothing is overwritten.

### Pattern 2: Structured Synthesizer Output

**What:** The synthesizer must produce a machine-parseable gap list and confidence scores alongside the human-readable synthesis.

**Format at the end of synthesis.md:**
```markdown
## Convergence Assessment

### Confidence by Dimension
| Dimension | Confidence | Notes |
|-----------|------------|-------|
| Stack | HIGH | Verified against Context7 and official docs |
| Features | MEDIUM | Feature landscape understood but edge cases unclear |
| Architecture | HIGH | Two-level model well documented |
| Pitfalls | HIGH | Real incidents from GSD/PAUL operational data |

### Remaining Gaps
<!-- machine-parseable gap list -->
<gaps>
- dimension: features
  topic: "edge case handling for recursive research termination"
  priority: medium
  reason: "no production data on convergence behavior beyond 2 passes"
- dimension: architecture
  topic: "file locking during parallel researcher writes"
  priority: low
  reason: "researchers write to separate files; conflict unlikely"
</gaps>

### Recommendation
[CONTINUE | STOP]
Reason: [why]
```

The orchestrator parses the `<gaps>` block to determine what to re-research. If the recommendation is STOP or if gaps are empty, research terminates.

### Pattern 3: Gap-Targeted Researcher Prompts

**What:** On pass 2+, researchers get narrowed prompts that focus on specific gaps rather than broad domain exploration.

**Pass 1 prompt (broad):**
```
Research the standard stack for [domain].
Write to: .planning/research/pass-1/stack.md
```

**Pass 2+ prompt (gap-targeted):**
```
Previous research identified a gap:
Topic: "edge case handling for recursive research termination"
Reason: "no production data on convergence behavior beyond 2 passes"

Prior findings are in: .planning/research/pass-1/stack.md

Investigate this specific gap. Do NOT repeat already-covered topics.
Write to: .planning/research/pass-2/gap-stack.md
```

### Pattern 4: Discuss Phase Interview Protocol (dan:discuss skill)

**What:** An in-session interactive workflow (no subagent spawning) that identifies gray areas, asks structured questions, and captures decisions in CONTEXT.md.

**Adapted from GSD's discuss-phase.md. Key steps:**

1. **Load prior context** -- read PROJECT.md, REQUIREMENTS.md, STATE.md, and any prior CONTEXT.md files
2. **Analyze phase** -- identify gray areas specific to the phase goal (implementation decisions the user cares about)
3. **Present gray areas** -- let user select which to discuss (multiSelect via AskUserQuestion)
4. **Discuss each area** -- 4 questions per area, then check if user wants more or next area
5. **Write CONTEXT.md** -- structured output with domain, decisions, code_context, specifics, deferred sections
6. **Commit** -- via `dan-tools.cjs commit`

**Scope guardrail:** Discussion clarifies HOW to implement what's scoped in the phase, never WHETHER to add new capabilities. Deferred ideas captured but not acted on.

### Pattern 5: Research State Tracking (new CLI module)

**What:** A new `research` subcommand in dan-tools.cjs that manages research pass state.

**Subcommands:**
```bash
# Initialize research state for a target
dan-tools.cjs research init <phase|project> [--max-passes 4]

# Record a completed pass
dan-tools.cjs research record-pass <target> --pass <N> --gaps '<json>' --confidence '<json>'

# Get current research state
dan-tools.cjs research status <target>

# Check convergence (returns JSON with should_continue, reason)
dan-tools.cjs research check-convergence <target>
```

**State file format (state.json):**
```json
{
  "target": "phase-3",
  "max_passes": 4,
  "current_pass": 2,
  "passes": [
    {
      "pass": 1,
      "started": "2026-03-28T10:00:00Z",
      "completed": "2026-03-28T10:05:00Z",
      "researchers": ["stack", "features", "architecture", "pitfalls"],
      "gaps_found": 3,
      "confidence": { "stack": "HIGH", "features": "MEDIUM", "architecture": "HIGH", "pitfalls": "HIGH" }
    },
    {
      "pass": 2,
      "started": "2026-03-28T10:06:00Z",
      "completed": "2026-03-28T10:08:00Z",
      "researchers": ["features"],
      "gaps_found": 0,
      "confidence": { "stack": "HIGH", "features": "HIGH", "architecture": "HIGH", "pitfalls": "HIGH" }
    }
  ],
  "converged": true,
  "convergence_reason": "all dimensions HIGH confidence"
}
```

### Anti-Patterns to Avoid

- **Synthesizer spawning researchers:** Violates the two-level rule. The skill orchestrator must be the only entity spawning agents.
- **Unbounded research loops:** Always check `pass <= max_passes` before spawning another round. The convergence check must be in the orchestrator, not delegated to an agent.
- **Overwriting prior pass findings:** Each pass writes to its own directory (pass-1/, pass-2/). Never overwrite earlier findings -- the synthesizer needs cumulative context.
- **Re-researching everything on pass 2+:** Only gaps get new researchers. If only features had a gap, only spawn a features researcher for pass 2.
- **Making discuss interactive AND async:** The discuss phase is always in-session (user is present). Never try to run it via subagent.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Gap detection | Custom NLP/regex gap extractor | LLM synthesizer with structured output template | The synthesizer IS an LLM -- it identifies gaps naturally; just constrain its output format |
| Convergence scoring | Numeric confidence algorithms | Simple heuristic: gap count + dimension confidence + pass count | Research is subjective; a simple heuristic is more predictable than pseudo-scientific scoring |
| Research deduplication | Content hashing or similarity detection | File path separation (pass-1/, pass-2/) + synthesizer instructions to merge | The synthesizer already reads all prior findings; it handles dedup as part of synthesis |
| Interview question generation | Template library of questions per domain | LLM generates phase-specific gray areas (GSD pattern) | Every phase has unique gray areas; templates would be too generic |
| Research scheduling/queuing | Task queue with priorities | Simple sequential loop in skill orchestrator | Max 4 passes with max 4 researchers each = max 20 agent spawns total; no queue needed |

## Common Pitfalls

### Pitfall 1: Infinite Research Loops

**What goes wrong:** Research never converges. The synthesizer always finds new gaps, or gap count oscillates instead of trending down.

**Why it happens:** LLM confidence assessment is subjective. A synthesizer might identify new "gaps" that are actually low-priority edge cases, keeping the loop running.

**How to avoid:**
- Hard cap of 4 passes (non-negotiable, checked in orchestrator)
- Diminishing returns detection: if `new_gaps.length >= previous_gaps.length`, stop -- not making progress
- Synthesizer must output a `CONTINUE` or `STOP` recommendation with justification
- Orchestrator checks ALL THREE: hard cap, diminishing returns, and synthesizer recommendation

**Warning signs:** Pass 3+ with same gap count as pass 2. Synthesizer identifying increasingly obscure gaps.

### Pitfall 2: Context Overload on Later Passes

**What goes wrong:** By pass 3-4, the synthesizer must read findings from all prior passes. If each pass produced 4 files of 5KB each, the synthesizer has 60KB+ of input context.

**Why it happens:** Cumulative findings grow linearly with passes.

**How to avoid:**
- The synthesizer reads the PREVIOUS synthesis + NEW pass findings only (not raw findings from all passes)
- Previous synthesis already contains the merged view of all prior passes
- This keeps synthesizer input bounded: ~5KB synthesis + ~5KB new findings per gap

**Warning signs:** Synthesizer agent hitting context limits. Synthesis quality degrading on later passes.

### Pitfall 3: Researcher File Collisions

**What goes wrong:** Two parallel researchers write to overlapping files, causing corruption.

**Why it happens:** Researchers run in parallel via Task() calls. If they share output paths, race conditions occur.

**How to avoid:**
- Each researcher writes to a uniquely-named file (e.g., `pass-1/stack.md`, `pass-1/features.md`)
- No two researchers ever share an output file
- The synthesizer is the only agent that merges findings

**Warning signs:** Truncated or garbled research files after a parallel spawn.

### Pitfall 4: Discuss Phase Scope Creep

**What goes wrong:** The discuss interview expands beyond the phase boundary, capturing decisions about features that belong in other phases.

**Why it happens:** Users naturally think beyond the current phase when discussing their vision.

**How to avoid:**
- State the phase boundary explicitly at the start of discussion
- Use the scope guardrail heuristic: "Does this clarify HOW to implement what's already scoped, or does it add a new capability?"
- Capture out-of-scope ideas in the "Deferred Ideas" section of CONTEXT.md

**Warning signs:** CONTEXT.md decisions reference features not in the current phase's requirements.

### Pitfall 5: Synthesizer Producing Vague Gaps

**What goes wrong:** The synthesizer identifies gaps like "need more research on architecture" without specificity. The next round of researchers don't know what to investigate.

**Why it happens:** Without a structured gap format, the synthesizer defaults to vague language.

**How to avoid:**
- Require structured `<gaps>` block with dimension, topic, priority, and reason fields
- The orchestrator validates that each gap has a specific topic (not just a dimension name)
- Researcher prompts include the exact gap topic and reason

**Warning signs:** Gap topics that are just dimension names ("features", "architecture") without specifics.

## Code Examples

### Research CLI Module (new file: bin/lib/research.cjs)

```javascript
// Source: Follows existing DAN module pattern from state.cjs, phase.cjs
'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, atomicWriteFileSync } = require('./core.cjs');

function getStatePath(cwd, target) {
  if (target === 'project') {
    return path.join(cwd, '.planning', 'research', 'state.json');
  }
  // Phase target: "3" or "03"
  const padded = String(target).replace(/^0+/, '').padStart(2, '0');
  const phasesDir = path.join(cwd, '.planning', 'phases');
  const dirs = fs.readdirSync(phasesDir).filter(d => d.startsWith(padded + '-'));
  if (dirs.length === 0) error('Phase not found: ' + target);
  return path.join(phasesDir, dirs[0], 'research', 'state.json');
}

function initResearch(cwd, target, maxPasses) {
  const statePath = getStatePath(cwd, target);
  const dir = path.dirname(statePath);
  fs.mkdirSync(dir, { recursive: true });

  const state = {
    target: target === 'project' ? 'project' : 'phase-' + target,
    max_passes: maxPasses || 4,
    current_pass: 0,
    passes: [],
    converged: false,
    convergence_reason: null
  };

  atomicWriteFileSync(statePath, JSON.stringify(state, null, 2));
  return state;
}

function recordPass(cwd, target, passNum, gaps, confidence) {
  const statePath = getStatePath(cwd, target);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));

  state.current_pass = passNum;
  state.passes.push({
    pass: passNum,
    completed: new Date().toISOString(),
    gaps_found: gaps.length,
    gaps: gaps,
    confidence: confidence
  });

  atomicWriteFileSync(statePath, JSON.stringify(state, null, 2));
  return state;
}

function checkConvergence(cwd, target) {
  const statePath = getStatePath(cwd, target);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));

  const lastPass = state.passes[state.passes.length - 1];
  if (!lastPass) return { should_continue: true, reason: 'no passes completed yet' };

  // Check 1: Hard cap
  if (state.current_pass >= state.max_passes) {
    return { should_continue: false, reason: 'hard cap reached (' + state.max_passes + ' passes)' };
  }

  // Check 2: No gaps
  if (lastPass.gaps_found === 0) {
    return { should_continue: false, reason: 'no gaps remaining' };
  }

  // Check 3: All dimensions HIGH
  const conf = lastPass.confidence || {};
  const allHigh = Object.values(conf).every(v => v === 'HIGH');
  if (allHigh) {
    return { should_continue: false, reason: 'all dimensions HIGH confidence' };
  }

  // Check 4: Diminishing returns (gap count not decreasing)
  if (state.passes.length >= 2) {
    const prevPass = state.passes[state.passes.length - 2];
    if (lastPass.gaps_found >= prevPass.gaps_found) {
      return { should_continue: false, reason: 'diminishing returns (gaps not decreasing)' };
    }
  }

  return { should_continue: true, reason: 'gaps remain and progress being made' };
}
```

### Skill Orchestrator Loop (dan:research execution_flow)

```markdown
<step name="research_loop">
## Step 4: Recursive Research Loop

Initialize research state:
\`\`\`bash
node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" research init "$TARGET" --max-passes 4
\`\`\`

Set initial research dimensions:
- Pass 1: ["stack", "features", "architecture", "pitfalls"] (full scope)
- Pass 2+: only dimensions with gaps from previous synthesis

### Loop Body

For each pass (while convergence check says continue):

1. **Spawn researchers** -- one Task() per gap dimension:
   \`\`\`
   Task(prompt="...", subagent_type="dan-researcher", description="[dimension] research pass [N]")
   \`\`\`

2. **Spawn synthesizer** -- reads previous synthesis + new findings:
   \`\`\`
   Task(prompt="...", subagent_type="dan-synthesizer", description="Synthesize pass [N]")
   \`\`\`

3. **Record pass results:**
   \`\`\`bash
   node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" research record-pass "$TARGET" \
     --pass $PASS_NUM --gaps "$GAPS_JSON" --confidence "$CONFIDENCE_JSON"
   \`\`\`

4. **Check convergence:**
   \`\`\`bash
   RESULT=$(node "$HOME/.claude/dan/bin/dan-tools.cjs" --cwd "$PROJECT_DIR" research check-convergence "$TARGET")
   \`\`\`

   Parse `should_continue` from result. If false, exit loop.

5. **Extract gaps** for next pass from synthesis output.

### Loop Termination

Display research summary:
\`\`\`
Research complete after [N] passes.
Reason: [convergence_reason]
Confidence: [per-dimension summary]
Gaps resolved: [count from pass 1] -> [count remaining]
\`\`\`
</step>
```

### Synthesizer Gap Output Parsing

The orchestrator skill must parse the synthesizer's `<gaps>` block. Since this runs in the skill (which is Claude itself), it reads the synthesis.md file and extracts gaps naturally from the structured format. No CLI parsing needed -- the LLM orchestrator reads the file and understands the gap structure.

For the CLI-based convergence check, the orchestrator passes the gap count and confidence as JSON arguments to `research record-pass`, which it extracts from reading the synthesis file.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-pass research (GSD) | Multi-pass with gap detection (DAN) | DAN Phase 3 | 4x more thorough research; catches blind spots single-pass misses |
| No discuss phase | Structured interview before research (GSD v2 discuss-phase) | GSD March 2026 | Prevents building the wrong thing; decisions captured before code |
| Manual stop/continue | Automatic convergence detection | DAN Phase 3 | Research terminates reliably without human babysitting |
| Flat research files | Pass-segregated directories | DAN Phase 3 | Enables cumulative synthesis without overwriting prior findings |

## Open Questions

1. **Project-level vs phase-level research flow**
   - What we know: GSD runs project-level research during `new-project` (4 researchers + synthesizer, single pass). DAN needs both project-level (RSRCH-09) and phase-level (RSRCH-01) research.
   - What's unclear: Should `/dan:research` handle both, or should project-level stay in `/dan:init`? The init skill stub mentions discuss but not research.
   - Recommendation: `/dan:research project` for project-level, `/dan:research <phase>` for phase-level. Same recursive loop, different output paths. `/dan:init` can call `/dan:research project` internally.

2. **Synthesizer model selection**
   - What we know: GSD uses a configurable model for the synthesizer. DAN's stub says `model: inherit` (inherits from parent).
   - What's unclear: Is `inherit` (likely opus/sonnet) the right choice for synthesis, or should it use haiku like researchers?
   - Recommendation: Keep `inherit` for synthesizer. Synthesis requires judgment (gap detection, confidence assessment) which benefits from a stronger model. Researchers use haiku because they're doing breadth exploration where speed matters more.

3. **Research dimensions for phase-level research**
   - What we know: Project-level uses stack/features/architecture/pitfalls. Phase-level research in GSD uses a single gsd-phase-researcher (not 4 parallel).
   - What's unclear: Should DAN's phase-level research use 4 parallel researchers or a single researcher?
   - Recommendation: Phase-level should use fewer, more targeted researchers. For phase-level: 2-3 researchers focused on the phase's specific domain (e.g., for Phase 3 itself: "orchestration patterns", "convergence heuristics", "interview design"). The orchestrator determines appropriate dimensions based on phase goal.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js built-in test runner (node:test) |
| Config file | None (inline in test files) |
| Quick run command | `node bin/tests/test-research.cjs` |
| Full suite command | `node --test bin/tests/test-*.cjs` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RSRCH-01 | Research CLI init/record-pass/check-convergence cycle | unit | `node bin/tests/test-research.cjs` | Wave 0 |
| RSRCH-02 | Hard cap at 4 passes; diminishing returns detection | unit | `node bin/tests/test-research.cjs::convergence` | Wave 0 |
| RSRCH-03 | Parallel researcher spawning | manual-only | Verify 4 Task() calls in skill execution_flow | N/A (skill is markdown) |
| RSRCH-04 | Synthesizer produces confidence + gaps in structured format | manual-only | Verify agent prompt enforces output format | N/A (agent is markdown) |
| RSRCH-05 | Gap-targeted researchers on pass 2+ | manual-only | Verify skill passes gap context to researcher prompts | N/A (skill is markdown) |
| RSRCH-06 | Convergence check returns correct should_continue | unit | `node bin/tests/test-research.cjs::convergence` | Wave 0 |
| RSRCH-07 | Discuss skill has complete execution_flow | manual-only | Read and verify SKILL.md structure | N/A (skill is markdown) |
| RSRCH-08 | CONTEXT.md output has required sections | manual-only | Verify template in discuss skill | N/A (skill is markdown) |
| RSRCH-09 | Project-level research uses 4 researchers | manual-only | Verify skill handles "project" target | N/A (skill is markdown) |

### Sampling Rate

- **Per task commit:** `node bin/tests/test-research.cjs`
- **Per wave merge:** `node --test bin/tests/test-*.cjs`
- **Phase gate:** Full suite green before verification

### Wave 0 Gaps

- [ ] `bin/tests/test-research.cjs` -- covers RSRCH-01, RSRCH-02, RSRCH-06 (research CLI module unit tests)
- [ ] `bin/lib/research.cjs` -- the module under test (does not exist yet)

Note: Most Phase 3 requirements (RSRCH-03 through RSRCH-09) involve markdown skill/agent prompt engineering, which is verified manually by reading the output files. Only the research CLI module (RSRCH-01, RSRCH-02, RSRCH-06) has unit-testable logic.

## Sources

### Primary (HIGH confidence)

- **GSD new-project.md** (C:/Users/dsbog/.claude/get-shit-done/workflows/new-project.md) -- Lines 500-740: Complete 4-researcher + synthesizer pattern with Task() spawn syntax, file output paths, and commit flow
- **GSD discuss-phase.md** (C:/Users/dsbog/.claude/get-shit-done/workflows/discuss-phase.md) -- Complete discuss/interview implementation: gray area identification, scope guardrails, prior decision loading, CONTEXT.md output format
- **GSD research-phase.md** (C:/Users/dsbog/.claude/get-shit-done/workflows/research-phase.md) -- Standalone research command showing researcher spawn and return handling
- **GSD gsd-research-synthesizer.md** (C:/Users/dsbog/.claude/agents/gsd-research-synthesizer.md) -- Synthesizer agent: reads 4 files, produces SUMMARY.md, commits all research
- **GSD gsd-project-researcher.md** (C:/Users/dsbog/.claude/agents/gsd-project-researcher.md) -- Researcher agent: tool access, research modes, Context7-first tool strategy
- **GSD questioning.md** (C:/Users/dsbog/.claude/get-shit-done/references/questioning.md) -- Interview philosophy: collaborative thinking, not interrogation; AskUserQuestion patterns
- **DAN existing agents** (C:/Users/dsbog/dan/.claude/agents/dan-researcher.md, dan-synthesizer.md) -- Current stubs with boundaries, tool access, output format
- **DAN existing skills** (C:/Users/dsbog/dan/.claude/skills/dan-research/SKILL.md, dan-discuss/SKILL.md) -- Current stubs with basic structure
- **DAN ARCHITECTURE.md** (C:/Users/dsbog/dan/.planning/research/ARCHITECTURE.md) -- Lines 96-107: Research flow diagram showing recursive loop design
- **DAN CLI modules** (C:/Users/dsbog/dan/bin/lib/*.cjs) -- Existing module patterns for state, phase, config, commit operations

### Secondary (MEDIUM confidence)

- **DAN project research SUMMARY.md** (C:/Users/dsbog/dan/.planning/research/SUMMARY.md) -- Convergence heuristic recommendations and research flags for Phase 3
- **DAN PITFALLS.md** (C:/Users/dsbog/dan/.planning/research/PITFALLS.md) -- Infinite loop prevention, context rot mitigation, subagent nesting constraint

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- All components are extensions of existing DAN patterns (CLI modules, skills, agents) with GSD providing battle-tested reference implementations
- Architecture: HIGH -- Recursive loop design well-documented in DAN ARCHITECTURE.md; GSD's single-pass pattern directly extensible to multi-pass
- Pitfalls: HIGH -- Infinite loops, context overload, file collisions, scope creep all have documented prevention strategies from GSD operational data
- Convergence heuristics: MEDIUM -- The specific thresholds (gap count trending, all-HIGH confidence) are reasonable but untested in production; expect tuning over first 3-5 real usages

**Research date:** 2026-03-28
**Valid until:** 2026-04-28 (stable domain; internal tooling patterns don't change rapidly)
