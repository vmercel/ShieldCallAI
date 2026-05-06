/**
 * CALLSHIELD AI Dialer Edge Function
 * Simulates the AI dialer conducting a call on the user's behalf.
 *
 * Given a user instruction (e.g. "Refill my blood pressure medication at CVS"),
 * the AI simulates the full call flow: IVR navigation, agent interaction,
 * verification steps, and task completion — returning a realistic transcript
 * and outcome summary.
 */

import { corsHeaders } from '../_shared/cors.ts';

const SYSTEM_PROMPT = `You are CALLSHIELD's AI Dialer agent. You simulate conducting a phone call on behalf of a user to complete a specific task.

Given a task instruction, you will:
1. Simulate the full call flow realistically (IVR menus, hold times, agent interactions)
2. Show the conversation as a realistic transcript
3. Navigate common obstacles (transfers, verification questions, hold)
4. Complete the task or explain what prevented completion
5. Extract action items and next steps

Return a JSON response with this exact structure:
{
  "outcome": "success" | "partial" | "failed",
  "summary": "One sentence plain-language summary of what happened",
  "transcript": [
    { "speaker": "system", "text": "Automated message or IVR prompt" },
    { "speaker": "ai", "text": "What the AI said" },
    { "speaker": "agent", "text": "What the human agent said" }
  ],
  "duration": 180,
  "actionItems": ["Action item 1", "Action item 2"],
  "callDetails": {
    "organization": "Name of organization called",
    "department": "Department or person spoken to",
    "confirmationNumber": "Any reference/confirmation number obtained or null",
    "nextSteps": "What happens next"
  }
}

Make the transcript realistic — include hold music, IVR navigation, transfers, and natural conversation. Typical call duration 60-360 seconds.`;

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

    const { instruction, userContext } = await req.json();

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
            content: `Complete this task via phone call:\n\n"${instruction}"\n\nUser context: ${userContext || 'Standard user, no special context.'}`,
          },
        ],
        temperature: 0.7,
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
        outcome: 'failed',
        summary: 'Unable to process the call at this time.',
        transcript: [],
        duration: 0,
        actionItems: [],
        callDetails: { organization: 'Unknown', department: 'Unknown', confirmationNumber: null, nextSteps: 'Please try again.' },
      };
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI Dialer error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
