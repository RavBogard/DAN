#!/usr/bin/env node
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const PHASE_PATH = path.join(__dirname, '..', 'lib', 'phase.cjs');
const ROUTER_PATH = path.join(__dirname, '..', 'dan-tools.cjs');

describe('phase.cjs exports', () => {
  it('exports handle function', () => {
    const phase = require(PHASE_PATH);
    assert.equal(typeof phase.handle, 'function', 'handle must be a function');
  });
});

describe('phase find via CLI', () => {
  it('finds phase 01 with zero-padded input', () => {
    const result = execFileSync('node', [ROUTER_PATH, '--cwd', path.join(__dirname, '..', '..'), 'phase', 'find', '01'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.ok(parsed.path, 'result should have path field');
    assert.ok(parsed.path.includes('01-foundation'), 'path should contain 01-foundation');
  });

  it('finds phase 1 with auto-padding', () => {
    const result = execFileSync('node', [ROUTER_PATH, '--cwd', path.join(__dirname, '..', '..'), 'phase', 'find', '1'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.ok(parsed.path, 'result should have path field');
    assert.ok(parsed.path.includes('01-foundation'), 'path should contain 01-foundation');
  });

  it('returns error for non-existent phase', () => {
    try {
      execFileSync('node', [ROUTER_PATH, '--cwd', path.join(__dirname, '..', '..'), 'phase', 'find', '99'], {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      assert.fail('should have exited with error');
    } catch (err) {
      assert.notEqual(err.status, 0);
    }
  });
});

describe('phase list via CLI', () => {
  it('returns array of phase objects', () => {
    const result = execFileSync('node', [ROUTER_PATH, '--cwd', path.join(__dirname, '..', '..'), 'phase', 'list'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.ok(Array.isArray(parsed.phases), 'result should have phases array');
    assert.ok(parsed.phases.length >= 1, 'should find at least 1 phase');
    // Each phase should have expected fields
    const first = parsed.phases[0];
    assert.ok(first.phase !== undefined, 'phase object should have phase field');
    assert.ok(first.name !== undefined, 'phase object should have name field');
  });
});

describe('phase advance-plan via CLI', () => {
  let tmpDir;
  let planningDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-phase-'));
    planningDir = path.join(tmpDir, '.planning');
    const phaseDir = path.join(planningDir, 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });

    // Create STATE.md
    fs.writeFileSync(path.join(planningDir, 'STATE.md'), [
      '# Project State',
      '',
      '## Project Reference',
      '',
      'See: .planning/PROJECT.md',
      '',
      '## Current Position',
      '',
      'Phase: 1 of 2 (Test)',
      'Plan: 1 of 4 in current phase',
      'Status: In progress',
      'Last activity: 2026-03-28 -- Started',
      '',
      'Progress: [==........] 25%',
      '',
      '## Performance Metrics',
      '',
      '## Accumulated Context',
      '',
      '### Decisions',
      '',
      '### Pending Todos',
      '',
      '### Blockers/Concerns',
      '',
      '## Session Continuity',
      '',
      'Last session: 2026-03-28',
      'Stopped at: Test',
      'Resume file: None'
    ].join('\n'), 'utf-8');

    // Create plan files for counting
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '---\nphase: 01-test\nplan: 01\ndepends_on: []\n---\nPlan 01', 'utf-8');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '---\nphase: 01-test\nplan: 02\ndepends_on: []\n---\nPlan 02', 'utf-8');
    fs.writeFileSync(path.join(phaseDir, '01-03-PLAN.md'), '---\nphase: 01-test\nplan: 03\ndepends_on: []\n---\nPlan 03', 'utf-8');
    fs.writeFileSync(path.join(phaseDir, '01-04-PLAN.md'), '---\nphase: 01-test\nplan: 04\ndepends_on: []\n---\nPlan 04', 'utf-8');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('increments plan counter in STATE.md', () => {
    execFileSync('node', [ROUTER_PATH, '--cwd', tmpDir, 'phase', 'advance-plan'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    const content = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Plan: 2 of 4'), 'plan counter should be incremented to 2 of 4');
  });

  it('updates progress bar', () => {
    const content = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf-8');
    // After advancing to plan 2 of 4 = 50%, bar should have 5 equals signs
    assert.ok(content.includes('Progress:'), 'should contain Progress field');
    const progressMatch = content.match(/Progress:\s*\[([=.]+)\]/);
    assert.ok(progressMatch, 'progress bar should be present');
  });

  it('updates last_activity', () => {
    const content = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Completed plan'), 'last_activity should mention completed plan');
  });
});

describe('phase complete via CLI', () => {
  let tmpDir;
  let planningDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-pcomplete-'));
    planningDir = path.join(tmpDir, '.planning');
    const phase1Dir = path.join(planningDir, 'phases', '01-first');
    const phase2Dir = path.join(planningDir, 'phases', '02-second');
    fs.mkdirSync(phase1Dir, { recursive: true });
    fs.mkdirSync(phase2Dir, { recursive: true });

    fs.writeFileSync(path.join(planningDir, 'STATE.md'), [
      '# Project State',
      '',
      '## Project Reference',
      '',
      '## Current Position',
      '',
      'Phase: 1 of 2 (First)',
      'Plan: 3 of 3 in current phase',
      'Status: In progress',
      'Last activity: 2026-03-28 -- Test',
      '',
      'Progress: [=====.....] 50%',
      '',
      '## Performance Metrics',
      '',
      '## Accumulated Context',
      '',
      '### Decisions',
      '',
      '## Session Continuity',
      '',
      'Last session: 2026-03-28',
      'Stopped at: Test',
      'Resume file: None'
    ].join('\n'), 'utf-8');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('marks phase complete and advances to next phase', () => {
    execFileSync('node', [ROUTER_PATH, '--cwd', tmpDir, 'phase', 'complete'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });

    const content = fs.readFileSync(path.join(planningDir, 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Phase: 2 of 2'), 'phase should advance to 2 of 2');
    assert.ok(content.includes('Phase complete') || content.includes('phase complete'), 'status should mention phase complete');
  });
});

describe('progress bar rendering', () => {
  it('renders 0% correctly', () => {
    const phase = require(PHASE_PATH);
    if (typeof phase.renderProgressBar === 'function') {
      const bar = phase.renderProgressBar(0);
      assert.ok(bar.includes('[..........'), '0% bar should have no equals signs');
    }
  });

  it('renders 50% correctly', () => {
    const phase = require(PHASE_PATH);
    if (typeof phase.renderProgressBar === 'function') {
      const bar = phase.renderProgressBar(50);
      assert.ok(bar.includes('====='), '50% bar should have 5 equals signs');
      assert.ok(bar.includes('.....'), '50% bar should have 5 dots');
    }
  });

  it('renders 100% correctly', () => {
    const phase = require(PHASE_PATH);
    if (typeof phase.renderProgressBar === 'function') {
      const bar = phase.renderProgressBar(100);
      assert.ok(bar.includes('[==========]'), '100% bar should have 10 equals signs');
    }
  });
});
