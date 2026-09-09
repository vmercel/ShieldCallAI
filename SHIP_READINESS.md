# ShieldCall — Ship Readiness Assessment & Completion Checklist

**Assessment Date:** 2026-07-25
**Verdict: NOT READY TO SHIP**

---

## Brutally Honest Assessment

The app has a solid visual foundation and some genuinely clever engineering (SENTINEL NLP engine, AcousticSentinel, Ghost Mode architecture). But it has **at least a dozen hard blockers** that would result in App Store rejection, a lawsuit, or a security breach — and several fundamental honesty problems where the app claims capabilities it does not have.

Here is what is actually broken, in order of severity:

### CRITICAL — Will cause App Store rejection or legal liability

1. **In-App Purchase is completely missing.** The upgrade modal literally tells users to email `contact@callshield.ai` for pricing. Apple will reject any app with paid plans that does not use StoreKit. This is a binary rejection. No IAP = no App Store approval.

2. **No Privacy Policy or Terms of Service anywhere in the app.** Both the App Store and Play Store require a linked privacy policy. The app processes microphone audio, contacts, and call metadata — this is highly sensitive. You will be rejected without this.

3. **Call recording/transcription legal consent is absent.** Recording or transcribing phone calls without disclosure violates ECPA at the federal level and two-party consent laws in 13 US states (California, Florida, Illinois, etc.). Users are never told their calls are being transcribed. The onboarding has no legal consent screen. This is lawsuit exposure, not just a policy issue.

4. **`react-native-callkeep` is not in `package.json`.** The `callKitService.ts` does a runtime `require('react-native-callkeep')` but the package is not declared as a dependency. The build will succeed only because the try/catch silently fails — meaning CallKit, the core iOS integration, does **not work**. The entire native call interception feature is broken.

5. **The .env file is committed to git.** The `.gitignore` excludes `.env*.local` but not `.env`. Your Supabase URL and anon key are in version history. Rotate those keys immediately, then fix the gitignore.

6. **DEEPGRAM_API_KEY and ONSPACE_AI_API_KEY are not configured anywhere visible.** The edge functions that power live transcription (Deepgram) and Ghost Mode AI responses silently fall back to no-ops when these keys are missing. The two headline features of the app — real-time transcription and AI ghost calling — are both silently non-functional without these secrets being set in Supabase's edge function environment.

### HIGH — Will cause user distrust, bad reviews, or regulatory issues

7. **The app claims "All audio processing is on-device" but this is false.** The onboarding and privacy section both state audio never leaves the device. In reality, audio chunks are uploaded to a Supabase Edge Function which sends them to Deepgram's cloud API for transcription, and conversation text is sent to an external AI API (OnSpace AI / Gemini) for Ghost Mode. This is a deceptive data practice. Fix the copy to be accurate — "audio is transcribed via a secure cloud service and transcripts are processed by AI." This is an App Store review guideline violation and a GDPR/CCPA issue.

8. **"Deepfake Voice Detection" is amplitude variance heuristics, not deepfake detection.** The AcousticSentinel monitors microphone dB levels for monotone cadence. This is a noise floor check — not ML-based voice synthesis detection. The label "Deepfake Voice Detection" in settings is false advertising. Rename it to "Acoustic Anomaly Detection" or something accurate.

9. **SENTINEL™ is regex pattern matching, not AI.** It is a 22-category keyword/regex scanner with a weighted scoring formula. This is a reasonable and effective approach but should not be presented as AI. If Apple or users dig into this, "AI-powered threat detection" based on regex will damage credibility. Be more accurate in copy.

10. **"Federated Learning" toggle does nothing.** The "Contribute to Model Improvement" setting claims to share "encrypted gradient updates" but there is no implementation anywhere in the codebase. This is a fake feature visible in the UI. Either implement it or remove the toggle.

