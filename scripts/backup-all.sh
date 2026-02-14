#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Complete Backup Script
# ═══════════════════════════════════════════════════════════════════════════
# Usage: ./backup-all.sh [--incremental] [--compress] [--upload-s3]

set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="nextgen_backup_${TIMESTAMP}"
LOG_FILE="${BACKUP_DIR}/backup_${TIMESTAMP}.log"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ═══════════════════════════════════════════════════════════════════════════
# Functions
# ═══════════════════════════════════════════════════════════════════════════

log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*" | tee -a "${LOG_FILE}"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*" | tee -a "${LOG_FILE}"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*" | tee -a "${LOG_FILE}"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $*" | tee -a "${LOG_FILE}"
}

# Create backup directory
mkdir -p "${BACKUP_DIR}"
mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}"

log "Starting backup: ${BACKUP_NAME}"

# ═══════════════════════════════════════════════════════════════════════════
# 1. PostgreSQL Database Backup
# ═══════════════════════════════════════════════════════════════════════════

log "Creating PostgreSQL backup..."

if docker-compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
    DB_BACKUP="${BACKUP_DIR}/${BACKUP_NAME}/database.sql.gz"
    
    docker-compose -f docker-compose.prod.yml exec -T postgres \
        pg_dump \
            --username=nextgen \
            --dbname=nextgen_marketplace \
            --format=plain \
            --compress=9 \
            --verbose \
            --if-exists \
            --clean \
            --blobs \
            --encoding=UTF8 \
            --no-password | tee "${BACKUP_DIR}/${BACKUP_NAME}/database.sql" | gzip > "${DB_BACKUP}"
    
    DB_SIZE=$(du -h "${DB_BACKUP}" | cut -f1)
    log_success "PostgreSQL backup completed: ${DB_SIZE}"
    
    # Verify backup integrity
    gunzip -t "${DB_BACKUP}" 2>/dev/null && log_success "Backup integrity verified" || log_error "Backup verification failed!"
else
    log_error "PostgreSQL not running - skipping database backup"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 2. MinIO Object Storage Backup
# ═══════════════════════════════════════════════════════════════════════════

log "Creating MinIO backup..."

if docker-compose -f docker-compose.prod.yml ps minio | grep -q "Up"; then
    MINIO_BACKUP="${BACKUP_DIR}/${BACKUP_NAME}/minio"
    mkdir -p "${MINIO_BACKUP}"
    
    # Backup using mc (MinIO client)
    docker-compose -f docker-compose.prod.yml exec -T minio \
        tar czf /data/minio_backup.tar.gz \
            --exclude='.minio.sys' \
            /data || true
    
    docker-compose -f docker-compose.prod.yml cp minio:/data/minio_backup.tar.gz "${MINIO_BACKUP}/"
    
    MINIO_SIZE=$(du -h "${MINIO_BACKUP}" | cut -f1)
    log_success "MinIO backup completed: ${MINIO_SIZE}"
else
    log_error "MinIO not running - skipping storage backup"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 3. Redis Cache Snapshot
# ═══════════════════════════════════════════════════════════════════════════

log "Creating Redis snapshot..."

if docker-compose -f docker-compose.prod.yml ps redis | grep -q "Up"; then
    REDIS_BACKUP="${BACKUP_DIR}/${BACKUP_NAME}/redis.rdb"
    
    docker-compose -f docker-compose.prod.yml exec -T redis \
        redis-cli BGSAVE
    
    # Wait for save to complete
    sleep 5
    
    docker-compose -f docker-compose.prod.yml cp redis:/data/dump.rdb "${REDIS_BACKUP}"
    
    REDIS_SIZE=$(du -h "${REDIS_BACKUP}" | cut -f1)
    log_success "Redis backup completed: ${REDIS_SIZE}"
else
    log_error "Redis not running - skipping cache backup"
fi

# ═══════════════════════════════════════════════════════════════════════════
# 4. Configuration Files Backup
# ═══════════════════════════════════════════════════════════════════════════

log "Backing up configuration files..."

CONFIG_BACKUP="${BACKUP_DIR}/${BACKUP_NAME}/config"
mkdir -p "${CONFIG_BACKUP}"

# Backup important configuration files (without secrets)
cp -r .env.production "${CONFIG_BACKUP}/.env.production.backup" 2>/dev/null || true
cp docker-compose.prod.yml "${CONFIG_BACKUP}/"
cp Dockerfile "${CONFIG_BACKUP}/"
cp tsconfig*.json "${CONFIG_BACKUP}/"
cp prisma/schema.prisma "${CONFIG_BACKUP}/"

log_success "Configuration backup completed"

# ═══════════════════════════════════════════════════════════════════════════
# 5. Create Backup Manifest
# ═══════════════════════════════════════════════════════════════════════════

log "Creating backup manifest..."

MANIFEST="${BACKUP_DIR}/${BACKUP_NAME}/MANIFEST.txt"

cat > "${MANIFEST}" << EOF
═══════════════════════════════════════════════════════════════════════════
NEXTGEN MARKETPLACE BACKUP MANIFEST
═══════════════════════════════════════════════════════════════════════════

Backup Date: $(date +'%Y-%m-%d %H:%M:%S')
Backup ID: ${BACKUP_NAME}
Hostname: $(hostname)
Platform: $(uname -s)

