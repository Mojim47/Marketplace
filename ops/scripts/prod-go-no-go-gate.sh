#!/usr/bin/env bash
set -euo pipefail

log() { echo "[prod-gate] $*"; }
fail() { echo "[prod-gate][fatal] $*" >&2; exit 1; }
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
PREFER_DOCKER_PG_CLIENT="${PREFER_DOCKER_PG_CLIENT:-true}"

rewrite_db_url_for_docker() {
  local url="$1"
  url="${url/@localhost:/@host.docker.internal:}"
  url="${url/@127.0.0.1:/@host.docker.internal:}"
  echo "$url"
}

normalize_pg_tool_url() {
  local url="$1"
  # psql/pg_dump/pg_restore do not support Prisma's schema query param in connection URIs.
  echo "$url" | sed -E 's/([?&])schema=[^&]*&/\1/g; s/[?&]schema=[^&]*$//; s/\?&/\?/g; s/[?]$//'
}

use_docker_pg_client() {
  [ -n "$DOCKER_BIN" ] && [ "$PREFER_DOCKER_PG_CLIENT" = "true" ]
}

run_psql() {
  local args=()
  for arg in "$@"; do
    if [[ "$arg" == postgresql://* ]]; then
      args+=("$(normalize_pg_tool_url "$arg")")
    else
      args+=("$arg")
    fi
  done
  if use_docker_pg_client; then
    local docker_args=()
    for arg in "${args[@]}"; do
      if [[ "$arg" == postgresql://* ]]; then
        docker_args+=("$(rewrite_db_url_for_docker "$arg")")
      else
        docker_args+=("$arg")
      fi
    done
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' "$DOCKER_BIN" run --rm -v /tmp:/tmp "$POSTGRES_CLIENT_IMAGE" psql "${docker_args[@]}"
    return
  fi
  if command -v psql >/dev/null 2>&1; then
    psql "${args[@]}"
    return
  fi
  if [ -n "$DOCKER_BIN" ]; then
    local docker_args=()
    for arg in "${args[@]}"; do
      if [[ "$arg" == postgresql://* ]]; then
        docker_args+=("$(rewrite_db_url_for_docker "$arg")")
      else
        docker_args+=("$arg")
      fi
    done
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' "$DOCKER_BIN" run --rm -v /tmp:/tmp "$POSTGRES_CLIENT_IMAGE" psql "${docker_args[@]}"
    return
  fi
  fail "missing required command: psql (and docker fallback unavailable)"
}

run_pg_dump() {
  local args=()
  for arg in "$@"; do
    if [[ "$arg" == postgresql://* ]]; then
      args+=("$(normalize_pg_tool_url "$arg")")
    else
      args+=("$arg")
    fi
  done
  if use_docker_pg_client; then
    local docker_args=()
    for arg in "${args[@]}"; do
      if [[ "$arg" == postgresql://* ]]; then
        docker_args+=("$(rewrite_db_url_for_docker "$arg")")
      else
        docker_args+=("$arg")
      fi
    done
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' "$DOCKER_BIN" run --rm -v /tmp:/tmp "$POSTGRES_CLIENT_IMAGE" pg_dump "${docker_args[@]}"
    return
  fi
  if command -v pg_dump >/dev/null 2>&1; then
    pg_dump "${args[@]}"
    return
  fi
  if [ -n "$DOCKER_BIN" ]; then
    local docker_args=()
    for arg in "${args[@]}"; do
      if [[ "$arg" == postgresql://* ]]; then
        docker_args+=("$(rewrite_db_url_for_docker "$arg")")
      else
        docker_args+=("$arg")
      fi
    done
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' "$DOCKER_BIN" run --rm -v /tmp:/tmp "$POSTGRES_CLIENT_IMAGE" pg_dump "${docker_args[@]}"
    return
  fi
  fail "missing required command: pg_dump (and docker fallback unavailable)"
}

run_pg_restore() {
  local args=()
  for arg in "$@"; do
    if [[ "$arg" == postgresql://* ]]; then
      args+=("$(normalize_pg_tool_url "$arg")")
    else
      args+=("$arg")
    fi
  done
  if use_docker_pg_client; then
    local docker_args=()
    for arg in "${args[@]}"; do
      if [[ "$arg" == postgresql://* ]]; then
        docker_args+=("$(rewrite_db_url_for_docker "$arg")")
      else
        docker_args+=("$arg")
      fi
    done
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' "$DOCKER_BIN" run --rm -v /tmp:/tmp "$POSTGRES_CLIENT_IMAGE" pg_restore "${docker_args[@]}"
    return
  fi
  if command -v pg_restore >/dev/null 2>&1; then
    pg_restore "${args[@]}"
    return
  fi
  if [ -n "$DOCKER_BIN" ]; then
    local docker_args=()
    for arg in "${args[@]}"; do
      if [[ "$arg" == postgresql://* ]]; then
        docker_args+=("$(rewrite_db_url_for_docker "$arg")")
      else
        docker_args+=("$arg")
      fi
    done
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' "$DOCKER_BIN" run --rm -v /tmp:/tmp "$POSTGRES_CLIENT_IMAGE" pg_restore "${docker_args[@]}"
    return
  fi
  fail "missing required command: pg_restore (and docker fallback unavailable)"
}

run_redis_cli() {
  if command -v redis-cli >/dev/null 2>&1; then
    redis-cli "$@"
    return
  fi
  if [ -n "$DOCKER_BIN" ]; then
    if [ "${1:-}" = "-u" ] && [ -n "${2:-}" ]; then
      local redis_url redis_pass
      redis_url="$2"
      shift 2
      redis_pass="$(printf '%s' "$redis_url" | sed -n 's#redis://:\([^@]*\)@.*#\1#p')"
      if [ -n "$redis_pass" ]; then
        "$DOCKER_BIN" exec -i "$REDIS_CONTAINER" redis-cli -a "$redis_pass" "$@"
      else
        "$DOCKER_BIN" exec -i "$REDIS_CONTAINER" redis-cli "$@"
      fi
    else
      "$DOCKER_BIN" exec -i "$REDIS_CONTAINER" redis-cli "$@"
    fi
    return
  fi
  fail "missing required command: redis-cli (and docker fallback unavailable)"
}

ARTIFACT_REF="${ARTIFACT_REF:-}"
ARTIFACT_IMAGE="${ARTIFACT_IMAGE:-}"
ENV_PRODUCTION_FILE="${ENV_PRODUCTION_FILE:-/etc/nextgen/.env.production}"
API_HOST="${API_HOST:-127.0.0.1}"
API_PORT="${API_PORT:-3001}"
API_BASE_URL="${API_BASE_URL:-}"
HEALTH_LIVE_URL="${HEALTH_LIVE_URL:-}"
HEALTH_READY_URL="${HEALTH_READY_URL:-}"
PROCESS_MANAGER="${PROCESS_MANAGER:-systemd}"
SYSTEMD_UNIT="${SYSTEMD_UNIT:-nextgen-api.service}"
PM2_APP="${PM2_APP:-nextgen-api}"
PM2_CONFIG="${PM2_CONFIG:-ecosystem.config.js}"
PROCESS_MANAGER_REQUIRED="${PROCESS_MANAGER_REQUIRED:-true}"
RESTORE_DB_PREFIX="${RESTORE_DB_PREFIX:-nextgen_restore_verify}"
FRONTEND_BUILD_GATE="${FRONTEND_BUILD_GATE:-true}"
NEXT_EXPORT_REQUIRED="${NEXT_EXPORT_REQUIRED:-true}"
AI_MODEL_CONTRACT_PATH="${AI_MODEL_CONTRACT_PATH:-ops/assets/ai/models/model.contract.json}"
AI_MODEL_CONTRACT_STRICT_SIGNATURE="${AI_MODEL_CONTRACT_STRICT_SIGNATURE:-false}"
AI_SHADOW_EVAL_REPORT_PATH="${AI_SHADOW_EVAL_REPORT_PATH:-ops/assets/ai/models/shadow-eval.report.json}"
ARTIFACT_MANIFEST_PATH="${ARTIFACT_MANIFEST_PATH:-artifacts/manifest.json}"
ARTIFACT_MANIFEST_REQUIRED="${ARTIFACT_MANIFEST_REQUIRED:-true}"

assert_immutable_artifact() {
  [ -n "$ARTIFACT_REF" ] || fail "ARTIFACT_REF is required (tag or commit sha)"
  [ -n "$ARTIFACT_IMAGE" ] || fail "ARTIFACT_IMAGE is required (immutable image digest/tag)"

  if [[ "$ARTIFACT_REF" =~ ^[0-9a-f]{40}$ ]]; then
    log "artifact ref is commit sha"
  elif [[ "$ARTIFACT_REF" =~ ^v?[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$ ]]; then
    log "artifact ref is release tag"
  else
    fail "ARTIFACT_REF must be full sha or semver tag"
  fi

  if [[ "$ARTIFACT_IMAGE" != *@sha256:* ]] && [[ "$ARTIFACT_IMAGE" != *":"* ]]; then
    fail "ARTIFACT_IMAGE must be immutable (digest or explicit tag)"
  fi
}

assert_env_and_secrets() {
  [ -f "$ENV_PRODUCTION_FILE" ] || fail "missing production env file: $ENV_PRODUCTION_FILE"

  case "$ENV_PRODUCTION_FILE" in
    .env.production|./.env.production|$(pwd)/.env.production)
      fail ".env.production must be outside repository"
      ;;
  esac

  # shellcheck disable=SC1090
  set -a; source "$ENV_PRODUCTION_FILE"; set +a

  [ "${LOG_FORMAT:-}" = "json" ] || fail "LOG_FORMAT must be json (structured audit logs always on)"

  for key in DATABASE_URL REDIS_URL API_PORT JWT_SECRET; do
    [ -n "${!key:-}" ] || fail "missing required secret/env: $key"
  done

  [ ${#JWT_SECRET} -ge 32 ] || fail "JWT_SECRET must be at least 32 chars"

  API_BASE_URL="${API_BASE_URL:-http://${API_HOST}:${API_PORT}}"
  HEALTH_LIVE_URL="${HEALTH_LIVE_URL:-${API_BASE_URL}/health/live}"
  HEALTH_READY_URL="${HEALTH_READY_URL:-${API_BASE_URL}/health/ready}"
}

http_must_be_ok() {
  local url="$1"
  local status
  status="$(curl -sS -o /dev/null -w '%{http_code}' "$url" || true)"
  if [ "$status" = "200" ]; then
    return
  fi

  # Backward-compatible fallback for deployments that expose probes under /api/v3.
  if [[ "$url" == *"/health/"* ]] && [[ "$url" != *"/api/v3/health/"* ]]; then
    local fallback_url fallback_status
    fallback_url="${url/\/health\//\/api\/v3\/health\/}"
    fallback_status="$(curl -sS -o /dev/null -w '%{http_code}' "$fallback_url" || true)"
    [ "$fallback_status" = "200" ] && return
  fi

  fail "health probe failed: $url returned $status"
}

run_pre_health_gate() {
  log "pre-check health gate"
  http_must_be_ok "$HEALTH_LIVE_URL"
  http_must_be_ok "$HEALTH_READY_URL"
}

backup_and_restore_verify() {
  local stamp backup_file db_no_params db_base restore_db restore_url
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  backup_file="${TMPDIR:-/tmp}/nextgen-${stamp}.dump"

  db_no_params="${DATABASE_URL%%\?*}"
  db_base="${db_no_params%/*}"
  restore_db="${RESTORE_DB_PREFIX}_${stamp}"
  restore_url="${db_base}/${restore_db}"

  log "taking pg_dump backup: $backup_file"
  run_pg_dump --format=custom --no-owner --no-privileges --file "$backup_file" "$DATABASE_URL"

  log "creating isolated restore db: $restore_db"
  run_psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$restore_db\";"
  run_psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "CREATE DATABASE \"$restore_db\";"

  log "restoring backup into isolated db"
  run_pg_restore --clean --if-exists --no-owner --no-privileges --dbname "$restore_url" "$backup_file"

  log "verifying restored schema"
  run_psql "$restore_url" -v ON_ERROR_STOP=1 -Atc "SELECT COUNT(*) FROM \"_prisma_migrations\";" >/dev/null
  run_psql "$restore_url" -v ON_ERROR_STOP=1 -Atc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='users' OR table_name='User');" | grep -q '^t$' || fail "restored DB missing users/User table"
  run_psql "$restore_url" -v ON_ERROR_STOP=1 -Atc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='orders' OR table_name='Order');" | grep -q '^t$' || fail "restored DB missing orders/Order table"

  log "cleanup restored db"
  run_psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS \"$restore_db\";"
}

verify_redis_persistence() {
  local before after now
  before="$(run_redis_cli -u "$REDIS_URL" LASTSAVE)"
  run_redis_cli -u "$REDIS_URL" BGSAVE >/dev/null

  for _ in $(seq 1 40); do
    after="$(run_redis_cli -u "$REDIS_URL" LASTSAVE)"
    if [ "$after" -gt "$before" ]; then
      now="$(date +%s)"
      [ $((now - after)) -le 300 ] || fail "Redis LASTSAVE timestamp too old: $after"
      log "redis BGSAVE persisted at unix-ts=$after"
      return
    fi
    sleep 1
  done

  fail "redis BGSAVE did not produce a newer LASTSAVE timestamp"
}

run_migration_gate() {
  require_cmd pnpm

  log "prisma migrate deploy"
  pnpm exec prisma migrate deploy --schema prisma/schema.prisma

  log "prisma migrate status"
  local status_out
  status_out="$(pnpm exec prisma migrate status --schema prisma/schema.prisma)"
  echo "$status_out" | grep -Eq 'up to date|No pending migrations' || fail "migration status is not clean"
}

run_sanity_queries() {
  log "db sanity queries for auth/order/checkpoint"
  run_psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='users' OR table_name='User');" | grep -q '^t$' || fail "auth table sanity failed"
  run_psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atc "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='orders' OR table_name='Order');" | grep -q '^t$' || fail "order table sanity failed"

  local checkout_status orders_status auth_status
  checkout_status="$(curl -sS -o /dev/null -w '%{http_code}' -X POST "${API_BASE_URL}/checkout/init" || true)"
  orders_status="$(curl -sS -o /dev/null -w '%{http_code}' "${API_BASE_URL}/orders" || true)"
  auth_status="$(curl -sS -o /dev/null -w '%{http_code}' -X GET "${API_BASE_URL}/auth/2fa/status" || true)"

  [[ "$checkout_status" =~ ^(401|403)$ ]] || fail "checkout sanity expected 401/403, got $checkout_status"
  [[ "$orders_status" =~ ^(401|403)$ ]] || fail "orders sanity expected 401/403, got $orders_status"
  if [[ "$auth_status" =~ ^(401|403)$ ]]; then
    :
  elif [ "$auth_status" = "404" ]; then
    log "auth sanity route missing in launch module, skipped (/auth/2fa/status returned 404)"
  else
    fail "auth sanity expected 401/403 or 404, got $auth_status"
  fi
}

launch_with_process_manager() {
  if [ "$PROCESS_MANAGER_REQUIRED" != "true" ]; then
    log "process manager restart skipped (PROCESS_MANAGER_REQUIRED=false)"
    return
  fi
  case "$PROCESS_MANAGER" in
    systemd)
      require_cmd systemctl
      log "restarting via systemd unit: $SYSTEMD_UNIT"
      systemctl restart "$SYSTEMD_UNIT"
      systemctl is-active --quiet "$SYSTEMD_UNIT" || fail "systemd unit is not active: $SYSTEMD_UNIT"
      ;;
    pm2)
      require_cmd pm2
      log "restarting via pm2 app: $PM2_APP"
      if pm2 describe "$PM2_APP" >/dev/null 2>&1; then
        pm2 restart "$PM2_APP" --update-env
      else
        [ -f "$PM2_CONFIG" ] || fail "pm2 config not found: $PM2_CONFIG"
        pm2 start "$PM2_CONFIG" --only "$PM2_APP" --update-env
      fi
      pm2 save
      ;;
    *)
      fail "PROCESS_MANAGER must be 'systemd' or 'pm2'"
      ;;
  esac
}

run_post_startup_health_gate() {
  log "post-startup health gate"
  for _ in $(seq 1 30); do
    live="$(curl -sS -o /dev/null -w '%{http_code}' "$HEALTH_LIVE_URL" || true)"
    ready="$(curl -sS -o /dev/null -w '%{http_code}' "$HEALTH_READY_URL" || true)"
    if [ "$live" = "200" ] && [ "$ready" = "200" ]; then
      return
    fi
    sleep 2
  done
  fail "post-startup health probes did not become healthy"
}

run_frontend_hardening_gate() {
  [ "$FRONTEND_BUILD_GATE" = "true" ] || return 0
  require_cmd pnpm

  log "frontend hardening gate: next build"
  pnpm --filter @nextgen/web build

  if [ "$NEXT_EXPORT_REQUIRED" = "true" ]; then
    log "frontend hardening gate: next export"
    pnpm --filter @nextgen/web exec next export
  fi
}

validate_alert_hooks() {
  local alert_file="monitoring/alerts/api-alerts.yml"
  [ -f "$alert_file" ] || fail "missing alert config: $alert_file"

  grep -q "CheckoutGuardBlockedSpike" "$alert_file" || fail "missing CheckoutGuardBlockedSpike alert"
  grep -q "CheckoutStateCleanupUntracked" "$alert_file" || fail "missing CheckoutStateCleanupUntracked alert"
  grep -q "High4xxRate" "$alert_file" || fail "missing High4xxRate alert"
  grep -q "HighErrorRate" "$alert_file" || fail "missing HighErrorRate alert"
  grep -q "ReadinessProbeFailures" "$alert_file" || fail "missing ReadinessProbeFailures alert"
  grep -q "AIShadowDriftDetected" "$alert_file" || fail "missing AIShadowDriftDetected alert"
  grep -q "AIAutoRollbackTriggered" "$alert_file" || fail "missing AIAutoRollbackTriggered alert"
  grep -q "AIInferenceLatencySLAExceeded" "$alert_file" || fail "missing AIInferenceLatencySLAExceeded alert"
  grep -q "AROverlayLatencySLAExceeded" "$alert_file" || fail "missing AROverlayLatencySLAExceeded alert"
}

verify_ai_model_contract() {
  [ -n "$NODE_BIN" ] || fail "missing required command: node"
  [ -f "$AI_MODEL_CONTRACT_PATH" ] || fail "missing AI model contract: $AI_MODEL_CONTRACT_PATH"

  log "verifying AI model contract"
  AI_MODEL_CONTRACT_PATH="$AI_MODEL_CONTRACT_PATH" \
  AI_MODEL_CONTRACT_STRICT_SIGNATURE="$AI_MODEL_CONTRACT_STRICT_SIGNATURE" \
  "$NODE_BIN" scripts/ai/verify-model-contract.mjs
}

verify_shadow_eval_gate() {
  [ -n "$NODE_BIN" ] || fail "missing required command: node"
  [ -f "$AI_SHADOW_EVAL_REPORT_PATH" ] || fail "missing AI shadow report: $AI_SHADOW_EVAL_REPORT_PATH"

  log "verifying AI shadow evaluation gate"
  AI_SHADOW_EVAL_REPORT_PATH="$AI_SHADOW_EVAL_REPORT_PATH" \
  AI_AUTO_ROLLBACK_ON_DRIFT="${AI_AUTO_ROLLBACK_ON_DRIFT:-true}" \
  AI_AUTO_ROLLBACK_SCRIPT_PATH="${AI_AUTO_ROLLBACK_SCRIPT_PATH:-scripts/ai/auto-rollback-model.mjs}" \
  "$NODE_BIN" scripts/ai/shadow-eval-gate.mjs
}

verify_artifact_manifest() {
  if [ "$ARTIFACT_MANIFEST_REQUIRED" != "true" ]; then
    log "artifact manifest verification skipped (ARTIFACT_MANIFEST_REQUIRED=false)"
    return
  fi
  [ -f "$ARTIFACT_MANIFEST_PATH" ] || fail "missing artifact manifest: $ARTIFACT_MANIFEST_PATH"
  [ -n "$NODE_BIN" ] || fail "missing required command: node"
  ARTIFACT_MANIFEST_PATH="$ARTIFACT_MANIFEST_PATH" \
  ARTIFACT_EXPECT_COMMIT="$ARTIFACT_REF" \
  "$NODE_BIN" scripts/ai/verify-artifact-manifest.mjs
}

main() {
  assert_immutable_artifact
  assert_env_and_secrets

  verify_artifact_manifest
  verify_ai_model_contract
  verify_shadow_eval_gate
  run_pre_health_gate
  backup_and_restore_verify
  verify_redis_persistence

  run_migration_gate
  run_sanity_queries
  run_frontend_hardening_gate

  launch_with_process_manager
  run_post_startup_health_gate

  validate_alert_hooks

  log "go/no-go gate passed"
}

main "$@"
