#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { output, error } = require('./core.cjs');

/**
 * Parse must_haves from raw plan YAML frontmatter.
 * The built-in frontmatter parser can't handle arrays of objects (artifacts, key_links).
 * This parses the must_haves block directly from raw YAML text.
 *
 * @param {string} content - Full file content with YAML frontmatter
 * @returns {{ truths: string[], artifacts: object[], key_links: object[] }}
 */
function parseMustHaves(content) {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch) return { truths: [], artifacts: [], key_links: [] };

  const yaml = fmMatch[1];
  const lines = yaml.split('\n');

  const result = { truths: [], artifacts: [], key_links: [] };

  let i = 0;
  // Find must_haves: line
  while (i < lines.length && !lines[i].match(/^must_haves\s*:/)) i++;
  if (i >= lines.length) return result;
  i++;

  // Parse must_haves sub-keys
  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    // Stop at next top-level key (no indentation)
    if (trimmed && !line.startsWith(' ') && !line.startsWith('\t')) break;
    if (!trimmed) { i++; continue; }

    const subKeyMatch = trimmed.match(/^(\w+)\s*:$/);
    if (subKeyMatch) {
      const subKey = subKeyMatch[1];
      i++;

      if (subKey === 'truths') {
        // Array of strings
        while (i < lines.length) {
          const tLine = lines[i].trim();
          if (!tLine.startsWith('- ')) break;
          const val = tLine.slice(2).trim();
          // Strip surrounding quotes
          result.truths.push(val.replace(/^["']|["']$/g, ''));
          i++;
        }
      } else if (subKey === 'artifacts') {
        // Array of objects
        while (i < lines.length) {
          const aLine = lines[i].trim();
          if (!aLine.startsWith('- ')) break;
          const obj = {};
          // First line has "- key: value"
          const firstKV = aLine.slice(2).trim();
          const firstColon = firstKV.indexOf(':');
          if (firstColon !== -1) {
            const k = firstKV.slice(0, firstColon).trim();
            const v = firstKV.slice(firstColon + 1).trim().replace(/^["']|["']$/g, '');
            obj[k] = v;
          }
          i++;
          // Subsequent lines with deeper indent (key: value or key: [array])
          while (i < lines.length) {
            const objLine = lines[i];
            const objTrimmed = objLine.trim();
            if (!objTrimmed || objTrimmed.startsWith('- ')) break;
            // Must be indented more than the "- " item
            const indent = objLine.length - objLine.trimStart().length;
            if (indent < 6) break; // artifact sub-fields are at 6+ spaces
            const colIdx = objTrimmed.indexOf(':');
            if (colIdx !== -1) {
              const k = objTrimmed.slice(0, colIdx).trim();
              let v = objTrimmed.slice(colIdx + 1).trim();
              // Handle inline array: [a, b, c]
              if (v.startsWith('[') && v.endsWith(']')) {
                const inner = v.slice(1, -1).trim();
                obj[k] = inner ? inner.split(',').map(s => s.trim().replace(/^["']|["']$/g, '')) : [];
              } else {
                v = v.replace(/^["']|["']$/g, '');
                // Try to parse as number
                if (/^\d+$/.test(v)) {
                  obj[k] = parseInt(v, 10);
                } else {
                  obj[k] = v;
                }
              }
            }
            i++;
          }
          result.artifacts.push(obj);
        }
      } else if (subKey === 'key_links') {
        // Array of objects (same pattern as artifacts)
        while (i < lines.length) {
          const kLine = lines[i].trim();
          if (!kLine.startsWith('- ')) break;
          const obj = {};
          const firstKV = kLine.slice(2).trim();
          const firstColon = firstKV.indexOf(':');
          if (firstColon !== -1) {
            const k = firstKV.slice(0, firstColon).trim();
            const v = firstKV.slice(firstColon + 1).trim().replace(/^["']|["']$/g, '');
            obj[k] = v;
          }
          i++;
          while (i < lines.length) {
            const objLine = lines[i];
            const objTrimmed = objLine.trim();
            if (!objTrimmed || objTrimmed.startsWith('- ')) break;
            const indent = objLine.length - objLine.trimStart().length;
            if (indent < 6) break;
            const colIdx = objTrimmed.indexOf(':');
            if (colIdx !== -1) {
              const k = objTrimmed.slice(0, colIdx).trim();
              let v = objTrimmed.slice(colIdx + 1).trim().replace(/^["']|["']$/g, '');
              obj[k] = v;
            }
            i++;
          }
          result.key_links.push(obj);
        }
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return result;
}

/**
 * Verify artifacts from a plan's must_haves.artifacts.
 * Checks: file exists, exports present, contains string, min_lines.
 *
 * @param {string} cwd - Working directory
 * @param {string} planPath - Absolute or relative path to plan file
 * @returns {{ all_passed: boolean, passed: number, total: number, artifacts: object[] }}
 */
function verifyArtifacts(cwd, planPath) {
  const resolvedPlan = path.isAbsolute(planPath) ? planPath : path.join(cwd, planPath);
  const content = fs.readFileSync(resolvedPlan, 'utf-8');
  const mustHaves = parseMustHaves(content);
  const artifacts = mustHaves.artifacts || [];

  const results = [];
  for (const artifact of artifacts) {
    const artPath = path.join(cwd, artifact.path);
    const exists = fs.existsSync(artPath);
    const check = { path: artifact.path, exists, issues: [], passed: false };

    if (!exists) {
      check.issues.push('File not found');
    } else {
      const fileContent = fs.readFileSync(artPath, 'utf-8');

      // Check exports
      if (artifact.exports && Array.isArray(artifact.exports)) {
        for (const exp of artifact.exports) {
          if (!fileContent.includes(exp)) {
            check.issues.push('Missing export: ' + exp);
          }
        }
      }

      // Check contains
      if (artifact.contains) {
        if (!fileContent.includes(artifact.contains)) {
          check.issues.push('Missing contains: ' + artifact.contains);
        }
      }

      // Check min_lines
      if (artifact.min_lines) {
        const lineCount = fileContent.split('\n').length;
        if (lineCount < artifact.min_lines) {
          check.issues.push('Below min_lines: ' + lineCount + ' < ' + artifact.min_lines);
        }
      }

      check.passed = check.issues.length === 0;
    }

    results.push(check);
  }

  const passed = results.filter(r => r.passed).length;
  return { all_passed: passed === results.length && results.length > 0, passed, total: results.length, artifacts: results };
}

/**
 * Verify key links from a plan's must_haves.key_links.
 * Checks: source file exists, regex pattern matches.
 *
 * @param {string} cwd - Working directory
 * @param {string} planPath - Absolute or relative path to plan file
 * @returns {{ all_verified: boolean, verified: number, total: number, links: object[] }}
 */
function verifyKeyLinks(cwd, planPath) {
  const resolvedPlan = path.isAbsolute(planPath) ? planPath : path.join(cwd, planPath);
  const content = fs.readFileSync(resolvedPlan, 'utf-8');
  const mustHaves = parseMustHaves(content);
  const keyLinks = mustHaves.key_links || [];

  const results = [];
  for (const link of keyLinks) {
    const check = { from: link.from, to: link.to, via: link.via || '', verified: false, detail: '' };
    const sourcePath = path.join(cwd, link.from);

    if (!fs.existsSync(sourcePath)) {
      check.detail = 'Source file not found';
    } else {
      const sourceContent = fs.readFileSync(sourcePath, 'utf-8');
      if (link.pattern) {
        const regex = new RegExp(link.pattern);
        check.verified = regex.test(sourceContent);
        check.detail = check.verified ? 'Pattern found' : 'Pattern not found: ' + link.pattern;
      } else {
        check.verified = sourceContent.includes(link.to);
        check.detail = check.verified ? 'Target referenced in source' : 'Target not referenced';
      }
    }
    results.push(check);
  }

  const verified = results.filter(r => r.verified).length;
  return { all_verified: verified === results.length && results.length > 0, verified, total: results.length, links: results };
}

/**
 * Check phase completeness: every PLAN.md should have a matching SUMMARY.md.
 *
 * @param {string} cwd - Working directory
 * @param {string|number} phaseNum - Phase number
 * @returns {{ complete: boolean, plan_count: number, summary_count: number, incomplete_plans: string[] }}
 */
function verifyPhaseCompleteness(cwd, phaseNum) {
  const { findPhase } = require('./phase.cjs');
  const phaseDir = findPhase(cwd, phaseNum);
  const files = fs.readdirSync(phaseDir);

  const plans = files.filter(f => /-PLAN\.md$/.test(f));
  const summaries = files.filter(f => /-SUMMARY\.md$/.test(f));

  const planIds = new Set(plans.map(p => p.replace(/-PLAN\.md$/, '')));
  const summaryIds = new Set(summaries.map(s => s.replace(/-SUMMARY\.md$/, '')));

  const incompletePlans = [...planIds].filter(id => !summaryIds.has(id));

  return {
    complete: incompletePlans.length === 0,
    plan_count: plans.length,
    summary_count: summaries.length,
    incomplete_plans: incompletePlans,
  };
}

/**
 * Normalize an issue string to a stable fingerprint for cross-cycle comparison.
 * Strips line numbers, normalizes whitespace and string literals.
 *
 * @param {string} issue - Issue description
 * @returns {string} Normalized fingerprint
 */
function fingerprintIssue(issue) {
  return issue
    .toLowerCase()
    .replace(/line \d+/g, '')
    .replace(/\s+/g, ' ')
    .replace(/['"][^'"]*['"]/g, '""')
    .trim();
}

/**
 * Detect recurring issues across bugsweep cycles.
 *
 * @param {string[]} current - Current cycle issue descriptions
 * @param {string[]} previous - Previous cycle issue descriptions
 * @returns {{ recurring_count: number, total_current: number, ratio: number, should_escalate: boolean }}
 */
function detectRecurringIssues(current, previous) {
  const currentFingerprints = new Set(current.map(fingerprintIssue));
  const previousFingerprints = new Set(previous.map(fingerprintIssue));

  let recurring = 0;
  for (const fp of currentFingerprints) {
    if (previousFingerprints.has(fp)) recurring++;
  }

  const ratio = currentFingerprints.size > 0 ? recurring / currentFingerprints.size : 0;
  return {
    recurring_count: recurring,
    total_current: currentFingerprints.size,
    ratio,
    should_escalate: ratio > 0.5
  };
}

/**
 * Format a structured verification report as markdown with YAML frontmatter.
 *
 * @param {object} data - Report data
 * @returns {string} Markdown report
 */
function formatVerificationReport(data) {
  const {
    phase = 'unknown',
    status = 'unknown',
    score = '0/0',
    criteria = [],
    artifacts = [],
    keyLinks = [],
    requirements = [],
    issues = [],
    testOutput = '',
    bugsweepCycles = 0
  } = data;

  let md = '';

  // Frontmatter
  md += '---\n';
  md += 'phase: ' + phase + '\n';
  md += 'verified: ' + new Date().toISOString() + '\n';
  md += 'status: ' + status + '\n';
  md += 'score: ' + score + '\n';
  md += 'bugsweep_cycles: ' + bugsweepCycles + '\n';
  md += '---\n\n';

  // Title
  md += '# Verification Report: ' + phase + '\n\n';
  md += '**Status:** ' + status + '\n\n';

  // Criteria table
  md += '## Criteria Results\n\n';
  md += '| # | Criterion | Status | Evidence |\n';
  md += '|---|-----------|--------|----------|\n';
  for (const c of criteria) {
    md += '| ' + (c.id || '') + ' | ' + (c.criterion || '') + ' | ' + (c.status || '') + ' | ' + (c.evidence || '') + ' |\n';
  }
  md += '\n';

  // Artifact table
  md += '## Artifact Verification\n\n';
  md += '| Artifact | Expected | Status | Details |\n';
  md += '|----------|----------|--------|---------|\n';
  for (const a of artifacts) {
    md += '| ' + (a.path || '') + ' | ' + (a.expected || '') + ' | ' + (a.status || '') + ' | ' + (a.details || '') + ' |\n';
  }
  md += '\n';

  // Key-link table
  md += '## Key Link Verification\n\n';
  md += '| From | To | Via | Status | Details |\n';
  md += '|------|----|----|--------|---------|\n';
  for (const l of keyLinks) {
    md += '| ' + (l.from || '') + ' | ' + (l.to || '') + ' | ' + (l.via || '') + ' | ' + (l.status || '') + ' | ' + (l.details || '') + ' |\n';
  }
  md += '\n';

  // Requirements table
  md += '## Requirements Coverage\n\n';
  md += '| Requirement | Status | Evidence |\n';
  md += '|-------------|--------|----------|\n';
  for (const r of requirements) {
    md += '| ' + (r.id || '') + ' | ' + (r.status || '') + ' | ' + (r.evidence || '') + ' |\n';
  }
  md += '\n';

  // Issues
  md += '## Issues Found\n\n';
  if (issues.length === 0) {
    md += 'None.\n';
  } else {
    for (let idx = 0; idx < issues.length; idx++) {
      md += (idx + 1) + '. ' + issues[idx] + '\n';
    }
  }
  md += '\n';

  // Test output
  md += '## Test Results\n\n';
  if (testOutput) {
    md += '```\n' + testOutput + '\n```\n';
  } else {
    md += 'No test output captured.\n';
  }

  return md;
}

/**
 * Handle verify subcommands.
 */
function handle(cwd, args, raw) {
  const subcommand = args[0];

  if (!subcommand) {
    error('Usage: dan-tools.cjs verify <artifacts|key-links|phase-completeness|fingerprint|recurring|format-report> [args]');
  }

  switch (subcommand) {
    case 'artifacts': {
      const planPath = args[1];
      if (!planPath) error('Usage: dan-tools.cjs verify artifacts <plan-path>');
      const resolved = path.isAbsolute(planPath) ? planPath : path.join(cwd, planPath);
      const result = verifyArtifacts(cwd, resolved);
      output(result, raw);
      break;
    }

    case 'key-links': {
      const planPath = args[1];
      if (!planPath) error('Usage: dan-tools.cjs verify key-links <plan-path>');
      const resolved = path.isAbsolute(planPath) ? planPath : path.join(cwd, planPath);
      const result = verifyKeyLinks(cwd, resolved);
      output(result, raw);
      break;
    }

    case 'phase-completeness': {
      const phaseNum = args[1];
      if (!phaseNum) error('Usage: dan-tools.cjs verify phase-completeness <phase-num>');
      const result = verifyPhaseCompleteness(cwd, phaseNum);
      output(result, raw);
      break;
    }

    case 'fingerprint': {
      const issueText = args.slice(1).join(' ');
      if (!issueText) error('Usage: dan-tools.cjs verify fingerprint <issue-text>');
      const fp = fingerprintIssue(issueText);
      output({ fingerprint: fp }, raw, fp);
      break;
    }

    case 'recurring': {
      let currentJson = null;
      let previousJson = null;
      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--current' && args[i + 1]) {
          currentJson = args[++i];
        } else if (args[i] === '--previous' && args[i + 1]) {
          previousJson = args[++i];
        }
      }
      if (!currentJson || !previousJson) {
        error('Usage: dan-tools.cjs verify recurring --current <json> --previous <json>');
      }
      let current, previous;
      try { current = JSON.parse(currentJson); } catch (e) { error('Invalid --current JSON: ' + e.message); }
      try { previous = JSON.parse(previousJson); } catch (e) { error('Invalid --previous JSON: ' + e.message); }
      const result = detectRecurringIssues(current, previous);
      output(result, raw);
      break;
    }

    case 'format-report': {
      let inputJson = null;
      for (let i = 1; i < args.length; i++) {
        if (args[i] === '--input' && args[i + 1]) {
          inputJson = args[++i];
        }
      }
      if (!inputJson) error('Usage: dan-tools.cjs verify format-report --input <json>');
      let data;
      try { data = JSON.parse(inputJson); } catch (e) { error('Invalid --input JSON: ' + e.message); }
      const report = formatVerificationReport(data);
      output({ report }, raw, report);
      break;
    }

    default:
      error('Unknown verify subcommand: ' + subcommand + '. Use: artifacts, key-links, phase-completeness, fingerprint, recurring, format-report');
  }
}

module.exports = {
  handle,
  verifyArtifacts,
  verifyKeyLinks,
  verifyPhaseCompleteness,
  fingerprintIssue,
  detectRecurringIssues,
  formatVerificationReport
};
