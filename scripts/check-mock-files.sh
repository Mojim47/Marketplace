#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# Mock Files Detection Script for Production Builds
# ═══════════════════════════════════════════════════════════════════════════
# This script checks for mock files in production code paths and build output.
# It should be run as part of CI/CD pipeline to prevent mock code from
# being deployed to production.
#
# Requirements: 1.3 - THE Production_System SHALL fail deployment if mock 
#               server files are detected in the build output
# ═══════════════════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "═══════════════════════════════════════════════════════════════════════════"
echo "🔍 Mock Files Detection Check"
echo "═══════════════════════════════════════════════════════════════════════════"

ERRORS=0
WARNINGS=0

# ─────────────────────────────────────────────────────────────────────────────
# Check 1: Mock files in source directories (apps/ and libs/)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📁 Checking for mock files in source directories..."

MOCK_FILES_IN_SRC=$(find apps/ libs/ -type f \( \
    -name "mock-*.ts" -o \
    -name "mock-*.mjs" -o \
    -name "mock-*.js" -o \
    -name "*.mock.ts" -o \
    -name "*.mock.js" \
\) ! -path "*/node_modules/*" ! -path "*/dist/*" ! -path "*/.next/*" ! -path "*/__mocks__/*" 2>/dev/null || true)

if [ -n "$MOCK_FILES_IN_SRC" ]; then
    echo -e "${YELLOW}⚠️  Warning: Mock files found in source directories:${NC}"
    echo "$MOCK_FILES_IN_SRC" | while read -r file; do
        echo "   - $file"
    done
    echo ""
    echo "   These files should be moved to tests/mocks/ directory."
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✅ No mock files found in source directories${NC}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Check 2: Mock files in build output directories
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "📦 Checking for mock files in build output..."

# Check if dist directories exist
if [ -d "dist" ] || [ -d "apps/web/.next" ] || [ -d "apps/admin/.next" ]; then
    MOCK_FILES_IN_DIST=$(find dist/ apps/web/.next/ apps/admin/.next/ -type f \( \
        -name "mock-*" -o \
        -name "*.mock.*" \
    \) 2>/dev/null | grep -v "node_modules" || true)

    if [ -n "$MOCK_FILES_IN_DIST" ]; then
        echo -e "${RED}❌ ERROR: Mock files found in build output!${NC}"
        echo "$MOCK_FILES_IN_DIST" | while read -r file; do
            echo "   - $file"
        done
        echo ""
        echo "   Production builds MUST NOT contain mock files."
        ERRORS=$((ERRORS + 1))
    else
        echo -e "${GREEN}✅ Build output is clean - no mock files detected${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Build output directories not found (dist/, apps/*/dist/)${NC}"
    echo "   Run 'pnpm run build' first to check build output."
fi

# ─────────────────────────────────────────────────────────────────────────────
# Check 3: Simulation/placeholder code patterns in production paths
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "🔎 Checking for simulation patterns in production code..."

# Check for simulate functions (excluding test files)
SIMULATE_PATTERNS=$(grep -r "function simulate" apps/ libs/ --include="*.ts" --include="*.js" \
    | grep -v ".spec.ts" | grep -v ".test.ts" | grep -v "node_modules" | grep -v "__tests__" || true)

if [ -n "$SIMULATE_PATTERNS" ]; then
    echo -e "${YELLOW}⚠️  Warning: Simulation functions found in production code:${NC}"
    echo "$SIMULATE_PATTERNS" | head -10
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✅ No simulation functions found in production code${NC}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Check 4: Placeholder data patterns
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "🔎 Checking for placeholder patterns..."

PLACEHOLDER_PATTERNS=$(grep -rn "PLACEHOLDER\|TODO.*mock\|FIXME.*mock" apps/ libs/ --include="*.ts" --include="*.js" \
    | grep -v ".spec.ts" | grep -v ".test.ts" | grep -v "node_modules" | grep -v "__tests__" || true)

if [ -n "$PLACEHOLDER_PATTERNS" ]; then
    echo -e "${YELLOW}⚠️  Warning: Placeholder patterns found:${NC}"
    echo "$PLACEHOLDER_PATTERNS" | head -10
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}✅ No placeholder patterns found${NC}"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "📋 Summary"
echo "═══════════════════════════════════════════════════════════════════════════"

if [ $ERRORS -gt 0 ]; then
    echo -e "${RED}❌ Check FAILED with $ERRORS error(s) and $WARNINGS warning(s)${NC}"
    echo ""
    echo "Mock files in build output will cause production issues."
    echo "Please remove or relocate mock files before deploying."
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Check PASSED with $WARNINGS warning(s)${NC}"
    echo ""
    echo "Consider addressing warnings before production deployment."
    exit 0
else
    echo -e "${GREEN}✅ All checks PASSED${NC}"
    exit 0
fi
