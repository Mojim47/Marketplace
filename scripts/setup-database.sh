#!/bin/bash

set -e

echo "🚀 NextGen Marketplace - Database Setup Script"
echo "=============================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}❌ Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Start PostgreSQL
echo -e "${BLUE}📦 Starting PostgreSQL container...${NC}"
docker-compose up -d postgres

# Wait for PostgreSQL to be ready
echo -e "${BLUE}⏳ Waiting for PostgreSQL to be ready...${NC}"
sleep 5

until docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done

echo -e "${GREEN}✅ PostgreSQL is ready${NC}"

# Generate Prisma Client
echo -e "${BLUE}🔧 Generating Prisma Client...${NC}"
npx prisma generate

# Run migrations
echo -e "${BLUE}🔄 Running database migrations...${NC}"
npx prisma migrate deploy

# Seed database
echo -e "${BLUE}🌱 Seeding database with production data...${NC}"
npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-production.ts

echo -e "${GREEN}✅ Database setup completed successfully!${NC}"
echo ""
echo "📊 Database is ready with:"
echo "  - Real Iranian market data"
echo "  - B2B hierarchy (Factory → Distributor → Agent)"
echo "  - 5 Vendors with products"
echo "  - 10 Executors with projects"
echo "  - 30 Customers with orders"
echo "  - Proforma invoices, Cheques, Warranties"
echo "  - Price locks and volatility indexes"
echo ""
echo "🔐 Admin credentials:"
echo "  Email: admin@nextgen.ir"
echo "  Password: Admin@123"
echo ""
echo "🌐 Start the API server:"
echo "  npm run start:dev"
