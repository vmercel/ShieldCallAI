#!/usr/bin/env node
/**
 * Production gating check for ShieldCallAI (P3-4).
 *
 * The shipped product must not contain demo/mock data paths, and the
 * Detector Lab must be gated as a development-only tool. Verifies that:
 *  1. constants/mockData.ts is gone (it carried fabricated MOCK_CALLS).
 *  2. No file under app/, components/, services/, hooks/, contexts/ or
 *     constants/ imports constants/mockData.
 *  3. No MOCK_* / SAMPLE_* / DEMO_* / fixture exports survive in the tree.
 *  4. constants/callTypes.ts exports the shared ThreatLevel type the product
 *     path uses (the one survivor of the old mockData module).
 *  5. The settings "Dev tools" section (Detector Lab entry + sidecar probe)
 *     only renders under __DEV__, so production builds never offer it.
 *  6. The Detector Lab screen itself carries an explicit dev-tool banner.
 *  7. The "Continue as dev tester" onboarding links stay __DEV__-gated.
 *
 * Usage: node scripts/check-prod-gating.js   (or: npm run check:prod-gating)
 * Exit code 0 = OK, 1 = misconfiguration.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TREES = ['app', 'components', 'services', 'hooks', 'contexts', 'constants'];
const TS_RE = /\.(ts|tsx)$/;

let passed = 0;
function ok(message) {
  passed += 1;
  console.log(`[check:prod-gating] ok ${passed}: ${message}`);
}
function fail(message) {
  console.error(`[check:prod-gating] FAIL: ${message}`);
  process.exit(1);
}

function walk(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (TS_RE.test(entry.name)) out.push(full);
  }
}
const files = [];
for (const t of TREES) walk(path.join(ROOT, t), files);
if (files.length === 0) fail('no TS sources found; check tree paths');

function read(rel) {
  return fs.readFileSync(path.isAbsolute(rel) ? rel : path.join(ROOT, rel), 'utf8');
}

// 1. mockData.ts must be gone.
if (fs.existsSync(path.join(ROOT, 'constants', 'mockData.ts'))) {
  fail('constants/mockData.ts still exists; delete the dead demo-fixture module');
}
ok('constants/mockData.ts removed');

// 2. No imports of the deleted module anywhere.
const mockImportRe = /(from\s+['"][^'"]*|require\(\s*['"])constants\/mockData['"]/;
const mockImporters = files.filter((f) => mockImportRe.test(read(f)));
if (mockImporters.length > 0) {
  fail(`files still import constants/mockData: ${mockImporters.join(', ')}`);
}
ok('no imports of constants/mockData anywhere in the tree');

// 3. No mock/sample/demo/fixture data exports survive.
const demoExports = [];
for (const f of files) {
  const src = read(f);
  if (/export\s+(const|let|var|function|class)\s+(MOCK_|SAMPLE_|DEMO_|FIXTURE_)/.test(src)) {
    demoExports.push(f);
  }
}
if (demoExports.length > 0) {
  fail(`mock/sample/demo/fixture exports survive in: ${demoExports.join(', ')}`);
}
ok('no MOCK_/SAMPLE_/DEMO_/FIXTURE_ exports in the tree');

// 3b. No fabricated call-number fixtures (fictitious 555-0100..0199 range).
const fakeNumberFiles = [];
for (const f of files) {
  const src = read(f);
  if (/555-01\d\d/.test(src)) fakeNumberFiles.push(f);
}
if (fakeNumberFiles.length > 0) {
  fail(`fictitious 555-01xx numbers in: ${fakeNumberFiles.join(', ')}`);
}
ok('no fictitious 555-01xx demo numbers in the tree');

// 4. ThreatLevel survives in its new home and is imported by the product path.
const callTypesPath = path.join(ROOT, 'constants', 'callTypes.ts');
if (!fs.existsSync(callTypesPath)) fail('constants/callTypes.ts is missing');
const callTypesSrc = read('constants/callTypes.ts');
if (!/export type ThreatLevel = 'safe' \| 'warning' \| 'danger'/.test(callTypesSrc)) {
  fail('constants/callTypes.ts does not export ThreatLevel as expected');
}
ok('constants/callTypes.ts exports ThreatLevel');
const threatImporters = files.filter((f) => /from\s+['"][^'"]*constants\/callTypes['"]/.test(read(f)));
if (threatImporters.length === 0) fail('nothing imports constants/callTypes');
ok(`ThreatLevel imported from constants/callTypes by ${threatImporters.length} file(s)`);

// 5. Settings "Dev tools" section is __DEV__-gated.
const settingsSrc = read('app/(tabs)/settings.tsx');
if (!/\{__DEV__ \? \(/.test(settingsSrc)) fail('settings.tsx has no {__DEV__ ? ( ... ) : null} gate');
const devGateIdx = settingsSrc.indexOf('{__DEV__ ? (');
const devToolsAfterGate = settingsSrc.indexOf('sectionTitle}>Dev tools', devGateIdx);
if (devGateIdx === -1 || devToolsAfterGate === -1) {
  fail('settings.tsx "Dev tools" section is not inside the __DEV__ gate');
}
ok('settings.tsx "Dev tools" section renders only under __DEV__');
// 5b. The sidecar probe must not run in production builds either.
const probeIdx = settingsSrc.indexOf('sidecarHealth()');
if (probeIdx === -1) fail('settings.tsx no longer probes sidecar health; check what changed');
const probeWindow = settingsSrc.slice(Math.max(0, probeIdx - 500), probeIdx);
if (!/__DEV__/.test(probeWindow)) {
  fail('settings.tsx sidecar health probe is not __DEV__-gated');
}
ok('settings.tsx sidecar health probe is __DEV__-gated');
// 5c. The old always-visible "Research"/"Engineer only" section is gone.
if (/\bResearch\b/.test(settingsSrc) && /sectionTitle}>Research</.test(settingsSrc)) {
  fail('settings.tsx still renders the old ungated Research section');
}
ok('old ungated Research section removed from settings.tsx');

// 6. Detector Lab screen carries the dev-tool banner.
const labSrc = read('app/lab-call.tsx');
if (!/DEV TOOL — engineering screen for the local shieldcall-core sidecar/.test(labSrc)) {
  fail('app/lab-call.tsx is missing the explicit dev-tool banner');
}
ok('Detector Lab screen carries the dev-tool banner');

// 7. Dev-tester onboarding links stay __DEV__-gated.
const onboardingSrc = read('app/onboarding.tsx');
if (/dev tester/i.test(onboardingSrc)) {
  const devTesterHits = [];
  const lines = onboardingSrc.split('\n');
  lines.forEach((line, i) => {
    if (/dev tester/i.test(line) && !/console/i.test(line)) devTesterHits.push(i + 1);
  });
  const gated = /\{__DEV__ && isDevTesterConfigured\(\)/.test(onboardingSrc);
  if (devTesterHits.length > 0 && !gated) {
    fail(`dev-tester links not __DEV__-gated at onboarding.tsx:${devTesterHits.join(',')}`);
  }
}
ok('dev-tester onboarding links remain __DEV__-gated');

console.log(`[check:prod-gating] PASS (${passed} assertions)`);
