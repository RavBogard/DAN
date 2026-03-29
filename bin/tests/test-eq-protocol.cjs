#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const QUALIFY_PATH = path.join(__dirname, '..', 'lib', 'qualify.cjs');

describe('qualify.cjs exports', () => {
  it('exports QUALIFICATION_STATUSES, parseQualifierOutput, shouldRetry, classifyFailure', () => {
    const q = require(QUALIFY_PATH);
    assert.ok(q.QUALIFICATION_STATUSES);
    assert.equal(typeof q.parseQualifierOutput, 'function');
    assert.equal(typeof q.shouldRetry, 'function');
    assert.equal(typeof q.classifyFailure, 'function');
  });
});

describe('QUALIFICATION_STATUSES', () => {
  it('contains all 4 statuses', () => {
    const { QUALIFICATION_STATUSES } = require(QUALIFY_PATH);
    assert.equal(QUALIFICATION_STATUSES.PASS, 'PASS');
    assert.equal(QUALIFICATION_STATUSES.PASS_WITH_CONCERNS, 'PASS_WITH_CONCERNS');
    assert.equal(QUALIFICATION_STATUSES.NEEDS_REVISION, 'NEEDS_REVISION');
    assert.equal(QUALIFICATION_STATUSES.FAIL, 'FAIL');
  });

  it('is frozen', () => {
    const { QUALIFICATION_STATUSES } = require(QUALIFY_PATH);
    assert.ok(Object.isFrozen(QUALIFICATION_STATUSES));
  });
});

describe('parseQualifierOutput', () => {
  it('parses PASS status', () => {
    const { parseQualifierOutput } = require(QUALIFY_PATH);
    const md = [
      '**Task:** 1',
      '**Status:** PASS',
      '**Criteria:**',
      '- File exists: PASS',
      '- Tests pass: PASS',
      '**Evidence:** All tests green',
      '**Issues:** None'
    ].join('\n');
    const result = parseQualifierOutput(md);
    assert.equal(result.status, 'PASS');
    assert.equal(result.task, '1');
    assert.deepEqual(result.criteria, [
      { name: 'File exists', passed: true },
      { name: 'Tests pass', passed: true }
    ]);
    assert.equal(result.evidence, 'All tests green');
  });

  it('parses NEEDS_REVISION status', () => {
    const { parseQualifierOutput } = require(QUALIFY_PATH);
    const md = [
      '**Task:** 2',
      '**Status:** NEEDS_REVISION',
      '**Criteria:**',
      '- File exists: PASS',
      '- Validation works: FAIL',
      '**Evidence:** Missing edge case handling',
      '**Issues:**',
      '1. No null check',
      '2. Missing error message'
    ].join('\n');
    const result = parseQualifierOutput(md);
    assert.equal(result.status, 'NEEDS_REVISION');
    assert.equal(result.task, '2');
    assert.deepEqual(result.criteria, [
      { name: 'File exists', passed: true },
      { name: 'Validation works', passed: false }
    ]);
    assert.ok(result.issues.length >= 1);
  });

  it('parses FAIL status', () => {
    const { parseQualifierOutput } = require(QUALIFY_PATH);
    const md = [
      '**Task:** 3',
      '**Status:** FAIL',
      '**Criteria:**',
      '- Compiles: FAIL',
      '**Evidence:** Syntax errors throughout',
      '**Issues:**',
      '1. SyntaxError on line 5'
    ].join('\n');
    const result = parseQualifierOutput(md);
    assert.equal(result.status, 'FAIL');
  });

  it('parses PASS_WITH_CONCERNS status', () => {
    const { parseQualifierOutput } = require(QUALIFY_PATH);
    const md = [
      '**Task:** 4',
      '**Status:** PASS_WITH_CONCERNS',
      '**Criteria:**',
      '- Logic correct: PASS',
      '**Evidence:** Works but could be cleaner'
    ].join('\n');
    const result = parseQualifierOutput(md);
    assert.equal(result.status, 'PASS_WITH_CONCERNS');
  });

  it('handles Grade alias for Status', () => {
    const { parseQualifierOutput } = require(QUALIFY_PATH);
    const md = [
      '**Task:** 5',
      '**Grade:** PASS',
      '**Criteria:**',
      '- Tests pass: PASS',
      '**Evidence:** All good'
    ].join('\n');
    const result = parseQualifierOutput(md);
    assert.equal(result.status, 'PASS');
  });

  it('handles Criteria checklist alias', () => {
    const { parseQualifierOutput } = require(QUALIFY_PATH);
    const md = [
      '**Task:** 6',
      '**Status:** PASS',
      '**Criteria checklist:**',
      '- Tests pass: PASS',
      '**Evidence:** All good'
    ].join('\n');
    const result = parseQualifierOutput(md);
    assert.equal(result.status, 'PASS');
    assert.equal(result.criteria.length, 1);
  });

  it('returns error for missing status line', () => {
    const { parseQualifierOutput } = require(QUALIFY_PATH);
    const md = [
      '**Task:** 1',
      '**Criteria:**',
      '- Tests pass: PASS'
    ].join('\n');
    const result = parseQualifierOutput(md);
    assert.equal(result.status, null);
    assert.ok(result.error);
  });

  it('returns error for unrecognized status', () => {
    const { parseQualifierOutput } = require(QUALIFY_PATH);
    const md = [
      '**Task:** 1',
      '**Status:** MAYBE',
      '**Criteria:**',
      '- Tests pass: PASS'
    ].join('\n');
    const result = parseQualifierOutput(md);
    assert.equal(result.status, null);
    assert.ok(result.error);
  });
});

