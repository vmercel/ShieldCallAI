# ShieldCall v1 — product lock

Owner decisions. Do not reopen these in implementation.

## What v1 is

A free iOS/Android app. One job: while a call is on speaker, this phone listens on its microphone, scores scam language, warns on screen, never hangs up, never joins the carrier call.

Brand: **ShieldCall**. Not CALLSHIELD, not OnSpace.

## In v1

- Live Protect (consent, OS speech recognition, SENTINEL, fusion, optional LAN sidecar)
- Onboarding: what it does, all-party consent, privacy + terms links
- Settings: legal links, delete local data, microphone
- Guest use: Protect must work without a paid plan and without a working Deepgram/Claude key
- Honest copy everywhere

## Out of v1 (hide, do not delete)

- Ghost Mode
- AI Dialer tab
- CallKit / incoming-call intercept
- In-app purchases (app is free; no paywall, no “email for pricing”)
- Federated learning, “audio never leaves the device” if untrue
- Chrome Detector Lab as the user path (keep for engineers under Settings → Research if needed)

## Store

- Free app. No IAP products.
- Privacy Policy and Terms must be HTTPS URLs plus in-app screens.
- Bundle id stays `com.shieldcallai.app`.
- Local proof before any EAS production build: unit tests + web or simulator smoke of Live Protect.

## Local proof bar

1. `npx tsx services/fusion.test.ts` passes.
2. Sentinel scores a known scam sentence above warn threshold and a dentist reminder below it.
3. Live Protect screen renders, consent required before mic, start/stop does not crash on web.
4. Sidecar optional: app works if `127.0.0.1:8765` is down (fail-open).
