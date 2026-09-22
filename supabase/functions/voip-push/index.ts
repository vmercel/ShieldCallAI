/**
 * ShieldCall AI — VoIP push delivery for background incoming calls (P1-4).
 *
 * POST /voip-push
 *
 * Delivers an incoming-call push to a user's registered devices:
 *   - iOS: PushKit VoIP push via APNs HTTP/2 (token-based .p8 auth).
 *          The client MUST report the call to CallKit on receipt — Apple
 *          terminates apps that receive VoIP pushes without reporting.
 *   - Android: high-priority FCM data message (full-screen intent path).
 *
 * Auth model (fail-CLOSED):
 *   - verify_jwt=true at the gateway; the function additionally enforces a
 *     targeting rule: a caller presenting a *user* JWT may only push to
 *     THEMSELF (targetUserId === auth.uid()). Trusted backend telephony
 *     (voice-agent / callback) presents the service-role key and may target
 *     any user. This prevents one user ringing another user's phone.
 *   - The plan/call content is never invented: the payload carries only the
 *     callerName/callerNumber supplied by the trigger.
 *
 * Stale tokens: APNs 410 / BadDeviceToken and FCM UNREGISTERED responses
 * cause the token row to be deleted (service role), so the registry stays
 * clean without client involvement.
 *
 * Quota: 30 pushes / hour / caller (shared consume_ai_quota RPC, same as
 * the AI endpoints). Fail-open with a loud log if the quota store is down.
 *
 * Request body:
 *   {
 *     "targetUserId": "uuid",     // whose phone should ring
 *     "callerName": "string",     // shown on the incoming-call UI
 *     "callerNumber": "string",   // E.164 ideally
 *     "callId": "string"          // optional; server generates a UUID if absent
 *   }
 *
 * Required secrets (supabase secrets set) for iOS:
 *   APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_P8 (PEM, \n escapes accepted)
 * Optional env:
 *   APNS_ENVIRONMENT=sandbox|production (default: sandbox — flip to
 *     production only with a production-signed build)
 *   SHIELDCALL_IOS_BUNDLE_ID (default com.shieldcallai.app; VoIP topic is
 *     <bundle id>.voip)
 * Required secrets for Android:
 *   FCM_SERVICE_ACCOUNT_JSON (service-account JSON for the Firebase project)
 *
 * Until the relevant secrets are set the endpoint answers 503 and never
 * claims a push was sent.
 */

import { corsHeaders } from '../_shared/cors.ts';
import {
  enforceQuota,
  makePostgrestRpc,
  quotaHeaders,
  type QuotaResult,
} from '../_shared/rateLimit.ts';

const PUSH_TIMEOUT_MS = 10_000;
const VOIP_PUSH_QUOTA_PER_HOUR = 30;

const IOS_BUNDLE_ID =
  Deno.env.get('SHIELDCALL_IOS_BUNDLE_ID') || 'com.shieldcallai.app';
const APNS_ENVIRONMENT =
  (Deno.env.get('APNS_ENVIRONMENT') || 'sandbox').toLowerCase() === 'production'
    ? 'production'
    : 'sandbox';

function json(
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders },
  });
}

function base64UrlDecode(input: string): string {
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad === 2) s += '==';
  else if (pad === 3) s += '=';
  else if (pad !== 0) throw new Error('bad base64url length');
  return atob(s);
}

function base64UrlEncode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToPkcs8Der(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, '\n').trim();
  const body = normalized
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Caller {
  kind: 'user' | 'service_role';
  userId: string | null;
}

/** Classify the bearer: service-role key (trusted backend) or a user JWT. */
function classifyCaller(req: Request): Caller | null {
  const auth =
    req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const parts = m[1].split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as {
      sub?: unknown;
      role?: unknown;
    };
    if (payload.role === 'service_role') {
      return { kind: 'service_role', userId: null };
    }
    if (typeof payload.sub === 'string' && UUID_RE.test(payload.sub)) {
      return { kind: 'user', userId: payload.sub };
    }
    return null;
  } catch {
    return null;
  }
}

