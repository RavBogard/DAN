#!/usr/bin/env node
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const MILESTONE_PATH = path.join(__dirname, '..', 'lib', 'milestone.cjs');
const ROUTER_PATH = path.join(__dirname, '..', 'dan-tools.cjs');

describe('milestone.cjs exports', () => {
  it('exports handle, getMilestoneStatus, getPipelineOrder, validateWavePartitioning, recordPhaseError, getProgress', () => {
    const m = require(MILESTONE_PATH);
    assert.equal(typeof m.handle, 'function', 'handle must be a function');
    assert.equal(typeof m.getMilestoneStatus, 'function', 'getMilestoneStatus must be a function');
    assert.equal(typeof m.getPipelineOrder, 'function', 'getPipelineOrder must be a function');
    assert.equal(typeof m.validateWavePartitioning, 'function', 'validateWavePartitioning must be a function');
    assert.equal(typeof m.recordPhaseError, 'function', 'recordPhaseError must be a function');
    assert.equal(typeof m.getProgress, 'function', 'getProgress must be a function');
  });
});

describe('getMilestoneStatus', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-ms-status-'));
    const planningDir = path.join(tmpDir, '.planning');
    const phasesDir = path.join(planningDir, 'phases');
    fs.mkdirSync(phasesDir, { recursive: true });

    // STATE.md with frontmatter
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), [
      '---',
      'gsd_state_version: 1.0',
      'milestone: v1.0',
      'milestone_name: milestone',
      'status: in_progress',
      '---',
      '',
      '# Project State',
      '',
      '## Current Position',
      '',
      'Phase: 2 of 3 (core-loop)',
      'Plan: 1 of 2 in current phase',
      'Status: in_progress',
      ''
    ].join('\n'), 'utf-8');

    // Phase 1 complete (has summary)
    const p1 = path.join(phasesDir, '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '---\nphase: 01\nplan: 01\n---\n', 'utf-8');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary\n', 'utf-8');

    // Phase 2 in-progress (no summary)
    const p2 = path.join(phasesDir, '02-core-loop');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, '02-01-PLAN.md'), '---\nphase: 02\nplan: 01\n---\n', 'utf-8');
    fs.writeFileSync(path.join(p2, '02-02-PLAN.md'), '---\nphase: 02\nplan: 02\n---\n', 'utf-8');

    // Phase 3 not started
    const p3 = path.join(phasesDir, '03-autonomy');
    fs.mkdirSync(p3, { recursive: true });
    fs.writeFileSync(path.join(p3, '03-01-PLAN.md'), '---\nphase: 03\nplan: 01\n---\n', 'utf-8');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns milestone, status, completed/remaining phases, current_phase', () => {
    const m = require(MILESTONE_PATH);
    const result = m.getMilestoneStatus(tmpDir);
    assert.equal(result.milestone, 'v1.0');
    assert.equal(result.status, 'in_progress');
    assert.ok(Array.isArray(result.phases_complete), 'phases_complete should be array');
    assert.ok(Array.isArray(result.phases_remaining), 'phases_remaining should be array');
    // Phase 1 is complete (1 plan, 1 summary)
    assert.ok(result.phases_complete.some(p => p.phase === '01'), 'phase 01 should be complete');
    // Phase 2 has 2 plans, 0 summaries -- not complete
    assert.ok(result.phases_remaining.some(p => p.phase === '02'), 'phase 02 should be remaining');
    assert.ok(result.phases_remaining.some(p => p.phase === '03'), 'phase 03 should be remaining');
    assert.equal(result.current_phase, '02');
  });
});

describe('getPipelineOrder', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-ms-order-'));
    const planningDir = path.join(tmpDir, '.planning');
    fs.mkdirSync(planningDir, { recursive: true });

    // ROADMAP.md with dependency info
    fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), [
      '# Roadmap',
      '',
      '## Phase Details',
      '',
      '### Phase 1: Foundation',
      '**Depends on**: Nothing',
      '',
      '### Phase 2: Core Loop',
      '**Depends on**: Phase 1',
      '',
      '### Phase 3: Research',
      '**Depends on**: Phase 1',
      '',
      '### Phase 4: Verification',
      '**Depends on**: Phase 2',
      '',
      '### Phase 5: Autonomy',
      '**Depends on**: Phase 2, Phase 3, Phase 4',
      ''
    ].join('\n'), 'utf-8');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns phases in dependency order', () => {
    const m = require(MILESTONE_PATH);
    const order = m.getPipelineOrder(tmpDir);
    assert.ok(Array.isArray(order), 'order should be an array');
    // Phase 1 must come first
    assert.ok(order.indexOf('1') < order.indexOf('2'), '1 before 2');
    assert.ok(order.indexOf('1') < order.indexOf('3'), '1 before 3');
    // Phase 2 and 3 both depend on 1, but 4 depends on 2
    assert.ok(order.indexOf('2') < order.indexOf('4'), '2 before 4');
    assert.ok(order.indexOf('3') < order.indexOf('5'), '3 before 5');
    assert.ok(order.indexOf('4') < order.indexOf('5'), '4 before 5');
  });
});

