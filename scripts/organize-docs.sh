#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Documentation Organizer
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Clean up root directory by organizing documentation files
# Safety: Checks file existence before moving, preserves critical files
# Usage: chmod +x scripts/organize-docs.sh && ./scripts/organize-docs.sh
# ═══════════════════════════════════════════════════════════════════════════

set -e  # Exit on error
set -u  # Exit on undefined variable

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ───────────────────────────────────────────────────────────────────────────
# Helper Functions
# ───────────────────────────────────────────────────────────────────────────

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ───────────────────────────────────────────────────────────────────────────
# Validation
# ───────────────────────────────────────────────────────────────────────────

# Check if running from project root
if [[ ! -f "package.json" ]]; then
    log_error "package.json not found. Please run this script from the project root."
    exit 1
fi

log_info "Starting documentation organization..."

# ───────────────────────────────────────────────────────────────────────────
# Create Directory Structure
# ───────────────────────────────────────────────────────────────────────────

log_info "Creating documentation directories..."

mkdir -p docs/01-architecture
mkdir -p docs/02-deployment
mkdir -p docs/03-reports
mkdir -p docs/99-archive

log_success "Directory structure created"

# ───────────────────────────────────────────────────────────────────────────
# Move Files - Helper Function
# ───────────────────────────────────────────────────────────────────────────

move_file() {
    local source=$1
    local destination=$2
    
    if [[ -f "$source" ]]; then
        mv "$source" "$destination"
        log_success "Moved: $source → $destination"
        return 0
    else
        log_warning "File not found: $source (skipping)"
        return 1
    fi
}

# ───────────────────────────────────────────────────────────────────────────
# Move Reports
# ───────────────────────────────────────────────────────────────────────────

log_info "Moving report files..."

move_file "ADMIN_PANEL_IMPLEMENTATION_REPORT.md" "docs/03-reports/"
move_file "PRODUCTION_READINESS_CERTIFICATE.md" "docs/03-reports/"
move_file "FINAL_PRODUCTION_AUDIT.md" "docs/03-reports/"
move_file "COMPLETION_REPORT.md" "docs/03-reports/"
move_file "COMPREHENSIVE_AUDIT_GOLDEN7.md" "docs/03-reports/"
move_file "EXECUTIVE_SUMMARY.md" "docs/03-reports/"
move_file "EXECUTIVE_SUMMARY_GOLDEN7.md" "docs/03-reports/"
move_file "EXECUTIVE_SUMMARY_PHASE_3.md" "docs/03-reports/"
move_file "FINAL_PRODUCTION_READINESS_REPORT.md" "docs/03-reports/"
move_file "FINAL_READY_SUMMARY_PERSIAN.md" "docs/03-reports/"
move_file "ENTERPRISE_TESTING_SUMMARY.md" "docs/03-reports/"
move_file "DEVOPS_DELIVERY_SUMMARY.md" "docs/03-reports/"
move_file "DEVOPS_PHASE_4_COMPLETE.md" "docs/03-reports/"
move_file "DEVOPS_PHASE_COMPLETE.md" "docs/03-reports/"
move_file "COMPLETE_DELIVERY_SUMMARY.md" "docs/03-reports/"

# ───────────────────────────────────────────────────────────────────────────
# Move Architecture Files
# ───────────────────────────────────────────────────────────────────────────

log_info "Moving architecture files..."

move_file "ARCHITECTURE_COMPLETE.md" "docs/01-architecture/"
move_file "ARCHITECTURE_COMPLETION_FINAL.md" "docs/01-architecture/"
move_file "ARCHITECTURE_IMPLEMENTATION_FINAL_REPORT.md" "docs/01-architecture/"
move_file "ARCHITECTURE_INDEX.md" "docs/01-architecture/"
move_file "ARCHITECTURE_QUICK_REFERENCE.md" "docs/01-architecture/"
move_file "ARCHITECTURE_SUMMARY.md" "docs/01-architecture/"
move_file "ARCHITECTURE_VISUAL.md" "docs/01-architecture/"
move_file "BACKEND_ARCHITECTURE.md" "docs/01-architecture/"
move_file "DESIGN_SYSTEM_AND_ADMIN_ARCHITECTURE.md" "docs/01-architecture/"
move_file "FULL_STACK_ANALYSIS.md" "docs/01-architecture/"
move_file "FRONTEND_AUDIT.md" "docs/01-architecture/"

# ───────────────────────────────────────────────────────────────────────────
# Move Deployment Files
# ───────────────────────────────────────────────────────────────────────────

log_info "Moving deployment files..."

move_file "DEPLOYMENT_CHECKLIST_PERSIAN.md" "docs/02-deployment/"
move_file "DEPLOYMENT_DOCUMENTS_INDEX.md" "docs/02-deployment/"
move_file "DEPLOYMENT_QUICK_REFERENCE.md" "docs/02-deployment/"
move_file "DEPLOYMENT_READINESS_CERTIFICATE.md" "docs/02-deployment/"
move_file "DEPLOYMENT_READY.md" "docs/02-deployment/"
move_file "DEPLOYMENT_STATUS_DASHBOARD.md" "docs/02-deployment/"
move_file "DEPLOYMENT_VERIFICATION_MANIFEST.md" "docs/02-deployment/"
move_file "FINAL_VERIFICATION_CHECKLIST.md" "docs/02-deployment/"
move_file "AZURE_LOAD_TESTING_SETUP.md" "docs/02-deployment/"
move_file "DOCKER_SECURITY_GUIDE.md" "docs/02-deployment/"

# ───────────────────────────────────────────────────────────────────────────
# Move Phase Files to Archive
# ───────────────────────────────────────────────────────────────────────────

log_info "Moving phase files to archive..."

move_file "PHASE_1_COMPREHENSIVE_AUDIT.md" "docs/99-archive/"

for file in PHASE_*.md; do
    if [[ -f "$file" ]]; then
        move_file "$file" "docs/99-archive/"
    fi
done

# ───────────────────────────────────────────────────────────────────────────
# Move E2E Files to Archive
# ───────────────────────────────────────────────────────────────────────────

log_info "Moving E2E files to archive..."

move_file "E2E_BEFORE_AND_AFTER.md" "docs/99-archive/"
move_file "E2E_COMPLETE_DOCUMENTATION.md" "docs/99-archive/"
move_file "E2E_DOCUMENTATION_INDEX.md" "docs/99-archive/"
move_file "E2E_ERRORS_FIXED_COMPLETE.md" "docs/99-archive/"
move_file "E2E_ERRORS_FIXED.md" "docs/99-archive/"
move_file "E2E_FINAL_CHECKLIST.md" "docs/99-archive/"
move_file "E2E_FINAL_FIX_REPORT.md" "docs/99-archive/"
move_file "E2E_FINAL_SUMMARY.md" "docs/99-archive/"
move_file "E2E_MASTER_SUMMARY.md" "docs/99-archive/"
move_file "E2E_QUICK_REFERENCE.md" "docs/99-archive/"

# ───────────────────────────────────────────────────────────────────────────
# Move Observability Files
# ───────────────────────────────────────────────────────────────────────────

log_info "Moving observability files to archive..."

move_file "OBSERVABILITY_COMPLETE.md" "docs/99-archive/"
move_file "OBSERVABILITY_FILE_STRUCTURE.md" "docs/99-archive/"
move_file "OBSERVABILITY_IMPLEMENTATION_SUMMARY.md" "docs/99-archive/"
move_file "OBSERVABILITY_INDEX.md" "docs/99-archive/"
move_file "OBSERVABILITY_QUICK_START.md" "docs/99-archive/"

# ───────────────────────────────────────────────────────────────────────────
# Move Miscellaneous Files
# ───────────────────────────────────────────────────────────────────────────

log_info "Moving miscellaneous files to archive..."

move_file "ANALYSIS_INDEX.md" "docs/99-archive/"
move_file "ANALYSIS_SUMMARY.txt" "docs/99-archive/"
move_file "DEPENDENCY_GOVERNANCE.md" "docs/99-archive/"
move_file "DETAILED_FIXES.md" "docs/99-archive/"
move_file "ENTERPRISE_SECURITY_COMPLETE.md" "docs/99-archive/"
move_file "AI_AR_ROADMAP.md" "docs/99-archive/"

