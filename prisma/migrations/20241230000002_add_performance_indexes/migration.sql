-- â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
-- Performance Indexes Migration - Critical Indexes for Ultra-Fast Performance
-- â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ
-- Migration: 20241230000002_add_performance_indexes
-- Purpose: Add tenant-aware indexes for RLS performance and query optimization
-- â•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گâ•گ

-- Users table indexes
CREATE INDEX IF NOT EXISTS "idx_users_tenant_email" ON "users"("tenant_id", "email");
CREATE INDEX IF NOT EXISTS "idx_users_tenant_active" ON "users"("tenant_id", "is_active");
CREATE INDEX IF NOT EXISTS "idx_users_last_login" ON "users"("last_login");

-- Products table indexes
CREATE INDEX IF NOT EXISTS "idx_products_tenant_status" ON "products"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_products_tenant_sku" ON "products"("tenant_id", "sku");
CREATE INDEX IF NOT EXISTS "idx_products_tenant_name" ON "products"("tenant_id", "name");
CREATE INDEX IF NOT EXISTS "idx_products_price" ON "products"("price");
CREATE INDEX IF NOT EXISTS "idx_products_stock" ON "products"("stock") WHERE "stock" > 0;
CREATE INDEX IF NOT EXISTS "idx_products_created_at" ON "products"("created_at");

-- Full-text search index for products
CREATE INDEX IF NOT EXISTS "idx_products_search" ON "products" USING gin(to_tsvector('english', "name" || ' ' || COALESCE("description", '')));

-- Orders table indexes
CREATE INDEX IF NOT EXISTS "idx_orders_tenant_user" ON "orders"("tenant_id", "user_id");
CREATE INDEX IF NOT EXISTS "idx_orders_tenant_status" ON "orders"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_orders_tenant_number" ON "orders"("tenant_id", "order_number");
CREATE INDEX IF NOT EXISTS "idx_orders_created_at" ON "orders"("created_at");
CREATE INDEX IF NOT EXISTS "idx_orders_total" ON "orders"("total");

-- Order items table indexes
CREATE INDEX IF NOT EXISTS "idx_order_items_order" ON "order_items"("order_id");
CREATE INDEX IF NOT EXISTS "idx_order_items_product" ON "order_items"("product_id");
CREATE INDEX IF NOT EXISTS "idx_order_items_tenant" ON "order_items"("tenant_id");

-- Payments table indexes
CREATE INDEX IF NOT EXISTS "idx_payments_tenant_order" ON "payments"("tenant_id", "order_id");
CREATE INDEX IF NOT EXISTS "idx_payments_tenant_status" ON "payments"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "idx_payments_gateway_ref" ON "payments"("gateway_ref") WHERE "gateway_ref" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "idx_payments_created_at" ON "payments"("created_at");

-- System events table indexes (for analytics and monitoring)
CREATE INDEX IF NOT EXISTS "idx_system_events_tenant_type" ON "system_events"("tenant_id", "event_type");
CREATE INDEX IF NOT EXISTS "idx_system_events_tenant_entity" ON "system_events"("tenant_id", "entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "idx_system_events_occurred_at" ON "system_events"("occurred_at");
CREATE INDEX IF NOT EXISTS "idx_system_events_user" ON "system_events"("user_id") WHERE "user_id" IS NOT NULL;

-- Performance metrics table indexes
CREATE INDEX IF NOT EXISTS "idx_performance_metrics_tenant_name" ON "performance_metrics"("tenant_id", "metric_name");
CREATE INDEX IF NOT EXISTS "idx_performance_metrics_recorded_at" ON "performance_metrics"("recorded_at");

-- Tenants table indexes
CREATE INDEX IF NOT EXISTS "idx_tenants_status" ON "tenants"("status");
CREATE INDEX IF NOT EXISTS "idx_tenants_created_at" ON "tenants"("created_at");

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS "idx_products_tenant_status_created" ON "products"("tenant_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "idx_orders_tenant_user_status" ON "orders"("tenant_id", "user_id", "status");
CREATE INDEX IF NOT EXISTS "idx_payments_tenant_status_created" ON "payments"("tenant_id", "status", "created_at");

-- Partial indexes for active records only (better performance)
CREATE INDEX IF NOT EXISTS "idx_products_active_tenant" ON "products"("tenant_id", "created_at") WHERE "status" = 'ACTIVE';
CREATE INDEX IF NOT EXISTS "idx_users_active_tenant" ON "users"("tenant_id", "created_at") WHERE "is_active" = true;

-- BRIN indexes for time-series data (system_events, performance_metrics)
CREATE INDEX IF NOT EXISTS "idx_system_events_occurred_brin" ON "system_events" USING brin("occurred_at");
CREATE INDEX IF NOT EXISTS "idx_performance_metrics_recorded_brin" ON "performance_metrics" USING brin("recorded_at");

-- Statistics update for better query planning
ANALYZE "users";
ANALYZE "products";
ANALYZE "orders";
ANALYZE "order_items";
ANALYZE "payments";
ANALYZE "system_events";
ANALYZE "performance_metrics";
ANALYZE "tenants";