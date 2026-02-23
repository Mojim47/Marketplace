#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is required for DB runtime signal checks" >&2
  exit 1
fi

SLOW_QUERY_THRESHOLD_MS="${DB_SLOW_QUERY_THRESHOLD_MS:-250}"
MAX_SLOW_QUERIES="${DB_MAX_SLOW_QUERIES:-0}"
MAX_REPLICA_LAG_SECONDS="${DB_MAX_REPLICA_LAG_SECONDS:-5}"
REQUIRE_PG_STAT_STATEMENTS="${DB_REQUIRE_PG_STAT_STATEMENTS:-true}"
BACKUP_FILE="${DB_MIGRATION_BACKUP_FILE:-${DB_BACKUP_FILE:-}}"
MAX_BACKUP_AGE_HOURS="${DB_MAX_BACKUP_AGE_HOURS:-24}"
REPORT_PATH="${DB_RUNTIME_SIGNALS_REPORT_PATH:-artifacts/release/db-runtime-signals.json}"

mkdir -p "$(dirname "$REPORT_PATH")"

run_sql() {
  local query="$1"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tA -c "$query"
}

trim() {
  echo "$1" | tr -d '[:space:]'
}

pg_stat_exists_raw="$(run_sql "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname='pg_stat_statements');")"
pg_stat_exists="$(trim "$pg_stat_exists_raw")"

slow_query_count="0"
if [[ "$pg_stat_exists" == "t" ]]; then
  slow_query_count_raw="$(run_sql "SELECT COUNT(*) FROM pg_stat_statements WHERE mean_exec_time > ${SLOW_QUERY_THRESHOLD_MS};")"
  slow_query_count="$(trim "$slow_query_count_raw")"
elif [[ "$REQUIRE_PG_STAT_STATEMENTS" == "true" ]]; then
  echo "pg_stat_statements extension is required but not enabled" >&2
  exit 1
fi

replica_lag_seconds_raw="$(run_sql "SELECT CASE WHEN pg_is_in_recovery() THEN COALESCE(EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp()), 0) ELSE 0 END;")"
replica_lag_seconds="$(trim "$replica_lag_seconds_raw")"

backup_age_hours="-1"
backup_status="skipped"
if [[ -n "$BACKUP_FILE" ]]; then
  if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "backup file does not exist: $BACKUP_FILE" >&2
    exit 1
  fi
  now_epoch="$(date +%s)"
  backup_epoch="$(stat -c %Y "$BACKUP_FILE")"
  backup_age_hours="$(( (now_epoch - backup_epoch) / 3600 ))"
  backup_status="ok"
fi

violations=()
if [[ "$pg_stat_exists" == "t" ]] && (( slow_query_count > MAX_SLOW_QUERIES )); then
  violations+=("slow_queries=${slow_query_count} exceeds max=${MAX_SLOW_QUERIES} (threshold_ms=${SLOW_QUERY_THRESHOLD_MS})")
fi

lag_rounded="$(printf '%.0f' "$replica_lag_seconds")"
if (( lag_rounded > MAX_REPLICA_LAG_SECONDS )); then
  violations+=("replica_lag_seconds=${lag_rounded} exceeds max=${MAX_REPLICA_LAG_SECONDS}")
fi

if [[ "$backup_status" == "ok" ]] && (( backup_age_hours > MAX_BACKUP_AGE_HOURS )); then
  violations+=("backup_age_hours=${backup_age_hours} exceeds max=${MAX_BACKUP_AGE_HOURS}")
fi

{
  echo "{"
  echo "  \"status\": \"$( [[ ${#violations[@]} -eq 0 ]] && echo ok || echo fail )\","
  echo "  \"slowQueryThresholdMs\": ${SLOW_QUERY_THRESHOLD_MS},"
  echo "  \"maxSlowQueries\": ${MAX_SLOW_QUERIES},"
  echo "  \"slowQueryCount\": ${slow_query_count},"
  echo "  \"pgStatStatementsEnabled\": $( [[ "$pg_stat_exists" == "t" ]] && echo true || echo false ),"
  echo "  \"maxReplicaLagSeconds\": ${MAX_REPLICA_LAG_SECONDS},"
  echo "  \"replicaLagSeconds\": ${replica_lag_seconds},"
  echo "  \"backupStatus\": \"${backup_status}\","
  echo "  \"backupFile\": \"${BACKUP_FILE}\","
  echo "  \"backupAgeHours\": ${backup_age_hours},"
  echo "  \"maxBackupAgeHours\": ${MAX_BACKUP_AGE_HOURS},"
  echo "  \"violations\": ["
  for i in "${!violations[@]}"; do
    suffix=","
    if [[ "$i" -eq $((${#violations[@]} - 1)) ]]; then
      suffix=""
    fi
    printf '    "%s"%s\n' "${violations[$i]}" "$suffix"
  done
  echo "  ]"
  echo "}"
} > "$REPORT_PATH"

if [[ ${#violations[@]} -gt 0 ]]; then
  echo "db-runtime-signals FAIL" >&2
  for v in "${violations[@]}"; do
    echo "- $v" >&2
  done
  exit 1
fi

echo "db-runtime-signals OK"
echo "report: $REPORT_PATH"