11. **No data deletion flow.** GDPR and CCPA both require users to be able to request deletion of their data. There is no "Delete my account" or "Delete my data" option in Settings.

12. **The settings footer says "CALLSHIELD v1.0 Prototype."** This is shipping in the UI. "Prototype" is not language that belongs in a production app.

### MEDIUM — Will cause bad UX, crashes, or review flags

13. **`package.json` name is `"onspace-app"`.** This is a template artifact. It affects EAS build metadata, OTA updates, and Expo project identity.

14. **Dependency bloat is extreme and likely causes build failures.** The package.json includes Apollo Client, GraphQL, Redux, React Native Maps, React Native WebRTC, `snack-content`, `expo-manifests`, `react-native-fade-in-image`, `react-native-infinite-scroll-view`, and dozens of other packages that are not imported anywhere in the app code. This inflates the bundle by tens of megabytes and likely causes native build errors due to conflicting native modules.

15. **DEMO_INCOMING hardcoded in `calls.tsx`.** There is a `DEMO_INCOMING` array defined in the Calls tab with fake IRS scam calls. The demo UI exists but this should be removed or gated for production.

16. **"Open iOS Settings" text in Settings is not platform-conditional.** Android users see "Open iOS Settings." This is a basic platform check that is missing.

17. **No proper app icon set.** The app uses `logo.png` for all icon contexts. App Store requires icons at 1024x1024 (no alpha channel), and Play Store requires adaptive icon layers. Using a single PNG file will produce blurry icons on high-DPI devices and likely fail automated store checks.

18. **PushKit (VoIP push) is not integrated.** CallKit on iOS requires PushKit for reliable background call delivery. Without PushKit, the app cannot receive incoming call notifications when backgrounded. The entitlement is declared but no PushKit registration or handler exists.

19. **No EAS build configuration.** There is no `eas.json`. Without it, producing a production-signed build for either store is manual and error-prone.

20. **No crash reporting or analytics.** No Sentry, Bugsnag, or Expo error reporting. You will be flying blind post-launch.

---

## Completion Checklist

### PHASE 1 — Legal & Compliance Blockers (must complete before any submission)

- [x] **Write and host a Privacy Policy.** Deployed as Supabase Edge Function at `https://cnrgrivqmuivxpnstaom.supabase.co/functions/v1/privacy`. Covers data collected, cloud providers (Deepgram, AI), retention periods, GDPR/CCPA rights, and call recording consent notice.
- [x] **Write and host Terms of Service / EULA.** Deployed as Supabase Edge Function at `https://cnrgrivqmuivxpnstaom.supabase.co/functions/v1/terms`. Includes acceptable use, call recording law notice (Section 7), limitation of liability, and subscription terms.
- [x] **Add Privacy Policy and Terms links to the onboarding screen** (before the user creates an account). Added to sign-up screen and consent screen.
- [x] **Add Privacy Policy and Terms links to Settings screen.** Added Legal section with Privacy Policy, Terms of Service, and Support links.
- [x] **Add explicit call recording/transcription consent screen.** Added a full "Call Analysis Disclosure" screen in the onboarding flow between persona selection and permissions.
- [x] **Fix deceptive privacy copy.** Removed all claims of "audio never leaves your device." Replaced with accurate language in onboarding and settings.
- [x] **Add "Delete My Data" option to Settings.** Added "Delete Account" row that deletes call_records and profile, then signs out.
- [ ] **Add GDPR/CCPA banner for first launch** (or embed consent in onboarding) if targeting EU or California users.
- [ ] **Consult a lawyer about call recording laws.** The app transcribes live calls. Many states require all-party consent. At minimum, the app must warn users to check their local laws, or require the user to notify callers that the call may be monitored.
- [x] **Rename "Deepfake Voice Detection" to "Acoustic Anomaly Detection"** in Settings. Updated label and description.
- [ ] **Remove or clearly label the "SENTINEL™ AI" marketing.** Disclose that real-time analysis uses pattern matching; AI refers to the Ghost Mode LLM responses, not the threat scoring engine.

