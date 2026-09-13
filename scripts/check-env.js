#!/usr/bin/env node
/**
 * Env consistency check for ShieldCallAI.
 *
 * Verifies that:
 *  1. Every variable required by services/env.ts (REQUIRED_ENV_VARS) is
 *     documented with a placeholder in .env.example.
 *  2. If a real .env file exists at the repo root, it defines every required
 *     variable with a non-blank value (values are never printed).
 *
 * Usage: node scripts/check-env.js   (or: npm run check:env)
 * Exit code 0 = OK, 1 = misconfiguration.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const EXAMPLE_PATH = path.join(ROOT, '.env.example');
const ENV_TS_PATH = path.join(ROOT, 'services', 'env.ts');
const DOTENV_PATH = path.join(ROOT, '.env');

function fail(message) {
  console.error(`[check-env] FAIL: ${message}`);
  process.exit(1);
}

function parseExampleKeys(text) {
  const keys = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (m) keys.push(m[1]);
  }
  return keys;
}

function parseRequiredVars(tsSource) {
  // Matches: const REQUIRED_VARS = ['A', 'B'] as const;
  const m = tsSource.match(/const\s+REQUIRED_VARS\s*=\s*\[([\s\S]*?)\]\s*as\s+const/);
  if (!m) fail('could not find REQUIRED_VARS in services/env.ts');
  const vars = [];
  const re = /['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g;
  let hit;
  while ((hit = re.exec(m[1])) !== null) vars.push(hit[1]);
  if (vars.length === 0) fail('REQUIRED_VARS parsed as empty in services/env.ts');
  return vars;
}

function parseDotEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

if (!fs.existsSync(EXAMPLE_PATH)) fail('.env.example is missing at the repo root');
if (!fs.existsSync(ENV_TS_PATH)) fail('services/env.ts is missing');

const exampleKeys = parseExampleKeys(fs.readFileSync(EXAMPLE_PATH, 'utf8'));
const requiredVars = parseRequiredVars(fs.readFileSync(ENV_TS_PATH, 'utf8'));

const undocumented = requiredVars.filter((v) => !exampleKeys.includes(v));
if (undocumented.length > 0) {
  fail(
    `required var(s) not documented in .env.example: ${undocumented.join(', ')}. ` +
      'Add placeholders to .env.example.',
  );
}
console.log(`[check-env] OK: ${requiredVars.length} required var(s) documented in .env.example.`);

if (fs.existsSync(DOTENV_PATH)) {
  const dotenv = parseDotEnv(fs.readFileSync(DOTENV_PATH, 'utf8'));
  const missing = requiredVars.filter((v) => !(dotenv[v] || '').trim());
  if (missing.length > 0) {
    fail(
      `.env exists but is missing required var(s): ${missing.join(', ')}. ` +
        'Fill them in (values are never printed by this check).',
    );
  }
  console.log('[check-env] OK: .env defines all required vars.');
} else {
  console.log('[check-env] NOTE: no .env file present; skipping live-value check.');
}

console.log('[check-env] PASS');
