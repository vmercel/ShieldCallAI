# Store listing metadata + privacy label drafts (P1-10)

> **DRAFT. Not filed anywhere.** Every `[TBD]` below is a decision or asset
> still needed before submission. Brand decided 2026-09-13 under P1-9:
> the product is **ShieldCall AI** (project: ShieldCallAI). No claim in this
> file invents users, ratings, revenue, or awards.

## 1. App Store metadata draft

| Field | Draft value |
|---|---|
| App name | ShieldCall AI |
| Subtitle (30 chars max) | AI call screening & scam defense |
| Category (primary) | Utilities |
| Category (secondary) | Productivity |
| Age rating | 4+ (no objectionable content; requires honest answers in App Store Connect) |
| Copyright | `[TBD, e.g. 2026 Vubangsi Mercel]` |
| Support URL | `[TBD, required]` |
| Marketing URL | `[TBD, optional]` |
| Privacy Policy URL | `[TBD, required]` ,  the in-app policy (`app/privacy.tsx`, `public/privacy.html`) must be hosted at a public URL first |

### Description draft (4,000 chars max)

> ShieldCall AI screens your unknown calls with on-device AI so you never have
> to pick up for a stranger again.
>
> When an unknown number calls, ShieldCall AI answers on your behalf, carries a
> natural screening conversation, and shows you a live transcript with a
> scam-risk score. Legitimate callers get through. Robocalls, scammers, and
> telemarketers get handled without ever ringing your phone.
>
> - Live screening: unknown callers talk to the AI while you read the transcript in real time
> - Scam detection: calls are scored for scam language as they happen
> - Ghost Mode: an AI voice agent that can hold a full conversation with the caller
> - Spam and scam call log with transcripts you can review anytime
> - Your contacts always ring straight through
>
> Your audio is used only to screen your calls. Transcripts stay in your
> account, analytics contain no phone numbers or audio, and crash reports
> never include your identity. See the privacy policy for details.

### Keywords (100 chars max, comma-separated, no spaces)

`call screening,scam blocker,spam call,robocall blocker,AI phone assistant`

(Count before filing; drop terms to fit 100 characters.)

### Review notes draft (for the App Review team)

> ShieldCall AI is a call-screening app. It uses CallKit/PushKit with the
> `voip` background mode so it can answer incoming calls on the user's
> behalf and screen them with an AI agent. Microphone access is used only
> during an active screened call to analyze the conversation for scam
> indicators, as described in NSMicrophoneUsageDescription. Contacts access
> is used so known contacts bypass screening, as described in
> NSContactsUsageDescription. A demo account and a test phone number the
> reviewer can call to exercise screening will be provided at submission
> time. `[TBD: create reviewer demo credentials before filing.]`

### Screenshots ,  still needed (cannot be faked)

Real screenshots from a device build, required sizes at filing time:
6.9" iPhone, 6.5" iPhone, 5.5" iPhone, and 13" iPad (supportsTablet is
currently false, so iPad screenshots may be waived, confirm in Connect).
Minimum: home/screening transcript view, live scam-score view, Ghost Mode
view, call-log view. App preview video: optional, skip for v1.

## 2. Privacy nutrition label draft (App Store)

Grounded in `app.json` (`ios.privacyManifests`) plus what the code actually
does. Purposes below use Apple's label vocabulary.

| Data type (Apple label) | Linked to user | Used for tracking | Purposes | Notes |
|---|---|---|---|---|
| Audio Data | No `[verify]` | No | App Functionality | Call audio transcribed via the backend during screening. Manifest says not linked; requests are authenticated per account, so confirm with legal whether "linked" applies. |
| Phone Number | Yes | No | App Functionality | The user's own number from account/auth; screened-call metadata. |
| Email Address | Yes | No | App Functionality | Account sign-in (Supabase auth). |
| Name | Yes | No | App Functionality | Account profile, if provided. |
| Contacts | No | No | App Functionality | On-device caller matching so known contacts bypass screening. |
| User ID | Yes `[add]` | No | App Functionality, Analytics | Supabase auth user id attached to quota, analytics events. **Not currently declared in the privacy manifest ,  add before filing.** |
| Usage Data (product interaction) | Yes `[add]` | No | Analytics | Privacy-safe events only (`app_open`, `ghost_mode_toggled`, `detector_lab_opened`); no phone numbers, emails, audio, or transcripts. **Not currently declared in the manifest ,  add.** |
| Crash Data | No `[add]` | No | App Functionality | Sentry reports; `beforeSend` strips the user object, audio and transcripts are never sent. **Not currently declared ,  add.** |
| Precise/Coarse Location | ,  | ,  | ,  | Not collected. |
| Browsing/Search history | ,  | ,  | ,  | Not collected. |

Data Not Collected section: everything else, including Health, Financial
Info, and Messages content (call transcripts are Audio Data / app
functionality, not Messages).

**[TBD before filing]:** reconcile the three `[add]` rows with
`ios.privacyManifests` in `app.json`, and get the Audio Data "linked"
question answered. The label in App Store Connect must match the manifest
and the hosted privacy policy exactly.

## 3. Google Play Data safety draft

| Category | Collected | Shared | Notes |
|---|---|---|---|
| Audio (call recordings/transcripts) | Yes | Yes (Deepgram transcription processor) | Required for screening; not for advertising. |
| Personal info: name, email, phone number | Yes | No (Supabase backend is the app's own infrastructure, disclosed as service provider) | Account functionality. |
| Contacts | Yes | No | On-device matching only. |
| App activity (feature usage events) | Yes | No | Privacy-safe analytics, no PII. |
| Crash logs | Yes | Yes (Sentry processor) | No user identity attached. |
| Location | No | ,  | |
| Data is encrypted in transit | Yes | ,  | HTTPS/TLS everywhere. |
| Users can request data deletion | `[TBD]` | ,  | **Must be true at filing: implement account/data deletion before submission.** |
| Data collection is optional / opt-out | Partial | ,  | Analytics has an in-app opt-out; screening inherently requires audio. |

Play also requires: a public privacy policy URL, a Data safety form
matching the app's behavior, and (for call-log/call-screening permissions)
a prominent in-app disclosure plus a short justification video at filing.
The `READ_CALL_LOG` / `ANSWER_PHONE_CALLS` permission set will put the
listing through Play's sensitive-permissions review: keep the justification
to one sentence tied to the core feature ("screening unknown calls").

## 4. Filing blockers checklist

- [ ] P1-9: final brand name (propagates to name, subtitle, description, keywords)
- [ ] Public privacy-policy URL (host `public/privacy.html`)
- [ ] Support URL (required by both stores)
- [ ] Copyright holder string
- [ ] Reviewer demo account + test callable number
- [ ] Real device screenshots (all required sizes)
- [ ] Privacy manifest reconciliation (`[add]` rows above; Audio Data linked question)
- [ ] Account/data deletion flow (Play requirement)
- [ ] Age-rating questionnaire answers in App Store Connect
- [ ] Export compliance (`ITSAppUsesNonExemptEncryption` is already false; confirm at filing)
