/**
 * iap.ts — Web/SSR stub.
 *
 * react-native-iap is a native-only module. This stub is the web-platform
 * entry point so Metro never bundles the native store code on web. All
 * exports surface the same types and throw IapUnavailableError so callers
 * on web get an honest, handleable error.
 */

export type PlanId = 'free' | 'pro_monthly' | 'family_monthly';

export interface PlanProduct {
  planId: PlanId;
  sku: string;
  name: string;
  blurb: string;
}

export interface StoreProductInfo {
  plan: PlanProduct;
  localizedPrice: string | null;
  localizedTitle: string | null;
}

export interface PurchaseResult {
  planId: PlanId;
  transactionId: string;
}

export interface PendingValidation {
  sku: string;
  planId: PlanId;
  transactionId: string | null;
  platform: string;
  purchasedAt: string;
  payload: Record<string, unknown>;
}

export interface ServerValidationResult {
  planId: PlanId;
  expiresAt: string | null;
  transactionId: string;
}

export const PRO_MONTHLY_SKU_DEFAULT = 'shieldcall_pro_monthly';
export const FAMILY_MONTHLY_SKU_DEFAULT = 'shieldcall_family_monthly';

export const PLAN_CATALOG: PlanProduct[] = [
  {
    planId: 'pro_monthly',
    sku: PRO_MONTHLY_SKU_DEFAULT,
    name: 'ShieldCall Pro',
    blurb: 'Full scam-call protection for one line: live analysis, Ghost Mode AI, and call summaries.',
  },
  {
    planId: 'family_monthly',
    sku: FAMILY_MONTHLY_SKU_DEFAULT,
    name: 'ShieldCall Family',
    blurb: 'Everything in Pro, for up to 5 family lines under one subscription.',
  },
];

export class IapUnavailableError extends Error {
  constructor(detail = '') {
    super(`In-app purchases are not available on this platform. ${detail}`.trim());
    this.name = 'IapUnavailableError';
  }
}

export class IapStoreError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'IapStoreError';
    this.code = code;
  }
}

export class IapValidationUnavailableError extends Error {
  constructor() {
    super('Server-side receipt validation is not configured yet.');
    this.name = 'IapValidationUnavailableError';
  }
}

export function planForSku(_sku: string): PlanId { return 'free'; }
export function skuForPlan(_planId: Exclude<PlanId, 'free'>): string { throw new IapUnavailableError(); }
export async function isIapAvailable(): Promise<boolean> { return false; }
export async function connect(): Promise<void> { throw new IapUnavailableError(); }
export async function disconnect(): Promise<void> {}
export async function fetchPlanProducts(): Promise<StoreProductInfo[]> { throw new IapUnavailableError(); }
export function subscribe(_planId: Exclude<PlanId, 'free'>): Promise<PurchaseResult> { return Promise.reject(new IapUnavailableError()); }
export async function restorePurchases(): Promise<PlanId[]> { throw new IapUnavailableError(); }
export async function getActivePlanId(): Promise<PlanId> { return 'free'; }
export async function openManageSubscriptions(): Promise<void> { throw new IapUnavailableError(); }
export async function getPendingValidations(): Promise<PendingValidation[]> { return []; }
export async function validateReceiptWithServer(_purchase: any, _planId: Exclude<PlanId, 'free'>): Promise<ServerValidationResult> { throw new IapUnavailableError(); }
export async function fetchServerPlan(): Promise<PlanId | null> { return null; }
export async function retryPendingValidations(): Promise<{ validated: string[]; stillPending: string[] }> { return { validated: [], stillPending: [] }; }
