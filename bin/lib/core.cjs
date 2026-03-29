#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const DEFAULTS = {
  mode: 'yolo',
  granularity: 'standard',
  autonomy_level: 'milestone',
  model_profile: 'quality',
  commit_docs: true,
  workflow: {
    research: true,
    plan_check: true,
    verifier: true,
    nyquist_validation: true
  }
};

/**
 * Write JSON output to stdout. Payloads over 50KB go to temp file with @file: prefix.
 * @param {*} result - The data to output
 * @param {boolean} raw - If true and rawValue provided, output raw string
 * @param {*} rawValue - Raw value to output when raw=true
 */
function output(result, raw, rawValue) {
  if (raw && rawValue !== undefined) {
    process.stdout.write(String(rawValue));
  } else {
    const json = JSON.stringify(result, null, 2);
    if (json.length > 50000) {
      const tmpPath = path.join(os.tmpdir(), 'dan-' + Date.now() + '.json');
      fs.writeFileSync(tmpPath, json, 'utf-8');
      process.stdout.write('@file:' + tmpPath);
    } else {
      process.stdout.write(json);
    }
  }
  process.exit(0);
}

/**
 * Write error to stderr and exit with code 1.
 * @param {string} msg - Error message
 */
function error(msg) {
  process.stderr.write('Error: ' + msg + '\n');
  process.exit(1);
}

/**
 * Atomic file write: write to temp file then rename.
 * Prevents corruption if process is interrupted mid-write.
 * @param {string} filePath - Target file path
 * @param {string} content - File content to write
 */
function atomicWriteFileSync(filePath, content) {
  const tmpPath = filePath + '.tmp.' + process.pid;
  fs.writeFileSync(tmpPath, content, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

/**
 * Safe git command execution via execFileSync (no shell injection).
 * @param {string} cwd - Working directory
 * @param {string[]} args - Git arguments array
 * @returns {{exitCode: number, stdout: string, stderr: string}}
 */
function execGit(cwd, args) {
  try {
    const stdout = execFileSync('git', args, {
      cwd: cwd,
      stdio: 'pipe',
      encoding: 'utf-8'
    });
    return { exitCode: 0, stdout: (stdout || '').trim(), stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status || 1,
      stdout: (err.stdout || '').toString().trim(),
      stderr: (err.stderr || '').toString().trim()
    };
  }
}

/**
 * Convert path separators to forward slashes (POSIX).
 * @param {string} p - Path to convert
 * @returns {string}
 */
function toPosixPath(p) {
  return p.split(path.sep).join('/');
}

/**
 * Load dan.config.json from .planning/ directory, merge with defaults.
 * @param {string} cwd - Working directory containing .planning/
 * @returns {object} Config with defaults applied
 */
function loadConfig(cwd) {
  const configPath = path.join(cwd, '.planning', 'dan.config.json');
  let fileConfig = {};
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    fileConfig = JSON.parse(raw);
  } catch (e) {
    // Missing or invalid file -- use defaults
  }

  // Deep merge: defaults then file overrides
  const merged = Object.assign({}, DEFAULTS, fileConfig);
  // Merge workflow sub-object
  merged.workflow = Object.assign({}, DEFAULTS.workflow, fileConfig.workflow || {});
  return merged;
}

module.exports = {
  output,
  error,
  atomicWriteFileSync,
  execGit,
  toPosixPath,
  loadConfig
};
