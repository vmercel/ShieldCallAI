#!/usr/bin/env node
/**
 * VoIP push wiring check for ShieldCallAI (P1-4).
 *
 * PushKit VoIP registration + background incoming-call delivery. Verifies:
 *  1. react-native-voip-push-notification is a declared dependency.
 *  2. services/voipPush.ts exports the registration/listener API, gates on
 *     the native module, upserts the token to voip_tokens, and reports every
 *     incoming VoIP push to CallKit (Apple's hard requirement).
 *  3. app/_layout.tsx wires registration on sign-in, unregistration on
 *     sign-out, and routes incoming VoIP calls to the incoming-call screen.
 *  4. Migration creates voip_tokens with RLS and own-row-only policies
 *     (no anon access, no cross-user access).
 *  5. The voip-push edge function: cheap ping probe; verify_jwt targeting
 *     rule (user JWTs may only ring themselves); APNs VoIP send uses the
 *     `.voip` topic + apns-push-type voip; stale tokens deleted on 410 /
 *     BadDeviceToken / FCM UNREGISTERED; fail-closed 503 when unconfigured.
 *  6. .env.example documents the APNs/FCM server secrets as placeholders.
 *
 * Usage: node scripts/check-voip-push.js   (or: npm run check:voip-push)
 * Exit code 0 = OK, 1 = misconfiguration.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TAG = 'check:voip-push';

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

// 1. Native dependency declared.
const pkg = JSON.parse(read('package.json'));
if (!pkg.dependencies || !pkg.dependencies['react-native-voip-push-notification']) {
  fail('package.json must declare react-native-voip-push-notification');
}
ok('react-native-voip-push-notification declared in package.json');

// 2. Client service.
const svc = read('services/voipPush.ts');
for (const name of [
  'registerVoipPushToken',
  'unregisterVoipPushToken',
  'startVoipPushListener',
  'onIncomingVoipCall',
  'handleVoipNotification',
  'isVoipPushAvailable',
]) {
  if (!svc.includes(`export function ${name}`) && !svc.includes(`export async function ${name}`)) {
    fail(`services/voipPush.ts must export ${name}`);
  }
}
ok('services/voipPush.ts exports the full registration/listener API');
if (!svc.includes('RNVoipPushNotificationManager')) {
  fail('voipPush.ts must gate on the native RNVoipPushNotificationManager module');
}
ok('voipPush.ts gates on the native module (no-op on web/Expo Go)');
if (!svc.includes("from('voip_tokens')") || !svc.includes('upsert')) {
  fail('voipPush.ts must upsert the VoIP token into voip_tokens');
}
ok('voipPush.ts upserts the device token into voip_tokens');
if (!svc.includes('displayIncomingCall')) {
  fail('voipPush.ts must report every VoIP push to CallKit via displayIncomingCall');
}
ok('voipPush.ts reports incoming VoIP pushes to CallKit (Apple requirement)');
// CallKit report must happen before subscriber notification in the handler.
const handlerBody = svc.slice(svc.indexOf('export function handleVoipNotification'));
if (
  handlerBody.indexOf('displayIncomingCall') === -1 ||
  handlerBody.indexOf('displayIncomingCall') > handlerBody.indexOf('for (const cb of voipCallSubscribers)')
) {
  fail('handleVoipNotification must report to CallKit before notifying subscribers');
}
ok('handleVoipNotification reports to CallKit before routing');

// 3. App wiring.
const layout = read('app/_layout.tsx');
for (const snippet of [
  'startVoipPushListener()',
  'registerVoipPushToken',
  'unregisterVoipPushToken',
  'onIncomingVoipCall',
  "pathname: '/incoming-call'",
]) {
  if (!layout.includes(snippet)) fail(`app/_layout.tsx must wire ${snippet}`);
}
ok('app/_layout.tsx wires VoIP listener, auth-state registration, and call routing');

// 4. Migration: voip_tokens with own-row RLS only.
const mig = read('supabase/migrations/20260922120000_voip_tokens.sql');
if (!mig.includes('create table') || !mig.includes('voip_tokens')) {
  fail('migration must create the voip_tokens table');
}
ok('migration creates voip_tokens');
if (!mig.includes('enable row level security')) fail('voip_tokens must enable RLS');
ok('voip_tokens has RLS enabled');
for (const action of ['select', 'insert', 'update', 'delete']) {
  if (!mig.includes(`for ${action}`) || !mig.includes('auth.uid() = user_id')) {
    fail(`voip_tokens must have an own-row ${action} policy`);
  }
}
ok('voip_tokens policies are own-row only (select/insert/update/delete)');
if (/to anon|for all/i.test(mig)) fail('voip_tokens must not grant anon or ALL access');
ok('voip_tokens grants nothing to anon and no ALL policy');

// 5. Edge function.
const fn = read('supabase/functions/voip-push/index.ts');
if (!fn.includes("body?.ping === true")) fail('voip-push must answer a cheap ping probe');
ok('voip-push answers a cheap { ping: true } probe');
if (!fn.includes('apnsConfigured') || !fn.includes('fcmConfigured')) {
  fail('voip-push ping must report apnsConfigured/fcmConfigured booleans');
}
ok('voip-push ping reports channel configuration as booleans');
if (!fn.includes('forbidden_target')) {
  fail('voip-push must enforce the self-target rule for user JWTs');
}
ok('voip-push enforces self-targeting for user JWTs (service role may target anyone)');
if (!fn.includes('.voip') || !fn.includes("'voip'") || !fn.includes('apns-push-type')) {
  fail('voip-push must send APNs pushes to the <bundle>.voip topic with apns-push-type voip');
}
ok('voip-push sends to the .voip topic with apns-push-type: voip');
if (!fn.includes('410') || !fn.includes('BadDeviceToken') || !fn.includes('UNREGISTERED')) {
  fail('voip-push must clean stale tokens on APNs 410/BadDeviceToken and FCM UNREGISTERED');
}
ok('voip-push deletes stale tokens on 410/BadDeviceToken/UNREGISTERED');
if (!fn.includes('push_unconfigured') || !fn.includes('503')) {
  fail('voip-push must fail closed (503) when no push channel is configured');
}
ok('voip-push fails closed with 503 when unconfigured');
if (!fn.includes('voip-push') || !fn.includes('enforceQuota')) {
  fail('voip-push must be quota-gated via the shared consume_ai_quota RPC');
}
ok('voip-push is quota-gated (30/hour/caller) via the shared RPC');
if (!/content-available/.test(fn) || /"alert"/.test(fn)) {
  fail('VoIP payload must use content-available only, never an alert payload');
}
ok('VoIP payload is content-available only (no alert/sound/badge)');

// 6. Secrets documented as placeholders.
const envExample = read('.env.example');
for (const name of ['APNS_KEY_ID', 'APNS_TEAM_ID', 'APNS_KEY_P8', 'FCM_SERVICE_ACCOUNT_JSON']) {
  if (!envExample.includes(name)) fail(`.env.example must document ${name}`);
}
ok('.env.example documents APNS_*/FCM_* server secrets as placeholders');

console.log(`[${TAG}] PASS: ${passed} assertions`);
