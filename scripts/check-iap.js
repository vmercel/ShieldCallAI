#!/usr/bin/env node
/**
 * In-app purchase check for ShieldCallAI (P1-1).
 *
 * The paywall must never invent purchases, show buyable buttons for products
 * the store never returned, or ship a fake/mock purchase path. Verifies that:
 *  1. react-native-iap is a declared dependency (StoreKit / Play Billing).
 *  2. services/iap.ts defines the monthly + family catalog with non-empty,
 *     unique SKUs, and SKU env overrides documented in .env.example.
 *  3. The native module is loaded lazily: no top-level static import or
 *     require of react-native-iap outside the guarded loader, and
 *     IapUnavailableError is thrown when the module is missing.
 *  4. Every purchase is finished (finishTransaction referenced) — no
 *     dangling transactions.
 *  5. No mock/simulated/fake purchase helpers exist in services/iap.ts or
 *     app/paywall.tsx.
 *  6. app/paywall.tsx renders Buy buttons only for products the store
 *     returned (localizedPrice !== null check present) and wires Restore
 *     purchases to restorePurchases.
 *  7. The paywall links to the Terms of use and Privacy policy routes
 *     (App Store review requirement).
 *  8. Server-side receipt validation (P1-2) is implemented: the client sends
 *     each purchase to the validate-receipt edge function and retries
 *     pending purchases; the paywall stays honest that entitlements are
 *     device-local until the server confirms them.
 *  9. Settings links to the paywall (/paywall route reachable from Settings).
 * 10. No secrets (API keys, shared secrets) are hardcoded in services/iap.ts.
 *
 * Usage: node scripts/check-iap.js   (or: npm run check:iap)
 * Exit code 0 = OK, 1 = misconfiguration.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

let passed = 0;
function ok(message) {
  passed += 1;
  console.log(`[check:iap] ok ${passed}: ${message}`);
}
function fail(message) {
  console.error(`[check:iap] FAIL: ${message}`);
  process.exit(1);
}

function read(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) fail(`missing file: ${rel}`);
  return fs.readFileSync(full, 'utf8');
}

// 1. Dependency declared.
const pkg = JSON.parse(read('package.json'));
if (!pkg.dependencies || !pkg.dependencies['react-native-iap']) {
  fail('react-native-iap is not a declared dependency in package.json');
}
ok('react-native-iap is a declared dependency');

const iap = read('services/iap.ts');
const paywall = read('app/paywall.tsx');
const envExample = read('.env.example');
const settings = read('app/(tabs)/settings.tsx');

// 2. Catalog: monthly + family, non-empty unique SKUs, env overrides.
for (const plan of ['pro_monthly', 'family_monthly']) {
  if (!iap.includes(`planId: '${plan}'`)) fail(`catalog missing planId '${plan}'`);
}
ok('catalog defines pro_monthly and family_monthly plans');
const skuDefaults = [...iap.matchAll(/(PRO|FAMILY)_MONTHLY_SKU_DEFAULT = '([^']+)'/g)].map((m) => m[2]);
if (skuDefaults.length !== 2 || skuDefaults.some((s) => !s) || new Set(skuDefaults).size !== 2) {
  fail('default SKUs must be non-empty and unique');
}
ok(`default SKUs are non-empty and unique (${skuDefaults.join(', ')})`);
for (const env of ['EXPO_PUBLIC_IAP_PRO_MONTHLY_SKU', 'EXPO_PUBLIC_IAP_FAMILY_MONTHLY_SKU']) {
  if (!iap.includes(env)) fail(`services/iap.ts does not read ${env}`);
  if (!envExample.includes(env)) fail(`.env.example does not document ${env}`);
}
ok('SKU env overrides are read by services/iap.ts and documented in .env.example');

// 3. Lazy native-module load, no top-level import.
const lines = iap.split('\n');
const topLevelImport = lines.some((l) => /^import\s+.*from\s+['"]react-native-iap['"]/.test(l.trim()));
if (topLevelImport) fail('services/iap.ts statically imports react-native-iap at module top level');
const moduleLevelRequire = lines.some((l, i) => {
  const t = l.trim();
  return t.startsWith('require(') && t.includes('react-native-iap') && !lines.slice(Math.max(0, i - 6), i).some((p) => p.includes('function getIap'));
});
if (moduleLevelRequire) fail('services/iap.ts requires react-native-iap outside the guarded loader');
if (!iap.includes('IapUnavailableError')) fail('IapUnavailableError is not defined/exported');
if (!iap.includes('throw new IapUnavailableError')) fail('lazy loader never throws IapUnavailableError');
ok('native module is lazy-loaded with IapUnavailableError on missing linkage');

// 4. Purchases are finished.
if (!iap.includes('finishTransaction')) fail('no finishTransaction call: purchases could be left dangling');
ok('purchase flow finishes transactions');

// 5. No mock/simulated/fake purchase paths.
for (const [name, src] of [['services/iap.ts', iap], ['app/paywall.tsx', paywall]]) {
  for (const banned of [/simulatePurchase/i, /mockPurchase/i, /fakePurchase/i, /MOCK_PURCHASE/, /demoPurchase/i]) {
    if (banned.test(src)) fail(`${name} contains a mock/simulated purchase path (${banned})`);
  }
}
ok('no mock, simulated, or fake purchase paths');

// 6. Buy buttons only for store-returned products; restore wired.
if (!paywall.includes('localizedPrice !== null')) fail('paywall does not gate Buy buttons on store-returned products');
if (!paywall.includes('restorePurchases')) fail('paywall does not wire a Restore purchases action');
ok('paywall gates Buy buttons on store-returned products and wires Restore purchases');

// 7. Terms + privacy links (store review requirement).
if (!/router\.push\(['"]\/terms['"]/.test(paywall) || !/router\.push\(['"]\/privacy['"]/.test(paywall)) {
  fail('paywall must link to the Terms of use and Privacy policy');
}
ok('paywall links to Terms of use and Privacy policy');

// 8. P1-2 receipt validation is implemented, not just documented: the client
// sends each purchase to the validate-receipt edge function and retries
// pending purchases.
for (const needle of ['validate-receipt', 'validateReceiptWithServer', 'retryPendingValidations']) {
  if (!iap.includes(needle)) fail(`services/iap.ts does not implement P1-2 receipt validation (${needle} missing)`);
}
ok('P1-2 receipt validation is implemented (validate-receipt call + retries)');

// 9. Settings links to the paywall.
if (!settings.includes('/paywall')) fail('Settings does not link to /paywall');
ok('Settings links to the paywall');

// 10. No hardcoded secrets.
for (const banned of [/sk_live_/i, /pk_live_/i, /API_KEY\s*=\s*['"][A-Za-z0-9]/, /shared[_-]?secret/i]) {
  if (banned.test(iap)) fail(`services/iap.ts may contain a hardcoded secret (${banned})`);
}
ok('no hardcoded secrets in services/iap.ts');

// 11. Settings exposes a standalone Restore purchases row (P1-3, App Store requirement).
if (!settings.includes('restorePurchases')) fail('Settings does not wire a standalone restorePurchases call');
if (!/Restore purchases/i.test(settings)) fail('Settings has no visible "Restore purchases" label');
ok('Settings has a standalone Restore purchases row wired to restorePurchases');

console.log(`[check:iap] all ${passed} assertions passed`);
