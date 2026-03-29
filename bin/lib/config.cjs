#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { output, error, atomicWriteFileSync, loadConfig } = require('./core.cjs');

/**
 * Handle config subcommands: get, set
 */
function handle(cwd, args, raw) {
  const subcommand = args[0];

  if (!subcommand) {
    error('Usage: dan-tools.cjs config <get|set> [args]');
  }

  switch (subcommand) {
    case 'get': {
      const key = args[1];
      const config = loadConfig(cwd);

      if (!key) {
        // Return full config
        output(config, raw);
      } else {
        // Return single value -- support dot notation for nested keys
        const parts = key.split('.');
        let value = config;
        for (const part of parts) {
          if (value && typeof value === 'object' && part in value) {
            value = value[part];
          } else {
            value = null;
            break;
          }
        }
        output({ key: key, value: value }, raw, value !== null ? String(value) : '');
      }
      break;
    }

    case 'set': {
      const key = args[1];
      const newValue = args[2];
      if (!key || newValue === undefined) {
        error('Usage: dan-tools.cjs config set <key> <value>');
      }

      const configPath = path.join(cwd, '.planning', 'dan.config.json');
      let config = {};
      try {
        const raw = fs.readFileSync(configPath, 'utf-8');
        config = JSON.parse(raw);
      } catch (e) {
        // Start from empty
      }

      // Parse value type
      let parsedValue = newValue;
      if (newValue === 'true') parsedValue = true;
      else if (newValue === 'false') parsedValue = false;
      else if (!isNaN(newValue) && newValue !== '') parsedValue = Number(newValue);

      // Support dot notation for nested keys
      const parts = key.split('.');
      if (parts.length === 1) {
        config[key] = parsedValue;
      } else {
        let target = config;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!target[parts[i]] || typeof target[parts[i]] !== 'object') {
            target[parts[i]] = {};
          }
          target = target[parts[i]];
        }
        target[parts[parts.length - 1]] = parsedValue;
      }

      // Ensure .planning directory exists
      const planningDir = path.join(cwd, '.planning');
      if (!fs.existsSync(planningDir)) {
        fs.mkdirSync(planningDir, { recursive: true });
      }

      atomicWriteFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
      output({ key: key, value: parsedValue, updated: true }, raw);
      break;
    }

    default:
      error('Unknown config subcommand: ' + subcommand + '. Use: get, set');
  }
}

module.exports = { handle };
