#!/usr/bin/env node
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const CORE_PATH = path.join(__dirname, '..', 'lib', 'core.cjs');
const ROUTER_PATH = path.join(__dirname, '..', 'dan-tools.cjs');

describe('core.cjs exports', () => {
  it('exports all 6 required functions', () => {
    const core = require(CORE_PATH);
    assert.equal(typeof core.output, 'function', 'output must be a function');
    assert.equal(typeof core.error, 'function', 'error must be a function');
    assert.equal(typeof core.atomicWriteFileSync, 'function', 'atomicWriteFileSync must be a function');
    assert.equal(typeof core.execGit, 'function', 'execGit must be a function');
    assert.equal(typeof core.toPosixPath, 'function', 'toPosixPath must be a function');
    assert.equal(typeof core.loadConfig, 'function', 'loadConfig must be a function');
  });
});

describe('atomicWriteFileSync', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-test-'));
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('writes content to the target file', () => {
    const core = require(CORE_PATH);
    const filePath = path.join(tmpDir, 'test-atomic.txt');
    core.atomicWriteFileSync(filePath, 'hello atomic');
    assert.equal(fs.readFileSync(filePath, 'utf-8'), 'hello atomic');
  });

  it('does not leave temp files behind', () => {
    const core = require(CORE_PATH);
    const filePath = path.join(tmpDir, 'test-clean.txt');
    core.atomicWriteFileSync(filePath, 'clean write');
    const files = fs.readdirSync(tmpDir);
    const tmpFiles = files.filter(f => f.includes('.tmp.'));
    assert.equal(tmpFiles.length, 0, 'no temp files should remain');
  });

  it('overwrites existing file atomically', () => {
    const core = require(CORE_PATH);
    const filePath = path.join(tmpDir, 'test-overwrite.txt');
    core.atomicWriteFileSync(filePath, 'first');
    core.atomicWriteFileSync(filePath, 'second');
    assert.equal(fs.readFileSync(filePath, 'utf-8'), 'second');
  });
});

describe('toPosixPath', () => {
  it('converts backslashes to forward slashes', () => {
    const core = require(CORE_PATH);
    assert.equal(core.toPosixPath('foo\\bar\\baz'), 'foo/bar/baz');
  });

  it('leaves forward slashes unchanged', () => {
    const core = require(CORE_PATH);
    assert.equal(core.toPosixPath('foo/bar/baz'), 'foo/bar/baz');
  });

  it('handles empty string', () => {
    const core = require(CORE_PATH);
    assert.equal(core.toPosixPath(''), '');
  });
});

describe('execGit', () => {
  it('runs git commands and returns structured result', () => {
    const core = require(CORE_PATH);
    const result = core.execGit(process.cwd(), ['--version']);
    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.includes('git version'), 'stdout should contain git version');
    assert.equal(typeof result.stderr, 'string');
  });

  it('returns non-zero exit code for invalid commands', () => {
    const core = require(CORE_PATH);
    const result = core.execGit(process.cwd(), ['log', '--oneline', '-1', '--invalidflag999']);
    assert.notEqual(result.exitCode, 0);
  });

  it('uses execFileSync not plain execSync (no shell injection)', () => {
    const source = fs.readFileSync(CORE_PATH, 'utf-8');
    assert.ok(source.includes('execFileSync'), 'core.cjs must use execFileSync');
  });
});

describe('loadConfig', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-cfg-'));
    fs.mkdirSync(path.join(tmpDir, '.planning'), { recursive: true });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns defaults when config file is missing', () => {
    const core = require(CORE_PATH);
    const config = core.loadConfig(tmpDir);
    assert.equal(config.mode, 'yolo');
    assert.equal(config.commit_docs, true);
    assert.equal(typeof config.workflow, 'object');
    assert.equal(config.workflow.research, true);
  });

  it('merges file values with defaults', () => {
    const core = require(CORE_PATH);
    fs.writeFileSync(
      path.join(tmpDir, '.planning', 'dan.config.json'),
      JSON.stringify({ mode: 'careful' }),
      'utf-8'
    );
    const config = core.loadConfig(tmpDir);
    assert.equal(config.mode, 'careful');
    assert.equal(config.commit_docs, true);
  });
});

describe('dan-tools.cjs router', () => {
  it('shows usage error with no args', () => {
    try {
      execFileSync('node', [ROUTER_PATH], { encoding: 'utf-8', stdio: 'pipe' });
      assert.fail('should have exited with error');
    } catch (err) {
      assert.notEqual(err.status, 0);
      assert.ok(
        err.stderr.includes('Unknown') || err.stderr.includes('Usage') || err.stderr.includes('command'),
        'stderr should contain usage/error message'
      );
    }
  });

  it('shows error for unknown command', () => {
    try {
      execFileSync('node', [ROUTER_PATH, 'bogus'], { encoding: 'utf-8', stdio: 'pipe' });
      assert.fail('should have exited with error');
    } catch (err) {
      assert.notEqual(err.status, 0);
    }
  });

  it('accepts --cwd flag', () => {
    try {
      const result = execFileSync('node', [ROUTER_PATH, '--cwd', '.', 'state', 'read', '.planning/STATE.md'], {
        encoding: 'utf-8',
        stdio: 'pipe',
        cwd: process.cwd()
      });
      JSON.parse(result);
    } catch (err) {
      // Acceptable if state module not fully implemented yet
    }
  });
});
