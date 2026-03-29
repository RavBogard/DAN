#!/usr/bin/env node
'use strict';

const path = require('path');
const { error } = require('./lib/core.cjs');

function main() {
  const args = process.argv.slice(2);

  // Extract --cwd flag
  let cwd = process.cwd();
  const cwdIdx = args.indexOf('--cwd');
  if (cwdIdx !== -1) {
    cwd = path.resolve(args[cwdIdx + 1]);
    args.splice(cwdIdx, 2);
  }

  // Extract --raw flag
  const rawIdx = args.indexOf('--raw');
  const raw = rawIdx !== -1;
  if (rawIdx !== -1) args.splice(rawIdx, 1);

  const command = args[0];
  const subArgs = args.slice(1);

  switch (command) {
    case 'state':
      require('./lib/state.cjs').handle(cwd, subArgs, raw);
      break;
    case 'config':
      require('./lib/config.cjs').handle(cwd, subArgs, raw);
      break;
    case 'commit':
      require('./lib/commit.cjs').handle(cwd, subArgs, raw);
      break;
    case 'frontmatter':
      require('./lib/frontmatter.cjs').handle(cwd, subArgs, raw);
      break;
    case 'template':
      require('./lib/template.cjs').handle(cwd, subArgs, raw);
      break;
    case 'dependency':
      require('./lib/dependency.cjs').handle(cwd, subArgs, raw);
      break;
    case 'phase':
      require('./lib/phase.cjs').handle(cwd, subArgs, raw);
      break;
    case 'lifecycle':
      require('./lib/lifecycle.cjs').handle(cwd, subArgs, raw);
      break;
    case 'qualify':
      require('./lib/qualify.cjs').handle(cwd, subArgs, raw);
      break;
    case 'research':
      require('./lib/research.cjs').handle(cwd, subArgs, raw);
      break;
    case 'verify':
      require('./lib/verify.cjs').handle(cwd, subArgs, raw);
      break;
    case 'milestone':
      require('./lib/milestone.cjs').handle(cwd, subArgs, raw);
      break;
    default:
      error(
        'Unknown command: ' + (command || '(none)') +
        '\nUsage: dan-tools.cjs <command> [args]\n' +
        'Commands: state, config, commit, frontmatter, template, dependency, phase, lifecycle, qualify, research, verify'
      );
  }
}

main();
