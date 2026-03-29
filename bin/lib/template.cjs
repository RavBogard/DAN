#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { output, error } = require('./core.cjs');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

/**
 * Parse named flags from args array.
 * e.g. ['--phase', '01', '--plan', '02'] -> { phase: '01', plan: '02' }
 */
function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--') && i + 1 < args.length) {
      const key = args[i].substring(2);
      flags[key] = args[i + 1];
      i++;
    }
  }
  return flags;
}

/**
 * Pad a number/string to 2 digits.
 */
function pad2(val) {
  const s = String(val);
  return s.length < 2 ? '0' + s : s;
}

/**
 * Replace all placeholders in template content.
 */
function replacePlaceholders(content, flags) {
  const phase = flags.phase || '01';
  const plan = flags.plan || '01';
  const phaseName = flags.name || 'unnamed';
  const paddedPhase = pad2(phase);
  const paddedPlan = pad2(plan);
  const date = new Date().toISOString().split('T')[0];

  let result = content;
  result = result.replace(/\{\{PHASE\}\}/g, String(phase));
  result = result.replace(/\{\{PLAN\}\}/g, String(plan));
  result = result.replace(/\{\{PHASE_NAME\}\}/g, phaseName);
  result = result.replace(/\{\{DATE\}\}/g, date);
  result = result.replace(/\{\{PADDED_PHASE\}\}/g, paddedPhase);
  result = result.replace(/\{\{PADDED_PLAN\}\}/g, paddedPlan);

  return result;
}

/**
 * Fill a template by type.
 */
function fill(type, flags) {
  const templateMap = {
    plan: 'plan.md',
    summary: 'summary.md',
    state: 'state.md',
    project: 'project.md',
    config: 'config.json'
  };

  const templateFile = templateMap[type];
  if (!templateFile) {
    error('Unknown template type: ' + type + '. Available: ' + Object.keys(templateMap).join(', '));
  }

  const templatePath = path.join(TEMPLATES_DIR, templateFile);
  if (!fs.existsSync(templatePath)) {
    error('Template file not found: ' + templatePath);
  }

  const content = fs.readFileSync(templatePath, 'utf-8');
  return replacePlaceholders(content, flags);
}

/**
 * Handle template subcommands: fill
 */
function handle(cwd, args, raw) {
  const subcommand = args[0];

  if (!subcommand) {
    error('Usage: dan-tools.cjs template <fill> [args]');
  }

  switch (subcommand) {
    case 'fill': {
      const type = args[1];
      if (!type) {
        error('Usage: dan-tools.cjs template fill <plan|summary|state|project|config> [--phase N] [--plan M] [--name phaseName]');
      }
      const flags = parseFlags(args.slice(2));
      const result = fill(type, flags);
      output({ output: result }, raw, result);
      break;
    }

    default:
      error('Unknown template subcommand: ' + subcommand + '. Use: fill');
  }
}

module.exports = { handle };
