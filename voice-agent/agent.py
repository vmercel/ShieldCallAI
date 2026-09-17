"""
ShieldCall AI Ghost Voice Agent
===============================
Real-time voice responder for Ghost Mode.

Inbound call flow (PSTN -> Twilio -> LiveKit SIP -> this agent):
  1. Caller dials the user's Twilio number (via conditional call forwarding).
  2. LiveKit routes the SIP call into a room and dispatches this agent.
  3. The agent answers in the user's Ghost persona:
       Deepgram Nova-3 (STT) -> Claude Haiku (brain) -> Deepgram Aura (TTS)
  4. Every turn is written to the Supabase `call_records` table, so the
     ShieldCall app can show a live transcript via Realtime.
  5. On hangup the agent finalizes duration, threat assessment and a
     summary with Claude Haiku and updates the same row.

Run locally:   python agent.py dev
Run in prod:   python agent.py start   (see Dockerfile / fly.toml)
"""

import asyncio
import json
import logging
import os
import urllib.request
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    RunContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import anthropic, deepgram, silero
from supabase import create_client

logger = logging.getLogger("ghost-voice")

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-haiku-4-5-20251001")
AGENT_NAME = os.environ.get("AGENT_NAME", "ghost-voice")
MAX_CALL_MINUTES = int(os.environ.get("MAX_CALL_DURATION_MINUTES", "10"))

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

GHOST_SYSTEM_PROMPT = """You are {persona}, a professional AI communications assistant answering a phone call on behalf of {user_name}.

You are speaking on a live phone call. Keep every reply to 1-3 short sentences. Never use markdown, bullet points, or special characters. Sound like a natural, professional human assistant.

Your goals, in order:
1. Greet the caller and find out who they are: full name, organization, and why they are calling.
2. Verify anyone claiming authority: ask for badge numbers, case or reference numbers, and a callback number. Note discrepancies out loud and politely (the IRS contacts people by mail, not phone; legitimate banks never ask for gift cards).
3. If the caller uses pressure tactics, urgency, or threats, slow the process down. Never agree to payments, never share personal information, never confirm sensitive details.
4. If the caller is clearly legitimate and the user is available, offer to put them through (say you will pass the message to {user_name} right away).

Threat handling: when you detect scam signals (impersonation of government or banks, gift-card or wire demands, threats of arrest, pressure to stay on the line), call the report_threat_assessment tool with your score and reasoning, then continue the conversation with calm, thorough verification questions. Waste a scammer's time with plausible requests: ask them to repeat details, put them on brief holds while you "check the account".

Never reveal you are an AI unless the caller asks directly and persistently. Gift cards are NEVER a legitimate payment method for any government agency.
"""


