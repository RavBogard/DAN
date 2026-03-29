#!/usr/bin/env node
'use strict';

/**
 * Qualifier output parsing and status routing logic.
 * Parses structured markdown from dan-qualifier agent and routes decisions.
 */

const QUALIFICATION_STATUSES = Object.freeze({
  PASS: 'PASS',
  PASS_WITH_CONCERNS: 'PASS_WITH_CONCERNS',
  NEEDS_REVISION: 'NEEDS_REVISION',
  FAIL: 'FAIL'
});

const VALID_STATUSES = new Set(Object.values(QUALIFICATION_STATUSES));

/**
 * Parse structured qualifier output markdown into a result object.
 * @param {string} text - Markdown text from dan-qualifier agent
 * @returns {{ status, task, criteria, evidence, issues } | { status: null, error: string }}
 */
function parseQualifierOutput(text) {
  const lines = text.split('\n');

  // Extract task number
  let task = null;
  const taskMatch = text.match(/\*\*Task:\*\*\s*(.+)/);
  if (taskMatch) task = taskMatch[1].trim();

  // Extract status (or Grade alias)
  let status = null;
  const statusMatch = text.match(/\*\*(?:Status|Grade):\*\*\s*(.+)/);
  if (statusMatch) {
    const raw = statusMatch[1].trim();
    if (VALID_STATUSES.has(raw)) {
      status = raw;
    } else {
      return { status: null, error: 'Unrecognized status: ' + raw };
    }
  } else {
    return { status: null, error: 'No status or grade line found in qualifier output' };
  }

  // Extract criteria
  const criteria = [];
  let inCriteria = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^\*\*Criteria(?:\s+checklist)?:\*\*/.test(line)) {
      inCriteria = true;
      continue;
    }
    if (inCriteria) {
      if (line.startsWith('- ') && line.includes(':')) {
        const criterionMatch = line.match(/^- (.+?):\s*(PASS|FAIL)/);
        if (criterionMatch) {
          criteria.push({
            name: criterionMatch[1].trim(),
            passed: criterionMatch[2] === 'PASS'
          });
        }
      } else if (line.startsWith('**') || (line !== '' && !line.startsWith('-'))) {
        inCriteria = false;
      }
    }
  }

  // Extract evidence
  let evidence = null;
  const evidenceMatch = text.match(/\*\*Evidence:\*\*\s*(.+)/);
  if (evidenceMatch) evidence = evidenceMatch[1].trim();

  // Extract issues
  const issues = [];
  let inIssues = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (/^\*\*Issues:\*\*/.test(line)) {
      // Check for inline "None" or similar
      const inline = line.replace(/^\*\*Issues:\*\*/, '').trim();
      if (inline && inline.toLowerCase() !== 'none') {
        issues.push(inline);
      }
      inIssues = true;
      continue;
    }
    if (inIssues) {
      if (/^\d+\./.test(line)) {
        issues.push(line.replace(/^\d+\.\s*/, ''));
      } else if (line.startsWith('**') || line === '') {
        inIssues = false;
      }
    }
  }

  return { status, task, criteria, evidence, issues };
}

/**
 * Determine whether to retry based on qualification status and retry count.
 * @param {string} status - Qualification status
 * @param {number} retryCount - Number of retries already attempted
 * @param {number} [maxRetries=3] - Maximum number of retries allowed
 * @returns {{ retry: boolean, reason: string }}
 */
function shouldRetry(status, retryCount, maxRetries) {
  if (maxRetries === undefined) maxRetries = 3;

  switch (status) {
    case QUALIFICATION_STATUSES.PASS:
      return { retry: false, reason: 'passed' };
    case QUALIFICATION_STATUSES.PASS_WITH_CONCERNS:
      return { retry: false, reason: 'passed with concerns' };
    case QUALIFICATION_STATUSES.NEEDS_REVISION:
      if (retryCount < maxRetries) {
        return { retry: true, reason: 'revision ' + (retryCount + 1) + ' of ' + maxRetries };
      }
      return { retry: false, reason: 'max retries exceeded, escalate' };
    case QUALIFICATION_STATUSES.FAIL:
      return { retry: false, reason: 'failed, escalate' };
    default:
      return { retry: false, reason: 'unknown status: ' + status };
  }
}

/**
 * Classify a failure as intent, spec, or code using keyword heuristics.
 * @param {string} taskSpec - Task specification text
 * @param {string} qualifierEvidence - Evidence from qualifier output
 * @param {string} objectiveText - Objective text
 * @returns {{ classification: "intent"|"spec"|"code", reasoning: string }}
 */
function classifyFailure(taskSpec, qualifierEvidence, objectiveText) {
  const combined = [taskSpec, qualifierEvidence, objectiveText].join(' ').toLowerCase();

  // Intent keywords
  const intentPatterns = ['wrong goal', 'wrong problem', 'not what was asked', 'objective mismatch'];
  for (const pattern of intentPatterns) {
    if (combined.includes(pattern)) {
      return {
        classification: 'intent',
        reasoning: 'Detected intent mismatch: "' + pattern + '" found in input'
      };
    }
  }

  // Spec keywords
  const specPatterns = ['ambiguous', 'incomplete', 'contradicts', 'missing requirement'];
  for (const pattern of specPatterns) {
    if (combined.includes(pattern)) {
      return {
        classification: 'spec',
        reasoning: 'Detected spec issue: "' + pattern + '" found in input'
      };
    }
  }

  // Default: code
  return {
    classification: 'code',
    reasoning: 'No intent or spec keywords detected; classified as implementation bug'
  };
}

module.exports = {
  QUALIFICATION_STATUSES,
  parseQualifierOutput,
  shouldRetry,
  classifyFailure
};
