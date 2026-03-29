#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { output, error } = require('./core.cjs');
const { parse } = require('./frontmatter.cjs');

/**
 * Topological sort using Kahn's algorithm with cycle detection.
 * @param {Array<{id: string, depends_on: string[]}>} plans
 * @returns {string[]} Ordered plan IDs
 * @throws {Error} If circular dependency detected
 */
function topologicalSort(plans) {
  const planIds = new Set(plans.map(p => p.id));
  const inDegree = {};
  const adjacency = {};

  // Initialize
  for (const plan of plans) {
    inDegree[plan.id] = 0;
    adjacency[plan.id] = [];
  }

  // Build graph (only count edges to known plans)
  for (const plan of plans) {
    for (const dep of plan.depends_on) {
      if (planIds.has(dep)) {
        adjacency[dep].push(plan.id);
        inDegree[plan.id]++;
      }
    }
  }

  // Collect nodes with no incoming edges, sorted by id for deterministic output
  const queue = Object.keys(inDegree)
    .filter(id => inDegree[id] === 0)
    .sort();

  const sorted = [];

  while (queue.length > 0) {
    const node = queue.shift();
    sorted.push(node);

    for (const neighbor of adjacency[node]) {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) {
        // Insert in sorted position for deterministic output
        let inserted = false;
        for (let i = 0; i < queue.length; i++) {
          if (neighbor < queue[i]) {
            queue.splice(i, 0, neighbor);
            inserted = true;
            break;
          }
        }
        if (!inserted) queue.push(neighbor);
      }
    }
  }

  if (sorted.length !== plans.length) {
    const remaining = plans.filter(p => !sorted.includes(p.id)).map(p => p.id);
    throw new Error('Circular dependency detected among plans: ' + remaining.join(', '));
  }

  return sorted;
}

/**
 * Assign execution wave numbers to plans.
 * Wave 1 = no dependencies. Wave N = max(dependency waves) + 1.
 * @param {Array<{id: string, depends_on: string[]}>} plans
 * @returns {Array<{id: string, wave: number}>}
 */
function assignWaves(plans) {
  // First verify no cycles
  topologicalSort(plans);

  const planIds = new Set(plans.map(p => p.id));
  const waveMap = {};

  // Build a lookup
  const planMap = {};
  for (const plan of plans) {
    planMap[plan.id] = plan;
  }

  function getWave(id) {
    if (waveMap[id] !== undefined) return waveMap[id];

    const plan = planMap[id];
    const knownDeps = plan.depends_on.filter(d => planIds.has(d));

    if (knownDeps.length === 0) {
      waveMap[id] = 1;
      return 1;
    }

    let maxDepWave = 0;
    for (const dep of knownDeps) {
      maxDepWave = Math.max(maxDepWave, getWave(dep));
    }
    waveMap[id] = maxDepWave + 1;
    return waveMap[id];
  }

  for (const plan of plans) {
    getWave(plan.id);
  }

  return plans.map(p => ({ id: p.id, wave: waveMap[p.id] }));
}

/**
 * Scan a phase directory for PLAN.md files and extract plan info.
 * @param {string} phaseDir - Absolute path to phase directory
 * @returns {Array<{id: string, depends_on: string[]}>}
 */
function scanPlans(phaseDir) {
  if (!fs.existsSync(phaseDir)) {
    error('Phase directory not found: ' + phaseDir);
  }

  const files = fs.readdirSync(phaseDir).filter(f => f.match(/^\d+-\d+-PLAN\.md$/));
  const plans = [];

  for (const file of files) {
    const filePath = path.join(phaseDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter } = parse(content);

    // Extract plan ID from filename: "01-02-PLAN.md" -> "01-02"
    const idMatch = file.match(/^(\d+-\d+)-PLAN\.md$/);
    if (!idMatch) continue;
    const id = idMatch[1];

    // Normalize depends_on to array of strings
    let depends_on = frontmatter.depends_on || [];
    if (!Array.isArray(depends_on)) depends_on = [depends_on];
    depends_on = depends_on.map(String);

    plans.push({ id, depends_on });
  }

  return plans;
}

/**
 * Handle dependency subcommands: analyze, waves
 */
function handle(cwd, args, raw) {
  const subcommand = args[0];

  if (!subcommand) {
    error('Usage: dan-tools.cjs dependency <analyze|waves> <phaseDir>');
  }

  switch (subcommand) {
    case 'analyze': {
      const phaseDir = args[1];
      if (!phaseDir) error('Usage: dan-tools.cjs dependency analyze <phaseDir>');
      const resolvedDir = path.isAbsolute(phaseDir) ? phaseDir : path.join(cwd, phaseDir);
      const plans = scanPlans(resolvedDir);

      try {
        const order = topologicalSort(plans);
        output({ order, count: order.length }, raw);
      } catch (e) {
        error(e.message);
      }
      break;
    }

    case 'waves': {
      const phaseDir = args[1];
      if (!phaseDir) error('Usage: dan-tools.cjs dependency waves <phaseDir>');
      const resolvedDir = path.isAbsolute(phaseDir) ? phaseDir : path.join(cwd, phaseDir);
      const plans = scanPlans(resolvedDir);

      try {
        const waveData = assignWaves(plans);
        // Group by wave
        const grouped = {};
        for (const w of waveData) {
          if (!grouped[w.wave]) grouped[w.wave] = [];
          grouped[w.wave].push(w.id);
        }
        const waves = Object.keys(grouped)
          .sort((a, b) => Number(a) - Number(b))
          .map(w => ({ wave: Number(w), plans: grouped[w] }));
        output({ waves, count: waveData.length }, raw);
      } catch (e) {
        error(e.message);
      }
      break;
    }

    default:
      error('Unknown dependency subcommand: ' + subcommand + '. Use: analyze, waves');
  }
}

module.exports = { handle, topologicalSort, assignWaves };
