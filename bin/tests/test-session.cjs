#!/usr/bin/env node
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const SESSION_PATH = path.join(__dirname, '..', 'lib', 'session.cjs');
const ROUTER_PATH = path.join(__dirname, '..', 'dan-tools.cjs');

describe('session.cjs exports', () => {
  it('exports handle, saveSession, restoreSession, determineNextAction', () => {
    const s = require(SESSION_PATH);
    assert.equal(typeof s.handle, 'function', 'handle must be a function');
    assert.equal(typeof s.saveSession, 'function', 'saveSession must be a function');
    assert.equal(typeof s.restoreSession, 'function', 'restoreSession must be a function');
    assert.equal(typeof s.determineNextAction, 'function', 'determineNextAction must be a function');
  });
});

describe('saveSession', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-sess-save-'));
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), [
      '---',
      'gsd_state_version: 1.0',
      'milestone: v1.0',
      'status: in_progress',
      '---',
      '',
      '# Project State',
      '',
      '## Current Position',
      '',
      'Phase: 3 of 5 (research)',
      'Plan: 2 of 3 in current phase',
      'Status: in_progress',
      'Stopped at: None',
      ''
    ].join('\n'), 'utf-8');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes pipeline position fields to STATE.md frontmatter and sets status to paused', () => {
    const s = require(SESSION_PATH);
    s.saveSession(tmpDir, {
      phase: 3,
      plan: '03-02',
      task: 2,
      stage: 'apply'
    });

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');

    // Check frontmatter has flat pipeline_* keys
    assert.ok(content.includes('pipeline_phase'), 'should have pipeline_phase in frontmatter');
    assert.ok(content.includes('pipeline_plan'), 'should have pipeline_plan in frontmatter');
    assert.ok(content.includes('pipeline_task'), 'should have pipeline_task in frontmatter');
    assert.ok(content.includes('pipeline_stage'), 'should have pipeline_stage in frontmatter');

    // Check status changed to paused
    assert.ok(content.includes('paused'), 'status should be paused');

    // Check stopped_at was updated
    assert.ok(content.includes('Phase 3, plan 03-02, task 2, stage: apply'), 'stopped_at should have formatted position');
  });
});

describe('restoreSession', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-sess-restore-'));
    const planningDir = path.join(tmpDir, '.planning');
    const phasesDir = path.join(planningDir, 'phases');
    fs.mkdirSync(phasesDir, { recursive: true });

    // Create a phase dir with a plan (needed for determineNextAction)
    const p1 = path.join(phasesDir, '03-research');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '03-01-PLAN.md'), '---\nphase: 03\nplan: 01\n---\n', 'utf-8');
    fs.writeFileSync(path.join(p1, '03-02-PLAN.md'), '---\nphase: 03\nplan: 02\n---\n', 'utf-8');

    fs.writeFileSync(path.join(planningDir, 'STATE.md'), [
      '---',
      'gsd_state_version: 1.0',
      'milestone: v1.0',
      'status: paused',
      'pipeline_phase: 3',
      'pipeline_plan: 03-02',
      'pipeline_task: 2',
      'pipeline_stage: apply',
      'pipeline_wave: 1',
      '---',
      '',
      '# Project State',
      '',
      '## Current Position',
      '',
      'Phase: 3 of 5 (research)',
      'Plan: 2 of 3 in current phase',
      'Status: paused',
      'Stopped at: Phase 3, plan 03-02, task 2, stage: apply',
      '',
      '## Accumulated Context',
      '',
      '### Decisions',
      '',
      '- Use JWT for auth',
      '- PostgreSQL over MongoDB',
      '',
      '### Blockers/Concerns',
      '',
      '- API rate limit unclear',
      ''
    ].join('\n'), 'utf-8');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns position, next_action, decisions, and blockers', () => {
    const s = require(SESSION_PATH);
    const result = s.restoreSession(tmpDir);

    assert.ok(result.position, 'should have position');
    assert.equal(result.position.phase, 3, 'phase should be 3');
    assert.equal(result.position.plan, '03-02', 'plan should be 03-02');
    assert.equal(result.position.task, 2, 'task should be 2');
    assert.equal(result.position.stage, 'apply', 'stage should be apply');

    assert.ok(result.next_action, 'should have next_action');
    assert.ok(result.next_action.action, 'next_action should have action');
    assert.ok(result.next_action.skill, 'next_action should have skill');

    assert.ok(Array.isArray(result.decisions), 'decisions should be an array');
    assert.ok(result.decisions.length > 0, 'should have decisions');

    assert.ok(Array.isArray(result.blockers), 'blockers should be an array');
  });
});

describe('saveSession + restoreSession round-trip', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-sess-rt-'));
    const planningDir = path.join(tmpDir, '.planning');
    const phasesDir = path.join(planningDir, 'phases');
    fs.mkdirSync(phasesDir, { recursive: true });

    const p1 = path.join(phasesDir, '03-research');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '03-01-PLAN.md'), '---\nphase: 03\nplan: 01\n---\n', 'utf-8');
    fs.writeFileSync(path.join(p1, '03-02-PLAN.md'), '---\nphase: 03\nplan: 02\n---\n', 'utf-8');

    fs.writeFileSync(path.join(planningDir, 'STATE.md'), [
      '---',
      'gsd_state_version: 1.0',
      'milestone: v1.0',
      'status: in_progress',
      '---',
      '',
      '# Project State',
      '',
      '## Current Position',
      '',
      'Phase: 3 of 5 (research)',
      'Plan: 2 of 3 in current phase',
      'Status: in_progress',
      'Stopped at: None',
      '',
      '## Accumulated Context',
      '',
      '### Decisions',
      '',
      '- Decision A',
      '',
      '### Blockers/Concerns',
      '',
      '- Blocker X',
      ''
    ].join('\n'), 'utf-8');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('restoreSession returns the same position that was saved', () => {
    const s = require(SESSION_PATH);
    const position = { phase: 3, plan: '03-02', task: 2, stage: 'apply', wave: 1 };

    s.saveSession(tmpDir, position);
    const result = s.restoreSession(tmpDir);

    assert.equal(result.position.phase, 3);
    assert.equal(result.position.plan, '03-02');
    assert.equal(result.position.task, 2);
    assert.equal(result.position.stage, 'apply');
    assert.equal(result.position.wave, 1);
  });
});

