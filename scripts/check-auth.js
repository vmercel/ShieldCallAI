#!/usr/bin/env node
/**
 * Auth flow checks for ShieldCallAI.
 *
 * Transpiles the REAL services/authUtils.ts with tsc and exercises its pure
 * logic in node: email normalization, OTP format gating, password-pair
 * validation, dev-tester env gating, and deep-link classification.
 * The no-dummy-session guarantee, the insert-only profile rule, and the UI
 * wiring are checked statically against the real sources.
 *
 * Usage: node scripts/check-auth.js   (or: npm run check:auth)
 * Exit code 0 = all pass, 1 = failure.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-test-'));

function build() {
  // Standalone tsc knows neither require nor the RN globals; stub them.
  fs.writeFileSync(
    path.join(TMP, 'rn-stub.d.ts'),
    'declare const require: any;\ndeclare const process: any;\ndeclare const __DEV__: boolean;\n',
  );
  let out = '';
  try {
    out = execSync(
      `npx -y -p typescript@5 tsc ${path.join(ROOT, 'services', 'authUtils.ts')}` +
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
    console.error(`[check-auth] FAIL: ${name}`);
    process.exit(1);
  }
  passed++;
  console.log(`[check-auth] ok: ${name}`);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function main() {
  build();
  const u = require(path.join(TMP, 'authUtils.js'));

  // --- email normalization ---
  assert(u.normalizeEmail('  User@Example.COM ') === 'user@example.com', 'email: trim+lowercase');
  assert(u.normalizeEmail('a@b.co') === 'a@b.co', 'email: already clean');

  // --- OTP format gate (must match the 6-digit boxes and mailer_otp_length) ---
  assert(u.OTP_CODE_LENGTH === 6, 'otp: code length is 6');
  assert(u.isValidOtpFormat('123456') === true, 'otp: 6 digits accepted');
  assert(u.isValidOtpFormat(' 123456 ') === true, 'otp: surrounding whitespace tolerated');
  assert(u.isValidOtpFormat('12345') === false, 'otp: 5 digits rejected');
  assert(u.isValidOtpFormat('1234567') === false, 'otp: 7 digits rejected');
  assert(u.isValidOtpFormat('12345678') === false, 'otp: 8 digits rejected (old backend length)');
  assert(u.isValidOtpFormat('abcdef') === false, 'otp: letters rejected');
  assert(u.isValidOtpFormat('') === false, 'otp: empty rejected');

  // --- password pair validation ---
  assert(u.validatePasswordPair('secret1', 'secret1') === null, 'password: matching pair ok');
  assert(u.validatePasswordPair('short', 'short') === 'Password must be at least 6 characters.',
    'password: min length enforced');
  assert(u.validatePasswordPair('secret1', 'secret2') === 'Passwords do not match.',
    'password: mismatch reported');

  // --- dev tester env gating ---
  assert(u.isDevTesterConfigured({ EXPO_PUBLIC_DEV_TEST_EMAIL: 't@x.co', EXPO_PUBLIC_DEV_TEST_PASSWORD: 'pw' }) === true,
    'devtester: configured when both vars set');
  assert(u.isDevTesterConfigured({ EXPO_PUBLIC_DEV_TEST_EMAIL: 't@x.co' }) === false,
    'devtester: missing password -> not configured');
  assert(u.isDevTesterConfigured({}) === false, 'devtester: empty env -> not configured');
  assert(u.isDevTesterConfigured({ EXPO_PUBLIC_DEV_TEST_EMAIL: '  ', EXPO_PUBLIC_DEV_TEST_PASSWORD: 'pw' }) === false,
    'devtester: blank email -> not configured');

  // --- deep-link classification ---
  const rec = u.classifyAuthDeepLink('shieldcallai://reset-password?code=abc123');
  assert(rec.kind === 'recovery' && rec.code === 'abc123', 'deeplink: recovery with code');
  const rec2 = u.classifyAuthDeepLink('shieldcallai://reset-password');
  assert(rec2.kind === 'recovery' && rec2.code === undefined, 'deeplink: recovery without code');
  const legacy = u.classifyAuthDeepLink('shieldcallai://reset-password?type=recovery&code=z9');
  assert(legacy.kind === 'recovery' && legacy.code === 'z9', 'deeplink: legacy type=recovery marker');
  const confirm = u.classifyAuthDeepLink('shieldcallai://?code=pkce-code-1');
  assert(confirm.kind === 'session-code' && confirm.code === 'pkce-code-1', 'deeplink: confirmation code');
  assert(u.classifyAuthDeepLink('shieldcallai://live-call').kind === 'none', 'deeplink: non-auth link ignored');
  assert(u.classifyAuthDeepLink(null).kind === 'none', 'deeplink: null -> none');
  assert(u.classifyAuthDeepLink('not a url at all').kind === 'none', 'deeplink: garbage -> none');

  // --- no dummy auth anywhere (static) ---
  assert(!fs.existsSync(path.join(ROOT, 'services', 'labAuth.ts')), 'dummy: services/labAuth.ts deleted');
  const ctx = read('contexts/AuthContext.tsx');
  assert(!/labAuth|isLabEmail|isLabOtp|isLabPassword|signInLabTester|LAB_USER|labMode|lab-local/.test(ctx),
    'dummy: no lab references left in AuthContext');
  assert(!/access_token:\s*['"]lab/.test(ctx), 'dummy: no fabricated access tokens');
  assert(!/as\s+Session/.test(ctx), 'dummy: no Session casts (nothing hand-built)');
  const onboarding = read('app/onboarding.tsx');
  assert(!/labAuth|LAB_OTP|signInLabTester|lab tester/i.test(onboarding),
    'dummy: no lab references left in onboarding');
  const layout = read('app/_layout.tsx');
  assert(!/labAuth|signInLabTester/i.test(layout), 'dummy: no lab references in root layout');

  // --- dev tester is real auth, __DEV__-gated (static) ---
  assert(/if\s*\(!__DEV__\)/.test(ctx), 'devtester: signInDevTester refuses non-dev builds');
  assert(/supabase\.auth\.signInWithPassword/.test(ctx), 'devtester: uses real signInWithPassword');
  assert(ctx.includes('process.env[DEV_TEST_EMAIL_VAR]'), 'devtester: email from env, never hardcoded');
  assert(ctx.includes('process.env[DEV_TEST_PASSWORD_VAR]'), 'devtester: password from env, never hardcoded');
  assert(/__DEV__ && isDevTesterConfigured\(\)/.test(onboarding), 'devtester: UI button hidden unless configured');

  // --- isAuthenticated derives from the Supabase session only ---
  assert(/isAuthenticated:\s*!!session,/.test(ctx), 'auth: isAuthenticated is !!session, no bypass flag');

  // --- profile creation is insert-only (static) ---
  assert(/ignoreDuplicates:\s*true/.test(ctx), 'profile: ensureProfile uses insert-only upsert');
  assert(!/\.upsert\(row, \{ onConflict: 'id' \}\)/.test(ctx), 'profile: no blind overwrite upsert');

  // --- OTP verify path (static) ---
  assert(/type:\s*'signup'/.test(ctx), 'otp: verifyOtp uses type signup');
  assert(/isValidOtpFormat\(token\)/.test(ctx), 'otp: format gate before network call');
  assert(/type:\s*'signup'/.test(ctx) && /supabase\.auth\.resend/.test(ctx), 'otp: resend uses type signup');

  // --- sign-up confirmation link returns to the app (static) ---
  assert(/emailRedirectTo:\s*Linking\.createURL/.test(ctx), 'signup: emailRedirectTo deep link set');

  // --- signOut always clears local state (static) ---
  assert(/finally\s*\{[\s\S]*?setSession\(null\)/.test(ctx), 'signout: local state cleared in finally');

  // --- deep-link handler uses the classifier and logs failures (static) ---
  assert(layout.includes('classifyAuthDeepLink'), 'layout: handleAuthUrl uses classifyAuthDeepLink');
  assert(/exchangeCodeForSession\(classified\.code\)/.test(layout), 'layout: PKCE code exchanged');
  assert(/console\.warn\('\[auth\] exchangeCodeForSession failed/.test(layout),
    'layout: exchange failures logged, not swallowed');
  assert(/router\.push\('\/reset-password'\)/.test(layout), 'layout: recovery links route to reset-password');

  // --- errors surface real messages (static) ---
  assert(!/catch\s*\{\s*\}/.test(ctx), 'errors: no empty catch blocks in AuthContext');

  // --- .env.example documents the dev account without credentials ---
  const example = read('.env.example');
  assert(example.includes('EXPO_PUBLIC_DEV_TEST_EMAIL='), 'env: dev test email documented');
  assert(example.includes('EXPO_PUBLIC_DEV_TEST_PASSWORD='), 'env: dev test password documented');
  assert(!/EXPO_PUBLIC_DEV_TEST_PASSWORD=\S+/.test(example), 'env: no credential value in the template');

  console.log(`[check-auth] PASS (${passed} assertions)`);
}

try {
  main();
} catch (e) {
  console.error(`[check-auth] FAIL: ${e && e.stack ? e.stack : e}`);
  process.exit(1);
}
