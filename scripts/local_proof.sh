#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

npx tsx services/fusion.test.ts
npx tsx services/sentinel.test.ts
