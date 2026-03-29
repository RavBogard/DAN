#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, atomicWriteFileSync } = require('./core.cjs');
const { listPhases } = require('./phase.cjs');
const { parseState, setField, extractField } = require('./state.cjs');
const { parse } = require('./frontmatter.cjs');
const { topologicalSort } = require('./dependency.cjs');

/**
 * Get milestone status: current milestone, completed/remaining phases, pipeline stage.
 * @param {string} cwd - Working directory
 * @returns {{milestone, status, phases_complete[], phases_remaining[], current_phase, pipeline_stage}}
 */
function getMilestoneStatus(cwd) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) {
    error('STATE.md not found at: ' + statePath);
  }

  const content = fs.readFileSync(statePath, 'utf-8');
  const { frontmatter } = parse(content);
  const stateData = parseState(content);

  const milestone = frontmatter.milestone || stateData.milestone || 'unknown';
  const status = frontmatter.status || stateData.status || 'unknown';

  const phases = listPhases(cwd);
  const phases_complete = [];
  const phases_remaining = [];

  for (const p of phases) {
    if (p.plans_total > 0 && p.plans_complete >= p.plans_total) {
      phases_complete.push({ phase: p.phase, name: p.name });
    } else {
      phases_remaining.push({ phase: p.phase, name: p.name });
    }
  }

  // Determine current phase from STATE.md
  let current_phase = null;
  if (stateData.phase) {
    const phaseMatch = stateData.phase.match(/(\d+)\s+of/);
    if (phaseMatch) {
      current_phase = String(phaseMatch[1]).replace(/^0+/, '') || '0';
      // Pad to match phase directory format
      current_phase = current_phase.length < 2 ? '0' + current_phase : current_phase;
    }
  }

  // Pipeline stage: derived from status
  let pipeline_stage = 'unknown';
  if (status === 'completed' || status === 'complete') {
    pipeline_stage = 'complete';
  } else if (status === 'paused') {
    pipeline_stage = 'paused';
  } else if (status === 'in_progress') {
    pipeline_stage = 'executing';
  } else {
    pipeline_stage = status;
  }

  return {
    milestone,
    status,
    phases_complete,
    phases_remaining,
    current_phase,
    pipeline_stage
  };
}

/**
 * Get pipeline execution order for phases by parsing ROADMAP.md dependencies.
 * @param {string} cwd - Working directory
 * @returns {string[]} Phase numbers in dependency order
 */
function getPipelineOrder(cwd) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  if (!fs.existsSync(roadmapPath)) {
    error('ROADMAP.md not found at: ' + roadmapPath);
  }

  const content = fs.readFileSync(roadmapPath, 'utf-8');

  // Parse phase headers and their dependencies
  const phases = [];
  const phasePattern = /###\s+Phase\s+(\d+):\s*(.+)/g;
  let match;

  while ((match = phasePattern.exec(content)) !== null) {
    const phaseNum = match[1];
    const headerEnd = match.index + match[0].length;

    // Find the "Depends on" line after this header
    const nextSection = content.indexOf('### ', headerEnd + 1);
    const sectionContent = nextSection === -1
      ? content.substring(headerEnd)
      : content.substring(headerEnd, nextSection);

    const depsMatch = sectionContent.match(/\*\*Depends on\*\*:\s*(.+)/);
    const depends_on = [];

    if (depsMatch) {
      const depsStr = depsMatch[1].trim();
      if (depsStr !== 'Nothing' && depsStr !== 'None' && depsStr !== '-') {
        // Parse "Phase 1", "Phase 2, Phase 3" etc
        const depPhases = depsStr.match(/Phase\s+(\d+)/g);
        if (depPhases) {
          for (const dp of depPhases) {
            const num = dp.match(/\d+/)[0];
            depends_on.push(num);
          }
        }
      }
    }

    phases.push({ id: phaseNum, depends_on });
  }

  if (phases.length === 0) {
    return [];
  }

  return topologicalSort(phases);
}

/**
 * Validate wave partitioning: check that no two plans in the same wave
 * modify the same files.
 * @param {string} phaseDir - Absolute path to phase directory
 * @returns {{valid: boolean, conflicts?: Array<{wave: number, plans: string[], files: string[]}>}}
 */
