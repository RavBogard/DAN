#!/usr/bin/env node
'use strict';

const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const ROUTER = path.join(__dirname, '..', 'dan-tools.cjs');

function run(args, cwd) {
  try {
    const stdout = execFileSync('node', [ROUTER, ...args], {
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: cwd || process.cwd()
    });
    return { ok: true, data: JSON.parse(stdout), raw: stdout };
  } catch (err) {
    return {
      ok: false,
      exitCode: err.status,
      stdout: (err.stdout || '').trim(),
      stderr: (err.stderr || '').trim()
    };
  }
}

// ========== STATE MODULE ==========

describe('state module', () => {
  it('state read parses STATE.md into JSON with all fields', () => {
    const result = run(['state', 'read', '.planning/STATE.md']);
    assert.ok(result.ok, 'state read should succeed: ' + (result.stderr || ''));
    assert.ok(result.data.phase !== undefined, 'should have phase field');
    assert.ok(result.data.plan !== undefined, 'should have plan field');
    assert.ok(result.data.status !== undefined, 'should have status field');
    assert.ok(result.data.last_activity !== undefined, 'should have last_activity field');
  });

  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-state-'));
    // Create a test STATE.md
    fs.writeFileSync(path.join(tmpDir, 'STATE.md'), [
      '# Project State',
      '',
      '## Current Position',
      '',
      'Phase: 1 of 5 (Foundation)',
      'Plan: 0 of 3 in current phase',
      'Status: Ready to plan',
      'Last activity: 2026-03-28 -- Test',
      '',
      'Progress: [..........] 0%',
      '',
      '## Session Continuity',
      '',
      'Last session: 2026-03-28',
      'Stopped at: Test state',
      'Resume file: None'
    ].join('\n'), 'utf-8');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('state get extracts single field value', () => {
    const result = run(['state', 'get', 'Status', tmpDir + '/STATE.md']);
    assert.ok(result.ok, 'state get should succeed: ' + (result.stderr || ''));
    assert.equal(result.data.value, 'Ready to plan');
  });

  it('state set updates a field atomically', () => {
    const result = run(['state', 'set', 'Status', 'In progress', tmpDir + '/STATE.md']);
    assert.ok(result.ok, 'state set should succeed: ' + (result.stderr || ''));
    // Verify the file was updated
    const content = fs.readFileSync(path.join(tmpDir, 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Status: In progress'), 'file should contain updated value');
  });

  it('state patch applies multiple updates', () => {
    const patch = JSON.stringify({ Status: 'Complete', 'Plan': '1 of 3 in current phase' });
    const result = run(['state', 'patch', patch, tmpDir + '/STATE.md']);
    assert.ok(result.ok, 'state patch should succeed: ' + (result.stderr || ''));
    const content = fs.readFileSync(path.join(tmpDir, 'STATE.md'), 'utf-8');
    assert.ok(content.includes('Status: Complete'), 'Status should be updated');
    assert.ok(content.includes('Plan: 1 of 3'), 'Plan should be updated');
  });
});

// ========== CONFIG MODULE ==========

describe('config module', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-config-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('config get returns full config with defaults when file missing', () => {
    const result = run(['--cwd', tmpDir, 'config', 'get']);
    assert.ok(result.ok, 'config get should succeed: ' + (result.stderr || ''));
    assert.equal(result.data.mode, 'yolo');
    assert.equal(result.data.commit_docs, true);
    assert.equal(result.data.workflow.research, true);
  });

  it('config get key returns single value', () => {
    const result = run(['--cwd', tmpDir, 'config', 'get', 'mode']);
    assert.ok(result.ok, 'config get mode should succeed: ' + (result.stderr || ''));
    assert.equal(result.data.value, 'yolo');
  });

  it('config set updates dan.config.json atomically', () => {
    const result = run(['--cwd', tmpDir, 'config', 'set', 'mode', 'careful']);
    assert.ok(result.ok, 'config set should succeed: ' + (result.stderr || ''));
    // Verify the file was written
    const content = fs.readFileSync(path.join(tmpDir, '.planning', 'dan.config.json'), 'utf-8');
    const parsed = JSON.parse(content);
    assert.equal(parsed.mode, 'careful');
  });

  it('config get after set returns updated value', () => {
    const result = run(['--cwd', tmpDir, 'config', 'get', 'mode']);
    assert.ok(result.ok);
    assert.equal(result.data.value, 'careful');
  });
});

// ========== FRONTMATTER MODULE ==========

describe('frontmatter module', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-fm-'));
    // Create test markdown with frontmatter
    fs.writeFileSync(path.join(tmpDir, 'test.md'), [
      '---',
      'phase: 01-foundation',
      'plan: 01',
      'type: execute',
      'autonomous: true',
      'wave: 1',
      'depends_on: []',
      'requirements:',
      '  - FOUND-01',
      '  - FOUND-03',
      '---',
      '',
      '# Test Plan',
      '',
      'Body content here.'
    ].join('\n'), 'utf-8');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('frontmatter parse extracts YAML and body', () => {
    const result = run(['frontmatter', 'parse', path.join(tmpDir, 'test.md')]);
    assert.ok(result.ok, 'frontmatter parse should succeed: ' + (result.stderr || ''));
    assert.equal(result.data.frontmatter.phase, '01-foundation');
    assert.equal(result.data.frontmatter.plan, '01');
    assert.equal(result.data.frontmatter.autonomous, true);
    assert.ok(Array.isArray(result.data.frontmatter.requirements), 'requirements should be array');
    assert.equal(result.data.frontmatter.requirements[0], 'FOUND-01');
    assert.ok(result.data.body.includes('# Test Plan'), 'body should contain markdown content');
  });

  it('frontmatter parse handles nested objects', () => {
    const nestedPath = path.join(tmpDir, 'nested.md');
    fs.writeFileSync(nestedPath, [
      '---',
      'name: test',
      'workflow:',
      '  research: true',
      '  verifier: false',
      '---',
      'Body'
    ].join('\n'), 'utf-8');
    const result = run(['frontmatter', 'parse', nestedPath]);
    assert.ok(result.ok, 'should parse nested: ' + (result.stderr || ''));
    assert.equal(result.data.frontmatter.workflow.research, true);
    assert.equal(result.data.frontmatter.workflow.verifier, false);
  });

  it('frontmatter serialize produces valid frontmatter+body', () => {
    const fm = JSON.stringify({ phase: '01', plan: '01', tags: ['a', 'b'] });
    const body = '# My Plan\n\nContent here.';
    const result = run(['frontmatter', 'serialize', fm, body]);
    assert.ok(result.ok, 'serialize should succeed: ' + (result.stderr || ''));
    assert.ok(result.data.output.startsWith('---\n'), 'should start with ---');
    assert.ok(result.data.output.includes('phase: 01'), 'should contain phase');
    assert.ok(result.data.output.includes('# My Plan'), 'should contain body');
  });

  it('frontmatter parse works on real plan files', () => {
    const result = run(['frontmatter', 'parse', '.planning/phases/01-foundation/01-01-PLAN.md']);
    assert.ok(result.ok, 'should parse real plan: ' + (result.stderr || ''));
    assert.equal(result.data.frontmatter.phase, '01-foundation');
  });
});

