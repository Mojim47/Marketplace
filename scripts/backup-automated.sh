#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Automated Backup System
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Enterprise-grade automated backup with encryption and verification
# Schedule: Daily at 02:00 AM (configurable via cron)
# Retention: 7 daily, 4 weekly, 12 monthly backups
# Requirements: 9.1 - Automated daily backups of PostgreSQL database
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ───────────────────────────────────────────────────────────────────────────
# Configuration
# ───────────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
DATE_ONLY=$(date +"%Y%m%d")
DAY_OF_WEEK=$(date +"%u")  # 1=Monday, 7=Sunday
DAY_OF_MONTH=$(date +"%d")

# Backup directories
BACKUP_BASE_DIR="${BACKUP_BASE_DIR:-/var/backups/nextgen}"
BACKUP_DAILY_DIR="${BACKUP_BASE_DIR}/daily"
BACKUP_WEEKLY_DIR="${BACKUP_BASE_DIR}/weekly"
BACKUP_MONTHLY_DIR="${BACKUP_BASE_DIR}/monthly"
BACKUP_TEMP_DIR="${BACKUP_BASE_DIR}/temp"
LOG_DIR="${BACKUP_BASE_DIR}/logs"

# Retention settings
DAILY_RETENTION=7
WEEKLY_RETENTION=4
MONTHLY_RETENTION=12

# Encryption settings
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-/etc/nextgen/backup.key}"
ENCRYPTION_ALGORITHM="aes-256-cbc"

# MinIO settings
MINIO_BUCKET="${MINIO_BUCKET:-nextgen-marketplace}"
MINIO_BACKUP_PREFIX="backups/database"

# Notification settings
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ───────────────────────────────────────────────────────────────────────────
# Logging Functions
# ───────────────────────────────────────────────────────────────────────────
LOG_FILE="${LOG_DIR}/backup_${DATE_ONLY}.log"

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
    log "INFO" "$1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    log "WARN" "$1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    log "ERROR" "$1"
}

log_debug() {
    if [ "${DEBUG:-false}" = "true" ]; then
        echo -e "${BLUE}[DEBUG]${NC} $1"
        log "DEBUG" "$1"
    fi
}

# ───────────────────────────────────────────────────────────────────────────
# Notification Functions
# ───────────────────────────────────────────────────────────────────────────
send_notification() {
    local status="$1"
    local message="$2"
    local details="${3:-}"
    
    # Slack notification
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local color="good"
        [ "$status" = "error" ] && color="danger"
        [ "$status" = "warning" ] && color="warning"
        
        curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{
                \"attachments\": [{
                    \"color\": \"${color}\",
                    \"title\": \"NextGen Backup - ${status^^}\",
                    \"text\": \"${message}\",
                    \"fields\": [{
                        \"title\": \"Details\",
                        \"value\": \"${details}\",
                        \"short\": false
                    }],
                    \"footer\": \"NextGen Marketplace Backup System\",
                    \"ts\": $(date +%s)
                }]
            }" > /dev/null 2>&1 || true
    fi
    
    # Discord notification
    if [ -n "$DISCORD_WEBHOOK_URL" ]; then
        local color=3066993  # Green
        [ "$status" = "error" ] && color=15158332  # Red
        [ "$status" = "warning" ] && color=15105570  # Yellow
        
        curl -s -X POST "$DISCORD_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{
                \"embeds\": [{
                    \"title\": \"NextGen Backup - ${status^^}\",
                    \"description\": \"${message}\",
                    \"color\": ${color},
                    \"fields\": [{
                        \"name\": \"Details\",
                        \"value\": \"${details}\"
                    }],
                    \"footer\": {
                        \"text\": \"NextGen Marketplace Backup System\"
                    },
                    \"timestamp\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"
                }]
            }" > /dev/null 2>&1 || true
    fi
}

# ───────────────────────────────────────────────────────────────────────────
# Initialization
# ───────────────────────────────────────────────────────────────────────────
init_directories() {
    log_info "Initializing backup directories..."
    mkdir -p "$BACKUP_DAILY_DIR"
    mkdir -p "$BACKUP_WEEKLY_DIR"
    mkdir -p "$BACKUP_MONTHLY_DIR"
    mkdir -p "$BACKUP_TEMP_DIR"
    mkdir -p "$LOG_DIR"
    
    # Set secure permissions
    chmod 700 "$BACKUP_BASE_DIR"
    chmod 700 "$BACKUP_DAILY_DIR"
    chmod 700 "$BACKUP_WEEKLY_DIR"
    chmod 700 "$BACKUP_MONTHLY_DIR"
    chmod 700 "$BACKUP_TEMP_DIR"
}

