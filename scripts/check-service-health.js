#!/usr/bin/env node
/**
 * Service health check for ShieldCallAI (P1-5).
 *
 * The app ships a Service status screen (app/service-status.tsx) backed by
 * services/serviceHealth.ts. Each edge function must answer { ping: true }
 * cheaply (no AI/transcription spend) and report whether its own provider
 * key is configured. Verifies that:
 *  1. services/serviceHealth.ts exists and probes supabase + the 4 functions.
 *  2. Each of ghost-ai, call-summary, ai-dialer, transcribe-audio has a
 *     `ping === true` branch that returns before any provider call.
 *  3. The ping branch reports key configuration as a boolean (never the key).
 *  4. app/service-status.tsx exists and is reachable from Settings.
 *  5. The ping branches sit before the first provider-key usage / spend call.
 *
 * Usage: node scripts/check-service-health.js   (or: npm run check:service-health)
 * Exit code 0 = OK, 1 = misconfiguration.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TAG = 'check:service-health';

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

const EXPECTED = {
  'supabase/functions/ghost-ai/index.ts': 'aiConfigured',
  'supabase/functions/call-summary/index.ts': 'aiConfigured',
  'supabase/functions/ai-dialer/index.ts': 'aiConfigured',
  'supabase/functions/transcribe-audio/index.ts': 'deepgramConfigured',
};

// 1. Probe module exists and covers every service.
const svc = read('services/serviceHealth.ts');
for (const id of ['supabase', 'ghost-ai', 'transcribe-audio', 'call-summary', 'ai-dialer']) {
  if (!svc.includes(`'${id}'`)) fail(`serviceHealth.ts does not probe '${id}'`);
}
ok('serviceHealth.ts probes supabase + all 4 edge functions');
if (!svc.includes('ping: true')) fail('serviceHealth.ts does not send { ping: true }');
ok('serviceHealth.ts sends the cheap { ping: true } payload');

// 2+3. Each function answers ping cheaply and reports key presence as boolean.
for (const [file, flag] of Object.entries(EXPECTED)) {
  const src = read(file);
  if (!src.includes('ping === true')) fail(`${file} has no ping branch`);
  if (!src.includes(flag)) fail(`${file} ping branch does not report ${flag}`);
  // The flag must be a boolean coercion, never the raw key.
  if (!src.includes(`${flag}: !!`)) fail(`${file} must report ${flag} as a boolean (!!)`);
  ok(`${file} answers ping and reports ${flag} as boolean`);
}

// 4. Screen exists and is linked from Settings.
read('app/service-status.tsx');
const settings = read('app/(tabs)/settings.tsx');
if (!settings.includes('/service-status')) fail('Settings has no link to /service-status');
ok('app/service-status.tsx exists and is linked from Settings');

// 5. Ping branch returns before any provider spend in each function.
for (const file of Object.keys(EXPECTED)) {
  const src = read(file);
  const pingAt = src.indexOf('ping === true');
  const spendMarkers = ['api.anthropic.com', 'api.deepgram.com'];
  for (const marker of spendMarkers) {
    const spendAt = src.indexOf(marker);
    if (spendAt !== -1 && spendAt < pingAt) {
      fail(`${file}: provider call (${marker}) appears before the ping branch`);
    }
  }
}
ok('ping branches return before any provider call in all 4 functions');

console.log(`[${TAG}] ${passed} assertions passed`);
