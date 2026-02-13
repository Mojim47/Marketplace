#!/bin/bash

# ════════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Database Backup Script
# 2026 Ready: Automated, Versioned, Encrypted Backups
# ════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups/database}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-nextgen}"
DB_NAME="${DB_NAME:-nextgen_marketplace}"
DB_PASSWORD="${DB_PASSWORD}"
ENABLE_COMPRESSION="${ENABLE_COMPRESSION:-true}"
ENABLE_ENCRYPTION="${ENABLE_ENCRYPTION:-false}"
ENCRYPTION_KEY="${ENCRYPTION_KEY:-}"
LOG_DIR="${LOG_DIR:-/var/log/backups}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Create directories
mkdir -p "${BACKUP_DIR}" "${LOG_DIR}"

# Setup logging
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="${LOG_DIR}/backup_${TIMESTAMP}.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

log "🔄 Starting database backup for ${DB_NAME}..."

# Perform backup
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_backup_${TIMESTAMP}.sql"

if ! pg_dump \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    -v \
    --no-password \
    > "${BACKUP_FILE}" 2>&1; then
    log "❌ Backup failed!"
    exit 1
fi

log "✅ Raw backup created: ${BACKUP_FILE}"

# Compress backup
if [ "${ENABLE_COMPRESSION}" = true ]; then
    if gzip "${BACKUP_FILE}"; then
        BACKUP_FILE="${BACKUP_FILE}.gz"
        log "✅ Backup compressed: ${BACKUP_FILE}"
    else
        log "⚠️  Compression failed, keeping uncompressed backup"
    fi
fi

# Encrypt backup (optional)
if [ "${ENABLE_ENCRYPTION}" = true ] && [ -n "${ENCRYPTION_KEY}" ]; then
    if openssl enc -aes-256-cbc -salt -in "${BACKUP_FILE}" -out "${BACKUP_FILE}.enc" -K "${ENCRYPTION_KEY}" -md sha256; then
        rm -f "${BACKUP_FILE}"
        BACKUP_FILE="${BACKUP_FILE}.enc"
        log "✅ Backup encrypted: ${BACKUP_FILE}"
    else
        log "⚠️  Encryption failed, keeping unencrypted backup"
    fi
fi

# Calculate file size
FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
log "📦 Backup size: ${FILE_SIZE}"

# Cleanup old backups
log "🧹 Cleaning up backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "${DB_NAME}_backup_*" -mtime "+${RETENTION_DAYS}" -delete
log "✅ Cleanup completed"

# Send notification (optional)
if [ -n "${SLACK_WEBHOOK}" ]; then
    curl -X POST "${SLACK_WEBHOOK}" \
        -H 'Content-Type: application/json' \
        -d "{
            \"text\": \"✅ Database Backup Completed\",
            \"attachments\": [{
                \"color\": \"good\",
                \"fields\": [
                    {\"title\": \"Database\", \"value\": \"${DB_NAME}\", \"short\": true},
                    {\"title\": \"Size\", \"value\": \"${FILE_SIZE}\", \"short\": true},
                    {\"title\": \"File\", \"value\": \"${BACKUP_FILE}\", \"short\": false},
                    {\"title\": \"Timestamp\", \"value\": \"${TIMESTAMP}\", \"short\": false}
                ]
            }]
        }" 2>/dev/null || log "⚠️  Slack notification failed"
fi

log "✅ Backup completed successfully!"
exit 0
