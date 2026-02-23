#!/usr/bin/env bash
set -euo pipefail

log() { echo "[staging-preflight] $*"; }
fail() { echo "[staging-preflight][fatal] $*" >&2; exit 1; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"; }
resolve_cmd() {
  local base="$1"
  if command -v "$base" >/dev/null 2>&1; then
    echo "$base"
    return 0
  fi
  if command -v "${base}.exe" >/dev/null 2>&1; then
    echo "${base}.exe"
    return 0
  fi
  return 1
}
NODE_BIN="${NODE_BIN:-$(resolve_cmd node || true)}"
DOCKER_BIN="${DOCKER_BIN:-$(resolve_cmd docker.exe || resolve_cmd docker || true)}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-nextgen-postgres}"
REDIS_CONTAINER="${REDIS_CONTAINER:-nextgen-redis}"
POSTGRES_CLIENT_IMAGE="${POSTGRES_CLIENT_IMAGE:-postgres:16-alpine}"

rewrite_db_url_for_docker() {
  local url="$1"
  url="${url/@localhost:/@host.docker.internal:}"
  url="${url/@127.0.0.1:/@host.docker.internal:}"
  echo "$url"
}

normalize_pg_tool_url() {
  local url="$1"
  echo "$url" | sed -E 's/([?&])schema=[^&]*&/\1/g; s/[?&]schema=[^&]*$//; s/\?&/\?/g; s/[?]$//'
}

ARTIFACT_REF="${ARTIFACT_REF:-}"
ARTIFACT_IMAGE="${ARTIFACT_IMAGE:-}"
ENV_PRODUCTION_FILE="${ENV_PRODUCTION_FILE:-/etc/nextgen/.env.production}"
PROCESS_MANAGER="${PROCESS_MANAGER:-systemd}"
SYSTEMD_UNIT="${SYSTEMD_UNIT:-nextgen-api.service}"
PM2_APP="${PM2_APP:-nextgen-api}"
PM2_CONFIG="${PM2_CONFIG:-ecosystem.config.js}"
PROCESS_MANAGER_REQUIRED="${PROCESS_MANAGER_REQUIRED:-true}"
ARTIFACT_MANIFEST_PATH="${ARTIFACT_MANIFEST_PATH:-artifacts/manifest.json}"
ARTIFACT_MANIFEST_REQUIRED="${ARTIFACT_MANIFEST_REQUIRED:-true}"

validate_artifact_ref() {
  [ -n "$ARTIFACT_REF" ] || fail "ARTIFACT_REF is required"
  if [[ "$ARTIFACT_REF" =~ ^[0-9a-f]{40}$ ]]; then
    log "ARTIFACT_REF sha format OK"
    return
  fi
  if [[ "$ARTIFACT_REF" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
    log "ARTIFACT_REF tag format OK"
    return
  fi
  fail "ARTIFACT_REF must be a full sha or semver tag"
}

validate_artifact_image() {
  [ -n "$ARTIFACT_IMAGE" ] || fail "ARTIFACT_IMAGE is required"
  if [[ "$ARTIFACT_IMAGE" == *@sha256:* ]] || [[ "$ARTIFACT_IMAGE" == *":"* ]]; then
    log "ARTIFACT_IMAGE immutable reference format OK"
    return
  fi
  fail "ARTIFACT_IMAGE must include digest or explicit tag"
}

validate_env_file_and_load() {
  [ -f "$ENV_PRODUCTION_FILE" ] || fail "ENV_PRODUCTION_FILE does not exist: $ENV_PRODUCTION_FILE"
  case "$ENV_PRODUCTION_FILE" in
    .env.production|./.env.production|$(pwd)/.env.production)
      fail "ENV_PRODUCTION_FILE must be outside repository"
      ;;
  esac
  # shellcheck disable=SC1090
  set -a; source "$ENV_PRODUCTION_FILE"; set +a
  log "ENV_PRODUCTION_FILE exists and loaded"
}

validate_secrets_presence() {
  [ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL is missing"
  [ -n "${REDIS_URL:-}" ] || fail "REDIS_URL is missing"
  [ -n "${JWT_SECRET:-}" ] || fail "JWT_SECRET is missing"
  [ ${#JWT_SECRET} -ge 32 ] || fail "JWT_SECRET must be at least 32 chars"
  log "DATABASE_URL/REDIS_URL/JWT_SECRET presence OK"
}

validate_database_connectivity() {
  local db_url
  db_url="$(normalize_pg_tool_url "$DATABASE_URL")"
  if command -v psql >/dev/null 2>&1; then
    psql "$db_url" -v ON_ERROR_STOP=1 -Atc "SELECT 1;" >/dev/null
  elif [ -n "$DOCKER_BIN" ]; then
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' "$DOCKER_BIN" run --rm "$POSTGRES_CLIENT_IMAGE" psql "$(rewrite_db_url_for_docker "$db_url")" -v ON_ERROR_STOP=1 -Atc "SELECT 1;" >/dev/null
  else
    fail "missing required command: psql (and docker fallback unavailable)"
  fi
  log "DATABASE_URL connectivity OK"
}

validate_redis_connectivity() {
  if command -v redis-cli >/dev/null 2>&1; then
    redis-cli -u "$REDIS_URL" ping | grep -q "^PONG$" || fail "REDIS_URL ping failed"
  elif [ -n "$DOCKER_BIN" ]; then
    local redis_pass
    redis_pass="$(printf '%s' "$REDIS_URL" | sed -n 's#redis://:\([^@]*\)@.*#\1#p')"
    if [ -n "$redis_pass" ]; then
      "$DOCKER_BIN" exec -i "$REDIS_CONTAINER" redis-cli -a "$redis_pass" ping | grep -q "^PONG$" || fail "REDIS_URL ping failed"
    else
      "$DOCKER_BIN" exec -i "$REDIS_CONTAINER" redis-cli ping | grep -q "^PONG$" || fail "REDIS_URL ping failed"
    fi
  else
    fail "missing required command: redis-cli (and docker fallback unavailable)"
  fi
  log "REDIS_URL connectivity OK"
}

validate_process_manager_readiness() {
  if [ "$PROCESS_MANAGER_REQUIRED" != "true" ]; then
    log "process manager readiness skipped (PROCESS_MANAGER_REQUIRED=false)"
    return
  fi
  case "$PROCESS_MANAGER" in
    systemd)
      require_cmd systemctl
      systemctl status "$SYSTEMD_UNIT" >/dev/null 2>&1 || fail "systemd unit not found/readable: $SYSTEMD_UNIT"
      log "systemd readiness OK ($SYSTEMD_UNIT)"
      ;;
    pm2)
      require_cmd pm2
      if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
        log "pm2 app readiness OK ($PM2_APP)"
      else
        [ -f "$PM2_CONFIG" ] || fail "pm2 app missing and PM2_CONFIG not found: $PM2_CONFIG"
        log "pm2 config readiness OK ($PM2_CONFIG)"
      fi
      ;;
    *)
      fail "PROCESS_MANAGER must be systemd or pm2"
      ;;
  esac
}

verify_artifact_manifest() {
  if [ "$ARTIFACT_MANIFEST_REQUIRED" != "true" ]; then
    log "artifact manifest verification skipped (ARTIFACT_MANIFEST_REQUIRED=false)"
    return
  fi
  [ -f "$ARTIFACT_MANIFEST_PATH" ] || fail "artifact manifest not found: $ARTIFACT_MANIFEST_PATH"
  [ -n "$NODE_BIN" ] || fail "missing required command: node"
  ARTIFACT_MANIFEST_PATH="$ARTIFACT_MANIFEST_PATH" \
  ARTIFACT_EXPECT_COMMIT="$ARTIFACT_REF" \
  "$NODE_BIN" scripts/ai/verify-artifact-manifest.mjs
}

main() {
  validate_artifact_ref
  validate_artifact_image
  verify_artifact_manifest
  validate_env_file_and_load
  validate_secrets_presence
  validate_database_connectivity
  validate_redis_connectivity
  validate_process_manager_readiness
  log "staging environment contract preflight passed"
}

main "$@"
