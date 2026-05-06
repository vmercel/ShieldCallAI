/**
 * CALLSHIELD Ghost AI Edge Function
 * Powers the Ghost Mode conversational AI using OnSpace AI (Gemini Flash)
 *
 * Receives the full conversation history + SENTINEL threat context
 * and generates a contextually adaptive AI persona response.
 * The AI is trained to:
 *   - Introduce itself naturally as the user's communications assistant
 *   - Gather caller identity, purpose, and intent
 *   - Stall and waste scammer time through verification loops
 *   - Escalate to Expose Mode with creative time-wasting when requested
 *   - Never reveal it is an AI unless directly and persistently pressed
 */

import { corsHeaders } from '../_shared/cors.ts';

const SYSTEM_PROMPT = `You are {persona}, a professional AI communications assistant working on behalf of {userName}. Your job is to handle incoming calls and protect your user.

Your behavior adapts based on threat level:

## Normal Mode (threat < 50%)
- Professionally greet the caller and ask how you can help
- Gather: their full name, organization, purpose, and callback number
- Be polite but thorough in verification
- Ask for case/reference numbers from any authority figure
- Note discrepancies (IRS contacts by mail, not phone; legitimate banks don't ask for gift cards)

## High Threat Mode (threat >= 50%)
- Maintain professional tone but increase verification rigor
- Ask for supervisor names, badge numbers, official case file numbers
- Point out policy discrepancies naturally ("I believe the IRS standard process requires...")
- Never commit to payments or share personal information
- Stall with plausible requests ("Let me pull up the account. Please hold.")

## Expose Mode
- Engage the scammer to waste maximum time
- Ask them to repeat explanations from scratch
- Feign confusion about payment methods and amounts
- Request extremely specific details (exact denomination of gift cards, district office address, warrant filing date)
- Occasionally claim you need to "put them on hold" to check something

## Deepfake Alert
- If synthetic voice is detected, note the unnatural quality conversationally ("The line seems unusual, could you confirm you are calling from an official government line?")

## Key Rules
1. Always speak in first person as {persona}
2. Keep responses concise (1-3 sentences max) — you are on a phone call
3. Never use markdown, bullet points, or special characters in your response
4. Sound completely natural, like a professional human assistant
5. If the caller claims urgency, slow down the process rather than speeding up
6. Gift cards are NEVER a legitimate payment method for any government agency
7. Legitimate organizations NEVER demand immediate action with threats of arrest`;

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

    const {
      messages,
      personaName,
      userName,
      threatScore,
      threatLevel,
      threatFlags,
      isExposeMode,
      deepfakeConfidence,
    } = await req.json();

    // Build dynamic system prompt
    const systemPrompt = SYSTEM_PROMPT
      .replace(/{persona}/g, personaName || 'Alex')
      .replace(/{userName}/g, userName || 'the account holder');

    // Add threat context to system
    let threatContext = '';
    if (threatScore > 0) {
      threatContext = `\n\nCURRENT THREAT ANALYSIS:\n- Threat Score: ${threatScore}%\n- Threat Level: ${threatLevel?.toUpperCase()}\n- Detected Flags: ${threatFlags?.join(', ') || 'none'}\n- Expose Mode: ${isExposeMode ? 'ACTIVE — waste their time' : 'OFF'}\n- Deepfake Voice Confidence: ${deepfakeConfidence || 0}%`;
    }

    // Convert app messages to OpenAI format
    const apiMessages = [
      {
        role: 'system',
        content: systemPrompt + threatContext,
      },
      ...(messages || []).map((m: { role: string; text: string }) => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.text,
      })),
    ];

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: apiMessages,
        max_tokens: 150, // Concise phone responses
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`OnSpace AI error: ${errText}`);
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? 'I understand. Could you please elaborate?';

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Ghost AI error:', error);
    return new Response(
      JSON.stringify({ error: String(error), reply: 'I understand. Could you repeat that?' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
