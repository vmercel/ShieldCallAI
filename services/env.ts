/**
 * Environment validation for ShieldCall.
 *
 * Call assertEnv() once at app startup (app/_layout.tsx). It throws a loud,
 * descriptive error when required variables are missing, instead of letting
 * the app boot into a broken state (e.g. Supabase auth silently failing with
 * an empty anon key).
 *
 * The pure helpers take an explicit env record so they are unit-testable
 * without touching process.env.
 */

const REQUIRED_VARS = ['EXPO_PUBLIC_SUPABASE_ANON_KEY'] as const;

/** Every variable the startup check treats as required. */
export const REQUIRED_ENV_VARS: readonly string[] = REQUIRED_VARS;

type EnvRecord = Record<string, string | undefined>;

function readVar(env: EnvRecord, name: string): string {
  return (env[name] || '').trim();
}

/** Names of required variables that are missing or blank. */
export function getMissingRequiredVars(env: EnvRecord = process.env): string[] {
  return (REQUIRED_VARS as readonly string[]).filter(
    (name) => readVar(env, name).length === 0,
  );
}

/**
 * Throw a descriptive error when required variables are missing.
 * Call this at module scope in app/_layout.tsx so misconfiguration fails
 * fast at startup instead of surfacing as mysterious runtime failures.
 */
export function assertEnv(env: EnvRecord = process.env): void {
  const missing = getMissingRequiredVars(env);
  if (missing.length > 0) {
    throw new Error(
      `[ShieldCall] Missing required environment variable(s): ${missing.join(', ')}.\n` +
        'Copy .env.example to .env at the repo root and fill in real values, then restart the app.\n' +
        'See .env.example for what each variable is for.',
    );
  }
}

/** Convenience accessor for the app's public env vars (may be blank). */
export function getEnv(env: EnvRecord = process.env): {
  supabaseAnonKey: string;
  supabaseUrl: string;
  shieldcallUrl: string;
} {
  return {
    supabaseAnonKey: readVar(env, 'EXPO_PUBLIC_SUPABASE_ANON_KEY'),
    supabaseUrl: readVar(env, 'EXPO_PUBLIC_SUPABASE_URL'),
    shieldcallUrl: readVar(env, 'EXPO_PUBLIC_SHIELDCALL_URL'),
  };
}
