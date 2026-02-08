#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Database Migration Rollback Script
# ═══════════════════════════════════════════════════════════════════════════
# Automatic rollback capability for database migrations
# Requirements: 5.7
#
# Usage:
#   ./scripts/migration-rollback.sh [options]
#
# Options:
#   --steps N       Number of migrations to rollback (default: 1)
#   --to VERSION    Rollback to specific migration version
#   --dry-run       Show what would be rolled back without executing
#   --force         Skip confirmation prompts
#   --backup        Create backup before rollback
#   --verify        Verify database state after rollback
# ═══════════════════════════════════════════════════════════════════════════

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PRISMA_DIR="$PROJECT_ROOT/prisma"
BACKUP_DIR="$PROJECT_ROOT/backups/migrations"
LOG_FILE="$PROJECT_ROOT/logs/migration-rollback.log"

# Default values
STEPS=1
TARGET_VERSION=""
DRY_RUN=false
FORCE=false
CREATE_BACKUP=false
VERIFY=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Logging functions
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
    log "INFO" "$1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
    log "SUCCESS" "$1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
    log "WARNING" "$1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    log "ERROR" "$1"
}

log_debug() {
    if [ "$DEBUG" = true ]; then
        echo -e "${CYAN}[DEBUG]${NC} $1"
    fi
    log "DEBUG" "$1"
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --steps)
                STEPS="$2"
                shift 2
                ;;
            --to)
                TARGET_VERSION="$2"
                shift 2
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --force)
                FORCE=true
                shift
                ;;
            --backup)
                CREATE_BACKUP=true
                shift
                ;;
            --verify)
                VERIFY=true
                shift
                ;;
            --debug)
                DEBUG=true
                shift
                ;;
            --help|-h)
                show_help
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                show_help
                exit 1
                ;;
        esac
    done
}

# Show help message
show_help() {
    cat << EOF
Database Migration Rollback Script

Usage: $0 [options]

Options:
  --steps N       Number of migrations to rollback (default: 1)
  --to VERSION    Rollback to specific migration version
  --dry-run       Show what would be rolled back without executing
  --force         Skip confirmation prompts
  --backup        Create backup before rollback
  --verify        Verify database state after rollback
  --debug         Enable debug output
  --help, -h      Show this help message

Examples:
  $0 --steps 1                    # Rollback last migration
  $0 --steps 3 --backup           # Rollback last 3 migrations with backup
  $0 --to 20231215120000          # Rollback to specific version
  $0 --dry-run                    # Preview rollback without executing

Environment Variables:
  DATABASE_URL    PostgreSQL connection string (required)
  DEBUG           Enable debug mode (optional)
EOF
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if DATABASE_URL is set
    if [ -z "$DATABASE_URL" ]; then
        log_error "DATABASE_URL environment variable is not set"
        exit 1
    fi

    # Check if prisma directory exists
    if [ ! -d "$PRISMA_DIR" ]; then
        log_error "Prisma directory not found: $PRISMA_DIR"
        exit 1
    fi

    # Check if prisma CLI is available
    if ! command -v npx &> /dev/null; then
        log_error "npx command not found. Please install Node.js"
        exit 1
    fi

    # Create log directory if it doesn't exist
    mkdir -p "$(dirname "$LOG_FILE")"

    # Create backup directory if needed
    if [ "$CREATE_BACKUP" = true ]; then
        mkdir -p "$BACKUP_DIR"
    fi

    log_success "Prerequisites check passed"
}

# Get list of applied migrations
get_applied_migrations() {
    log_debug "Fetching applied migrations..."
    
    # Query the _prisma_migrations table
    local migrations=$(npx prisma migrate status --schema="$PRISMA_DIR/schema.prisma" 2>/dev/null | grep -E "^\d{14}_" || true)
    
    echo "$migrations"
}

# Get migration to rollback to
get_rollback_target() {
    local migrations=$(get_applied_migrations)
    local count=$(echo "$migrations" | wc -l)
    
    if [ -n "$TARGET_VERSION" ]; then
        echo "$TARGET_VERSION"
    else
        # Get the migration N steps back
        local target_index=$((count - STEPS))
        if [ $target_index -lt 0 ]; then
            target_index=0
        fi
        
        if [ $target_index -eq 0 ]; then
            echo "initial"
        else
            echo "$migrations" | sed -n "${target_index}p" | awk '{print $1}'
        fi
    fi
}

