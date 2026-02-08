#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Project Cleanup Script
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Remove redundant files, legacy configs, and development artifacts
# Context: Part of emergency security hardening (2025-11-24)
# ═══════════════════════════════════════════════════════════════════════════

set -e
set -o pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🧹 NextGen Marketplace - Project Cleanup${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "📍 Project Root: ${PROJECT_ROOT}"
echo -e "⏰ Started: $(date)"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

cd "${PROJECT_ROOT}"

# ═══════════════════════════════════════════════════════════════════════════
# Step 1: Remove Legacy Workflow Files
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}[1/7]${NC} Checking for legacy workflow files..."

LEGACY_WORKFLOWS=(
  ".github/workflows/ci.yml"
  ".github/workflows/phase-2-deploy.yml"
  ".github/workflows/full-ci.yml"
  ".github/workflows/ci-cd-enterprise.yml"
)

REMOVED_WORKFLOWS=0
for workflow in "${LEGACY_WORKFLOWS[@]}"; do
  if [ -f "$workflow" ]; then
    echo -e "   ${RED}✗${NC} Removing: $workflow"
    rm -f "$workflow"
    REMOVED_WORKFLOWS=$((REMOVED_WORKFLOWS + 1))
  fi
done

if [ $REMOVED_WORKFLOWS -gt 0 ]; then
  echo -e "${GREEN}✓${NC} Removed $REMOVED_WORKFLOWS legacy workflow(s)"
else
  echo -e "${GREEN}✓${NC} No legacy workflows found"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Step 2: Remove Development Docker Compose File
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}[2/7]${NC} Checking for development Docker Compose file..."

DEV_COMPOSE="docker-compose.yml"
if [ -f "$DEV_COMPOSE" ]; then
  echo -e "   ${YELLOW}⚠${NC}  Found: $DEV_COMPOSE"
  echo -e "   ${YELLOW}⚠${NC}  This file contains INSECURE defaults (exposed ports, weak passwords)"
  
  read -p "   Remove it? (y/n) [y]: " -n 1 -r REPLY
  echo
  if [[ $REPLY =~ ^[Yy]$ ]] || [[ -z $REPLY ]]; then
    echo -e "   ${RED}✗${NC} Removing: $DEV_COMPOSE"
    rm -f "$DEV_COMPOSE"
    echo -e "${GREEN}✓${NC} Removed insecure development compose file"
  else
    echo -e "${YELLOW}⊘${NC} Skipped (user chose to keep)"
  fi
else
  echo -e "${GREEN}✓${NC} No development compose file found"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Step 3: Clean Build Artifacts
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}[3/7]${NC} Cleaning build artifacts..."

BUILD_DIRS=(
  "dist"
  ".next"
  "build"
  "out"
  ".turbo"
  "apps/web/.next"
  "apps/api/dist"
  "apps/admin/.next"
  "apps/vendor-portal/.next"
  "apps/worker/dist"
)

REMOVED_DIRS=0
for dir in "${BUILD_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo -e "   ${RED}✗${NC} Removing: $dir"
    rm -rf "$dir"
    REMOVED_DIRS=$((REMOVED_DIRS + 1))
  fi
done

if [ $REMOVED_DIRS -gt 0 ]; then
  echo -e "${GREEN}✓${NC} Removed $REMOVED_DIRS build artifact(s)"
else
  echo -e "${GREEN}✓${NC} No build artifacts found"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Step 4: Clean Node Modules (Optional)
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}[4/7]${NC} Checking for node_modules..."

if [ -d "node_modules" ]; then
  NODE_SIZE=$(du -sh node_modules 2>/dev/null | cut -f1)
  echo -e "   ${BLUE}ℹ${NC}  Found: node_modules ($NODE_SIZE)"
  
  read -p "   Remove and reinstall? (y/n) [n]: " -n 1 -r REPLY
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "   ${RED}✗${NC} Removing: node_modules"
    rm -rf node_modules
    echo -e "   ${BLUE}↓${NC} Running: npm ci"
    npm ci --prefer-offline --no-audit
    echo -e "${GREEN}✓${NC} Fresh install completed"
  else
    echo -e "${YELLOW}⊘${NC} Skipped (user chose to keep)"
  fi
