---
phase: {{PADDED_PHASE}}-{{PHASE_NAME}}
plan: {{PADDED_PLAN}}
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: true
requirements: []

must_haves:
  truths: []
  artifacts: []
  key_links: []
---

<objective>
[Describe what this plan builds, why it matters, and what the output looks like]
</objective>

<execution_context>
@C:/Users/dsbog/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/dsbog/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
</context>

<interfaces>
<!-- Key types and contracts from prior plans that this plan needs -->
</interfaces>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: [Name]</name>
  <files>[files to create or modify]</files>
  <behavior>
    - [Expected behavior 1]
    - [Expected behavior 2]
  </behavior>
  <action>
    [Implementation instructions]
  </action>
  <verify>
    <automated>[test command]</automated>
  </verify>
  <done>
    - [Done criterion 1]
    - [Done criterion 2]
  </done>
</task>

</tasks>

<verification>
- [Overall verification step 1]
- [Overall verification step 2]
</verification>

<success_criteria>
- [Success criterion 1]
- [Success criterion 2]
</success_criteria>

<output>
After completion, create `.planning/phases/{{PADDED_PHASE}}-{{PHASE_NAME}}/{{PADDED_PHASE}}-{{PADDED_PLAN}}-SUMMARY.md`
</output>