describe('validateWavePartitioning', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-ms-wave-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns valid when no files_modified overlap in same wave', () => {
    const validDir = path.join(tmpDir, 'valid');
    fs.mkdirSync(validDir, { recursive: true });
    fs.writeFileSync(path.join(validDir, '01-01-PLAN.md'), [
      '---',
      'phase: 01',
      'plan: 01',
      'wave: 1',
      'depends_on: []',
      'files_modified:',
      '  - src/a.js',
      '  - src/b.js',
      '---',
      ''
    ].join('\n'), 'utf-8');
    fs.writeFileSync(path.join(validDir, '01-02-PLAN.md'), [
      '---',
      'phase: 01',
      'plan: 02',
      'wave: 1',
      'depends_on: []',
      'files_modified:',
      '  - src/c.js',
      '  - src/d.js',
      '---',
      ''
    ].join('\n'), 'utf-8');

    const m = require(MILESTONE_PATH);
    const result = m.validateWavePartitioning(validDir);
    assert.equal(result.valid, true, 'should be valid when no overlap');
  });

  it('returns invalid with conflicts when files_modified overlap in same wave', () => {
    const conflictDir = path.join(tmpDir, 'conflict');
    fs.mkdirSync(conflictDir, { recursive: true });
    fs.writeFileSync(path.join(conflictDir, '01-01-PLAN.md'), [
      '---',
      'phase: 01',
      'plan: 01',
      'wave: 1',
      'depends_on: []',
      'files_modified:',
      '  - src/shared.js',
      '  - src/a.js',
      '---',
      ''
    ].join('\n'), 'utf-8');
    fs.writeFileSync(path.join(conflictDir, '01-02-PLAN.md'), [
      '---',
      'phase: 01',
      'plan: 02',
      'wave: 1',
      'depends_on: []',
      'files_modified:',
      '  - src/shared.js',
      '  - src/b.js',
      '---',
      ''
    ].join('\n'), 'utf-8');

    const m = require(MILESTONE_PATH);
    const result = m.validateWavePartitioning(conflictDir);
    assert.equal(result.valid, false, 'should be invalid when overlap exists');
    assert.ok(Array.isArray(result.conflicts), 'conflicts should be an array');
    assert.ok(result.conflicts.length > 0, 'should have at least one conflict');
    assert.ok(result.conflicts[0].files.includes('src/shared.js'), 'conflict should mention shared.js');
    assert.equal(result.conflicts[0].wave, 1, 'conflict should be in wave 1');
  });

  it('allows overlap across different waves', () => {
    const crossWaveDir = path.join(tmpDir, 'crosswave');
    fs.mkdirSync(crossWaveDir, { recursive: true });
    fs.writeFileSync(path.join(crossWaveDir, '01-01-PLAN.md'), [
      '---',
      'phase: 01',
      'plan: 01',
      'wave: 1',
      'depends_on: []',
      'files_modified:',
      '  - src/shared.js',
      '---',
      ''
    ].join('\n'), 'utf-8');
    fs.writeFileSync(path.join(crossWaveDir, '01-02-PLAN.md'), [
      '---',
      'phase: 01',
      'plan: 02',
      'wave: 2',
      'depends_on: ["01-01"]',
      'files_modified:',
      '  - src/shared.js',
      '---',
      ''
    ].join('\n'), 'utf-8');

    const m = require(MILESTONE_PATH);
    const result = m.validateWavePartitioning(crossWaveDir);
    assert.equal(result.valid, true, 'overlap across waves should be valid');
  });
});

describe('recordPhaseError', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-ms-error-'));
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
      'Phase: 2 of 3 (core-loop)',
      'Status: in_progress',
      'Stopped at: None',
      ''
    ].join('\n'), 'utf-8');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('updates STATE.md with error context', () => {
    const m = require(MILESTONE_PATH);
    m.recordPhaseError(tmpDir, '02', 'apply', 'Task 3 failed: type mismatch in auth.js');

    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Phase 02'), 'should reference phase 02');
    assert.ok(content.includes('apply'), 'should reference apply stage');
    assert.ok(content.includes('type mismatch'), 'should include error reason');
  });
});

