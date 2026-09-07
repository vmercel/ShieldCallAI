# ShieldCallAI

Application layer for a telephone impersonation warning system.

The detector lives in a separate repository: [vmercel/shieldcall-core](https://github.com/vmercel/shieldcall-core).

This repository is a research prototype. It is not a carrier product, not a certified fraud-detection service, and it does not have users or revenue.

<p align="center">
  <img src="https://img.shields.io/badge/Platform-React%20Native%20%7C%20Expo-00B4D8?style=flat-square&logo=expo&logoColor=white" />
  <img src="https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" />
  <img src="https://img.shields.io/badge/Status-research%20prototype-yellow?style=flat-square" />
</p>

## What it is

Telephone impersonation and cloned-voice fraud are not solved by a keyword list or by a voice-only classifier. ShieldCallAI is the client that sits on an authorised call. shieldcall-core is the detector.

On a live call the system:

1. Scores language for social-engineering patterns.
2. Scores telephone-bandwidth audio for synthetic or vocoded speech.
3. Fuses the two streams by disagreement rather than by averaging, so a natural voice delivering a hostile script is not recorded as a miss.
4. Warns the user. Placement is fail-open: if the detector is down, uncertain, or out of domain, the call continues.

The U.S. Federal Trade Commission reported about $3.5 billion in consumer losses to imposter scams in 2025. That is reported loss, not the full cost. This software is aimed at that class of harm. It does not claim to have prevented any of it.

## What shipped, and what did not

Shipped:

- Expo / React Native client (TypeScript)
- on-device linguistic scan
- typed sidecar client to shieldcall-core
- Detector Lab for consented live audio
- public commits on this repository (May 2026)

Did not ship:

- no carrier trial
- no paid users
- no revenue
- no UK company
- no filed patent
- no certified product

Those absences are facts, not omissions.

## Screenshots

<table>
  <tr>
    <td align="center"><strong>Shield Dashboard</strong></td>
    <td align="center"><strong>Live Call Analysis</strong></td>
    <td align="center"><strong>Ghost Mode</strong></td>
  </tr>
  <tr>
    <td><img src="assets/screenshots/screen_shield.png" width="220" /></td>
    <td><img src="assets/screenshots/screen_livecall.png" width="220" /></td>
    <td><img src="assets/screenshots/screen_ghost.png" width="220" /></td>
  </tr>
  <tr>
    <td align="center"><strong>AI Dialer</strong></td>
    <td align="center"><strong>Insights</strong></td>
    <td></td>
  </tr>
  <tr>
    <td><img src="assets/screenshots/screen_dialer.png" width="220" /></td>
    <td><img src="assets/screenshots/screen_insights.png" width="220" /></td>
    <td></td>
  </tr>
</table>

## Architecture

```
ShieldCallAI (this repo)          shieldcall-core (detector)
------------------------          --------------------------
Expo Router / React Native        dual-stream scoring
linguistic scan on device         acoustic + linguistic fusion
sidecar client                    fail-open sidecar runtime
Supabase (auth, records)          Detector Lab (consented audio)
```

The detector must not drop the call. That constraint is documented in shieldcall-core (`SidecarRuntime`, fail-open on the telephone path).

## Stack

| Layer | Technology |
|---|---|
| Client | React Native + Expo |
| Language | TypeScript |
| Detector | [shieldcall-core](https://github.com/vmercel/shieldcall-core) |
| Auth / records | Supabase |

## Author

Mercel Vubangsi
Author of ShieldCallAI and shieldcall-core
Python / MLOps Engineer (Apex Systems, Capital One assignment)
PhD Physics; MSc Artificial Intelligence Engineering

## License

Proprietary. Research prototype. Not a commercial product.
