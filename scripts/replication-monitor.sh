#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - PostgreSQL Replication Monitor
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Monitor PostgreSQL streaming replication status and lag
# Requirements: 9.5 - Failover to replica within 30 seconds
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ───────────────────────────────────────────────────────────────────────────
# Configuration
# ───────────────────────────────────────────────────────────────────────────
PRIMARY_HOST="${PGHOST:-postgres-primary}"
PRIMARY_PORT="${PGPORT:-5432}"
REPLICA_HOST="${REPLICA_HOST:-postgres-replica}"
REPLICA_PORT="${REPLICA_PORT:-5432}"
PGUSER="${PGUSER:-nextgen}"
PGPASSWORD="${PGPASSWORD:-nextgen_secret}"
PGDATABASE="${PGDATABASE:-nextgen_db}"

CHECK_INTERVAL="${CHECK_INTERVAL:-30}"
LAG_THRESHOLD_BYTES="${LAG_THRESHOLD_BYTES:-16777216}"  # 16MB
LAG_THRESHOLD_SECONDS="${LAG_THRESHOLD_SECONDS:-30}"

# Notification settings
SLACK_WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
ALERT_EMAIL="${ALERT_EMAIL:-}"

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
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') $1"
}

send_alert() {
    local severity="$1"
    local message="$2"
    
    # Slack notification
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        local color="good"
        [ "$severity" = "warning" ] && color="warning"
        [ "$severity" = "critical" ] && color="danger"
        
        curl -s -X POST "$SLACK_WEBHOOK_URL" \
            -H 'Content-Type: application/json' \
            -d "{
                \"attachments\": [{
                    \"color\": \"${color}\",
                    \"title\": \"PostgreSQL Replication Alert\",
                    \"text\": \"${message}\",
                    \"footer\": \"NextGen Replication Monitor\",
                    \"ts\": $(date +%s)
                }]
            }" > /dev/null 2>&1 || true
    fi
}

