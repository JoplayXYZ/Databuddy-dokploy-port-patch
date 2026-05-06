#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"
RUN_ID="${DATABUDDY_E2E_RUN_ID:-$(date +%Y%m%d%H%M%S)-$$}"
BASE_DSN="${DATABUDDY_E2E_BASE_DATABASE_URL:-${DATABASE_URL:-postgres://postgres:postgres@localhost:5432/databuddy}}"
KEEP_DB="${DATABUDDY_E2E_KEEP_DB:-0}"

cd "$ROOT_DIR"

create_output="$(bun packages/db/scripts/e2e-db-lifecycle.ts create --base-dsn "$BASE_DSN" --run-id "$RUN_ID")"
eval "$create_output"
export DATABASE_URL DATABUDDY_E2E_DB_NAME
export DATABUDDY_E2E_MODE="${DATABUDDY_E2E_MODE:-1}"
export DATABUDDY_E2E_TEST_KEY="${DATABUDDY_E2E_TEST_KEY:-databuddy-e2e-$RUN_ID}"

cleanup() {
  if [[ "$KEEP_DB" == "1" ]]; then
    echo "Keeping E2E database: $DATABUDDY_E2E_DB_NAME"
    return
  fi
  bun packages/db/scripts/e2e-db-lifecycle.ts drop --base-dsn "$BASE_DSN" --db-name "$DATABUDDY_E2E_DB_NAME" >/dev/null || true
}
trap cleanup EXIT

bun run --cwd packages/db db:push

if [[ "$#" -eq 0 ]]; then
  cat <<EOF
E2E database is ready.

export DATABASE_URL='$DATABASE_URL'
export DATABUDDY_E2E_DB_NAME='$DATABUDDY_E2E_DB_NAME'
export DATABUDDY_E2E_MODE='$DATABUDDY_E2E_MODE'
export DATABUDDY_E2E_TEST_KEY='$DATABUDDY_E2E_TEST_KEY'

Pass a command to run it with these variables, for example:
  apps/dashboard/test/e2e/run-local.sh bun run --cwd apps/dashboard dev
EOF
  exit 0
fi

"$@"