function apnsConfigured(): boolean {
  return !!(
    Deno.env.get('APNS_KEY_ID') &&
    Deno.env.get('APNS_TEAM_ID') &&
    Deno.env.get('APNS_KEY_P8')
  );
}

function fcmConfigured(): boolean {
  return !!Deno.env.get('FCM_SERVICE_ACCOUNT_JSON');
}

/* ---------------- Database (service role) ---------------- */

function serviceHeaders(): Record<string, string> {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !serviceKey) {
    throw new Error('Supabase service credentials are not available to the function');
  }
  return {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    'Content-Type': 'application/json',
  };
}

function restUrl(path: string): string {
  const url = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/, '');
  return `${url}${path}`;
}

interface VoipTokenRow {
  token: string;
  platform: 'ios' | 'android';
  app_id: string | null;
}

async function loadTokens(userId: string): Promise<VoipTokenRow[]> {
  const res = await fetch(
    restUrl(
      `/rest/v1/voip_tokens?user_id=eq.${encodeURIComponent(userId)}&select=token,platform,app_id`,
    ),
    { headers: serviceHeaders(), signal: AbortSignal.timeout(PUSH_TIMEOUT_MS) },
  );
  if (!res.ok) throw new Error(`token lookup failed (${res.status})`);
  return (await res.json()) as VoipTokenRow[];
}

async function deleteToken(userId: string, token: string): Promise<void> {
  await fetch(
    restUrl(
      `/rest/v1/voip_tokens?user_id=eq.${encodeURIComponent(userId)}&token=eq.${encodeURIComponent(token)}`,
    ),
    {
      method: 'DELETE',
      headers: serviceHeaders(),
      signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
    },
  ).catch(() => {});
}

/* ---------------- APNs (iOS PushKit VoIP) ---------------- */

let cachedProviderToken: { token: string; issuedAt: number } | null = null;

