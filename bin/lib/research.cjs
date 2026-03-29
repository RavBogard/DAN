#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, atomicWriteFileSync } = require('./core.cjs');

/**
 * Get the path to research state.json for a given target.
 * @param {string} cwd - Working directory
 * @param {string} target - "project" or phase number (e.g. "3" or "03")
 * @returns {string} Absolute path to state.json
 */
function getStatePath(cwd, target) {
  if (target === 'project') {
    return path.join(cwd, '.planning', 'research', 'state.json');
  }
  // Phase target: "3" or "03"
  const padded = String(target).replace(/^0+/, '').padStart(2, '0');
  const phasesDir = path.join(cwd, '.planning', 'phases');
  let dirs;
  try {
    dirs = fs.readdirSync(phasesDir).filter(d => d.startsWith(padded + '-'));
  } catch (e) {
    error('Phases directory not found: ' + phasesDir);
  }
  if (dirs.length === 0) error('Phase not found: ' + target);
  return path.join(phasesDir, dirs[0], 'research', 'state.json');
}

/**
 * Initialize research state for a target.
 * @param {string} cwd - Working directory
 * @param {string} target - "project" or phase number
 * @param {number} [maxPasses=4] - Maximum research passes
 * @returns {object} Initial state object
 */
function initResearch(cwd, target, maxPasses) {
  const statePath = getStatePath(cwd, target);
  const dir = path.dirname(statePath);
  fs.mkdirSync(dir, { recursive: true });

  const state = {
    target: target === 'project' ? 'project' : 'phase-' + String(target).replace(/^0+/, ''),
    max_passes: maxPasses || 4,
    current_pass: 0,
    passes: [],
    converged: false,
    convergence_reason: null
  };

  atomicWriteFileSync(statePath, JSON.stringify(state, null, 2));
  return state;
}

/**
 * Record a completed research pass.
 * @param {string} cwd - Working directory
 * @param {string} target - "project" or phase number
 * @param {number} passNum - Pass number
 * @param {Array} gaps - Array of gap objects
 * @param {object} confidence - Confidence per dimension
 * @returns {object} Updated state object
 */
function recordPass(cwd, target, passNum, gaps, confidence) {
  const statePath = getStatePath(cwd, target);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));

  state.current_pass = passNum;
  state.passes.push({
    pass: passNum,
    completed: new Date().toISOString(),
    gaps_found: gaps.length,
    gaps: gaps,
    confidence: confidence
  });

  atomicWriteFileSync(statePath, JSON.stringify(state, null, 2));
  return state;
}

/**
 * Check whether research should continue based on convergence heuristics.
 * Checks in order: (1) hard cap, (2) no gaps, (3) all HIGH, (4) diminishing returns.
 * @param {string} cwd - Working directory
 * @param {string} target - "project" or phase number
 * @returns {{should_continue: boolean, reason: string}}
 */
function checkConvergence(cwd, target) {
  const statePath = getStatePath(cwd, target);
  const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));

  const lastPass = state.passes[state.passes.length - 1];
  if (!lastPass) return { should_continue: true, reason: 'no passes completed yet' };

  // Check 1: Hard cap
  if (state.current_pass >= state.max_passes) {
    return { should_continue: false, reason: 'hard cap reached (' + state.max_passes + ' passes)' };
  }

  // Check 2: No gaps
  if (lastPass.gaps_found === 0) {
    return { should_continue: false, reason: 'no gaps remaining' };
  }

  // Check 3: All dimensions HIGH
  const conf = lastPass.confidence || {};
  const values = Object.values(conf);
  if (values.length > 0 && values.every(v => v === 'HIGH')) {
    return { should_continue: false, reason: 'all dimensions HIGH confidence' };
  }

  // Check 4: Diminishing returns (gap count not decreasing)
  if (state.passes.length >= 2) {
    const prevPass = state.passes[state.passes.length - 2];
    if (lastPass.gaps_found >= prevPass.gaps_found) {
      return { should_continue: false, reason: 'diminishing returns (gaps not decreasing)' };
    }
  }

  return { should_continue: true, reason: 'gaps remain and progress being made' };
}

/**
 * Get current research state.
 * @param {string} cwd - Working directory
 * @param {string} target - "project" or phase number
 * @returns {object} Current state object
 */
function getStatus(cwd, target) {
  const statePath = getStatePath(cwd, target);
  return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
}

/**
 * Handle CLI subcommands: init, record-pass, check-convergence, status
 * @param {string} cwd - Working directory
 * @param {string[]} subArgs - Subcommand arguments
 * @param {boolean} raw - Raw output mode
 */
function handle(cwd, subArgs, raw) {
  const sub = subArgs[0];
  const target = subArgs[1];

  if (!sub) error('Usage: research <init|record-pass|check-convergence|status> <target> [options]');
  if (!target && sub !== 'help') error('Target required (e.g., "project" or phase number)');

  switch (sub) {
    case 'init': {
      const mpIdx = subArgs.indexOf('--max-passes');
      const maxPasses = mpIdx !== -1 ? parseInt(subArgs[mpIdx + 1], 10) : 4;
      const state = initResearch(cwd, target, maxPasses);
      output(state, raw);
      break;
    }
    case 'record-pass': {
      const passIdx = subArgs.indexOf('--pass');
      if (passIdx === -1) error('--pass <number> required');
      const passNum = parseInt(subArgs[passIdx + 1], 10);

      const gapsIdx = subArgs.indexOf('--gaps');
      const gaps = gapsIdx !== -1 ? JSON.parse(subArgs[gapsIdx + 1]) : [];

      const confIdx = subArgs.indexOf('--confidence');
      const confidence = confIdx !== -1 ? JSON.parse(subArgs[confIdx + 1]) : {};

      const state = recordPass(cwd, target, passNum, gaps, confidence);
      output(state, raw);
      break;
    }
    case 'check-convergence': {
      const result = checkConvergence(cwd, target);
      output(result, raw);
      break;
    }
    case 'status': {
      const state = getStatus(cwd, target);
      output(state, raw);
      break;
    }
    default:
      error('Unknown research subcommand: ' + sub + '\nAvailable: init, record-pass, check-convergence, status');
  }
}

module.exports = { handle, initResearch, recordPass, checkConvergence, getStatus };
