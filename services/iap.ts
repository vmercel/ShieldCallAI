/**
 * iap — Web stub. react-native-iap is a native-only module (StoreKit /
 * Play Billing) and cannot be bundled on the web platform. All exports
 * mirror the native implementation's public surface so TypeScript is
 * satisfied, but every callable throws IapUnavailableError at runtime.
 */

export type PlanId = 'free' | 'pro_monthly' | 'family_monthly';

export interface PlanProduct {
  planId: PlanId;
  sku: string;
  name: string;
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

export class IapUnavailableError extends Error {
  constructor(detail: string) {
    super(`In-app purchases are not available on this platform. ${detail}`);
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

export interface StoreProductInfo {
  plan: PlanProduct;
  localizedPrice: string | null;
  localizedTitle: string | null;
}

export interface PurchaseResult {
  planId: PlanId;
  transactionId: string;
}

const unavailable = () => {
  throw new IapUnavailableError('Purchases are only available on iOS and Android.');
};

export function planForSku(sku: string): PlanId {
  const found = PLAN_CATALOG.find((p) => p.sku === sku);
  return found ? found.planId : 'free';
}

export function skuForPlan(planId: Exclude<PlanId, 'free'>): string {
  const found = PLAN_CATALOG.find((p) => p.planId === planId);
  if (!found) throw new IapStoreError(`Unknown plan: ${planId}`);
  return found.sku;
}

export async function isIapAvailable(): Promise<boolean> {
  return false;
}

export async function connect(): Promise<void> {
  unavailable();
}

export async function disconnect(): Promise<void> {
  // no-op on web
}

export async function fetchPlanProducts(): Promise<StoreProductInfo[]> {
  unavailable();
  return [];
}

export function subscribe(_planId: Exclude<PlanId, 'free'>): Promise<PurchaseResult> {
  return Promise.reject(
    new IapUnavailableError('Purchases are only available on iOS and Android.')
  );
}

export async function restorePurchases(): Promise<PlanId[]> {
  unavailable();
  return [];
}

export async function getActivePlanId(): Promise<PlanId> {
  return 'free';
}

export async function openManageSubscriptions(): Promise<void> {
  unavailable();
}

export async function getPendingValidations(): Promise<
  { sku: string; transactionId: string | null; platform: string; purchasedAt: string }[]
> {
  return [];
}
