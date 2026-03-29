#!/usr/bin/env node
'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');

const MOD_PATH = path.join(__dirname, '..', 'lib', 'verify.cjs');

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

describe('verify.cjs exports', () => {
  it('exports handle, verifyArtifacts, verifyKeyLinks, verifyPhaseCompleteness, fingerprintIssue, detectRecurringIssues, formatVerificationReport', () => {
    const mod = require(MOD_PATH);
    assert.equal(typeof mod.handle, 'function');
    assert.equal(typeof mod.verifyArtifacts, 'function');
    assert.equal(typeof mod.verifyKeyLinks, 'function');
    assert.equal(typeof mod.verifyPhaseCompleteness, 'function');
    assert.equal(typeof mod.fingerprintIssue, 'function');
    assert.equal(typeof mod.detectRecurringIssues, 'function');
    assert.equal(typeof mod.formatVerificationReport, 'function');
  });
});

// ---------------------------------------------------------------------------
// verifyArtifacts
// ---------------------------------------------------------------------------

describe('verifyArtifacts', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-test-va-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test'), { recursive: true });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns passed=false with "File not found" when artifact path does not exist', () => {
    const planContent = [
      '---',
      'must_haves:',
      '  artifacts:',
      '    - path: "src/missing.cjs"',
      '      provides: "Something"',
      '      exports: ["handle"]',
      '---',
      '# Plan',
    ].join('\n');
    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const { verifyArtifacts } = require(MOD_PATH);
    const result = verifyArtifacts(tmpDir, planPath);

    assert.equal(result.all_passed, false);
    assert.equal(result.total, 1);
    assert.equal(result.passed, 0);
    assert.equal(result.artifacts[0].passed, false);
    assert.ok(result.artifacts[0].issues.includes('File not found'));
  });

  it('returns passed=false with "Missing export: X" when export string not found', () => {
    // Create the artifact file but without the required export
    const artDir = path.join(tmpDir, 'src');
    fs.mkdirSync(artDir, { recursive: true });
    fs.writeFileSync(path.join(artDir, 'partial.cjs'), 'module.exports = { foo };\n');

    const planContent = [
      '---',
      'must_haves:',
      '  artifacts:',
      '    - path: "src/partial.cjs"',
      '      provides: "Partial module"',
      '      exports: ["foo", "bar"]',
      '---',
      '# Plan',
    ].join('\n');
    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-02-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const { verifyArtifacts } = require(MOD_PATH);
    const result = verifyArtifacts(tmpDir, planPath);

    assert.equal(result.artifacts[0].passed, false);
    assert.ok(result.artifacts[0].issues.some(i => i.includes('Missing export: bar')));
  });

  it('returns passed=true when file exists and all checks pass', () => {
    const artDir = path.join(tmpDir, 'src');
    fs.mkdirSync(artDir, { recursive: true });
    fs.writeFileSync(path.join(artDir, 'good.cjs'), 'module.exports = { handle, process };\nfunction handle() {}\nfunction process() {}\n');

    const planContent = [
      '---',
      'must_haves:',
      '  artifacts:',
      '    - path: "src/good.cjs"',
      '      provides: "Good module"',
      '      exports: ["handle", "process"]',
      '---',
      '# Plan',
    ].join('\n');
    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-03-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const { verifyArtifacts } = require(MOD_PATH);
    const result = verifyArtifacts(tmpDir, planPath);

    assert.equal(result.all_passed, true);
    assert.equal(result.passed, 1);
    assert.equal(result.artifacts[0].passed, true);
  });

  it('checks contains string in file content', () => {
    const artDir = path.join(tmpDir, 'src');
    fs.mkdirSync(artDir, { recursive: true });
    fs.writeFileSync(path.join(artDir, 'contains.cjs'), "case 'verify':\n  break;\n");

    const planContent = [
      '---',
      'must_haves:',
      '  artifacts:',
      '    - path: "src/contains.cjs"',
      '      provides: "Router"',
      '      contains: "case \'verify\'"',
      '---',
      '# Plan',
    ].join('\n');
    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-04-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const { verifyArtifacts } = require(MOD_PATH);
    const result = verifyArtifacts(tmpDir, planPath);

    assert.equal(result.all_passed, true);
  });

  it('checks min_lines threshold', () => {
    const artDir = path.join(tmpDir, 'src');
    fs.mkdirSync(artDir, { recursive: true });
    fs.writeFileSync(path.join(artDir, 'short.cjs'), 'line1\nline2\n');

    const planContent = [
      '---',
      'must_haves:',
      '  artifacts:',
      '    - path: "src/short.cjs"',
      '      provides: "Short file"',
      '      min_lines: 50',
      '---',
      '# Plan',
    ].join('\n');
    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-05-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const { verifyArtifacts } = require(MOD_PATH);
    const result = verifyArtifacts(tmpDir, planPath);

    assert.equal(result.all_passed, false);
    assert.ok(result.artifacts[0].issues.some(i => i.includes('min_lines')));
  });
});

// ---------------------------------------------------------------------------
// verifyKeyLinks
// ---------------------------------------------------------------------------

describe('verifyKeyLinks', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-test-vkl-'));
    fs.mkdirSync(path.join(tmpDir, '.planning', 'phases', '01-test'), { recursive: true });
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns verified=false with "Source file not found" when from-path missing', () => {
    const planContent = [
      '---',
      'must_haves:',
      '  key_links:',
      '    - from: "src/missing.cjs"',
      '      to: "src/other.cjs"',
      '      via: "import"',
      '      pattern: "require.*other"',
      '---',
      '# Plan',
    ].join('\n');
    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-01-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const { verifyKeyLinks } = require(MOD_PATH);
    const result = verifyKeyLinks(tmpDir, planPath);

    assert.equal(result.all_verified, false);
    assert.equal(result.links[0].verified, false);
    assert.ok(result.links[0].detail.includes('Source file not found'));
  });

  it('returns verified=false with "Pattern not found" when regex does not match', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'router.cjs'), "const x = require('./foo.cjs');\n");

    const planContent = [
      '---',
      'must_haves:',
      '  key_links:',
      '    - from: "src/router.cjs"',
      '      to: "src/bar.cjs"',
      '      via: "require"',
      '      pattern: "require.*bar\\\\.cjs"',
      '---',
      '# Plan',
    ].join('\n');
    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-02-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const { verifyKeyLinks } = require(MOD_PATH);
    const result = verifyKeyLinks(tmpDir, planPath);

    assert.equal(result.links[0].verified, false);
    assert.ok(result.links[0].detail.includes('Pattern not found'));
  });

  it('returns verified=true with "Pattern found" when regex matches', () => {
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, 'wired.cjs'), "const bar = require('./bar.cjs').handle;\n");

    const planContent = [
      '---',
      'must_haves:',
      '  key_links:',
      '    - from: "src/wired.cjs"',
      '      to: "src/bar.cjs"',
      '      via: "require"',
      '      pattern: "require.*bar\\\\.cjs.*\\\\.handle"',
      '---',
      '# Plan',
    ].join('\n');
    const planPath = path.join(tmpDir, '.planning', 'phases', '01-test', '01-03-PLAN.md');
    fs.writeFileSync(planPath, planContent);

    const { verifyKeyLinks } = require(MOD_PATH);
    const result = verifyKeyLinks(tmpDir, planPath);

    assert.equal(result.all_verified, true);
    assert.equal(result.links[0].verified, true);
    assert.ok(result.links[0].detail.includes('Pattern found'));
  });
});

// ---------------------------------------------------------------------------
// verifyPhaseCompleteness
// ---------------------------------------------------------------------------

describe('verifyPhaseCompleteness', () => {
  let tmpDir;

  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dan-test-vpc-'));
    // Phase with 2 plans but only 1 summary
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.mkdirSync(phaseDir, { recursive: true });
    fs.writeFileSync(path.join(phaseDir, '01-01-PLAN.md'), '---\nphase: 01\n---\n# Plan 1');
    fs.writeFileSync(path.join(phaseDir, '01-02-PLAN.md'), '---\nphase: 01\n---\n# Plan 2');
    fs.writeFileSync(path.join(phaseDir, '01-01-SUMMARY.md'), '# Summary 1');
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns complete=false when plans exist without matching summaries', () => {
    const { verifyPhaseCompleteness } = require(MOD_PATH);
    const result = verifyPhaseCompleteness(tmpDir, '1');

    assert.equal(result.complete, false);
    assert.equal(result.plan_count, 2);
    assert.equal(result.summary_count, 1);
    assert.ok(result.incomplete_plans.includes('01-02'));
  });

  it('returns complete=true when every plan has a summary', () => {
    // Add the missing summary
    const phaseDir = path.join(tmpDir, '.planning', 'phases', '01-test');
    fs.writeFileSync(path.join(phaseDir, '01-02-SUMMARY.md'), '# Summary 2');

    const { verifyPhaseCompleteness } = require(MOD_PATH);
    const result = verifyPhaseCompleteness(tmpDir, '1');

    assert.equal(result.complete, true);
    assert.equal(result.plan_count, 2);
    assert.equal(result.summary_count, 2);
    assert.deepEqual(result.incomplete_plans, []);
  });
});

// ---------------------------------------------------------------------------
// fingerprintIssue
// ---------------------------------------------------------------------------

