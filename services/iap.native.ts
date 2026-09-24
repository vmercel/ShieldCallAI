/**
 * iap.native — NATIVE-PLATFORM In-app purchases via the platform stores
 * (StoreKit on iOS, Play Billing on Android) using react-native-iap v16
 * (OpenIAP / Nitro).
 *
 * Metro loads this file (not iap.ts) on iOS/Android. iap.ts is the web/SSR
 * stub. This split exists so the web bundler never tries to resolve the
 * native store module.
 *
 * The product catalog is fixed in code (monthly, family) but the actual store
 * product IDs are env-overridable (EXPO_PUBLIC_IAP_PRO_MONTHLY_SKU,
 * EXPO_PUBLIC_IAP_FAMILY_MONTHLY_SKU) so the IDs created in App Store Connect
 * and Google Play Console can be wired in without a code change.
 *
 * The native store module is loaded lazily. In builds where it is not linked
 * (Expo Go, web, or a build that skipped `expo prebuild`) every public call
 * throws IapUnavailableError with an honest message — there are no mock,
 * simulated, or fake purchase paths anywhere in this module.
 *
 * Receipt verification: after the store fires the purchase event, the
 * receipt is sent to the validate-receipt edge function (P1-2), which
 * verifies it against the Apple App Store Server API or the Google Play
 * Developer API and records the plan server-side. Until the store API
 * credentials are configured on the server, the endpoint answers 503 and
 * the purchase stays in the local pending-validation queue — the app never
 * invents a paid plan.
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type PlanId = 'free' | 'pro_monthly' | 'family_monthly';

export interface PlanProduct {
  planId: PlanId;
  /** Store product ID (env-overridable; must match App Store Connect / Play Console). */
  sku: string;
  /** Marketing name shown in the paywall. */
  name: string;
  /** One-line pitch. */
  blurb: string;
}

export const PRO_MONTHLY_SKU_DEFAULT = 'shieldcall_pro_monthly';
export const FAMILY_MONTHLY_SKU_DEFAULT = 'shieldcall_family_monthly';

export const PLAN_CATALOG: PlanProduct[] = [
  {
    planId: 'pro_monthly',
    sku: process.env.EXPO_PUBLIC_IAP_PRO_MONTHLY_SKU || PRO_MONTHLY_SKU_DEFAULT,
    name: 'ShieldCall Pro',
    blurb: 'Full scam-call protection for one line: live analysis, Ghost Mode AI, and call summaries.',
  },
  {
    planId: 'family_monthly',
    sku: process.env.EXPO_PUBLIC_IAP_FAMILY_MONTHLY_SKU || FAMILY_MONTHLY_SKU_DEFAULT,
    name: 'ShieldCall Family',
    blurb: 'Everything in Pro, for up to 5 family lines under one subscription.',
  },
];

const PENDING_VALIDATION_KEY = 'shieldcall_iap_pending_validation';

export class IapUnavailableError extends Error {
  constructor(detail: string) {
    super(`In-app purchases are not available on this build. ${detail}`);
    this.name = 'IapUnavailableError';
  }
}

export class IapStoreError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'IapStoreError';
  }
}

type RniapModule = typeof import('react-native-iap');

let cachedModule: RniapModule | null = null;
let moduleLoadFailed = false;

/** Lazily require the native store module. Throws IapUnavailableError when it is not linked. */
function getIap(): RniapModule {
  if (cachedModule) return cachedModule;
  if (moduleLoadFailed) {
    throw new IapUnavailableError('The native store module is not linked (use a development or production build, not Expo Go).');
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-iap') as RniapModule;
    if (typeof mod.initConnection !== 'function') {
      throw new Error('module loaded but initConnection is not a function');
    }
    cachedModule = mod;
    return mod;
  } catch {
    moduleLoadFailed = true;
    throw new IapUnavailableError(
      'The native store module is not linked (use a development or production build, not Expo Go).'
    );
  }
}

export function planForSku(sku: string): PlanId {
  const found = PLAN_CATALOG.find((p) => p.sku === sku);
  return found ? found.planId : 'free';
}

export function skuForPlan(planId: Exclude<PlanId, 'free'>): string {
  const found = PLAN_CATALOG.find((p) => p.planId === planId);
  if (!found) throw new IapStoreError(`Unknown plan: ${planId}`);
  return found.sku;
}

/** True when the store connection can be established (false on Expo Go / web). */
export async function isIapAvailable(): Promise<boolean> {
  try {
    getIap();
    return true;
  } catch {
    return false;
  }
}