// ========== COMMIT MODULE ==========

describe('commit module', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-commit-'));
    // Init a git repo
    execFileSync('git', ['init'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.email', 'test@test.com'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tmpDir, stdio: 'pipe' });
    // Create .planning dir with config
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, '.planning', 'dan.config.json'), '{"commit_docs": true}', 'utf-8');
    // Initial commit
    fs.writeFileSync(path.join(tmpDir, 'init.txt'), 'init', 'utf-8');
    execFileSync('git', ['add', 'init.txt'], { cwd: tmpDir, stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', 'init'], { cwd: tmpDir, stdio: 'pipe' });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('commit with nothing to commit returns {committed: false}', () => {
    const result = run(['--cwd', tmpDir, 'commit', 'test message', '--files', 'nonexistent.txt']);
    assert.ok(result.ok, 'should not crash: ' + (result.stderr || ''));
    assert.equal(result.data.committed, false);
    assert.ok(result.data.reason, 'should have a reason');
  });

  it('commit stages and commits a file', () => {
    fs.writeFileSync(path.join(tmpDir, 'new.txt'), 'new content', 'utf-8');
    const result = run(['--cwd', tmpDir, 'commit', 'test: add new file', '--files', 'new.txt']);
    assert.ok(result.ok, 'should succeed: ' + (result.stderr || ''));
    assert.equal(result.data.committed, true);
    assert.ok(result.data.hash, 'should have commit hash');
  });

  it('commit respects commit_docs=false', () => {
    fs.writeFileSync(path.join(tmpDir, '.planning', 'dan.config.json'), '{"commit_docs": false}', 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'skip.txt'), 'skip', 'utf-8');
    const result = run(['--cwd', tmpDir, 'commit', 'should skip', '--files', 'skip.txt']);
    assert.ok(result.ok, 'should not crash');
    assert.equal(result.data.committed, false);
    assert.equal(result.data.reason, 'skipped_commit_docs_false');
    // Restore config
    fs.writeFileSync(path.join(tmpDir, '.planning', 'dan.config.json'), '{"commit_docs": true}', 'utf-8');
  });
});

// ========== DAN.CONFIG.JSON ==========

describe('dan.config.json default file', () => {
  it('exists in .planning/', () => {
    const configPath = path.join(process.cwd(), '.planning', 'dan.config.json');
    assert.ok(fs.existsSync(configPath), 'dan.config.json should exist');
    const content = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    assert.equal(content.mode, 'yolo');
    assert.equal(typeof content.workflow, 'object');
  });
});
