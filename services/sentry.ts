/**
 * Sentry crash reporting (P1-6).
 *
 * initSentry() is called once at app startup (app/_layout.tsx, module scope).
 * It is a graceful no-op when EXPO_PUBLIC_SENTRY_DSN is blank, so local dev
 * and preview builds work without any Sentry project.
 *
 * Privacy: ShieldCall handles calls, transcripts, and contacts. None of that
 * is ever passed to Sentry. captureAppError only sends the exception plus an
 * optional small string-valued context map; beforeSend drops the default
 * user object so no device user PII leaves the phone.
 *
 * The pure helpers (shouldInitSentry, getSentryOptions) take explicit args so
 * they are unit-testable without the native SDK: see scripts/check-sentry.js.
 */

import type * as SentryTypes from '@sentry/react-native';

export const SENTRY_DSN_VAR = 'EXPO_PUBLIC_SENTRY_DSN';

let initialized = false;

/** True when a DSN is configured (non-blank). */
export function shouldInitSentry(dsn: string | undefined): boolean {
  return typeof dsn === 'string' && dsn.trim().length > 0;
}

export interface SentryOptionsInput {
  isDev?: boolean;
  tracesSampleRate?: number;
}

/** Build the Sentry.init options. Pure and unit-tested. */
export function getSentryOptions(
  dsn: string,
  opts: SentryOptionsInput = {},
): Record<string, unknown> {
  return {
    dsn,
    // Native crash reporting (requires a dev build / store build; Expo Go
    // cannot load the native module, JS errors are still captured).
    enableNative: true,
    tracesSampleRate: opts.tracesSampleRate ?? 0.2,
    environment: opts.isDev ? 'development' : 'production',
    // Never attach user PII to crash reports.
    beforeSend(event: Record<string, unknown>) {
      const scrubbed = { ...event };
      delete scrubbed.user;
      return scrubbed;
    },
  };
}

/**
 * Initialize Sentry once. Returns true when initialized, false when disabled
 * (no DSN) or when init failed. Never throws.
 */
export function initSentry(): boolean {
  if (initialized) return true;
  const dsn = (process.env[SENTRY_DSN_VAR] || '').trim();
  if (!shouldInitSentry(dsn)) {
    if (typeof console !== 'undefined') {
      console.info(
        `[ShieldCall] Sentry disabled: ${SENTRY_DSN_VAR} is not set. ` +
          'Set it in .env to enable crash reporting.',
      );
    }
    return false;
  }
  try {
    // Lazy require keeps this module importable in node unit tests.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native') as typeof SentryTypes;
    const isDev = typeof __DEV__ !== 'undefined' && __DEV__;
    Sentry.init(getSentryOptions(dsn, { isDev }) as never);
    initialized = true;
    return true;
  } catch (e) {
    if (typeof console !== 'undefined') {
      console.warn('[ShieldCall] Sentry init failed:', e);
    }
    return false;
  }
}

/**
 * Report a caught error to Sentry. Safe to call before init or when Sentry
 * is disabled: it becomes a no-op. Context values must be short strings;
 * never pass transcripts, audio, or contact data.
 */
export function captureAppError(
  error: unknown,
  context?: Record<string, string>,
): void {
  try {
    if (!initialized) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require('@sentry/react-native') as typeof SentryTypes;
    Sentry.captureException(
      error,
      context ? { extra: context } : undefined,
    );
  } catch {
    // Reporting must never break the app.
  }
}
