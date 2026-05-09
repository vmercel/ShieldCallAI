# CALLSHIELD — Application Assessment Report

**Date:** May 2026 (Updated after pull 784d13a)
**Scope:** Full codebase review for production-readiness, functionality completeness, and UX quality
**Stack:** React Native / Expo (SDK 53) · Supabase Backend · OnSpace AI (Gemini Flash) · Claude claude-3-5-haiku-20241022 · TypeScript

---

## Changelog from Previous Assessment

This update reflects 20 files changed in the latest pull (+3,529 / -1,165 lines). Key additions:

| New File | Purpose |
|---|---|
| `components/ErrorBoundary.tsx` | React error boundary with retry recovery |
| `components/PermissionsScreen.tsx` | Onboarding permissions request screen |
| `hooks/useCallKit.ts` | iOS CallKit integration hook |
| `hooks/usePermissions.ts` | Centralized permission lifecycle hook |
| `services/callKitService.ts` | iOS CallKit / Android Telecom via react-native-callkeep |
| `services/contactsService.ts` | Real device contacts via expo-contacts + fallback |
| `services/permissionsService.ts` | Permission management + push notifications + scam alerts |
| `supabase/functions/sentinel-analysis/index.ts` | Claude-powered AI SENTINEL edge function |

---

## Executive Summary

CALLSHIELD has advanced significantly in this pull. The most critical gaps from the initial assessment have been addressed at the infrastructure layer: error boundaries are in place, settings now persist, profile editing works, push notification infrastructure is built, the permissions lifecycle is handled, real device contacts are supported, and a new Claude AI-powered SENTINEL edge function is deployed. CallKit service scaffolding is present but not yet integrated into call screens, and native STT remains the last critical blocker for real-world use.

---

## 1. FULLY IMPLEMENTED

### 1.1 Authentication System
- Email/password sign-up with OTP email verification (Supabase Auth)
- 6-digit OTP screen with auto-advance, backspace handling, countdown timer, resend
- Sign-in screen with error handling
- **Forgot Password screen** — fully implemented (`ForgotPasswordScreen` component, uses `supabase.auth.resetPasswordForEmail`)
- Session persistence via AsyncStorage (native) / localStorage (web)
- App-state-aware token refresh (pauses when backgrounded)
- `AuthContext` exposes full session, profile, and all auth methods
- Profile stored in `user_profiles` Supabase table

### 1.2 Onboarding Flow
- Three-slide feature carousel — now **swipe-enabled** (`scrollEnabled` fixed from previous version)
- Sign-up → OTP → Persona selection → **Permissions screen** → main app
- Forgot Password accessible from sign-in screen
- AI Voice Persona selection (5 names) persisted to Supabase profile
- Ghost Mode auto-enabled on activation
- `PermissionsScreen` component requests microphone, contacts, and notifications on iOS with status feedback

### 1.3 App Bootstrap / Error Handling
- **`ErrorBoundary` wraps the entire app** (previously absent) — catches uncaught render exceptions, shows branded recovery screen with "Try Again"
- **Branded loading screen** during `AuthContext` session recovery (previously a blank screen)
- `AppInitializer` in `_layout.tsx` runs on native startup:
  - Calls `setupCallKit()` to initialize CallKit
  - Pre-warms contacts cache with `getAllContacts()`
  - Calls `registerPushToken()` if notification permission already granted

### 1.4 SENTINEL™ NLP Engine (`services/sentinelEngine.ts`)
- 22-category scam taxonomy with pattern-weighted linguistic markers
- Multi-pattern regex scan with TF-IDF normalization
- Bayesian probability combination across categories
- Rising trajectory 4× multiplier — core differentiator
- Peak-score ratchet (70% floor of historical peak)
- Cumulative full-text re-analysis for accurate context

### 1.5 Claude AI SENTINEL Edge Function (`supabase/functions/sentinel-analysis/index.ts`) — NEW
- **New edge function powered by Claude claude-3-5-haiku-20241022**
- Receives 10-second transcript chunk + full call context (conversation history, acoustic data, community spam count)
- Returns structured JSON: riskScore, riskLevel, callerType, callerTypeConfidence, contentVerdict, contentVerdictConfidence, spamAssociated, flags, factChecks, scamType, trajectoryLabel, confidenceLabel, reasoning
- Implements peak ratchet rule server-side (score cannot drop more than 15% from peak)
- Analyzes 20 threat pattern categories explicitly
- JSON parse safety: fallback result on parse failure
- Score safety clamping applied before response
- Integrated into `live-call.tsx` via `supabase.functions.invoke('sentinel-analysis')`