describe('shouldRetry', () => {
  it('PASS -> no retry', () => {
    const { shouldRetry } = require(QUALIFY_PATH);
    const result = shouldRetry('PASS', 0);
    assert.equal(result.retry, false);
    assert.equal(result.reason, 'passed');
  });

  it('PASS_WITH_CONCERNS -> no retry', () => {
    const { shouldRetry } = require(QUALIFY_PATH);
    const result = shouldRetry('PASS_WITH_CONCERNS', 0);
    assert.equal(result.retry, false);
    assert.equal(result.reason, 'passed with concerns');
  });

  it('NEEDS_REVISION with retryCount 0 -> retry', () => {
    const { shouldRetry } = require(QUALIFY_PATH);
    const result = shouldRetry('NEEDS_REVISION', 0);
    assert.equal(result.retry, true);
    assert.equal(result.reason, 'revision 1 of 3');
  });

  it('NEEDS_REVISION with retryCount 1 -> retry', () => {
    const { shouldRetry } = require(QUALIFY_PATH);
    const result = shouldRetry('NEEDS_REVISION', 1);
    assert.equal(result.retry, true);
    assert.equal(result.reason, 'revision 2 of 3');
  });

  it('NEEDS_REVISION with retryCount 2 -> retry', () => {
    const { shouldRetry } = require(QUALIFY_PATH);
    const result = shouldRetry('NEEDS_REVISION', 2);
    assert.equal(result.retry, true);
    assert.equal(result.reason, 'revision 3 of 3');
  });

  it('NEEDS_REVISION with retryCount 3 -> no retry, escalate', () => {
    const { shouldRetry } = require(QUALIFY_PATH);
    const result = shouldRetry('NEEDS_REVISION', 3);
    assert.equal(result.retry, false);
    assert.equal(result.reason, 'max retries exceeded, escalate');
  });

  it('NEEDS_REVISION with retryCount 5 -> no retry', () => {
    const { shouldRetry } = require(QUALIFY_PATH);
    const result = shouldRetry('NEEDS_REVISION', 5);
    assert.equal(result.retry, false);
  });

  it('FAIL -> no retry, escalate', () => {
    const { shouldRetry } = require(QUALIFY_PATH);
    const result = shouldRetry('FAIL', 0);
    assert.equal(result.retry, false);
    assert.equal(result.reason, 'failed, escalate');
  });

  it('custom maxRetries', () => {
    const { shouldRetry } = require(QUALIFY_PATH);
    const result = shouldRetry('NEEDS_REVISION', 4, 5);
    assert.equal(result.retry, true);
    assert.equal(result.reason, 'revision 5 of 5');
  });

  it('custom maxRetries exceeded', () => {
    const { shouldRetry } = require(QUALIFY_PATH);
    const result = shouldRetry('NEEDS_REVISION', 5, 5);
    assert.equal(result.retry, false);
    assert.equal(result.reason, 'max retries exceeded, escalate');
  });
});