async function apnsProviderToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedProviderToken && now - cachedProviderToken.issuedAt < 50 * 60) {
    return cachedProviderToken.token;
  }
  const keyId = Deno.env.get('APNS_KEY_ID') || '';
  const teamId = Deno.env.get('APNS_TEAM_ID') || '';
  const privateKeyPem = Deno.env.get('APNS_KEY_P8') || '';
  if (!keyId || !teamId || !privateKeyPem) {
    throw Object.assign(new Error('APNs is not configured on the server yet.'), {
      httpStatus: 503,
      code: 'apns_unconfigured',
    });
  }
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8Der(privateKeyPem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const header = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ alg: 'ES256', kid: keyId })),
  );
  const payload = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ iss: teamId, iat: now })),
  );
  const unsigned = `${header}.${payload}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(unsigned),
    ),
  );
  const token = `${unsigned}.${base64UrlEncode(sig)}`;
  cachedProviderToken = { token, issuedAt: now };
  return token;
}

interface ChannelReport {
  attempted: number;
  delivered: number;
  cleaned: number;
  errors: string[];
}

async function sendApnsVoip(
  tokens: VoipTokenRow[],
  targetUserId: string,
  call: { callId: string; callerName: string; callerNumber: string },
): Promise<ChannelReport> {
  const report: ChannelReport = { attempted: 0, delivered: 0, cleaned: 0, errors: [] };
  if (tokens.length === 0) return report;
  const providerToken = await apnsProviderToken();
  const host =
    APNS_ENVIRONMENT === 'production'
      ? 'https://api.push.apple.com'
      : 'https://api.sandbox.push.apple.com';
  const topic = `${IOS_BUNDLE_ID}.voip`;
  const payload = JSON.stringify({
    // VoIP pushes carry no alert/sound/badge — content-available wakes the
    // app, and the client reports the call to CallKit itself.
    aps: { 'content-available': 1 },
    'sc-call-id': call.callId,
    'sc-caller-name': call.callerName,
    'sc-caller-number': call.callerNumber,
    'sc-sent-at': new Date().toISOString(),
  });

  for (const row of tokens) {
    report.attempted += 1;
    try {
      const res = await fetch(
        `${host}/3/device/${encodeURIComponent(row.token)}`,
        {
          method: 'POST',
          headers: {
            authorization: `bearer ${providerToken}`,
            'apns-topic': topic,
            'apns-push-type': 'voip',
            'apns-priority': '10',
            'apns-expiration': '0',
            'content-type': 'application/json',
          },
          body: payload,
          signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
        },
      );
      if (res.status === 200) {
        report.delivered += 1;
        continue;
      }
      const body = await res.json().catch(() => ({}));
      const reason = (body as { reason?: string })?.reason || `http_${res.status}`;
      // Token is dead: drop it so the registry stays clean.
      if (res.status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered') {
        await deleteToken(targetUserId, row.token);
        report.cleaned += 1;
      } else {
        report.errors.push(reason);
      }
    } catch (err) {
      report.errors.push(err instanceof Error ? err.message : 'apns_send_failed');
    }
  }
  return report;
}

/* ---------------- FCM (Android high-priority data) ---------------- */

let cachedFcmToken: { token: string; expiresAt: number; projectId: string } | null = null;

async function fcmAccessToken(): Promise<{ token: string; projectId: string }> {
  const now = Date.now();
  if (cachedFcmToken && now < cachedFcmToken.expiresAt - 60_000) {
    return { token: cachedFcmToken.token, projectId: cachedFcmToken.projectId };
  }
  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON') || '';
  if (!raw) {
    throw Object.assign(new Error('FCM is not configured on the server yet.'), {
      httpStatus: 503,
      code: 'fcm_unconfigured',
    });
  }
  const sa = JSON.parse(raw) as {
    client_email: string;
    private_key: string;
    project_id: string;
  };
  if (!sa.client_email || !sa.private_key || !sa.project_id) {
    throw Object.assign(new Error('FCM service account is malformed.'), {
      httpStatus: 503,
      code: 'fcm_unconfigured',
    });
  }
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8Der(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const header = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
  );
  const payload = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        iat: Math.floor(now / 1000),
        exp: Math.floor(now / 1000) + 3600,
      }),
    ),
  );
  const unsigned = `${header}.${payload}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      new TextEncoder().encode(unsigned),
    ),
  );
  const assertion = `${unsigned}.${base64UrlEncode(sig)}`;
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
  });
  if (!tokenRes.ok) throw new Error(`FCM OAuth failed (${tokenRes.status})`);
  const tokenJson = (await tokenRes.json()) as { access_token: string; expires_in: number };
  cachedFcmToken = {
    token: tokenJson.access_token,
    expiresAt: now + (tokenJson.expires_in || 3600) * 1000,
    projectId: sa.project_id,
  };
  return { token: tokenJson.access_token, projectId: sa.project_id };
}

async function sendFcmData(
  tokens: VoipTokenRow[],
  targetUserId: string,
  call: { callId: string; callerName: string; callerNumber: string },
): Promise<ChannelReport> {
  const report: ChannelReport = { attempted: 0, delivered: 0, cleaned: 0, errors: [] };
  if (tokens.length === 0) return report;
  const { token: accessToken, projectId } = await fcmAccessToken();
  for (const row of tokens) {
    report.attempted += 1;
    try {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: row.token,
              data: {
                type: 'voip-incoming-call',
                'sc-call-id': call.callId,
                'sc-caller-name': call.callerName,
                'sc-caller-number': call.callerNumber,
              },
              android: { priority: 'high' },
            },
          }),
          signal: AbortSignal.timeout(PUSH_TIMEOUT_MS),
        },
      );
      if (res.ok) {
        report.delivered += 1;
        continue;
      }
      const body = await res.json().catch(() => ({}));
      const code = (body as { error?: { status?: string } })?.error?.status || `http_${res.status}`;
      if (code === 'NOT_FOUND' || code === 'UNREGISTERED') {
        await deleteToken(targetUserId, row.token);
        report.cleaned += 1;
      } else {
        report.errors.push(code);
      }
    } catch (err) {
      report.errors.push(err instanceof Error ? err.message : 'fcm_send_failed');
    }
  }
  return report;
}

