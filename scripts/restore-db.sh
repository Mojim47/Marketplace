#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Database Restore Script
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Restore PostgreSQL database from MinIO backup
# Usage: ./restore-db.sh [backup-filename]
# ═══════════════════════════════════════════════════════════════════════════

set -e

# ───────────────────────────────────────────────────────────────────────────
# Configuration
# ───────────────────────────────────────────────────────────────────────────
BACKUP_DIR="/tmp/backups"
MINIO_BUCKET="${MINIO_BUCKET:-nextgen-marketplace}"
MINIO_BACKUP_PREFIX="backups/database"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo "${RED}[ERROR]${NC} $1"; }

# ───────────────────────────────────────────────────────────────────────────
# Pre-flight checks
# ───────────────────────────────────────────────────────────────────────────

if [ -z "$1" ]; then
    log_error "Usage: $0 <backup-filename>"
    log_info "Available backups:"
    
    export AWS_ACCESS_KEY_ID="$MINIO_ACCESS_KEY"
    export AWS_SECRET_ACCESS_KEY="$MINIO_SECRET_KEY"
    MINIO_URL="http://${MINIO_ENDPOINT}:${MINIO_PORT:-9000}"
    
    aws s3 ls "s3://${MINIO_BUCKET}/${MINIO_BACKUP_PREFIX}/" \
        --endpoint-url="$MINIO_URL" | \
        grep ".sql.gz" | \
        awk '{print "  - " $4}'
    
    exit 1
fi

BACKUP_FILENAME="$1"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"

mkdir -p "$BACKUP_DIR"

# ───────────────────────────────────────────────────────────────────────────
# Step 1: Download from MinIO
# ───────────────────────────────────────────────────────────────────────────

log_info "Downloading backup from MinIO..."

export AWS_ACCESS_KEY_ID="$MINIO_ACCESS_KEY"
export AWS_SECRET_ACCESS_KEY="$MINIO_SECRET_KEY"
MINIO_URL="http://${MINIO_ENDPOINT}:${MINIO_PORT:-9000}"

aws s3 cp \
    "s3://${MINIO_BUCKET}/${MINIO_BACKUP_PREFIX}/${BACKUP_FILENAME}" \
    "$BACKUP_PATH" \
    --endpoint-url="$MINIO_URL"

if [ $? -ne 0 ]; then
    log_error "Failed to download backup"
    exit 1
fi

log_info "Backup downloaded successfully"

# ───────────────────────────────────────────────────────────────────────────
# Step 2: Restore Database
# ───────────────────────────────────────────────────────────────────────────

log_warn "This will DROP and RECREATE the database!"
log_warn "Press Ctrl+C within 5 seconds to cancel..."
sleep 5

log_info "Restoring database..."

gunzip -c "$BACKUP_PATH" | psql \
    --host="$PGHOST" \
    --port="${PGPORT:-5432}" \
    --username="$PGUSER" \
    --dbname="postgres"

if [ $? -eq 0 ]; then
    log_info "Database restored successfully!"
else
    log_error "Database restore failed"
    exit 1
fi

# Cleanup
rm -f "$BACKUP_PATH"

log_info "Restore completed"
