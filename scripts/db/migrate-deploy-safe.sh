#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

BACKUP_FILE="${DB_MIGRATION_BACKUP_FILE:-}"
if [[ -z "$BACKUP_FILE" ]]; then
  BACKUP_FILE="$(bash scripts/db/backup-before-migrate.sh)"
fi

echo "[db-migrate-safe] using backup: $BACKUP_FILE"

echo "[db-migrate-safe] prisma validate"
pnpm exec prisma validate --schema prisma/schema.prisma

echo "[db-migrate-safe] prisma generate"
pnpm run db:generate

set +e
pnpm exec prisma migrate deploy --schema prisma/schema.prisma
MIGRATE_EXIT=$?
set -e

if [[ $MIGRATE_EXIT -ne 0 ]]; then
  echo "[db-migrate-safe] migration failed, rolling back" >&2
  bash scripts/db/rollback-from-backup.sh "$BACKUP_FILE"
  exit $MIGRATE_EXIT
fi

echo "[db-migrate-safe] checking runtime schema drift"
if [[ "${DB_SKIP_RUNTIME_DRIFT_CHECK:-false}" == "true" ]]; then
  echo "[db-migrate-safe] runtime schema drift check skipped (DB_SKIP_RUNTIME_DRIFT_CHECK=true)"
else
  pnpm exec prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --exit-code
fi

echo "[db-migrate-safe] success"