export async function connect(): Promise<void> {
  const rniap = getIap();
  await rniap.initConnection();
}

export async function disconnect(): Promise<void> {
  if (!cachedModule) return;
  try {
    await cachedModule.endConnection();
  } catch {
    // endConnection failing is non-fatal; drop the cached module anyway.
  }
  cachedModule = null;
  moduleLoadFailed = false;
}

export interface StoreProductInfo {
  plan: PlanProduct;
  /** Store-localized price, e.g. "$4.99" — null when the store did not return the product. */
  localizedPrice: string | null;
  localizedTitle: string | null;
}

/**
 * Fetch the catalog products from the store. Products that the store does not
 * return (store products not created yet, wrong SKU) come back with null
 * pricing so the paywall can show an honest "not available" state instead of
 * a button that can never work.
 */
export async function fetchPlanProducts(): Promise<StoreProductInfo[]> {
  const rniap = getIap();
  const skus = PLAN_CATALOG.map((p) => p.sku);
  let fetched: any[] = [];
  try {
    // react-native-iap v16 (OpenIAP): fetchProducts(skus, type).
    fetched = (await (rniap.fetchProducts as any)(skus, 'subs')) as any[];
  } catch (err: any) {
    throw new IapStoreError(`Could not load products from the store: ${err?.message || err}`, err?.code);
  }
  const bySku = new Map<string, any>();
  for (const p of fetched) bySku.set(p.id, p);
  return PLAN_CATALOG.map((plan) => {
    const store = bySku.get(plan.sku);
    return {
      plan,
      localizedPrice: store?.displayPrice ?? null,
      localizedTitle: store?.title ?? store?.displayName ?? null,
    };
  });
}

export interface PurchaseResult {
  planId: PlanId;
  /** Store transaction identifier (never a secret; safe to log and send to the server). */
  transactionId: string;
}

/**
 * Extract the Google Play subscription offer token for a fetched product.
 * react-native-iap v16 surfaces subscriptionOffers as a JSON string.
 */
function androidOfferToken(product: any): string | null {
  try {
    const raw = product?.subscriptionOffers;
    if (!raw) return null;
    const offers = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(offers) && offers.length > 0) {
      return offers[0]?.id ?? offers[0]?.offerToken ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Start a subscription purchase for a plan. Event-based: resolves with the
 * finished purchase when the store fires purchaseUpdated for the requested
 * SKU, rejects when the user cancels or the purchase errors.
 *
 * The transaction is finished (consumed/acknowledged per platform) before
 * resolving, so no purchase is left dangling. Server-side receipt validation
 * is pending P1-2; the receipt is recorded locally as pending validation.
 */
export function subscribe(planId: Exclude<PlanId, 'free'>): Promise<PurchaseResult> {
  const rniap = getIap();
  const sku = skuForPlan(planId);

  return new Promise<PurchaseResult>((resolve, reject) => {
    let settled = false;
    const subscriptions: { remove: () => void }[] = [];

    const cleanup = () => {
      for (const s of subscriptions) {
        try {
          s.remove();
        } catch {
          /* ignore */
        }
      }
    };
    const settleResolve = (value: PurchaseResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const settleReject = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const updatedSub = rniap.purchaseUpdatedListener(async (purchase: any) => {
      try {
        if (purchase.productId !== sku) return;
        await rniap.finishTransaction({ purchase, isConsumable: false });
        await recordPendingValidation(purchase);
        // Best-effort server-side validation (P1-2). When the server is
        // unreachable or not yet configured, the purchase stays in the
        // pending queue for retryPendingValidations(); the store still
        // holds the entitlement, so nothing is lost.
        try {
          await validateReceiptWithServer(purchase, planId);
        } catch {
          /* pending queue retains it */
        }
        settleResolve({
          planId,
          transactionId: purchase.transactionId || purchase.id || 'unknown',
        });
      } catch (err: any) {
        settleReject(new IapStoreError(`Purchase succeeded but finishing the transaction failed: ${err?.message || err}`, err?.code));
      }
    });
    const errorSub = rniap.purchaseErrorListener((error: any) => {
      const code = error?.code || '';
      if (code === 'E_USER_CANCELLED') {
        settleReject(new IapStoreError('Purchase cancelled.', code));
      } else {
        settleReject(new IapStoreError(`Purchase failed: ${error?.message || code || 'unknown error'}`, code));
      }
    });
    subscriptions.push(updatedSub, errorSub);

    (async () => {
      try {
        await rniap.initConnection();
        if (Platform.OS === 'android') {
          // Play Billing requires the offer token for subscriptions.
          const products = (await (rniap.fetchProducts as any)([sku], 'subs')) as any[];
          const product = products.find((p) => p.id === sku);
          const offerToken = androidOfferToken(product);
          if (!offerToken) {
            settleReject(new IapStoreError('No subscription offer found for this product on Google Play.'));
            return;
          }
          await rniap.requestPurchase({
            request: { google: { skus: [sku], subscriptionOffers: [{ sku, offerToken }] } },
            type: 'subs',
          } as any);
        } else {
          await rniap.requestPurchase({ request: { apple: { sku } }, type: 'subs' } as any);
        }
      } catch (err: any) {
        settleReject(new IapStoreError(`Could not start the purchase: ${err?.message || err}`, err?.code));
      }
    })();
  });
}

/** Restore past purchases; returns the plan IDs that have active store entitlements. */
export async function restorePurchases(): Promise<PlanId[]> {
  const rniap = getIap();
  try {
    await rniap.initConnection();
    await rniap.restorePurchases();
    const purchases: any[] = await rniap.getAvailablePurchases();
    const plans = new Set<PlanId>();
    for (const p of purchases) {
      const plan = planForSku(p.productId);
      if (plan !== 'free') plans.add(plan);
    }
    return [...plans];
  } catch (err: any) {
    throw new IapStoreError(`Restore failed: ${err?.message || err}`, err?.code);
  }
}

/**
 * The best-known plan. The server-verified plan (written by the
 * validate-receipt edge function after a successful store verification)
 * takes precedence when the user is signed in; the store's available
 * purchases are the fallback. 'free' covers both "no purchases" and
 * "store unavailable" — the app never invents a paid plan.
 */
export async function getActivePlanId(): Promise<PlanId> {
  try {
    const serverPlan = await fetchServerPlan();
    if (serverPlan && serverPlan !== 'free') return serverPlan;
  } catch {
    // Server unreachable or signed out: fall through to the store.
  }
  let rniap: RniapModule;
  try {
    rniap = getIap();
  } catch {
    return 'free';
  }
  try {
    await rniap.initConnection();
    const purchases: any[] = await rniap.getAvailablePurchases();
    let best: PlanId = 'free';
    for (const p of purchases) {
      const plan = planForSku(p.productId);
      if (plan === 'family_monthly') return 'family_monthly';
      if (plan === 'pro_monthly') best = 'pro_monthly';
    }
    return best;
  } catch {
    return 'free';
  }
}

/** Open the platform's subscription-management UI (required App Store review affordance lives here). */
export async function openManageSubscriptions(): Promise<void> {
  const rniap = getIap();
  try {
    await rniap.deepLinkToSubscriptions();
  } catch (err: any) {
    throw new IapStoreError(`Could not open subscription management: ${err?.message || err}`, err?.code);
  }
}

/** A purchase receipt awaiting (or having survived) server-side validation. */
export interface PendingValidation {
  sku: string;
  planId: PlanId;
  transactionId: string | null;
  platform: string;
  purchasedAt: string;
  /** Receipt payload sent to the validate-receipt endpoint (user's own receipt, meant for the server). */
  payload: Record<string, unknown>;
}

/** Extract the server payload fields from an OpenIAP purchase object. */
function payloadForPurchase(purchase: any): Record<string, unknown> {
  if (Platform.OS === 'android') {
    return { purchaseToken: purchase.purchaseToken ?? null };
  }
  return {
    signedTransaction:
      purchase.jwsRepresentation ?? purchase.transactionReceipt ?? null,
  };
}

/** Store a purchased receipt locally as pending server-side validation (P1-2). */
async function recordPendingValidation(purchase: any): Promise<void> {
  try {
    const raw = (await SecureStore.getItemAsync(PENDING_VALIDATION_KEY)) || '[]';
    const list: any[] = JSON.parse(raw);
    const txId = purchase.transactionId || purchase.id || null;
    if (!list.some((e: any) => e.transactionId && e.transactionId === txId)) {
      list.push({
        sku: purchase.productId,
        planId: planForSku(purchase.productId),
        transactionId: txId,
        platform: Platform.OS,
        purchasedAt: new Date().toISOString(),
        payload: payloadForPurchase(purchase),
      });
    }
    await SecureStore.setItemAsync(PENDING_VALIDATION_KEY, JSON.stringify(list));
  } catch {
    // Failing to record is non-fatal: the store still holds the entitlement.
  }
}

/** Receipts purchased on-device that still need server-side validation (P1-2). */
export async function getPendingValidations(): Promise<PendingValidation[]> {
  try {
    const raw = (await SecureStore.getItemAsync(PENDING_VALIDATION_KEY)) || '[]';
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/** Drop one transaction from the pending-validation queue. */
async function clearPendingValidation(transactionId: string | null): Promise<void> {
  if (!transactionId) return;
  try {
    const raw = (await SecureStore.getItemAsync(PENDING_VALIDATION_KEY)) || '[]';
    const list: any[] = JSON.parse(raw);
    const kept = list.filter((e: any) => e.transactionId !== transactionId);
    await SecureStore.setItemAsync(PENDING_VALIDATION_KEY, JSON.stringify(kept));
  } catch {
    // Non-fatal; the entry will be retried and deduped server-side.
  }
}

/** Thrown when the server cannot verify receipts yet (store API keys not configured). */
export class IapValidationUnavailableError extends Error {
  constructor() {
    super('Server-side receipt validation is not configured yet; the purchase is recorded and will be validated later.');
    this.name = 'IapValidationUnavailableError';
  }
}

export interface ServerValidationResult {
  planId: PlanId;
  expiresAt: string | null;
  transactionId: string;
}

/**
 * Send a store purchase to the validate-receipt edge function for
 * server-side verification (P1-2). On success the pending record is
 * cleared and the server has recorded the plan. Throws
 * IapValidationUnavailableError when the server is not configured yet
 * (503), IapStoreError for invalid/rejected receipts.
 */
export async function validateReceiptWithServer(
  purchase: any,
  planId: Exclude<PlanId, 'free'>,
): Promise<ServerValidationResult> {
  const { supabase } = await import('./supabaseClient');
  const platform = Platform.OS === 'android' ? 'google' : 'apple';
  const transactionId = purchase.transactionId || purchase.id || null;
  let data: any;
  let error: any;
  try {
    ({ data, error } = await supabase.functions.invoke('validate-receipt', {
      body: {
        platform,
        planId,
        transactionId,
        payload: payloadForPurchase(purchase),
      },
    }));
  } catch (err: any) {
    throw new IapStoreError(`Could not reach the validation server: ${err?.message || err}`);
  }
  if (error) {
    const status = error?.context?.status ?? error?.status;
    if (status === 503) throw new IapValidationUnavailableError();
    throw new IapStoreError(
      `Receipt validation failed: ${data?.error || error?.message || 'unknown error'}`,
    );
  }
  if (!data?.ok) {
    throw new IapStoreError(`Receipt validation failed: ${data?.error || 'unknown error'}`);
  }
  await clearPendingValidation(transactionId);
  return {
    planId: data.planId,
    expiresAt: data.expiresAt ?? null,
    transactionId: data.transactionId,
  };
}

/**
 * The server-verified plan for the signed-in user (my_current_plan RPC),
 * or null when signed out / unreachable. Never invents a plan.
 */
export async function fetchServerPlan(): Promise<PlanId | null> {
  const { supabase } = await import('./supabaseClient');
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) return null;
    const { data, error } = await (supabase as any).rpc('my_current_plan');
    if (error || !data || data.length === 0) return null;
    const planId = data[0]?.plan_id;
    return planId === 'pro_monthly' || planId === 'family_monthly' || planId === 'free'
      ? planId
      : null;
  } catch {
    return null;
  }
}

/**
 * Retry server-side validation for every pending purchase (e.g. purchases
 * made while the server was unconfigured). Returns the transaction ids
 * that validated and those still pending.
 */
export async function retryPendingValidations(): Promise<{ validated: string[]; stillPending: string[] }> {
  const pending = await getPendingValidations();
  const validated: string[] = [];
  const stillPending: string[] = [];
  for (const entry of pending) {
    if (entry.planId === 'free' || !entry.transactionId) {
      stillPending.push(entry.transactionId || 'unknown');
      continue;
    }
    try {
      await validateReceiptWithServer(
        {
          transactionId: entry.transactionId,
          productId: entry.sku,
          ...(entry.platform === 'android'
            ? { purchaseToken: (entry.payload as any)?.purchaseToken ?? null }
            : {
                jwsRepresentation: (entry.payload as any)?.signedTransaction ?? null,
              }),
        },
        entry.planId,
      );
      validated.push(entry.transactionId);
    } catch {
      stillPending.push(entry.transactionId);
    }
  }
  return { validated, stillPending };
}
