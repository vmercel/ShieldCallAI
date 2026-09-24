# Physical-device test checklist (P3-2)

Ground truth for the pre-launch device pass on iOS and Android. Run on real
hardware only: Expo Go and simulators do not exercise PushKit, CallKit,
in-app purchases, or background VoIP delivery. Each case has a results row;
log every run in the Results log section at the end.

## Test matrix

| # | Device | OS version | Build type | Tester | Date |
|---|--------|------------|------------|--------|------|
| 1 | iPhone | iOS __ | EAS dev build / TestFlight | | |
| 2 | Android | Android __ | EAS dev build / internal track | | |

Build identifier under test: ______________ (git SHA ______________).

## Before you start

1. Use a throwaway test account (vmercel test credentials), never Mercel's
   production account, especially for the data-deletion cases.
2. Note that the store products `shieldcall_pro_monthly` and
   `shieldcall_family_monthly` are not yet created in App Store Connect or
   Google Play Console (P1-1 remainder). Paywall cases marked [STORE PENDING]
   can only be exercised once they exist; until then verify the honest
   "not available" state instead.
3. Store API credentials for `validate-receipt` are not yet provisioned
   (P1-2 remainder), so paid purchases validate on-device only and retry in
   the background; entitlements stay device-local until the server confirms.
4. VoIP push needs the APNs VoIP capability + auth key (iOS) and the FCM
   service account (Android) provisioned by Mercel (P1-4 remainder). Where
   they are missing, verify the fail-closed behaviour instead of the happy path.

## How to mark results

`PASS` / `FAIL` / `N/A` (with reason). A FAIL must name the expected vs actual
behaviour and, if possible, the steps to reproduce. Paste the results rows
into the Results log at the end of this file, one table per run.

---

## 1. Fresh install and onboarding (both platforms)

| ID | Steps | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| 1.1 | Install fresh build, launch cold | Splash renders, then onboarding flow starts | | |
| 1.2 | Walk through onboarding screens to the end | No crash, copy reads correctly on small screens, no text clipping | | |
| 1.3 | First launch consent banner (Accept) | Blocking overlay appears before any analytics fires; Accept dismisses it and records consent | | |
| 1.4 | Reinstall fresh, first launch, Decline on the banner | App still works; nothing queued to analytics (verify with the network log or the service-status screen, no events row appears for this install) | | |
| 1.5 | Grant/deny each permission prompt in turn (microphone, contacts, notifications, phone) | Permissions screen explains why; denying any permission keeps the app usable with that feature degraded, and shows how to re-enable | | |
| 1.6 | Create account / sign in | Auth succeeds, session persists across app restarts | | |
| 1.7 | Kill the app and relaunch | Lands on the home tab signed in; no second consent banner, no re-onboarding | | |

## 2. Home, Calls, Dialer, Insights tabs (both platforms)

| ID | Steps | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| 2.1 | Home tab loads | Real call history and threat summary; NO fabricated demo calls or mock contacts anywhere | | |
| 2.2 | Calls tab: open a past call | Call detail screen shows real data, no placeholder rows | | |
| 2.3 | Dialer tab: place an outbound call to a known-safe number | Call goes out through the device phone app; ShieldCall records the attempt | | |
| 2.4 | Android only: answer the "set as default dialer" prompt (Accept then Decline variants) | Accept sets ShieldCall as default; Decline keeps the system dialer and the app works normally | | |
| 2.5 | Insights tab | Real community threat data renders; empty states are honest, not zero-filled fakes | | |
| 2.6 | Rotate device / split-screen (Android) | No layout breakage, no clipped text on any tab | | |

## 3. Incoming call with VoIP push and CallKit (the hard requirement)

