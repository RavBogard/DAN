#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, atomicWriteFileSync } = require('./core.cjs');

/**
 * Parse a YAML value string into a JS value.
 */
function parseYamlValue(str) {
  const trimmed = str.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null' || trimmed === '~' || trimmed === '') return null;
  if (trimmed === '[]') return [];
  if (trimmed === '{}') return {};
  // Quoted strings
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  // Inline array: [a, b, c]
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    const inner = trimmed.slice(1, -1).trim();
    if (inner === '') return [];
    return inner.split(',').map(s => parseYamlValue(s.trim()));
  }
  // Numbers -- but preserve zero-prefixed strings like "01" as strings
  if (!isNaN(trimmed) && trimmed !== '' && !(trimmed.length > 1 && trimmed.startsWith('0') && !trimmed.startsWith('0.'))) {
    return Number(trimmed);
  }
  return trimmed;
}

/**
 * Parse YAML frontmatter from a string (between --- markers).
 * Supports: key-value pairs, arrays (- item), nested objects (indented keys).
 */
function parse(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) {
    return { frontmatter: {}, body: content };
  }

  const yamlBlock = fmMatch[1];
  const body = content.slice(fmMatch[0].length).replace(/^\r?\n/, '');

  const frontmatter = {};
  const lines = yamlBlock.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    // Get indentation level
    const indent = line.length - line.trimStart().length;

    // Top-level key-value
    if (indent === 0) {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) { i++; continue; }

      const key = trimmed.substring(0, colonIdx).trim();
      const valueStr = trimmed.substring(colonIdx + 1).trim();

      if (valueStr === '' || valueStr === '|' || valueStr === '>') {
        // Check next line for array items or nested object
        const nextLineIdx = i + 1;
        if (nextLineIdx < lines.length) {
          const nextLine = lines[nextLineIdx];
          const nextTrimmed = nextLine.trim();
          const nextIndent = nextLine.length - nextLine.trimStart().length;

          if (nextTrimmed.startsWith('- ')) {
            // Array
            const arr = [];
            let j = nextLineIdx;
            while (j < lines.length) {
              const arrLine = lines[j];
              const arrTrimmed = arrLine.trim();
              const arrIndent = arrLine.length - arrLine.trimStart().length;
              if (arrIndent < nextIndent && arrTrimmed !== '') break;
              if (arrTrimmed === '') { j++; continue; }
              if (arrTrimmed.startsWith('- ')) {
                arr.push(parseYamlValue(arrTrimmed.substring(2)));
              } else {
                break;
              }
              j++;
            }
            frontmatter[key] = arr;
            i = j;
            continue;
          } else if (nextIndent > 0 && nextTrimmed.includes(':')) {
            // Nested object
            const obj = {};
            let j = nextLineIdx;
            while (j < lines.length) {
              const objLine = lines[j];
              const objTrimmed = objLine.trim();
              const objIndent = objLine.length - objLine.trimStart().length;
              if (objIndent <= 0 && objTrimmed !== '') break;
              if (objTrimmed === '') { j++; continue; }
              const objColonIdx = objTrimmed.indexOf(':');
              if (objColonIdx !== -1) {
                const objKey = objTrimmed.substring(0, objColonIdx).trim();
                const objVal = objTrimmed.substring(objColonIdx + 1).trim();
                obj[objKey] = parseYamlValue(objVal);
              }
              j++;
            }
            frontmatter[key] = obj;
            i = j;
            continue;
          }
        }
        // Multi-line scalar or empty value
        frontmatter[key] = valueStr === '' ? null : valueStr;
      } else {
        frontmatter[key] = parseYamlValue(valueStr);
      }
    }

    i++;
  }

  return { frontmatter, body };
}

/**
 * Serialize frontmatter object and body into a markdown string with YAML frontmatter.
 */
function serialize(frontmatter, body) {
  let yaml = '';

  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      yaml += key + ':\n';
      for (const item of value) {
        yaml += '  - ' + String(item) + '\n';
      }
    } else if (value !== null && typeof value === 'object') {
      yaml += key + ':\n';
      for (const [subKey, subVal] of Object.entries(value)) {
        yaml += '  ' + subKey + ': ' + String(subVal) + '\n';
      }
    } else {
      yaml += key + ': ' + String(value) + '\n';
    }
  }

  return '---\n' + yaml + '---\n' + body;
}

/**
 * Handle frontmatter subcommands: parse, serialize
 */
function handle(cwd, args, raw) {
  const subcommand = args[0];

  if (!subcommand) {
    error('Usage: dan-tools.cjs frontmatter <parse|serialize> [args]');
  }

  switch (subcommand) {
    case 'parse': {
      const filePath = args[1];
      if (!filePath) error('Usage: dan-tools.cjs frontmatter parse <file>');
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
      if (!fs.existsSync(resolvedPath)) error('File not found: ' + resolvedPath);
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const result = parse(content);
      output(result, raw);
      break;
    }

    case 'serialize': {
      const fmJson = args[1];
      const body = args[2] || '';
      if (!fmJson) error('Usage: dan-tools.cjs frontmatter serialize <json> [body]');
      let fm;
      try {
        fm = JSON.parse(fmJson);
      } catch (e) {
        error('Invalid JSON: ' + e.message);
      }
      const result = serialize(fm, body);
      output({ output: result }, raw, result);
      break;
    }

    case 'set': {
      const filePath = args[1];
      const field = args[2];
      const value = args[3];
      if (!filePath || !field || value === undefined) {
        error('Usage: dan-tools.cjs frontmatter set <file> <field> <value>');
      }
      const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(cwd, filePath);
      if (!fs.existsSync(resolvedPath)) error('File not found: ' + resolvedPath);
      const content = fs.readFileSync(resolvedPath, 'utf-8');
      const { frontmatter: fm, body } = parse(content);

      // Support dot-notation for nested fields (e.g., must_haves.truths)
      const parts = field.split('.');
      let target = fm;
      for (let i = 0; i < parts.length - 1; i++) {
        if (target[parts[i]] === undefined || target[parts[i]] === null || typeof target[parts[i]] !== 'object') {
          target[parts[i]] = {};
        }
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = parseYamlValue(value);

      const updated = serialize(fm, body);
      atomicWriteFileSync(resolvedPath, updated);
      output({ updated: true, field, value: target[parts[parts.length - 1]], frontmatter: fm }, raw);
      break;
    }

    default:
      error('Unknown frontmatter subcommand: ' + subcommand + '. Use: parse, serialize, set');
  }
}

module.exports = { handle, parse, serialize, parseYamlValue };