describe('getProgress', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-ms-progress-'));
    const planningDir = path.join(tmpDir, '.planning');
    const phasesDir = path.join(planningDir, 'phases');
    fs.mkdirSync(phasesDir, { recursive: true });

    // Phase 1: 2 plans, 2 complete
    const p1 = path.join(phasesDir, '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '---\nphase: 01\nplan: 01\n---\n', 'utf-8');
    fs.writeFileSync(path.join(p1, '01-02-PLAN.md'), '---\nphase: 01\nplan: 02\n---\n', 'utf-8');
    fs.writeFileSync(path.join(p1, '01-01-SUMMARY.md'), '# Summary\n', 'utf-8');
    fs.writeFileSync(path.join(p1, '01-02-SUMMARY.md'), '# Summary\n', 'utf-8');

    // Phase 2: 3 plans, 1 complete
    const p2 = path.join(phasesDir, '02-core-loop');
    fs.mkdirSync(p2, { recursive: true });
    fs.writeFileSync(path.join(p2, '02-01-PLAN.md'), '---\nphase: 02\nplan: 01\n---\n', 'utf-8');
    fs.writeFileSync(path.join(p2, '02-02-PLAN.md'), '---\nphase: 02\nplan: 02\n---\n', 'utf-8');
    fs.writeFileSync(path.join(p2, '02-03-PLAN.md'), '---\nphase: 02\nplan: 03\n---\n', 'utf-8');
    fs.writeFileSync(path.join(p2, '02-01-SUMMARY.md'), '# Summary\n', 'utf-8');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns correct aggregate progress', () => {
    const m = require(MILESTONE_PATH);
    const result = m.getProgress(tmpDir);
    assert.equal(result.total_phases, 2, 'total_phases should be 2');
    assert.equal(result.completed_phases, 1, 'completed_phases should be 1 (phase 1 fully done)');
    assert.equal(result.total_plans, 5, 'total_plans should be 5');
    assert.equal(result.completed_plans, 3, 'completed_plans should be 3');
    assert.equal(result.percent, 60, 'percent should be 60');
  });
});

describe('milestone CLI via router', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-ms-cli-'));
    const planningDir = path.join(tmpDir, '.planning');
    const phasesDir = path.join(planningDir, 'phases');
    fs.mkdirSync(phasesDir, { recursive: true });

    fs.writeFileSync(path.join(planningDir, 'STATE.md'), [
      '---',
      'gsd_state_version: 1.0',
      'milestone: v1.0',
      'milestone_name: milestone',
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
      ''
    ].join('\n'), 'utf-8');

    const p1 = path.join(phasesDir, '01-foundation');
    fs.mkdirSync(p1, { recursive: true });
    fs.writeFileSync(path.join(p1, '01-01-PLAN.md'), '---\nphase: 01\nplan: 01\nwave: 1\ndepends_on: []\nfiles_modified:\n  - src/a.js\n---\n', 'utf-8');

    fs.writeFileSync(path.join(planningDir, 'ROADMAP.md'), [
      '# Roadmap',
      '',
      '## Phase Details',
      '',
      '### Phase 1: Foundation',
      '**Depends on**: Nothing',
      ''
    ].join('\n'), 'utf-8');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('milestone status returns JSON', () => {
    const result = execFileSync('node', [ROUTER_PATH, '--cwd', tmpDir, 'milestone', 'status'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.equal(parsed.milestone, 'v1.0');
    assert.ok(parsed.phases_complete !== undefined, 'should have phases_complete');
  });

  it('milestone progress returns JSON with counts', () => {
    const result = execFileSync('node', [ROUTER_PATH, '--cwd', tmpDir, 'milestone', 'progress'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.equal(typeof parsed.total_plans, 'number');
    assert.equal(typeof parsed.percent, 'number');
  });

  it('milestone pipeline-order returns array', () => {
    const result = execFileSync('node', [ROUTER_PATH, '--cwd', tmpDir, 'milestone', 'pipeline-order'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.ok(Array.isArray(parsed.order), 'should have order array');
  });

  it('milestone validate-wave returns valid result', () => {
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-foundation');
    const result = execFileSync('node', [ROUTER_PATH, '--cwd', tmpDir, 'milestone', 'validate-wave', phaseDir], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.equal(parsed.valid, true);
  });
});
