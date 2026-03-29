#!/usr/bin/env node
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const TEMPLATE_PATH = path.join(__dirname, '..', 'lib', 'template.cjs');
const ROUTER_PATH = path.join(__dirname, '..', 'dan-tools.cjs');
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

describe('template.cjs exports', () => {
  it('exports handle function', () => {
    const template = require(TEMPLATE_PATH);
    assert.equal(typeof template.handle, 'function', 'handle must be a function');
  });
});

describe('template files exist', () => {
  const expected = ['plan.md', 'summary.md', 'state.md', 'project.md', 'config.json'];

  for (const file of expected) {
    it('template file exists: ' + file, () => {
      const filePath = path.join(TEMPLATES_DIR, file);
      assert.ok(fs.existsSync(filePath), file + ' must exist in bin/templates/');
    });
  }
});

describe('template fill plan', () => {
  it('produces valid PLAN.md with correct phase/plan in frontmatter', () => {
    const result = execFileSync('node', [ROUTER_PATH, 'template', 'fill', 'plan', '--phase', '01', '--plan', '03'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.ok(parsed.output, 'result should have output field');
    assert.ok(parsed.output.includes('---'), 'output should contain frontmatter delimiters');
    assert.ok(parsed.output.includes('phase: 01'), 'output should contain phase: 01');
    assert.ok(parsed.output.includes('plan: 03'), 'output should contain plan: 03');
  });

  it('replaces all placeholders', () => {
    const result = execFileSync('node', [ROUTER_PATH, 'template', 'fill', 'plan', '--phase', '02', '--plan', '01', '--name', 'core-loop'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.ok(!parsed.output.includes('{{PHASE}}'), 'no unreplaced {{PHASE}} placeholders');
    assert.ok(!parsed.output.includes('{{PLAN}}'), 'no unreplaced {{PLAN}} placeholders');
    assert.ok(!parsed.output.includes('{{PHASE_NAME}}'), 'no unreplaced {{PHASE_NAME}} placeholders');
    assert.ok(!parsed.output.includes('{{DATE}}'), 'no unreplaced {{DATE}} placeholders');
    assert.ok(!parsed.output.includes('{{PADDED_PHASE}}'), 'no unreplaced {{PADDED_PHASE}} placeholders');
    assert.ok(!parsed.output.includes('{{PADDED_PLAN}}'), 'no unreplaced {{PADDED_PLAN}} placeholders');
  });

  it('contains XML task skeleton', () => {
    const result = execFileSync('node', [ROUTER_PATH, 'template', 'fill', 'plan', '--phase', '01', '--plan', '01'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.ok(parsed.output.includes('<tasks>'), 'should contain <tasks> section');
    assert.ok(parsed.output.includes('<task'), 'should contain <task element');
  });

  it('contains must_haves frontmatter fields', () => {
    const result = execFileSync('node', [ROUTER_PATH, 'template', 'fill', 'plan', '--phase', '01', '--plan', '01'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.ok(parsed.output.includes('depends_on:'), 'should contain depends_on field');
    assert.ok(parsed.output.includes('wave:'), 'should contain wave field');
    assert.ok(parsed.output.includes('autonomous:'), 'should contain autonomous field');
    assert.ok(parsed.output.includes('must_haves:'), 'should contain must_haves field');
  });
});

describe('template fill summary', () => {
  it('produces valid SUMMARY.md', () => {
    const result = execFileSync('node', [ROUTER_PATH, 'template', 'fill', 'summary', '--phase', '01', '--plan', '02'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.ok(parsed.output, 'result should have output field');
    assert.ok(parsed.output.includes('---'), 'should have frontmatter');
    assert.ok(parsed.output.includes('phase: 01'), 'should have phase');
    assert.ok(parsed.output.includes('plan: 02'), 'should have plan');
  });
});

describe('template fill state', () => {
  it('produces valid STATE.md scaffold', () => {
    const result = execFileSync('node', [ROUTER_PATH, 'template', 'fill', 'state'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.ok(parsed.output.includes('# Project State'), 'should contain Project State heading');
    assert.ok(parsed.output.includes('## Current Position'), 'should contain Current Position section');
    assert.ok(parsed.output.includes('Progress:'), 'should contain Progress field');
  });
});

describe('template fill project', () => {
  it('produces valid PROJECT.md scaffold', () => {
    const result = execFileSync('node', [ROUTER_PATH, 'template', 'fill', 'project'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    const parsed = JSON.parse(result);
    assert.ok(parsed.output.includes('# Project'), 'should contain Project heading');
  });
});

describe('template via --raw flag', () => {
  it('outputs raw template content with --raw', () => {
    const result = execFileSync('node', [ROUTER_PATH, '--raw', 'template', 'fill', 'plan', '--phase', '01', '--plan', '01'], {
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    // Raw output should start with --- (frontmatter), not be JSON
    assert.ok(result.startsWith('---'), 'raw output should start with frontmatter delimiter');
  });
});
