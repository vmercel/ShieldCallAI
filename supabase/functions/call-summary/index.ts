/**
 * ShieldCall AI Call Summary Edge Function
 * Generates an AI-powered post-call summary from transcript data.
 * Produces: plain-language summary, threat assessment, action items,
 * scam classification, and community intelligence contribution.
 */

import { corsHeaders } from '../_shared/cors.ts';

const SYSTEM_PROMPT = `You are ShieldCall AI's post-call AI analyst. Given a call transcript and threat data, generate a concise, actionable call summary.

Return JSON with this exact structure:
{
  "summary": "2-3 sentence plain-language summary of the call",
  "aiNotes": "1-2 sentence AI agent observation (ghost mode actions taken, patterns detected)",
  "scamType": "Specific scam category name or null if legitimate",
  "threatAssessment": "One sentence threat assessment",
  "actionItems": ["Action 1", "Action 2"],
  "communityContribution": "How this call helps the broader ShieldCall AI network" 
}`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    const model = Deno.env.get('ANTHROPIC_MODEL') || 'claude-haiku-4-5-20251001';

    if (!apiKey) {
      throw new Error('AI provider credentials not configured');
    }

    const { transcript, threatScore, threatLevel, flags, duration, callerName, callerNumber } = await req.json();

    const transcriptText = (transcript || [])
      .map((t: { speaker: string; text: string }) => `[${t.speaker.toUpperCase()}]: ${t.text}`)
      .join('\n');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        temperature: 0.3,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: `Analyze this call:\n\nCaller: ${callerName} (${callerNumber})\nDuration: ${duration}s\nThreat Score: ${threatScore}%\nThreat Level: ${threatLevel}\nDetected Flags: ${(flags || []).join(', ') || 'none'}\n\nTranscript:\n${transcriptText || 'No transcript available'}\n\nReturn ONLY the JSON object. No markdown fences, no commentary, no text outside the JSON.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI provider error: ${errText}`);
    }

    const rawText = data.content?.find((b: { type: string; text?: string }) => b.type === 'text')?.text ?? '{}';
    // Claude may wrap JSON in markdown fences or add commentary; extract the object
    const fenceStripped = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const start = fenceStripped.indexOf('{');
    const end = fenceStripped.lastIndexOf('}');
    const content = start >= 0 && end > start ? fenceStripped.slice(start, end + 1) : fenceStripped;

    let result;
    try {
      result = JSON.parse(content);
    } catch {
      result = {
        summary: 'Call summary unavailable.',
        aiNotes: null,
        scamType: null,
        threatAssessment: 'Analysis incomplete.',
        actionItems: [],
        communityContribution: null,
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Call Summary error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
