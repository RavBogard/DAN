#!/usr/bin/env node
'use strict';

/**
 * Plan lifecycle state machine.
 * Validates state transitions for plan execution workflow.
 */

const PLAN_STATES = Object.freeze({
  DRAFT: 'DRAFT',
  APPROVED: 'APPROVED',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  ABANDONED: 'ABANDONED'
});

const VALID_TRANSITIONS = Object.freeze({
  DRAFT: ['APPROVED', 'ABANDONED'],
  APPROVED: ['IN_PROGRESS', 'ABANDONED'],
  IN_PROGRESS: ['COMPLETED', 'ABANDONED'],
  COMPLETED: [],
  ABANDONED: []
});

/**
 * Validate whether a state transition is allowed.
 * @param {string} from - Current state
 * @param {string} to - Desired next state
 * @returns {{ valid: true } | { valid: false, reason: string }}
 */
function validateTransition(from, to) {
  if (!VALID_TRANSITIONS[from]) {
    return { valid: false, reason: 'Unknown state: ' + from };
  }
  if (!VALID_TRANSITIONS[to] && !Object.values(PLAN_STATES).includes(to)) {
    return { valid: false, reason: 'Unknown state: ' + to };
  }
  const allowed = VALID_TRANSITIONS[from];
  if (allowed.includes(to)) {
    return { valid: true };
  }
  if (allowed.length === 0) {
    return { valid: false, reason: from + ' is a terminal state; no transitions allowed' };
  }
  return { valid: false, reason: 'Cannot transition from ' + from + ' to ' + to + '. Allowed: ' + allowed.join(', ') };
}

/**
 * Get the list of valid next states from a given state.
 * @param {string} state - Current state
 * @returns {string[]}
 */
function getNextStates(state) {
  return VALID_TRANSITIONS[state] || [];
}

/**
 * Check if a state is terminal (no outgoing transitions).
 * @param {string} state
 * @returns {boolean}
 */
function isTerminal(state) {
  const transitions = VALID_TRANSITIONS[state];
  return Array.isArray(transitions) && transitions.length === 0;
}

const { output, error } = require('./core.cjs');

/**
 * Handle lifecycle subcommands from CLI router.
 */
function handle(cwd, args, raw) {
  const subcommand = args[0];

  if (!subcommand) {
    error('Usage: dan-tools.cjs lifecycle <validate|next> [args]');
  }

  switch (subcommand) {
    case 'validate': {
      const from = args[1];
      const to = args[2];
      if (!from || !to) error('Usage: dan-tools.cjs lifecycle validate <from-state> <to-state>');
      output(validateTransition(from, to), raw);
      break;
    }
    case 'next': {
      const state = args[1];
      if (!state) error('Usage: dan-tools.cjs lifecycle next <state>');
      output(getNextStates(state), raw);
      break;
    }
    default:
      error('Unknown lifecycle subcommand: ' + subcommand + '. Use: validate, next');
  }
}

module.exports = {
  handle,
  PLAN_STATES,
  VALID_TRANSITIONS,
  validateTransition,
  getNextStates,
  isTerminal
};
