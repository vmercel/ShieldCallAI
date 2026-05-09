/**
 * CALLSHIELD Transcribe Audio Edge Function
 *
 * Accepts a base64-encoded audio chunk from a native device recording
 * and returns a text transcript using Deepgram's Nova-2 model.
 *
 * Required Supabase secret: DEEPGRAM_API_KEY
 *
 * Request body:
 * {
 *   audioBase64: string,  // base64-encoded audio data
 *   mimeType: string,     // e.g., "audio/m4a" or "audio/wav"
 *   language?: string,    // defaults to "en"
 * }
 *
 * Response:
 * { transcript: string, confidence: number, words: number }
 */

import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const deepgramKey = Deno.env.get('DEEPGRAM_API_KEY');
    if (!deepgramKey) {
      // Graceful no-op when key is not configured — client falls back to manual input
      return new Response(
        JSON.stringify({ transcript: '', confidence: 0, words: 0, error: 'DEEPGRAM_API_KEY not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { audioBase64, mimeType = 'audio/m4a', language = 'en' } = body;

    if (!audioBase64) {
      return new Response(
        JSON.stringify({ transcript: '', confidence: 0, words: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decode base64 to binary
    const binaryStr = atob(audioBase64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    // Send to Deepgram Nova-2 for transcription
    const dgResponse = await fetch(
      `https://api.deepgram.com/v1/listen?model=nova-2&language=${language}&smart_format=true&punctuate=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Token ${deepgramKey}`,
          'Content-Type': mimeType,
        },
        body: bytes,
      }
    );

    if (!dgResponse.ok) {
      const errText = await dgResponse.text();
      console.error('Deepgram error:', dgResponse.status, errText);
      return new Response(
        JSON.stringify({ transcript: '', confidence: 0, words: 0, error: `Deepgram ${dgResponse.status}` }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dgData = await dgResponse.json();
    const channel = dgData?.results?.channels?.[0];
    const alternative = channel?.alternatives?.[0];
    const transcript: string = alternative?.transcript ?? '';
    const confidence: number = alternative?.confidence ?? 0;
    const words: number = alternative?.words?.length ?? transcript.split(/\s+/).filter(Boolean).length;

    return new Response(
      JSON.stringify({ transcript, confidence, words }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Transcription error:', error);
    return new Response(
      JSON.stringify({ transcript: '', confidence: 0, words: 0, error: String(error) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