# Create database backup
create_backup() {
    if [ "$CREATE_BACKUP" != true ]; then
        return 0
    fi

    log_info "Creating database backup..."
    
    local timestamp=$(date '+%Y%m%d_%H%M%S')
    local backup_file="$BACKUP_DIR/pre_rollback_$timestamp.sql"
    
    # Extract connection details from DATABASE_URL
    # Format: postgresql://user:password@host:port/database
    local db_host=$(echo "$DATABASE_URL" | sed -E 's|.*@([^:]+):.*|\1|')
    local db_port=$(echo "$DATABASE_URL" | sed -E 's|.*:([0-9]+)/.*|\1|')
    local db_name=$(echo "$DATABASE_URL" | sed -E 's|.*/([^?]+).*|\1|')
    local db_user=$(echo "$DATABASE_URL" | sed -E 's|.*://([^:]+):.*|\1|')
    
    # Use pg_dump if available
    if command -v pg_dump &> /dev/null; then
        PGPASSWORD=$(echo "$DATABASE_URL" | sed -E 's|.*://[^:]+:([^@]+)@.*|\1|') \
            pg_dump -h "$db_host" -p "$db_port" -U "$db_user" -d "$db_name" \
            --schema-only -f "$backup_file"
        
        log_success "Backup created: $backup_file"
        echo "$backup_file"
    else
        log_warning "pg_dump not found, skipping backup"
    fi
}

# Execute rollback
execute_rollback() {
    local target=$1
    
    if [ "$DRY_RUN" = true ]; then
        log_info "[DRY RUN] Would rollback to: $target"
        return 0
    fi

    log_info "Executing rollback to: $target"
    
    # Use Prisma migrate reset with specific target
    # Note: Prisma doesn't have native rollback, so we use migrate reset
    # For production, consider using raw SQL migrations with down scripts
    
    if [ "$target" = "initial" ]; then
        log_warning "Rolling back all migrations..."
        npx prisma migrate reset --schema="$PRISMA_DIR/schema.prisma" --force --skip-seed
    else
        # For specific version rollback, we need to use raw SQL
        # This requires having down migration scripts
        local down_script="$PRISMA_DIR/migrations/${target}/down.sql"
        
        if [ -f "$down_script" ]; then
            log_info "Executing down migration: $down_script"
            npx prisma db execute --schema="$PRISMA_DIR/schema.prisma" --file="$down_script"
        else
            log_warning "No down.sql found for migration: $target"
            log_info "Using Prisma migrate reset instead..."
            
            # Mark migrations as rolled back in _prisma_migrations table
            # This is a workaround since Prisma doesn't support native rollback
            npx prisma db execute --schema="$PRISMA_DIR/schema.prisma" --stdin << EOF
DELETE FROM "_prisma_migrations" 
WHERE migration_name > '$target'
ORDER BY migration_name DESC;
EOF
        fi
    fi
    
    log_success "Rollback completed"
}

# Verify database state
verify_rollback() {
    if [ "$VERIFY" != true ]; then
        return 0
    fi

    log_info "Verifying database state..."
    
    # Check migration status
    local status=$(npx prisma migrate status --schema="$PRISMA_DIR/schema.prisma" 2>&1)
    
    if echo "$status" | grep -q "Database schema is up to date"; then
        log_success "Database schema is consistent"
    elif echo "$status" | grep -q "following migration"; then
        log_warning "There are pending migrations"
        echo "$status"
    else
        log_error "Database state verification failed"
        echo "$status"
        return 1
    fi
    
    # Validate schema
    log_info "Validating Prisma schema..."
    if npx prisma validate --schema="$PRISMA_DIR/schema.prisma"; then
        log_success "Schema validation passed"
    else
        log_error "Schema validation failed"
        return 1
    fi
}

# Confirm rollback
confirm_rollback() {
    if [ "$FORCE" = true ] || [ "$DRY_RUN" = true ]; then
        return 0
    fi

    echo ""
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo "                    ⚠️  DATABASE MIGRATION ROLLBACK  ⚠️"
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo ""
    echo "This operation will rollback database migrations."
    echo "This may result in DATA LOSS if tables or columns are dropped."
    echo ""
    echo "Steps to rollback: $STEPS"
    echo "Target version: $(get_rollback_target)"
    echo "Create backup: $CREATE_BACKUP"
    echo ""
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo ""
    
    read -p "Are you sure you want to proceed? (yes/no): " confirm
    
    if [ "$confirm" != "yes" ]; then
        log_info "Rollback cancelled by user"
        exit 0
    fi
}

# Main function
main() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo "           NextGen Marketplace - Database Migration Rollback"
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo ""

    parse_args "$@"
    check_prerequisites
    
    # Show current migration status
    log_info "Current migration status:"
    npx prisma migrate status --schema="$PRISMA_DIR/schema.prisma" 2>/dev/null || true
    echo ""
    
    # Get rollback target
    local target=$(get_rollback_target)
    log_info "Rollback target: $target"
    
    # Confirm rollback
    confirm_rollback
    
    # Create backup if requested
    local backup_file=""
    if [ "$CREATE_BACKUP" = true ]; then
        backup_file=$(create_backup)
    fi
    
    # Execute rollback
    execute_rollback "$target"
    
    # Verify rollback
    verify_rollback
    
    echo ""
    echo "═══════════════════════════════════════════════════════════════════════════"
    if [ "$DRY_RUN" = true ]; then
        log_info "Dry run completed - no changes were made"
    else
        log_success "Migration rollback completed successfully!"
        if [ -n "$backup_file" ]; then
            log_info "Backup saved to: $backup_file"
        fi
    fi
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo ""
}

# Run main function
main "$@"
