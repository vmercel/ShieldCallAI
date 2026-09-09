# ShieldCall v1 - store listing

Use this copy in App Store Connect and Google Play Console. The app is **free**. There are **no in-app purchases**.

Brand: **ShieldCall**. Bundle ID: `com.shieldcallai.app`.

## Identity

| Field | Value |
| --- | --- |
| App name | ShieldCall |
| Subtitle (30 chars max) | Live scam language warnings |
| Primary category | Utilities |
| Secondary category | Lifestyle |
| Price | Free |
| IAP | None |
| Age rating | 4+ (no objectionable content; processes voice during a consented session) |

Subtitle character count: 27.

## URLs (paste into App Store Connect / Play Console)

Host `public/privacy.html` and `public/terms.html` over HTTPS before submission. Until a custom domain is live, these GitHub URLs are HTTPS and match the files in this repo:

| Purpose | URL |
| --- | --- |
| Privacy Policy | https://github.com/vmercel/CallShield/blob/main/public/privacy.html |
| Terms of Use (EULA) | https://github.com/vmercel/CallShield/blob/main/public/terms.html |
| Support | https://github.com/vmercel/CallShield/issues |
| Marketing (optional) | leave blank |

In-app screens (expo-router): `/privacy` (`app/privacy.tsx`) and `/terms` (`app/terms.tsx`).

Standalone files: `public/privacy.html`, `public/terms.html`. Expo web static export serves them at `/privacy.html` and `/terms.html`.

Preferred custom-domain paths once hosted: `https://<your-domain>/privacy.html` and `https://<your-domain>/terms.html`. Then replace the GitHub URLs above.

## Promotional text (170 chars max, optional)

Analyze this phone while you talk. Tiles slide in every chunk: AI or human, scam or genuine, likelihood.

Count: 104.

## Description (App Store, 4000 chars max)

ShieldCall analyzes the conversation on this phone while the call is ongoing. A summary tile slides in every chunk: AI or human voice, scam or genuine, and likelihood.

How it works

1. Place or answer the call through ShieldCall (AI Dialer or incoming).
2. Stay on the live-call screen on this same phone.
3. Confirm you are allowed to analyze the call.
4. Every analyzed chunk slides in a tile: voice type, content verdict, likelihood, flags.

It is recommend-only. It never hangs up for you. It is not a wiretap.

What v1 includes

• Live Protect: same-phone in-call analysis, optional OS speech-to-text, SENTINEL scoring, sliding chunk tiles
• Guest use: Protect works without a paid plan
• Optional LAN sidecar: if you run a detector on your local network, transcript text can be sent there. If the sidecar is down, the app keeps working
• Privacy Policy and Terms in the app

What v1 is not

• Not a certified fraud, deepfake, or identity product
• Not a guarantee you will catch every scam
• Not an in-call hang-up button
• Not a subscription. The app is free. There are no in-app purchases

Speech recognition

If you enable listening, ShieldCall may use the operating system's speech recognizer. Apple or Google may receive audio if the OS sends it. We do not claim on-device-only processing. You can type a sentence you heard if speech recognition is unavailable.

Your legal duty

You must have the legal right to analyze the call. Where the law requires every party to consent, you must have that consent. ShieldCall does not obtain consent from the other party for you.

Privacy in one line

Microphone for same-phone live analysis. Optional OS speech-to-text. Optional LAN sidecar. No carrier intercept. We do not sell your data.

## Keywords (100 chars max, no spaces after commas)

scam,fraud,call,protect,voice,warning,phone,safety,alert,live,sentinel,elderly

Count: 82.

Do not include competitor names. Do not include "free" as a keyword.

## What's New (1.0.0)

First public release of ShieldCall. Same-phone live analysis with sliding chunk tiles: AI vs human, scam vs genuine, likelihood. Recommend-only. Free. No in-app purchases.

## App Privacy (Apple) / Data Safety (Google)

Disclose what the binary can actually do. Do not claim on-device-only audio.

### Tracking

- Does not track users
- Not used for advertising
- Data is not sold
- NSPrivacyTracking: false

### Data collected

| Type | Collected? | Linked to identity? | Used for tracking? | Purpose |
| --- | --- | --- | --- | --- |
| Audio (microphone) | Yes, while Live Protect is listening | No for guest use. Account email is separate if the user signs in | No | App functionality (same-phone live analysis and optional OS speech-to-text) |
| User content (transcript text, scores) | Yes, on device for the session | No unless the user saves history to an account | No | App functionality |
| Contact info (name, email) | Only if the user creates an account | Yes | No | Account |
| Contacts | Only if the user grants the contacts permission. Not required for Live Protect | On device | No | App functionality (caller labeling) |
| Diagnostics | Not in v1 | n/a | n/a | n/a |
| Location | No | n/a | n/a | n/a |
| Financial info | No | n/a | n/a | n/a |
| Purchase history | No (app is free, no IAP) | n/a | n/a | n/a |

