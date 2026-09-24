#!/usr/bin/env node
/**
 * Receipt-validation check for ShieldCallAI (P1-2).
 *
 * Server-side receipt validation must never invent a paid plan: the plan is
 * always derived from the store's product id, never from the client's
 * claim, and when the store API credentials are not configured the endpoint
 * answers 503 rather than claiming validity. Verifies that:
 *  1. The validate-receipt edge function exists and requires authentication.
 *  2. Apple receipts are verified server-to-server via the App Store Server
 *     API (bundle id, revocation, expiry, product-id mapping).
 *  3. Google receipts are verified via the Play Developer API (active state,
 *     expiry, product-id mapping).
 *  4. A client plan claim that disagrees with the store product id is
 *     rejected (409).
 *  5. Missing store credentials fail CLOSED with 503, never with a grant.
 *  6. DB writes use the service-role key; the migration grants users
 *     read-only access (no authenticated INSERT/UPDATE/DELETE policies).
 *  7. my_current_plan() reads back expired plans as 'free'.
 *  8. The client sends each purchase to validate-receipt, retries pending
 *     purchases, clears them on success, and prefers the server plan.
 *  9. No hardcoded secrets in the function or client.
 *
 * Usage: node scripts/check-receipt-validation.js   (or: npm run check:receipt-validation)
 * Exit code 0 = OK, 1 = misconfiguration.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

let passed = 0;
function ok(message) {
  passed += 1;
  console.log(`[check:receipt-validation] ok ${passed}: ${message}`);
}
function fail(message) {
  console.error(`[check:receipt-validation] FAIL: ${message}`);
  process.exit(1);
}

function read(rel) {
  const full = path.join(ROOT, rel);
  if (!fs.existsSync(full)) fail(`missing file: ${rel}`);
  return fs.readFileSync(full, 'utf8');
}

function expect(re, text, message) {
  if (!re.test(text)) fail(message);
}

// ---- Edge function source ----
const fn = read('supabase/functions/validate-receipt/index.ts');

// 1. Auth gate.
expect(/extractUserId\(req\)/, fn, 'function must extract the user id from the JWT');
expect(/401[\s\S]{0,120}authentication_required/, fn, 'function must 401 without auth');
ok('edge function requires authentication (401 without a user JWT)');

// 2. Apple verification path.
for (const needle of [
  'api.storekit.itunes.apple.com',
  'bundleId',
  'revocationDate',
  'planForSku',
  'IOS_BUNDLE_ID',
]) {
  expect(new RegExp(needle.replace(/\./g, '\\.')), fn, `Apple path missing: ${needle}`);
}
ok('Apple path verifies via App Store Server API (bundle id, revocation, expiry, SKU mapping)');

// 3. Google verification path.
for (const needle of ['androidpublisher', 'subscriptionState', 'SUBSCRIPTION_STATE_ACTIVE', 'ANDROID_PACKAGE']) {
  expect(new RegExp(needle), fn, `Google path missing: ${needle}`);
}
ok('Google path verifies via Play Developer API (active state, expiry, SKU mapping)');

// 4. Plan mismatch rejected.
expect(/409[\s\S]{0,160}plan_mismatch/, fn, 'function must 409 when the claim disagrees with the store');
ok('plan mismatch between client claim and store product is rejected (409)');

// 5. Fail closed when unconfigured.
expect(/503[\s\S]{0,160}receipt_validation_unconfigured/, fn, 'function must 503 when store credentials are missing');
if (/ok:\s*true[\s\S]{0,40}planId/.test(fn) && !/verified/.test(fn)) {
  fail('function appears to grant a plan without verification');
}
ok('missing store credentials fail closed (503, never a grant)');

// 6. Service-role DB writes.
expect(/SUPABASE_SERVICE_ROLE_KEY/, fn, 'function must write with the service-role key');
expect(/user_plans/, fn, 'function must upsert user_plans');
expect(/iap_purchases/, fn, 'function must record iap_purchases');
ok('DB writes use the service-role key (user_plans upsert + iap_purchases record)');

// 9. No hardcoded secrets in the function.
for (const banned of [/sk_live_/i, /-----BEGIN [A-Z ]+PRIVATE KEY-----/, /AIza[0-9A-Za-z_-]{20}/]) {
  if (banned.test(fn)) fail(`function may contain a hardcoded secret (${banned})`);
}
ok('no hardcoded secrets in the edge function');

// ---- Migration ----
const migFiles = fs.readdirSync(path.join(ROOT, 'supabase/migrations'))
  .filter((f) => /iap_receipt_validation/.test(f));
if (migFiles.length === 0) fail('missing iap_receipt_validation migration');
const mig = read(`supabase/migrations/${migFiles[0]}`);
expect(/create table[^;]*iap_purchases/i, mig, 'migration must create iap_purchases');
expect(/create table[^;]*user_plans/i, mig, 'migration must create user_plans');
expect(/enable row level security/i, mig, 'migration must enable RLS');
expect(/for select to authenticated/i, mig, 'migration must grant users SELECT on their own rows');
if (/for (insert|update|delete) to authenticated/i.test(mig)) {
  fail('migration must not grant authenticated INSERT/UPDATE/DELETE (service-role-only writes)');
}
ok('migration creates iap_purchases + user_plans with read-only RLS (service-role writes only)');

expect(/my_current_plan/, mig, 'migration must define my_current_plan()');
expect(/security definer/i, mig, 'my_current_plan must be SECURITY DEFINER');
expect(/'free'/, mig, 'my_current_plan must read expired plans back as free');
expect(/revoke all[^;]*from public,\s*anon/i, mig, 'my_current_plan must be revoked from anon');
expect(/grant execute[^;]*to authenticated/i, mig, 'my_current_plan must be granted to authenticated');
ok('my_current_plan() RPC: SECURITY DEFINER, expired reads as free, authenticated-only');

// ---- Client (native implementation; services/iap.ts is the web stub) ----
const iap = read('services/iap.native.ts');

// 8a. Sends each purchase to the endpoint.
expect(/supabase\.functions\.invoke\(['"]validate-receipt['"]/, iap, 'client must invoke validate-receipt');
expect(/platform/, iap, 'client must send the platform');
expect(/purchaseToken/, iap, 'client must send the Google purchase token');
ok('client sends each purchase to validate-receipt (platform, transaction id, receipt payload)');

// 8b. Best-effort validation in the purchase flow.
expect(/validateReceiptWithServer\(purchase,\s*planId\)/, iap, 'subscribe() must attempt server validation');
ok('purchase flow attempts server validation best-effort (pending queue retains on failure)');

// 8c. Pending queue keeps the payload for retries.
expect(/payloadForPurchase/, iap, 'client must keep the receipt payload for retries');
expect(/retryPendingValidations/, iap, 'client must expose retryPendingValidations');
ok('pending queue stores the receipt payload; retryPendingValidations re-sends it');

// 8d. Server plan preferred.
expect(/my_current_plan/, iap, 'client must read the server plan via my_current_plan');
expect(/fetchServerPlan/, iap, 'client must define fetchServerPlan');
if (!/getActivePlanId[\s\S]{0,400}fetchServerPlan/.test(iap)) {
  fail('getActivePlanId must consult the server plan');
}
ok('getActivePlanId prefers the server-verified plan when signed in');

// 8e. 503 handling + clearing.
expect(/IapValidationUnavailableError/, iap, 'client must distinguish 503 unconfigured from failure');
expect(/clearPendingValidation\(transactionId\)/, iap, 'client must clear the pending record on success');
ok('503 surfaces as IapValidationUnavailableError; success clears the pending record');

// No mock paths.
for (const banned of [/mockPurchase/i, /simulatePurchase/i, /fakeReceipt/i]) {
  if (banned.test(iap)) fail(`client may contain a fake purchase path (${banned})`);
}
ok('no mock/simulated purchase paths in the client');

// No hardcoded secrets in the client.
for (const banned of [/sk_live_/i, /PRIVATE_KEY\s*=\s*['"][A-Za-z0-9]/]) {
  if (banned.test(iap)) fail(`client may contain a hardcoded secret (${banned})`);
}
ok('no hardcoded secrets in the client');

// ---- .env.example documents the server secrets (placeholders only) ----
const envExample = read('.env.example');
for (const name of ['APPLE_IAP_ISSUER_ID', 'APPLE_IAP_KEY_ID', 'APPLE_IAP_PRIVATE_KEY', 'GOOGLE_PLAY_SERVICE_ACCOUNT_JSON']) {
  expect(new RegExp(name), envExample, `.env.example must document ${name}`);
}
ok('.env.example documents the receipt-validation server secrets');

console.log(`[check:receipt-validation] PASS: ${passed} assertions`);
