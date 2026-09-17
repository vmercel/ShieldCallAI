# Ghost Voice Agent

Real-time voice responder for ShieldCall **Ghost Mode**. Answers forwarded calls
out loud, screens the caller, and streams the transcript into the app.

## Architecture

```
Caller ──PSTN──▶ Twilio number ──SIP──▶ LiveKit Cloud ──WebRTC──▶ this agent
     (conditional call forwarding                                    │
      from the user's phone)                                         ▼
                                                      ┌─────────────────────────┐
                                                      │ Deepgram Nova-3 → STT   │
                                                      │ Claude Haiku  → brain   │
                                                      │ Deepgram Aura → TTS     │
                                                      │ Silero VAD turn-taking  │
                                                      └─────────────┬───────────┘
                                                                    │ transcript turns,
                                                                    │ threat score, summary
                                                                    ▼
                                                          Supabase call_records
                                                          (app reads via Realtime)
```

Why this stack: Twilio handles the phone network, LiveKit Agents (open source)
handles turn-taking and SIP, Deepgram covers both directions of audio on the
key already used in production, and Claude Haiku is the same brain as the
`ghost-ai` edge function. Rough cost: ~$0.04-0.05 per screened minute.

## Prerequisites

- LiveKit Cloud project (https://cloud.livekit.io) — free tier works for testing
- Twilio account with a voice-capable number and Elastic SIP Trunking
- The existing `DEEPGRAM_API_KEY`, `ANTHROPIC_API_KEY`, Supabase project

## Setup

### 1. Database

Apply the migration so the agent can map dialed numbers to users:

```bash
# via Supabase dashboard SQL editor, or:
supabase db push   # from the repo root, if the CLI is linked
```

Then insert one row per user/number (replace the placeholders):

```sql
insert into public.ghost_voice_numbers (user_id, twilio_number, persona_name, owner_name)
values ('<auth.users id>', '+15551234567', 'Alex', 'Mercel');
```

### 2. Environment

```bash
cd voice-agent
cp .env.example .env   # fill in real values; never commit .env
pip install -r requirements.txt
```

### 3. Twilio → LiveKit SIP trunk

1. Twilio Console → Elastic SIP Trunking → create trunk (e.g. `shieldcall-ghost`).
2. Origination URI: your LiveKit SIP endpoint, e.g.
   `sip:xxxx.sip.livekit.cloud` (shown in LiveKit Cloud → Telephony → SIP Trunks).
3. Attach your Twilio voice number to the trunk.
4. In LiveKit Cloud → Telephony → SIP Trunks → create **inbound** trunk with your
   Twilio number in the Numbers list.
5. Create a **dispatch rule**: individual dispatch, room prefix `ghost-`,
   agent name `ghost-voice` (must match `AGENT_NAME`).

Or with the `lk` CLI:

```bash
lk sip inbound create inbound-trunk.json   # {"trunk": {"name": "Twilio Inbound", "numbers": ["+15551234567"]}}
lk dispatch create --agent-name ghost-voice --room-prefix ghost-
```

### 4. Point the user's phone at it

On the user's phone, enable conditional call forwarding (busy / no-answer /
unreachable) to the Twilio number. Now unanswered calls are screened by Ghost.

## Run

```bash
# Local dev (connects to LiveKit Cloud, test via SIP or the LiveKit playground)
python agent.py dev

# Production worker
python agent.py start
```

## Deploy (Fly.io)

```bash
cd voice-agent
fly launch --no-deploy        # accept defaults, region iad
fly secrets set LIVEKIT_URL=... LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=... \
  DEEPGRAM_API_KEY=... ANTHROPIC_API_KEY=... \
  SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...
fly deploy
```

Scale horizontally for concurrent screened calls: `fly scale count 2`.

## How it behaves

- Answers with the mapped persona ("Hi, you've reached Mercel's line, this is
  Alex, their assistant…"), asks who is calling and why.
- Verifies authority claims (badge numbers, case numbers, callback numbers),
  slows down pressure tactics, never agrees to payments or shares personal data.
- Calls `report_threat_assessment` when scam signals appear — the live threat
  score lands in `call_records` immediately.
- Every conversation turn is appended to the call's `transcript` in
  `call_records`, so the app shows it live.
- On hangup (or the `MAX_CALL_DURATION_MINUTES` guard), Claude writes the final
  summary, scam classification, and action items into the same row.
- Numbers with no mapping row are hung up on immediately (nothing is billed
  beyond the first seconds).

## Legal note

Several US states require two-party consent for call recording. The agent
identifies itself as the user's assistant on every call; review the greeting
and disclosure wording for the states you operate in before production use.

## Upgrading

Pinned to `livekit-agents` 1.x. If LiveKit ships 2.x, check the Agents
migration guide — the `AgentSession` / plugin surface is where breaking
changes usually land.