### 1.6 AcousticSentinel™ (`services/acousticSentinel.ts`)
- Real microphone amplitude metering via `expo-av` Recording API
- Amplitude variance analysis, silence pattern detection, peak amplitude tracking
- Cadence regularity score and deepfake confidence estimate
- Composite 70% NLP + 30% acoustic threat score

### 1.7 Ghost Mode AI (`app/ghost-mode.tsx` + `hooks/useGhostMode.ts`)
- Full conversational AI powered by OnSpace AI edge function (Gemini Flash)
- TTS voice output via `expo-speech`
- Intelligence dashboard, Expose Mode, session end persistence
- SENTINEL™ analysis on each caller turn

### 1.8 Live Call Analysis Screen (`app/live-call.tsx`)
- Batch-based analysis — now optionally calls `sentinel-analysis` edge function (Claude AI) in addition to local NLP
- Real-time threat score meter and waveform visualizer
- Manual text input fallback for native
- Auto-save call record to Supabase on end
- AI call summary generation on end
- Speaker-tagged transcript display

### 1.9 Live Transcription (`hooks/useLiveTranscription.ts`)
- Web Speech API in continuous mode with auto-restart
- Speaker turn detection via 800ms pause heuristic
- Manual segment injection for native fallback

### 1.10 Push Notifications Infrastructure (`services/permissionsService.ts`) — NEW
- `Notifications.setNotificationHandler` configured with sound, badge, banner
- `sendScamAlertNotification()` — schedules immediate local notification with threat-level-appropriate title, body, and badge
  - Used in `incoming-call.tsx` when a threat is detected
- `registerPushToken()` — requests Expo push token, configures Android notification channels (callshield-alerts, callshield-calls)
- Called from `_layout.tsx` on app start and from `incoming-call.tsx`
- Permission status checks before sending
- `usePermissions` hook for full permission lifecycle management

### 1.11 Permissions Lifecycle (`services/permissionsService.ts` + `hooks/usePermissions.ts`) — NEW
- `checkAllPermissions()` — queries contacts, notifications status
- `requestAllPermissions()` — sequential request for contacts + notifications with iOS-specific allowCriticalAlerts
- `requestContactsPermission()` / `requestNotificationsPermission()` — individual permission requests
- `werePermissionsRequested()` — AsyncStorage-backed one-time request tracking
- `usePermissions` hook with loading state, allGranted, needsRequest flags

### 1.12 Real Device Contacts (`services/contactsService.ts`) — NEW
- Loads contacts from device via `expo-contacts` with 60-second cache
- Web fallback: returns static mock contacts
- Permission-denied fallback: returns 4 static mock contacts
- `getAllContacts()`, `searchContacts()`, `findContactByNumber()`, `findContactByName()`
- Sync versions (`findContactByNumberSync`) for use where async is inconvenient
- Multi-number support (secondary/work numbers)
- Deterministic avatar color from name hash

### 1.13 CallKit Service (`services/callKitService.ts` + `hooks/useCallKit.ts`) — NEW
- `callKitService.ts` wraps `react-native-callkeep` with graceful no-ops when unavailable
- `setupCallKit()`, `displayIncomingCall()`, `startOutgoingCall()`, `answerCall()`, `endCall()`, `endAllCalls()`
- `setMuted()`, `setOnHold()`, `reportCallConnected()`, `reportCallEnded()`
- `registerCallKitEvents()` with full event handler map (answer, end, mute, hold, start, DTMF)
- Web platform no-ops prevent crashes
- `useCallKit` hook manages active call state, mute/hold toggles, event cleanup
- **Called from `_layout.tsx` on native startup** for early initialization
- Note: `react-native-callkeep` is not in `package.json` — the service gracefully no-ops in managed Expo workflow

### 1.14 Settings Persistence (`app/(tabs)/settings.tsx`) — IMPROVED
- **All 5 toggles now persist to AsyncStorage** via `SETTINGS_KEY`:
  - `deepfakeDetect`, `communityFeed`, `quietHours`, `autoScreenUnknown`, `federatedLearning`