check_primary_status() {
    log_info "Checking primary database status..."
    
    local result=$(PGPASSWORD="$PGPASSWORD" psql -h "$PRIMARY_HOST" -p "$PRIMARY_PORT" \
        -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT 1" 2>/dev/null)
    
    if [ "$result" = " 1" ]; then
        echo -e "  Primary: ${GREEN}ONLINE${NC}"
        return 0
    else
        echo -e "  Primary: ${RED}OFFLINE${NC}"
        send_alert "critical" "Primary database is OFFLINE!"
        return 1
    fi
}

check_replica_status() {
    log_info "Checking replica database status..."
    
    local result=$(PGPASSWORD="$PGPASSWORD" psql -h "$REPLICA_HOST" -p "$REPLICA_PORT" \
        -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT 1" 2>/dev/null)
    
    if [ "$result" = " 1" ]; then
        echo -e "  Replica: ${GREEN}ONLINE${NC}"
        
        # Check if in recovery mode
        local is_replica=$(PGPASSWORD="$PGPASSWORD" psql -h "$REPLICA_HOST" -p "$REPLICA_PORT" \
            -U "$PGUSER" -d "$PGDATABASE" -t -c "SELECT pg_is_in_recovery()" 2>/dev/null)
        
        if [ "$is_replica" = " t" ]; then
            echo -e "  Mode: ${GREEN}STANDBY${NC}"
        else
            echo -e "  Mode: ${YELLOW}PRIMARY (unexpected)${NC}"
        fi
        return 0
    else
        echo -e "  Replica: ${RED}OFFLINE${NC}"
        send_alert "critical" "Replica database is OFFLINE!"
        return 1
    fi
}

check_replication_status() {
    log_info "Checking replication status..."
    
    local replication_info=$(PGPASSWORD="$PGPASSWORD" psql -h "$PRIMARY_HOST" -p "$PRIMARY_PORT" \
        -U "$PGUSER" -d "$PGDATABASE" -t -A -F'|' -c "
        SELECT 
            client_addr,
            state,
            sync_state,
            pg_wal_lsn_diff(sent_lsn, replay_lsn) as lag_bytes,
            EXTRACT(EPOCH FROM (now() - reply_time))::int as lag_seconds
        FROM pg_stat_replication
        WHERE application_name = 'replica1'
        LIMIT 1
    " 2>/dev/null)
    
    if [ -z "$replication_info" ]; then
        echo -e "  Replication: ${RED}NOT CONNECTED${NC}"
        send_alert "critical" "Replica is not connected to primary!"
        return 1
    fi
    
    IFS='|' read -r client_addr state sync_state lag_bytes lag_seconds <<< "$replication_info"
    
    echo "  Client: $client_addr"
    echo "  State: $state"
    echo "  Sync: $sync_state"
    echo "  Lag (bytes): $lag_bytes"
    echo "  Lag (seconds): $lag_seconds"
    
    # Check lag thresholds
    if [ "${lag_bytes:-0}" -gt "$LAG_THRESHOLD_BYTES" ]; then
        echo -e "  ${YELLOW}WARNING: Replication lag exceeds threshold!${NC}"
        send_alert "warning" "Replication lag is ${lag_bytes} bytes (threshold: ${LAG_THRESHOLD_BYTES})"
    fi
    
    if [ "${lag_seconds:-0}" -gt "$LAG_THRESHOLD_SECONDS" ]; then
        echo -e "  ${RED}CRITICAL: Replication time lag exceeds threshold!${NC}"
        send_alert "critical" "Replication time lag is ${lag_seconds} seconds (threshold: ${LAG_THRESHOLD_SECONDS})"
        return 1
    fi
    
    return 0
}

check_replication_slots() {
    log_info "Checking replication slots..."
    
    PGPASSWORD="$PGPASSWORD" psql -h "$PRIMARY_HOST" -p "$PRIMARY_PORT" \
        -U "$PGUSER" -d "$PGDATABASE" -c "
        SELECT 
            slot_name,
            slot_type,
            active,
            restart_lsn,
            pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) as retained_bytes
        FROM pg_replication_slots
    " 2>/dev/null || echo "  Failed to check replication slots"
}

check_wal_status() {
    log_info "Checking WAL status..."
    
    PGPASSWORD="$PGPASSWORD" psql -h "$PRIMARY_HOST" -p "$PRIMARY_PORT" \
        -U "$PGUSER" -d "$PGDATABASE" -c "
        SELECT 
            pg_current_wal_lsn() as current_lsn,
            pg_walfile_name(pg_current_wal_lsn()) as current_wal_file,
            pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0')) as total_wal_generated
    " 2>/dev/null || echo "  Failed to check WAL status"
}

run_health_check() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  PostgreSQL Replication Health Check${NC}"
    echo -e "${BLUE}  $(date)${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
    
    local status=0
    
    check_primary_status || status=1
    echo ""
    check_replica_status || status=1
    echo ""
    check_replication_status || status=1
    echo ""
    check_replication_slots
    echo ""
    check_wal_status
    
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    
    if [ $status -eq 0 ]; then
        echo -e "${GREEN}Overall Status: HEALTHY${NC}"
    else
        echo -e "${RED}Overall Status: UNHEALTHY${NC}"
    fi
    
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
    
    return $status
}

# ───────────────────────────────────────────────────────────────────────────
# Main
# ───────────────────────────────────────────────────────────────────────────

main() {
    local mode="${1:-continuous}"
    
    case $mode in
        once|check)
            run_health_check
            ;;
        continuous|monitor)
            log_info "Starting continuous replication monitoring (interval: ${CHECK_INTERVAL}s)"
            while true; do
                run_health_check || true
                sleep "$CHECK_INTERVAL"
            done
            ;;
        *)
            echo "Usage: $(basename "$0") [once|continuous]"
            exit 1
            ;;
    esac
}

main "$@"
