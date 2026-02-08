#!/bin/bash
set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 NextGen Marketplace - Database Initialization Protocol"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ═══════════════════════════════════════════════════════════════
# Phase 1: Infrastructure Check 🏗️
# ═══════════════════════════════════════════════════════════════
echo "📦 Phase 1: Infrastructure Check"
echo "─────────────────────────────────────────────────────────────"

# Export environment variables
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=postgres123
export POSTGRES_DB=nextgen_marketplace
export DB_USER=postgres
export DB_PASSWORD=postgres123
export DB_NAME=nextgen_marketplace
export EU_AR_ADDRESS=""

echo "🔍 Checking if PostgreSQL container is running..."
if sudo docker ps | grep -q "nextgen-postgres-prod"; then
    echo "✅ PostgreSQL container is already running"
else
    echo "🚀 Starting PostgreSQL container..."
    sudo docker compose up -d postgres
    
    echo "⏳ Waiting for PostgreSQL to be ready..."
    sleep 5
    
    # Wait for PostgreSQL to accept connections
    until sudo docker compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
        echo "   Still waiting for database..."
        sleep 2
    done
    
    echo "✅ PostgreSQL is ready and accepting connections!"
fi

echo ""

# ═══════════════════════════════════════════════════════════════
# Phase 2: Schema Synchronization 🔄
# ═══════════════════════════════════════════════════════════════
echo "📦 Phase 2: Schema Synchronization"
echo "─────────────────────────────────────────────────────────────"

echo "🔄 Pushing Prisma schema to database..."
npx prisma db push --accept-data-loss

echo ""
echo "🔧 Generating Prisma Client..."
npx prisma generate

echo "✅ Schema synchronized successfully!"
echo ""

# ═══════════════════════════════════════════════════════════════
# Phase 3: Intelligent Data Seeding 🌱
# ═══════════════════════════════════════════════════════════════
echo "📦 Phase 3: Intelligent Data Seeding"
echo "─────────────────────────────────────────────────────────────"

echo "🌱 Running database seed..."
npx prisma db seed

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Database Initialization Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Admin Credentials:"
echo "   Email:    admin@nextgen-market.com"
echo "   Password: Admin@12345"
echo ""
echo "📋 Demo Users:"
echo "   customer1@example.com / User@12345"
echo "   customer2@example.com / User@12345"
echo "   seller1@example.com   / User@12345"
echo ""
echo "🔗 Database URL: postgresql://postgres:postgres123@localhost:5432/nextgen_marketplace"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
