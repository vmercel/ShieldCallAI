/**
 * CALLSHIELD AI Dialer Edge Function — Phase-Streaming Mode
 *
 * Streams call execution in phases so the client can display
 * real-time animated progress: DIALING → IVR → HOLD → AGENT → COMPLETE
 *
 * Phase events are newline-delimited JSON (NDJSON):
 *   { "phase": "dialing", "message": "Dialing CVS Pharmacy..." }
 *   { "phase": "ivr", "message": "Navigating IVR menu...", "transcript": [...] }
 *   { "phase": "hold", "message": "On hold for agent...", "holdTime": 45 }
 *   { "phase": "agent", "message": "Speaking with agent...", "transcript": [...] }
 *   { "phase": "complete", "result": { ...full result... } }
 *   { "phase": "error", "error": "..." }
 */

import { corsHeaders } from '../_shared/cors.ts';

const SYSTEM_PROMPT = `You are CALLSHIELD's AI Dialer agent. You simulate conducting a real phone call on behalf of a user to complete a specific task.

Given a task instruction, simulate the full call flow with EXACTLY this JSON structure:

{
  "phases": [
    {
      "phase": "dialing",
      "message": "Brief 1-sentence description of who is being called",
      "durationMs": 2500
    },
    {
      "phase": "ivr",
      "message": "Brief description of IVR navigation",
      "durationMs": 8000,
      "transcript": [
        { "speaker": "system", "text": "IVR prompt text" },
        { "speaker": "ai", "text": "AI response/DTMF selection" }
      ]
    },
    {
      "phase": "hold",
      "message": "Waiting for human agent",
      "durationMs": 12000,
      "holdTime": 45,
      "transcript": [
        { "speaker": "system", "text": "Hold music / queue message" }
      ]
    },
    {
      "phase": "agent",
      "message": "Speaking with human agent about the task",
      "durationMs": 15000,
      "transcript": [
        { "speaker": "agent", "text": "Human agent greeting" },
        { "speaker": "ai", "text": "AI states request clearly" },
        { "speaker": "agent", "text": "Agent responds" },
        { "speaker": "ai", "text": "AI provides any needed info" },
        { "speaker": "agent", "text": "Agent confirms/resolves" }
      ]
    }
  ],
  "outcome": "success" | "partial" | "failed",
  "summary": "Clear 1–2 sentence summary of what was accomplished",
  "actionItems": ["Action item 1", "Action item 2"],
  "callDetails": {
    "organization": "Name of organization called",
    "department": "Department or agent name",
    "confirmationNumber": "Reference number if obtained or null",
    "nextSteps": "What the user should do next or expect"
  },
  "totalDuration": 180
}

Rules:
- Make transcripts realistic with actual dialogue, not placeholders
- IVR should have real menu options relevant to the organization
- Agent dialogue should be professional and task-specific
- confirmationNumber should be a realistic alphanumeric code when task succeeds
- holdTime is seconds the AI waited on hold
- durationMs is realistic milliseconds each phase takes`;

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

    if (!instruction) {
      return new Response(
        JSON.stringify({ phase: 'error', error: 'No instruction provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call OnSpace AI to generate the full phased call simulation
    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
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
        temperature: 0.75,
        response_format: { type: 'json_object' },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      throw new Error(`OnSpace AI: ${aiResponse.status} ${errText}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content ?? '{}';

    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch {
      throw new Error('Failed to parse AI response as JSON');
    }

    const phases: any[] = parsed.phases ?? [];
    const outcome = parsed.outcome ?? 'failed';
    const summary = parsed.summary ?? 'Call completed.';
    const actionItems = parsed.actionItems ?? [];
    const callDetails = parsed.callDetails ?? { organization: 'Unknown', department: 'Unknown', confirmationNumber: null, nextSteps: 'N/A' };
    const totalDuration = parsed.totalDuration ?? 120;

    // Stream phase events as NDJSON
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) => {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
        };

        // Stream each phase with its durationMs as a simulated delay
        for (const phase of phases) {
          send(phase);
          // Delay to let client animate this phase (capped at 18s per phase)
          const delay = Math.min(phase.durationMs ?? 5000, 18000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        // Final complete event with full result
        send({
          phase: 'complete',
          result: {
            outcome,
            summary,
            actionItems,
            callDetails,
            duration: totalDuration,
            transcript: phases.flatMap((p: any) => p.transcript ?? []),
          },
        });

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/x-ndjson',
        'X-Content-Type-Options': 'nosniff',
      },
    });

  } catch (error) {
    console.error('AI Dialer error:', error);
    return new Response(
      JSON.stringify({ phase: 'error', error: String(error) }) + '\n',
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/x-ndjson' } }
    );
  }
});
