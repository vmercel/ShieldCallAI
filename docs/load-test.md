# Edge-function load test (P3-3)

Run: 2026-09-23T11:32:15.782Z (UTC). Project ref is taken from the local environment, not recorded here.

## Scope

This test exercises ONLY the cheap `{ ping: true }` probe of each edge function. Every ping handler answers before any provider call or quota check, so the run spends zero AI/transcription budget and burns no user quota.

The paid paths are deliberately NOT stress-tested here:

- `transcribe-audio` audio transcription (Deepgram spend),
- `ghost-ai` / `call-summary` / `ai-dialer` chat calls (Anthropic spend),
- `validate-receipt` store lookups (App Store / Play API quota),
- the `voip-push` send path (would ring devices and spend APNs/FCM budget).

Those stay for Mercel's explicit quota decision. The breaking points below therefore describe the Supabase edge-function runtime and gateway for cold/warm pings, not the capacity of the paid pipelines.

## Method

Stages per function: 1x concurrency / 20 requests, 5x concurrency / 50 requests, 10x concurrency / 100 requests, 25x concurrency / 200 requests, 50x concurrency / 300 requests. The 50x stage is skipped when the 25x stage already breaks. Per-request timeout 15s. Breaking point = first stage with error rate > 1% (non-2xx, timeout, or malformed ping response) or p99 > 3x the 1x baseline p99.

## Results

### ghost-ai

| concurrency | requests | errors | error rate | p50 | p95 | p99 | max | status codes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1x | 20 | 0 | 0.0% | 200 ms | 307 ms | 926 ms | 926 ms | 200: 20 |
| 5x | 50 | 0 | 0.0% | 281 ms | 916 ms | 992 ms | 992 ms | 200: 50 |
| 10x | 100 | 0 | 0.0% | 560 ms | 1122 ms | 1439 ms | 1503 ms | 200: 100 |
| 25x | 200 | 0 | 0.0% | 1380 ms | 3003 ms | 3139 ms | 3521 ms | 200: 200 |
| 50x | 300 | 1 | 0.3% | 2757 ms | 4969 ms | 5459 ms | 15003 ms | 0: 1, 200: 299 |

**Breaking point: 25x concurrency** (p99 3139 ms > 3x baseline p99 926 ms).

### transcribe-audio

| concurrency | requests | errors | error rate | p50 | p95 | p99 | max | status codes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1x | 20 | 0 | 0.0% | 194 ms | 223 ms | 321 ms | 321 ms | 200: 20 |
| 5x | 50 | 0 | 0.0% | 274 ms | 1274 ms | 1371 ms | 1371 ms | 200: 50 |
| 10x | 100 | 0 | 0.0% | 579 ms | 890 ms | 1361 ms | 1362 ms | 200: 100 |
| 25x | 200 | 0 | 0.0% | 1393 ms | 2827 ms | 3046 ms | 3050 ms | 200: 200 |
| 50x | 300 | 0 | 0.0% | 2756 ms | 5196 ms | 5448 ms | 5727 ms | 200: 300 |

**Breaking point: 5x concurrency** (p99 1371 ms > 3x baseline p99 321 ms).

### call-summary

| concurrency | requests | errors | error rate | p50 | p95 | p99 | max | status codes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1x | 20 | 0 | 0.0% | 208 ms | 243 ms | 307 ms | 307 ms | 200: 20 |
| 5x | 50 | 0 | 0.0% | 268 ms | 1146 ms | 1262 ms | 1262 ms | 200: 50 |
| 10x | 100 | 0 | 0.0% | 487 ms | 1169 ms | 1754 ms | 2178 ms | 200: 100 |
| 25x | 200 | 0 | 0.0% | 1402 ms | 2632 ms | 2966 ms | 3154 ms | 200: 200 |
| 50x | 300 | 0 | 0.0% | 2737 ms | 5120 ms | 5315 ms | 5318 ms | 200: 300 |

**Breaking point: 5x concurrency** (p99 1262 ms > 3x baseline p99 307 ms).

### ai-dialer

| concurrency | requests | errors | error rate | p50 | p95 | p99 | max | status codes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1x | 20 | 0 | 0.0% | 203 ms | 242 ms | 327 ms | 327 ms | 200: 20 |
| 5x | 50 | 0 | 0.0% | 276 ms | 922 ms | 1157 ms | 1157 ms | 200: 50 |
| 10x | 100 | 0 | 0.0% | 539 ms | 960 ms | 1325 ms | 1558 ms | 200: 100 |
| 25x | 200 | 0 | 0.0% | 1426 ms | 2902 ms | 3001 ms | 3002 ms | 200: 200 |
| 50x | 300 | 0 | 0.0% | 2901 ms | 5263 ms | 5770 ms | 6570 ms | 200: 300 |

**Breaking point: 5x concurrency** (p99 1157 ms > 3x baseline p99 327 ms).

### voip-push

| concurrency | requests | errors | error rate | p50 | p95 | p99 | max | status codes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1x | 20 | 0 | 0.0% | 205 ms | 308 ms | 308 ms | 308 ms | 200: 20 |
| 5x | 50 | 0 | 0.0% | 279 ms | 1149 ms | 1244 ms | 1244 ms | 200: 50 |
| 10x | 100 | 0 | 0.0% | 559 ms | 1007 ms | 1641 ms | 1643 ms | 200: 100 |
| 25x | 200 | 0 | 0.0% | 1382 ms | 2940 ms | 3099 ms | 3164 ms | 200: 200 |
| 50x | 300 | 0 | 0.0% | 2810 ms | 5435 ms | 5674 ms | 5736 ms | 200: 300 |

**Breaking point: 5x concurrency** (p99 1244 ms > 3x baseline p99 308 ms).

### validate-receipt

| concurrency | requests | errors | error rate | p50 | p95 | p99 | max | status codes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1x | 20 | 0 | 0.0% | 208 ms | 245 ms | 297 ms | 297 ms | 200: 20 |
| 5x | 50 | 0 | 0.0% | 262 ms | 1063 ms | 1139 ms | 1139 ms | 200: 50 |
| 10x | 100 | 0 | 0.0% | 538 ms | 969 ms | 1358 ms | 1359 ms | 200: 100 |
| 25x | 200 | 0 | 0.0% | 1381 ms | 2728 ms | 2923 ms | 2958 ms | 200: 200 |
| 50x | 300 | 0 | 0.0% | 2770 ms | 5140 ms | 5432 ms | 5949 ms | 200: 300 |

**Breaking point: 5x concurrency** (p99 1139 ms > 3x baseline p99 297 ms).

## Reading these numbers

- p50/p95 under ~1 s at 25x concurrency on pings means the runtime and gateway are healthy for the health-probe traffic the service-status screen generates.
- Timeouts here are per-request client timeouts, not server errors; the ping handler itself does no provider work, so a timeout at high concurrency points at runtime cold-start or gateway queueing, not at Deepgram/Anthropic capacity.
- A function that never breaks at 25-50x has comfortable headroom for launch-scale probe traffic; it says nothing about paid-path capacity, which is provider-limited.

