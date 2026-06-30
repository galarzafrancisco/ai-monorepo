#!/usr/bin/env bash
set -euo pipefail

if [[ $# -gt 0 ]]; then
  exec node /workdir/apps/worker/dist/index.js "$@"
fi

if [[ -z "${TAICO_SERVER_URL:-}" ]]; then
  echo "TAICO_SERVER_URL is required" >&2
  exit 64
fi

exec node /workdir/apps/worker/dist/index.js \
  --serverurl "$TAICO_SERVER_URL" \
  --credentials-path "${TAICO_WORKER_CREDENTIALS_PATH:-/home/taico/.taico/worker-credentials.json}" \
  --working-directory "${TAICO_WORKER_WORKING_DIRECTORY}" \
  --no-startup-retry