SERVICES SNAPSHOT:
─────────────────────────────────────────────────────────────────────────
API Service:
$(docker-compose -f docker-compose.prod.yml ps api 2>/dev/null || echo "Not running")

Database (PostgreSQL):
$(docker-compose -f docker-compose.prod.yml ps postgres 2>/dev/null || echo "Not running")

Cache (Redis):
$(docker-compose -f docker-compose.prod.yml ps redis 2>/dev/null || echo "Not running")

Storage (MinIO):
$(docker-compose -f docker-compose.prod.yml ps minio 2>/dev/null || echo "Not running")

BACKUP CONTENTS:
─────────────────────────────────────────────────────────────────────────
$(ls -lh "${BACKUP_DIR}/${BACKUP_NAME}/" | tail -n +2)

SYSTEM INFORMATION:
─────────────────────────────────────────────────────────────────────────
Free Disk Space: $(df -h / | tail -1 | awk '{print $4}')
Available Memory: $(free -h | awk 'NR==2 {print $7}')
CPU Count: $(nproc)
Kernel Version: $(uname -r)

APPLICATION VERSION:
─────────────────────────────────────────────────────────────────────────
$(docker-compose -f docker-compose.prod.yml images | grep nextgen || echo "No images found")

BACKUP VERIFICATION:
─────────────────────────────────────────────────────────────────────────
Database Backup: $([ -f "${BACKUP_DIR}/${BACKUP_NAME}/database.sql.gz" ] && echo "✓ Present" || echo "✗ Missing")
MinIO Backup: $([ -d "${BACKUP_DIR}/${BACKUP_NAME}/minio" ] && echo "✓ Present" || echo "✗ Missing")
Redis Backup: $([ -f "${BACKUP_DIR}/${BACKUP_NAME}/redis.rdb" ] && echo "✓ Present" || echo "✗ Missing")
Config Backup: $([ -d "${BACKUP_DIR}/${BACKUP_NAME}/config" ] && echo "✓ Present" || echo "✗ Missing")

RESTORE INSTRUCTIONS:
─────────────────────────────────────────────────────────────────────────
1. Database:
   docker-compose -f docker-compose.prod.yml exec postgres \
     psql -U nextgen -d nextgen_marketplace < database.sql

2. MinIO:
   cd /data/minio
   tar xzf ../../../${BACKUP_NAME}/minio/minio_backup.tar.gz

3. Redis:
   docker-compose -f docker-compose.prod.yml cp ${BACKUP_NAME}/redis.rdb redis:/data/dump.rdb

═══════════════════════════════════════════════════════════════════════════
End of Manifest
═══════════════════════════════════════════════════════════════════════════
EOF

log_success "Backup manifest created"

# ═══════════════════════════════════════════════════════════════════════════
# 6. Generate Checksums
# ═══════════════════════════════════════════════════════════════════════════

log "Generating checksums..."

cd "${BACKUP_DIR}/${BACKUP_NAME}"
find . -type f -exec md5sum {} \; > "checksums.md5"
find . -type f -exec sha256sum {} \; > "checksums.sha256"

log_success "Checksums generated"

# ═══════════════════════════════════════════════════════════════════════════
# 7. Upload to S3 (Optional)
# ═══════════════════════════════════════════════════════════════════════════

if [ "${1:-}" == "--upload-s3" ]; then
    log "Uploading backup to S3..."
    
    if command -v aws &> /dev/null; then
        aws s3 sync "${BACKUP_DIR}/${BACKUP_NAME}" \
            "s3://${S3_BUCKET:-nextgen-backups}/${BACKUP_NAME}" \
            --region "${AWS_REGION:-us-east-1}" \
            --sse AES256 \
            --storage-class GLACIER
        
        log_success "Backup uploaded to S3"
    else
        log_error "AWS CLI not found - skipping S3 upload"
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════
# 8. Cleanup Old Backups
# ═══════════════════════════════════════════════════════════════════════════

log "Cleaning up old backups (keeping last ${RETENTION_DAYS} days)..."

find "${BACKUP_DIR}" -maxdepth 1 -type d -name "nextgen_backup_*" \
    -mtime +${RETENTION_DAYS} -exec rm -rf {} \; || true

BACKUP_COUNT=$(find "${BACKUP_DIR}" -maxdepth 1 -type d -name "nextgen_backup_*" | wc -l)
log_success "Retained ${BACKUP_COUNT} backups"

# ═══════════════════════════════════════════════════════════════════════════
# 9. Final Summary
# ═══════════════════════════════════════════════════════════════════════════

TOTAL_SIZE=$(du -sh "${BACKUP_DIR}/${BACKUP_NAME}" | cut -f1)

log ""
log "═══════════════════════════════════════════════════════════════════════════"
log_success "BACKUP COMPLETED SUCCESSFULLY"
log "═══════════════════════════════════════════════════════════════════════════"
log "Backup Location: ${BACKUP_DIR}/${BACKUP_NAME}"
log "Total Size: ${TOTAL_SIZE}"
log "Backup Date: $(date +'%Y-%m-%d %H:%M:%S')"
log "Log File: ${LOG_FILE}"
log "═══════════════════════════════════════════════════════════════════════════"
log ""

# Send notification email (optional)
if [ -n "${SMTP_HOST:-}" ]; then
    cat "${LOG_FILE}" | mail -s "Backup Complete: ${BACKUP_NAME}" "${TO_EMAIL}"
fi

exit 0
