#!/usr/bin/env node
/**
 * Edge-function load test for ShieldCallAI (P3-3).
 *
 * Hammers the CHEAP PING endpoints of the six edge functions with escalating
 * concurrency and records latency percentiles, error rates, and breaking
 * points in docs/load-test.md.
 *
 * Scope and honesty, by design:
 *  - Only the ping probe is exercised: POST { "ping": true } to each
 *    function's /functions/v1/<id> endpoint. Every ping handler answers
 *    BEFORE any provider call or quota check, so this test spends zero
 *    AI/transcription budget and burns no user quota.
 *  - The paid paths (transcribe, ghost-ai chat, receipt validation against
 *    the stores) are NOT stress-tested here: they spend real provider money
 *    and need Mercel's explicit quota decision. The breaking points below
 *    describe the edge-function runtime / gateway, not the paid pipelines.
 *  - No user JWT is used, so no real account is touched; the public anon key
 *    from the local .env is the only credential, and it is never logged.
 *
 * Usage:
 *   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_ANON_KEY=<key> \
 *     node scripts/load-test-edge-functions.js [--out docs/load-test.md]
 *   or: npm run load:test
 * Exit code 0 = test completed (even if a breaking point was found);
 * exit code 1 = misconfiguration or a total outage.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TAG = 'load:test';

const FUNCTIONS = [
  'ghost-ai',
  'transcribe-audio',
  'call-summary',
  'ai-dialer',
  'voip-push',
  'validate-receipt',
];

// concurrency -> total requests. The 50x stage only runs when the 25x stage
// stayed clean (error rate <= 1%), so the test adapts to the runtime's limits.
const STAGES = [
  { concurrency: 1, total: 20 },
  { concurrency: 5, total: 50 },
  { concurrency: 10, total: 100 },
  { concurrency: 25, total: 200 },
  { concurrency: 50, total: 300 },
];
const PER_REQUEST_TIMEOUT_MS = 15_000;
const ERROR_RATE_BREAKPOINT = 0.01; // >1% errors = breaking point
const P99_REGRESSION_FACTOR = 3; // p99 > 3x baseline p99 = breaking point

function loadDotEnv() {
  const p = path.join(ROOT, '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const i = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, i)];
}

async function onePing(url, anonKey) {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ ping: true }),
      signal: ctrl.signal,
    });
    const latencyMs = Date.now() - started;
    let okPing = false;
    if (res.ok) {
      try {
        const data = await res.json();
        okPing = data && data.ok === true;
      } catch {
        okPing = false;
      }
    }
    return { status: res.status, latencyMs, ok: res.ok && okPing, error: null };
  } catch (err) {
    return {
      status: 0,
      latencyMs: Date.now() - started,
      ok: false,
      error: err.name === 'AbortError' ? 'timeout' : String(err.message || err),
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runStage(url, anonKey, { concurrency, total }) {
  const perWorker = Math.ceil(total / concurrency);
  const results = [];
  const workers = [];
  for (let w = 0; w < concurrency; w += 1) {
    workers.push(
      (async () => {
        for (let i = 0; i < perWorker; i += 1) {
          results.push(await onePing(url, anonKey));
        }
      })()
    );
  }
  await Promise.all(workers);
  const got = results.slice(0, total);
  const latencies = got.map((r) => r.latencyMs).sort((a, b) => a - b);
  const errors = got.filter((r) => !r.ok).length;
  const byStatus = {};
  for (const r of got) byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  return {
    concurrency,
    total: got.length,
    errors,
    errorRate: got.length ? errors / got.length : 1,
    p50: percentile(latencies, 50),
    p95: percentile(latencies, 95),
    p99: percentile(latencies, 99),
    max: latencies.length ? latencies[latencies.length - 1] : null,
    byStatus,
  };
}

async function loadTestFunction(baseUrl, anonKey, id) {
  const url = `${baseUrl}/functions/v1/${id}`;
  console.log(`[${TAG}] ${id}: starting`);
  const stageResults = [];
  let baselineP99 = null;
  let breakingPoint = null;
  for (const stage of STAGES) {
    const prev = stageResults[stageResults.length - 1];
    if (prev && prev.concurrency === 25 && prev.errorRate > ERROR_RATE_BREAKPOINT) {
      console.log(`[${TAG}] ${id}: skipping 50x stage (25x already breaking)`);
      break;
    }
    const r = await runStage(url, anonKey, stage);
    if (baselineP99 === null && r.p99 !== null) baselineP99 = r.p99;
    const brokeOnErrors = r.errorRate > ERROR_RATE_BREAKPOINT;
    const brokeOnLatency =
      baselineP99 !== null && r.p99 !== null && r.p99 > baselineP99 * P99_REGRESSION_FACTOR;
    if ((brokeOnErrors || brokeOnLatency) && breakingPoint === null) {
      breakingPoint = {
        concurrency: r.concurrency,
        reason: brokeOnErrors
          ? `error rate ${(r.errorRate * 100).toFixed(1)}% > 1%`
          : `p99 ${r.p99} ms > 3x baseline p99 ${baselineP99} ms`,
      };
    }
    stageResults.push(r);
    console.log(
      `[${TAG}] ${id}: ${r.concurrency}x conc -> p50 ${r.p50}ms p95 ${r.p95}ms p99 ${r.p99}ms ` +
        `errors ${r.errors}/${r.total} status ${JSON.stringify(r.byStatus)}`
    );
  }
  return { id, stageResults, breakingPoint };
}

function fmtMs(v) {
  return v === null ? 'n/a' : `${v} ms`;
}

function renderMarkdown(run) {
  const { runAt, stages, results } = run;
  const lines = [];
  lines.push('# Edge-function load test (P3-3)');
  lines.push('');
  lines.push(`Run: ${runAt} (UTC). Project ref is taken from the local environment, not recorded here.`);
  lines.push('');
  lines.push('## Scope');
  lines.push('');
  lines.push(
    'This test exercises ONLY the cheap `{ ping: true }` probe of each edge function. ' +
      'Every ping handler answers before any provider call or quota check, so the run spends ' +
      'zero AI/transcription budget and burns no user quota.'
  );
  lines.push('');
  lines.push('The paid paths are deliberately NOT stress-tested here:');
  lines.push('');
  lines.push('- `transcribe-audio` audio transcription (Deepgram spend),');
  lines.push('- `ghost-ai` / `call-summary` / `ai-dialer` chat calls (Anthropic spend),');
  lines.push('- `validate-receipt` store lookups (App Store / Play API quota),');
  lines.push('- the `voip-push` send path (would ring devices and spend APNs/FCM budget).');
  lines.push('');
  lines.push(
    'Those stay for Mercel\'s explicit quota decision. The breaking points below therefore ' +
      'describe the Supabase edge-function runtime and gateway for cold/warm pings, ' +
      'not the capacity of the paid pipelines.'
  );
  lines.push('');
  lines.push('## Method');
  lines.push('');
  lines.push(
    `Stages per function: ${stages.map((s) => `${s.concurrency}x concurrency / ${s.total} requests`).join(', ')}. ` +
      `The 50x stage is skipped when the 25x stage already breaks. ` +
      `Per-request timeout ${PER_REQUEST_TIMEOUT_MS / 1000}s. ` +
      `Breaking point = first stage with error rate > ${ERROR_RATE_BREAKPOINT * 100}% ` +
      `(non-2xx, timeout, or malformed ping response) or p99 > ${P99_REGRESSION_FACTOR}x the 1x baseline p99.`
  );
  lines.push('');
  lines.push('## Results');
  lines.push('');
  for (const fn of results) {
    lines.push(`### ${fn.id}`);
    lines.push('');
    lines.push('| concurrency | requests | errors | error rate | p50 | p95 | p99 | max | status codes |');
    lines.push('| --- | --- | --- | --- | --- | --- | --- | --- | --- |');
    for (const s of fn.stageResults) {
      const codes = Object.entries(s.byStatus)
        .map(([code, n]) => `${code}: ${n}`)
        .join(', ');
      lines.push(
        `| ${s.concurrency}x | ${s.total} | ${s.errors} | ${(s.errorRate * 100).toFixed(1)}% | ` +
          `${fmtMs(s.p50)} | ${fmtMs(s.p95)} | ${fmtMs(s.p99)} | ${fmtMs(s.max)} | ${codes} |`
      );
    }
    lines.push('');
    if (fn.breakingPoint) {
      lines.push(
        `**Breaking point: ${fn.breakingPoint.concurrency}x concurrency** (${fn.breakingPoint.reason}).`
      );
    } else {
      lines.push('**No breaking point found** up to the highest stage run.');
    }
    lines.push('');
  }
  lines.push('## Reading these numbers');
  lines.push('');
  lines.push(
    '- p50/p95 under ~1 s at 25x concurrency on pings means the runtime and gateway are ' +
      'healthy for the health-probe traffic the service-status screen generates.'
  );
  lines.push(
    '- Timeouts here are per-request client timeouts, not server errors; the ping handler ' +
      'itself does no provider work, so a timeout at high concurrency points at runtime ' +
      'cold-start or gateway queueing, not at Deepgram/Anthropic capacity.'
  );
  lines.push(
    '- A function that never breaks at 25-50x has comfortable headroom for launch-scale ' +
      'probe traffic; it says nothing about paid-path capacity, which is provider-limited.'
  );
  lines.push('');
  return lines.join('\n');
}

async function main() {
  loadDotEnv();
  const baseUrl = (process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(
    /\/+$/,
    ''
  );
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    console.error(
      `[${TAG}] FAIL: need SUPABASE_URL and SUPABASE_ANON_KEY (or EXPO_PUBLIC_* equivalents in .env)`
    );
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outPath = outIdx >= 0 && args[outIdx + 1] ? path.resolve(ROOT, args[outIdx + 1]) : null;

  const run = { runAt: new Date().toISOString(), stages: STAGES, results: [] };
  for (const id of FUNCTIONS) {
    run.results.push(await loadTestFunction(baseUrl, anonKey, id));
  }

  const markdown = renderMarkdown(run);
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, `${markdown}\n`);
    console.log(`[${TAG}] wrote ${path.relative(ROOT, outPath)}`);
  } else {
    console.log(markdown);
  }

  const totalBroken = run.results.filter((r) => r.breakingPoint).length;
  console.log(
    `[${TAG}] done: ${run.results.length} functions probed, ${totalBroken} with a breaking point in range`
  );
}

main().catch((err) => {
  console.error(`[${TAG}] FAIL: ${err && err.message ? err.message : err}`);
  process.exit(1);
});