function validateWavePartitioning(phaseDir) {
  if (!fs.existsSync(phaseDir)) {
    error('Phase directory not found: ' + phaseDir);
  }

  const planFiles = fs.readdirSync(phaseDir).filter(f => f.match(/^\d+-\d+-PLAN\.md$/));

  // Parse each plan's wave and files_modified
  const planData = [];
  for (const file of planFiles) {
    const content = fs.readFileSync(path.join(phaseDir, file), 'utf-8');
    const { frontmatter } = parse(content);

    const idMatch = file.match(/^(\d+-\d+)-PLAN\.md$/);
    if (!idMatch) continue;

    const wave = frontmatter.wave || 1;
    let files_modified = frontmatter.files_modified || [];
    if (!Array.isArray(files_modified)) files_modified = [files_modified];
    files_modified = files_modified.map(String);

    planData.push({
      id: idMatch[1],
      wave: typeof wave === 'number' ? wave : parseInt(wave, 10) || 1,
      files_modified
    });
  }

  // Group by wave
  const waveGroups = {};
  for (const plan of planData) {
    if (!waveGroups[plan.wave]) waveGroups[plan.wave] = [];
    waveGroups[plan.wave].push(plan);
  }

  // Check for overlapping files_modified within each wave
  const conflicts = [];
  for (const [waveNum, plans] of Object.entries(waveGroups)) {
    if (plans.length < 2) continue;

    // Track which files are claimed by which plans
    const fileOwners = {};
    for (const plan of plans) {
      for (const file of plan.files_modified) {
        if (!fileOwners[file]) fileOwners[file] = [];
        fileOwners[file].push(plan.id);
      }
    }

    // Find files claimed by multiple plans
    const conflictFiles = [];
    const conflictPlans = new Set();
    for (const [file, owners] of Object.entries(fileOwners)) {
      if (owners.length > 1) {
        conflictFiles.push(file);
        for (const owner of owners) conflictPlans.add(owner);
      }
    }

    if (conflictFiles.length > 0) {
      conflicts.push({
        wave: parseInt(waveNum, 10),
        plans: Array.from(conflictPlans).sort(),
        files: conflictFiles.sort()
      });
    }
  }

  if (conflicts.length > 0) {
    return { valid: false, conflicts };
  }

  return { valid: true };
}

/**
 * Record a phase error in STATE.md.
 * @param {string} cwd - Working directory
 * @param {string} phaseNum - Phase number
 * @param {string} stage - Pipeline stage (research, plan, apply, verify, bugsweep)
 * @param {string} reason - Error description
 */
function recordPhaseError(cwd, phaseNum, stage, reason) {
  const statePath = path.join(cwd, '.planning', 'STATE.md');
  if (!fs.existsSync(statePath)) {
    error('STATE.md not found at: ' + statePath);
  }

  let content = fs.readFileSync(statePath, 'utf-8');

  const errorMsg = 'Phase ' + phaseNum + ', stage: ' + stage + ' -- ' + reason;
  content = setField(content, 'Stopped at', errorMsg);
  content = setField(content, 'Status', 'error');

  atomicWriteFileSync(statePath, content);
}

/**
 * Get overall progress across all phases.
 * @param {string} cwd - Working directory
 * @returns {{total_phases, completed_phases, total_plans, completed_plans, percent}}
 */
function getProgress(cwd) {
  const phases = listPhases(cwd);
  let total_plans = 0;
  let completed_plans = 0;
  let completed_phases = 0;

  for (const p of phases) {
    total_plans += p.plans_total;
    completed_plans += p.plans_complete;
    if (p.plans_total > 0 && p.plans_complete >= p.plans_total) {
      completed_phases++;
    }
  }

  const percent = total_plans > 0 ? Math.round((completed_plans / total_plans) * 100) : 0;

  return {
    total_phases: phases.length,
    completed_phases,
    total_plans,
    completed_plans,
    percent
  };
}

/**
 * Handle milestone subcommands: status, pipeline-order, validate-wave, record-error, progress
 */
function handle(cwd, args, raw) {
  const subcommand = args[0];

  if (!subcommand) {
    error('Usage: dan-tools.cjs milestone <status|pipeline-order|validate-wave|record-error|progress> [args]');
  }

  switch (subcommand) {
    case 'status': {
      const result = getMilestoneStatus(cwd);
      output(result, raw);
      break;
    }

    case 'pipeline-order': {
      const order = getPipelineOrder(cwd);
      output({ order }, raw);
      break;
    }

    case 'validate-wave': {
      const phaseDir = args[1];
      if (!phaseDir) error('Usage: dan-tools.cjs milestone validate-wave <phaseDir>');
      const resolvedDir = path.isAbsolute(phaseDir) ? phaseDir : path.join(cwd, phaseDir);
      const result = validateWavePartitioning(resolvedDir);
      output(result, raw);
      break;
    }

    case 'record-error': {
      const phaseNum = args[1];
      const stage = args[2];
      const reason = args.slice(3).join(' ');
      if (!phaseNum || !stage || !reason) {
        error('Usage: dan-tools.cjs milestone record-error <phaseNum> <stage> <reason>');
      }
      recordPhaseError(cwd, phaseNum, stage, reason);
      output({ recorded: true, phase: phaseNum, stage, reason }, raw);
      break;
    }

    case 'progress': {
      const result = getProgress(cwd);
      output(result, raw);
      break;
    }

    default:
      error('Unknown milestone subcommand: ' + subcommand + '. Use: status, pipeline-order, validate-wave, record-error, progress');
  }
}

module.exports = { handle, getMilestoneStatus, getPipelineOrder, validateWavePartitioning, recordPhaseError, getProgress };
