#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

BACKUP_FILE="${1:-}"
if [[ -z "$BACKUP_FILE" ]]; then
  echo "Usage: rollback-from-backup.sh <backup.dump>" >&2
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

echo "[db-rollback] restoring backup: $BACKUP_FILE"
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$DATABASE_URL" "$BACKUP_FILE"

echo "[db-rollback] restore complete"
