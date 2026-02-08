#!/bin/bash
set -e

echo "🚀 Applying Production Migration..."

# Check if database is running
if ! docker ps | grep -q postgres; then
    echo "❌ PostgreSQL not running. Starting..."
    docker-compose up -d postgres
    sleep 5
fi

# Apply migration
docker exec -i $(docker ps -q -f name=postgres) psql -U postgres -d nextgen_marketplace < prisma/migrations/final_production/migration.sql

# Verify tables
echo "✅ Verifying tables..."
docker exec -i $(docker ps -q -f name=postgres) psql -U postgres -d nextgen_marketplace -c "\dt" | grep -E "tax_invoices|price_audit|workflow|warehouse"

echo "✅ Migration completed successfully!"
