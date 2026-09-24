/**
 * check-device-checklist.js (P3-2)
 *
 * Static assertions over docs/device-test-checklist.md:
 * - the doc exists and covers both platforms,
 * - every shipped product surface has device cases (consent, auth, tabs,
 *   incoming call + CallKit, transcription/detector, paywall + restore,
 *   service status, data deletion, analytics consent, crash reporting,
 *   prod gating, performance, upgrade/sign-out edge cases),
 * - each case has a results column and there is a results log template,
 * - no step pretends unprovisioned pieces are testable (store products,
 *   receipt credentials, APNs/FCM secrets are called out as blockers).
 *
 * Run: npm run check:device-checklist
 */
const fs = require('fs');
const path = require('path');

const DOC = path.join(__dirname, '..', 'docs', 'device-test-checklist.md');

let passed = 0;
let failed = 0;
const failures = [];

function check(name, ok) {
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(name);
  }
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
}

const doc = fs.existsSync(DOC) ? fs.readFileSync(DOC, 'utf8') : '';
check('checklist doc exists', doc.length > 0);
if (!doc) {
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(1);
}

// Both platforms named.
check('covers iOS', /iOS/i.test(doc));
check('covers Android', /Android/i.test(doc));

// One section per shipped surface (by heading numbers in the doc).
const surfaces = {
  'fresh install and onboarding': /## 1\. Fresh install and onboarding/,
  'consent banner accept/decline': /consent banner \(Accept\)/i,
  'home/calls/dialer/insights tabs': /## 2\. Home, Calls, Dialer, Insights/,
  'incoming call + CallKit hard requirement': /## 3\. Incoming call with VoIP push and CallKit/,
  'CallKit reported before other work (iOS kill test)': /NOT be terminated by iOS/i,
  'transcription and detector behaviour': /## 4\. Live call, transcription and detector/,
  'AI quota 429 honesty': /120 req\/hour\/user/,
  'paywall and restore purchases': /## 5\. Paywall and purchases/,
  'restore with no purchases is honest': /No previous purchases were found/i,
  'service status screen': /## 6\. Service status screen/,
  'data deletion flow': /## 7\. Data deletion on a throwaway account/,
  'deletion reports success only on zero residuals': /every residual count is zero/i,
  'analytics consent toggle': /## 8\. Privacy, consent and analytics/,
  'crash reporting': /## 9\. Crash reporting/,
  'prod gating (no demo in release)': /## 10\. Production gating/,
  'Detector Lab hidden in release': /Detector Lab[^\n]*__DEV__|__DEV__[^\n]*Detector Lab/i,
  'performance and battery': /## 11\. Performance and battery/,
  'upgrade and sign-out edge cases': /## 12\. Update and edge cases/,
};
for (const [name, re] of Object.entries(surfaces)) {
  check(`section: ${name}`, re.test(doc));
}

// Results logging contract.
check('every case row has a Result column', (doc.match(/\| Result \|/g) || []).length >= 12);
check('results log section exists', /## Results log/i.test(doc));
check('open defects table exists', /Open defects/i.test(doc));

// Honesty about what cannot be tested yet.
check('store products blocker named', /shieldcall_pro_monthly/.test(doc) && /shieldcall_family_monthly/.test(doc));
check('receipt-validation credentials blocker named', /APPLE_IAP_ISSUER_ID/.test(doc));
check('APNs/FCM provisioning blocker named', /FCM service account/i.test(doc));
check('credentials/ CSR finding referenced', /voip-cert-request\.csr/i.test(doc));
check('no case pretends Expo Go covers native paths', /Expo Go and simulators do not exercise/i.test(doc));

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log('Failures:');
  failures.forEach((f) => console.log(` - ${f}`));
  process.exit(1);
}