### Data sharing

| Recipient | What | When |
| --- | --- | --- |
| Apple (iOS speech) and/or Google (Android speech) | Microphone audio | If the user starts listening and the OS speech recognizer is used. Sharing is dictated by the OS, not by a ShieldCall server |
| Optional LAN sidecar the user runs | Transcript text | Only if the user has a sidecar on the local network. Fail-open if it is down |
| Supabase (auth/backend) | Account fields | Only if the user signs in |
| ShieldCall | We do not sell personal information | Never |

Apple "Data Used to Track You": none.

Apple "Data Linked to You": name/email only if the user creates an account.

Apple "Data Not Linked to You": audio processed for Live Protect; on-device transcripts.

Google Play Data Safety:

- Collected: audio, app activity (session scores), optional personal info if signed in
- Shared: audio may be processed by the OS speech service (Apple or Google). Optional local-network sidecar
- Encrypted in transit: yes for account traffic (HTTPS)
- Users can request deletion: yes (Settings → Delete My Data, or email privacy@shieldcallai.com)
- Sold: no
- Optional: microphone, speech recognition, local network, contacts

## Permissions copy (must match app.json)

- Microphone: ShieldCall uses the microphone to analyze this phone's conversation while a call is ongoing so it can warn you about scams.
- Speech recognition: ShieldCall uses the operating system's speech recognition to transcribe this phone's live conversation so it can score scam language. Audio may be sent to Apple or Google as your OS dictates.
- Local network: ShieldCall may connect to an optional detector sidecar on your local network. The app works if that sidecar is not running.

## Reviewer notes

Paste into App Store Connect "Notes" and Play Console "Review notes".

What this app is

ShieldCall v1 is same-phone live analysis. The user places or answers through ShieldCall, stays on the live-call screen, and sees a sliding tile every chunk: AI vs human voice, scam vs genuine, likelihood. It never hangs up for the user.

What this app is not

It is not a silent tap of the cellular radio. The call is analyzed because it runs through ShieldCall on this phone (AI Dialer / incoming / CallKit).

How to review (no paid account, no IAP, no demo login required)

1. Install the build. Guest use is allowed.
2. Open Live Protect (Shield tab or Settings → Research → Live Protect).
3. Read the consent line. Enable the consent switch. The Start button stays inactive until consent is on.
4. Grant microphone and speech recognition when prompted.
5. Tap Start listening. Speak a known scam sentence (example: "I am calling from the IRS. There is a warrant. Pay with gift cards now."). The on-screen action should move toward WARN.
6. Speak a dentist reminder (example: "Hi, this is a reminder that your cleaning is tomorrow at 2."). The score should stay low.
7. Tap Stop listening. The call path was never touched.
8. If speech recognition is unavailable on the review device, type a sentence into the text field. Scoring still runs.
9. Open Privacy Policy and Terms of Use in the app.

Sidecar

The detector sidecar at 127.0.0.1:8765 is optional. Do not fail the review if nothing is listening on that port. The app is designed to fail-open.

IAP

There are no in-app purchases and no subscription. Ignore leftover upgrade UI on older screens if it appears. It is not an offer to buy.

Export compliance

ITSAppUsesNonExemptEncryption is false (HTTPS only).

Contact for review

privacy@shieldcallai.com

## Screenshots (notes for capture)

Capture Live Protect: consent switch, Start listening, MONITOR/WARN card, meters, transcript. Do not screenshot Ghost Mode, AI Dialer, or paywalls as the v1 story. Do not claim "on-device only" on screenshot captions.

## Checklist before submit

- [ ] Privacy and Terms HTTPS URLs load (replace GitHub blob URLs with hosted HTML if possible)
- [ ] In-app `/privacy` and `/terms` open
- [ ] App name is ShieldCall
- [ ] Bundle ID is com.shieldcallai.app
- [ ] Price is Free, IAP products are empty
- [ ] Data Safety matches this document
- [ ] 1024 icon is `assets/images/icon.png` (RGB, no alpha)
- [ ] Reviewer notes pasted
- [ ] Local proof from PRODUCT_V1.md has passed