- `loadSettings()` and `saveSettings()` with JSON serialization and defaults merge
- Settings loaded on mount, saved on every toggle change

### 1.15 Profile Editing (`app/(tabs)/settings.tsx`) — NEW
- **`EditProfileModal`** allows editing full name and phone number
- Changes saved to Supabase via `updateProfile()` from AuthContext
- Email shown as read-only with "contact support" note
- Inline error display for save failures

### 1.16 Subscription Upgrade Modal (`app/(tabs)/settings.tsx`) — IMPROVED
- "Upgrade to Plus" / "Upgrade to Family" buttons now open an **`UpgradeModal`**
- Modal shows feature list for selected plan and contact email for early access
- Replaces the previous non-functional buttons

### 1.17 Permissions Display in Settings — NEW
- Settings screen loads and displays current permission statuses (contacts, notifications, microphone)
- Quick-link to iOS Settings for denied permissions

### 1.18 Call Records — CRUD + Statistics
- Full Supabase CRUD, pull-to-refresh, stats computation — unchanged and solid

### 1.19 Call Detail Screen (`app/call-detail.tsx`)
- Block/Unblock, FTC report, transcript replay, share/export — unchanged and solid

### 1.20 Calls Screen, Insights Screen
- Real Supabase data, filtering, search, threat taxonomy explorer — unchanged and solid

### 1.21 AI Dialer Screen (`app/(tabs)/dialer.tsx`)
- AI Agent, Keypad, Voice Command, Contacts tabs — unchanged and solid

### 1.22 Home Screen (`app/(tabs)/index.tsx`) — IMPROVED
- Comment confirms "100% real data. No simulations, no mocks, no demos"
- SENTINEL Demo widget removed (was a demo; now home is purely real data)
- `useAuth` added for profile context

### 1.23 Incoming Call Screen (`app/incoming-call.tsx`) — IMPROVED
- Now calls `sendScamAlertNotification()` when threat level is danger/warning
- Users receive a persistent notification for scam calls detected at incoming screen

### 1.24 App Infrastructure
- Expo Router with tab + stack navigation
- `AppContext` for ghost mode, persona, onboarding state
- `AuthContext` for full Supabase session management
- Consistent dark design system
- Platform-safe code throughout

---

## 2. PARTIALLY IMPLEMENTED

### 2.1 CallKit — Service Built, Not Integrated into Screens
- **What works:** `callKitService.ts` and `useCallKit.ts` are complete. `setupCallKit()` is called on native startup. The service gracefully no-ops if `react-native-callkeep` isn't installed.
- **What's missing:**
  1. `react-native-callkeep` is **not in `package.json`** — needs a bare workflow or dev client build to install.
  2. `useCallKit` hook is defined but **not used in `live-call.tsx` or `incoming-call.tsx`**. The screens do not call `displayIncomingCall()`, `startOutgoingCall()`, `answerCall()`, or `endCall()` through CallKit.
  3. No PushKit integration (required for CallKit to wake app for inbound calls when backgrounded).
- **Impact:** High. CallKit infrastructure is in place but not connected to the call flow.

### 2.2 Live Transcription on Native
- **What works:** AcousticSentinel provides real mic amplitude monitoring; SENTINEL NLP works on typed text; Claude sentinel-analysis edge function available.
- **What's missing:** Actual speech-to-text on iOS/Android. `useLiveTranscription` still notes "no text transcription on native." Manual text entry required.
- **Impact:** Critical. Core feature requires manual input on mobile.

### 2.3 Ghost Mode — Voice Input
- **What works:** AI responds correctly, TTS speaks responses, session analysis works.
- **What's missing:** Caller audio not automatically transcribed — user must type what the caller says.
- **Impact:** High for real-world use.

### 2.4 Incoming Call Detection
- **What works:** `incoming-call.tsx` is fully built, connected to push notifications, and sends scam alerts.
- **What's missing:** No mechanism to detect or intercept actual incoming phone calls. Demo-only entry. CallKit service not yet connected.
- **Impact:** Critical.

### 2.5 Settings Toggles — Persisted But Not Behavioral
- **What works:** `deepfakeDetect`, `communityFeed`, `quietHours`, `autoScreenUnknown`, `federatedLearning` now persist to AsyncStorage across sessions.
- **What's missing:** None of these settings affect any app behavior. Disabling `deepfakeDetect` does not stop `AcousticSentinel`. Enabling `quietHours` does not change call routing. `autoScreenUnknown` does not activate Ghost Mode for unknown callers.
- **Impact:** Medium — settings are saved but effectively decorative.

