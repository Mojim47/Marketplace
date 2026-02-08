#!/bin/sh
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Automated Database Backup Script
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Automated PostgreSQL backup with AES-256 encryption and MinIO upload
# Schedule: Runs every 12 hours via cron
# Retention: 7 daily backups in MinIO, 30 days in archive
# Requirements: 9.1, 9.2 - Automated daily backups with AES-256 encryption
# ═══════════════════════════════════════════════════════════════════════════

set -e

# ───────────────────────────────────────────────────────────────────────────
# Configuration
# ───────────────────────────────────────────────────────────────────────────
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILENAME="nextgen_db_backup_${TIMESTAMP}.sql.gz.enc"
BACKUP_DIR="/tmp/backups"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"
BACKUP_TEMP_PATH="${BACKUP_DIR}/nextgen_db_backup_${TIMESTAMP}.sql.gz"
MINIO_BUCKET="${MINIO_BUCKET:-nextgen-marketplace}"
MINIO_BACKUP_PREFIX="backups/database"

# Encryption settings
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-/etc/nextgen/backup.key}"
ENCRYPTION_ALGORITHM="aes-256-cbc"
PBKDF2_ITERATIONS=100000

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ───────────────────────────────────────────────────────────────────────────
# Functions
# ───────────────────────────────────────────────────────────────────────────

log_info() {
    echo "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo "${RED}[ERROR]${NC} $1"
}

# ───────────────────────────────────────────────────────────────────────────
# Encryption Functions
# ───────────────────────────────────────────────────────────────────────────

generate_encryption_key() {
    local key_dir=$(dirname "$ENCRYPTION_KEY_FILE")
    mkdir -p "$key_dir"
    
    # Generate a secure 256-bit key using OpenSSL
    openssl rand -base64 32 > "$ENCRYPTION_KEY_FILE"
    chmod 600 "$ENCRYPTION_KEY_FILE"
    
    log_info "Generated new encryption key at $ENCRYPTION_KEY_FILE"
    log_warn "IMPORTANT: Backup this key securely! Without it, backups cannot be restored."
}

encrypt_backup() {
    local input_file="$1"
    local output_file="$2"
    
    log_info "Encrypting backup with AES-256-CBC..."
    
    # Use OpenSSL with PBKDF2 key derivation for secure encryption
    openssl enc -${ENCRYPTION_ALGORITHM} \
        -salt \
        -pbkdf2 \
        -iter ${PBKDF2_ITERATIONS} \
        -in "$input_file" \
        -out "$output_file" \
        -pass file:"$ENCRYPTION_KEY_FILE"
    
    if [ $? -ne 0 ]; then
        log_error "Encryption failed"
        return 1
    fi
    
    log_info "Backup encrypted successfully"
    return 0
}

decrypt_backup() {
    local input_file="$1"
    local output_file="$2"
    
    log_info "Decrypting backup..."
    
    openssl enc -${ENCRYPTION_ALGORITHM} \
        -d \
        -salt \
        -pbkdf2 \
        -iter ${PBKDF2_ITERATIONS} \
        -in "$input_file" \
        -out "$output_file" \
        -pass file:"$ENCRYPTION_KEY_FILE"
    
    if [ $? -ne 0 ]; then
        log_error "Decryption failed"
        return 1
    fi
    
    log_info "Backup decrypted successfully"
    return 0
}

generate_checksum() {
    local file="$1"
    local checksum_file="${file}.sha256"
    
    sha256sum "$file" | awk '{print $1}' > "$checksum_file"
    log_info "Checksum generated: $(cat $checksum_file)"
    
    echo "$checksum_file"
}

