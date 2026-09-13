/**
 * CALLSHIELD shared rate limiting for AI edge functions (P0-3).
 *
 * Per-user, per-function quotas backed by the `consume_ai_quota` Postgres RPC
 * (see supabase/migrations/*_ai_quota_usage.sql). The increment-and-check is a
 * single atomic upsert, so concurrent requests cannot slip past the limit.
 *
 * Authentication: the user id comes from the JWT `sub` claim. Signature
 * verification is enforced by the Supabase API gateway when "Verify JWT" is
 * enabled on the function (the default) — this module trusts the gateway.
 *
 * Failure mode is fail-OPEN (consistent with the detector sidecar): if the
 * quota store is unreachable, the request is allowed and the failure is
 * logged. A quota outage must not brick Ghost Mode mid-call; sustained abuse
 * still requires a working store, and failures are loud in the function logs.
 */

import { corsHeaders } from './cors.ts';

export const DEFAULT_WINDOW_MS = 3_600_000; // 1 hour, fixed windows

export interface QuotaResult {
  allowed: boolean;
  requestCount: number;
  remaining: number;
  resetAtMs: number;
  limit: number;
}

/** Minimal DB interface so the logic is unit-testable without PostgREST. */
export interface QuotaRpc {
  (args: {
    userId: string;
    functionName: string;
    windowStartIso: string;
    limit: number;
  }): Promise<{ requestCount: number; allowed: boolean }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function base64UrlDecode(input: string): string {
  let s = input.replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad === 2) s += '==';
  else if (pad === 3) s += '=';
  else if (pad !== 0) throw new Error('bad base64url length');
  return atob(s);
}

/**
 * Extract the Supabase user id (JWT `sub`) from the request. Returns null when
 * there is no bearer token, it is malformed, or the sub is not a UUID.
 */
export function extractUserId(req: Request): string | null {
  const auth =
    req.headers.get('authorization') ?? req.headers.get('Authorization');
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const parts = m[1].split('.');
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as { sub?: unknown };
    const sub = payload.sub;
    if (typeof sub === 'string' && UUID_RE.test(sub)) return sub;
    return null;
  } catch {
    return null;
  }
}

/** Start of the fixed window containing nowMs. Pure and unit-tested. */
export function quotaWindowStart(nowMs: number, windowMs: number): number {
  return Math.floor(nowMs / windowMs) * windowMs;
}

export function parseLimit(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback;
  const n = Math.floor(Number(raw));
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Atomically consume one quota unit. Returns the decision plus metadata for
 * rate-limit headers.
 */
export async function enforceQuota(opts: {
  rpc: QuotaRpc;
  userId: string;
  functionName: string;
  limit: number;
  windowMs?: number;
  nowMs?: number;
}): Promise<QuotaResult> {
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const nowMs = opts.nowMs ?? Date.now();
  const windowStart = quotaWindowStart(nowMs, windowMs);
  const resetAtMs = windowStart + windowMs;
  const { requestCount, allowed } = await opts.rpc({
    userId: opts.userId,
    functionName: opts.functionName,
    windowStartIso: new Date(windowStart).toISOString(),
    limit: opts.limit,
  });
  return {
    allowed,
    requestCount,
    remaining: Math.max(0, opts.limit - requestCount),
    resetAtMs,
    limit: opts.limit,
  };
}

/** PostgREST RPC caller used by edge functions (fetch is native in Deno). */
export function makePostgrestRpc(
  supabaseUrl: string,
  supabaseAnonKey: string,
): QuotaRpc {
  const url = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/consume_ai_quota`;
  return async (args) => {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_user_id: args.userId,
        p_function_name: args.functionName,
        p_window_start: args.windowStartIso,
        p_limit: args.limit,
      }),
    });
    if (!res.ok) {
      throw new Error(`quota RPC HTTP ${res.status}`);
    }
    const rows = (await res.json()) as Array<{
      request_count: number;
      allowed: boolean;
    }>;
    if (!rows || rows.length === 0) throw new Error('quota RPC empty result');
    return { requestCount: rows[0].request_count, allowed: rows[0].allowed };
  };
}

function jsonHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { ...corsHeaders, 'Content-Type': 'application/json', ...extra };
}

export function quotaHeaders(quota: QuotaResult): Record<string, string> {
  return {
    'X-RateLimit-Limit': String(quota.limit),
    'X-RateLimit-Remaining': String(quota.remaining),
    'X-RateLimit-Reset': String(Math.ceil(quota.resetAtMs / 1000)),
  };
}

/** Attach X-RateLimit-* headers to a normal response. */
export function withQuotaHeaders(res: Response, quota: QuotaResult): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(quotaHeaders(quota))) headers.set(k, v);
  return new Response(res.body, { status: res.status, headers });
}

export function quotaExceededResponse(quota: QuotaResult): Response {
  const retryAfter = Math.max(1, Math.ceil((quota.resetAtMs - Date.now()) / 1000));
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded for this AI endpoint. Please try again shortly.',
      retry_after_seconds: retryAfter,
    }),
    {
      status: 429,
      headers: jsonHeaders({
        'Retry-After': String(retryAfter),
        ...quotaHeaders(quota),
      }),
    },
  );
}

export function unauthorizedResponse(): Response {
  return new Response(JSON.stringify({ error: 'Authentication required' }), {
    status: 401,
    headers: jsonHeaders(),
  });
}

/**
 * Full gate for an AI edge function: require a user identity, then enforce
 * the per-user quota. Returns either { ok: true, userId, quota } or
 * { ok: false, response } with a ready-to-return 401/429 response.
 *
 * Quota-store failures fail OPEN (logged loudly) so a DB hiccup never bricks
 * call protection mid-call.
 */
export async function authorizeAndCheckQuota(
  req: Request,
  opts: { functionName: string; limit: number; windowMs?: number },
): Promise<
  | { ok: true; userId: string; quota: QuotaResult }
  | { ok: false; response: Response }
> {
  const userId = extractUserId(req);
  if (!userId) return { ok: false, response: unauthorizedResponse() };

  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS;
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('[rateLimit] SUPABASE_URL/ANON_KEY not configured; failing open');
    return {
      ok: true,
      userId,
      quota: {
        allowed: true,
        requestCount: 0,
        remaining: opts.limit,
        resetAtMs: Date.now() + windowMs,
        limit: opts.limit,
      },
    };
  }

  try {
    const quota = await enforceQuota({
      rpc: makePostgrestRpc(supabaseUrl, supabaseAnonKey),
      userId,
      functionName: opts.functionName,
      limit: opts.limit,
      windowMs,
    });
    if (!quota.allowed) return { ok: false, response: quotaExceededResponse(quota) };
    return { ok: true, userId, quota };
  } catch (e) {
    console.error('[rateLimit] quota store unreachable, failing open:', e);
    return {
      ok: true,
      userId,
      quota: {
        allowed: true,
        requestCount: 0,
        remaining: opts.limit,
        resetAtMs: Date.now() + windowMs,
        limit: opts.limit,
      },
    };
  }
}