| ID | Steps | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| 3.1 | [STORE PENDING] Trigger an incoming call via the `voip-push` edge function from a second test account [service role] | Push arrives within seconds on a locked device | | |
| 3.2 | iOS, app killed: trigger incoming call | iOS shows the NATIVE CallKit incoming-call screen (lock screen + banner). The app must NOT be terminated by iOS, which proves CallKit was reported before any other work (P1-4 hard requirement) | | |
| 3.3 | Accept from CallKit | Routes into `/incoming-call` with the SENTINEL pre-screen dossier and contact lookup | | |
| 3.4 | Decline from CallKit | Call dismisses cleanly; no orphaned CallKit entries, no stuck ringing state | | |
| 3.5 | Trigger incoming call, then answer with Ghost Mode | Ghost AI answers and responds; transcription appears in the live-call screen | | |
| 3.6 | Sign out, then attempt a self-targeted VoIP push | 403; one user can only ring their own devices | | |
| 3.7 | Uninstall, reinstall, sign in on a new device | Stale token from the old install is deleted server-side after APNs 410 / BadDeviceToken (check the voip_tokens table has one row) | | |
| 3.8 | APNs/FCM secrets missing (current state): trigger a push | `voip-push` returns 503 fail-closed, app reports the unconfigured state honestly on the service-status screen; no silent success | | |

## 4. Live call, transcription and detector behaviour (both platforms)

| ID | Steps | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| 4.1 | During an active call, speak for 60 seconds | `transcribe-audio` returns transcripts; visible added latency is acceptable (design target: near-real-time, RTT plus ~55 ms pump) | | |
| 4.2 | Watch the detector tier/risk/fraud indicators during the call | Tiers change on real signal, never on a timer; verdicts reference what was actually said | | |
| 4.3 | Airplane mode mid-call setup | Call recording/transcription fails with an honest offline message; nothing is queued as if sent | | |
| 4.4 | Exceed the AI quota on a test account (120 req/hour/user) | 429 with a Retry-After hint and an honest "try again later" message, not a generic error | | |

## 5. Paywall and purchases (both platforms)

| ID | Steps | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| 5.1 | [STORE PENDING] Settings > Plans > upgrade, buy Pro monthly with a sandbox account | Purchase completes, receipt finishes, tier badge updates to Pro; no duplicate charges | | |
| 5.2 | [STORE PENDING] Buy Family monthly with a second sandbox account | Same as 5.1, Family tier shown | | |
| 5.3 | Settings > Restore purchases (sandbox account WITH a prior purchase) | Purchase restored, tier badge updates; activity indicator shown during the restore; repeat taps disabled | | |
| 5.4 | Settings > Restore purchases (sandbox account with NO purchases) | Honest message: "No previous purchases were found for this store account". A paid plan is never granted. | | |
| 5.5 | Store products NOT configured (current state): open the paywall | Cards say the products are not available yet; no Buy button is offered that cannot work | | |
| 5.6 | Kill the app mid-purchase, relaunch, then restore | Pending receipt validates on the next attempt; entitlement matches the store, never the client's claim | | |
| 5.7 | Terms and Privacy links on the paywall | Both open the correct documents | | |

## 6. Service status screen (both platforms)

| ID | Steps | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| 6.1 | Settings > Legal > Service status | All six probes report ok/degraded/down with latency; pull-to-refresh updates them | | |
| 6.2 | VoIP push probe row | Reports the unconfigured state honestly while APNs/FCM secrets are missing (currently expected: configured = false) | | |
| 6.3 | Airplane mode, then refresh | Probes show down, not stale green badges; recovery when the network returns | | |

## 7. Data deletion on a throwaway account (GDPR/CCPA right to erasure)

Use ONLY a throwaway test account. Deleting a real account is irreversible.

