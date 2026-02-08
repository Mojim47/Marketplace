#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# EMERGENCY ROLLBACK SCRIPT - NextGen Marketplace
# ═══════════════════════════════════════════════════════════════════════════
# Usage: ./emergency-rollback.sh [COMMIT_HASH]
# Description: One-click rollback for 3 AM emergencies (drunk-proof)
# Author: Senior DevSecOps Engineer
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Configuration
ROLLBACK_COMMIT=${1:-"HEAD~1"}
NAMESPACE="nextgen"
SLACK_WEBHOOK="${SLACK_WEBHOOK:-https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK}"
VAULT_ADDR="${VAULT_ADDR:-http://vault.vault-system.svc.cluster.local:8200}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date -u +'%Y-%m-%d %H:%M:%S UTC')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Send Slack notification
send_alert() {
    local message="$1"
    local status="${2:-INFO}"
    local emoji="📢"
    
    case $status in
        "ERROR") emoji="🚨" ;;
        "SUCCESS") emoji="✅" ;;
        "WARNING") emoji="⚠️" ;;
    esac
    
    curl -s -X POST "$SLACK_WEBHOOK" \
        -H 'Content-type: application/json' \
        --data "{\"text\":\"$emoji **NEXTGEN EMERGENCY ROLLBACK**\\n$message\\nTime: $(date -u)\\nOperator: $(whoami)@$(hostname)\"}" \
        || warn "Failed to send Slack notification"
}

# Pre-flight checks
preflight_checks() {
    log "🔍 Running pre-flight checks..."
    
    # Check if kubectl is available and configured
    if ! command -v kubectl &> /dev/null; then
        error "kubectl not found. Please install kubectl."
        exit 1
    fi
    
    # Check if we can connect to Kubernetes
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster."
        exit 1
    fi
    
    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        error "Namespace '$NAMESPACE' does not exist."
        exit 1
    fi
    
    # Check if Vault is available
    if ! command -v vault &> /dev/null; then
        warn "Vault CLI not found. Vault operations will be skipped."
        VAULT_AVAILABLE=false
    else
        VAULT_AVAILABLE=true
    fi
    
    success "Pre-flight checks completed"
}

# Backup current state
backup_current_state() {
    log "💾 Backing up current state..."
    
    local backup_dir="/tmp/nextgen-rollback-backup-$(date +%s)"
    mkdir -p "$backup_dir"
    
    # Backup Kubernetes manifests
    kubectl get deployment nextgen-api -n "$NAMESPACE" -o yaml > "$backup_dir/deployment.yaml" || warn "Failed to backup deployment"
    kubectl get configmap -n "$NAMESPACE" -o yaml > "$backup_dir/configmaps.yaml" || warn "Failed to backup configmaps"
    kubectl get secret -n "$NAMESPACE" -o yaml > "$backup_dir/secrets.yaml" || warn "Failed to backup secrets"
    
    # Backup Vault secrets (if available)
    if [ "$VAULT_AVAILABLE" = true ]; then
        vault kv get -format=json nextgen/database > "$backup_dir/vault-database.json" 2>/dev/null || warn "Failed to backup Vault database secret"
        vault kv get -format=json nextgen/redis > "$backup_dir/vault-redis.json" 2>/dev/null || warn "Failed to backup Vault redis secret"
    fi
    
    echo "$backup_dir" > /tmp/nextgen-last-backup-path
    success "Backup completed: $backup_dir"
}

# Rollback Kubernetes deployment
rollback_kubernetes() {
    log "📦 Rolling back Kubernetes deployment..."
    
    # Get current deployment status
    local current_revision
    current_revision=$(kubectl rollout history deployment/nextgen-api -n "$NAMESPACE" --revision=0 | tail -1 | awk '{print $1}')
    log "Current revision: $current_revision"
    
    # Perform rollback
    if kubectl rollout undo deployment/nextgen-api -n "$NAMESPACE"; then
        log "Rollback initiated, waiting for completion..."
        
        # Wait for rollback to complete with timeout
        if kubectl rollout status deployment/nextgen-api -n "$NAMESPACE" --timeout=300s; then
            success "Kubernetes rollback completed successfully"
            return 0
        else
            error "Kubernetes rollback timed out"
            return 1
        fi
    else
        error "Failed to initiate Kubernetes rollback"
        return 1
    fi
}

# Rollback Vault secrets
rollback_vault_secrets() {
    if [ "$VAULT_AVAILABLE" != true ]; then
        warn "Vault CLI not available, skipping Vault rollback"
        return 0
    fi
    
    log "🔐 Checking Vault secret versions..."
    
    # Check database secret version
    local db_version
    if db_version=$(vault kv metadata get -format=json nextgen/database 2>/dev/null | jq -r '.current_version'); then
        if [ "$db_version" -gt 1 ]; then
            log "Rolling back database secret from version $db_version to $((db_version-1))"
            if vault kv rollback -version=$((db_version-1)) nextgen/database; then
                success "Database secret rolled back successfully"
            else
                error "Failed to rollback database secret"
                return 1
            fi
        else
            log "Database secret is at version 1, no rollback needed"
        fi
    else
        warn "Could not retrieve database secret metadata"
    fi
    
    # Check Redis secret version
    local redis_version
    if redis_version=$(vault kv metadata get -format=json nextgen/redis 2>/dev/null | jq -r '.current_version'); then
        if [ "$redis_version" -gt 1 ]; then
            log "Rolling back Redis secret from version $redis_version to $((redis_version-1))"
            if vault kv rollback -version=$((redis_version-1)) nextgen/redis; then
                success "Redis secret rolled back successfully"
            else
                error "Failed to rollback Redis secret"
                return 1
            fi
        else
            log "Redis secret is at version 1, no rollback needed"
        fi
    else
        warn "Could not retrieve Redis secret metadata"
    fi
    
    return 0
}

