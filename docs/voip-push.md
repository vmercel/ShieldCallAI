# P1-4 — VoIP push registration and background incoming-call delivery

How ShieldCall AI wakes a terminated/backgrounded app when a screened call
needs the user's attention, using PushKit VoIP pushes (iOS) and high-priority
FCM data messages (Android).

## Architecture

```
telephony trigger (voice-agent / callback, service role)
        │  POST /voip-push { targetUserId, callerName, callerNumber, callId }
        ▼
voip-push edge function ──► APNs ──► iOS app ──► CallKit incoming call UI
 (verify_jwt)              (PushKit)      │
                                        └──► routes to /incoming-call
                        ──► FCM ───► Android app ──► full-screen incoming call
```

- Client registration: `services/voipPush.ts`. After sign-in the app asks
  PushKit for its VoIP device token and upserts it into the `voip_tokens`
  table (own rows only). On sign-out the token row is deleted.
- Incoming push handling: the client reports the call to CallKit FIRST
  (`displayIncomingCall`), then routes to the `/incoming-call` screen.
  Apple terminates apps that receive VoIP pushes without reporting a call,
  and repeated failures stop push delivery entirely — so the CallKit report
  is unconditional, even for malformed payloads (caller shows as
  "Unknown caller", never invented from elsewhere).
- Server: `supabase/functions/voip-push` (POST, `verify_jwt=true`).
  - A caller with a **user JWT may only push to itself**
    (`targetUserId === auth.uid()`); only the **service-role key** (trusted
    backend telephony) may target another user. This blocks
    user-to-user harassment via the push channel.
  - 30 pushes/hour per caller (shared `consume_ai_quota` RPC), 429 with
    `Retry-After`-style headers beyond that.
  - Stale tokens are deleted server-side on APNs 410 / `BadDeviceToken`
    and FCM `UNREGISTERED`.
  - Fail-closed: with no push secrets configured the function answers 503
    and never claims a push was sent.

## Apple provisioning (needs Mercel — Apple Developer portal)

1. App ID: enable **Push Notifications** and **Voice over IP** capabilities
   for `com.shieldcallai.app`.
2. Keys: create an **Apple Push Notifications service (APNs)** auth key,
   download the `.p8` once, note the Key ID and Team ID.
3. Set the server secrets:
   ```
   supabase secrets set APNS_KEY_ID=<key-id> APNS_TEAM_ID=<team-id>
   supabase secrets set APNS_KEY_P8="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
   supabase secrets set APNS_ENVIRONMENT=sandbox   # production only for store builds
   ```
4. Xcode/EAS: the `voip` background mode is already in the Info.plist (via
   `plugins/withCallKeep.js`); confirm "Voice over IP" is checked under
   Signing & Capabilities for release builds.

## Android / FCM provisioning (needs Mercel — Firebase console)

1. Create/download a service-account JSON key for the Firebase project.
2. `supabase secrets set FCM_SERVICE_ACCOUNT_JSON='{...}'`

## Trigger contract (backend telephony → voip-push)

The voice-agent (Twilio inbound) or `callback` function calls voip-push with
the **service-role key**:

```json
POST https://<project>.supabase.co/functions/v1/voip-push
Authorization: Bearer <service-role-key>
{
  "targetUserId": "<uuid of the ShieldCall user>",
  "callerName": "Unknown caller",
  "callerNumber": "+15551234567",
  "callId": "<optional; server generates a UUID when absent>"
}
```

Response: `{ ok, callId, ios: { attempted, delivered, cleaned, errors },
android: {...} }`. `delivered: 0` with `attempted: 0` means the user has no
registered device — fall back to a regular notification / missed-call log.

## Testing (no real push without the Apple key)

- `npm run check:voip-push` — 20 wiring assertions (dependency, client
  API, layout wiring, RLS policies, function contract).
- `POST { "ping": true }` on the deployed function reports
  `apnsConfigured` / `fcmConfigured` booleans without sending anything.
- End-to-end VoIP delivery needs: a dev-client build on a physical iPhone,
  the APNs auth key set, and `APNS_ENVIRONMENT=sandbox`. Simulator cannot
  receive pushes.

## Current status

- Code: shipped. Server: deployed with `verify_jwt=true`; ping reports
  `apnsConfigured: false, fcmConfigured: false` until Mercel provisions
  the keys above.
- Remaining (Mercel): Apple APNs auth key + App ID capabilities; Firebase
  service account; wire the voice-agent/callback trigger; one physical-device
  end-to-end test.
