#!/usr/bin/env node

/**
 * Verdict Generator — Reads Playwright JSON results + CTRF report
 * and writes a simplified verdict.json with PASS/FAIL + artifact paths.
 *
 * Usage: node generate-verdict.mjs [--results results.json] [--ctrf ctrf-report.json] [--output verdict.json]
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Parse CLI args
const args = process.argv.slice(2);
function getArg(name, fallback) {
  const idx = args.indexOf(`--${name}`);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : fallback;
}

const resultsPath = resolve(getArg('results', join(__dirname, 'results.json')));
const ctrfPath = resolve(getArg('ctrf', join(__dirname, 'ctrf-report.json')));
const outputPath = resolve(getArg('output', join(__dirname, 'verdict.json')));
const artifactsDir = resolve(join(__dirname, 'artifacts'));

// Read Playwright JSON results
let results = null;
if (existsSync(resultsPath)) {
  try {
    results = JSON.parse(readFileSync(resultsPath, 'utf-8'));
  } catch (e) {
    console.error(`Warning: Could not parse ${resultsPath}: ${e.message}`);
  }
}

// Read CTRF report if available (for standardized format)
let ctrf = null;
if (existsSync(ctrfPath)) {
  try {
    ctrf = JSON.parse(readFileSync(ctrfPath, 'utf-8'));
  } catch (e) {
    console.error(`Warning: Could not parse ${ctrfPath}: ${e.message}`);
  }
}

// Build verdict from whichever source is available
const verdict = buildVerdict(results, ctrf);
writeFileSync(outputPath, JSON.stringify(verdict, null, 2));
console.log(JSON.stringify(verdict, null, 2));

function buildVerdict(results, ctrf) {
  // Prefer CTRF if available
  if (ctrf?.results) {
    return buildFromCTRF(ctrf);
  }
  if (results) {
    return buildFromPlaywright(results);
  }
  return {
    pass: false,
    timestamp: new Date().toISOString(),
    error: 'No test results found',
    totalTests: 0,
    passedTests: 0,
    failedTests: 0,
    failures: [],
  };
}

function buildFromCTRF(ctrf) {
  const summary = ctrf.results.summary || {};
  const tests = ctrf.results.tests || [];
  const failures = tests
    .filter(t => t.status === 'failed')
    .map(t => ({
      test: t.name,
      filePath: t.filePath || '',
      assertion: t.message || 'Unknown failure',
      duration: t.duration || 0,
      retries: t.retries || 0,
      artifacts: findArtifactsForTest(t.name),
    }));

  return {
    pass: (summary.failed || 0) === 0,
    timestamp: new Date().toISOString(),
    duration: summary.stop && summary.start ? summary.stop - summary.start : 0,
    totalTests: summary.tests || tests.length,
    passedTests: summary.passed || 0,
    failedTests: summary.failed || 0,
    skippedTests: summary.skipped || 0,
    failures,
  };
}

function buildFromPlaywright(results) {
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const failures = [];

  function walkSuites(suites, parentPath = '') {
    for (const suite of suites) {
      const suitePath = parentPath ? `${parentPath} > ${suite.title}` : suite.title;

      for (const spec of suite.specs || []) {
        for (const test of spec.tests || []) {
          totalTests++;
          const result = test.results?.[0];

          if (test.status === 'expected') {
            passedTests++;
          } else {
            failedTests++;
            const attachments = result?.attachments || [];
            failures.push({
              test: `${suitePath} > ${spec.title}`,
              assertion: result?.error?.message || 'Unknown failure',
              url: result?.error?.snippet || '',
              artifacts: {
                trace: findAttachment(attachments, 'trace'),
                screenshot: findAttachment(attachments, 'screenshot'),
                video: findAttachment(attachments, 'video'),
              },
            });
          }
        }
      }

      if (suite.suites) {
        walkSuites(suite.suites, suitePath);
      }
    }
  }

  walkSuites(results.suites || []);

  return {
    pass: failedTests === 0,
    timestamp: new Date().toISOString(),
    duration: results.stats?.duration || 0,
    totalTests,
    passedTests,
    failedTests,
    failures,
  };
}

function findAttachment(attachments, name) {
  const att = attachments.find(a => a.name === name);
  return att?.path || undefined;
}

function findArtifactsForTest(testName) {
  // Attempt to find artifacts in the artifacts directory matching the test name
  const artifacts = {};
  if (!existsSync(artifactsDir)) return artifacts;

  try {
    const slug = testName.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);
    const entries = walkDir(artifactsDir);

    for (const entry of entries) {
      const lower = entry.toLowerCase();
      if (lower.includes(slug) || lower.includes(testName.slice(0, 30).toLowerCase())) {
        if (lower.endsWith('.zip') && lower.includes('trace')) artifacts.trace = entry;
        else if (lower.endsWith('.png') || lower.endsWith('.jpg')) artifacts.screenshot = entry;
        else if (lower.endsWith('.webm') || lower.endsWith('.mp4')) artifacts.video = entry;
      }
    }
  } catch {
    // Best-effort artifact discovery
  }

  return artifacts;
}

function walkDir(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkDir(full));
    } else {
      results.push(full);
    }
  }
  return results;
}
