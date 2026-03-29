#!/usr/bin/env node
'use strict';

const { output, error, loadConfig, execGit } = require('./core.cjs');

/**
 * Handle commit subcommand.
 * Usage: dan-tools.cjs commit <message> --files <file1> [file2 ...]
 */
function handle(cwd, args, raw) {
  // Parse args: first non-flag arg is the message, --files followed by file list
  let message = null;
  const files = [];
  let parsingFiles = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--files') {
      parsingFiles = true;
      continue;
    }
    if (parsingFiles) {
      files.push(args[i]);
    } else if (!message) {
      message = args[i];
    }
  }

  if (!message) {
    error('Usage: dan-tools.cjs commit <message> --files <file1> [file2 ...]');
  }

  // Check commit_docs config
  const config = loadConfig(cwd);
  if (!config.commit_docs) {
    output({ committed: false, reason: 'skipped_commit_docs_false' }, raw);
    return;
  }

  if (files.length === 0) {
    output({ committed: false, reason: 'no_files_specified' }, raw);
    return;
  }

  // Stage files
  for (const file of files) {
    const addResult = execGit(cwd, ['add', file]);
    if (addResult.exitCode !== 0) {
      // File might not exist or already staged -- continue
    }
  }

  // Check if there is anything to commit
  const statusResult = execGit(cwd, ['status', '--porcelain']);
  if (statusResult.exitCode === 0 && statusResult.stdout.trim() === '') {
    output({ committed: false, reason: 'nothing_to_commit' }, raw);
    return;
  }

  // Check if there are staged changes specifically
  const diffResult = execGit(cwd, ['diff', '--cached', '--name-only']);
  if (diffResult.exitCode === 0 && diffResult.stdout.trim() === '') {
    output({ committed: false, reason: 'nothing_to_commit' }, raw);
    return;
  }

  // Commit
  const commitResult = execGit(cwd, ['commit', '-m', message]);
  if (commitResult.exitCode !== 0) {
    if (commitResult.stdout.includes('nothing to commit') || commitResult.stderr.includes('nothing to commit')) {
      output({ committed: false, reason: 'nothing_to_commit' }, raw);
    } else {
      output({ committed: false, reason: 'commit_failed', details: commitResult.stderr || commitResult.stdout }, raw);
    }
    return;
  }

  // Get commit hash
  const hashResult = execGit(cwd, ['rev-parse', '--short', 'HEAD']);
  const hash = hashResult.stdout.trim();

  output({ committed: true, hash: hash, reason: 'committed' }, raw);
}

module.exports = { handle };
