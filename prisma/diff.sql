-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('CUSTOMER', 'DEALER', 'VENDOR', 'EXECUTOR', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "DealerTier" AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'DISCONTINUED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('ZARINPAL', 'MELLAT', 'SAMAN', 'WALLET', 'CREDIT', 'CHEQUE');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'SENT_TO_MOODIAN', 'MOODIAN_CONFIRMED', 'MOODIAN_REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExecutorStatus" AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'SUSPENDED', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('OPEN_FOR_BIDDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "ChequeStatus" AS ENUM ('PENDING', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'CANCELLED', 'RETURNED');

-- CreateEnum
CREATE TYPE "WarrantyStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'VOIDED', 'CLAIMED');

-- CreateEnum
CREATE TYPE "ProformaStatus" AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InventoryLogType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'RESERVED', 'RELEASED', 'DAMAGED', 'RETURNED');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BUY_X_GET_Y');

-- CreateEnum
CREATE TYPE "BidStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(63) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "name_fa" VARCHAR(255),
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "tax_id" VARCHAR(20),
    "economic_code" VARCHAR(20),
    "settings" JSONB NOT NULL DEFAULT '{}',
    "features" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(20),
    "national_id" VARCHAR(10),
    "password_hash" TEXT NOT NULL,
    "totp_secret" TEXT,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "first_name" VARCHAR(100),
    "last_name" VARCHAR(100),
    "first_name_fa" VARCHAR(100),
    "last_name_fa" VARCHAR(100),
    "avatar_url" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" VARCHAR(45),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "device_info" TEXT,
    "ip_address" VARCHAR(45),
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role_assignments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "assigned_by" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "user_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "label" VARCHAR(50),
    "province" VARCHAR(50) NOT NULL,
    "city" VARCHAR(50) NOT NULL,
    "district" VARCHAR(100),
    "street" VARCHAR(255) NOT NULL,
    "postal_code" VARCHAR(10) NOT NULL,
    "unit" VARCHAR(20),
    "latitude" DECIMAL(10,8),
    "longitude" DECIMAL(11,8),
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dealer_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "company_name" VARCHAR(255) NOT NULL,
    "company_name_fa" VARCHAR(255),
    "tax_id" VARCHAR(20),
    "economic_code" VARCHAR(20),
    "tier" "DealerTier" NOT NULL DEFAULT 'BRONZE',
    "credit_limit" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "credit_used" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "base_discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "verified_by" TEXT,
    "documents" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dealer_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cheques" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "bank_name" VARCHAR(100) NOT NULL,
    "branch_code" VARCHAR(20),
    "account_number" VARCHAR(30) NOT NULL,
    "cheque_number" VARCHAR(20) NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "ChequeStatus" NOT NULL DEFAULT 'PENDING',
    "cleared_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cheques_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "name_fa" VARCHAR(255),
    "slug" VARCHAR(100) NOT NULL,
    "tax_id" VARCHAR(20),
    "economic_code" VARCHAR(20),
    "email" VARCHAR(255),
    "phone" VARCHAR(20),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMP(3),
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "name" VARCHAR(100) NOT NULL,
    "name_fa" VARCHAR(100),
    "slug" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "level" INTEGER NOT NULL DEFAULT 0,
    "path" TEXT NOT NULL DEFAULT '/',
    "image_url" TEXT,
    "icon" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "vendor_id" TEXT NOT NULL,
    "category_id" TEXT,
    "sku" VARCHAR(50) NOT NULL,
    "barcode" VARCHAR(50),
    "name" VARCHAR(255) NOT NULL,
    "name_fa" VARCHAR(255),
    "slug" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "description_fa" TEXT,
    "price" DECIMAL(15,2) NOT NULL,
    "compare_price" DECIMAL(15,2),
    "cost_price" DECIMAL(15,2),
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 9,
    "is_tax_exempt" BOOLEAN NOT NULL DEFAULT false,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "reserved_stock" INTEGER NOT NULL DEFAULT 0,
    "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
    "status" "ProductStatus" NOT NULL DEFAULT 'DRAFT',
    "images" JSONB NOT NULL DEFAULT '[]',
    "model_3d_url" TEXT,
    "meta_title" VARCHAR(70),
    "meta_description" VARCHAR(160),
    "search_vector" TEXT,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "specifications" JSONB NOT NULL DEFAULT '[]',
    "warranty_months" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_tier_prices" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "tier" "DealerTier" NOT NULL,
    "price" DECIMAL(15,2) NOT NULL,
    "min_qty" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_tier_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_logs" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" "InventoryLogType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "inventory_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_number" VARCHAR(20) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(15,2) NOT NULL,
    "discount_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "shipping_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "shipping_address" JSONB,
    "shipping_method" TEXT,
    "tracking_number" TEXT,
    "customer_note" TEXT,
    "admin_note" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_name" VARCHAR(255) NOT NULL,
    "product_sku" VARCHAR(50) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(15,2) NOT NULL,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_idempotencies" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "idempotency_key" VARCHAR(128) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "response" JSONB,
    "status" VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_idempotencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "gateway" "PaymentGateway" NOT NULL,
    "gateway_ref" VARCHAR(100),
    "gateway_track" VARCHAR(100),
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "verified_at" TIMESTAMP(3),
    "card_pan" VARCHAR(20),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proforma_invoices" (
    "id" TEXT NOT NULL,
    "dealer_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "invoice_number" VARCHAR(20) NOT NULL,
    "subtotal" DECIMAL(15,2) NOT NULL,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(15,2) NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "status" "ProformaStatus" NOT NULL DEFAULT 'DRAFT',
    "valid_until" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proforma_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "invoice_number" VARCHAR(20) NOT NULL,
    "serial_number" VARCHAR(20),
    "suid" VARCHAR(30),
    "tax_id" VARCHAR(30),
    "reference_number" VARCHAR(30),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(15,2) NOT NULL,
    "discount" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(15,2) NOT NULL,
    "total" DECIMAL(15,2) NOT NULL,
    "buyer_info" JSONB NOT NULL DEFAULT '{}',
    "items" JSONB NOT NULL DEFAULT '[]',
    "moodian_response" JSONB,
    "moodian_sent_at" TIMESTAMP(3),
    "moodian_confirmed_at" TIMESTAMP(3),
    "qr_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "executor_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "specialties" TEXT[],
    "experience_years" INTEGER NOT NULL DEFAULT 0,
    "status" "ExecutorStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "verified_at" TIMESTAMP(3),
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "completed_projects" INTEGER NOT NULL DEFAULT 0,
    "portfolio" JSONB NOT NULL DEFAULT '[]',
    "certificates" JSONB NOT NULL DEFAULT '[]',
    "commission_rate" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "service_areas" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "executor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "executor_id" TEXT,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "address" JSONB NOT NULL,
    "budget_min" DECIMAL(15,2),
    "budget_max" DECIMAL(15,2),
    "final_price" DECIMAL(15,2),
    "status" "ProjectStatus" NOT NULL DEFAULT 'OPEN_FOR_BIDDING',
    "deadline" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "images" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_bids" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "executor_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "description" TEXT,
    "estimated_days" INTEGER,
    "status" "BidStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_bids_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warranties" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "serial_number" VARCHAR(50) NOT NULL,
    "purchase_date" DATE NOT NULL,
    "customer_name" VARCHAR(100) NOT NULL,
    "customer_phone" VARCHAR(20) NOT NULL,
    "customer_email" VARCHAR(255),
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "WarrantyStatus" NOT NULL DEFAULT 'ACTIVE',
    "claims" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warranties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discounts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(15,2) NOT NULL,
    "min_order_amount" DECIMAL(15,2),
    "max_discount" DECIMAL(15,2),
    "usage_limit" INTEGER,
    "usage_count" INTEGER NOT NULL DEFAULT 0,
    "per_user_limit" INTEGER,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "applies_to" TEXT NOT NULL DEFAULT 'ALL',
    "target_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discount_usages" (
    "id" TEXT NOT NULL,
    "discount_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "discount_usages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "resource" VARCHAR(50) NOT NULL,
    "action" VARCHAR(50) NOT NULL,
    "description" TEXT,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "permission_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "user_id" TEXT,
    "action" VARCHAR(50) NOT NULL,
    "resource" VARCHAR(50) NOT NULL,
    "resource_id" TEXT,
    "success" BOOLEAN NOT NULL,
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "old_values" JSONB,
    "new_values" JSONB,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "entity_type" VARCHAR(50) NOT NULL,
    "entity_id" TEXT,
    "user_id" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_metrics" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "metric_name" VARCHAR(100) NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "tags" JSONB NOT NULL DEFAULT '{}',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "carts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "session_id" TEXT,
    "tenant_id" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "carts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cart_items" (
    "id" TEXT NOT NULL,
    "cart_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "options" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cart_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlists" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wishlists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wishlist_items" (
    "id" TEXT NOT NULL,
    "wishlist_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wishlist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "tenant_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "title" VARCHAR(100),
    "body" TEXT,
    "pros" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "images" JSONB NOT NULL DEFAULT '[]',
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "approved_at" TIMESTAMP(3),
    "approved_by" TEXT,
    "helpful_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_helpfuls" (
    "id" TEXT NOT NULL,
    "review_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "is_helpful" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_helpfuls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_fa" VARCHAR(100),
    "slug" VARCHAR(100) NOT NULL,
    "logo_url" TEXT,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "meta_title" VARCHAR(70),
    "meta_description" VARCHAR(160),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_methods" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_fa" VARCHAR(100),
    "code" VARCHAR(50) NOT NULL,
    "base_cost" DECIMAL(15,2) NOT NULL,
    "cost_per_kg" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "free_above" DECIMAL(15,2),
    "min_days" INTEGER NOT NULL DEFAULT 1,
    "max_days" INTEGER NOT NULL DEFAULT 3,
    "max_weight" DECIMAL(10,2),
    "available_areas" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipping_zones" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "provinces" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "cities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rate_multiplier" DECIMAL(5,2) NOT NULL DEFAULT 1,
    "extra_days" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipping_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_groups" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_fa" VARCHAR(100),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attributes" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "name_fa" VARCHAR(100),
    "code" VARCHAR(50) NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "options" JSONB NOT NULL DEFAULT '[]',
    "is_filterable" BOOLEAN NOT NULL DEFAULT false,
    "is_required" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "filename" VARCHAR(255) NOT NULL,
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "size" INTEGER NOT NULL,
    "storage" TEXT NOT NULL DEFAULT 'local',
    "path" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt_text" VARCHAR(255),
    "title" VARCHAR(255),
    "width" INTEGER,
    "height" INTEGER,
    "variants" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spatial_assets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "product_id" TEXT,
    "title" VARCHAR(255) NOT NULL,
    "asset_url" VARCHAR(500) NOT NULL,
    "format" VARCHAR(32),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spatial_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "title_fa" VARCHAR(255),
    "slug" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "content_fa" TEXT,
    "meta_title" VARCHAR(70),
    "meta_description" VARCHAR(160),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banners" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "image_url" TEXT NOT NULL,
    "link_url" TEXT,
    "position" VARCHAR(50) NOT NULL,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "banners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "group" VARCHAR(50) NOT NULL DEFAULT 'general',
    "type" VARCHAR(20) NOT NULL DEFAULT 'string',
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "subject_fa" VARCHAR(255),
    "body_html" TEXT NOT NULL,
    "body_text" TEXT,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "body" VARCHAR(500) NOT NULL,
    "body_fa" VARCHAR(500),
    "pattern_id" VARCHAR(50),
    "variables" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "queue" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "scheduled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "queue_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "failed_jobs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT,
    "queue" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "payload" JSONB NOT NULL,
    "error" TEXT NOT NULL,
    "stack_trace" TEXT,
    "failed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "failed_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateIndex
CREATE INDEX "tenants_status_idx" ON "tenants"("status");

-- CreateIndex
CREATE INDEX "users_tenant_id_is_active_idx" ON "users"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_national_id_idx" ON "users"("national_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "users_tenant_id_phone_key" ON "users"("tenant_id", "phone");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_hash_key" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "user_role_assignments_tenant_id_role_idx" ON "user_role_assignments"("tenant_id", "role");

-- CreateIndex
CREATE INDEX "user_role_assignments_tenant_id_is_active_idx" ON "user_role_assignments"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "user_role_assignments_user_id_tenant_id_role_key" ON "user_role_assignments"("user_id", "tenant_id", "role");

-- CreateIndex
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");

-- CreateIndex
CREATE INDEX "addresses_tenant_id_idx" ON "addresses"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "dealer_profiles_user_id_key" ON "dealer_profiles"("user_id");

-- CreateIndex
CREATE INDEX "dealer_profiles_tenant_id_tier_idx" ON "dealer_profiles"("tenant_id", "tier");

-- CreateIndex
CREATE INDEX "dealer_profiles_tenant_id_is_verified_idx" ON "dealer_profiles"("tenant_id", "is_verified");

-- CreateIndex
CREATE INDEX "cheques_tenant_id_status_idx" ON "cheques"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "cheques_tenant_id_due_date_idx" ON "cheques"("tenant_id", "due_date");

-- CreateIndex
CREATE INDEX "cheques_dealer_id_idx" ON "cheques"("dealer_id");

-- CreateIndex
CREATE INDEX "vendors_tenant_id_is_active_idx" ON "vendors"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "vendors_tenant_id_slug_key" ON "vendors"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "categories_tenant_id_parent_id_idx" ON "categories"("tenant_id", "parent_id");

-- CreateIndex
CREATE INDEX "categories_tenant_id_is_active_idx" ON "categories"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "categories_path_idx" ON "categories"("path");

-- CreateIndex
CREATE UNIQUE INDEX "categories_tenant_id_slug_key" ON "categories"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "products_tenant_id_vendor_id_idx" ON "products"("tenant_id", "vendor_id");

-- CreateIndex
CREATE INDEX "products_tenant_id_category_id_idx" ON "products"("tenant_id", "category_id");

-- CreateIndex
CREATE INDEX "products_tenant_id_status_idx" ON "products"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "products_tenant_id_category_id_price_idx" ON "products"("tenant_id", "category_id", "price");

-- CreateIndex
CREATE INDEX "products_tenant_id_status_created_at_idx" ON "products"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_sku_key" ON "products"("tenant_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_tenant_id_slug_key" ON "products"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "product_tier_prices_tenant_id_tier_idx" ON "product_tier_prices"("tenant_id", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "product_tier_prices_product_id_tier_min_qty_key" ON "product_tier_prices"("product_id", "tier", "min_qty");

-- CreateIndex
CREATE INDEX "inventory_logs_tenant_id_product_id_idx" ON "inventory_logs"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "inventory_logs_tenant_id_created_at_idx" ON "inventory_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_tenant_id_user_id_idx" ON "orders"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "orders_tenant_id_status_idx" ON "orders"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "orders_tenant_id_created_at_idx" ON "orders"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_tenant_id_status_created_at_idx" ON "orders"("tenant_id", "status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "orders_tenant_id_order_number_key" ON "orders"("tenant_id", "order_number");

-- CreateIndex
CREATE INDEX "order_items_tenant_id_order_id_idx" ON "order_items"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "order_items_tenant_id_product_id_idx" ON "order_items"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "order_idempotencies_order_id_idx" ON "order_idempotencies"("order_id");

-- CreateIndex
CREATE INDEX "order_idempotencies_expires_at_idx" ON "order_idempotencies"("expires_at");

-- CreateIndex
CREATE INDEX "order_idempotencies_tenant_id_expires_at_idx" ON "order_idempotencies"("tenant_id", "expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "order_idempotencies_tenant_id_user_id_idempotency_key_key" ON "order_idempotencies"("tenant_id", "user_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "payments_order_id_idx" ON "payments"("order_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_status_idx" ON "payments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "payments_tenant_id_gateway_idx" ON "payments"("tenant_id", "gateway");

-- CreateIndex
CREATE INDEX "payments_tenant_id_created_at_idx" ON "payments"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "payments_gateway_ref_idx" ON "payments"("gateway_ref");

-- CreateIndex
CREATE INDEX "proforma_invoices_tenant_id_dealer_id_idx" ON "proforma_invoices"("tenant_id", "dealer_id");

-- CreateIndex
CREATE INDEX "proforma_invoices_tenant_id_status_idx" ON "proforma_invoices"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "proforma_invoices_tenant_id_invoice_number_key" ON "proforma_invoices"("tenant_id", "invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_suid_key" ON "invoices"("suid");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_status_idx" ON "invoices"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "invoices_tenant_id_created_at_idx" ON "invoices"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "invoices_suid_idx" ON "invoices"("suid");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_tenant_id_invoice_number_key" ON "invoices"("tenant_id", "invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "executor_profiles_user_id_key" ON "executor_profiles"("user_id");

-- CreateIndex
CREATE INDEX "executor_profiles_tenant_id_status_idx" ON "executor_profiles"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "executor_profiles_tenant_id_rating_idx" ON "executor_profiles"("tenant_id", "rating");

-- CreateIndex
CREATE INDEX "projects_tenant_id_status_idx" ON "projects"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "projects_tenant_id_category_idx" ON "projects"("tenant_id", "category");

-- CreateIndex
CREATE INDEX "projects_tenant_id_created_at_idx" ON "projects"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "project_bids_tenant_id_status_idx" ON "project_bids"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "project_bids_project_id_executor_id_key" ON "project_bids"("project_id", "executor_id");

-- CreateIndex
CREATE INDEX "warranties_tenant_id_status_idx" ON "warranties"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "warranties_tenant_id_end_date_idx" ON "warranties"("tenant_id", "end_date");

-- CreateIndex
CREATE INDEX "warranties_customer_phone_idx" ON "warranties"("customer_phone");

-- CreateIndex
CREATE UNIQUE INDEX "warranties_tenant_id_serial_number_key" ON "warranties"("tenant_id", "serial_number");

-- CreateIndex
CREATE INDEX "discounts_tenant_id_is_active_idx" ON "discounts"("tenant_id", "is_active");

-- CreateIndex
CREATE INDEX "discounts_tenant_id_starts_at_ends_at_idx" ON "discounts"("tenant_id", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "discounts_tenant_id_code_key" ON "discounts"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "discount_usages_tenant_id_discount_id_idx" ON "discount_usages"("tenant_id", "discount_id");

-- CreateIndex
CREATE INDEX "discount_usages_tenant_id_user_id_idx" ON "discount_usages"("tenant_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "permissions_resource_action_idx" ON "permissions"("resource", "action");

-- CreateIndex
CREATE INDEX "role_permissions_tenant_id_role_idx" ON "role_permissions"("tenant_id", "role");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_tenant_id_role_permission_id_key" ON "role_permissions"("tenant_id", "role", "permission_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_action_idx" ON "audit_logs"("tenant_id", "action");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_resource_idx" ON "audit_logs"("tenant_id", "resource");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_user_id_idx" ON "audit_logs"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_created_at_idx" ON "audit_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "system_events_tenant_id_event_type_idx" ON "system_events"("tenant_id", "event_type");

-- CreateIndex
CREATE INDEX "system_events_tenant_id_entity_type_entity_id_idx" ON "system_events"("tenant_id", "entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "system_events_tenant_id_occurred_at_idx" ON "system_events"("tenant_id", "occurred_at");

-- CreateIndex
CREATE INDEX "performance_metrics_tenant_id_metric_name_idx" ON "performance_metrics"("tenant_id", "metric_name");

-- CreateIndex
CREATE INDEX "performance_metrics_tenant_id_recorded_at_idx" ON "performance_metrics"("tenant_id", "recorded_at");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_user_id_is_read_idx" ON "notifications"("tenant_id", "user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_tenant_id_user_id_created_at_idx" ON "notifications"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "carts_tenant_id_session_id_idx" ON "carts"("tenant_id", "session_id");

-- CreateIndex
CREATE INDEX "carts_expires_at_idx" ON "carts"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "carts_tenant_id_user_id_key" ON "carts"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "cart_items_tenant_id_idx" ON "cart_items"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cart_id_product_id_key" ON "cart_items"("cart_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_tenant_id_user_id_key" ON "wishlists"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "wishlist_items_tenant_id_idx" ON "wishlist_items"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "wishlist_items_wishlist_id_product_id_key" ON "wishlist_items"("wishlist_id", "product_id");

-- CreateIndex
CREATE INDEX "reviews_tenant_id_product_id_idx" ON "reviews"("tenant_id", "product_id");

-- CreateIndex
CREATE INDEX "reviews_tenant_id_is_approved_idx" ON "reviews"("tenant_id", "is_approved");

-- CreateIndex
CREATE INDEX "reviews_tenant_id_rating_idx" ON "reviews"("tenant_id", "rating");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_product_id_user_id_key" ON "reviews"("product_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "review_helpfuls_review_id_user_id_key" ON "review_helpfuls"("review_id", "user_id");

-- CreateIndex
CREATE INDEX "brands_tenant_id_is_active_idx" ON "brands"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "brands_tenant_id_slug_key" ON "brands"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "shipping_methods_tenant_id_is_active_idx" ON "shipping_methods"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "shipping_methods_tenant_id_code_key" ON "shipping_methods"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "shipping_zones_tenant_id_is_active_idx" ON "shipping_zones"("tenant_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_groups_tenant_id_name_key" ON "attribute_groups"("tenant_id", "name");

-- CreateIndex
CREATE INDEX "attributes_tenant_id_is_filterable_idx" ON "attributes"("tenant_id", "is_filterable");

-- CreateIndex
CREATE UNIQUE INDEX "attributes_tenant_id_code_key" ON "attributes"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "media_tenant_id_idx" ON "media"("tenant_id");

-- CreateIndex
CREATE INDEX "media_tenant_id_mime_type_idx" ON "media"("tenant_id", "mime_type");

-- CreateIndex
CREATE INDEX "spatial_assets_tenant_id_idx" ON "spatial_assets"("tenant_id");

-- CreateIndex
CREATE INDEX "spatial_assets_product_id_idx" ON "spatial_assets"("product_id");

-- CreateIndex
CREATE INDEX "pages_tenant_id_is_published_idx" ON "pages"("tenant_id", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "pages_tenant_id_slug_key" ON "pages"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "banners_tenant_id_position_is_active_idx" ON "banners"("tenant_id", "position", "is_active");

-- CreateIndex
CREATE INDEX "settings_tenant_id_group_idx" ON "settings"("tenant_id", "group");

-- CreateIndex
CREATE UNIQUE INDEX "settings_tenant_id_key_key" ON "settings"("tenant_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_tenant_id_code_key" ON "email_templates"("tenant_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "sms_templates_tenant_id_code_key" ON "sms_templates"("tenant_id", "code");

-- CreateIndex
CREATE INDEX "queue_jobs_queue_status_idx" ON "queue_jobs"("queue", "status");

-- CreateIndex
CREATE INDEX "queue_jobs_scheduled_at_idx" ON "queue_jobs"("scheduled_at");

-- CreateIndex
CREATE INDEX "failed_jobs_queue_idx" ON "failed_jobs"("queue");

-- CreateIndex
CREATE INDEX "failed_jobs_failed_at_idx" ON "failed_jobs"("failed_at");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role_assignments" ADD CONSTRAINT "user_role_assignments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dealer_profiles" ADD CONSTRAINT "dealer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "vendors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_tier_prices" ADD CONSTRAINT "product_tier_prices_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_idempotencies" ADD CONSTRAINT "order_idempotencies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_idempotencies" ADD CONSTRAINT "order_idempotencies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_idempotencies" ADD CONSTRAINT "order_idempotencies_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proforma_invoices" ADD CONSTRAINT "proforma_invoices_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "dealer_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "executor_profiles" ADD CONSTRAINT "executor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_executor_id_fkey" FOREIGN KEY ("executor_id") REFERENCES "executor_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_bids" ADD CONSTRAINT "project_bids_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_bids" ADD CONSTRAINT "project_bids_executor_id_fkey" FOREIGN KEY ("executor_id") REFERENCES "executor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warranties" ADD CONSTRAINT "warranties_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discount_usages" ADD CONSTRAINT "discount_usages_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "discounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_fkey" FOREIGN KEY ("cart_id") REFERENCES "carts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_wishlist_id_fkey" FOREIGN KEY ("wishlist_id") REFERENCES "wishlists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attributes" ADD CONSTRAINT "attributes_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "attribute_groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spatial_assets" ADD CONSTRAINT "spatial_assets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spatial_assets" ADD CONSTRAINT "spatial_assets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

