#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Backup Verification Script
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Verify backup integrity using SHA-256 checksums and test decryption
# Requirements: 9.3 - Verify backup integrity using checksums
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ───────────────────────────────────────────────────────────────────────────
# Configuration
# ───────────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_BASE_DIR="${BACKUP_BASE_DIR:-/var/backups/nextgen}"
BACKUP_DAILY_DIR="${BACKUP_BASE_DIR}/daily"
BACKUP_WEEKLY_DIR="${BACKUP_BASE_DIR}/weekly"
BACKUP_MONTHLY_DIR="${BACKUP_BASE_DIR}/monthly"
LOG_DIR="${BACKUP_BASE_DIR}/logs"
ENCRYPTION_KEY_FILE="${ENCRYPTION_KEY_FILE:-/etc/nextgen/backup.key}"
ENCRYPTION_ALGORITHM="aes-256-cbc"
PBKDF2_ITERATIONS=100000

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Counters
TOTAL_CHECKED=0
PASSED=0
FAILED=0
SKIPPED=0

# ───────────────────────────────────────────────────────────────────────────
# Logging Functions
# ───────────────────────────────────────────────────────────────────────────
LOG_FILE="${LOG_DIR}/verify_$(date +%Y%m%d).log"

log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date +"%Y-%m-%d %H:%M:%S")
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE" 2>/dev/null || echo -e "${timestamp} [${level}] ${message}"
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

log_success() {
    echo -e "${GREEN}[PASS]${NC} $1"
    log "PASS" "$1"
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    log "FAIL" "$1"
}

# ───────────────────────────────────────────────────────────────────────────
# Usage
# ───────────────────────────────────────────────────────────────────────────
usage() {
    cat << EOF
Usage: $(basename "$0") [OPTIONS]

Verify backup integrity using SHA-256 checksums.

Options:
    --latest        Verify only the latest backup
    --all           Verify all backups in all directories
    --daily         Verify all daily backups
    --weekly        Verify all weekly backups
    --monthly       Verify all monthly backups
    --file FILE     Verify a specific backup file
    --decrypt       Also test decryption (requires encryption key)
    --verbose       Show detailed output
    --help          Show this help message

Examples:
    $(basename "$0") --latest
    $(basename "$0") --all
    $(basename "$0") --file /var/backups/nextgen/daily/backup_20240101.sql.gz.enc
    $(basename "$0") --latest --decrypt

EOF
    exit 0
}

# ───────────────────────────────────────────────────────────────────────────
# Checksum Verification Functions
# ───────────────────────────────────────────────────────────────────────────

# Generate SHA-256 checksum of a file
generate_checksum() {
    local file="$1"
    sha256sum "$file" | awk '{print $1}'
}

# Verify checksum of a backup file
verify_checksum() {
    local backup_file="$1"
    local checksum_file="${backup_file}.sha256"
    
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi
    
    if [ ! -f "$checksum_file" ]; then
        log_warn "Checksum file not found: $checksum_file"
        return 2
    fi
    
    local stored_checksum=$(cat "$checksum_file" | tr -d '[:space:]')
    local computed_checksum=$(generate_checksum "$backup_file")
    
    if [ "$stored_checksum" = "$computed_checksum" ]; then
        return 0
    else
        log_error "Checksum mismatch!"
        log_error "  Expected: $stored_checksum"
        log_error "  Got:      $computed_checksum"
        return 1
    fi
}

# Test decryption of a backup file
test_decryption() {
    local backup_file="$1"
    local temp_file=$(mktemp)
    
    if [ ! -f "$ENCRYPTION_KEY_FILE" ]; then
        log_warn "Encryption key not found: $ENCRYPTION_KEY_FILE"
        rm -f "$temp_file"
        return 2
    fi
    
    # Attempt to decrypt the first 1MB to verify encryption is valid
    openssl enc -${ENCRYPTION_ALGORITHM} \
        -d \
        -salt \
        -pbkdf2 \
        -iter ${PBKDF2_ITERATIONS} \
        -in "$backup_file" \
        -out "$temp_file" \
        -pass file:"$ENCRYPTION_KEY_FILE" 2>/dev/null
    
    local result=$?
    
    # Clean up
    rm -f "$temp_file"
    
    return $result
}

