#!/usr/bin/env node
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const QUALIFY_PATH = path.join(__dirname, '..', 'lib', 'qualify.cjs');

describe('classifyFailure', () => {
  it('returns "intent" for "wrong goal" in evidence', () => {
    const { classifyFailure } = require(QUALIFY_PATH);
    const result = classifyFailure('build auth', 'The implementation solves the wrong goal', 'implement login');
    assert.equal(result.classification, 'intent');
    assert.ok(result.reasoning);
  });

  it('returns "intent" for "wrong problem" in evidence', () => {
    const { classifyFailure } = require(QUALIFY_PATH);
    const result = classifyFailure('build auth', 'Solving the wrong problem entirely', 'implement login');
    assert.equal(result.classification, 'intent');
  });

  it('returns "intent" for "not what was asked" in evidence', () => {
    const { classifyFailure } = require(QUALIFY_PATH);
    const result = classifyFailure('build auth', 'This is not what was asked for', 'implement login');
    assert.equal(result.classification, 'intent');
  });

  it('returns "spec" for "ambiguous" in evidence', () => {
    const { classifyFailure } = require(QUALIFY_PATH);
    const result = classifyFailure('build auth', 'The spec is ambiguous about error handling', 'implement login');
    assert.equal(result.classification, 'spec');
    assert.ok(result.reasoning);
  });

  it('returns "spec" for "incomplete" in evidence', () => {
    const { classifyFailure } = require(QUALIFY_PATH);
    const result = classifyFailure('build auth', 'The specification is incomplete', 'implement login');
    assert.equal(result.classification, 'spec');
  });

  it('returns "spec" for "contradicts" in evidence', () => {
    const { classifyFailure } = require(QUALIFY_PATH);
    const result = classifyFailure('build auth', 'The task contradicts the objective', 'implement login');
    assert.equal(result.classification, 'spec');
  });

  it('returns "spec" for "missing requirement" in evidence', () => {
    const { classifyFailure } = require(QUALIFY_PATH);
    const result = classifyFailure('build auth', 'There is a missing requirement for validation', 'implement login');
    assert.equal(result.classification, 'spec');
  });

  it('returns "code" as default classification', () => {
    const { classifyFailure } = require(QUALIFY_PATH);
    const result = classifyFailure('build auth', 'The function throws TypeError', 'implement login');
    assert.equal(result.classification, 'code');
    assert.ok(result.reasoning);
  });

  it('returns "code" for generic implementation bugs', () => {
    const { classifyFailure } = require(QUALIFY_PATH);
    const result = classifyFailure('build auth', 'Off-by-one error in loop', 'implement login');
    assert.equal(result.classification, 'code');
  });

  it('intent keywords in task spec are checked', () => {
    const { classifyFailure } = require(QUALIFY_PATH);
    const result = classifyFailure('wrong goal addressed', 'Some evidence', 'implement login');
    assert.equal(result.classification, 'intent');
  });

  it('spec keywords in objective text are checked', () => {
    const { classifyFailure } = require(QUALIFY_PATH);
    const result = classifyFailure('build auth', 'Some evidence', 'ambiguous requirements');
    assert.equal(result.classification, 'spec');
  });
});