/* ---------------- Handler ---------------- */

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' });
  }

  try {
    const body = await req.json().catch(() => ({}));

    // Cheap health probe: reports which push channels are configured
    // (booleans only — no push is ever sent by a ping).
    if (body?.ping === true) {
      return json(200, {
        ok: true,
        service: 'voip-push',
        apnsConfigured: apnsConfigured(),
        apnsEnvironment: APNS_ENVIRONMENT,
        fcmConfigured: fcmConfigured(),
      });
    }

    const caller = classifyCaller(req);
    if (!caller) {
      return json(401, { ok: false, error: 'authentication_required' });
    }

    const targetUserId = body?.targetUserId;
    if (typeof targetUserId !== 'string' || !UUID_RE.test(targetUserId)) {
      return json(400, { ok: false, error: 'invalid_target_user' });
    }
    // Anti-harassment rule: a user JWT may only ring its own devices.
    // Only the service-role key (trusted backend telephony) may target others.
    if (caller.kind === 'user' && caller.userId !== targetUserId) {
      return json(403, { ok: false, error: 'forbidden_target' });
    }

    const callerName = body?.callerName;
    const callerNumber = body?.callerNumber;
    if (typeof callerName !== 'string' || !callerName.trim()) {
      return json(400, { ok: false, error: 'missing_caller_name' });
    }
    if (typeof callerNumber !== 'string' || !callerNumber.trim()) {
      return json(400, { ok: false, error: 'missing_caller_number' });
    }
    const rawCallId = body?.callId;
    const callId =
      typeof rawCallId === 'string' && rawCallId.trim()
        ? rawCallId.trim().slice(0, 128)
        : crypto.randomUUID();

    if (!apnsConfigured() && !fcmConfigured()) {
      return json(503, {
        ok: false,
        error: 'push_unconfigured',
        detail: 'No push channel is configured on the server yet.',
      });
    }

    // Quota on the caller (30/hour), same machinery as the AI endpoints.
    let quota: QuotaResult | null = null;
    if (caller.kind === 'user') {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
        if (supabaseUrl && anonKey) {
          quota = await enforceQuota({
            rpc: makePostgrestRpc(supabaseUrl, anonKey),
            userId: caller.userId as string,
            functionName: 'voip-push',
            limit: VOIP_PUSH_QUOTA_PER_HOUR,
          });
        }
      } catch (err) {
        // Fail open, loudly: a quota-store outage must not block calls.
        console.error('[voip-push] quota check failed (fail-open):', err);
      }
      if (quota && quota.requestCount > quota.limit) {
        return json(
          429,
          { ok: false, error: 'rate_limited', retry_after_seconds: Math.max(1, Math.ceil((quota.resetAtMs - Date.now()) / 1000)) },
          quotaHeaders(quota),
        );
      }
    }

    const tokens = await loadTokens(targetUserId);
    const iosTokens = tokens.filter((t) => t.platform === 'ios');
    const androidTokens = tokens.filter((t) => t.platform === 'android');
    const call = {
      callId,
      callerName: callerName.trim().slice(0, 128),
      callerNumber: callerNumber.trim().slice(0, 64),
    };

    const ios = apnsConfigured()
      ? await sendApnsVoip(iosTokens, targetUserId, call)
      : { attempted: 0, delivered: 0, cleaned: 0, errors: [] as string[], skipped: 'apns_unconfigured' };
    const android = fcmConfigured()
      ? await sendFcmData(androidTokens, targetUserId, call)
      : { attempted: 0, delivered: 0, cleaned: 0, errors: [] as string[], skipped: 'fcm_unconfigured' };

    const res = json(
      200,
      {
        ok: true,
        callId,
        targetUserId,
        apnsEnvironment: APNS_ENVIRONMENT,
        ios,
        android,
      },
      quota ? quotaHeaders(quota) : {},
    );
    return res;
  } catch (err: unknown) {
    const e = err as { httpStatus?: number; code?: string; message?: string };
    const status =
      typeof e?.httpStatus === 'number' && e.httpStatus >= 400 && e.httpStatus < 600
        ? e.httpStatus
        : 500;
    return json(status, {
      ok: false,
      error: e?.code || 'push_failed',
      detail: status === 503 ? e?.message : undefined,
    });
  }
});
