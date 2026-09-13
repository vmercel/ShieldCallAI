#!/usr/bin/env node
/**
 * Rate-limit unit tests for ShieldCallAI edge functions (P0-3).
 *
 * Transpiles the REAL supabase/functions/_shared/rateLimit.ts with tsc and
 * exercises its pure logic in node: window math, JWT user extraction,
 * quota decisions (with a fake store), and the 401/429 response shapes.
 * No network, no Deno, no Supabase project needed.
 *
 * Usage: node scripts/check-ratelimit.js   (or: npm run check:ratelimit)
 * Exit code 0 = all pass, 1 = failure.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SHARED = path.join(ROOT, 'supabase', 'functions', '_shared');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'rl-test-'));

// Deno-only globals the module may touch (stubbed before import).
globalThis.Deno = { env: { get: () => undefined } };

function build() {
  // tsc standalone does not know the Deno global; stub it for the test build.
  fs.writeFileSync(path.join(TMP, 'deno-stub.d.ts'), 'declare const Deno: any;\n');
  // tsc rejects Deno-style './x.ts' import specifiers; compile a copy with
  // the specifier rewritten to './x.js' (semantically identical).
  const src = fs.readFileSync(path.join(SHARED, 'rateLimit.ts'), 'utf8')
    .replace(/from\s+['"]\.\/cors\.ts['"]/g, "from './cors.js'");
  const tmpSrc = path.join(TMP, 'rateLimit.ts');
  fs.writeFileSync(tmpSrc, src);
  // cors.ts must sit next to the copy so './cors.js' resolves.
  fs.copyFileSync(path.join(SHARED, 'cors.ts'), path.join(TMP, 'cors.ts'));
  let out = '';
  try {
    out = execSync(
      `npx -y -p typescript@5 tsc ${tmpSrc} ${path.join(TMP, 'cors.ts')} ${path.join(TMP, 'deno-stub.d.ts')}` +
        ` --outDir ${TMP} --module commonjs --target es2020 --skipLibCheck 2>&1`,
      { cwd: '/tmp', encoding: 'utf8' },
    );
  } catch (e) {
    throw new Error(`tsc failed:\n${e.stdout || e.message}`);
  }
  if (out.trim()) throw new Error(`tsc output:\n${out}`);
}

let passed = 0;
function assert(cond, name) {
  if (!cond) {
    console.error(`[check-ratelimit] FAIL: ${name}`);
    process.exit(1);
  }
  passed++;
  console.log(`[check-ratelimit] ok: ${name}`);
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
const UUID = '123e4567-e89b-12d3-a456-426614174000';
function jwt(sub) {
  return `header.${b64url({ sub })}.sig`;
}
function reqWith(authValue) {
  const h = {};
  if (authValue !== undefined) h['authorization'] = authValue;
  return new Request('https://x.test/', { headers: h });
}

async function main() {
  build();
  const rl = require(path.join(TMP, 'rateLimit.js'));

  // --- window math ---
  assert(rl.quotaWindowStart(3_700_000, 3_600_000) === 3_600_000, 'windowStart floors into window');
  assert(rl.quotaWindowStart(3_600_000, 3_600_000) === 3_600_000, 'windowStart exact boundary');
  assert(rl.quotaWindowStart(0, 3_600_000) === 0, 'windowStart epoch');

  // --- limit parsing ---
  assert(rl.parseLimit('50', 120) === 50, 'parseLimit numeric string');
  assert(rl.parseLimit(undefined, 120) === 120, 'parseLimit undefined -> fallback');
  assert(rl.parseLimit('', 120) === 120, 'parseLimit empty -> fallback');
  assert(rl.parseLimit('abc', 120) === 120, 'parseLimit garbage -> fallback');
  assert(rl.parseLimit('-3', 120) === 120, 'parseLimit negative -> fallback');
  assert(rl.parseLimit('0', 120) === 120, 'parseLimit zero -> fallback');

  // --- JWT user extraction ---
  assert(rl.extractUserId(reqWith(undefined)) === null, 'extractUserId: no header -> null');
  assert(rl.extractUserId(reqWith('Token abc')) === null, 'extractUserId: non-bearer -> null');
  assert(rl.extractUserId(reqWith('Bearer notajwt')) === null, 'extractUserId: malformed -> null');
  assert(rl.extractUserId(reqWith(`Bearer ${jwt(UUID)}`)) === UUID, 'extractUserId: valid UUID sub');
  assert(rl.extractUserId(reqWith(`bearer ${jwt(UUID)}`)) === UUID, 'extractUserId: lowercase scheme');
  assert(rl.extractUserId(reqWith(`Bearer ${jwt('not-a-uuid')}`)) === null, 'extractUserId: non-UUID sub -> null');
  assert(rl.extractUserId(reqWith('Bearer a.!!!.c')) === null, 'extractUserId: bad base64 -> null');

  // --- quota decisions with a fake store ---
  const seen = [];
  const fakeRpc = async (args) => {
    seen.push(args);
    return { requestCount: 5, allowed: true };
  };
  const q1 = await rl.enforceQuota({
    rpc: fakeRpc, userId: UUID, functionName: 'ghost-ai', limit: 10,
    windowMs: 3_600_000, nowMs: 3_700_000,
  });
  assert(q1.allowed === true && q1.remaining === 5, 'enforceQuota: allowed with remaining');
  assert(q1.resetAtMs === 7_200_000, 'enforceQuota: reset at window end');
  assert(seen[0].windowStartIso === new Date(3_600_000).toISOString(), 'enforceQuota: RPC gets window-start ISO');
  assert(seen[0].functionName === 'ghost-ai' && seen[0].limit === 10, 'enforceQuota: RPC gets fn + limit');

  const q2 = await rl.enforceQuota({
    rpc: async () => ({ requestCount: 10, allowed: false }),
    userId: UUID, functionName: 'transcribe-audio', limit: 10, nowMs: 1000,
  });
  assert(q2.allowed === false && q2.remaining === 0, 'enforceQuota: denied clamps remaining to 0');

  // --- response shapes ---
  const r429 = rl.quotaExceededResponse({ allowed: false, requestCount: 11, remaining: 0, resetAtMs: Date.now() + 60000, limit: 10 });
  assert(r429.status === 429, '429 status');
  assert(r429.headers.get('Retry-After') !== null, '429 has Retry-After');
  assert(r429.headers.get('X-RateLimit-Remaining') === '0', '429 remaining header is 0');
  const b429 = await r429.json();
  assert(typeof b429.error === 'string' && b429.error.length > 0, '429 JSON error body');

  const r401 = rl.unauthorizedResponse();
  assert(r401.status === 401, '401 status');
  const b401 = await r401.json();
  assert(typeof b401.error === 'string', '401 JSON error body');

  const wrapped = rl.withQuotaHeaders(new Response('{}', { headers: { 'Content-Type': 'application/json' } }),
    { allowed: true, requestCount: 3, remaining: 7, resetAtMs: 7_200_000, limit: 10 });
  assert(wrapped.headers.get('X-RateLimit-Limit') === '10', 'wrapped: limit header');
  assert(wrapped.headers.get('X-RateLimit-Remaining') === '7', 'wrapped: remaining header');
  assert(wrapped.headers.get('X-RateLimit-Reset') === '7200', 'wrapped: reset header (epoch secs)');

  // --- full gate: unauthenticated short-circuits before Deno is touched ---
  const gate = await rl.authorizeAndCheckQuota(reqWith(undefined), { functionName: 'ghost-ai', limit: 10 });
  assert(gate.ok === false && gate.response.status === 401, 'gate: no token -> 401 without DB');

  console.log(`[check-ratelimit] PASS (${passed} assertions)`);
}

main().catch((e) => {
  console.error(`[check-ratelimit] FAIL: ${e && e.stack ? e.stack : e}`);
  process.exit(1);
});
