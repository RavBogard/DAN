#!/usr/bin/env node
'use strict';

// Stub: will be fully implemented in Task 2
const { error } = require('./core.cjs');

function handle(cwd, args, raw) {
  error('frontmatter module not yet implemented');
}

function parse(content) {
  throw new Error('frontmatter parse not yet implemented');
}

function serialize(frontmatter, body) {
  throw new Error('frontmatter serialize not yet implemented');
}

module.exports = { handle, parse, serialize };
