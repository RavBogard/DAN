#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const LIFECYCLE_PATH = path.join(__dirname, '..', 'lib', 'lifecycle.cjs');

describe('lifecycle.cjs exports', () => {
  it('exports PLAN_STATES, VALID_TRANSITIONS, validateTransition, getNextStates, isTerminal', () => {
    const lc = require(LIFECYCLE_PATH);
    assert.ok(lc.PLAN_STATES, 'PLAN_STATES must be exported');
    assert.ok(lc.VALID_TRANSITIONS, 'VALID_TRANSITIONS must be exported');
    assert.equal(typeof lc.validateTransition, 'function');
    assert.equal(typeof lc.getNextStates, 'function');
    assert.equal(typeof lc.isTerminal, 'function');
  });
});

describe('PLAN_STATES', () => {
  it('contains all 5 states', () => {
    const { PLAN_STATES } = require(LIFECYCLE_PATH);
    assert.equal(PLAN_STATES.DRAFT, 'DRAFT');
    assert.equal(PLAN_STATES.APPROVED, 'APPROVED');
    assert.equal(PLAN_STATES.IN_PROGRESS, 'IN_PROGRESS');
    assert.equal(PLAN_STATES.COMPLETED, 'COMPLETED');
    assert.equal(PLAN_STATES.ABANDONED, 'ABANDONED');
  });

  it('is frozen', () => {
    const { PLAN_STATES } = require(LIFECYCLE_PATH);
    assert.ok(Object.isFrozen(PLAN_STATES));
  });
});

describe('VALID_TRANSITIONS', () => {
  it('is frozen', () => {
    const { VALID_TRANSITIONS } = require(LIFECYCLE_PATH);
    assert.ok(Object.isFrozen(VALID_TRANSITIONS));
  });
});

describe('validateTransition', () => {
  it('DRAFT -> APPROVED is valid', () => {
    const { validateTransition } = require(LIFECYCLE_PATH);
    const result = validateTransition('DRAFT', 'APPROVED');
    assert.deepEqual(result, { valid: true });
  });

  it('DRAFT -> ABANDONED is valid', () => {
    const { validateTransition } = require(LIFECYCLE_PATH);
    const result = validateTransition('DRAFT', 'ABANDONED');
    assert.deepEqual(result, { valid: true });
  });

  it('APPROVED -> IN_PROGRESS is valid', () => {
    const { validateTransition } = require(LIFECYCLE_PATH);
    const result = validateTransition('APPROVED', 'IN_PROGRESS');
    assert.deepEqual(result, { valid: true });
  });

  it('APPROVED -> ABANDONED is valid', () => {
    const { validateTransition } = require(LIFECYCLE_PATH);
    const result = validateTransition('APPROVED', 'ABANDONED');
    assert.deepEqual(result, { valid: true });
  });

  it('IN_PROGRESS -> COMPLETED is valid', () => {
    const { validateTransition } = require(LIFECYCLE_PATH);
    const result = validateTransition('IN_PROGRESS', 'COMPLETED');
    assert.deepEqual(result, { valid: true });
  });

  it('IN_PROGRESS -> ABANDONED is valid', () => {
    const { validateTransition } = require(LIFECYCLE_PATH);
    const result = validateTransition('IN_PROGRESS', 'ABANDONED');
    assert.deepEqual(result, { valid: true });
  });

  it('COMPLETED -> DRAFT is invalid', () => {
    const { validateTransition } = require(LIFECYCLE_PATH);
    const result = validateTransition('COMPLETED', 'DRAFT');
    assert.equal(result.valid, false);
    assert.ok(result.reason, 'should have a reason');
  });

  it('ABANDONED -> DRAFT is invalid', () => {
    const { validateTransition } = require(LIFECYCLE_PATH);
    const result = validateTransition('ABANDONED', 'DRAFT');
    assert.equal(result.valid, false);
    assert.ok(result.reason);
  });

  it('DRAFT -> COMPLETED is invalid (skip states)', () => {
    const { validateTransition } = require(LIFECYCLE_PATH);
    const result = validateTransition('DRAFT', 'COMPLETED');
    assert.equal(result.valid, false);
    assert.ok(result.reason);
  });

  it('rejects unknown "from" state', () => {
    const { validateTransition } = require(LIFECYCLE_PATH);
    const result = validateTransition('UNKNOWN', 'APPROVED');
    assert.equal(result.valid, false);
    assert.ok(result.reason.includes('UNKNOWN'), 'reason should mention the unknown state');
  });

  it('rejects unknown "to" state', () => {
    const { validateTransition } = require(LIFECYCLE_PATH);
    const result = validateTransition('DRAFT', 'UNKNOWN');
    assert.equal(result.valid, false);
    assert.ok(result.reason.includes('UNKNOWN'));
  });
});

describe('getNextStates', () => {
  it('DRAFT can go to APPROVED or ABANDONED', () => {
    const { getNextStates } = require(LIFECYCLE_PATH);
    assert.deepEqual(getNextStates('DRAFT'), ['APPROVED', 'ABANDONED']);
  });

  it('COMPLETED returns empty array', () => {
    const { getNextStates } = require(LIFECYCLE_PATH);
    assert.deepEqual(getNextStates('COMPLETED'), []);
  });

  it('ABANDONED returns empty array', () => {
    const { getNextStates } = require(LIFECYCLE_PATH);
    assert.deepEqual(getNextStates('ABANDONED'), []);
  });

  it('IN_PROGRESS returns COMPLETED and ABANDONED', () => {
    const { getNextStates } = require(LIFECYCLE_PATH);
    assert.deepEqual(getNextStates('IN_PROGRESS'), ['COMPLETED', 'ABANDONED']);
  });
});

describe('isTerminal', () => {
  it('COMPLETED is terminal', () => {
    const { isTerminal } = require(LIFECYCLE_PATH);
    assert.equal(isTerminal('COMPLETED'), true);
  });

  it('ABANDONED is terminal', () => {
    const { isTerminal } = require(LIFECYCLE_PATH);
    assert.equal(isTerminal('ABANDONED'), true);
  });

  it('DRAFT is not terminal', () => {
    const { isTerminal } = require(LIFECYCLE_PATH);
    assert.equal(isTerminal('DRAFT'), false);
  });

  it('IN_PROGRESS is not terminal', () => {
    const { isTerminal } = require(LIFECYCLE_PATH);
    assert.equal(isTerminal('IN_PROGRESS'), false);
  });

  it('APPROVED is not terminal', () => {
    const { isTerminal } = require(LIFECYCLE_PATH);
    assert.equal(isTerminal('APPROVED'), false);
  });
});
