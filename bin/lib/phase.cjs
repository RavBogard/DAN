#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, atomicWriteFileSync } = require('./core.cjs');
const { extractField, setField } = require('./state.cjs');

/**
 * Render a progress bar string.
 * @param {number} percent - 0-100
 * @param {number} width - Total width of bar characters (default 10)
 * @returns {string} e.g. "[=====.....] 50%"
 */
function renderProgressBar(percent, width) {
  width = width || 10;
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const filled = Math.round((clamped / 100) * width);
  const empty = width - filled;
  return '[' + '='.repeat(filled) + '.'.repeat(empty) + '] ' + clamped + '%';
}

/**
 * Pad a number to 2 digits.
 */
function pad2(val) {
  const s = String(val).replace(/^0+/, '') || '0';
  return s.length < 2 ? '0' + s : s;
}

/**
 * Find a phase directory by number.
 * @param {string} cwd - Working directory
 * @param {string} phaseNum - Phase number (can be "1" or "01")
 * @returns {string} Absolute path to phase directory
 */
function findPhase(cwd, phaseNum) {
  const padded = pad2(phaseNum);
  const phasesDir = path.join(cwd, '.planning', 'phases');

  if (!fs.existsSync(phasesDir)) {
    error('Phases directory not found: ' + phasesDir);
  }

  const dirs = fs.readdirSync(phasesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  const match = dirs.find(d => d.startsWith(padded + '-'));
  if (!match) {
    error('Phase not found: ' + padded + ' (searched in ' + phasesDir + ')');
  }

  return path.join(phasesDir, match);
}

/**
 * List all phase directories with status info.
 * @param {string} cwd - Working directory
 * @returns {Array<{phase: string, name: string, path: string, plans_total: number}>}
 */
function listPhases(cwd) {
  const phasesDir = path.join(cwd, '.planning', 'phases');

  if (!fs.existsSync(phasesDir)) {
    error('Phases directory not found: ' + phasesDir);
  }

  const dirs = fs.readdirSync(phasesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  const phases = [];
  for (const dir of dirs) {
    const match = dir.match(/^(\d+)-(.+)$/);
    if (!match) continue;

    const phaseNum = match[1];
    const phaseName = match[2];
    const phaseDir = path.join(phasesDir, dir);

    // Count plan files
    const planFiles = fs.readdirSync(phaseDir)
      .filter(f => f.match(/^\d+-\d+-PLAN\.md$/));
    const summaryFiles = fs.readdirSync(phaseDir)
      .filter(f => f.match(/^\d+-\d+-SUMMARY\.md$/));

    phases.push({
      phase: phaseNum,
      name: phaseName,
      path: phaseDir,
      plans_total: planFiles.length,
      plans_complete: summaryFiles.length
    });
  }

  return phases;
}

/**
 * Count total plans across all phases for progress calculation.
 * @param {string} cwd
 * @returns {{totalPlans: number, completedPlans: number, currentPhaseIdx: number, totalPhases: number}}
 */
function countAllPlans(cwd) {
  const phases = listPhases(cwd);
  let totalPlans = 0;
  let completedPlans = 0;

  for (const p of phases) {
    totalPlans += p.plans_total;
    completedPlans += p.plans_complete;
  }

  return { totalPlans, completedPlans, totalPhases: phases.length };
}

/**
 * Advance the plan counter in STATE.md.
 * Increments "Plan: X of Y" and updates progress bar.
 */
function advancePlan(cwd) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) {
    error('STATE.md not found at: ' + statePath);
  }

  let content = fs.readFileSync(statePath, 'utf-8');

  // Parse current plan position: "Plan: X of Y in current phase"
  const planField = extractField(content, 'Plan');
  if (!planField) {
    error('Could not find Plan field in STATE.md');
  }

  const planMatch = planField.match(/(\d+)\s+of\s+(\d+)/);
  if (!planMatch) {
    error('Could not parse Plan field: ' + planField);
  }

  const currentPlan = parseInt(planMatch[1], 10);
  const totalPlans = parseInt(planMatch[2], 10);
  const newPlan = Math.min(currentPlan + 1, totalPlans);

  // Parse current phase info
  const phaseField = extractField(content, 'Phase');
  let phaseNum = '01';
  let phaseName = '';
  if (phaseField) {
    const phaseMatch = phaseField.match(/(\d+)\s+of\s+(\d+)\s*\(([^)]*)\)/);
    if (phaseMatch) {
      phaseNum = pad2(phaseMatch[1]);
      phaseName = phaseMatch[3];
    }
  }

  // Update plan field
  content = setField(content, 'Plan', newPlan + ' of ' + totalPlans + ' in current phase');

  // Update progress: based on overall progress across all phases
  const stats = countAllPlans(cwd);
  // The new completed count: use the actual summaries on disk + 1 for the just-completed plan
  const overallPercent = stats.totalPlans > 0
    ? Math.round(((stats.completedPlans + 1) / stats.totalPlans) * 100)
    : 0;
  const progressBar = renderProgressBar(overallPercent);
  content = setField(content, 'Progress', progressBar);

  // Update last activity
  const today = new Date().toISOString().split('T')[0];
  content = setField(content, 'Last activity', today + ' -- Completed plan ' + phaseNum + '-' + pad2(currentPlan));

  atomicWriteFileSync(statePath, content);

  return {
    plan: newPlan + ' of ' + totalPlans,
    progress: progressBar,
    updated: true
  };
}

