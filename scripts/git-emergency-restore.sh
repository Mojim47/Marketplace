#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# GIT EMERGENCY RESTORE SCRIPT - NextGen Marketplace
# ═══════════════════════════════════════════════════════════════════════════
# Usage: ./git-emergency-restore.sh
# Description: Restores Git history from backup if BFG cleaning caused issues
# Author: Senior DevSecOps Engineer
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Configuration
BACKUP_REPO_PATH="${BACKUP_REPO_PATH:-/backup/nextgen-market-original.git}"
REMOTE_NAME="emergency-backup"
BRANCH_NAME="${BRANCH_NAME:-main}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

# Confirmation prompt
confirm_restore() {
    echo -e "${RED}⚠️  DANGER: GIT HISTORY RESTORE${NC}"
    echo "This will:"
    echo "  1. Restore the original Git history (including secrets)"
    echo "  2. Overwrite the current cleaned history"
    echo "  3. Require force-push to remote repository"
    echo ""
    echo "This should ONLY be used if:"
    echo "  - BFG cleaning caused critical issues"
    echo "  - You have a plan to re-clean secrets immediately"
    echo "  - You have admin approval for force-push"
    echo ""
    read -p "Are you absolutely sure you want to proceed? (type 'YES' to continue): " confirmation
    
    if [ "$confirmation" != "YES" ]; then
        log "Operation cancelled by user"
        exit 0
    fi
}

# Check prerequisites
check_prerequisites() {
    log "🔍 Checking prerequisites..."
    
    # Check if we're in a Git repository
    if ! git rev-parse --git-dir &>/dev/null; then
        error "Not in a Git repository"
        exit 1
    fi
    
    # Check if backup exists
    if [ ! -d "$BACKUP_REPO_PATH" ]; then
        error "Backup repository not found at: $BACKUP_REPO_PATH"
        exit 1
    fi
    
    # Check if backup is a valid Git repository
    if ! git -C "$BACKUP_REPO_PATH" rev-parse --git-dir &>/dev/null; then
        error "Backup path is not a valid Git repository: $BACKUP_REPO_PATH"
        exit 1
    fi
    
    # Check if we have write permissions
    if [ ! -w "." ]; then
        error "No write permissions in current directory"
        exit 1
    fi
    
    success "Prerequisites check passed"
}

# Backup current state
backup_current_state() {
    log "💾 Backing up current state..."
    
    local backup_branch="emergency-backup-$(date +%s)"
    
    # Create backup branch
    if git checkout -b "$backup_branch"; then
        success "Created backup branch: $backup_branch"
        
        # Return to original branch
        git checkout "$BRANCH_NAME"
        
        log "Current state backed up to branch: $backup_branch"
    else
        error "Failed to create backup branch"
        exit 1
    fi
}

# Restore from backup
restore_from_backup() {
    log "🔄 Restoring Git history from backup..."
    
    # Add backup remote if it doesn't exist
    if git remote get-url "$REMOTE_NAME" &>/dev/null; then
        log "Remote '$REMOTE_NAME' already exists, updating URL..."
        git remote set-url "$REMOTE_NAME" "$BACKUP_REPO_PATH"
    else
        log "Adding backup remote..."
        git remote add "$REMOTE_NAME" "$BACKUP_REPO_PATH"
    fi
    
    # Fetch from backup
    log "Fetching from backup repository..."
    if git fetch "$REMOTE_NAME"; then
        success "Successfully fetched from backup"
    else
        error "Failed to fetch from backup repository"
        exit 1
    fi
    
    # Get the latest commit from backup
    local backup_commit
    backup_commit=$(git rev-parse "$REMOTE_NAME/$BRANCH_NAME")
    log "Backup HEAD commit: $backup_commit"
    
    # Reset to backup state
    log "Resetting to backup state..."
    if git reset --hard "$REMOTE_NAME/$BRANCH_NAME"; then
        success "Successfully reset to backup state"
    else
        error "Failed to reset to backup state"
        exit 1
    fi
    
    # Clean up backup remote
    git remote remove "$REMOTE_NAME"
    
    success "Git history restored from backup"
}

