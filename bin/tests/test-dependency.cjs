#!/usr/bin/env node
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const DEP_PATH = path.join(__dirname, '..', 'lib', 'dependency.cjs');
const ROUTER_PATH = path.join(__dirname, '..', 'dan-tools.cjs');

describe('dependency.cjs exports', () => {
  it('exports handle, topologicalSort, and assignWaves', () => {
    const dep = require(DEP_PATH);
    assert.equal(typeof dep.handle, 'function', 'handle must be a function');
    assert.equal(typeof dep.topologicalSort, 'function', 'topologicalSort must be a function');
    assert.equal(typeof dep.assignWaves, 'function', 'assignWaves must be a function');
  });
});

describe('topologicalSort', () => {
  it('sorts independent plans in id order', () => {
    const dep = require(DEP_PATH);
    const plans = [
      { id: '03', depends_on: [] },
      { id: '01', depends_on: [] },
      { id: '02', depends_on: [] }
    ];
    const sorted = dep.topologicalSort(plans);
    // All are independent, should be sorted by id
    assert.deepEqual(sorted, ['01', '02', '03']);
  });

  it('puts dependencies before dependents', () => {
    const dep = require(DEP_PATH);
    const plans = [
      { id: '02', depends_on: ['01'] },
      { id: '01', depends_on: [] },
      { id: '03', depends_on: ['02'] }
    ];
    const sorted = dep.topologicalSort(plans);
    assert.ok(sorted.indexOf('01') < sorted.indexOf('02'), '01 before 02');
    assert.ok(sorted.indexOf('02') < sorted.indexOf('03'), '02 before 03');
  });

  it('handles multiple dependencies', () => {
    const dep = require(DEP_PATH);
    const plans = [
      { id: '03', depends_on: ['01', '02'] },
      { id: '01', depends_on: [] },
      { id: '02', depends_on: ['01'] }
    ];
    const sorted = dep.topologicalSort(plans);
    assert.ok(sorted.indexOf('01') < sorted.indexOf('02'), '01 before 02');
    assert.ok(sorted.indexOf('01') < sorted.indexOf('03'), '01 before 03');
    assert.ok(sorted.indexOf('02') < sorted.indexOf('03'), '02 before 03');
  });

  it('detects circular dependencies and throws', () => {
    const dep = require(DEP_PATH);
    const plans = [
      { id: '01', depends_on: ['02'] },
      { id: '02', depends_on: ['01'] }
    ];
    assert.throws(() => dep.topologicalSort(plans), /circular/i);
  });

  it('detects 3-node circular dependency', () => {
    const dep = require(DEP_PATH);
    const plans = [
      { id: '01', depends_on: ['03'] },
      { id: '02', depends_on: ['01'] },
      { id: '03', depends_on: ['02'] }
    ];
    assert.throws(() => dep.topologicalSort(plans), /circular/i);
  });
});

describe('assignWaves', () => {
  it('assigns wave 1 to plans with no dependencies', () => {
    const dep = require(DEP_PATH);
    const plans = [
      { id: '01', depends_on: [] },
      { id: '02', depends_on: [] }
    ];
    const waves = dep.assignWaves(plans);
    const wave1 = waves.filter(w => w.wave === 1);
    assert.equal(wave1.length, 2, 'both plans should be wave 1');
  });

  it('assigns correct waves for chain dependency', () => {
    const dep = require(DEP_PATH);
    const plans = [
      { id: '01', depends_on: [] },
      { id: '02', depends_on: ['01'] },
      { id: '03', depends_on: ['02'] }
    ];
    const waves = dep.assignWaves(plans);
    const waveMap = {};
    for (const w of waves) waveMap[w.id] = w.wave;
    assert.equal(waveMap['01'], 1);
    assert.equal(waveMap['02'], 2);
    assert.equal(waveMap['03'], 3);
  });

  it('assigns same wave to parallel plans', () => {
    const dep = require(DEP_PATH);
    const plans = [
      { id: '01', depends_on: [] },
      { id: '02', depends_on: ['01'] },
      { id: '03', depends_on: ['01'] },
      { id: '04', depends_on: ['01'] }
    ];
    const waves = dep.assignWaves(plans);
    const waveMap = {};
    for (const w of waves) waveMap[w.id] = w.wave;
    assert.equal(waveMap['01'], 1);
    assert.equal(waveMap['02'], 2);
    assert.equal(waveMap['03'], 2);
    assert.equal(waveMap['04'], 2);
  });
});

