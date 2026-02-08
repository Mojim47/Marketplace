#!/bin/bash

# Complete startup script

set -e

echo "🚀 NextGen Invoicing Backend - Full Stack Startup"
echo "=================================================="
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Step 1: Install dependencies
echo -e "${BLUE}→${NC} Installing dependencies..."
pnpm install --prefer-offline
echo -e "${GREEN}✅${NC} Dependencies installed"
echo ""

# Step 2: Build TypeScript
echo -e "${BLUE}→${NC} Building TypeScript..."
pnpm run build
echo -e "${GREEN}✅${NC} Build successful"
echo ""

# Step 3: Setup environment
if [ ! -f .env ]; then
  echo -e "${BLUE}→${NC} Creating .env file..."
  cp .env.example .env
  echo -e "${GREEN}✅${NC} .env created"
  echo "  Note: Update .env with your configuration"
fi
echo ""

# Step 4: Docker compose up
echo -e "${BLUE}→${NC} Starting Docker services..."
docker compose up -d
echo -e "${GREEN}✅${NC} Docker services started"
echo ""

# Step 5: Wait for services
echo -e "${BLUE}→${NC} Waiting for services to be healthy..."
for i in {1..60}; do
  if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
    echo -e "${GREEN}✅${NC} Services are healthy"
    break
  fi
  
  if [ $i -eq 60 ]; then
    echo "⚠️  Services did not become healthy. Check logs with: docker compose logs"
    exit 1
  fi
  
  printf "."
  sleep 1
done
echo ""
echo ""

# Step 6: Display status
echo "=================================================="
echo -e "${GREEN}✅ Full Stack is Running!${NC}"
echo "=================================================="
echo ""
echo "API Status:"
curl -s http://localhost:3000/api/health | jq '.'
echo ""
echo "Services:"
docker compose ps
echo ""
echo "Available Endpoints:"
echo "  • GET  http://localhost:3000/api/health"
echo "  • POST http://localhost:3000/api/invoices/pre-invoices"
echo "  • GET  http://localhost:3000/api/invoices/:id"
echo "  • GET  http://localhost:3000/api/invoices/customer/:customerId/list"
echo ""
echo "Database:"
echo "  • Host: localhost:5432"
echo "  • User: dev"
echo "  • Pass: secure123"
echo "  • DB:   nextgen"
echo ""
echo "Redis:"
echo "  • Host: localhost:6379"
echo ""
echo "Useful Commands:"
echo "  • View logs:       docker compose logs -f api"
echo "  • Run tests:       pnpm test"
echo "  • Run E2E tests:   pnpm run test:e2e"
echo "  • Verify setup:    bash verify.sh"
echo "  • Deploy:          bash deploy.sh"
echo "  • Stop services:   docker compose down"
echo ""
