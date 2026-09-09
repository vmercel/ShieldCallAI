/**
 * ShieldCall AI — Auth Callback Edge Function
 *
 * Handles OAuth and magic-link redirects from Supabase Auth.
 * Exchanges the auth code for a session, then redirects the user
 * back into the app via the shieldcallai:// deep link scheme.
 *
 * Supabase redirects to:
 *   https://<project>.supabase.co/functions/v1/callback?code=...&type=...
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const type = url.searchParams.get('type') ?? 'magiclink';
  const next = url.searchParams.get('next') ?? '/';

  // Health check
  if (req.method === 'GET' && !code) {
    return new Response(JSON.stringify({ status: 'ok', service: 'callback' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (!code) {
    return new Response('Missing auth code', { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('Auth callback error:', error.message);
    // Redirect back to app with error
    return Response.redirect(
      `shieldcallai://auth/callback?error=${encodeURIComponent(error.message)}&type=${type}`,
      302,
    );
  }

  // Success — redirect into the app
  return Response.redirect(
    `shieldcallai://auth/callback?type=${type}&next=${encodeURIComponent(next)}`,
    302,
  );
});