### 2.6 Push Notifications — Local Only, No Remote Push
- **What works:** Local notifications fire from `sendScamAlertNotification()` in `incoming-call.tsx`. Android channels configured. Expo push token requested via `registerPushToken()`.
- **What's missing:**
  1. Push token is not sent to the server (no endpoint to store it in Supabase).
  2. No remote push for background call alerts — only local/foreground notifications work.
  3. `projectId: 'callshield'` in `getExpoPushTokenAsync` needs to match the real Expo project ID.
- **Impact:** Medium — local scam alerts work, server-initiated alerts do not.

### 2.7 Subscription / Payment
- **What works:** Upgrade Modal opens with feature list and contact email.
- **What's missing:** No Stripe integration, no payment flow, no plan-gating. `@stripe/stripe-react-native` in `package.json` but unused.
- **Impact:** Medium for monetization readiness.

### 2.8 Call Summary Edge Function
- **What works:** `call-summary` edge function called on call end, summary/aiNotes/scamType stored.
- **What's missing:** `actionItems` field returned by the function has no display surface in the UI.
- **Impact:** Low.

### 2.9 Timeline in Call Detail
- **What works:** `ThreatTimeline` renders a bar chart.
- **What's missing:** Data is from `ThreatService.simulateCallProgression()` (mock random-walk), not real per-window scores.
- **Impact:** Low-medium.

---

## 3. NOT IMPLEMENTED (Critical Gaps)

### 3.1 Real Telephony Integration
- **Description:** CallKit service and hook exist but `react-native-callkeep` is not in `package.json` and the hook is not wired into call screens. No SIP/VoIP integration, no PushKit for background wakeup.
- **Impact:** Critical. Without connection, CALLSHIELD cannot process real phone calls.
- **Path forward:** (1) Add `react-native-callkeep` to `package.json`, (2) wire `useCallKit` into `live-call.tsx` and `incoming-call.tsx`, (3) add PushKit integration for background wakeup.

### 3.2 Native Speech-to-Text
- **Description:** No `expo-speech` recognition or third-party STT (Deepgram, AssemblyAI, on-device Whisper) for iOS/Android automatic transcription.
- **Impact:** Critical. Real-time SENTINEL analysis on native requires real speech → text pipeline.
- **Path forward:** Integrate streaming STT service. The new `sentinel-analysis` edge function is already designed to accept text chunks.

### 3.3 Background Call Processing
- **Description:** No `expo-task-manager` or background fetch configured. App must be foregrounded.
- **Impact:** Critical for a call protection app.

### 3.4 Number Blocking Enforcement
- **Description:** `blockedNumbersService` stores blocked numbers in Supabase but no OS-level blocking is implemented (`CXCallDirectoryExtension` on iOS, `BlockedNumberContract` on Android).
- **Impact:** High. Blocking is "soft."

### 3.5 Push Token Not Stored Server-Side
- **Description:** `registerPushToken()` obtains an Expo push token but does not store it in Supabase. Remote push notifications (e.g., scam alerts when app is not open) cannot be sent.
- **Impact:** High.

### 3.6 Auto-Screen Unknown Callers
- **Description:** Toggle exists in settings, now persisted, but no logic routes calls from unknown numbers through Ghost Mode automatically.
- **Impact:** High.

### 3.7 Quiet Hours Enforcement
- **Description:** Toggle exists and now persists, but no time-based logic, no `expo-task-manager` schedule.
- **Impact:** Medium.

### 3.8 Deepfake Detection Toggle
- **Description:** Setting persists but does not stop `AcousticSentinel` from running or hide deepfake confidence in the UI.
- **Impact:** Low-medium.

### 3.9 Family / Multi-User Dashboard
- **Description:** Family plan feature is listed in the Upgrade Modal. No screen, no multi-user linking.
- **Impact:** Medium for plan credibility.

### 3.10 Federated Learning
- **Description:** Toggle persists but no encrypted gradient transmission or federated ML infrastructure.
- **Impact:** Low — aspirational feature.

