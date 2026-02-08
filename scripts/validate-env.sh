#!/bin/bash
# ====================================================================
# Environment Variables Validation Script
# ====================================================================
# Purpose: Validate .env file before deployment
# Usage: bash scripts/validate-env.sh
# ====================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🔍 Validating Environment Variables...${NC}\n"

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ ERROR: .env file not found${NC}"
    echo -e "${YELLOW}Run: cp .env.example .env${NC}"
    exit 1
fi

# Source .env file
set -a
source .env
set +a

errors=0
warnings=0

# Function to check if variable is set and not empty
check_required() {
    local var_name=$1
    local var_value=${!var_name}
    
    if [ -z "$var_value" ]; then
        echo -e "${RED}❌ ERROR: ${var_name} is not set or empty${NC}"
        ((errors++))
        return 1
    else
        echo -e "${GREEN}✅ ${var_name} is set${NC}"
        return 0
    fi
}

# Function to check minimum length
check_min_length() {
    local var_name=$1
    local min_length=$2
    local var_value=${!var_name}
    local actual_length=${#var_value}
    
    if [ $actual_length -lt $min_length ]; then
        echo -e "${RED}❌ ERROR: ${var_name} is too short (${actual_length} chars, need ${min_length}+)${NC}"
        ((errors++))
        return 1
    else
        echo -e "${GREEN}✅ ${var_name} length OK (${actual_length} chars)${NC}"
        return 0
    fi
}

# Function to check for weak/default passwords
check_not_default() {
    local var_name=$1
    local var_value=${!var_name}
    local defaults=("password" "123456" "admin" "postgres" "redis" "changeme" "secret")
    
    for default in "${defaults[@]}"; do
        if [[ "$var_value" == *"$default"* ]]; then
            echo -e "${YELLOW}⚠️  WARNING: ${var_name} contains weak/default value${NC}"
            ((warnings++))
            return 1
        fi
    done
    return 0
}

echo "────────────────────────────────────────────────"
echo "Database Configuration"
echo "────────────────────────────────────────────────"
check_required "POSTGRES_DB"
check_required "POSTGRES_USER"
check_required "POSTGRES_PASSWORD" && check_min_length "POSTGRES_PASSWORD" 16 && check_not_default "POSTGRES_PASSWORD"

echo ""
echo "────────────────────────────────────────────────"
echo "Redis Configuration"
echo "────────────────────────────────────────────────"
check_required "REDIS_PASSWORD" && check_min_length "REDIS_PASSWORD" 16 && check_not_default "REDIS_PASSWORD"

echo ""
echo "────────────────────────────────────────────────"
echo "Authentication & Security"
echo "────────────────────────────────────────────────"
check_required "JWT_SECRET" && check_min_length "JWT_SECRET" 32 && check_not_default "JWT_SECRET"
check_required "JWT_REFRESH_SECRET" && check_min_length "JWT_REFRESH_SECRET" 32 && check_not_default "JWT_REFRESH_SECRET"

echo ""
echo "────────────────────────────────────────────────"
echo "CORS Configuration"
echo "────────────────────────────────────────────────"
check_required "CORS_ORIGINS"

# Check if CORS contains localhost in production
if [ "$NODE_ENV" = "production" ]; then
    if [[ "$CORS_ORIGINS" == *"localhost"* ]]; then
        echo -e "${YELLOW}⚠️  WARNING: CORS_ORIGINS contains 'localhost' in production${NC}"
        ((warnings++))
    fi
fi

echo ""
echo "────────────────────────────────────────────────"
echo "Optional: Monitoring Tools"
echo "────────────────────────────────────────────────"

# These are optional, just warn if empty
if [ -z "$GRAFANA_PASSWORD" ]; then
    echo -e "${YELLOW}⚠️  GRAFANA_PASSWORD not set (skip if not using Grafana)${NC}"
else
    echo -e "${GREEN}✅ GRAFANA_PASSWORD is set${NC}"
fi

if [ -z "$PGADMIN_PASSWORD" ]; then
    echo -e "${YELLOW}⚠️  PGADMIN_PASSWORD not set (skip if not using pgAdmin)${NC}"
else
    echo -e "${GREEN}✅ PGADMIN_PASSWORD is set${NC}"
fi

# Summary
echo ""
echo "════════════════════════════════════════════════"
echo "Validation Summary"
echo "════════════════════════════════════════════════"
echo -e "Errors:   ${RED}${errors}${NC}"
echo -e "Warnings: ${YELLOW}${warnings}${NC}"
echo "════════════════════════════════════════════════"

if [ $errors -gt 0 ]; then
    echo -e "\n${RED}❌ Validation FAILED - Fix errors before deployment${NC}"
    echo -e "${YELLOW}Hint: Use 'openssl rand -base64 32' to generate secure secrets${NC}"
    exit 1
elif [ $warnings -gt 0 ]; then
    echo -e "\n${YELLOW}⚠️  Validation passed with warnings${NC}"
    echo -e "${YELLOW}Review warnings before production deployment${NC}"
    exit 0
else
    echo -e "\n${GREEN}✅ All validations passed!${NC}"
    exit 0
fi