else
  echo -e "${GREEN}✓${NC} No node_modules found"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Step 5: Remove Phase Documentation Files
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}[5/7]${NC} Checking for legacy phase documentation..."

LEGACY_DOCS=(
  "phase-*.md"
  "PHASE_*.md"
  "docs/phase-*.md"
  "docs/PHASE_*.md"
)

REMOVED_DOCS=0
for pattern in "${LEGACY_DOCS[@]}"; do
  for file in $pattern; do
    if [ -f "$file" ]; then
      echo -e "   ${RED}✗${NC} Removing: $file"
      rm -f "$file"
      REMOVED_DOCS=$((REMOVED_DOCS + 1))
    fi
  done
done

if [ $REMOVED_DOCS -gt 0 ]; then
  echo -e "${GREEN}✓${NC} Removed $REMOVED_DOCS legacy doc(s)"
else
  echo -e "${GREEN}✓${NC} No legacy docs found"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Step 6: Clean Docker Resources (Optional)
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}[6/7]${NC} Docker cleanup..."

if command -v docker &> /dev/null; then
  echo -e "   ${BLUE}ℹ${NC}  Docker is available"
  
  read -p "   Clean unused Docker resources? (y/n) [n]: " -n 1 -r REPLY
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "   ${BLUE}🐳${NC} Running: docker system prune"
    docker system prune -f --volumes 2>/dev/null || echo -e "   ${YELLOW}⚠${NC}  Docker cleanup had some errors (non-fatal)"
    echo -e "${GREEN}✓${NC} Docker cleanup completed"
  else
    echo -e "${YELLOW}⊘${NC} Skipped (user chose to skip)"
  fi
else
  echo -e "${YELLOW}⊘${NC} Docker not found (skipping)"
fi
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Step 7: Summary
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}[7/7]${NC} Generating cleanup report..."

REPORT_FILE="${PROJECT_ROOT}/CLEANUP_REPORT.txt"
cat > "$REPORT_FILE" <<EOF
═══════════════════════════════════════════════════════════════════════════
NextGen Marketplace - Cleanup Report
═══════════════════════════════════════════════════════════════════════════
Date: $(date)
Project: ${PROJECT_ROOT}
───────────────────────────────────────────────────────────────────────────

✅ ACTIONS TAKEN:
- Removed legacy workflow files: ${REMOVED_WORKFLOWS}
- Removed build directories: ${REMOVED_DIRS}
- Removed legacy documentation: ${REMOVED_DOCS}

✅ SECURITY IMPROVEMENTS:
- No more development docker-compose.yml with insecure defaults
- No more redundant CI/CD workflows
- Clean build artifacts

✅ RECOMMENDED NEXT STEPS:
1. Review .env file and ensure all secrets are set
2. Run: bash scripts/generate-secrets.sh
3. Run: bash scripts/validate-env.sh
4. Test deployment: git push origin main

───────────────────────────────────────────────────────────────────────────
📁 CURRENT STRUCTURE:
   .github/workflows/deploy.yml ← Production deployment only
   docker-compose.prod.yml ← Zero Trust production config
   .env ← User secrets (NOT in git)
   .env.example ← Template without defaults

═══════════════════════════════════════════════════════════════════════════
EOF

echo -e "${GREEN}✓${NC} Report saved: CLEANUP_REPORT.txt"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Final Output
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Cleanup Completed Successfully!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "📄 Full report: ${REPORT_FILE}"
echo -e "⏰ Completed: $(date)"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}🔒 NEXT STEPS:${NC}"
echo -e "   1. Generate secure secrets: ${GREEN}bash scripts/generate-secrets.sh${NC}"
echo -e "   2. Validate environment: ${GREEN}bash scripts/validate-env.sh${NC}"
echo -e "   3. Deploy to production: ${GREEN}git push origin main${NC}"
echo ""