### 3.11 Error Boundaries on Individual Screens
- **Description:** `ErrorBoundary` wraps the entire app in `_layout.tsx`. Individual tabs and screens have no per-section boundaries — a crash in one tab will affect the whole app.
- **Impact:** Low — whole-app boundary is a strong baseline.

### 3.12 Offline Mode / Network Error States
- **Description:** Network failure returns empty states without explicit "no network" messages. App does not degrade gracefully when Supabase is unreachable.
- **Impact:** Medium.

### 3.13 App Icon and Splash Screen
- **Description:** `app.json` not updated from Expo defaults. No custom app icon or branded splash screen.
- **Impact:** Medium for App Store submission readiness.

---

## 4. UX / QUALITY ISSUES

### 4.1 Ghost Mode and Live Call Manual Entry (Highest Priority)
- Both screens require typing what the caller says in real-time. Unusable in real calls without native STT.

### 4.2 Settings Toggles Have No Effect
- 5 toggles persist their state but control no behavior. Users who turn off "Deepfake Detection" will still see deepfake scores.

### 4.3 "On-Device Processing Only" Badge Remains Misleading
- Ghost Mode and call summaries send data to cloud (Supabase Edge Functions). This badge should be qualified ("NLP analysis only" or removed until fully true).

### 4.4 Push Token Project ID
- `getExpoPushTokenAsync({ projectId: 'callshield' })` uses a generic project ID. Must match the real Expo project ID (`app.json` slug/EAS project ID) for push to work.

### 4.5 Community Impact Section in Call Detail (Hardcoded)
- "2.8k+ reports" for danger calls and savings values are hardcoded, not from real data.

### 4.6 Onboarding Slide Swipe — Fixed
- Previously noted as disabled. Now `scrollEnabled` is `true` with `onMomentumScrollEnd` syncing `slideIndex`. Fixed.

### 4.7 Cold Start Blank Screen — Fixed
- Previously noted. Now `AuthLoadingGate` shows a branded loading screen. Fixed.

### 4.8 Error Boundaries — Fixed
- Previously absent. `ErrorBoundary` now wraps the full app. Fixed.

### 4.9 Settings Not Persisted — Fixed
- Previously noted. All 5 settings now persist via AsyncStorage. Fixed (persistence only, behavior pending).

### 4.10 Profile Editing — Fixed
- Previously absent. `EditProfileModal` now allows editing name + phone. Fixed.

### 4.11 Forgot Password — Fixed
- Previously absent. `ForgotPasswordScreen` with `resetPasswordForEmail` now fully implemented. Fixed.

### 4.12 Real Device Contacts — Fixed
- Previously mock-only. `contactsService.ts` now loads real device contacts via `expo-contacts`. Fixed.

### 4.13 No Accessibility (a11y) Support
- No `accessibilityLabel`, `accessibilityRole`, or `accessibilityHint` props on interactive elements.

### 4.14 Package Bloat
- 130+ dependencies including many unused: `@apollo/client`, `graphql`, `react-redux`, `redux`, `react-native-maps`, `@shopify/react-native-skia`, `expo-gl`, `react-native-webrtc` (not yet used), `snack-content`. Significantly inflates build size.

---

## 5. SECURITY CONSIDERATIONS

### 5.1 `.env` File in Repo
- A `.env` file is present at the root. If it contains real credentials and is committed, this is a critical security issue.

### 5.2 Supabase Row-Level Security
- The client relies on RLS policies. `call_records`, `blocked_numbers`, and `community_threats` must have RLS enabled or any authenticated user can read all data.

### 5.3 Ghost AI Prompt Injection
- Caller input text goes directly to the AI prompt without sanitization. A sophisticated attacker could craft inputs to manipulate AI behavior.

### 5.4 Push Token Not Secured
- Expo push token generation uses `projectId: 'callshield'` which may not match the actual EAS project. Token not stored server-side anyway, so server-to-device push is not possible yet.

---

## 6. DELTA FROM PREVIOUS ASSESSMENT

