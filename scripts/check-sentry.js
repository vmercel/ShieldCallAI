#!/usr/bin/env node
/**
 * Sentry integration unit tests (P1-6).
 *
 * Transpiles the REAL services/sentry.ts with tsc and exercises its pure
 * logic in node: DSN gating, option building (env, sample rates, native),
 * the beforeSend PII scrub, and the safe no-op behavior of captureAppError
 * before init. No native SDK and no Sentry project needed.
 *
 * Usage: node scripts/check-sentry.js   (or: npm run check:sentry)
 * Exit code 0 = all pass, 1 = failure.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sentry-test-'));

function build() {
  // Standalone tsc knows neither __DEV__ nor process; stub both.
  fs.writeFileSync(
    path.join(TMP, 'rn-stub.d.ts'),
    'declare const __DEV__: boolean | undefined;\ndeclare const process: any;\n',
  );
  const src = path.join(ROOT, 'services', 'sentry.ts');
  let out = '';
  try {
    out = execSync(
      `npx -y -p typescript@5 tsc ${src} ${path.join(TMP, 'rn-stub.d.ts')}` +
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
    console.error(`[check-sentry] FAIL: ${name}`);
    process.exit(1);
  }
  passed++;
  console.log(`[check-sentry] ok: ${name}`);
}

function main() {
  build();
  const s = require(path.join(TMP, 'sentry.js'));

  // --- DSN gating ---
  assert(s.shouldInitSentry('https://abc@o1.ingest.sentry.io/1') === true, 'shouldInit: real DSN');
  assert(s.shouldInitSentry('') === false, 'shouldInit: empty -> false');
  assert(s.shouldInitSentry('   ') === false, 'shouldInit: blank -> false');
  assert(s.shouldInitSentry(undefined) === false, 'shouldInit: undefined -> false');

  // --- options ---
  const prod = s.getSentryOptions('https://abc@o1.ingest.sentry.io/1');
  assert(prod.dsn === 'https://abc@o1.ingest.sentry.io/1', 'options: DSN passed through');
  assert(prod.environment === 'production', 'options: default environment is production');
  assert(prod.tracesSampleRate === 0.2, 'options: default sample rate 0.2');
  assert(prod.enableNative === true, 'options: native crash reporting on');

  const dev = s.getSentryOptions('dsn', { isDev: true, tracesSampleRate: 1.0 });
  assert(dev.environment === 'development', 'options: dev environment');
  assert(dev.tracesSampleRate === 1.0, 'options: sample rate override');

  // --- beforeSend strips user PII ---
  assert(typeof prod.beforeSend === 'function', 'options: beforeSend present');
  const scrubbed = prod.beforeSend({
    event_id: 'e1',
    user: { id: 'u1', email: 'a@b.c' },
    message: 'boom',
  });
  assert(scrubbed.user === undefined, 'beforeSend: user object removed');
  assert(scrubbed.event_id === 'e1' && scrubbed.message === 'boom', 'beforeSend: rest of event kept');

  // --- captureAppError is a safe no-op before init ---
  assert(typeof s.captureAppError === 'function', 'captureAppError exported');
  s.captureAppError(new Error('test')); // must not throw
  s.captureAppError(new Error('test'), { screen: 'home' }); // must not throw
  assert(true, 'captureAppError: no-op before init does not throw');

  // --- initSentry without a DSN disables gracefully ---
  delete process.env[s.SENTRY_DSN_VAR];
  assert(s.initSentry() === false, 'initSentry: no DSN -> false, no throw');

  console.log(`[check-sentry] PASS (${passed} assertions)`);
}

try {
  main();
} catch (e) {
  console.error(`[check-sentry] FAIL: ${e && e.stack ? e.stack : e}`);
  process.exit(1);
}
