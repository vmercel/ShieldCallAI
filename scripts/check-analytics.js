#!/usr/bin/env node
/**
 * Analytics privacy unit tests (P1-7).
 *
 * Transpiles the REAL services/analytics.ts with tsc and exercises its pure
 * logic in node: event allowlisting, prop scrubbing (PII patterns dropped,
 * long strings truncated, non-primitives dropped), and event shape.
 * Storage/network paths are not exercised here (they need AsyncStorage and
 * a Supabase project).
 *
 * Usage: node scripts/check-analytics.js   (or: npm run check:analytics)
 * Exit code 0 = all pass, 1 = failure.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'analytics-test-'));

function build() {
  // Standalone tsc knows neither require nor the RN globals; stub them.
  fs.writeFileSync(
    path.join(TMP, 'rn-stub.d.ts'),
    'declare const require: any;\n',
  );
  let out = '';
  try {
    out = execSync(
      `npx -y -p typescript@5 tsc ${path.join(ROOT, 'services', 'analytics.ts')}` +
        ` ${path.join(TMP, 'rn-stub.d.ts')}` +
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
    console.error(`[check-analytics] FAIL: ${name}`);
    process.exit(1);
  }
  passed++;
  console.log(`[check-analytics] ok: ${name}`);
}

function main() {
  build();
  const a = require(path.join(TMP, 'analytics.js'));

  // --- allowlist ---
  assert(a.isAllowedEvent('app_open') === true, 'allowlist: app_open');
  assert(a.isAllowedEvent('ghost_mode_toggled') === true, 'allowlist: ghost_mode_toggled');
  assert(a.isAllowedEvent('detector_lab_opened') === true, 'allowlist: detector_lab_opened');
  assert(a.isAllowedEvent('transcript_text') === false, 'allowlist: transcript_text rejected');
  assert(a.isAllowedEvent('') === false, 'allowlist: empty rejected');

  // --- buildEvent ---
  const evt = a.buildEvent('app_open', { source: 'cold_start' });
  assert(evt !== null && evt.name === 'app_open', 'buildEvent: allowed event built');
  assert(evt.props.source === 'cold_start', 'buildEvent: props kept');
  assert(typeof evt.ts === 'string' && !Number.isNaN(Date.parse(evt.ts)), 'buildEvent: ISO timestamp');
  assert(a.buildEvent('evil_event') === null, 'buildEvent: unknown name -> null');

  // --- scrubProps: PII dropped ---
  const scrubbed = a.scrubProps({
    phone: '+1 (555) 123-4567',
    digits: 'call 5551234567 now',
    email: 'user@example.com',
    ok_bool: true,
    ok_num: 42,
    ok_str: 'settings',
    nested: { a: 1 },
    list: [1, 2],
    fn: () => {},
  });
  assert(!('phone' in scrubbed), 'scrub: phone-like string dropped');
  assert(!('digits' in scrubbed), 'scrub: digit-run string dropped');
  assert(!('email' in scrubbed), 'scrub: email dropped');
  assert(!('nested' in scrubbed) && !('list' in scrubbed) && !('fn' in scrubbed), 'scrub: non-primitives dropped');
  assert(scrubbed.ok_bool === true && scrubbed.ok_num === 42 && scrubbed.ok_str === 'settings', 'scrub: safe primitives kept');

  // --- scrubProps: truncation ---
  const long = a.scrubProps({ v: 'x'.repeat(200) });
  assert(long.v.length === 64, 'scrub: strings truncated to 64 chars');

  // --- scrubProps: empty/undefined ---
  assert(Object.keys(a.scrubProps(undefined)).length === 0, 'scrub: undefined -> empty');

  // --- async surface exists and is safe without native modules ---
  assert(typeof a.trackEvent === 'function', 'trackEvent exported');
  assert(typeof a.initAnalytics === 'function', 'initAnalytics exported');
  assert(typeof a.setAnalyticsEnabled === 'function', 'setAnalyticsEnabled exported');

  console.log(`[check-analytics] PASS (${passed} assertions)`);
}

try {
  main();
} catch (e) {
  console.error(`[check-analytics] FAIL: ${e && e.stack ? e.stack : e}`);
  process.exit(1);
}