# ---------------------------------------------------------------------------
# Supabase helpers
# ---------------------------------------------------------------------------
def lookup_number_mapping(twilio_number: str):
    """Map the dialed Twilio number to a ShieldCall user + persona."""
    if not twilio_number:
        return None
    res = (
        supabase.table("ghost_voice_numbers")
        .select("user_id, persona_name, owner_name")
        .eq("twilio_number", twilio_number)
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    return res.data[0] if res.data else None


def create_call_row(user_id: str, caller_number: str, persona: str):
    row = {
        "user_id": user_id,
        "caller_name": "Unknown caller",
        "caller_number": caller_number or "unknown",
        "direction": "inbound",
        "started_at": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": 0,
        "threat_level": "safe",
        "threat_score": 0,
        "ghost_handled": True,
        "transcript": [],
        "tags": ["ghost-voice"],
        "flags": [],
        "fact_checks": [],
        "is_blocked": False,
        "reported_to_ftc": False,
        "ai_notes": f"Handled live by Ghost Voice agent ({persona}).",
    }
    res = supabase.table("call_records").insert(row).execute()
    return res.data[0]["id"]


def update_call_row(call_id: str, patch: dict):
    supabase.table("call_records").update(patch).eq("id", call_id).execute()


def summarize_with_claude(transcript: list, caller_number: str) -> dict:
    """Final call summary + threat classification via Claude Haiku."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key or not transcript:
        return {}
    convo = "\n".join(f"{t['speaker']}: {t['text']}" for t in transcript[-60:])
    prompt = (
        "You are classifying a screened phone call. Reply with ONLY a JSON object "
        '(no markdown fences) with keys: summary (2-3 sentences), scam_type (or null), '
        "threat_score (0-100), caller_name (or null), caller_org (or null), "
        "action_items (array of short strings).\n\n"
        f"Caller number: {caller_number}\nTranscript:\n{convo}"
    )
    body = json.dumps(
        {
            "model": ANTHROPIC_MODEL,
            "max_tokens": 500,
            "system": "You reply with only a JSON object, no other text.",
            "messages": [{"role": "user", "content": prompt}],
        }
    ).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=body,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
        text = "".join(
            b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"
        ).strip()
        if text.startswith("```"):
            text = text.strip("`").split("\n", 1)[-1].rsplit("```", 1)[0]
        start, end = text.find("{"), text.rfind("}")
        return json.loads(text[start : end + 1]) if start >= 0 else {}
    except Exception as e:
        logger.warning("summary call failed: %s", e)
        return {}


# ---------------------------------------------------------------------------
# Ghost agent
# ---------------------------------------------------------------------------
class GhostVoiceAgent(Agent):
    def __init__(self, persona: str, user_name: str, call_id: str):
        super().__init__(
            instructions=GHOST_SYSTEM_PROMPT.format(persona=persona, user_name=user_name)
        )
        self.persona = persona
        self.user_name = user_name
        self.call_id = call_id
        self.transcript: list = []
        self.threat_score = 0
        self.live_threat_level = "safe"

    def _record_turn(self, speaker: str, text: str):
        text = (text or "").strip()
        if not text:
            return
        self.transcript.append({"speaker": speaker, "text": text})
        try:
            update_call_row(self.call_id, {"transcript": self.transcript})
        except Exception as e:
            logger.warning("transcript update failed: %s", e)

    @function_tool
    async def report_threat_assessment(
        self, context: RunContext, score: int, scam_type: str, reason: str
    ) -> str:
        """Call when scam signals are detected. Score 0-100."""
        score = max(0, min(100, int(score)))
        self.threat_score = max(self.threat_score, score)
        level = "safe" if score < 30 else "warning" if score < 70 else "danger"
        self.live_threat_level = level
        logger.info("threat assessment: %s/%s %s", score, scam_type, reason)
        try:
            update_call_row(
                self.call_id,
                {
                    "threat_score": self.threat_score,
                    "threat_level": level,
                    "scam_type": scam_type or None,
                    "flags": [f"ghost-voice: {reason[:200]}"],
                },
            )
        except Exception as e:
            logger.warning("threat update failed: %s", e)
        return f"Threat recorded at {score}/100 ({level}). Continue verifying the caller."


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------
def _sip_numbers(room) -> tuple:
    """Best-effort extraction of caller (From) and dialed (To) numbers."""
    caller, dialed = None, None
    for p in list(room.remote_participants.values()):
        attrs = dict(getattr(p, "attributes", {}) or {})
        logger.info("SIP participant %s attrs=%s", p.identity, attrs)
        for key in ("sip.phoneNumber", "sip.fromNumber", "sip.callerId", "phoneNumber"):
            if attrs.get(key):
                caller = caller or attrs[key]
        for key in ("sip.trunkPhoneNumber", "sip.toNumber", "sip.calledNumber"):
            if attrs.get(key):
                dialed = dialed or attrs[key]
        if not caller and p.identity.startswith("sip_"):
            caller = "+" + p.identity[4:].lstrip("+")
    return caller, dialed


async def entrypoint(ctx: JobContext):
    await ctx.connect()
    logger.info("room %s connected", ctx.room.name)

    # Wait briefly for the SIP participant so we can read caller/callee.
    caller_number, dialed_number = None, None
    for _ in range(20):
        caller_number, dialed_number = _sip_numbers(ctx.room)
        if dialed_number:
            break
        await asyncio.sleep(0.5)
    logger.info("caller=%s dialed=%s", caller_number, dialed_number)

    mapping = lookup_number_mapping(dialed_number or "")
    if not mapping:
        logger.warning("no mapping for dialed number %s; hanging up", dialed_number)
        await ctx.room.disconnect()
        return

    persona = mapping.get("persona_name") or "Alex"
    user_name = mapping.get("owner_name") or "your contact"
    user_id = mapping["user_id"]

    call_id = create_call_row(user_id, caller_number or "unknown", persona)
    logger.info("call_records row %s", call_id)

    session = AgentSession(
        stt=deepgram.STT(model="nova-3", language="en"),
        llm=anthropic.LLM(model=ANTHROPIC_MODEL),
        tts=deepgram.TTS(model="aura-2-thalia-en"),
        vad=silero.VAD.load(),
    )

    agent = GhostVoiceAgent(persona=persona, user_name=user_name, call_id=call_id)

    @session.on("conversation_item_added")
    def _on_item(event):
        try:
            item = event.item
            role = getattr(item, "role", "")
            content = getattr(item, "text_content", None) or getattr(item, "content", "")
            if isinstance(content, list):
                content = " ".join(
                    c.get("text", "") for c in content if isinstance(c, dict)
                )
            speaker = "ghost" if role == "assistant" else "caller"
            agent._record_turn(speaker, str(content))
        except Exception as e:
            logger.warning("item handler failed: %s", e)

    started = datetime.now(timezone.utc)
    try:
        await session.start(room=ctx.room, agent=agent)
        await session.generate_reply(
            instructions=(
                f"Greet the caller warmly as {persona}, {user_name}'s assistant. "
                "Ask who is calling and what the call is about. One to two sentences."
            )
        )

        # Cost guard: maximum call duration.
        await asyncio.sleep(MAX_CALL_MINUTES * 60)
        logger.info("max call duration reached; closing politely")
        await session.generate_reply(
            instructions=(
                "Politely wrap up: say you have what you need and will pass the "
                f"message to {user_name} right away. Then say goodbye."
            )
        )
        await asyncio.sleep(8)
    finally:
        ended = datetime.now(timezone.utc)
        duration = int((ended - started).total_seconds())
        logger.info("call ended after %ss, finalizing summary", duration)
        try:
            summary = await asyncio.to_thread(
                summarize_with_claude, agent.transcript, caller_number or "unknown"
            )
            patch = {
                "ended_at": ended.isoformat(),
                "duration_seconds": duration,
                "transcript": agent.transcript,
            }
            if summary:
                patch.update(
                    {
                        "summary": summary.get("summary"),
                        "scam_type": summary.get("scam_type"),
                        "threat_score": max(
                            agent.threat_score, int(summary.get("threat_score") or 0)
                        ),
                        "caller_name": summary.get("caller_name") or "Unknown caller",
                        "caller_org": summary.get("caller_org"),
                        "action_items": summary.get("action_items"),
                    }
                )
                score = patch["threat_score"]
                patch["threat_level"] = (
                    "safe" if score < 30 else "warning" if score < 70 else "danger"
                )
            update_call_row(call_id, patch)
        except Exception as e:
            logger.warning("finalization failed: %s", e)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    for var in ("LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"):
        if not os.environ.get(var):
            raise SystemExit(f"missing required env var: {var}")
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name=AGENT_NAME))