describe('dependency analyze via CLI', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-dep-'));
    // Create test plan files
    fs.writeFileSync(path.join(tmpDir, '01-01-PLAN.md'), '---\nphase: 01-test\nplan: 01\ndepends_on: []\nwave: 1\n---\nPlan 01', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '01-02-PLAN.md'), '---\nphase: 01-test\nplan: 02\ndepends_on: ["01-01"]\nwave: 2\n---\nPlan 02', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '01-03-PLAN.md'), '---\nphase: 01-test\nplan: 03\ndepends_on: ["01-01"]\nwave: 2\n---\nPlan 03', 'utf-8');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns ordered plan IDs', () => {
    const result = execFileSync('node', [ROUTER_PATH, 'dependency', 'analyze', tmpDir], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.ok(Array.isArray(parsed.order), 'result should have order array');
    assert.ok(parsed.order.indexOf('01-01') < parsed.order.indexOf('01-02'), '01-01 before 01-02');
    assert.ok(parsed.order.indexOf('01-01') < parsed.order.indexOf('01-03'), '01-01 before 01-03');
  });

  it('returns error JSON for circular dependencies', () => {
    const circDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-circ-'));
    fs.writeFileSync(path.join(circDir, '01-01-PLAN.md'), '---\nphase: 01-test\nplan: 01\ndepends_on: ["01-02"]\nwave: 1\n---\nPlan 01', 'utf-8');
    fs.writeFileSync(path.join(circDir, '01-02-PLAN.md'), '---\nphase: 01-test\nplan: 02\ndepends_on: ["01-01"]\nwave: 1\n---\nPlan 02', 'utf-8');

    try {
      execFileSync('node', [ROUTER_PATH, 'dependency', 'analyze', circDir], {
        encoding: 'utf-8',
        stdio: 'pipe'
      });
      assert.fail('should have exited with error');
    } catch (err) {
      assert.notEqual(err.status, 0, 'should exit non-zero');
      assert.ok(err.stderr.includes('ircular') || err.stderr.includes('cycle'), 'stderr should mention circular dependency');
    } finally {
      fs.rmSync(circDir, { recursive: true, force: true });
    }
  });
});

describe('dependency waves via CLI', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-waves-'));
    fs.writeFileSync(path.join(tmpDir, '01-01-PLAN.md'), '---\nphase: 01-test\nplan: 01\ndepends_on: []\nwave: 1\n---\nPlan 01', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, '01-02-PLAN.md'), '---\nphase: 01-test\nplan: 02\ndepends_on: ["01-01"]\nwave: 2\n---\nPlan 02', 'utf-8');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns plans grouped by wave', () => {
    const result = execFileSync('node', [ROUTER_PATH, 'dependency', 'waves', tmpDir], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.ok(parsed.waves, 'result should have waves field');
    assert.ok(Array.isArray(parsed.waves), 'waves should be an array');
    assert.ok(parsed.waves.length >= 1, 'should have at least 1 wave');
  });
});

describe('dependency analyze on real phase directory', () => {
  it('analyzes .planning/phases/01-foundation/', () => {
    const phaseDir = path.join(__dirname, '..', '..', '.planning', 'phases', '01-foundation');
    if (!fs.existsSync(phaseDir)) return; // skip if not available

    const result = execFileSync('node', [ROUTER_PATH, 'dependency', 'analyze', phaseDir], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.ok(Array.isArray(parsed.order), 'result should have order array');
    assert.ok(parsed.order.length >= 2, 'should find at least 2 plans');
    // 01-01 should always come first (no deps)
    assert.equal(parsed.order[0], '01-01', '01-01 should be first (no dependencies)');
  });
});
