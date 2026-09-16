/**
 * Pure auth helpers for ShieldCall AI.
 *
 * Everything in this module is side-effect free and takes explicit inputs so
 * it can be unit-tested in node (scripts/check-auth.js) without a device,
 * AsyncStorage, or a Supabase project. Runtime code in AuthContext and
 * _layout.tsx builds on these helpers.
 */

/** Length of the email OTP code. Must match the Supabase project's
 *  mailer_otp_length and the OTP screen's digit boxes. */
export const OTP_CODE_LENGTH = 6;

/** Env var names for the optional __DEV__-only real test account.
 *  Never hardcode dev credentials: they live in the local .env only. */
export const DEV_TEST_EMAIL_VAR = 'EXPO_PUBLIC_DEV_TEST_EMAIL';
export const DEV_TEST_PASSWORD_VAR = 'EXPO_PUBLIC_DEV_TEST_PASSWORD';

/** Canonical form for every email sent to Supabase auth. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** True when the token looks like a complete OTP code (fast client-side
 *  rejection before hitting the network). */
export function isValidOtpFormat(token: string): boolean {
  return new RegExp(`^[0-9]{${OTP_CODE_LENGTH}}$`).test(token.trim());
}

/**
 * Shared password/confirm validation for sign-up and password reset.
 * Returns the user-facing error, or null when the pair is acceptable.
 */
export function validatePasswordPair(password: string, confirm: string): string | null {
  if (password.length < 6) return 'Password must be at least 6 characters.';
  if (password !== confirm) return 'Passwords do not match.';
  return null;
}

/** True when both dev-test-account env vars are set and non-blank. */
export function isDevTesterConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return (
    (env[DEV_TEST_EMAIL_VAR] ?? '').trim().length > 0 &&
    (env[DEV_TEST_PASSWORD_VAR] ?? '').trim().length > 0
  );
}

export type AuthDeepLinkKind = 'recovery' | 'session-code' | 'none';

export interface ClassifiedAuthDeepLink {
  kind: AuthDeepLinkKind;
  /** PKCE authorization code, when the link carries one. */
  code?: string;
}

/**
 * Classify an incoming deep link for the auth handler in app/_layout.tsx.
 *
 * - 'recovery': the link targets the password-reset flow
 *   (path contains reset-password, or a type=recovery marker).
 * - 'session-code': any other link carrying a PKCE `code` query param
 *   (e.g. an email-confirmation link) that must be exchanged for a session.
 * - 'none': not an auth link; the handler must ignore it.
 *
 * Never throws: an unparseable URL classifies as 'none' (or 'recovery'
 * when the marker text is present, so a malformed reset link still lands
 * on the reset screen where the real error surfaces).
 */
export function classifyAuthDeepLink(url: string | null | undefined): ClassifiedAuthDeepLink {
  if (!url) return { kind: 'none' };
  let code: string | undefined;
  try {
    const parsed = new URL(url);
    const c = parsed.searchParams.get('code');
    if (c) code = c;
  } catch {
    // Fall through: match on marker text only.
  }
  const lower = url.toLowerCase();
  const isRecovery = lower.includes('reset-password') || lower.includes('type=recovery');
  if (isRecovery) return { kind: 'recovery', code };
  if (code) return { kind: 'session-code', code };
  return { kind: 'none' };
}
