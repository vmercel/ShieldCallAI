#!/usr/bin/env node
/**
 * Data-deletion RPC resilience check (P3-1 follow-up, 2026-10-06).
 *
 * The 2026-09-16 delete_my_data() / my_data_summary() RPCs assumed
 * public.analytics_events exists. Its creating migration (20260913170000)
 * was never applied to the live project, so the explicit DELETE/COUNT
 * raised "relation does not exist" and signed-in users could not complete
 * the Delete My Data flow. The 20261006000000 migration replaces both
 * functions with versions that guard each optional table with
 * to_regclass() and treat a missing table as zero rows.
 *
 * This script verifies the migration source (it cannot execute SQL here):
 *  1. The resilience migration file exists.
 *  2. Both functions guard BOTH optional tables with to_regclass().
 *  3. Both functions keep: security definer, fixed search_path,
 *     authenticated-only execute (revoked from public/anon), and the
 *     not-authenticated guard.
 *  4. delete_my_data() still deletes the auth account only after the
 *     residual verification, and keeps the JSON contract the client
 *     parses (deleted / residual / account_deleted).
 *  5. No raw `delete from public.analytics_events` or
 *     `delete from public.ai_quota_usage` remains UNguarded.
 *
 * Usage: node scripts/check-data-deletion.js   (or: npm run check:data-deletion)
 * Exit code 0 = OK, 1 = misconfiguration.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIGRATION = path.join(
  ROOT, 'supabase', 'migrations', '20261006000000_data_deletion_resilient.sql',
);

let assertions = 0;
function check(cond, message) {
  assertions += 1;
  if (!cond) {
    console.error(`[check-data-deletion] FAIL (${assertions}): ${message}`);
    process.exit(1);
  }
  console.log(`[check-data-deletion] ok ${assertions}: ${message}`);
}

check(fs.existsSync(MIGRATION), 'resilience migration file exists');
const sql = fs.readFileSync(MIGRATION, 'utf8');

// Split the file into the two function definitions (naive but sufficient:
// each CREATE OR REPLACE block runs to the next one).
const summaryBody = sql.split('create or replace function public.my_data_summary()')[1] || '';
const deleteBody = sql.split('create or replace function public.delete_my_data()')[1] || '';
check(summaryBody.length > 200, 'my_data_summary() definition present');
check(deleteBody.length > 200, 'delete_my_data() definition present');

for (const [name, body] of [['my_data_summary()', summaryBody], ['delete_my_data()', deleteBody]]) {
  const guardCount = (body.match(/to_regclass\('public\.(analytics_events|ai_quota_usage)'\)/g) || []).length;
  check(guardCount >= 2, `${name} guards both optional tables with to_regclass() (found ${guardCount})`);
  check(/security definer/i.test(body), `${name} is SECURITY DEFINER`);
  check(/set search_path\s*=\s*public/i.test(body), `${name} pins search_path = public`);
  check(/if uid is null then\s+raise exception 'not authenticated'/i.test(body),
    `${name} rejects unauthenticated callers`);
}

// Grants live after each function body in the same file.
check(/revoke all on function public\.my_data_summary\(\) from public, anon/i.test(sql),
  'my_data_summary() revoked from public and anon');
check(/grant execute on function public\.my_data_summary\(\) to authenticated/i.test(sql),
  'my_data_summary() granted to authenticated only');
check(/revoke all on function public\.delete_my_data\(\) from public, anon/i.test(sql),
  'delete_my_data() revoked from public and anon');
check(/grant execute on function public\.delete_my_data\(\) to authenticated/i.test(sql),
  'delete_my_data() granted to authenticated only');

// delete_my_data(): account deletion must come AFTER the residual check.
const residualCheckIdx = deleteBody.search(/if residual_events <> 0 or residual_quota <> 0/i);
const accountDeleteIdx = deleteBody.search(/delete from auth\.users where id = uid/i);
check(residualCheckIdx > 0, 'delete_my_data() verifies residuals');
check(accountDeleteIdx > residualCheckIdx,
  'delete_my_data() deletes the auth account only after residual verification');

// JSON contract the client (services/dataDeletion.ts) parses.
for (const key of ["'deleted'", "'residual'", "'account_deleted'", "'analytics_events'", "'quota_rows'"]) {
  check(deleteBody.includes(key), `delete_my_data() response keeps ${key} key`);
}

// No unguarded raw deletes: every DELETE FROM on the optional tables must
// sit inside a to_regclass guard block. Strip guard blocks, then fail if a
// raw delete on either table remains.
const guardBlockRe = /if to_regclass\('public\.(?:analytics_events|ai_quota_usage)'\) is not null then[\s\S]*?end if;/gi;
const stripped = sql.replace(guardBlockRe, '');
check(!/delete from public\.analytics_events/i.test(stripped),
  'no unguarded DELETE on public.analytics_events remains');
check(!/delete from public\.ai_quota_usage/i.test(stripped),
  'no unguarded DELETE on public.ai_quota_usage remains');
check(!/from public\.analytics_events/i.test(stripped),
  'no unguarded read on public.analytics_events remains');
check(!/from public\.ai_quota_usage/i.test(stripped),
  'no unguarded read on public.ai_quota_usage remains');

console.log(`[check-data-deletion] PASS: ${assertions} assertions`);
