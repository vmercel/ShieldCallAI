/**
 * ShieldCall AI — Server-side receipt validation (P1-2).
 *
 * POST /validate-receipt
 *
 * Verifies a store purchase against the Apple App Store Server API or the
 * Google Play Developer API and, on success, records the purchase and
 * updates the caller's plan in `user_plans`. The client can never grant
 * itself a plan: writes to `user_plans` / `iap_purchases` are service-role
 * only (no authenticated INSERT policies), and the plan written is derived
 * from the store's product ID, never from the client's claim.
 *
 * Request body:
 *   {
 *     "platform": "apple" | "google",
 *     "planId": "pro_monthly" | "family_monthly",   // client claim, verified
 *     "transactionId": string,                       // Apple transaction id
 *     "payload": {
 *       // apple:
 *       "signedTransaction": string,                 // StoreKit 2 JWS (optional but recommended)
 *       // google:
 *       "purchaseToken": string,
 *       "subscriptionId": string                     // optional; defaults to the plan's SKU
 *     }
 *   }
 *
 * Anti-forgery model:
 *   - Apple: the transaction id is looked up server-to-server with an
 *     App Store Connect API key (ES256 JWT). The response's productId,
 *     bundleId, revocation status, and expiry are checked. Forging a
 *     transaction id that the App Store returns as valid is not possible
 *     without a real purchase. NOTE: the signedTransaction JWS is decoded
 *     for its claims but its certificate chain is not re-verified in this
 *     version — the authenticated server-to-server lookup is the trust
 *     anchor. Full x5c chain verification is a future hardening item.
 *   - Google: the purchase token is checked against the androidpublisher
 *     API with a Play service account. Tokens are single-use secrets tied
 *     to the real purchase.
 *
 * Failure mode is fail-CLOSED: if the store credentials are not configured,
 * the endpoint answers 503 and never claims a receipt is valid. No paid
 * plan is ever invented.
 *
 * Required secrets (supabase secrets set):
 *   APPLE_IAP_ISSUER_ID, APPLE_IAP_KEY_ID, APPLE_IAP_PRIVATE_KEY (PEM)
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON (service-account JSON)
 * Optional env:
 *   SHIELDCALL_IOS_BUNDLE_ID (default com.shieldcallai.app)
 *   SHIELDCALL_ANDROID_PACKAGE (default com.shieldcallai.app)
 *   SHIELDCALL_IAP_PRO_MONTHLY_SKU / SHIELDCALL_IAP_FAMILY_MONTHLY_SKU
 */

import { corsHeaders } from '../_shared/cors.ts';
import { extractUserId } from '../_shared/rateLimit.ts';

const STORE_TIMEOUT_MS = 10_000;

const IOS_BUNDLE_ID =
  Deno.env.get('SHIELDCALL_IOS_BUNDLE_ID') || 'com.shieldcallai.app';
const ANDROID_PACKAGE =
  Deno.env.get('SHIELDCALL_ANDROID_PACKAGE') || 'com.shieldcallai.app';
const PRO_SKU =
  Deno.env.get('SHIELDCALL_IAP_PRO_MONTHLY_SKU') || 'shieldcall_pro_monthly';
const FAMILY_SKU =
  Deno.env.get('SHIELDCALL_IAP_FAMILY_MONTHLY_SKU') || 'shieldcall_family_monthly';

type PlanId = 'pro_monthly' | 'family_monthly';

function planForSku(sku: string): PlanId | null {
  if (sku === PRO_SKU) return 'pro_monthly';
  if (sku === FAMILY_SKU) return 'family_monthly';
  return null;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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

interface StoreVerification {
  ok: boolean;
  /** Plan derived from the store's product id. */
  planId: PlanId;
  sku: string;
  transactionId: string;
  originalTransactionId: string | null;
  expiresAt: string | null;
}

/* ---------------- Apple App Store Server API ---------------- */

async function appleSignedJwt(): Promise<string> {
  const issuer = Deno.env.get('APPLE_IAP_ISSUER_ID') || '';
  const keyId = Deno.env.get('APPLE_IAP_KEY_ID') || '';
  const privateKeyPem = Deno.env.get('APPLE_IAP_PRIVATE_KEY') || '';
  if (!issuer || !keyId || !privateKeyPem) {
    throw new Error('apple_iap_unconfigured');
  }
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8Der(privateKeyPem),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })),
  );
  const payload = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        iss: issuer,
        iat: now,
        exp: now + 3600,
        aud: 'appstoreconnect-v1',
        bid: IOS_BUNDLE_ID,
      }),
    ),
  );
  const unsigned = `${header}.${payload}`;
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(unsigned),
    ),
  );
  return `${unsigned}.${base64UrlEncode(sig)}`;
}

async function verifyApple(transactionId: string): Promise<StoreVerification> {
  let jwt: string;
  try {
    jwt = await appleSignedJwt();
  } catch {
    throw Object.assign(new Error('Apple receipt verification is not configured on the server yet.'), {
      httpStatus: 503,
      code: 'receipt_validation_unconfigured',
    });
  }

  const hosts = [
    'https://api.storekit.itunes.apple.com',
    'https://api.storekit-sandbox.itunes.apple.com',
  ];
  let lastStatus = 0;
  for (const host of hosts) {
    const res = await fetch(
      `${host}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`,
      {
        headers: { Authorization: `Bearer ${jwt}` },
        signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
      },
    );
    lastStatus = res.status;
    if (res.status === 404) continue; // try the other environment
    if (!res.ok) {
      throw Object.assign(
        new Error(`App Store Server API returned ${res.status}`),
        { httpStatus: 502, code: 'store_unavailable' },
      );
    }
    const data = await res.json();
    const signedTransaction = data?.signedTransactionInfo as string | undefined;
    if (!signedTransaction) {
      throw Object.assign(new Error('App Store response had no transaction info'), {
        httpStatus: 502,
        code: 'store_unavailable',
      });
    }
    // Decode the JWS payload. The authenticated server-to-server transaction
    // lookup above is the anti-forgery anchor (see module docstring).
    const parts = signedTransaction.split('.');
    if (parts.length < 2) {
      throw Object.assign(new Error('Malformed signed transaction from App Store'), {
        httpStatus: 502,
        code: 'store_unavailable',
      });
    }
    const txn = JSON.parse(base64UrlDecode(parts[1])) as {
      transactionId?: string;
      originalTransactionId?: string;
      productId?: string;
      bundleId?: string;
      revocationDate?: number;
      expiresDate?: number;
    };
    if (txn.bundleId !== IOS_BUNDLE_ID) {
      throw Object.assign(
        new Error('Transaction bundle id does not match this app'),
        { httpStatus: 422, code: 'receipt_invalid' },
      );
    }
    if (txn.revocationDate) {
      throw Object.assign(new Error('Transaction was revoked'), {
        httpStatus: 422,
        code: 'receipt_revoked',
      });
    }
    const planId = planForSku(txn.productId || '');
    if (!planId) {
      throw Object.assign(
        new Error(`Unknown product id ${txn.productId}`),
        { httpStatus: 422, code: 'receipt_invalid' },
      );
    }
    const expiresAt = txn.expiresDate ? new Date(txn.expiresDate).toISOString() : null;
    if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
      throw Object.assign(new Error('Subscription has expired'), {
        httpStatus: 422,
        code: 'receipt_expired',
      });
    }
    return {
      ok: true,
      planId,
      sku: txn.productId || '',
      transactionId: txn.transactionId || transactionId,
      originalTransactionId: txn.originalTransactionId || null,
      expiresAt,
    };
  }
  throw Object.assign(
    new Error(`Transaction not found at the App Store (last status ${lastStatus})`),
    { httpStatus: 404, code: 'transaction_not_found' },
  );
}

/* ---------------- Google Play Developer API ---------------- */

async function googleAccessToken(): Promise<string> {
  const raw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON') || '';
  if (!raw) {
    throw Object.assign(
      new Error('Google Play receipt verification is not configured on the server yet.'),
      { httpStatus: 503, code: 'receipt_validation_unconfigured' },
    );
  }
  const sa = JSON.parse(raw) as { client_email?: string; private_key?: string };
  if (!sa.client_email || !sa.private_key) {
    throw Object.assign(
      new Error('Google Play service account is incomplete.'),
      { httpStatus: 503, code: 'receipt_validation_unconfigured' },
    );
  }
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToPkcs8Der(sa.private_key),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })),
  );
  const payload = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({
        iss: sa.client_email,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
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
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
    signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw Object.assign(new Error(`Google OAuth token exchange failed (${res.status})`), {
      httpStatus: 502,
      code: 'store_unavailable',
    });
  }
  const data = await res.json();
  if (!data.access_token) {
    throw Object.assign(new Error('Google OAuth returned no access token'), {
      httpStatus: 502,
      code: 'store_unavailable',
    });
  }
  return data.access_token as string;
}

async function verifyGoogle(
  purchaseToken: string,
  subscriptionId: string,
): Promise<StoreVerification> {
  let accessToken: string;
  try {
    accessToken = await googleAccessToken();
  } catch (err: unknown) {
    throw err; // carries httpStatus 503 when unconfigured
  }
  const res = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(ANDROID_PACKAGE)}/purchases/subscriptionsv2/${encodeURIComponent(purchaseToken)}?alt=json`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
    },
  );
  if (res.status === 404) {
    throw Object.assign(new Error('Purchase token not found at Google Play'), {
      httpStatus: 404,
      code: 'transaction_not_found',
    });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Play Developer API returned ${res.status}`), {
      httpStatus: 502,
      code: 'store_unavailable',
    });
  }
  const data = await res.json();
  const lineItem = data?.lineItems?.[0];
  const productId: string = lineItem?.productId || subscriptionId;
  const planId = planForSku(productId);
  if (!planId) {
    throw Object.assign(new Error(`Unknown product id ${productId}`), {
      httpStatus: 422,
      code: 'receipt_invalid',
    });
  }
  const state: string = data?.subscriptionState || '';
  const active =
    state === 'SUBSCRIPTION_STATE_ACTIVE' ||
    state === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD';
  if (!active) {
    throw Object.assign(new Error(`Subscription is not active (${state || 'unknown state'})`), {
      httpStatus: 422,
      code: 'receipt_expired',
    });
  }
  const expiryMs = lineItem?.expiryTime ? Date.parse(lineItem.expiryTime) : NaN;
  const expiresAt = Number.isFinite(expiryMs) ? new Date(expiryMs).toISOString() : null;
  if (expiresAt && new Date(expiresAt).getTime() <= Date.now()) {
    throw Object.assign(new Error('Subscription has expired'), {
      httpStatus: 422,
      code: 'receipt_expired',
    });
  }
  return {
    ok: true,
    planId,
    sku: productId,
    transactionId: data?.latestOrderId || purchaseToken,
    originalTransactionId: null,
    expiresAt,
  };
}

