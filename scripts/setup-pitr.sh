#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Point-in-Time Recovery Setup Script
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Configure PostgreSQL for Point-in-Time Recovery (PITR)
# Requirements: 9.4 - Support point-in-time recovery for the last 30 days
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ───────────────────────────────────────────────────────────────────────────
# Configuration
# ───────────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WAL_ARCHIVE_DIR="${WAL_ARCHIVE_DIR:-/var/lib/postgresql/wal_archive}"
PGDATA="${PGDATA:-/var/lib/postgresql/data}"
PITR_CONFIG="${SCRIPT_DIR}/../infra/postgres/postgresql-pitr.conf"
RETENTION_DAYS=30

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ───────────────────────────────────────────────────────────────────────────
# Functions
# ───────────────────────────────────────────────────────────────────────────

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

usage() {
    cat << EOF
Usage: $(basename "$0") [COMMAND]

Commands:
    setup           Set up WAL archiving for PITR
    status          Check PITR configuration status
    cleanup         Clean old WAL archives (older than $RETENTION_DAYS days)
    recover         Start recovery to a specific point in time
    list-archives   List available WAL archives
    help            Show this help message

Examples:
    $(basename "$0") setup
    $(basename "$0") status
    $(basename "$0") cleanup
    $(basename "$0") recover "2024-01-15 10:00:00"

EOF
    exit 0
}

# Set up WAL archiving
setup_wal_archiving() {
    log_info "Setting up WAL archiving for Point-in-Time Recovery..."
    
    # Create WAL archive directory
    log_info "Creating WAL archive directory: $WAL_ARCHIVE_DIR"
    mkdir -p "$WAL_ARCHIVE_DIR"
    
    # Set permissions (if running as root)
    if [ "$(id -u)" -eq 0 ]; then
        chown postgres:postgres "$WAL_ARCHIVE_DIR"
        chmod 700 "$WAL_ARCHIVE_DIR"
    fi
    
    # Check if PITR config exists
    if [ ! -f "$PITR_CONFIG" ]; then
        log_error "PITR configuration file not found: $PITR_CONFIG"
        exit 1
    fi
    
    # Apply PostgreSQL settings
    log_info "Applying PostgreSQL PITR settings..."
    
    # Use psql to apply settings
    if command -v psql &> /dev/null; then
        PGPASSWORD="${PGPASSWORD:-}" psql -h "${PGHOST:-localhost}" -U "${PGUSER:-postgres}" -d "${PGDATABASE:-postgres}" << 'EOSQL'
-- Enable WAL archiving
ALTER SYSTEM SET wal_level = 'replica';
ALTER SYSTEM SET archive_mode = 'on';
ALTER SYSTEM SET archive_command = 'test ! -f /var/lib/postgresql/wal_archive/%f && cp %p /var/lib/postgresql/wal_archive/%f';
ALTER SYSTEM SET archive_timeout = 300;
ALTER SYSTEM SET max_wal_senders = 5;
ALTER SYSTEM SET max_replication_slots = 5;
ALTER SYSTEM SET wal_keep_size = '1GB';
ALTER SYSTEM SET log_checkpoints = 'on';

-- Reload configuration
SELECT pg_reload_conf();
EOSQL
        
        log_info "PostgreSQL settings applied. A restart may be required for some settings."
    else
        log_warn "psql not found. Please apply settings manually from $PITR_CONFIG"
    fi
    
    log_info "WAL archiving setup complete!"
    log_warn "Note: PostgreSQL restart required for wal_level and archive_mode changes"
}

# Check PITR status
check_status() {
    log_info "Checking PITR configuration status..."
    
    if command -v psql &> /dev/null; then
        echo -e "\n${BLUE}PostgreSQL WAL Settings:${NC}"
        PGPASSWORD="${PGPASSWORD:-}" psql -h "${PGHOST:-localhost}" -U "${PGUSER:-postgres}" -d "${PGDATABASE:-postgres}" << 'EOSQL'
SELECT name, setting, unit, context 
FROM pg_settings 
WHERE name IN (
    'wal_level', 
    'archive_mode', 
    'archive_command', 
    'archive_timeout',
    'max_wal_senders',
    'max_replication_slots',
    'wal_keep_size',
    'min_wal_size',
    'max_wal_size'
)
ORDER BY name;
EOSQL
        
        echo -e "\n${BLUE}WAL Archive Directory:${NC}"
        if [ -d "$WAL_ARCHIVE_DIR" ]; then
            local archive_count=$(find "$WAL_ARCHIVE_DIR" -name "*.backup" -o -name "0*" 2>/dev/null | wc -l)
            local archive_size=$(du -sh "$WAL_ARCHIVE_DIR" 2>/dev/null | cut -f1)
            echo "  Location: $WAL_ARCHIVE_DIR"
            echo "  Files: $archive_count"
            echo "  Size: $archive_size"
        else
            echo "  Directory not found: $WAL_ARCHIVE_DIR"
        fi
        
        echo -e "\n${BLUE}Replication Status:${NC}"
        PGPASSWORD="${PGPASSWORD:-}" psql -h "${PGHOST:-localhost}" -U "${PGUSER:-postgres}" -d "${PGDATABASE:-postgres}" << 'EOSQL'
SELECT 
    pg_is_in_recovery() as is_replica,
    pg_current_wal_lsn() as current_wal_lsn,
    pg_walfile_name(pg_current_wal_lsn()) as current_wal_file;
EOSQL
    else
        log_warn "psql not found. Cannot check status."
    fi
}

