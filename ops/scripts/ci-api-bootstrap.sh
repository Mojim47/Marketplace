#!/usr/bin/env bash
set -euo pipefail

PORT="${API_PORT:-4010}"
BOOTSTRAP_TIMEOUT_SECONDS="${BOOTSTRAP_TIMEOUT_SECONDS:-30}"
LOG_FILE="${LOG_FILE:-/tmp/ci-api-bootstrap.log}"

export API_PORT="$PORT"

# CI defaults for dependency checks. Allow override from workflow env.
export DATABASE_URL="${DATABASE_URL:-postgresql://test:test@localhost:5432/nextgen_ci?schema=public}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export NODE_ENV="${NODE_ENV:-production}"

if [[ ! -f "dist/apps/api/src/main.js" ]]; then
  echo "API build artifact not found: dist/apps/api/src/main.js"
  echo "Run build before bootstrap guard."
  exit 1
fi

API_PID=""

cleanup() {
  if [[ -n "${API_PID}" ]] && kill -0 "${API_PID}" 2>/dev/null; then
    kill "${API_PID}" 2>/dev/null || true
    wait "${API_PID}" 2>/dev/null || true
  fi
}

on_error() {
  echo "API bootstrap guard failed. Captured logs:"
  if [[ -f "${LOG_FILE}" ]]; then
    tail -n 200 "${LOG_FILE}" || true
  else
    echo "No log file found at ${LOG_FILE}"
  fi
}

trap cleanup EXIT
trap on_error ERR

echo "Starting API bootstrap guard on port ${PORT}..."
node dist/apps/api/src/main.js >"${LOG_FILE}" 2>&1 &
API_PID=$!

echo "Waiting for liveness endpoint..."
deadline=$((SECONDS + BOOTSTRAP_TIMEOUT_SECONDS))
while (( SECONDS < deadline )); do
  if curl -fsS "http://localhost:${PORT}/health/live" >/dev/null; then
    break
  fi
  sleep 1
done

if ! curl -fsS "http://localhost:${PORT}/health/live" >/dev/null; then
  echo "Liveness endpoint did not become ready in ${BOOTSTRAP_TIMEOUT_SECONDS}s."
  exit 1
fi

echo "Liveness check passed."
curl -fsS "http://localhost:${PORT}/health/live" >/dev/null

echo "Readiness check..."
curl -fsS "http://localhost:${PORT}/health/ready" >/dev/null

echo "Bootstrap guard passed."
