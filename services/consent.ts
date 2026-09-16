/**
 * Usage-data consent (P3-1, GDPR/CCPA).
 *
 * Analytics is opt-IN: nothing is collected until the user answers the
 * first-launch banner. The choice is persisted here and read by
 * services/analytics.ts before any event is queued.
 *
 * States:
 *  - 'unasked' : banner never answered (first launch). Analytics stays off.
 *  - 'granted' : user accepted. Analytics runs unless separately opted out.
 *  - 'denied'  : user declined. Analytics stays off, no nagging.
 */

export const ANALYTICS_CONSENT_KEY = 'shieldcallai_analytics_consent';

export type ConsentState = 'granted' | 'denied' | 'unasked';

/**
 * Normalise a raw storage value. Anything unexpected (corrupt data,
 * foreign values) maps to 'unasked' so the banner shows again. Pure.
 */
export function parseConsentState(raw: string | null | undefined): ConsentState {
  if (raw === 'granted' || raw === 'denied') return raw;
  return 'unasked';
}

async function asyncStorage(): Promise<{
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
  removeItem(k: string): Promise<void>;
}> {
  // Lazy require keeps this module importable in node unit tests.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-async-storage/async-storage').default;
}

/** Current consent state. Defaults to 'unasked' when never recorded. */
export async function getConsentState(): Promise<ConsentState> {
  try {
    const AsyncStorage = await asyncStorage();
    return parseConsentState(await AsyncStorage.getItem(ANALYTICS_CONSENT_KEY));
  } catch {
    return 'unasked';
  }
}

/** Record the user's choice. Never throws. */
export async function setConsentState(state: 'granted' | 'denied'): Promise<void> {
  try {
    const AsyncStorage = await asyncStorage();
    await AsyncStorage.setItem(ANALYTICS_CONSENT_KEY, state);
  } catch {
    // Consent must never break the app.
  }
}

/** Clear the recorded choice (used by Delete My Data). Never throws. */
export async function clearConsentState(): Promise<void> {
  try {
    const AsyncStorage = await asyncStorage();
    await AsyncStorage.removeItem(ANALYTICS_CONSENT_KEY);
  } catch {
    // Best effort.
  }
}
