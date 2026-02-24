#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

BACKUP_DIR="${DB_BACKUP_DIR:-artifacts/db-backups}"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"

BACKUP_FILE="${BACKUP_DIR}/pre-migrate-${STAMP}.dump"

echo "[db-backup] creating backup: $BACKUP_FILE" >&2
pg_dump --format=custom --no-owner --no-acl --file="$BACKUP_FILE" "$DATABASE_URL"

if [[ ! -s "$BACKUP_FILE" ]]; then
  echo "[db-backup] backup file is empty" >&2
  exit 1
fi

echo "$BACKUP_FILE"