# Verify restoration
verify_restoration() {
    log "✅ Verifying restoration..."
    
    # Check if .env file exists (it should after restoration)
    if [ -f ".env" ]; then
        warn "⚠️  .env file is present - contains secrets that need to be cleaned!"
    fi
    
    # Show recent commits
    log "Recent commits after restoration:"
    git log --oneline -10
    
    # Show repository status
    log "Repository status:"
    git status --porcelain
    
    success "Restoration verification completed"
}

# Force push warning and execution
force_push_to_remote() {
    echo ""
    echo -e "${RED}🚨 CRITICAL: FORCE PUSH REQUIRED${NC}"
    echo "The restored history needs to be pushed to the remote repository."
    echo "This will overwrite the remote history and affect all team members."
    echo ""
    echo "Before proceeding:"
    echo "  1. Notify all team members"
    echo "  2. Ensure you have admin approval"
    echo "  3. Have a plan to immediately re-clean secrets"
    echo ""
    read -p "Do you want to force push now? (type 'FORCE-PUSH' to continue): " push_confirmation
    
    if [ "$push_confirmation" = "FORCE-PUSH" ]; then
        log "🚀 Force pushing to remote..."
        
        if git push --force-with-lease origin "$BRANCH_NAME"; then
            success "✅ Force push completed successfully"
            
            echo ""
            echo -e "${YELLOW}⚠️  IMMEDIATE ACTION REQUIRED:${NC}"
            echo "1. Run secret cleaning process immediately"
            echo "2. Rotate all exposed credentials"
            echo "3. Notify security team"
            echo "4. Update incident documentation"
            
        else
            error "❌ Force push failed"
            echo "Possible reasons:"
            echo "  - No push permissions"
            echo "  - Branch protection rules"
            echo "  - Network issues"
            exit 1
        fi
    else
        warn "Force push cancelled. Repository is in restored state locally only."
        echo "To push later, run: git push --force-with-lease origin $BRANCH_NAME"
    fi
}

# Main function
main() {
    log "🚨 GIT EMERGENCY RESTORE INITIATED"
    log "Backup path: $BACKUP_REPO_PATH"
    log "Target branch: $BRANCH_NAME"
    log "Operator: $(whoami)@$(hostname)"
    
    # Confirmation
    confirm_restore
    
    # Check prerequisites
    check_prerequisites
    
    # Backup current state
    backup_current_state
    
    # Restore from backup
    restore_from_backup
    
    # Verify restoration
    verify_restoration
    
    # Force push (optional)
    force_push_to_remote
    
    success "🎉 GIT EMERGENCY RESTORE COMPLETED"
    
    echo ""
    echo -e "${BLUE}📋 NEXT STEPS:${NC}"
    echo "1. Immediately run secret cleaning: ./scripts/clean-secrets.sh"
    echo "2. Rotate all credentials in Vault"
    echo "3. Update security incident log"
    echo "4. Notify team of repository state change"
    echo ""
    echo -e "${RED}⚠️  REMEMBER: Secrets are now exposed in Git history!${NC}"
}

# Help function
show_help() {
    cat << EOF
NextGen Marketplace Git Emergency Restore Script

USAGE:
    $0

DESCRIPTION:
    Restores Git repository to state before BFG secret cleaning.
    This is an emergency procedure that should only be used if
    the BFG cleaning process caused critical issues.

ENVIRONMENT VARIABLES:
    BACKUP_REPO_PATH    Path to backup repository (default: /backup/nextgen-market-original.git)
    BRANCH_NAME         Branch to restore (default: main)

WARNING:
    This script will restore secrets to Git history!
    Only use in emergencies with proper authorization.

EMERGENCY CONTACTS:
    DevSecOps On-Call: +1-555-SECURE-1
    Security Team: +1-555-SECURITY
    
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