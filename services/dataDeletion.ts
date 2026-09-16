/**
 * Delete My Data flow (P3-1, GDPR/CCPA right to erasure).
 *
 * Server-side erasure runs in the SECURITY DEFINER `delete_my_data()`
 * RPC: it deletes the caller's rows from `analytics_events` and
 * `ai_quota_usage`, re-counts what is left (the verification), and only
 * then deletes the auth account. The client treats non-zero residuals as
 * a failure. Local erasure wipes this device's ShieldCall keys and the
 * analytics queue. Everything is verified, not assumed.
 */

export interface DataSummary {
  signedIn: boolean;
  /** Server-held rows reported by the my_data_summary() RPC. */
  analyticsEvents: number;
  quotaRows: number;
  /** ShieldCall AsyncStorage keys found on this device. */
  localKeys: number;
}

export interface DeletionReport {
  deletedAnalyticsEvents: number;
  deletedQuotaRows: number;
  /** Server-side residual counts after deletion; both must be 0. */
  residualAnalyticsEvents: number;
  residualQuotaRows: number;
  accountDeleted: boolean;
  localKeysRemoved: number;
  /** AsyncStorage keys still present after the wipe; must be 0. */
  residualLocalKeys: number;
}

/** Shape returned by the delete_my_data() RPC. */
interface DeleteMyDataRpcResult {
  deleted: { analytics_events: number; quota_rows: number };
  residual: { analytics_events: number; quota_rows: number };
  account_deleted: boolean;
}

/**
 * Pure check on the RPC result: the deletion only counts as verified when
 * both server-side residual counts are zero. Returns the residual counts
 * so callers can surface them honestly.
 */
export function verifyServerResiduals(
  result: DeleteMyDataRpcResult,
): { ok: boolean; residualAnalyticsEvents: number; residualQuotaRows: number } {
  const residualAnalyticsEvents = Number(result?.residual?.analytics_events ?? NaN);
  const residualQuotaRows = Number(result?.residual?.quota_rows ?? NaN);
  const ok =
    Number.isInteger(residualAnalyticsEvents) &&
    Number.isInteger(residualQuotaRows) &&
    residualAnalyticsEvents === 0 &&
    residualQuotaRows === 0;
  return { ok, residualAnalyticsEvents, residualQuotaRows };
}

async function asyncStorage(): Promise<{
  getAllKeys(): Promise<readonly string[]>;
  multiRemove(keys: string[]): Promise<void>;
}> {
  // Lazy require keeps this module importable in node unit tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-async-storage/async-storage').default;
}

/** True when a storage key belongs to ShieldCall AI. Pure. */
export function isShieldCallKey(key: string): boolean {
  const k = key.toLowerCase();
  return k.includes('shieldcallai') || k.includes('shieldcall');
}

function getSupabase() {
  // Lazy require: the client is a runtime dependency only.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('./supabaseClient').supabase;
}

/**
 * Summarise the data held about this user: server rows (via the
 * my_data_summary() RPC, signed-in users only) plus local keys.
 * Never throws; unknown parts report 0.
 */
export async function getMyDataSummary(): Promise<DataSummary> {
  const empty: DataSummary = { signedIn: false, analyticsEvents: 0, quotaRows: 0, localKeys: 0 };
  try {
    const AsyncStorage = await asyncStorage();
    empty.localKeys = (await AsyncStorage.getAllKeys()).filter(isShieldCallKey).length;
  } catch {
    // Best effort.
  }
  try {
    const supabase = getSupabase();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return empty;
    empty.signedIn = true;
    const { data, error } = await supabase.rpc('my_data_summary');
    if (!error && data) {
      empty.analyticsEvents = Number(data.analytics_events ?? 0);
      empty.quotaRows = Number(data.quota_rows ?? 0);
    }
  } catch {
    // Best effort: server counts stay 0 rather than breaking the screen.
  }
  return empty;
}

/**
 * Erase everything: server rows + auth account (via the delete_my_data()
 * RPC, which verifies zero residuals server-side), then this device's
 * local keys. Throws with an honest message when any step fails or the
 * server verification is not clean.
 */
export async function deleteMyData(): Promise<DeletionReport> {
  const supabase = getSupabase();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  let deletedAnalyticsEvents = 0;
  let deletedQuotaRows = 0;
  let residualAnalyticsEvents = 0;
  let residualQuotaRows = 0;
  let accountDeleted = false;

  if (session) {
    const { data, error } = await supabase.rpc('delete_my_data');
    if (error) {
      throw new Error(
        `Server deletion failed: ${error.message || 'unknown error'}. ` +
          'Your local data has NOT been touched. Please try again.',
      );
    }
    const check = verifyServerResiduals(data as DeleteMyDataRpcResult);
    if (!check.ok) {
      throw new Error(
        `Server deletion incomplete: ${check.residualAnalyticsEvents} analytics rows and ` +
          `${check.residualQuotaRows} quota rows remain. Nothing local was touched. Please contact privacy@shieldcallai.com.`,
      );
    }
    const parsed = data as DeleteMyDataRpcResult;
    deletedAnalyticsEvents = Number(parsed.deleted?.analytics_events ?? 0);
    deletedQuotaRows = Number(parsed.deleted?.quota_rows ?? 0);
    accountDeleted = parsed.account_deleted === true;
  }

  // The RPC above deleted the auth account, invalidating this session.
  // Now wipe the device: analytics queue/consent first, then every
  // ShieldCall key, then re-read to verify.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { clearAnalyticsData } = require('./analytics');
  await clearAnalyticsData();
  const AsyncStorage = await asyncStorage();
  const keys = (await AsyncStorage.getAllKeys()).filter(isShieldCallKey);
  const localKeysRemoved = keys.length;
  if (keys.length > 0) await AsyncStorage.multiRemove([...keys]);
  const residualLocalKeys = (await AsyncStorage.getAllKeys()).filter(isShieldCallKey).length;
  if (residualLocalKeys !== 0) {
    throw new Error(
      `Local wipe incomplete: ${residualLocalKeys} ShieldCall keys could not be removed.`,
    );
  }

  try {
    await supabase.auth.signOut();
  } catch {
    // The account is gone; the session is already dead. Best effort.
  }

  return {
    deletedAnalyticsEvents,
    deletedQuotaRows,
    residualAnalyticsEvents,
    residualQuotaRows,
    accountDeleted,
    localKeysRemoved,
    residualLocalKeys,
  };
}
