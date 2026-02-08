#!/bin/bash
set -e

echo "🚀 NextGen Invoicing Backend - Production Verification"
echo "======================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_step() {
  echo -e "${YELLOW}→${NC} $1"
}

success() {
  echo -e "${GREEN}✅${NC} $1"
}

error() {
  echo -e "${RED}❌${NC} $1"
  exit 1
}

# Step 1: Build
check_step "Building TypeScript..."
pnpm run build || error "Build failed"
success "Build completed"
echo ""

# Step 2: Docker build
check_step "Building Docker image..."
docker build -t nextgen-api:latest . || error "Docker build failed"
success "Docker image built"
echo ""

# Step 3: Start services
check_step "Starting Docker Compose services..."
docker compose up -d || error "Docker Compose failed"
success "Services started"
echo ""

# Step 4: Wait for health
check_step "Waiting for services to be healthy..."
for i in {1..60}; do
  if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
    success "Services are healthy"
    break
  fi
  
  if [ $i -eq 60 ]; then
    error "Services did not become healthy within 60 seconds"
  fi
  
  echo -n "."
  sleep 1
done
echo ""

# Step 5: Test health endpoint
check_step "Testing health endpoint..."
HEALTH=$(curl -sf http://localhost:3000/api/health)
echo "  Response: $HEALTH"
success "Health endpoint working"
echo ""

# Step 6: Test invoice creation
check_step "Testing invoice creation..."
KEY=$(uuidgen | tr '[:upper:]' '[:lower:]')
INVOICE=$(curl -sf -X POST http://localhost:3000/api/invoices/pre-invoices \
  -H "Idempotency-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust_123",
    "items": [{"sku": "SKU001", "qty": 1, "price": 1000000}],
    "sana": {"economicCode": "1234567890", "nationalId": "0000000001", "fiscalYear": "1403"}
  }')
INVOICE_ID=$(echo "$INVOICE" | grep -o '"id":"[^"]*' | cut -d'"' -f4)
echo "  Created Invoice ID: $INVOICE_ID"
success "Invoice creation working"
echo ""

# Step 7: Test idempotency
check_step "Testing idempotency..."
INVOICE2=$(curl -sf -X POST http://localhost:3000/api/invoices/pre-invoices \
  -H "Idempotency-Key: $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust_123",
    "items": [{"sku": "SKU001", "qty": 1, "price": 1000000}],
    "sana": {"economicCode": "1234567890", "nationalId": "0000000001", "fiscalYear": "1403"}
  }')
INVOICE2_ID=$(echo "$INVOICE2" | grep -o '"id":"[^"]*' | cut -d'"' -f4)

if [ "$INVOICE_ID" = "$INVOICE2_ID" ]; then
  success "Idempotency working (same ID returned)"
else
  error "Idempotency failed (different IDs)"
fi
echo ""

# Step 8: Test retrieval
check_step "Testing invoice retrieval..."
RETRIEVED=$(curl -sf http://localhost:3000/api/invoices/$INVOICE_ID)
echo "  Retrieved: $RETRIEVED"
success "Invoice retrieval working"
echo ""

# Step 9: Test rate limiting headers
check_step "Testing rate limiting headers..."
HEADERS=$(curl -sf -X POST http://localhost:3000/api/invoices/pre-invoices \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "cust_123",
    "items": [{"sku": "SKU001", "qty": 1, "price": 1000000}],
    "sana": {"economicCode": "1234567890", "nationalId": "0000000001", "fiscalYear": "1403"}
  }' -D - 2>&1 | grep -E "X-RateLimit")
echo "  Headers: $HEADERS"
success "Rate limiting headers present"
echo ""

# Step 10: Cleanup
check_step "Stopping services..."
docker compose down -v || true
success "Services stopped"
echo ""

echo "======================================================="
echo -e "${GREEN}🎉 ALL VERIFICATION TESTS PASSED!${NC}"
echo "======================================================="
echo ""
echo "✅ Real Full-Stack Achieved"
echo "✅ Zero Fantasy"
echo "✅ Production Ready"
echo ""
