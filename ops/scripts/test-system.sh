#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - System Test Script
# ═══════════════════════════════════════════════════════════════════════════
# این اسکریپت تمام endpoints و سرویسهای حیاتی را تست میکند
# ═══════════════════════════════════════════════════════════════════════════

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
API_URL="${API_URL:-http://localhost:3001}"
TIMEOUT=5

# Counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test function
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected_status="${3:-200}"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "Testing $name... "
    
    response=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$url" 2>/dev/null || echo "000")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✅ PASS${NC} (HTTP $response)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Expected $expected_status, got $response)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Test JSON response
test_json_endpoint() {
    local name="$1"
    local url="$2"
    local expected_field="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "Testing $name... "
    
    response=$(curl -s --max-time $TIMEOUT "$url" 2>/dev/null || echo "{}")
    
    if echo "$response" | grep -q "$expected_field"; then
        echo -e "${GREEN}✅ PASS${NC} (Found '$expected_field')"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC} (Field '$expected_field' not found)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Header
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  NextGen Marketplace - System Test${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "API URL: $API_URL"
echo "Timeout: ${TIMEOUT}s"
echo ""

# Check if server is running
echo -e "${YELLOW}Checking if server is running...${NC}"
if ! curl -s --max-time 2 "$API_URL/health" > /dev/null 2>&1; then
    echo -e "${RED}❌ Server is not running at $API_URL${NC}"
    echo ""
    echo "Please start the server first:"
    echo "  npm run start:dev"
    echo "  OR"
    echo "  docker-compose up -d"
    exit 1
fi
echo -e "${GREEN}✅ Server is running${NC}"
echo ""

# Run tests
echo -e "${YELLOW}Running endpoint tests...${NC}"
echo ""

# Health & Monitoring
test_json_endpoint "Health Check" "$API_URL/health" "ok"
test_json_endpoint "Ready Check" "$API_URL/ready" "ready"
test_endpoint "Ping" "$API_URL/ping"
test_endpoint "Metrics (Prometheus)" "$API_URL/metrics"
test_json_endpoint "Metrics (JSON)" "$API_URL/metrics/json" "uptime"

# API Documentation
test_endpoint "Swagger UI" "$API_URL/api/docs" "301"

# Payment endpoints (should return 400/404 without proper params)
echo ""
echo -e "${YELLOW}Testing Payment endpoints (expecting errors without params)...${NC}"
test_endpoint "Payment Request (no body)" "$API_URL/payments/request" "400"
test_endpoint "Payment Verify (no params)" "$API_URL/payments/verify" "400"

# Summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Test Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""
echo "Total Tests:  $TOTAL_TESTS"
echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:       ${RED}$FAILED_TESTS${NC}"
echo ""

# Calculate percentage
if [ $TOTAL_TESTS -gt 0 ]; then
    PERCENTAGE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo "Success Rate: $PERCENTAGE%"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}🎉 All tests passed!${NC}"
        exit 0
    else
        echo -e "${YELLOW}⚠️  Some tests failed${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ No tests were run${NC}"
    exit 1
fi