# ───────────────────────────────────────────────────────────────────────────
# Pre-flight Checks
# ───────────────────────────────────────────────────────────────────────────
preflight_checks() {
    log_info "Running pre-flight checks..."
    
    # Check PostgreSQL environment variables
    if [ -z "${PGHOST:-}" ] || [ -z "${PGDATABASE:-}" ] || [ -z "${PGUSER:-}" ] || [ -z "${PGPASSWORD:-}" ]; then
        log_error "Required PostgreSQL environment variables not set (PGHOST, PGDATABASE, PGUSER, PGPASSWORD)"
        send_notification "error" "Backup failed: Missing PostgreSQL configuration" "Check environment variables"
        exit 1
    fi
    
    # Check encryption key
    if [ ! -f "$ENCRYPTION_KEY_FILE" ]; then
        log_warn "Encryption key file not found. Generating new key..."
        generate_encryption_key
    fi
    
    # Check disk space (require at least 10GB free)
    local free_space=$(df -BG "$BACKUP_BASE_DIR" | tail -1 | awk '{print $4}' | tr -d 'G')
    if [ "$free_space" -lt 10 ]; then
        log_error "Insufficient disk space: ${free_space}GB available, 10GB required"
        send_notification "error" "Backup failed: Insufficient disk space" "${free_space}GB available"
        exit 1
    fi
    
    # Check PostgreSQL connectivity
    if ! PGPASSWORD="$PGPASSWORD" pg_isready -h "$PGHOST" -p "${PGPORT:-5432}" -U "$PGUSER" > /dev/null 2>&1; then
        log_error "Cannot connect to PostgreSQL database"
        send_notification "error" "Backup failed: Database connection failed" "Host: $PGHOST"
        exit 1
    fi
    
    log_info "Pre-flight checks passed"
}

# ───────────────────────────────────────────────────────────────────────────
# Encryption Key Management
# ───────────────────────────────────────────────────────────────────────────
generate_encryption_key() {
    local key_dir=$(dirname "$ENCRYPTION_KEY_FILE")
    mkdir -p "$key_dir"
    
    # Generate a secure 256-bit key
    openssl rand -base64 32 > "$ENCRYPTION_KEY_FILE"
    chmod 600 "$ENCRYPTION_KEY_FILE"
    
    log_info "Generated new encryption key at $ENCRYPTION_KEY_FILE"
    log_warn "IMPORTANT: Backup this key securely! Without it, backups cannot be restored."
}

# ───────────────────────────────────────────────────────────────────────────
# Database Backup
# ───────────────────────────────────────────────────────────────────────────
create_database_backup() {
    local backup_file="$1"
    local temp_file="${BACKUP_TEMP_DIR}/nextgen_db_${TIMESTAMP}.sql"
    
    log_info "Creating PostgreSQL dump..."
    
    # Create dump with all options for complete backup
    PGPASSWORD="$PGPASSWORD" pg_dump \
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
        --encoding=UTF8 \
        2>> "$LOG_FILE" > "$temp_file"
    
    if [ $? -ne 0 ]; then
        log_error "Database dump failed"
        rm -f "$temp_file"
        return 1
    fi
    
    # Compress the backup
    log_info "Compressing backup..."
    gzip -9 "$temp_file"
    temp_file="${temp_file}.gz"
    
    # Encrypt the backup
    log_info "Encrypting backup with AES-256..."
    openssl enc -${ENCRYPTION_ALGORITHM} -salt -pbkdf2 -iter 100000 \
        -in "$temp_file" \
        -out "${backup_file}" \
        -pass file:"$ENCRYPTION_KEY_FILE"
    
    if [ $? -ne 0 ]; then
        log_error "Encryption failed"
        rm -f "$temp_file"
        return 1
    fi
    
    # Generate checksum
    local checksum_file="${backup_file}.sha256"
    sha256sum "$backup_file" | awk '{print $1}' > "$checksum_file"
    
    # Clean up temp file
    rm -f "$temp_file"
    
    local backup_size=$(du -h "$backup_file" | cut -f1)
    log_info "Backup created: $backup_file (Size: $backup_size)"
    
    echo "$backup_size"
}

# ───────────────────────────────────────────────────────────────────────────
# Backup Rotation
# ───────────────────────────────────────────────────────────────────────────
rotate_backups() {
    log_info "Rotating backups..."
    
    # Rotate daily backups (keep last 7)
    log_debug "Cleaning daily backups (keeping last $DAILY_RETENTION)..."
    find "$BACKUP_DAILY_DIR" -name "*.enc" -type f -mtime +$DAILY_RETENTION -delete
    find "$BACKUP_DAILY_DIR" -name "*.sha256" -type f -mtime +$DAILY_RETENTION -delete
    
    # Rotate weekly backups (keep last 4)
    log_debug "Cleaning weekly backups (keeping last $WEEKLY_RETENTION)..."
    find "$BACKUP_WEEKLY_DIR" -name "*.enc" -type f -mtime +$((WEEKLY_RETENTION * 7)) -delete
    find "$BACKUP_WEEKLY_DIR" -name "*.sha256" -type f -mtime +$((WEEKLY_RETENTION * 7)) -delete
    
    # Rotate monthly backups (keep last 12)
    log_debug "Cleaning monthly backups (keeping last $MONTHLY_RETENTION)..."
    find "$BACKUP_MONTHLY_DIR" -name "*.enc" -type f -mtime +$((MONTHLY_RETENTION * 30)) -delete
    find "$BACKUP_MONTHLY_DIR" -name "*.sha256" -type f -mtime +$((MONTHLY_RETENTION * 30)) -delete
    
    # Clean old logs (keep last 30 days)
    find "$LOG_DIR" -name "*.log" -type f -mtime +30 -delete
    
    log_info "Backup rotation completed"
}

