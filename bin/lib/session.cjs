#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, atomicWriteFileSync } = require('./core.cjs');
const { parseState, setField } = require('./state.cjs');
const { parse, serialize } = require('./frontmatter.cjs');

/**
 * Save session: write pipeline position to STATE.md frontmatter, set status to paused.
 * Uses flat frontmatter keys (pipeline_phase, pipeline_plan, pipeline_task, pipeline_stage, pipeline_wave).
 * @param {string} cwd - Working directory
 * @param {object} position - {phase, plan, task, stage, wave?}
 */
function saveSession(cwd, position) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) {
    error('STATE.md not found at: ' + statePath);
  }

  const content = fs.readFileSync(statePath, 'utf-8');
  const { frontmatter, body } = parse(content);

  // Write flat pipeline position keys
  frontmatter.pipeline_phase = position.phase;
  frontmatter.pipeline_plan = position.plan;
  frontmatter.pipeline_task = position.task;
  frontmatter.pipeline_stage = position.stage;
  if (position.wave !== undefined) {
    frontmatter.pipeline_wave = position.wave;
  }

  // Set status to paused
  frontmatter.status = 'paused';

  // Set last_updated
  frontmatter.last_updated = new Date().toISOString();

  // Serialize frontmatter back
  let updated = serialize(frontmatter, body);

  // Also update the body fields via setField
  const stoppedAt = 'Phase ' + position.phase + ', plan ' + position.plan +
    ', task ' + position.task + ', stage: ' + position.stage;
  updated = setField(updated, 'Stopped at', stoppedAt);
  updated = setField(updated, 'Status', 'paused');

  atomicWriteFileSync(statePath, updated);
}

/**
 * Restore session: read pipeline position from STATE.md frontmatter.
 * @param {string} cwd - Working directory
 * @returns {{position, next_action, decisions, blockers}}
 */
function restoreSession(cwd) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) {
    error('STATE.md not found at: ' + statePath);
  }

  const content = fs.readFileSync(statePath, 'utf-8');
  const { frontmatter } = parse(content);
  const stateData = parseState(content);

  // Reconstruct position from flat pipeline_* keys
  const position = {};
  if (frontmatter.pipeline_phase !== undefined) position.phase = frontmatter.pipeline_phase;
  if (frontmatter.pipeline_plan !== undefined) position.plan = frontmatter.pipeline_plan;
  if (frontmatter.pipeline_task !== undefined) position.task = frontmatter.pipeline_task;
  if (frontmatter.pipeline_stage !== undefined) position.stage = frontmatter.pipeline_stage;
  if (frontmatter.pipeline_wave !== undefined) position.wave = frontmatter.pipeline_wave;

  // Determine next action
  const actionData = Object.assign({}, stateData, frontmatter);
  const next_action = determineNextAction(actionData);

  // Extract decisions and blockers from parsed state
  const decisions = stateData.decisions || [];
  const blockers = stateData.blockers_concerns || [];

  return {
    position,
    next_action,
    decisions,
    blockers
  };
}

/**
 * Determine the next action based on state data.
 * Priority order:
 *   1. paused -> resume
 *   2. in_progress with plan -> continue-apply
 *   3. all plans done, no verification -> verify
 *   4. verification has gaps -> bugsweep
 *   5. phase complete, more phases -> next-phase
 *   6. all done -> complete
 *   7. no plans -> plan
 *   8. no research -> research
 *
 * @param {object} stateData - Merged state/frontmatter data
 * @returns {{action: string, skill: string, args: string}}
 */
function determineNextAction(stateData) {
  const status = stateData.status || 'unknown';

  // 1. Paused -> resume
  if (status === 'paused') {
    return {
      action: 'resume',
      skill: 'dan:resume',
      args: ''
    };
  }

  // 8. No research -> research (check before no_plans since research comes first)
  if (stateData.no_research) {
    return {
      action: 'research',
      skill: 'dan:research',
      args: ''
    };
  }

  // 7. No plans -> plan
  if (stateData.no_plans) {
    return {
      action: 'plan',
      skill: 'dan:plan',
      args: ''
    };
  }

  // 2. In-progress with pipeline position -> continue apply
  if (status === 'in_progress' && stateData.pipeline_plan && !stateData.all_plans_done) {
    return {
      action: 'continue-apply',
      skill: 'dan:apply',
      args: stateData.pipeline_plan || ''
    };
  }

  // 3. All plans done, no verification -> verify
  if (stateData.all_plans_done && !stateData.has_verification) {
    return {
      action: 'verify',
      skill: 'dan:verify',
      args: ''
    };
  }

  // 4. Verification gaps -> bugsweep
  if (stateData.all_plans_done && stateData.has_verification && stateData.verification_gaps) {
    return {
      action: 'bugsweep',
      skill: 'dan:bugsweep',
      args: ''
    };
  }

  // 5. Phase complete, more phases -> next-phase
  if (stateData.phase_complete && stateData.has_more_phases) {
    return {
      action: 'next-phase',
      skill: 'dan:milestone',
      args: ''
    };
  }

  // 6. All done -> complete
  if (stateData.phase_complete && !stateData.has_more_phases) {
    return {
      action: 'complete',
      skill: 'dan:status',
      args: ''
    };
  }

  // Default: show status
  return {
    action: 'status',
    skill: 'dan:status',
    args: ''
  };
}

/**
 * Handle session subcommands: save, restore, next-action
 */
function handle(cwd, args, raw) {
  const subcommand = args[0];

  if (!subcommand) {
    error('Usage: dan-tools.cjs session <save|restore|next-action> [args]');
  }

  switch (subcommand) {
    case 'save': {
      const posJson = args[1];
      if (!posJson) error('Usage: dan-tools.cjs session save <positionJSON>');
      let position;
      try {
        position = JSON.parse(posJson);
      } catch (e) {
        error('Invalid JSON: ' + e.message);
      }
      saveSession(cwd, position);
      output({ saved: true, position }, raw);
      break;
    }

    case 'restore': {
      const result = restoreSession(cwd);
      output(result, raw);
      break;
    }

    case 'next-action': {
      const statePath = path.join(cwd, '.planning', 'STATE.md');
      if (!fs.existsSync(statePath)) error('STATE.md not found');
      const content = fs.readFileSync(statePath, 'utf-8');
      const { frontmatter } = parse(content);
      const stateData = parseState(content);
      const merged = Object.assign({}, stateData, frontmatter);
      const result = determineNextAction(merged);
      output(result, raw);
      break;
    }

    default:
      error('Unknown session subcommand: ' + subcommand + '. Use: save, restore, next-action');
  }
}

module.exports = { handle, saveSession, restoreSession, determineNextAction };