describe('fingerprintIssue', () => {
  it('produces same fingerprint for same issue with different line numbers', () => {
    const { fingerprintIssue } = require(MOD_PATH);
    const fp1 = fingerprintIssue("Missing export on line 42 in 'foo.cjs'");
    const fp2 = fingerprintIssue("Missing export on line 99 in 'foo.cjs'");
    assert.equal(fp1, fp2);
  });

  it('normalizes whitespace and casing', () => {
    const { fingerprintIssue } = require(MOD_PATH);
    const fp1 = fingerprintIssue('Missing  EXPORT   in file');
    const fp2 = fingerprintIssue('missing export in file');
    assert.equal(fp1, fp2);
  });

  it('normalizes string literals', () => {
    const { fingerprintIssue } = require(MOD_PATH);
    const fp1 = fingerprintIssue("Error in 'alpha.cjs'");
    const fp2 = fingerprintIssue('Error in "beta.cjs"');
    assert.equal(fp1, fp2);
  });
});

// ---------------------------------------------------------------------------
// detectRecurringIssues
// ---------------------------------------------------------------------------

describe('detectRecurringIssues', () => {
  it('returns should_escalate=true when ratio > 0.5', () => {
    const { detectRecurringIssues } = require(MOD_PATH);
    const current = ['Missing export on line 10', 'File not found: a.cjs'];
    const previous = ['Missing export on line 20', 'File not found: a.cjs'];
    const result = detectRecurringIssues(current, previous);

    assert.equal(result.should_escalate, true);
    assert.ok(result.ratio > 0.5);
    assert.equal(result.recurring_count, 2);
  });

  it('returns should_escalate=false when ratio <= 0.5', () => {
    const { detectRecurringIssues } = require(MOD_PATH);
    const current = ['New issue A', 'New issue B', 'Old issue on line 1'];
    const previous = ['Old issue on line 5'];
    const result = detectRecurringIssues(current, previous);

    assert.equal(result.should_escalate, false);
    assert.ok(result.ratio <= 0.5);
  });

  it('handles empty arrays', () => {
    const { detectRecurringIssues } = require(MOD_PATH);
    const result = detectRecurringIssues([], []);
    assert.equal(result.should_escalate, false);
    assert.equal(result.ratio, 0);
  });
});

// ---------------------------------------------------------------------------
// formatVerificationReport
// ---------------------------------------------------------------------------

describe('formatVerificationReport', () => {
  it('produces markdown with frontmatter, criteria table, artifact table, key-link table', () => {
    const { formatVerificationReport } = require(MOD_PATH);
    const report = formatVerificationReport({
      phase: '01-foundation',
      status: 'passed',
      score: '3/3',
      criteria: [
        { id: 1, criterion: 'Core module exists', status: 'PASS', evidence: 'File verified' }
      ],
      artifacts: [
        { path: 'bin/lib/core.cjs', expected: 'Core module', status: 'VERIFIED', details: 'All exports found' }
      ],
      keyLinks: [
        { from: 'bin/dan-tools.cjs', to: 'bin/lib/core.cjs', via: 'require', status: 'WIRED', details: 'Pattern matched' }
      ],
      requirements: [
        { id: 'QUAL-01', status: 'SATISFIED', evidence: 'All checks pass' }
      ],
      issues: [],
      testOutput: 'All 10 tests passed'
    });

    // Check frontmatter
    assert.ok(report.startsWith('---\n'), 'Should start with frontmatter delimiter');
    assert.ok(report.includes('status: passed'), 'Should contain status field');
    assert.ok(report.includes('score:'), 'Should contain score field');
    assert.ok(report.includes('bugsweep_cycles:'), 'Should contain bugsweep_cycles field');

    // Check criteria table
    assert.ok(report.includes('| # | Criterion | Status | Evidence |'), 'Should have criteria table headers');
    assert.ok(report.includes('Core module exists'), 'Should have criterion content');

    // Check artifact table
    assert.ok(report.includes('| Artifact | Expected | Status | Details |'), 'Should have artifact table headers');
    assert.ok(report.includes('bin/lib/core.cjs'), 'Should have artifact path');

    // Check key-link table
    assert.ok(report.includes('| From | To | Via | Status | Details |'), 'Should have key-link table headers');
    assert.ok(report.includes('bin/dan-tools.cjs'), 'Should have key-link from');

    // Check requirements table
    assert.ok(report.includes('| Requirement | Status | Evidence |'), 'Should have requirements table headers');
    assert.ok(report.includes('QUAL-01'), 'Should have requirement ID');
  });

  it('includes issues list when present', () => {
    const { formatVerificationReport } = require(MOD_PATH);
    const report = formatVerificationReport({
      phase: '01-foundation',
      status: 'gaps_found',
      score: '2/3',
      criteria: [],
      artifacts: [],
      keyLinks: [],
      requirements: [],
      issues: ['Missing export: handle in core.cjs', 'Test file too short'],
      testOutput: ''
    });

    assert.ok(report.includes('Missing export: handle in core.cjs'));
    assert.ok(report.includes('Test file too short'));
  });
});