# Clean old WAL archives
cleanup_archives() {
    log_info "Cleaning WAL archives older than $RETENTION_DAYS days..."
    
    if [ ! -d "$WAL_ARCHIVE_DIR" ]; then
        log_warn "WAL archive directory not found: $WAL_ARCHIVE_DIR"
        return 0
    fi
    
    local before_count=$(find "$WAL_ARCHIVE_DIR" -type f 2>/dev/null | wc -l)
    local before_size=$(du -sh "$WAL_ARCHIVE_DIR" 2>/dev/null | cut -f1)
    
    # Delete old WAL files
    find "$WAL_ARCHIVE_DIR" -type f -mtime +$RETENTION_DAYS -delete 2>/dev/null || true
    
    local after_count=$(find "$WAL_ARCHIVE_DIR" -type f 2>/dev/null | wc -l)
    local after_size=$(du -sh "$WAL_ARCHIVE_DIR" 2>/dev/null | cut -f1)
    
    local deleted=$((before_count - after_count))
    
    log_info "Cleanup complete!"
    echo "  Files before: $before_count ($before_size)"
    echo "  Files after: $after_count ($after_size)"
    echo "  Files deleted: $deleted"
}

# List available archives
list_archives() {
    log_info "Listing WAL archives..."
    
    if [ ! -d "$WAL_ARCHIVE_DIR" ]; then
        log_warn "WAL archive directory not found: $WAL_ARCHIVE_DIR"
        return 0
    fi
    
    echo -e "\n${BLUE}Available WAL Archives:${NC}"
    ls -lh "$WAL_ARCHIVE_DIR" 2>/dev/null | head -50
    
    local total=$(find "$WAL_ARCHIVE_DIR" -type f 2>/dev/null | wc -l)
    if [ "$total" -gt 50 ]; then
        echo "... and $((total - 50)) more files"
    fi
    
    echo -e "\n${BLUE}Archive Statistics:${NC}"
    echo "  Total files: $total"
    echo "  Total size: $(du -sh "$WAL_ARCHIVE_DIR" 2>/dev/null | cut -f1)"
    
    # Show date range
    local oldest=$(find "$WAL_ARCHIVE_DIR" -type f -printf '%T+ %p\n' 2>/dev/null | sort | head -1 | cut -d' ' -f1)
    local newest=$(find "$WAL_ARCHIVE_DIR" -type f -printf '%T+ %p\n' 2>/dev/null | sort -r | head -1 | cut -d' ' -f1)
    
    if [ -n "$oldest" ] && [ -n "$newest" ]; then
        echo "  Oldest: $oldest"
        echo "  Newest: $newest"
    fi
}

# Start recovery to a specific point in time
start_recovery() {
    local target_time="$1"
    
    if [ -z "$target_time" ]; then
        log_error "Please specify a target time for recovery"
        echo "Usage: $(basename "$0") recover \"YYYY-MM-DD HH:MM:SS\""
        exit 1
    fi
    
    log_warn "═══════════════════════════════════════════════════════════"
    log_warn "  POINT-IN-TIME RECOVERY"
    log_warn "═══════════════════════════════════════════════════════════"
    log_warn "  Target time: $target_time"
    log_warn "  This will restore the database to the specified point in time."
    log_warn "  All changes after this time will be LOST!"
    log_warn "═══════════════════════════════════════════════════════════"
    
    read -p "Are you sure you want to proceed? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Recovery cancelled."
        exit 0
    fi
    
    log_info "Starting Point-in-Time Recovery..."
    
    # Create recovery configuration
    cat > "${PGDATA}/recovery.signal" << EOF
# Point-in-Time Recovery initiated at $(date)
# Target time: $target_time
EOF
    
    # Update postgresql.auto.conf with recovery settings
    cat >> "${PGDATA}/postgresql.auto.conf" << EOF

# PITR Recovery Settings (added by setup-pitr.sh)
restore_command = 'cp $WAL_ARCHIVE_DIR/%f %p'
recovery_target_time = '$target_time'
recovery_target_timeline = 'latest'
recovery_target_action = 'promote'
EOF
    
    log_info "Recovery configuration created."
    log_info "Please restart PostgreSQL to begin recovery:"
    log_info "  pg_ctl restart -D $PGDATA"
    log_info ""
    log_info "After recovery completes, remove the recovery settings from postgresql.auto.conf"
}

# ───────────────────────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────────────────────

main() {
    local command="${1:-help}"
    
    case $command in
        setup)
            setup_wal_archiving
            ;;
        status)
            check_status
            ;;
        cleanup)
            cleanup_archives
            ;;
        list-archives|list)
            list_archives
            ;;
        recover)
            start_recovery "${2:-}"
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            log_error "Unknown command: $command"
            usage
            ;;
    esac
}

main "$@"
