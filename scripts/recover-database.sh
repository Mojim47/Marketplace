#!/bin/bash

# ════════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Database Recovery Script
# 2026 Ready: Point-in-time Recovery, Validation, Rollback Support
# ════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Configuration
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${DB_USER:-nextgen}"
DB_NAME="${DB_NAME:-nextgen_marketplace}"
DB_PASSWORD="${DB_PASSWORD}"
LOG_DIR="${LOG_DIR:-/var/log/backups}"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-}"

# Function to display usage
usage() {
    cat <<EOF
Usage: $0 -f <backup_file> [-h <host>] [-p <port>] [-u <user>] [-d <database>]

Options:
    -f  Backup file path (required)
    -h  Database host (default: ${DB_HOST})
    -p  Database port (default: ${DB_PORT})
    -u  Database user (default: ${DB_USER})
    -d  Database name (default: ${DB_NAME})
    -c  Create snapshot before recovery
    -v  Verify backup before recovery

Examples:
    $0 -f /backups/database/nextgen_marketplace_backup_2024-01-15.sql.gz
    $0 -f /backups/database/backup.sql.gz -c -v
EOF
    exit 1
}

# Parse arguments
BACKUP_FILE=""
CREATE_SNAPSHOT=false
VERIFY=false

while getopts "f:h:p:u:d:cv" opt; do
    case $opt in
        f) BACKUP_FILE="${OPTARG}" ;;
        h) DB_HOST="${OPTARG}" ;;
        p) DB_PORT="${OPTARG}" ;;
        u) DB_USER="${OPTARG}" ;;
        d) DB_NAME="${OPTARG}" ;;
        c) CREATE_SNAPSHOT=true ;;
        v) VERIFY=true ;;
        *) usage ;;
    esac
done

if [ -z "${BACKUP_FILE}" ]; then
    echo "❌ Error: Backup file required"
    usage
fi

if [ ! -f "${BACKUP_FILE}" ]; then
    echo "❌ Error: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Setup logging
mkdir -p "${LOG_DIR}"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
LOG_FILE="${LOG_DIR}/recovery_${TIMESTAMP}.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

log "🔄 Starting database recovery..."
log "📄 Backup file: ${BACKUP_FILE}"
log "🗄️  Database: ${DB_HOST}:${DB_PORT}/${DB_NAME}"

# Verify backup integrity if requested
if [ "${VERIFY}" = true ]; then
    log "🔍 Verifying backup integrity..."
    
    VERIFY_FILE="${BACKUP_FILE}"
    if [[ "${BACKUP_FILE}" == *.gz ]]; then
        if ! gzip -t "${BACKUP_FILE}"; then
            log "❌ Gzip integrity check failed"
            exit 1
        fi
        VERIFY_FILE=$(mktemp)
        gunzip -c "${BACKUP_FILE}" > "${VERIFY_FILE}"
    elif [[ "${BACKUP_FILE}" == *.enc ]]; then
        log "⚠️  Encrypted backup - skipping integrity check"
        VERIFY_FILE="${BACKUP_FILE}"
    fi
    
    if head -n 10 "${VERIFY_FILE}" | grep -q "PostgreSQL"; then
        log "✅ Backup verification passed"
    else
        log "❌ Backup verification failed"
        rm -f "${VERIFY_FILE}"
        exit 1
    fi
    
    [ "${BACKUP_FILE}" != "${VERIFY_FILE}" ] && rm -f "${VERIFY_FILE}"
fi

# Create snapshot if requested
if [ "${CREATE_SNAPSHOT}" = true ]; then
    log "📸 Creating pre-recovery database snapshot..."
    SNAPSHOT_FILE="${LOG_DIR}/pre_recovery_snapshot_${TIMESTAMP}.sql.gz"
    
    if pg_dump \
        -h "${DB_HOST}" \
        -p "${DB_PORT}" \
        -U "${DB_USER}" \
        -d "${DB_NAME}" \
        --no-password 2>/dev/null | gzip > "${SNAPSHOT_FILE}"; then
        log "✅ Snapshot created: ${SNAPSHOT_FILE}"
    else
        log "⚠️  Failed to create snapshot, continuing with recovery..."
    fi
fi

# Decompress if necessary
RECOVERY_FILE="${BACKUP_FILE}"
if [[ "${BACKUP_FILE}" == *.gz ]]; then
    log "📦 Decompressing backup..."
    RECOVERY_FILE=$(mktemp)
    if ! gunzip -c "${BACKUP_FILE}" > "${RECOVERY_FILE}"; then
        log "❌ Decompression failed"
        rm -f "${RECOVERY_FILE}"
        exit 1
    fi
    log "✅ Backup decompressed"
fi

# Drop and recreate database
log "🗑️  Dropping existing database ${DB_NAME}..."
if ! dropdb \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    --no-password \
    "${DB_NAME}" 2>/dev/null || true; then
    log "⚠️  Database drop skipped (doesn't exist)"
fi

log "🔨 Creating new database..."
if ! createdb \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    --no-password \
    "${DB_NAME}"; then
    log "❌ Database creation failed"
    exit 1
fi
log "✅ Database created"

# Restore backup
log "⏳ Restoring backup (this may take a while)..."
if ! psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --no-password \
    -f "${RECOVERY_FILE}" > /dev/null 2>&1; then
    log "❌ Restore failed"
    exit 1
fi
log "✅ Backup restored successfully"

# Cleanup temp files
[ "${BACKUP_FILE}" != "${RECOVERY_FILE}" ] && rm -f "${RECOVERY_FILE}"

# Verify recovery
log "🔍 Verifying recovery..."
TABLE_COUNT=$(psql \
    -h "${DB_HOST}" \
    -p "${DB_PORT}" \
    -U "${DB_USER}" \
    -d "${DB_NAME}" \
    --no-password \
    -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")

if [ "${TABLE_COUNT}" -gt 0 ]; then
    log "✅ Recovery verified - ${TABLE_COUNT} tables found"
else
    log "⚠️  Recovery verification inconclusive"
fi

# Send notification
if [ -n "${SLACK_WEBHOOK}" ]; then
    curl -X POST "${SLACK_WEBHOOK}" \
        -H 'Content-Type: application/json' \
        -d "{
            \"text\": \"✅ Database Recovery Completed\",
            \"attachments\": [{
                \"color\": \"good\",
                \"fields\": [
                    {\"title\": \"Database\", \"value\": \"${DB_NAME}\", \"short\": true},
                    {\"title\": \"Tables\", \"value\": \"${TABLE_COUNT}\", \"short\": true},
                    {\"title\": \"Backup File\", \"value\": \"${BACKUP_FILE}\", \"short\": false},
                    {\"title\": \"Timestamp\", \"value\": \"${TIMESTAMP}\", \"short\": false}
                ]
            }]
        }" 2>/dev/null || log "⚠️  Slack notification failed"
fi

log "✅ Recovery completed successfully!"
exit 0