### PHASE 2 — Hard Build & Feature Blockers

- [x] **Add `react-native-callkeep` to `package.json` dependencies.** Run `pnpm add react-native-callkeep` and add the required plugin configuration to `app.json`.
- [x] **Configure CallKit plugin in `app.json`** under `plugins` with app name and entitlements.
- [ ] **Set DEEPGRAM_API_KEY in Supabase Edge Function secrets.** Go to Supabase Dashboard > Edge Functions > Secrets and add the key. Without it, all native transcription silently returns empty strings.
- [ ] **Set ONSPACE_AI_API_KEY (or GEMINI_API_KEY) in Supabase Edge Function secrets.** Without it, Ghost Mode AI returns nothing.
- [ ] **Implement In-App Purchases using `expo-in-app-purchases` or `react-native-iap`.** Create the following IAP products in App Store Connect and Google Play Console:
  - `callshield_plus_monthly` — $6.99/month
  - `callshield_family_monthly` — $12.99/month
- [ ] **Wire the Upgrade buttons to the real IAP purchase flow.** Remove the "email us" upgrade modal entirely.
- [ ] **Implement server-side purchase receipt validation** via a Supabase Edge Function that verifies App Store/Play Store receipts and updates the `plan` column in the user profile.
- [ ] **Add a "Restore Purchases" button** to Settings. Required by App Store guidelines.
- [x] **Fix `.gitignore` to exclude `.env`.** Add `.env` to `.gitignore`. Then rotate Supabase anon key immediately (it is already in git history).
- [x] **Rename `package.json` `name` field** from `"onspace-app"` to `"callshield"`.
- [x] **Remove unused dependencies.** Removed 30+ unused packages including `@apollo/client`, `graphql`, `react-redux`, `redux`, `redux-thunk`, `react-native-maps`, `react-native-webrtc`, `snack-content`, and more.
- [x] **Create `eas.json`** with `development`, `preview`, and `production` build profiles. Configure `ios.distribution: store` and `android.buildType: app-bundle` for production.
- [ ] **Implement PushKit registration for iOS VoIP.** Without PushKit, CallKit cannot reliably display incoming calls when the app is backgrounded. This requires a native module or a package like `react-native-voip-push-notification`.
- [x] **Remove or gate `DEMO_INCOMING` data** from `calls.tsx`. Removed hardcoded fake IRS scam calls and the "Simulate Incoming" button.
- [x] **Remove or implement the Federated Learning toggle.** Removed the fake toggle and the `federatedLearning` setting entirely.
- [x] **Fix "Open iOS Settings" label** to be platform-conditional — shows "Open iOS Settings" on iOS, "Open Android Settings" on Android.

### PHASE 3 — App Store Submission Requirements

- [ ] **Generate proper app icons.** Create a 1024x1024 PNG (no alpha, no transparency) for App Store, a 512x512 for Play Store, and adaptive icon foreground/background layers for Android. Update `app.json` to reference these.
- [ ] **Generate proper splash screen.** Current splash uses `logo.png` without proper sizing for all device classes.
- [ ] **Write App Store metadata:**
  - App name (decide: "CallShield" vs "CALLSHIELD")
  - Subtitle (30 chars max)
  - Description (4000 chars max)
  - Keywords (100 chars max)
  - What's New text
  - Support URL (must be live)
  - Privacy Policy URL (must be live)
  - Marketing URL (optional)
- [ ] **Complete App Store privacy nutrition label** (Data Safety). You will need to disclose:
  - Audio data collected and sent to cloud
  - Name and email collected
  - Phone number collected
  - Contact list accessed
  - Usage data (call records) stored
  - Whether data is used for tracking