/* ---------------- Database (service role) ---------------- */

async function dbRequest(path: string, init: RequestInit): Promise<Response> {
  const url = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !serviceKey) {
    throw new Error('Supabase service credentials are not available to the function');
  }
  return fetch(`${url}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(STORE_TIMEOUT_MS),
  });
}

async function recordPurchase(
  userId: string,
  platform: 'apple' | 'google',
  v: StoreVerification,
  purchaseToken: string | null,
): Promise<void> {
  const nowIso = new Date().toISOString();
  // Upsert the plan: the store-verified plan always wins over older state.
  const planRes = await dbRequest('/rest/v1/user_plans?on_conflict=user_id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: userId,
      plan_id: v.planId,
      source: 'store_receipt',
      expires_at: v.expiresAt,
      updated_at: nowIso,
    }),
  });
  if (!planRes.ok) {
    throw new Error(`Failed to update user plan (${planRes.status})`);
  }
  // Record the purchase; ignore repeats of the same transaction.
  await dbRequest('/rest/v1/iap_purchases', {
    method: 'POST',
    headers: { Prefer: 'resolution=ignore-duplicates' },
    body: JSON.stringify({
      user_id: userId,
      platform,
      plan_id: v.planId,
      sku: v.sku,
      transaction_id: v.transactionId,
      original_transaction_id: v.originalTransactionId,
      purchase_token: purchaseToken,
      status: 'valid',
      expires_at: v.expiresAt,
    }),
  });
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

    // Cheap health probe: reports whether each store's credentials are
    // configured (booleans only — no spend, no verification).
    if (body?.ping === true) {
      return json(200, {
        ok: true,
        service: 'validate-receipt',
        appleConfigured: !!(
          Deno.env.get('APPLE_IAP_ISSUER_ID') &&
          Deno.env.get('APPLE_IAP_KEY_ID') &&
          Deno.env.get('APPLE_IAP_PRIVATE_KEY')
        ),
        googleConfigured: !!Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'),
      });
    }

    const userId = extractUserId(req);
    if (!userId) {
      return json(401, { ok: false, error: 'authentication_required' });
    }

    const platform = body?.platform;
    const claimedPlan = body?.planId;
    if (platform !== 'apple' && platform !== 'google') {
      return json(400, { ok: false, error: 'invalid_platform' });
    }
    if (claimedPlan !== 'pro_monthly' && claimedPlan !== 'family_monthly') {
      return json(400, { ok: false, error: 'invalid_plan' });
    }

    let verified: StoreVerification;
    let purchaseToken: string | null = null;
    if (platform === 'apple') {
      const transactionId = body?.transactionId;
      if (typeof transactionId !== 'string' || !transactionId) {
        return json(400, { ok: false, error: 'missing_transaction_id' });
      }
      verified = await verifyApple(transactionId);
    } else {
      purchaseToken = body?.payload?.purchaseToken;
      if (typeof purchaseToken !== 'string' || !purchaseToken) {
        return json(400, { ok: false, error: 'missing_purchase_token' });
      }
      const subscriptionId =
        typeof body?.payload?.subscriptionId === 'string' && body.payload.subscriptionId
          ? body.payload.subscriptionId
          : skuForPlan(claimedPlan);
      verified = await verifyGoogle(purchaseToken, subscriptionId);
    }

    // The store's product id decides the plan — never the client's claim.
    if (verified.planId !== claimedPlan) {
      return json(409, {
        ok: false,
        error: 'plan_mismatch',
        detail: 'The store receipt is for a different plan than requested.',
      });
    }

    await recordPurchase(userId, platform, verified, purchaseToken);

    return json(200, {
      ok: true,
      planId: verified.planId,
      expiresAt: verified.expiresAt,
      transactionId: verified.transactionId,
    });
  } catch (err: unknown) {
    const e = err as { httpStatus?: number; code?: string; message?: string };
    const status =
      typeof e?.httpStatus === 'number' && e.httpStatus >= 400 && e.httpStatus < 600
        ? e.httpStatus
        : 500;
    // Never leak store internals; surface only the stable error code.
    return json(status, {
      ok: false,
      error: e?.code || 'validation_failed',
      detail: status === 503 ? e?.message : undefined,
    });
  }
});

function skuForPlan(planId: PlanId): string {
  return planId === 'pro_monthly' ? PRO_SKU : FAMILY_SKU;
}
