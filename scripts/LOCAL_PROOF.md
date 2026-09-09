# Local proof (2026-09-07)

## Automated

```
bash scripts/local_proof.sh
```

- fusion: human vishing warns; quiet monitors; vocoded warns
- sentinel: dentist reminder score 0 / monitor; grandparent+wire 54 / warn

## Web smoke (localhost:8081)

- Guest onboarding: Continue without an account → consent → skip permissions → home
- Tabs: Shield, Calls, Settings (no Dialer, no Insights)
- Live Protect: consent switch required; typed IRS gift-card + grandparent wire → WARN, linguistic 62, flags gift card + untraceable payment
- Fail-open: sidecar not required (status Idle · on-device)

## Not yet proven on a physical phone

Speech recognition needs `npx expo run:ios` or `run:android` (not Expo Go). That is the remaining device proof.

## Store

Cannot submit without Apple Developer and Google Play accounts. Packaging is in STORE_LISTING.md. App is free, no IAP.
