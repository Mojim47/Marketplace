-- ═══════════════════════════════════════════════════════════════════════════
-- NextGen Marketplace - Ultra-Fast 7-Layer Architecture Migration
-- ═══════════════════════════════════════════════════════════════════════════
-- Version: 3.0.0 - Complete System Replacement
-- Date: 2024-12-29
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create application user for RLS
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'nextgen_app') THEN
        CREATE ROLE nextgen_app WITH LOGIN PASSWORD 'nextgen_app_secret_2024';
    END IF;
END
$$;

GRANT CONNECT ON DATABASE postgres TO nextgen_app;

-- Create tenant context functions
CREATE OR REPLACE FUNCTION current_tenant_id() RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_tenant_id', true);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION current_user_id() RETURNS TEXT AS $$
BEGIN
  RETURN current_setting('app.current_user_id', true);
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION current_user_roles() RETURNS TEXT[] AS $$
BEGIN
  RETURN string_to_array(current_setting('app.current_user_roles', true), ',');
END;
$$ LANGUAGE plpgsql STABLE;

-- Create security context setter function
CREATE OR REPLACE FUNCTION set_security_context(
  tenant_id TEXT,
  user_id TEXT,
  user_roles TEXT[]
) RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_id, true);
  PERFORM set_config('app.current_user_id', user_id, true);
  PERFORM set_config('app.current_user_roles', array_to_string(user_roles, ','), true);
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION current_tenant_id() TO nextgen_app;
GRANT EXECUTE ON FUNCTION current_user_id() TO nextgen_app;
GRANT EXECUTE ON FUNCTION current_user_roles() TO nextgen_app;
GRANT EXECUTE ON FUNCTION set_security_context(TEXT, TEXT, TEXT[]) TO nextgen_app;

-- Create audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at = NOW();
    NEW.updated_at = NOW();
    NEW.created_by = current_user_id();
    NEW.updated_by = current_user_id();
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.updated_at = NOW();
    NEW.updated_by = current_user_id();
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create ENUM types
CREATE TYPE "UserRole" AS ENUM ('USER', 'SELLER', 'ADMIN', 'EXECUTOR');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED');
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'OUT_OF_STOCK');
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- Create tables with RLS enabled
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password" TEXT NOT NULL,
    "roles" "UserRole"[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "first_name" TEXT,
    "last_name" TEXT,
    "avatar_url" TEXT,
    "last_login" TIMESTAMP(3),
    "login_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" DECIMAL(10,2) NOT NULL,
    "tax" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "total_price" DECIMAL(10,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "gateway" TEXT NOT NULL,
    "gateway_ref" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,
    "updated_by" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "system_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "user_id" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "performance_metrics" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "metric_name" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '{}',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id")
);

-- Create unique constraints
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");
CREATE UNIQUE INDEX "products_tenant_id_sku_key" ON "products"("tenant_id", "sku");
CREATE UNIQUE INDEX "orders_tenant_id_order_number_key" ON "orders"("tenant_id", "order_number");

-- Create performance indexes
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
CREATE INDEX "users_tenant_id_roles_idx" ON "users"("tenant_id", "roles");
CREATE INDEX "products_tenant_id_status_idx" ON "products"("tenant_id", "status");
CREATE INDEX "products_tenant_id_name_idx" ON "products"("tenant_id", "name");
CREATE INDEX "orders_tenant_id_user_id_idx" ON "orders"("tenant_id", "user_id");
CREATE INDEX "orders_tenant_id_status_idx" ON "orders"("tenant_id", "status");
CREATE INDEX "order_items_tenant_id_order_id_idx" ON "order_items"("tenant_id", "order_id");
CREATE INDEX "payments_tenant_id_order_id_idx" ON "payments"("tenant_id", "order_id");
CREATE INDEX "system_events_tenant_id_event_type_occurred_at_idx" ON "system_events"("tenant_id", "event_type", "occurred_at");
CREATE INDEX "system_events_tenant_id_entity_type_entity_id_idx" ON "system_events"("tenant_id", "entity_type", "entity_id");
CREATE INDEX "performance_metrics_tenant_id_metric_name_recorded_at_idx" ON "performance_metrics"("tenant_id", "metric_name", "recorded_at");

-- Add foreign key constraints
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Enable RLS on all tables
ALTER TABLE "tenants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "products" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "system_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "performance_metrics" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "tenant_isolation_tenants" ON "tenants" FOR ALL USING ("id" = current_tenant_id());
CREATE POLICY "tenant_isolation_users" ON "users" FOR ALL USING ("tenant_id" = current_tenant_id());
CREATE POLICY "tenant_isolation_products" ON "products" FOR ALL USING ("tenant_id" = current_tenant_id());
CREATE POLICY "tenant_isolation_orders" ON "orders" FOR ALL USING ("tenant_id" = current_tenant_id());
CREATE POLICY "tenant_isolation_order_items" ON "order_items" FOR ALL USING ("tenant_id" = current_tenant_id());
CREATE POLICY "tenant_isolation_payments" ON "payments" FOR ALL USING ("tenant_id" = current_tenant_id());
CREATE POLICY "tenant_isolation_system_events" ON "system_events" FOR ALL USING ("tenant_id" = current_tenant_id());
CREATE POLICY "tenant_isolation_performance_metrics" ON "performance_metrics" FOR ALL USING ("tenant_id" = current_tenant_id());

-- Create audit triggers
CREATE TRIGGER "tenants_audit" BEFORE INSERT OR UPDATE ON "tenants" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER "users_audit" BEFORE INSERT OR UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER "products_audit" BEFORE INSERT OR UPDATE ON "products" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER "orders_audit" BEFORE INSERT OR UPDATE ON "orders" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER "order_items_audit" BEFORE INSERT OR UPDATE ON "order_items" FOR EACH ROW EXECUTE FUNCTION audit_trigger();
CREATE TRIGGER "payments_audit" BEFORE INSERT OR UPDATE ON "payments" FOR EACH ROW EXECUTE FUNCTION audit_trigger();

-- Grant permissions to application user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nextgen_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nextgen_app;

-- Performance optimization settings
-- NOTE: ALTER SYSTEM cannot run inside a transaction (Prisma shadow DB migration).
-- Apply these settings manually at the database level if needed.
-- ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
-- ALTER SYSTEM SET max_connections = 200;
-- ALTER SYSTEM SET shared_buffers = '256MB';
-- ALTER SYSTEM SET effective_cache_size = '1GB';
-- ALTER SYSTEM SET maintenance_work_mem = '64MB';
-- ALTER SYSTEM SET checkpoint_completion_target = 0.9;
-- ALTER SYSTEM SET wal_buffers = '16MB';
-- ALTER SYSTEM SET default_statistics_target = 100;
-- ALTER SYSTEM SET random_page_cost = 1.1;
-- ALTER SYSTEM SET effective_io_concurrency = 200;