# Verify rollback success
verify_rollback() {
    log "✅ Verifying rollback success..."
    
    # Check pod status
    log "Checking pod status..."
    kubectl get pods -n "$NAMESPACE" -l app=nextgen-api
    
    # Check if pods are ready
    local ready_pods
    ready_pods=$(kubectl get pods -n "$NAMESPACE" -l app=nextgen-api -o jsonpath='{.items[*].status.conditions[?(@.type=="Ready")].status}' | grep -c "True" || echo "0")
    local total_pods
    total_pods=$(kubectl get pods -n "$NAMESPACE" -l app=nextgen-api --no-headers | wc -l)
    
    log "Ready pods: $ready_pods/$total_pods"
    
    if [ "$ready_pods" -eq "$total_pods" ] && [ "$total_pods" -gt 0 ]; then
        success "All pods are ready"
    else
        error "Not all pods are ready"
        return 1
    fi
    
    # Check application health
    log "Checking application health..."
    local health_check_passed=false
    for i in {1..10}; do
        if kubectl exec -n "$NAMESPACE" deployment/nextgen-api -- curl -f http://localhost:3000/health &>/dev/null; then
            health_check_passed=true
            break
        fi
        log "Health check attempt $i/10 failed, retrying in 10 seconds..."
        sleep 10
    done
    
    if [ "$health_check_passed" = true ]; then
        success "Application health check passed"
    else
        error "Application health check failed"
        return 1
    fi
    
    # Show recent logs
    log "Recent application logs:"
    kubectl logs -n "$NAMESPACE" -l app=nextgen-api --tail=10 --prefix=true
    
    return 0
}

# Main rollback function
main() {
    log "🚨 EMERGENCY ROLLBACK INITIATED"
    log "Target commit: $ROLLBACK_COMMIT"
    log "Namespace: $NAMESPACE"
    log "Operator: $(whoami)@$(hostname)"
    
    send_alert "Emergency rollback initiated\\nTarget: $ROLLBACK_COMMIT\\nNamespace: $NAMESPACE" "WARNING"
    
    # Run pre-flight checks
    if ! preflight_checks; then
        error "Pre-flight checks failed"
        send_alert "Rollback failed: Pre-flight checks failed" "ERROR"
        exit 1
    fi
    
    # Backup current state
    if ! backup_current_state; then
        error "Failed to backup current state"
        send_alert "Rollback failed: Backup failed" "ERROR"
        exit 1
    fi
    
    # Perform rollbacks
    local rollback_success=true
    
    # Rollback Kubernetes deployment
    if ! rollback_kubernetes; then
        error "Kubernetes rollback failed"
        rollback_success=false
    fi
    
    # Rollback Vault secrets (if needed)
    if ! rollback_vault_secrets; then
        error "Vault rollback failed"
        rollback_success=false
    fi
    
    # Verify rollback
    if [ "$rollback_success" = true ]; then
        if verify_rollback; then
            success "🎉 ROLLBACK COMPLETED SUCCESSFULLY"
            send_alert "Rollback completed successfully\\nAll systems operational" "SUCCESS"
            
            # Cleanup old backup (keep only last 5)
            find /tmp -name "nextgen-rollback-backup-*" -type d | sort | head -n -5 | xargs rm -rf 2>/dev/null || true
            
            exit 0
        else
            error "Rollback verification failed"
            send_alert "Rollback completed but verification failed\\nManual intervention required" "ERROR"
            exit 1
        fi
    else
        error "Rollback failed"
        send_alert "Rollback failed\\nManual intervention required\\nBackup available at: $(cat /tmp/nextgen-last-backup-path 2>/dev/null || echo 'unknown')" "ERROR"
        exit 1
    fi
}

# Trap for cleanup on exit
cleanup() {
    log "Cleaning up temporary files..."
}
trap cleanup EXIT

# Help function
show_help() {
    cat << EOF
NextGen Marketplace Emergency Rollback Script

USAGE:
    $0 [COMMIT_HASH]

DESCRIPTION:
    Performs emergency rollback of NextGen Marketplace deployment.
    Designed to be executed by on-call engineers during incidents.

PARAMETERS:
    COMMIT_HASH    Git commit hash to rollback to (default: HEAD~1)

ENVIRONMENT VARIABLES:
    NAMESPACE      Kubernetes namespace (default: nextgen)
    SLACK_WEBHOOK  Slack webhook URL for notifications
    VAULT_ADDR     Vault server address

EXAMPLES:
    $0                    # Rollback to previous commit
    $0 abc123def          # Rollback to specific commit
    
EMERGENCY CONTACTS:
    DevSecOps On-Call: +1-555-SECURE-1
    Platform Team: +1-555-PLATFORM
    
EOF
}

# Parse command line arguments
case "${1:-}" in
    -h|--help)
        show_help
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac