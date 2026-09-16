#!/usr/bin/env node
/**
 * Consent + data-deletion unit tests (P3-1, GDPR/CCPA).
 *
 * Transpiles the REAL services/consent.ts and services/dataDeletion.ts with
 * tsc and exercises their pure logic in node: consent parsing, server
 * residual verification, and key classification. Storage/network paths are
 * not exercised here (they need AsyncStorage and a Supabase project).
 * The migration SQL and the UI wiring are checked statically.
 *
 * Usage: node scripts/check-consent.js   (or: npm run check:consent)
 * Exit code 0 = all pass, 1 = failure.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'consent-test-'));

function build() {
  // Standalone tsc knows neither require nor the RN globals; stub them.
  fs.writeFileSync(
    path.join(TMP, 'rn-stub.d.ts'),
    'declare const require: any;\n',
  );
  let out = '';
  try {
    out = execSync(
      `npx -y -p typescript@5 tsc ${path.join(ROOT, 'services', 'consent.ts')}` +
        ` ${path.join(ROOT, 'services', 'dataDeletion.ts')}` +
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
    console.error(`[check-consent] FAIL: ${name}`);
    process.exit(1);
  }
  passed++;
  console.log(`[check-consent] ok: ${name}`);
}

function main() {
  build();
  const consent = require(path.join(TMP, 'consent.js'));
  const del = require(path.join(TMP, 'dataDeletion.js'));

  // --- consent parsing: fail closed to 'unasked' ---
  assert(consent.parseConsentState('granted') === 'granted', 'consent: granted kept');
  assert(consent.parseConsentState('denied') === 'denied', 'consent: denied kept');
  assert(consent.parseConsentState(null) === 'unasked', 'consent: null -> unasked');
  assert(consent.parseConsentState(undefined) === 'unasked', 'consent: undefined -> unasked');
  assert(consent.parseConsentState('') === 'unasked', 'consent: empty -> unasked');
  assert(consent.parseConsentState('GRANT') === 'unasked', 'consent: case-sensitive, unknown -> unasked');
  assert(consent.parseConsentState('yes') === 'unasked', 'consent: foreign value -> unasked');
  assert(consent.ANALYTICS_CONSENT_KEY === 'shieldcallai_analytics_consent', 'consent: key name');

  // --- residual verification: only zeros pass ---
  const clean = {
    deleted: { analytics_events: 3, quota_rows: 2 },
    residual: { analytics_events: 0, quota_rows: 0 },
    account_deleted: true,
  };
  const r1 = del.verifyServerResiduals(clean);
  assert(r1.ok === true && r1.residualAnalyticsEvents === 0 && r1.residualQuotaRows === 0,
    'residuals: zeros verified');
  const dirty = {
    deleted: { analytics_events: 3, quota_rows: 2 },
    residual: { analytics_events: 1, quota_rows: 0 },
    account_deleted: true,
  };
  assert(del.verifyServerResiduals(dirty).ok === false, 'residuals: nonzero events -> not ok');
  const dirty2 = {
    deleted: { analytics_events: 3, quota_rows: 2 },
    residual: { analytics_events: 0, quota_rows: 5 },
    account_deleted: true,
  };
  assert(del.verifyServerResiduals(dirty2).ok === false, 'residuals: nonzero quota -> not ok');
  assert(del.verifyServerResiduals({}).ok === false, 'residuals: missing fields -> not ok');
  assert(del.verifyServerResiduals(null).ok === false, 'residuals: null -> not ok');

  // --- key classification ---
  assert(del.isShieldCallKey('shieldcallai_onboarded') === true, 'keys: shieldcallai_* matched');
  assert(del.isShieldCallKey('SHIELDCALL_GHOST') === true, 'keys: case-insensitive');
  assert(del.isShieldCallKey('shieldcall_analytics_queue') === true, 'keys: legacy shieldcall_* matched');
  assert(del.isShieldCallKey('@supabase.auth.token') === false, 'keys: supabase keys untouched');
  assert(del.isShieldCallKey('expo-constants-device-id') === false, 'keys: expo keys untouched');
  assert(del.isShieldCallKey('') === false, 'keys: empty -> false');

  // --- analytics wired to consent (static) ---
  const analyticsSrc = fs.readFileSync(path.join(ROOT, 'services', 'analytics.ts'), 'utf8');
  assert(/consentGranted\(\)/.test(analyticsSrc), 'analytics: ensureLoaded consults consent');
  assert(/setConsentState\(enabled \? 'granted' : 'denied'\)/.test(analyticsSrc),
    'analytics: setAnalyticsEnabled records consent');
  assert(/clearAnalyticsData/.test(analyticsSrc), 'analytics: clearAnalyticsData exported');
  assert(/refreshAnalyticsConsent/.test(analyticsSrc), 'analytics: refreshAnalyticsConsent exported');

  // --- migration SQL (static) ---
  const migrations = fs.readdirSync(path.join(ROOT, 'supabase', 'migrations'))
    .filter((f) => f.endsWith('.sql'));
  const delMig = migrations.filter((f) => /data_deletion/.test(f));
  assert(delMig.length === 1, 'migration: exactly one data_deletion migration');
  const sql = fs.readFileSync(path.join(ROOT, 'supabase', 'migrations', delMig[0]), 'utf8');
  const low = sql.toLowerCase();
  assert(low.includes('my_data_summary'), 'migration: my_data_summary() defined');
  assert(low.includes('delete_my_data'), 'migration: delete_my_data() defined');
  assert(low.includes('security definer'), 'migration: SECURITY DEFINER');
  assert(low.includes('auth.uid()'), 'migration: scoped to auth.uid()');
  assert(low.includes('auth.users'), 'migration: deletes the auth account');
  assert(low.includes('analytics_events') && low.includes('ai_quota_usage'), 'migration: both tables erased');
  assert(low.includes('residual'), 'migration: residual verification');
  assert(/grant execute[^;]*to authenticated/.test(low), 'migration: execute granted to authenticated');
  assert(!/grant execute[^;]*to anon/.test(low), 'migration: never granted to anon');
  assert(/revoke all[^;]*from[^;]*anon/.test(low), 'migration: revoked from anon');

  // --- UI wiring (static) ---
  const banner = fs.readFileSync(path.join(ROOT, 'components', 'ConsentBanner.tsx'), 'utf8');
  assert(banner.includes('Accept') && banner.includes('Decline'), 'banner: Accept/Decline choices');
  assert(banner.includes('setAnalyticsEnabled'), 'banner: records choice via analytics');
  const screen = fs.readFileSync(path.join(ROOT, 'app', 'delete-data.tsx'), 'utf8');
  assert(screen.includes("from '../services/dataDeletion'"), 'screen: uses the dataDeletion service');
  assert(screen.includes('deleteMyData()'), 'screen: invokes the deletion flow');
  assert(screen.includes('DELETE'), 'screen: type-to-confirm gate');
  assert(screen.includes('verifyServerResiduals') || screen.includes('residual'), 'screen: surfaces verification');
  const layout = fs.readFileSync(path.join(ROOT, 'app', 'delete-data.tsx'), 'utf8');
  assert(layout.length > 0, 'screen: file non-empty');
  const rootLayout = fs.readFileSync(path.join(ROOT, 'app', '_layout.tsx'), 'utf8');
  assert(rootLayout.includes('ConsentGate'), 'layout: ConsentGate rendered at root');
  assert(rootLayout.includes('delete-data'), 'layout: delete-data route registered');
  const settings = fs.readFileSync(path.join(ROOT, 'app', '(tabs)', 'settings.tsx'), 'utf8');
  assert(settings.includes("router.push('/delete-data'"), 'settings: Delete my data routes to the new screen');

  console.log(`[check-consent] PASS (${passed} assertions)`);
}

try {
  main();
} catch (e) {
  console.error(`[check-consent] FAIL: ${e && e.stack ? e.stack : e}`);
  process.exit(1);
}