describe('determineNextAction', () => {
  it('returns resume for paused status', () => {
    const s = require(SESSION_PATH);
    const result = s.determineNextAction({
      status: 'paused',
      pipeline_phase: 2,
      pipeline_plan: '02-01',
      pipeline_stage: 'apply'
    });
    assert.equal(result.action, 'resume');
    assert.equal(result.skill, 'dan:resume');
  });

  it('returns apply for in_progress plan', () => {
    const s = require(SESSION_PATH);
    const result = s.determineNextAction({
      status: 'in_progress',
      pipeline_phase: 2,
      pipeline_plan: '02-01',
      pipeline_stage: 'apply'
    });
    assert.equal(result.action, 'continue-apply');
    assert.equal(result.skill, 'dan:apply');
  });

  it('returns verify when all plans done but no verification', () => {
    const s = require(SESSION_PATH);
    const result = s.determineNextAction({
      status: 'in_progress',
      all_plans_done: true,
      has_verification: false
    });
    assert.equal(result.action, 'verify');
    assert.equal(result.skill, 'dan:verify');
  });

  it('returns bugsweep when verification has gaps', () => {
    const s = require(SESSION_PATH);
    const result = s.determineNextAction({
      status: 'in_progress',
      all_plans_done: true,
      has_verification: true,
      verification_gaps: true
    });
    assert.equal(result.action, 'bugsweep');
    assert.equal(result.skill, 'dan:bugsweep');
  });

  it('returns next-phase when phase is done', () => {
    const s = require(SESSION_PATH);
    const result = s.determineNextAction({
      status: 'in_progress',
      all_plans_done: true,
      has_verification: true,
      verification_gaps: false,
      phase_complete: true,
      has_more_phases: true
    });
    assert.equal(result.action, 'next-phase');
    assert.equal(result.skill, 'dan:milestone');
  });

  it('returns complete when all done', () => {
    const s = require(SESSION_PATH);
    const result = s.determineNextAction({
      status: 'in_progress',
      all_plans_done: true,
      has_verification: true,
      verification_gaps: false,
      phase_complete: true,
      has_more_phases: false
    });
    assert.equal(result.action, 'complete');
    assert.equal(result.skill, 'dan:status');
  });

  it('returns plan when no plans exist', () => {
    const s = require(SESSION_PATH);
    const result = s.determineNextAction({
      status: 'in_progress',
      no_plans: true
    });
    assert.equal(result.action, 'plan');
    assert.equal(result.skill, 'dan:plan');
  });

  it('returns research when no research exists', () => {
    const s = require(SESSION_PATH);
    const result = s.determineNextAction({
      status: 'in_progress',
      no_research: true
    });
    assert.equal(result.action, 'research');
    assert.equal(result.skill, 'dan:research');
  });
});

describe('session CLI via router', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-sess-cli-'));
    const planningDir = path.join(tmpDir, '.planning');
    const phasesDir = path.join(planningDir, 'phases');
    fs.mkdirSync(phasesDir, { recursive: true });

    const p1 = path.join(phasesDir, '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '---\nphase: 01\nplan: 01\n---\n', 'utf-8');

    fs.writeFileSync(path.join(planningDir, 'STATE.md'), [
      '---',
      'gsd_state_version: 1.0',
      'milestone: v1.0',
      'status: in_progress',
      '---',
      '',
      '# Project State',
      '',
      '## Current Position',
      '',
      'Phase: 1 of 1 (foundation)',
      'Plan: 1 of 1 in current phase',
      'Status: in_progress',
      'Stopped at: None',
      ''
    ].join('\n'), 'utf-8');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('session save writes position and session restore reads it back', () => {
    const position = JSON.stringify({ phase: 1, plan: '01-01', task: 1, stage: 'apply' });
    execFileSync('node', [ROUTER_PATH, '--cwd', tmpDir, 'session', 'save', position], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    const result = execFileSync('node', [ROUTER_PATH, '--cwd', tmpDir, 'session', 'restore'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.ok(parsed.position, 'should have position');
    assert.equal(parsed.position.phase, 1);
    assert.equal(parsed.position.plan, '01-01');
  });

  it('session next-action returns JSON with action and skill', () => {
    const result = execFileSync('node', [ROUTER_PATH, '--cwd', tmpDir, 'session', 'next-action'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.ok(parsed.action, 'should have action');
    assert.ok(parsed.skill, 'should have skill');
  });
});

describe('router includes milestone and session in usage', () => {
  it('usage string includes milestone and session', () => {
    try {
      execFileSync('node', [ROUTER_PATH, 'nonexistent-command'], {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
    } catch (err) {
      assert.ok(err.stderr.includes('milestone'), 'usage should mention milestone');
      assert.ok(err.stderr.includes('session'), 'usage should mention session');
    }
  });
});
