/**
 * CALLSHIELD Call Summary Edge Function
 * Generates an AI-powered post-call summary from transcript data.
 * Produces: plain-language summary, threat assessment, action items,
 * scam classification, and community intelligence contribution.
 */

import { corsHeaders } from '../_shared/cors.ts';

const SYSTEM_PROMPT = `You are CALLSHIELD's post-call AI analyst. Given a call transcript and threat data, generate a concise, actionable call summary.

Return JSON with this exact structure:
{
  "summary": "2-3 sentence plain-language summary of the call",
  "aiNotes": "1-2 sentence AI agent observation (ghost mode actions taken, patterns detected)",
  "scamType": "Specific scam category name or null if legitimate",
  "threatAssessment": "One sentence threat assessment",
  "actionItems": ["Action 1", "Action 2"],
  "communityContribution": "How this call helps the broader CALLSHIELD network" 
}`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

    if (!apiKey || !baseUrl) {
      throw new Error('OnSpace AI credentials not configured');
    }

    const { transcript, threatScore, threatLevel, flags, duration, callerName, callerNumber } = await req.json();

    const transcriptText = (transcript || [])
      .map((t: { speaker: string; text: string }) => `[${t.speaker.toUpperCase()}]: ${t.text}`)
      .join('\n');

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Analyze this call:\n\nCaller: ${callerName} (${callerNumber})\nDuration: ${duration}s\nThreat Score: ${threatScore}%\nThreat Level: ${threatLevel}\nDetected Flags: ${(flags || []).join(', ') || 'none'}\n\nTranscript:\n${transcriptText || 'No transcript available'}`,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OnSpace AI error: ${errText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content ?? '{}';

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
