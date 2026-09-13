/**
 * Privacy-safe analytics (P1-7).
 *
 * Feature usage only. Never audio, transcripts, phone numbers, names, or
 * contact content. Enforcement is structural, not a promise:
 *
 * - Event names are allowlisted (buildEvent returns null otherwise).
 * - Props accept only string | number | boolean. Strings are capped at 64
 *   chars and values that look like phone numbers or emails are dropped.
 * - Objects, arrays, and functions are never serialized.
 * - The user can opt out in Settings; opting out drops the unsent queue.
 * - Events are inserted into the `analytics_events` table, which has an
 *   INSERT-only RLS policy (users can never read events back).
 *
 * trackEvent() never throws and is safe to call from any UI handler.
 * The pure helpers (isAllowedEvent, scrubProps, buildEvent) are unit-tested
 * in node: see scripts/check-analytics.js.
 */

export const ANALYTICS_OPT_OUT_KEY = 'shieldcall_analytics_optout';

const ALLOWED_EVENTS = [
  'app_open',
  'ghost_mode_toggled',
  'detector_lab_opened',
  'analytics_opt_out_changed',
] as const;

export type AnalyticsEventName = (typeof ALLOWED_EVENTS)[number];

/** True when the event name is in the allowlist. */
export function isAllowedEvent(name: string): name is AnalyticsEventName {
  return (ALLOWED_EVENTS as readonly string[]).includes(name);
}

export type AnalyticsProps = Record<string, string | number | boolean>;

const MAX_STR_LEN = 64;
const PHONE_LIKE = /(\+?\d[\d\s().-]{5,}\d)/;
const EMAIL_LIKE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/**
 * Scrub caller-supplied props down to safe primitives. Drops anything that
 * is not a string/number/boolean, truncates long strings, and drops values
 * that look like phone numbers or email addresses. Pure and unit-tested.
 */
export function scrubProps(
  props: Record<string, unknown> | undefined,
): AnalyticsProps {
  const out: AnalyticsProps = {};
  if (!props) return out;
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === 'boolean' || typeof v === 'number') {
      out[k] = v;
      continue;
    }
    if (typeof v !== 'string') continue; // objects/arrays/functions: never
    const s = v.length > MAX_STR_LEN ? v.slice(0, MAX_STR_LEN) : v;
    if (PHONE_LIKE.test(s) || EMAIL_LIKE.test(s)) continue; // possible PII
    out[k] = s;
  }
  return out;
}

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  props: AnalyticsProps;
  /** ISO timestamp of when the event was built on-device. */
  ts: string;
}

/**
 * Build a validated event, or null when the name is not allowlisted.
 * Pure and unit-tested.
 */
export function buildEvent(
  name: string,
  props?: Record<string, unknown>,
): AnalyticsEvent | null {
  if (!isAllowedEvent(name)) {
    if (typeof console !== 'undefined') {
      console.warn(`[ShieldCall] analytics: unknown event "${name}" dropped`);
    }
    return null;
  }
  return { name, props: scrubProps(props), ts: new Date().toISOString() };
}

const QUEUE_KEY = 'shieldcall_analytics_queue';
const MAX_QUEUE = 200;
const FLUSH_DELAY_MS = 15000;
const BATCH_SIZE = 50;

let enabledCache: boolean | null = null;
let queue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function asyncStorage(): Promise<{
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
}> {
  // Lazy require keeps this module importable in node unit tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-async-storage/async-storage').default;
}

async function ensureLoaded(): Promise<boolean> {
  if (enabledCache !== null) return enabledCache;
  try {
    const AsyncStorage = await asyncStorage();
    const raw = await AsyncStorage.getItem(ANALYTICS_OPT_OUT_KEY);
    enabledCache = raw !== 'true';
    const q = await AsyncStorage.getItem(QUEUE_KEY);
    if (q) {
      const arr = JSON.parse(q);
      if (Array.isArray(arr)) queue = (arr as AnalyticsEvent[]).slice(-MAX_QUEUE);
    }
  } catch {
    enabledCache = true;
  }
  return enabledCache as boolean;
}

async function persistQueue(): Promise<void> {
  try {
    const AsyncStorage = await asyncStorage();
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    // Best effort: the in-memory queue still works for this session.
  }
}

function scheduleFlush(): void {
  if (flushTimer !== null) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flushAnalytics().catch(() => {});
  }, FLUSH_DELAY_MS);
}

/**
 * Record a feature-usage event. No-op when the user opted out or the event
 * name is not allowlisted. Never throws.
 */
export async function trackEvent(
  name: string,
  props?: Record<string, unknown>,
): Promise<void> {
  try {
    const enabled = await ensureLoaded();
    if (!enabled) return;
    const evt = buildEvent(name, props);
    if (!evt) return;
    queue.push(evt);
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    await persistQueue();
    scheduleFlush();
  } catch {
    // Analytics must never break the app.
  }
}

/** Current opt-in state (default: enabled). */
export async function isAnalyticsEnabled(): Promise<boolean> {
  return ensureLoaded();
}

/**
 * Opt the user in or out. Opting out immediately drops unsent events.
 * The opt-in itself is reported; the opt-out is not (the user said no).
 */
export async function setAnalyticsEnabled(enabled: boolean): Promise<void> {
  try {
    const AsyncStorage = await asyncStorage();
    await AsyncStorage.setItem(ANALYTICS_OPT_OUT_KEY, enabled ? 'false' : 'true');
    enabledCache = enabled;
    if (enabled) {
      await trackEvent('analytics_opt_out_changed', { enabled: true });
    } else {
      queue = [];
      await persistQueue();
    }
  } catch {
    // Keep the cached value consistent even if storage failed.
    enabledCache = enabled;
  }
}

/**
 * Send queued events to Supabase (insert-only table). Stays queued when
 * offline or signed out; retries on the next flush. Returns events sent.
 */
export async function flushAnalytics(): Promise<number> {
  try {
    if (!(await ensureLoaded())) return 0;
    if (queue.length === 0) return 0;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { supabase } = require('./supabaseClient');
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return 0;
    const batch = queue.slice(0, BATCH_SIZE);
    const rows = batch.map((e) => ({
      user_id: session.user.id,
      event_name: e.name,
      props: e.props,
      created_at: e.ts,
    }));
    const { error } = await supabase.from('analytics_events').insert(rows);
    if (error) return 0;
    queue = queue.slice(batch.length);
    await persistQueue();
    return batch.length;
  } catch {
    return 0;
  }
}

/**
 * Call once at app startup. Loads the opt-out flag and flushes events that
 * were queued while the app was closed or offline.
 */
export async function initAnalytics(): Promise<void> {
  try {
    await ensureLoaded();
    flushAnalytics().catch(() => {});
  } catch {
    // Analytics must never break startup.
  }
}
