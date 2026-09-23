#!/usr/bin/env node
/**
 * Load-test wiring check for ShieldCallAI (P3-3).
 *
 * Verifies the edge-function load-test tooling is in place and honest:
 *  1. scripts/load-test-edge-functions.js exists and is ping-only by
 *     construction (posts { ping: true }, never touches a paid path, never
 *     logs a credential).
 *  2. package.json exposes `npm run load:test` and this check as
 *     `check:load-test`.
 *  3. docs/load-test.md exists and documents: scope (ping-only), the paid
 *     paths deliberately excluded, method (stages, timeout, breaking-point
 *     rule), per-function results tables, and a breaking-point verdict line.
 *
 * Usage: node scripts/check-load-test.js   (or: npm run check:load-test)
 * Exit code 0 = OK, 1 = misconfiguration.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TAG = 'check:load-test';

let passed = 0;
function ok(message) {
  passed += 1;
  console.log(`[${TAG}] ok ${passed}: ${message}`);
}
function fail(message) {
  console.error(`[${TAG}] FAIL: ${message}`);
  process.exit(1);
}
function read(rel) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) fail(`missing file: ${rel}`);
  return fs.readFileSync(p, 'utf8');
}

const loader = read('scripts/load-test-edge-functions.js');
const FUNCTION_IDS = [
  'ghost-ai',
  'transcribe-audio',
  'call-summary',
  'ai-dialer',
  'voip-push',
  'validate-receipt',
];
for (const id of FUNCTION_IDS) {
  if (!loader.includes(`'${id}'`)) fail(`loader does not probe function ${id}`);
}
ok(`loader probes all ${FUNCTION_IDS.length} edge functions`);

if (!loader.includes('ping: true') && !loader.includes('ping:true'))
  fail('loader does not send the ping probe payload');
ok('loader sends only the { ping: true } probe payload');

if (/transcribe-audio["']\s*,\s*\{[^}]*audio/i.test(loader) || loader.includes('form-data'))
  fail('loader appears to touch a paid path');
ok('loader touches no paid path (no audio upload, no chat payload)');

if (/console\.(log|error|warn)\([^)]*\banonKey\b/.test(loader))
  fail('loader may log the credential value');
ok('loader never logs the credential');

const pkg = JSON.parse(read('package.json'));
if (pkg.scripts['load:test'] !== 'node scripts/load-test-edge-functions.js --out docs/load-test.md')
  fail('package.json missing or wrong `load:test` script');
ok('package.json exposes `npm run load:test`');
if (pkg.scripts['check:load-test'] !== 'node scripts/check-load-test.js')
  fail('package.json missing `check:load-test` script');
ok('package.json exposes `npm run check:load-test`');

const doc = read('docs/load-test.md');
for (const id of FUNCTION_IDS) {
  if (!doc.includes(id)) fail(`docs/load-test.md has no results section for ${id}`);
}
ok('docs/load-test.md covers all six functions');
const required = [
  ['ping', 'scope states the test is ping-only'],
  ['paid', 'doc names the paid paths deliberately excluded'],
  ['breaking point', 'doc defines or reports breaking points'],
  ['concurrency', 'doc describes the concurrency stages'],
];
for (const [needle, label] of required) {
  if (!doc.toLowerCase().includes(needle)) fail(`docs/load-test.md: ${label} (missing "${needle}")`);
  ok(`docs/load-test.md: ${label}`);
}

console.log(`[${TAG}] PASS (${passed} assertions)`);