# ───────────────────────────────────────────────────────────────────────────
# Upload to MinIO
# ───────────────────────────────────────────────────────────────────────────
upload_to_minio() {
    local backup_file="$1"
    local backup_filename=$(basename "$backup_file")
    
    if [ -z "${MINIO_ENDPOINT:-}" ] || [ -z "${MINIO_ACCESS_KEY:-}" ] || [ -z "${MINIO_SECRET_KEY:-}" ]; then
        log_warn "MinIO not configured, skipping remote upload"
        return 0
    fi
    
    log_info "Uploading backup to MinIO..."
    
    export AWS_ACCESS_KEY_ID="$MINIO_ACCESS_KEY"
    export AWS_SECRET_ACCESS_KEY="$MINIO_SECRET_KEY"
    export AWS_DEFAULT_REGION="us-east-1"
    
    local minio_url="http://${MINIO_ENDPOINT}:${MINIO_PORT:-9000}"
    
    aws s3 cp "$backup_file" \
        "s3://${MINIO_BUCKET}/${MINIO_BACKUP_PREFIX}/${backup_filename}" \
        --endpoint-url="$minio_url" \
        2>> "$LOG_FILE"
    
    # Also upload checksum
    aws s3 cp "${backup_file}.sha256" \
        "s3://${MINIO_BUCKET}/${MINIO_BACKUP_PREFIX}/${backup_filename}.sha256" \
        --endpoint-url="$minio_url" \
        2>> "$LOG_FILE"
    
    if [ $? -eq 0 ]; then
        log_info "Backup uploaded to MinIO successfully"
    else
        log_warn "Failed to upload backup to MinIO"
    fi
}

# ───────────────────────────────────────────────────────────────────────────
# Main Backup Process
# ───────────────────────────────────────────────────────────────────────────
main() {
    local start_time=$(date +%s)
    
    log_info "═══════════════════════════════════════════════════════════"
    log_info "Starting NextGen Marketplace Automated Backup"
    log_info "Timestamp: $(date)"
    log_info "═══════════════════════════════════════════════════════════"
    
    # Initialize
    init_directories
    preflight_checks
    
    # Create daily backup
    local daily_backup="${BACKUP_DAILY_DIR}/nextgen_daily_${TIMESTAMP}.sql.gz.enc"
    local backup_size=$(create_database_backup "$daily_backup")
    
    if [ $? -ne 0 ]; then
        log_error "Backup creation failed"
        send_notification "error" "Daily backup failed" "Check logs at $LOG_FILE"
        exit 1
    fi
    
    # Create weekly backup (on Sunday)
    if [ "$DAY_OF_WEEK" -eq 7 ]; then
        log_info "Creating weekly backup (Sunday)..."
        cp "$daily_backup" "${BACKUP_WEEKLY_DIR}/nextgen_weekly_${TIMESTAMP}.sql.gz.enc"
        cp "${daily_backup}.sha256" "${BACKUP_WEEKLY_DIR}/nextgen_weekly_${TIMESTAMP}.sql.gz.enc.sha256"
    fi
    
    # Create monthly backup (on 1st of month)
    if [ "$DAY_OF_MONTH" -eq "01" ]; then
        log_info "Creating monthly backup (1st of month)..."
        cp "$daily_backup" "${BACKUP_MONTHLY_DIR}/nextgen_monthly_${TIMESTAMP}.sql.gz.enc"
        cp "${daily_backup}.sha256" "${BACKUP_MONTHLY_DIR}/nextgen_monthly_${TIMESTAMP}.sql.gz.enc.sha256"
    fi
    
    # Upload to MinIO
    upload_to_minio "$daily_backup"
    
    # Rotate old backups
    rotate_backups
    
    # Calculate duration
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    # Summary
    log_info "═══════════════════════════════════════════════════════════"
    log_info "Backup completed successfully!"
    log_info "Filename: $(basename $daily_backup)"
    log_info "Size: $backup_size"
    log_info "Duration: ${duration} seconds"
    log_info "Location: $daily_backup"
    log_info "═══════════════════════════════════════════════════════════"
    
    # Send success notification
    send_notification "success" "Daily backup completed successfully" "Size: $backup_size, Duration: ${duration}s"
    
    exit 0
}

# ───────────────────────────────────────────────────────────────────────────
# Script Entry Point
# ───────────────────────────────────────────────────────────────────────────
main "$@"