| ID | Steps | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| 7.1 | Settings > Delete my data: review screen | Summary lists exactly what will be deleted (analytics events, quota rows, account) | | |
| 7.2 | Type a wrong confirmation word | Deletion refuses to start; the button stays safe | | |
| 7.3 | Type DELETE and confirm | Server RPC deletes the rows, re-counts residuals, deletes the auth account; the screen reports success ONLY when every residual count is zero, and shows a deletion receipt | | |
| 7.4 | After deletion, try to sign in with the same credentials | Sign-in fails: the account is really gone | | |
| 7.5 | Guest (never signed in): run local data deletion | Local-only data is wiped and the wipe is verified; no server call is attempted | | |

## 8. Privacy, consent and analytics (both platforms)

| ID | Steps | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| 8.1 | Settings: toggle analytics off | Unsent queue is dropped; no further events recorded (verify no new rows for this install) | | |
| 8.2 | Toggle analytics back on | Recording resumes only from that point; nothing backfilled | | |
| 8.3 | Check the privacy nutrition label claims against behaviour | Everything the app collects is declared; nothing collected is undeclared (User ID, Usage Data, Crash Data were the known gaps, now declared per docs/store-metadata.md) | | |

## 9. Crash reporting (dev builds)

| ID | Steps | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| 9.1 | Force a test crash in the dev build | Crash reaches the Sentry project (javascript-react) with the event accepted; no PII in the payload (phone numbers, emails stripped) | | |
| 9.2 | Launch with no network, then crash, then reconnect | Event is buffered and delivered on reconnect, or the drop is documented | | |

## 10. Production gating: nothing demo in a release build

| ID | Steps | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| 10.1 | Release build: search every screen for demo data | No mock calls, no mock contacts, no fabricated threat rows | | |
| 10.2 | Release build: Detector Lab | Not visible (it is a `__DEV__` tool only) | | |
| 10.3 | Release build: Settings sections | No "Research" section; dev-only rows (sidecar health probe) hidden | | |

## 11. Performance and battery (both platforms)

| ID | Steps | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| 11.1 | Leave the app backgrounded for 4 hours with VoIP registered | Battery drain is in line with a normal messaging app; no runaway background task | | |
| 11.2 | Cold start timing (average of 3) | Time to interactive: ______ s. Note anything over 3 s as a FAIL to investigate | | |
| 11.3 | Scroll the Calls tab with 200+ entries | No jank, no blank rows while scrolling | | |

## 12. Update and edge cases

| ID | Steps | Expected | Result | Notes |
|----|-------|----------|--------|-------|
| 12.1 | Install the new build over the previous one (upgrade path) | Session, consent state and tier badge survive; no re-onboarding | | |
| 12.2 | Sign out | VoIP token unregistered server-side; tier badge resets to Free; no account data readable without sign-in | | |
| 12.3 | Wrong-password sign-in, expired session | Honest error messages; expired session returns to sign-in without crashing | | |

---

## Results log

One table per run. Paste the per-case rows; keep the header.

Run date: ________  Device: ________  OS: ________  Build: ________  Tester: ________

| ID | Result | Notes / defect description |
|----|--------|----------------------------|
| | | |

Open defects (carried to the backlog with severity):

| Defect | Severity | Repro | Status |
|--------|----------|-------|--------|
| | | | |

## Blockers that gate parts of this checklist

1. Physical devices in hand (iPhone + Android).
2. App Store Connect / Google Play Console products: `shieldcall_pro_monthly`, `shieldcall_family_monthly` (gates 5.1, 5.2).
3. Store API credentials for `validate-receipt`: APPLE_IAP_ISSUER_ID / APPLE_IAP_KEY_ID / APPLE_IAP_PRIVATE_KEY and GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (gates full server-side purchase verification).
4. APNs VoIP capability + .p8 auth key, FCM service account (gates 3.1-3.7 happy paths).
5. Confirm the purpose of workspace/shieldcall/credentials/voip-cert-key.pem, voip-cert-request.csr and asc-api-key.p8 (2026-09-22 finding); the CSR suggests certificate-based APNs auth, while `voip-push` currently expects the .p8 auth-key model.