# Verify a single backup file
verify_backup() {
    local backup_file="$1"
    local test_decrypt="${2:-false}"
    local filename=$(basename "$backup_file")
    
    ((TOTAL_CHECKED++))
    
    echo -e "\n${BLUE}Verifying:${NC} $filename"
    
    # Step 1: Check file exists
    if [ ! -f "$backup_file" ]; then
        log_fail "File not found"
        ((FAILED++))
        return 1
    fi
    
    # Step 2: Check file size
    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null)
    if [ "$file_size" -eq 0 ]; then
        log_fail "File is empty"
        ((FAILED++))
        return 1
    fi
    log_info "  File size: $(numfmt --to=iec-i --suffix=B $file_size 2>/dev/null || echo "${file_size} bytes")"
    
    # Step 3: Verify checksum
    local checksum_file="${backup_file}.sha256"
    if [ -f "$checksum_file" ]; then
        if verify_checksum "$backup_file"; then
            log_success "  Checksum: VALID"
        else
            log_fail "  Checksum: INVALID"
            ((FAILED++))
            return 1
        fi
    else
        log_warn "  Checksum: SKIPPED (no checksum file)"
        ((SKIPPED++))
    fi
    
    # Step 4: Verify encryption header (OpenSSL "Salted__" header)
    local header=$(head -c 8 "$backup_file" 2>/dev/null | cat -v)
    if [[ "$header" == "Salted__" ]]; then
        log_success "  Encryption header: VALID"
    else
        log_warn "  Encryption header: NOT FOUND (may be unencrypted)"
    fi
    
    # Step 5: Test decryption (optional)
    if [ "$test_decrypt" = "true" ]; then
        if test_decryption "$backup_file"; then
            log_success "  Decryption test: PASSED"
        else
            log_fail "  Decryption test: FAILED"
            ((FAILED++))
            return 1
        fi
    fi
    
    ((PASSED++))
    return 0
}

# Find and verify backups in a directory
verify_directory() {
    local dir="$1"
    local test_decrypt="${2:-false}"
    
    if [ ! -d "$dir" ]; then
        log_warn "Directory not found: $dir"
        return 0
    fi
    
    log_info "Scanning directory: $dir"
    
    local count=0
    while IFS= read -r -d '' backup_file; do
        verify_backup "$backup_file" "$test_decrypt"
        ((count++))
    done < <(find "$dir" -name "*.enc" -type f -print0 2>/dev/null | sort -z)
    
    if [ $count -eq 0 ]; then
        log_warn "No backup files found in $dir"
    fi
}

# Find the latest backup
find_latest_backup() {
    local latest=""
    local latest_time=0
    
    for dir in "$BACKUP_DAILY_DIR" "$BACKUP_WEEKLY_DIR" "$BACKUP_MONTHLY_DIR"; do
        if [ -d "$dir" ]; then
            while IFS= read -r -d '' file; do
                local file_time=$(stat -f%m "$file" 2>/dev/null || stat -c%Y "$file" 2>/dev/null)
                if [ "$file_time" -gt "$latest_time" ]; then
                    latest_time=$file_time
                    latest=$file
                fi
            done < <(find "$dir" -name "*.enc" -type f -print0 2>/dev/null)
        fi
    done
    
    echo "$latest"
}

# ───────────────────────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────────────────────
main() {
    local mode=""
    local specific_file=""
    local test_decrypt="false"
    local verbose="false"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --latest)
                mode="latest"
                shift
                ;;
            --all)
                mode="all"
                shift
                ;;
            --daily)
                mode="daily"
                shift
                ;;
            --weekly)
                mode="weekly"
                shift
                ;;
            --monthly)
                mode="monthly"
                shift
                ;;
            --file)
                mode="file"
                specific_file="$2"
                shift 2
                ;;
            --decrypt)
                test_decrypt="true"
                shift
                ;;
            --verbose)
                verbose="true"
                shift
                ;;
            --help|-h)
                usage
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                ;;
        esac
    done
    
    # Default to latest if no mode specified
    if [ -z "$mode" ]; then
        mode="latest"
    fi
    
    # Create log directory if needed
    mkdir -p "$LOG_DIR" 2>/dev/null || true
    
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  NextGen Marketplace - Backup Verification${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "  Mode: $mode"
    echo -e "  Decrypt test: $test_decrypt"
    echo -e "  Timestamp: $(date)"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    
    case $mode in
        latest)
            local latest=$(find_latest_backup)
            if [ -n "$latest" ]; then
                verify_backup "$latest" "$test_decrypt"
            else
                log_error "No backup files found"
                exit 1
            fi
            ;;
        all)
            verify_directory "$BACKUP_DAILY_DIR" "$test_decrypt"
            verify_directory "$BACKUP_WEEKLY_DIR" "$test_decrypt"
            verify_directory "$BACKUP_MONTHLY_DIR" "$test_decrypt"
            ;;
        daily)
            verify_directory "$BACKUP_DAILY_DIR" "$test_decrypt"
            ;;
        weekly)
            verify_directory "$BACKUP_WEEKLY_DIR" "$test_decrypt"
            ;;
        monthly)
            verify_directory "$BACKUP_MONTHLY_DIR" "$test_decrypt"
            ;;
        file)
            if [ -z "$specific_file" ]; then
                log_error "No file specified"
                exit 1
            fi
            verify_backup "$specific_file" "$test_decrypt"
            ;;
    esac
    
    # Summary
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Verification Summary${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "  Total checked: $TOTAL_CHECKED"
    echo -e "  ${GREEN}Passed:${NC} $PASSED"
    echo -e "  ${RED}Failed:${NC} $FAILED"
    echo -e "  ${YELLOW}Skipped:${NC} $SKIPPED"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    
    if [ $FAILED -gt 0 ]; then
        log_error "Verification completed with failures!"
        exit 1
    elif [ $TOTAL_CHECKED -eq 0 ]; then
        log_warn "No backups were verified"
        exit 0
    else
        log_success "All verifications passed!"
        exit 0
    fi
}

main "$@"