/**
 * Mark current phase as complete and advance to next phase.
 */
function completePhase(cwd) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) {
    error('STATE.md not found at: ' + statePath);
  }

  let content = fs.readFileSync(statePath, 'utf-8');

  // Parse current phase
  const phaseField = extractField(content, 'Phase');
  if (!phaseField) {
    error('Could not find Phase field in STATE.md');
  }

  const phaseMatch = phaseField.match(/(\d+)\s+of\s+(\d+)\s*\(([^)]*)\)/);
  if (!phaseMatch) {
    error('Could not parse Phase field: ' + phaseField);
  }

  const currentPhase = parseInt(phaseMatch[1], 10);
  const totalPhases = parseInt(phaseMatch[2], 10);
  const newPhase = Math.min(currentPhase + 1, totalPhases);

  // Try to get next phase name
  let newPhaseName = 'Unknown';
  try {
    const phases = listPhases(cwd);
    const nextPhase = phases.find(p => parseInt(p.phase, 10) === newPhase);
    if (nextPhase) newPhaseName = nextPhase.name;
  } catch (e) {
    // Ignore, use default
  }

  // Update phase
  content = setField(content, 'Phase', newPhase + ' of ' + totalPhases + ' (' + newPhaseName + ')');

  // Update status
  content = setField(content, 'Status', 'Phase complete - advancing to phase ' + newPhase);

  // Reset plan counter for new phase
  let newPlanTotal = 0;
  try {
    const phases = listPhases(cwd);
    const nextPhase = phases.find(p => parseInt(p.phase, 10) === newPhase);
    if (nextPhase) newPlanTotal = nextPhase.plans_total;
  } catch (e) {
    // Ignore
  }
  content = setField(content, 'Plan', '0 of ' + newPlanTotal + ' in current phase');

  // Update last activity
  const today = new Date().toISOString().split('T')[0];
  content = setField(content, 'Last activity', today + ' -- Phase ' + currentPhase + ' complete');

  atomicWriteFileSync(statePath, content);

  return {
    phase: newPhase + ' of ' + totalPhases,
    status: 'Phase complete',
    updated: true
  };
}

/**
 * Handle phase subcommands: find, list, advance-plan, complete
 */
function handle(cwd, args, raw) {
  const subcommand = args[0];

  if (!subcommand) {
    error('Usage: dan-tools.cjs phase <find|list|advance-plan|complete> [args]');
  }

  switch (subcommand) {
    case 'find': {
      const phaseNum = args[1];
      if (!phaseNum) error('Usage: dan-tools.cjs phase find <phaseNumber>');
      const phasePath = findPhase(cwd, phaseNum);
      const posixPath = phasePath.split(path.sep).join('/');
      output({ path: posixPath }, raw, posixPath);
      break;
    }

    case 'list': {
      const phases = listPhases(cwd);
      output({ phases, count: phases.length }, raw);
      break;
    }

    case 'advance-plan': {
      const result = advancePlan(cwd);
      output(result, raw);
      break;
    }

    case 'complete': {
      const result = completePhase(cwd);
      output(result, raw);
      break;
    }

    default:
      error('Unknown phase subcommand: ' + subcommand + '. Use: find, list, advance-plan, complete');
  }
}

module.exports = { handle, renderProgressBar, findPhase, listPhases };