verify_checksum() {
    local file="$1"
    local checksum_file="${file}.sha256"
    
    if [ ! -f "$checksum_file" ]; then
        log_error "Checksum file not found: $checksum_file"
        return 1
    fi
    
    local stored_checksum=$(cat "$checksum_file")
    local computed_checksum=$(sha256sum "$file" | awk '{print $1}')
    
    if [ "$stored_checksum" = "$computed_checksum" ]; then
        log_info "Checksum verification passed"
        return 0
    else
        log_error "Checksum verification failed!"
        log_error "Expected: $stored_checksum"
        log_error "Got: $computed_checksum"
        return 1
    fi
}

# ───────────────────────────────────────────────────────────────────────────
# Pre-flight checks
# ───────────────────────────────────────────────────────────────────────────

log_info "Starting database backup process..."

# Check required environment variables
if [ -z "$PGHOST" ] || [ -z "$PGDATABASE" ] || [ -z "$PGUSER" ] || [ -z "$PGPASSWORD" ]; then
    log_error "Required PostgreSQL environment variables not set"
    exit 1
fi

if [ -z "$MINIO_ENDPOINT" ] || [ -z "$MINIO_ACCESS_KEY" ] || [ -z "$MINIO_SECRET_KEY" ]; then
    log_warn "MinIO environment variables not set - skipping remote upload"
    SKIP_MINIO=true
fi

# Check encryption key
if [ ! -f "$ENCRYPTION_KEY_FILE" ]; then
    log_warn "Encryption key file not found. Generating new key..."
    generate_encryption_key
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# ───────────────────────────────────────────────────────────────────────────
# Step 1: Create PostgreSQL Dump
# ───────────────────────────────────────────────────────────────────────────

log_info "Creating PostgreSQL dump..."

pg_dump \
    --host="$PGHOST" \
    --port="${PGPORT:-5432}" \
    --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    --format=plain \
    --verbose \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    --create \
    2>/dev/null | gzip -9 > "$BACKUP_TEMP_PATH"

if [ $? -ne 0 ]; then
    log_error "Database dump failed"
    exit 1
fi

UNENCRYPTED_SIZE=$(du -h "$BACKUP_TEMP_PATH" | cut -f1)
log_info "Database dump created successfully (Size: ${UNENCRYPTED_SIZE})"

# ───────────────────────────────────────────────────────────────────────────
# Step 2: Encrypt Backup with AES-256
# ───────────────────────────────────────────────────────────────────────────

log_info "Encrypting backup with AES-256-CBC..."

encrypt_backup "$BACKUP_TEMP_PATH" "$BACKUP_PATH"

if [ $? -ne 0 ]; then
    log_error "Backup encryption failed"
    rm -f "$BACKUP_TEMP_PATH"
    exit 1
fi

# Remove unencrypted temp file
rm -f "$BACKUP_TEMP_PATH"

BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
log_info "Encrypted backup created (Size: ${BACKUP_SIZE})"

# ───────────────────────────────────────────────────────────────────────────
# Step 3: Generate Checksum
# ───────────────────────────────────────────────────────────────────────────

log_info "Generating SHA-256 checksum..."
CHECKSUM_FILE=$(generate_checksum "$BACKUP_PATH")

# ───────────────────────────────────────────────────────────────────────────
# Step 4: Upload to MinIO
# ───────────────────────────────────────────────────────────────────────────

if [ "${SKIP_MINIO:-false}" = "true" ]; then
    log_warn "Skipping MinIO upload (not configured)"
else
    log_info "Uploading encrypted backup to MinIO..."

    # Configure AWS CLI for MinIO
    export AWS_ACCESS_KEY_ID="$MINIO_ACCESS_KEY"
    export AWS_SECRET_ACCESS_KEY="$MINIO_SECRET_KEY"
    export AWS_DEFAULT_REGION="us-east-1"

    MINIO_URL="http://${MINIO_ENDPOINT}:${MINIO_PORT:-9000}"

    aws configure set default.s3.signature_version s3v4
    aws configure set default.s3.max_concurrent_requests 10

    # Upload encrypted backup to MinIO
    aws s3 cp "$BACKUP_PATH" \
        "s3://${MINIO_BUCKET}/${MINIO_BACKUP_PREFIX}/${BACKUP_FILENAME}" \
        --endpoint-url="$MINIO_URL" \
        2>&1

    if [ $? -ne 0 ]; then
        log_error "Failed to upload backup to MinIO"
        exit 1
    fi

    # Upload checksum file
    aws s3 cp "$CHECKSUM_FILE" \
        "s3://${MINIO_BUCKET}/${MINIO_BACKUP_PREFIX}/${BACKUP_FILENAME}.sha256" \
        --endpoint-url="$MINIO_URL" \
        2>&1

    log_info "Encrypted backup and checksum uploaded successfully to MinIO"
