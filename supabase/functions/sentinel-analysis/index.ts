/**
 * CALLSHIELD SENTINEL™ Analysis Edge Function — Claude Anthropic
 *
 * Receives a 10-second transcript chunk + full call context and returns
 * a comprehensive real-time threat analysis using Claude Haiku 4.5.
 *
 * Response shape:
 * {
 *   riskScore: number,          // 0–100 cumulative risk
 *   riskLevel: "safe"|"warning"|"danger",
 *   callerType: "human"|"ai_synthetic"|"unknown",
 *   callerTypeConfidence: number,
 *   contentVerdict: "genuine"|"suspicious"|"scam"|"insufficient",
 *   contentVerdictConfidence: number,
 *   spamAssociated: boolean,
 *   flags: string[],
 *   factChecks: string[],
 *   scamType: string | null,
 *   trajectoryLabel: "rising"|"stable"|"falling",
 *   confidenceLabel: string,
 *   reasoning: string,          // 1-sentence explanation
 * }
 */

import { corsHeaders } from '../_shared/cors.ts';

const SYSTEM_PROMPT = `You are SENTINEL™, an expert real-time call threat analysis AI for CALLSHIELD. Your job is to detect scams, fraud, social engineering, and synthetic/AI voices in live phone calls.

You receive:
- A 10-second transcript chunk from the current call
- Full conversation history so far
- Acoustic signals (deepfake confidence, stress level)
- Community spam database hit count for this number

Analyze for ALL of the following threat patterns:
1. IRS/Tax Authority Impersonation (IRS never calls first; uses mail)
2. Social Security Administration Scam (SSN never suspended for debt)
3. Bank Fraud/Account Compromise (real banks never ask for OTPs)
4. Tech Support Scam (Microsoft/Apple never call unsolicited)
5. Medicare/Health Insurance Fraud
6. Grandparent/Family Emergency Scam
7. Romance/Relationship Scam
8. Investment/Crypto Scam (guaranteed returns, no-risk claims)
9. Lottery/Prize Scam (must pay fees to claim winnings)
10. Utility Company Threat (power cut-off, pay now)
11. Debt Collection Fraud (fake collections with threats)
12. Warrant/Legal Threat Scam (fake arrest warrants)
13. Gift Card Payment Request (NEVER legitimate from government/business)
14. Urgency Manufacturing (must act NOW or face consequences)
15. Identity Harvesting (collecting personal/financial info)
16. Wire Transfer/Cryptocurrency Request
17. Remote Access Request (asking to install software)
18. Verification Code Phishing (asking for codes received via SMS)
19. Robocall/Prerecorded Pattern (scripted, repetitive phrasing)
20. AI Voice / Deepfake Indicators (unnatural cadence, vocabulary patterns)

PEAK RATCHET RULE: If the conversation has already shown high threat indicators, the risk can only drop by at most 15% even if the caller shifts to neutral topics. Scammers establish urgency then retreat to avoid detection.

CUMULATIVE CONTEXT: Always analyze the FULL conversation history, not just the latest chunk. Early scam elements remain relevant throughout the call.

Respond ONLY with valid JSON matching this exact schema:
{
  "riskScore": <integer 0-100>,
  "riskLevel": <"safe"|"warning"|"danger">,
  "callerType": <"human"|"ai_synthetic"|"unknown">,
  "callerTypeConfidence": <integer 0-100>,
  "contentVerdict": <"genuine"|"suspicious"|"scam"|"insufficient">,
  "contentVerdictConfidence": <integer 0-100>,
  "spamAssociated": <boolean>,
  "flags": [<string>, ...],
  "factChecks": [<string>, ...],
  "scamType": <string or null>,
  "trajectoryLabel": <"rising"|"stable"|"falling">,
  "confidenceLabel": <string>,
  "reasoning": <string>
}`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }

    const body = await req.json();
    const {
      currentChunk,          // string: last 10s of transcript
      fullTranscript,        // string: entire call transcript so far
      previousRiskScore,     // number: last analysis score
      peakRiskScore,         // number: highest score ever seen
      batchIndex,            // number: which batch this is (0-based)
      deepfakeConfidence,    // number: acoustic deepfake signal 0-100
      acousticStress,        // number: acoustic stress level 0-100
      spamReportCount,       // number: community DB hit count
      callerNumber,          // string: phone number
      callDirection,         // "inbound" | "outbound"
      durationSeconds,       // number: how long the call has been
    } = body;

    // Build analysis prompt
    const userMessage = `
CALL CONTEXT:
- Direction: ${callDirection || 'inbound'}
- Duration: ${durationSeconds || 0}s
- Batch #: ${batchIndex + 1}
- Caller Number: ${callerNumber || 'Unknown'}
- Community Spam Reports: ${spamReportCount || 0}
- Previous Risk Score: ${previousRiskScore || 0}%
- Peak Risk Score Ever: ${peakRiskScore || 0}%
- Acoustic Deepfake Confidence: ${deepfakeConfidence || 0}%
- Acoustic Stress Level: ${acousticStress || 0}%

FULL CONVERSATION TRANSCRIPT SO FAR:
${fullTranscript || '(no transcript yet — acoustic signals only)'}

LATEST 10-SECOND CHUNK:
${currentChunk || '(silence or no speech detected)'}

Analyze ALL of the above holistically. Apply the peak ratchet rule: if peakRiskScore > 40, riskScore should not drop below ${Math.round((peakRiskScore || 0) * 0.85)}.
`.trim();

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const rawContent = data.content?.[0]?.text ?? '{}';

    // Strip markdown code fences if present
    const jsonStr = rawContent.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    let result;
    try {
      result = JSON.parse(jsonStr);
    } catch {
      // Fallback if Claude returns non-JSON
      console.error('JSON parse failed, raw:', rawContent);
      result = {
        riskScore: previousRiskScore || 0,
        riskLevel: 'safe',
        callerType: 'unknown',
        callerTypeConfidence: 0,
        contentVerdict: 'insufficient',
        contentVerdictConfidence: 0,
        spamAssociated: (spamReportCount || 0) > 5,
        flags: [],
        factChecks: [],
        scamType: null,
        trajectoryLabel: 'stable',
        confidenceLabel: 'Analyzing...',
        reasoning: 'Analysis pending more context.',
      };
    }

    // Safety clamp
    result.riskScore = Math.max(0, Math.min(100, parseInt(result.riskScore) || 0));
    result.callerTypeConfidence = Math.max(0, Math.min(100, parseInt(result.callerTypeConfidence) || 0));
    result.contentVerdictConfidence = Math.max(0, Math.min(100, parseInt(result.contentVerdictConfidence) || 0));

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('SENTINEL Analysis error:', error);
    return new Response(
      JSON.stringify({ error: `Anthropic: ${String(error)}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
