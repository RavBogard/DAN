#!/usr/bin/env node
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MOD_PATH = path.join(__dirname, '..', 'lib', 'research.cjs');

describe('research.cjs exports', () => {
  it('exports handle, initResearch, recordPass, checkConvergence, getStatus', () => {
    const mod = require(MOD_PATH);
    assert.equal(typeof mod.handle, 'function');
    assert.equal(typeof mod.initResearch, 'function');
    assert.equal(typeof mod.recordPass, 'function');
    assert.equal(typeof mod.checkConvergence, 'function');
    assert.equal(typeof mod.getStatus, 'function');
  });
});

describe('initResearch', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-test-research-'));
    // Create .planning/phases/03-research-system/ for phase target tests
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '03-research-system'), { recursive: true });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates state.json for project target with correct schema', () => {
    const { initResearch } = require(MOD_PATH);
    const state = initResearch(tmpDir, 'project', 4);
    assert.equal(state.target, 'project');
    assert.equal(state.max_passes, 4);
    assert.equal(state.current_pass, 0);
    assert.deepEqual(state.passes, []);
    assert.equal(state.converged, false);

    const statePath = path.join(tmpDir, '.planning', 'research', 'state.json');
    assert.ok(fs.existsSync(statePath), 'state.json should exist at .planning/research/state.json');
    const disk = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    assert.equal(disk.target, 'project');
  });

  it('creates state.json for phase target at correct path', () => {
    const { initResearch } = require(MOD_PATH);
    const state = initResearch(tmpDir, '3', 4);
    assert.equal(state.target, 'phase-3');
    assert.equal(state.max_passes, 4);
    assert.equal(state.current_pass, 0);

    const statePath = path.join(tmpDir, '.planning', 'phases', '03-research-system', 'research', 'state.json');
    assert.ok(fs.existsSync(statePath), 'state.json should exist under phase dir');
  });

  it('defaults max_passes to 4 when not provided', () => {
    const { initResearch } = require(MOD_PATH);
    // Use a fresh subdir to avoid conflicts
    const tmpDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-test-research-def-'));
    fs.mkdirSync(path.join(tmpDir2, '.planning', 'research'), { recursive: true });
    try {
      const state = initResearch(tmpDir2, 'project');
      assert.equal(state.max_passes, 4);
    } finally {
      fs.rmSync(tmpDir2, { recursive: true, force: true });
    }
  });
});

describe('recordPass', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-test-rp-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'research'), { recursive: true });
    const { initResearch } = require(MOD_PATH);
    initResearch(tmpDir, 'project', 4);
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('appends pass data with gaps and confidence to state', () => {
    const { recordPass } = require(MOD_PATH);
    const gaps = [{ dimension: 'features', topic: 'edge cases' }];
    const confidence = { stack: 'HIGH', features: 'MEDIUM', architecture: 'HIGH', pitfalls: 'HIGH' };
    const state = recordPass(tmpDir, 'project', 1, gaps, confidence);

    assert.equal(state.current_pass, 1);
    assert.equal(state.passes.length, 1);
    assert.equal(state.passes[0].pass, 1);
    assert.equal(state.passes[0].gaps_found, 1);
    assert.deepEqual(state.passes[0].gaps, gaps);
    assert.deepEqual(state.passes[0].confidence, confidence);
    assert.ok(state.passes[0].completed, 'should have completed timestamp');
  });

  it('updates current_pass to the recorded pass number', () => {
    const { recordPass } = require(MOD_PATH);
    const state = recordPass(tmpDir, 'project', 2, [], { stack: 'HIGH', features: 'HIGH', architecture: 'HIGH', pitfalls: 'HIGH' });
    assert.equal(state.current_pass, 2);
    assert.equal(state.passes.length, 2);
  });
});