- [ ] **Complete Google Play Data Safety questionnaire.** Equivalent to above for Android.
- [ ] **Set app age rating correctly.** App processes voice data and financial information. The App Store rating should be 4+ or 12+ depending on content. Play Store rating should reflect no adult content but sensitive data use.
- [ ] **Register an Apple Developer account** (if not done) and create an App ID with these capabilities enabled:
  - Push Notifications
  - CallKit / VoIP
  - Sign In with Apple (if you add social auth)
- [ ] **Create App Store Connect app record** with bundle ID `com.callshield.app`.
- [ ] **Create Google Play Console app record** with package `com.callshield.app`.
- [ ] **Configure Android keystore** and store signing config in EAS credentials.
- [ ] **Configure iOS provisioning profiles and certificates** via EAS credentials or manually.
- [ ] **Submit for App Store review** — expect 2-5 business days. Have reviewer notes ready explaining the microphone usage, call analysis, and transcription model.
- [ ] **Submit for Play Store review** — typically faster (1-3 days) but Data Safety section must be complete.

### PHASE 4 — Production Quality

- [ ] **Integrate crash reporting** (Sentry recommended — `sentry-expo` package). This is essential for diagnosing post-launch issues.
- [ ] **Add analytics** to understand which features are used (Posthog, Amplitude, or Mixpanel — avoid GA4 for audio apps due to GDPR complexity).
- [ ] **Set up backend rate limiting** on Edge Functions. The `ghost-ai` and `transcribe-audio` functions have no rate limiting — they will be abused and run up your bill.
- [ ] **Add proper error states to all screens.** Several screens show generic loading states but no meaningful error messages when network fails or auth expires.
- [ ] **Wire up the AI Dialer tab** (`dialer.tsx`) properly — verify it is functional or hide the tab until it is.
- [ ] **Add an in-app App Store rating prompt** using `expo-store-review` (already in dependencies). Trigger after 3 analyzed calls, not on first launch.
- [x] **Remove "Prototype" from the version footer** in Settings. Changed to "CALLSHIELD v1.0.0".
- [ ] **Decide on company branding.** The app alternates between "CallShield," "CALLSHIELD," and "OnSpace AI." Choose one and make it consistent across all UI, metadata, and legal documents.
- [ ] **Test on physical devices**, not simulators. CallKit, microphone access, and VoIP push do not work reliably on simulators.
- [ ] **Test on Android physical device.** The Android telecom/ConnectionService integration via react-native-callkeep behaves differently than iOS CallKit and needs independent validation.
- [ ] **Load test the edge functions** before launch. Simultaneous Ghost Mode sessions could overwhelm Supabase compute limits on the free/pro tier.

---

## Summary Scorecard

| Area | Status |
|------|--------|
| Core UI / Screens | Solid — most screens render and are well designed |
| Authentication (Supabase Auth) | Functional |
| SENTINEL NLP Engine | Functional (but mislabeled as "AI") |
| AcousticSentinel | Functional if microphone permission is granted |
| Ghost Mode AI | Broken — ONSPACE_AI_API_KEY not set |
| Live Transcription | Broken — DEEPGRAM_API_KEY not set, callkeep missing |
| CallKit Integration | Dependency installed and configured — requires native build to test |
| Subscriptions / IAP | Completely missing — App Store rejection guaranteed |
| Privacy Policy | Links added to app — policy page must be hosted at callshield.ai/privacy |
| Call Recording Consent | Consent screen added to onboarding flow |
| Data Deletion | Delete My Data added to Settings |
| App Icons | Inadequate |
| Production Secrets | Not configured |
| Security | .env committed to git |
| Dependency Health | Very poor — ~40 unused packages |

**Estimated work to ship:** 4-8 weeks of focused engineering, plus 1-2 weeks for legal review and store submission.

The app is a compelling prototype with real innovation in the detection pipeline. The path to shipping is straightforward but cannot be shortcut — the IAP requirement and call recording consent requirement in particular are non-negotiable.