| Item | Before | After |
|---|---|---|
| Error boundaries | Not implemented | Fully implemented (app-level) |
| Cold start blank screen | Present | Fixed (branded loading screen) |
| Settings persistence | Not implemented | Implemented (AsyncStorage) |
| Profile editing | Not implemented | Implemented |
| Forgot Password | Not implemented | Implemented |
| Push notification infrastructure | Not implemented | Partially implemented (local only) |
| Real device contacts | Not implemented | Implemented |
| Permission request screen | Not implemented | Implemented (in onboarding) |
| CallKit service | Not implemented | Service + hook built, not yet connected |
| AI SENTINEL cloud analysis | Local NLP only | Claude edge function deployed + integrated |
| Upgrade modal | Non-functional buttons | Modal with contact info |
| Onboarding slide swipe | Disabled | Fixed |
| Settings toggles affecting behavior | Not implemented | Still not implemented (saved but ignored) |

---

## 7. PRIORITY ROADMAP (Updated)

| Priority | Item | Status | Effort |
|---|---|---|---|
| P0 | Native STT integration (Deepgram/AssemblyAI) | Not started | High |
| P0 | Add `react-native-callkeep` to package.json + bare workflow | Not started | Medium |
| P0 | Wire `useCallKit` into live-call + incoming-call screens | Not started | Medium |
| P1 | Store push token in Supabase user profile | Not started | Low |
| P1 | Connect settings toggles to actual behavior | Not started | Medium |
| P1 | Background call processing (PushKit + expo-task-manager) | Not started | Very High |
| P1 | Fix push projectId to match real EAS project | Not started | Low |
| P2 | OS-level call blocking (CXCallDirectoryExtension) | Not started | High |
| P2 | Stripe subscription integration | Not started | High |
| P2 | App icon and splash screen | Not started | Low |
| P2 | Per-screen error boundaries | Partial | Low |
| P2 | Remove "On-Device Processing Only" misleading badge | Not started | Low |
| P3 | Auto-screen unknown callers logic | Not started | High |
| P3 | Quiet hours enforcement | Not started | Medium |
| P3 | Real per-window score persistence for timeline | Not started | Low |
| P3 | Offline / network error states | Not started | Medium |
| P3 | Accessibility labels | Not started | Medium |
| P3 | Dependency cleanup (remove unused packages) | Not started | Low |

---

## 8. SUMMARY TABLE (Current State)

| Feature Area | Status | Notes |
|---|---|---|
| Authentication (sign-up, OTP, sign-in, sign-out, forgot password) | Fully implemented | Production-quality |
| Onboarding flow (slides, auth, persona, permissions) | Fully implemented | Swipe fixed |
| Error boundary | Fully implemented | App-level, no per-screen |
| Branded loading screen | Fully implemented | — |
| SENTINEL™ NLP Engine | Fully implemented | Sophisticated |
| Claude AI SENTINEL edge function | Fully implemented | Deployed, integrated in live-call |
| AcousticSentinel™ | Fully implemented | Real mic metering |
| Push notification infrastructure (local) | Partially implemented | Token not stored server-side |
| Real device contacts | Fully implemented | expo-contacts + fallback |
| Permission lifecycle | Fully implemented | Request + status display |
| Settings persistence | Fully implemented | Persisted but not behavioral |
| Profile editing | Fully implemented | Name + phone editable |
| Ghost Mode (manual input) | Fully implemented | Simulation mode |
| Ghost Mode (auto voice intercept) | Not implemented | Requires native STT + telephony |
| Ghost AI Edge Function | Fully implemented | Gemini Flash, contextually adaptive |
| Live Call Analysis (web) | Fully implemented | Web Speech API + Claude edge fn |
| Live Call Analysis (native) | Partially implemented | Manual text entry only |
| Incoming Call screen | Partially implemented | Demo only + scam notification |
| CallKit service | Partially implemented | Built but not in package.json, not wired |
| Call Records (CRUD + stats) | Fully implemented | Supabase backed |
| Call Detail Screen | Fully implemented | Timeline uses mock scores |
| Community Threats | Fully implemented | Real DB, report flow works |
| Blocked Numbers | Partially implemented | DB only, no OS blocking |
| AI Dialer (AI Agent) | Fully implemented | Edge function works |
| AI Dialer (Voice Command) | Partially implemented | Web only |
| Insights Screen | Fully implemented | Real stats |
| Subscription / Payments | Partially implemented | Modal with contact info, no Stripe |
| Family Dashboard | Not implemented | — |
| OS-level Call Blocking | Not implemented | — |
| Background Processing | Not implemented | — |
| Auto-screen unknown callers | Not implemented | Setting saved, no logic |
| Quiet hours | Not implemented | Setting saved, no logic |
| Accessibility | Not implemented | — |