describe('checkConvergence', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-test-conv-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'research'), { recursive: true });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns should_continue=false with reason "hard cap" when current_pass >= max_passes', () => {
    const { initResearch, recordPass, checkConvergence } = require(MOD_PATH);
    const dir = path.join(tmpDir, 'hardcap');
    fs.mkdirSync(path.join(dir, '.planning', 'research'), { recursive: true });
    initResearch(dir, 'project', 2);
    recordPass(dir, 'project', 1, [{ dimension: 'a', topic: 'x' }], { a: 'MEDIUM' });
    recordPass(dir, 'project', 2, [{ dimension: 'a', topic: 'x' }], { a: 'MEDIUM' });

    const result = checkConvergence(dir, 'project');
    assert.equal(result.should_continue, false);
    assert.ok(result.reason.includes('hard cap'), 'reason should mention hard cap');
  });

  it('returns should_continue=false with reason "no gaps" when last pass has gaps_found=0', () => {
    const { initResearch, recordPass, checkConvergence } = require(MOD_PATH);
    const dir = path.join(tmpDir, 'nogaps');
    fs.mkdirSync(path.join(dir, '.planning', 'research'), { recursive: true });
    initResearch(dir, 'project', 4);
    recordPass(dir, 'project', 1, [], { stack: 'MEDIUM' });

    const result = checkConvergence(dir, 'project');
    assert.equal(result.should_continue, false);
    assert.ok(result.reason.includes('no gaps'), 'reason should mention no gaps');
  });

  it('returns should_continue=false with reason "HIGH" when all confidence dimensions are HIGH', () => {
    const { initResearch, recordPass, checkConvergence } = require(MOD_PATH);
    const dir = path.join(tmpDir, 'allhigh');
    fs.mkdirSync(path.join(dir, '.planning', 'research'), { recursive: true });
    initResearch(dir, 'project', 4);
    recordPass(dir, 'project', 1, [{ dimension: 'x', topic: 'y' }], { stack: 'HIGH', features: 'HIGH', architecture: 'HIGH', pitfalls: 'HIGH' });

    const result = checkConvergence(dir, 'project');
    assert.equal(result.should_continue, false);
    assert.ok(result.reason.includes('HIGH'), 'reason should mention HIGH');
  });

  it('returns should_continue=false with reason "diminishing" when gaps not decreasing', () => {
    const { initResearch, recordPass, checkConvergence } = require(MOD_PATH);
    const dir = path.join(tmpDir, 'diminishing');
    fs.mkdirSync(path.join(dir, '.planning', 'research'), { recursive: true });
    initResearch(dir, 'project', 4);
    recordPass(dir, 'project', 1, [{ dimension: 'a', topic: 'x' }, { dimension: 'b', topic: 'y' }], { a: 'MEDIUM', b: 'MEDIUM' });
    recordPass(dir, 'project', 2, [{ dimension: 'a', topic: 'x' }, { dimension: 'b', topic: 'y' }], { a: 'MEDIUM', b: 'MEDIUM' });

    const result = checkConvergence(dir, 'project');
    assert.equal(result.should_continue, false);
    assert.ok(result.reason.includes('diminishing'), 'reason should mention diminishing');
  });

  it('returns should_continue=true when gaps remain and are decreasing', () => {
    const { initResearch, recordPass, checkConvergence } = require(MOD_PATH);
    const dir = path.join(tmpDir, 'continue');
    fs.mkdirSync(path.join(dir, '.planning', 'research'), { recursive: true });
    initResearch(dir, 'project', 4);
    recordPass(dir, 'project', 1, [{ dimension: 'a', topic: 'x' }, { dimension: 'b', topic: 'y' }, { dimension: 'c', topic: 'z' }], { a: 'MEDIUM', b: 'LOW', c: 'MEDIUM' });
    recordPass(dir, 'project', 2, [{ dimension: 'b', topic: 'y' }], { a: 'HIGH', b: 'MEDIUM', c: 'HIGH' });

    const result = checkConvergence(dir, 'project');
    assert.equal(result.should_continue, true);
    assert.ok(result.reason.includes('progress') || result.reason.includes('remain'), 'reason should indicate progress');
  });
});

describe('getStatus', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-test-status-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'research'), { recursive: true });
    const { initResearch } = require(MOD_PATH);
    initResearch(tmpDir, 'project', 4);
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns full state object', () => {
    const { getStatus } = require(MOD_PATH);
    const state = getStatus(tmpDir, 'project');
    assert.equal(state.target, 'project');
    assert.equal(state.max_passes, 4);
    assert.equal(state.current_pass, 0);
    assert.ok(Array.isArray(state.passes));
  });
});

describe('handle dispatches subcommands', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-test-handle-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'research'), { recursive: true });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('dispatches init subcommand', () => {
    const { execFileSync } = require('child_process');
    const routerPath = path.join(__dirname, '..', 'dan-tools.cjs');
    const result = execFileSync('node', [routerPath, 'research', 'init', 'project', '--max-passes', '3', '--cwd', tmpDir], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.equal(parsed.target, 'project');
    assert.equal(parsed.max_passes, 3);
  });

  it('dispatches status subcommand', () => {
    const { execFileSync } = require('child_process');
    const routerPath = path.join(__dirname, '..', 'dan-tools.cjs');
    const result = execFileSync('node', [routerPath, 'research', 'status', 'project', '--cwd', tmpDir], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.equal(parsed.target, 'project');
  });

  it('dispatches record-pass subcommand', () => {
    const { execFileSync } = require('child_process');
    const routerPath = path.join(__dirname, '..', 'dan-tools.cjs');
    const gaps = JSON.stringify([{ dimension: 'stack', topic: 'caching' }]);
    const confidence = JSON.stringify({ stack: 'MEDIUM' });
    const result = execFileSync('node', [routerPath, 'research', 'record-pass', 'project', '--pass', '1', '--gaps', gaps, '--confidence', confidence, '--cwd', tmpDir], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.equal(parsed.current_pass, 1);
    assert.equal(parsed.passes.length, 1);
  });

  it('dispatches check-convergence subcommand', () => {
    const { execFileSync } = require('child_process');
    const routerPath = path.join(__dirname, '..', 'dan-tools.cjs');
    const result = execFileSync('node', [routerPath, 'research', 'check-convergence', 'project', '--cwd', tmpDir], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.ok('should_continue' in parsed, 'should have should_continue field');
    assert.ok('reason' in parsed, 'should have reason field');
  });
});