# ───────────────────────────────────────────────────────────────────────────
# Move Monitoring/Testing Guides to Appropriate Locations
# ───────────────────────────────────────────────────────────────────────────

log_info "Moving monitoring and testing guides..."

if [[ -f "COMPREHENSIVE_MONITORING_GUIDE.md" ]]; then
    mv "COMPREHENSIVE_MONITORING_GUIDE.md" "docs/01-architecture/"
    log_success "Moved: COMPREHENSIVE_MONITORING_GUIDE.md → docs/01-architecture/"
fi

if [[ -f "COMPREHENSIVE_TESTING_GUIDE.md" ]]; then
    mv "COMPREHENSIVE_TESTING_GUIDE.md" "docs/01-architecture/"
    log_success "Moved: COMPREHENSIVE_TESTING_GUIDE.md → docs/01-architecture/"
fi

if [[ -f "MONITORING_SETUP_GUIDE.md" ]]; then
    mv "MONITORING_SETUP_GUIDE.md" "docs/02-deployment/"
    log_success "Moved: MONITORING_SETUP_GUIDE.md → docs/02-deployment/"
fi

# ───────────────────────────────────────────────────────────────────────────
# Move DevOps Documentation
# ───────────────────────────────────────────────────────────────────────────

log_info "Moving DevOps documentation..."

move_file "DEVOPS_DOCUMENTATION_INDEX.md" "docs/02-deployment/"
move_file "DOCUMENTATION_INDEX.md" "docs/99-archive/"

# ───────────────────────────────────────────────────────────────────────────
# Files to Keep in Root (DO NOT MOVE)
# ───────────────────────────────────────────────────────────────────────────

# These files must stay in root:
# - README.md
# - LICENSE
# - .env.example
# - package.json
# - tsconfig.json
# - next.config.mjs
# - docker-compose.yml
# - docker-compose.prod.yml
# - Dockerfile

log_info "Preserving critical files in root..."
log_success "✓ README.md (preserved in root)"
log_success "✓ LICENSE (preserved in root)"
log_success "✓ .env.example (preserved in root)"
log_success "✓ package.json (preserved in root)"

# ───────────────────────────────────────────────────────────────────────────
# Create Index Files
# ───────────────────────────────────────────────────────────────────────────

log_info "Creating index files..."

cat > docs/README.md << 'EOF'
# 📚 NextGen Marketplace Documentation

## 📂 Structure

### 01-architecture/
System architecture, design patterns, and technical specifications.

### 02-deployment/
Deployment guides, infrastructure setup, and DevOps documentation.

### 03-reports/
Completion reports, audit results, and progress summaries.

### 99-archive/
Historical documentation and legacy files.

## 🚀 Quick Links

- [Admin Panel Implementation Report](./03-reports/ADMIN_PANEL_IMPLEMENTATION_REPORT.md)
- [Production Readiness Certificate](./03-reports/PRODUCTION_READINESS_CERTIFICATE.md)
- [Architecture Summary](./01-architecture/ARCHITECTURE_SUMMARY.md)
- [Deployment Guide](./02-deployment/DEPLOYMENT_READY.md)

## 📖 For Contributors

Please organize new documentation according to this structure:
- Architecture docs → `01-architecture/`
- Deployment docs → `02-deployment/`
- Reports → `03-reports/`
- Old/outdated docs → `99-archive/`
EOF

log_success "Created docs/README.md"

# ───────────────────────────────────────────────────────────────────────────
# Summary
# ───────────────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
log_success "Documentation organization complete!"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
log_info "Directory structure:"
tree -L 2 docs/ 2>/dev/null || find docs/ -type d -print
echo ""
log_info "Files preserved in root:"
ls -1 *.md 2>/dev/null || echo "  (no .md files in root)"
echo ""
log_success "✅ Root directory is now clean and organized!"
echo "═══════════════════════════════════════════════════════════════════════════"