fi

# ───────────────────────────────────────────────────────────────────────────
# Step 5: Verify Upload
# ───────────────────────────────────────────────────────────────────────────

if [ "${SKIP_MINIO:-false}" != "true" ]; then
    log_info "Verifying uploaded backup..."

    aws s3 ls "s3://${MINIO_BUCKET}/${MINIO_BACKUP_PREFIX}/${BACKUP_FILENAME}" \
        --endpoint-url="$MINIO_URL" \
        > /dev/null 2>&1

    if [ $? -eq 0 ]; then
        log_info "Backup verification successful"
    else
        log_warn "Could not verify backup (may still be successful)"
    fi
fi

# ───────────────────────────────────────────────────────────────────────────
# Step 6: Cleanup Old Backups
# ───────────────────────────────────────────────────────────────────────────

if [ "${SKIP_MINIO:-false}" != "true" ]; then
    log_info "Cleaning up old backups (keeping last 14)..."

    # List all backups and delete old ones
    aws s3 ls "s3://${MINIO_BUCKET}/${MINIO_BACKUP_PREFIX}/" \
        --endpoint-url="$MINIO_URL" | \
        grep "\.enc$" | \
        sort -r | \
        tail -n +15 | \
        awk '{print $4}' | \
        while read filename; do
            if [ ! -z "$filename" ]; then
                log_info "Deleting old backup: $filename"
                aws s3 rm "s3://${MINIO_BUCKET}/${MINIO_BACKUP_PREFIX}/${filename}" \
                    --endpoint-url="$MINIO_URL" \
                    2>&1
                # Also delete checksum file
                aws s3 rm "s3://${MINIO_BUCKET}/${MINIO_BACKUP_PREFIX}/${filename}.sha256" \
                    --endpoint-url="$MINIO_URL" \
                    2>&1 || true
            fi
        done
fi

# ───────────────────────────────────────────────────────────────────────────
# Step 7: Local Cleanup
# ───────────────────────────────────────────────────────────────────────────

log_info "Cleaning up local backup files..."

# Keep local backup for verification, clean up old ones
# Clean up old local backups (keep last 3)
find "$BACKUP_DIR" -name "nextgen_db_backup_*.sql.gz.enc" -type f | \
    sort -r | \
    tail -n +4 | \
    xargs rm -f 2>/dev/null || true

find "$BACKUP_DIR" -name "nextgen_db_backup_*.sql.gz.enc.sha256" -type f | \
    sort -r | \
    tail -n +4 | \
    xargs rm -f 2>/dev/null || true

# ───────────────────────────────────────────────────────────────────────────
# Summary
# ───────────────────────────────────────────────────────────────────────────

log_info "═══════════════════════════════════════════════════════════"
log_info "Backup completed successfully!"
log_info "Filename: ${BACKUP_FILENAME}"
log_info "Size: ${BACKUP_SIZE}"
log_info "Encryption: AES-256-CBC with PBKDF2"
log_info "Checksum: SHA-256"
if [ "${SKIP_MINIO:-false}" != "true" ]; then
    log_info "Location: s3://${MINIO_BUCKET}/${MINIO_BACKUP_PREFIX}/"
else
    log_info "Location: ${BACKUP_PATH}"
fi
log_info "Timestamp: $(date)"
log_info "═══════════════════════════════════════════════════════════"

exit 0
