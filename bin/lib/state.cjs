#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, atomicWriteFileSync } = require('./core.cjs');

/**
 * Extract a field value from STATE.md content.
 * Supports both **Field:** value and Field: value patterns.
 */
function extractField(content, fieldName) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Try **Field:** value pattern first
  const boldPattern = new RegExp('\\*\\*' + escaped + ':\\*\\*\\s*(.+)', 'i');
  const boldMatch = content.match(boldPattern);
  if (boldMatch) return boldMatch[1].trim();
  // Try plain Field: value pattern
  const plainPattern = new RegExp('^' + escaped + ':\\s*(.+)', 'im');
  const plainMatch = content.match(plainPattern);
  return plainMatch ? plainMatch[1].trim() : null;
}

/**
 * Parse all known fields from STATE.md content into a structured object.
 */
function parseState(content) {
  const result = {};

  // Core position fields
  const fieldMap = {
    phase: 'Phase',
    plan: 'Plan',
    status: 'Status',
    last_activity: 'Last activity',
    progress: 'Progress',
    last_session: 'Last session',
    stopped_at: 'Stopped at',
    resume_file: 'Resume file',
    core_value: 'Core value',
    current_focus: 'Current focus'
  };

  for (const [key, label] of Object.entries(fieldMap)) {
    const value = extractField(content, label);
    if (value !== null) {
      result[key] = value;
    }
  }

  // Parse velocity section
  const totalPlans = extractField(content, 'Total plans completed');
  if (totalPlans !== null) result.total_plans_completed = totalPlans;
  const avgDuration = extractField(content, 'Average duration');
  if (avgDuration !== null) result.average_duration = avgDuration;
  const totalTime = extractField(content, 'Total execution time');
  if (totalTime !== null) result.total_execution_time = totalTime;

  // Parse sections: Decisions, Pending Todos, Blockers
  const sections = {};
  const sectionPattern = /^###\s+(.+)$/gm;
  let match;
  while ((match = sectionPattern.exec(content)) !== null) {
    const sectionName = match[1].trim();
    const startIdx = match.index + match[0].length;
    const nextSection = content.indexOf('\n## ', startIdx);
    const nextSubSection = content.indexOf('\n### ', startIdx);
    let endIdx = content.length;
    if (nextSubSection > startIdx) endIdx = Math.min(endIdx, nextSubSection);
    if (nextSection > startIdx) endIdx = Math.min(endIdx, nextSection);

    const body = content.substring(startIdx, endIdx).trim();
    const items = [];
    const lines = body.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('- ') && !trimmed.startsWith('- -')) {
        items.push(trimmed.substring(2).trim());
      }
    }
    if (items.length > 0) {
      sections[sectionName.toLowerCase().replace(/[^a-z0-9]+/g, '_')] = items;
    }
  }

  if (sections.decisions) result.decisions = sections.decisions;
  if (sections.pending_todos) result.pending_todos = sections.pending_todos;
  if (sections.blockers_concerns) result.blockers_concerns = sections.blockers_concerns;

  return result;
}

/**
 * Update a field value in STATE.md content.
 */
function setField(content, fieldName, newValue) {
  const escaped = fieldName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  // Try **Field:** value pattern first
  const boldPattern = new RegExp('(\\*\\*' + escaped + ':\\*\\*\\s*).+', 'i');
  if (boldPattern.test(content)) {
    return content.replace(boldPattern, '$1' + newValue);
  }

  // Try plain Field: value pattern
  const plainPattern = new RegExp('(^' + escaped + ':\\s*).+', 'im');
  if (plainPattern.test(content)) {
    return content.replace(plainPattern, '$1' + newValue);
  }

  return content;
}

/**
 * Handle state subcommands: read, get, set, patch
 */
function handle(cwd, args, raw) {
  const subcommand = args[0];

  if (!subcommand) {
    error('Usage: dan-tools.cjs state <read|get|set|patch> [args]');
  }

  switch (subcommand) {
    case 'read': {
      const filePath = args[1];
      if (!filePath) error('Usage: dan-tools.cjs state read <file>');
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
      if (!fs.existsSync(resolvedPath)) error('File not found: ' + resolvedPath);
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const state = parseState(content);
      output(state, raw);
      break;
    }

    case 'get': {
      const fieldName = args[1];
      const filePath = args[2];
      if (!fieldName) error('Usage: dan-tools.cjs state get <field> [file]');
      const resolvedPath = filePath
        ? (path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath))
        : path.join(cwd, '.planning', 'STATE.md');
      if (!fs.existsSync(resolvedPath)) error('File not found: ' + resolvedPath);
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const value = extractField(content, fieldName);
      output({ field: fieldName, value: value }, raw, value);
      break;
    }

    case 'set': {
      const fieldName = args[1];
      const newValue = args[2];
      const filePath = args[3];
      if (!fieldName || newValue === undefined) {
        error('Usage: dan-tools.cjs state set <field> <value> [file]');
      }
      const resolvedPath = filePath
        ? (path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath))
        : path.join(cwd, '.planning', 'STATE.md');
      if (!fs.existsSync(resolvedPath)) error('File not found: ' + resolvedPath);
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const updated = setField(content, fieldName, newValue);
      atomicWriteFileSync(resolvedPath, updated);
      output({ field: fieldName, value: newValue, updated: true }, raw);
      break;
    }

    case 'patch': {
      const jsonString = args[1];
      const filePath = args[2];
      if (!jsonString) error('Usage: dan-tools.cjs state patch <json> [file]');
      let patches;
      try {
        patches = JSON.parse(jsonString);
      } catch (e) {
        error('Invalid JSON: ' + e.message);
      }
      const resolvedPath = filePath
        ? (path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath))
        : path.join(cwd, '.planning', 'STATE.md');
      if (!fs.existsSync(resolvedPath)) error('File not found: ' + resolvedPath);
      let content = fs.readFileSync(resolvedPath, 'utf-8');
      const applied = [];
      for (const [field, value] of Object.entries(patches)) {
        content = setField(content, field, value);
        applied.push(field);
      }
      atomicWriteFileSync(resolvedPath, content);
      output({ patched: applied, count: applied.length }, raw);
      break;
    }

    default:
      error('Unknown state subcommand: ' + subcommand + '. Use: read, get, set, patch');
  }
}

module.exports = { handle, extractField, parseState, setField };
