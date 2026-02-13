-- ═══════════════════════════════════════════════════════════════════════════
-- NextGen Marketplace 2026 - PostgreSQL 16 Complete Database Setup
-- ═══════════════════════════════════════════════════════════════════════════
-- Enterprise multi-tenant B2B/B2C marketplace with advanced features
-- Run this after docker-compose up with proper admin privileges

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. EXTENSIONS & SETUP
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Set timezone
SET TIMEZONE TO 'Asia/Tehran';

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. ENUMS (Domain Types)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TYPE tenant_status AS ENUM ('ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE user_role AS ENUM ('CUSTOMER', 'DEALER', 'VENDOR', 'EXECUTOR', 'ADMIN', 'SUPER_ADMIN');
CREATE TYPE dealer_tier AS ENUM ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');
CREATE TYPE product_status AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'DISCONTINUED');
CREATE TYPE order_status AS ENUM ('DRAFT', 'PENDING_PAYMENT', 'PAID', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUNDED');
CREATE TYPE payment_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'REFUNDED', 'PARTIALLY_REFUNDED');
CREATE TYPE payment_gateway AS ENUM ('ZARINPAL', 'MELLAT', 'SAMAN', 'WALLET', 'CREDIT', 'CHEQUE');
CREATE TYPE invoice_status AS ENUM ('DRAFT', 'ISSUED', 'SENT_TO_MOODIAN', 'MOODIAN_CONFIRMED', 'MOODIAN_REJECTED', 'CANCELLED');
CREATE TYPE executor_status AS ENUM ('PENDING_VERIFICATION', 'VERIFIED', 'SUSPENDED', 'BLACKLISTED');
CREATE TYPE project_status AS ENUM ('OPEN_FOR_BIDDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DISPUTED');
CREATE TYPE cheque_status AS ENUM ('PENDING', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'CANCELLED', 'RETURNED');
CREATE TYPE warranty_status AS ENUM ('ACTIVE', 'EXPIRED', 'VOIDED', 'CLAIMED');
CREATE TYPE proforma_status AS ENUM ('DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'CONVERTED', 'EXPIRED');
CREATE TYPE inventory_log_type AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'RESERVED', 'RELEASED', 'DAMAGED', 'RETURNED');
CREATE TYPE discount_type AS ENUM ('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING', 'BUY_X_GET_Y');
CREATE TYPE bid_status AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. CORE TABLES - TENANT & ISOLATION
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug VARCHAR(63) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    name_fa VARCHAR(255),
    status tenant_status DEFAULT 'ACTIVE',
    tax_id VARCHAR(20),
    economic_code VARCHAR(20),
    settings JSONB DEFAULT '{}',
    features JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_slug ON tenants(slug);

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. AUTHENTICATION & USERS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    national_id VARCHAR(10),
    password_hash VARCHAR(255) NOT NULL,
    totp_secret VARCHAR(255),
    totp_enabled BOOLEAN DEFAULT FALSE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    first_name_fa VARCHAR(100),
    last_name_fa VARCHAR(100),
    avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    last_login_at TIMESTAMP,
    last_login_ip VARCHAR(45),
    failed_attempts INT DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, email),
    UNIQUE(tenant_id, phone)
);

CREATE INDEX idx_users_tenant_id ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_national_id ON users(national_id);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_tenant_active ON users(tenant_id, is_active);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    device_info VARCHAR(500),
    ip_address VARCHAR(45),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_sessions_token ON sessions(token_hash);

CREATE TABLE user_role_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    role user_role NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    assigned_by VARCHAR(255),
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(user_id, tenant_id, role)
);

CREATE INDEX idx_user_roles_tenant_role ON user_role_assignments(tenant_id, role);
CREATE INDEX idx_user_roles_tenant_active ON user_role_assignments(tenant_id, is_active);

CREATE TABLE addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    label VARCHAR(50),
    province VARCHAR(50) NOT NULL,
    city VARCHAR(50) NOT NULL,
    district VARCHAR(100),
    street VARCHAR(255) NOT NULL,
    postal_code VARCHAR(10) NOT NULL,
    unit VARCHAR(20),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_addresses_user_id ON addresses(user_id);
CREATE INDEX idx_addresses_tenant_id ON addresses(tenant_id);
CREATE INDEX idx_addresses_is_default ON addresses(is_default);

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. B2B - DEALER SYSTEM
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE dealer_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    company_name VARCHAR(255) NOT NULL,
    company_name_fa VARCHAR(255),
    tax_id VARCHAR(20),
    economic_code VARCHAR(20),
    tier dealer_tier DEFAULT 'BRONZE',
    credit_limit DECIMAL(15, 2) DEFAULT 0,
    credit_used DECIMAL(15, 2) DEFAULT 0,
    base_discount DECIMAL(5, 2) DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    verified_by VARCHAR(255),
    documents JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_dealer_profiles_tenant_tier ON dealer_profiles(tenant_id, tier);
CREATE INDEX idx_dealer_profiles_tenant_verified ON dealer_profiles(tenant_id, is_verified);

CREATE TABLE cheques (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id UUID NOT NULL REFERENCES dealer_profiles(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    bank_name VARCHAR(100) NOT NULL,
    branch_code VARCHAR(20),
    account_number VARCHAR(30),
    cheque_number VARCHAR(20) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    due_date DATE NOT NULL,
    status cheque_status DEFAULT 'PENDING',
    cleared_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cheques_tenant_status ON cheques(tenant_id, status);
CREATE INDEX idx_cheques_tenant_due_date ON cheques(tenant_id, due_date);
CREATE INDEX idx_cheques_dealer_id ON cheques(dealer_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. VENDORS & CATALOG
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE vendors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    name_fa VARCHAR(255),
    slug VARCHAR(100) NOT NULL,
    tax_id VARCHAR(20),
    economic_code VARCHAR(20),
    email VARCHAR(255),
    phone VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP,
    commission_rate DECIMAL(5, 2) DEFAULT 10,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_vendors_tenant_active ON vendors(tenant_id, is_active);
CREATE INDEX idx_vendors_tenant_slug ON vendors(tenant_id, slug);

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    parent_id UUID REFERENCES categories(id),
    name VARCHAR(100) NOT NULL,
    name_fa VARCHAR(100),
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    level INT DEFAULT 0,
    path VARCHAR(255) DEFAULT '/',
    image_url VARCHAR(500),
    icon VARCHAR(100),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_categories_tenant_parent ON categories(tenant_id, parent_id);
CREATE INDEX idx_categories_tenant_active ON categories(tenant_id, is_active);
CREATE INDEX idx_categories_path ON categories(path);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    vendor_id UUID NOT NULL REFERENCES vendors(id),
    category_id UUID REFERENCES categories(id),
    sku VARCHAR(50) NOT NULL,
    barcode VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    name_fa VARCHAR(255),
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    description_fa TEXT,
    price DECIMAL(15, 2) NOT NULL,
    compare_price DECIMAL(15, 2),
    cost_price DECIMAL(15, 2),
    tax_rate DECIMAL(5, 2) DEFAULT 9,
    is_tax_exempt BOOLEAN DEFAULT FALSE,
    stock INT DEFAULT 0,
    reserved_stock INT DEFAULT 0,
    low_stock_threshold INT DEFAULT 5,
    status product_status DEFAULT 'DRAFT',
    images JSONB DEFAULT '[]',
    model_3d_url VARCHAR(500),
    meta_title VARCHAR(70),
    meta_description VARCHAR(160),
    search_vector TEXT,
    attributes JSONB DEFAULT '{}',
    specifications JSONB DEFAULT '[]',
    warranty_months INT,
    sort_order INT DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, sku),
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_products_tenant_vendor ON products(tenant_id, vendor_id);
CREATE INDEX idx_products_tenant_category ON products(tenant_id, category_id);
CREATE INDEX idx_products_tenant_status ON products(tenant_id, status);
CREATE INDEX idx_products_tenant_price ON products(tenant_id, category_id, price);
CREATE INDEX idx_products_search ON products USING gin(to_tsvector('persian', name || ' ' || COALESCE(description, '')));

CREATE TABLE product_tier_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    tier dealer_tier NOT NULL,
    price DECIMAL(15, 2) NOT NULL,
    min_qty INT DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, tier, min_qty)
);

CREATE INDEX idx_product_tier_prices_tenant_tier ON product_tier_prices(tenant_id, tier);

CREATE TABLE inventory_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    type inventory_log_type NOT NULL,
    quantity INT NOT NULL,
    reference VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

CREATE INDEX idx_inventory_logs_tenant_product ON inventory_logs(tenant_id, product_id);
CREATE INDEX idx_inventory_logs_tenant_created ON inventory_logs(tenant_id, created_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. ORDERS & PAYMENTS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    order_number VARCHAR(20) NOT NULL,
    status order_status DEFAULT 'DRAFT',
    subtotal DECIMAL(15, 2) NOT NULL,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    shipping_amount DECIMAL(15, 2) DEFAULT 0,
    total DECIMAL(15, 2) NOT NULL,
    shipping_address JSONB,
    shipping_method VARCHAR(100),
    tracking_number VARCHAR(255),
    customer_note TEXT,
    admin_note TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, order_number)
);

CREATE INDEX idx_orders_tenant_user ON orders(tenant_id, user_id);
CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX idx_orders_tenant_created ON orders(tenant_id, created_at);
CREATE INDEX idx_orders_tenant_status_created ON orders(tenant_id, status, created_at);

CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    product_name VARCHAR(255) NOT NULL,
    product_sku VARCHAR(50) NOT NULL,
    quantity INT NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    discount DECIMAL(15, 2) DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    total DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_tenant_order ON order_items(tenant_id, order_id);
CREATE INDEX idx_order_items_tenant_product ON order_items(tenant_id, product_id);

CREATE TABLE order_idempotencies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    order_id UUID REFERENCES orders(id),
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response JSONB,
    status VARCHAR(32) DEFAULT 'IN_PROGRESS',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(tenant_id, user_id, idempotency_key)
);

CREATE INDEX idx_order_idempotencies_order_id ON order_idempotencies(order_id);
CREATE INDEX idx_order_idempotencies_expires_at ON order_idempotencies(expires_at);
CREATE INDEX idx_order_idempotencies_tenant_expires ON order_idempotencies(tenant_id, expires_at);

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    amount DECIMAL(15, 2) NOT NULL,
    gateway payment_gateway NOT NULL,
    gateway_ref VARCHAR(100),
    gateway_track VARCHAR(100),
    status payment_status DEFAULT 'PENDING',
    verified_at TIMESTAMP,
    card_pan VARCHAR(20),
    metadata JSONB DEFAULT '{}',
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_tenant_status ON payments(tenant_id, status);
CREATE INDEX idx_payments_tenant_gateway ON payments(tenant_id, gateway);
CREATE INDEX idx_payments_tenant_created ON payments(tenant_id, created_at);
CREATE INDEX idx_payments_gateway_ref ON payments(gateway_ref);

CREATE TABLE proforma_invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dealer_id UUID NOT NULL REFERENCES dealer_profiles(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    invoice_number VARCHAR(20) NOT NULL,
    subtotal DECIMAL(15, 2) NOT NULL,
    discount DECIMAL(15, 2) DEFAULT 0,
    tax DECIMAL(15, 2) DEFAULT 0,
    total DECIMAL(15, 2) NOT NULL,
    items JSONB DEFAULT '[]',
    status proforma_status DEFAULT 'DRAFT',
    valid_until TIMESTAMP NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, invoice_number)
);

CREATE INDEX idx_proforma_invoices_tenant_dealer ON proforma_invoices(tenant_id, dealer_id);
CREATE INDEX idx_proforma_invoices_tenant_status ON proforma_invoices(tenant_id, status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. INVOICES & MOODIAN INTEGRATION
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    invoice_number VARCHAR(20) NOT NULL,
    serial_number VARCHAR(20),
    suid VARCHAR(30) UNIQUE,
    tax_id VARCHAR(30),
    reference_number VARCHAR(30),
    status invoice_status DEFAULT 'DRAFT',
    subtotal DECIMAL(15, 2) NOT NULL,
    discount DECIMAL(15, 2) DEFAULT 0,
    tax_amount DECIMAL(15, 2) NOT NULL,
    total DECIMAL(15, 2) NOT NULL,
    buyer_info JSONB DEFAULT '{}',
    items JSONB DEFAULT '[]',
    moodian_response JSONB,
    moodian_sent_at TIMESTAMP,
    moodian_confirmed_at TIMESTAMP,
    qr_code TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, invoice_number)
);

CREATE INDEX idx_invoices_tenant_status ON invoices(tenant_id, status);
CREATE INDEX idx_invoices_tenant_created ON invoices(tenant_id, created_at);
CREATE INDEX idx_invoices_suid ON invoices(suid);

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. EXECUTOR ECOSYSTEM
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE executor_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    specialties VARCHAR(255)[] DEFAULT '{}',
    experience_years INT DEFAULT 0,
    status executor_status DEFAULT 'PENDING_VERIFICATION',
    verified_at TIMESTAMP,
    rating DECIMAL(3, 2) DEFAULT 0,
    total_reviews INT DEFAULT 0,
    completed_projects INT DEFAULT 0,
    portfolio JSONB DEFAULT '[]',
    certificates JSONB DEFAULT '[]',
    commission_rate DECIMAL(5, 2) DEFAULT 15,
    service_areas JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_executor_profiles_tenant_status ON executor_profiles(tenant_id, status);
CREATE INDEX idx_executor_profiles_tenant_rating ON executor_profiles(tenant_id, rating);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID NOT NULL REFERENCES users(id),
    executor_id UUID REFERENCES executor_profiles(id),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100) NOT NULL,
    address JSONB NOT NULL,
    budget_min DECIMAL(15, 2),
    budget_max DECIMAL(15, 2),
    final_price DECIMAL(15, 2),
    status project_status DEFAULT 'OPEN_FOR_BIDDING',
    deadline TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    images JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_projects_tenant_status ON projects(tenant_id, status);
CREATE INDEX idx_projects_tenant_category ON projects(tenant_id, category);
CREATE INDEX idx_projects_tenant_created ON projects(tenant_id, created_at);

CREATE TABLE project_bids (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    executor_id UUID NOT NULL REFERENCES executor_profiles(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    amount DECIMAL(15, 2) NOT NULL,
    description TEXT,
    estimated_days INT,
    status bid_status DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, executor_id)
);

CREATE INDEX idx_project_bids_tenant_status ON project_bids(tenant_id, status);

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. WARRANTY & AFTER-SALES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE warranties (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    serial_number VARCHAR(50) NOT NULL,
    purchase_date DATE NOT NULL,
    customer_name VARCHAR(100) NOT NULL,
    customer_phone VARCHAR(20) NOT NULL,
    customer_email VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status warranty_status DEFAULT 'ACTIVE',
    claims JSONB DEFAULT '[]',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, serial_number)
);

CREATE INDEX idx_warranties_tenant_status ON warranties(tenant_id, status);
CREATE INDEX idx_warranties_tenant_end_date ON warranties(tenant_id, end_date);
CREATE INDEX idx_warranties_customer_phone ON warranties(customer_phone);

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. PROMOTIONS & DISCOUNTS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE discounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    type discount_type NOT NULL,
    value DECIMAL(15, 2) NOT NULL,
    min_order_amount DECIMAL(15, 2),
    max_discount DECIMAL(15, 2),
    usage_limit INT,
    usage_count INT DEFAULT 0,
    per_user_limit INT,
    starts_at TIMESTAMP NOT NULL,
    ends_at TIMESTAMP NOT NULL,
    applies_to VARCHAR(20) DEFAULT 'ALL',
    target_ids UUID[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_discounts_tenant_active ON discounts(tenant_id, is_active);
CREATE INDEX idx_discounts_tenant_dates ON discounts(tenant_id, starts_at, ends_at);

CREATE TABLE discount_usages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    discount_id UUID NOT NULL REFERENCES discounts(id),
    user_id UUID NOT NULL REFERENCES users(id),
    order_id UUID NOT NULL REFERENCES orders(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    amount DECIMAL(15, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_discount_usages_tenant_discount ON discount_usages(tenant_id, discount_id);
CREATE INDEX idx_discount_usages_tenant_user ON discount_usages(tenant_id, user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. REVIEWS & RATINGS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id),
    user_id UUID NOT NULL REFERENCES users(id),
    order_id UUID REFERENCES orders(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(100),
    body TEXT,
    pros VARCHAR(255)[] DEFAULT '{}',
    cons VARCHAR(255)[] DEFAULT '{}',
    images JSONB DEFAULT '[]',
    is_approved BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    approved_at TIMESTAMP,
    approved_by VARCHAR(255),
    helpful_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, user_id)
);

CREATE INDEX idx_reviews_tenant_product ON reviews(tenant_id, product_id);
CREATE INDEX idx_reviews_tenant_approved ON reviews(tenant_id, is_approved);
CREATE INDEX idx_reviews_tenant_rating ON reviews(tenant_id, rating);

CREATE TABLE review_helpfuls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID NOT NULL REFERENCES reviews(id),
    user_id UUID NOT NULL REFERENCES users(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(review_id, user_id)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. SHIPPING & LOGISTICS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE shipping_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    name_fa VARCHAR(100),
    code VARCHAR(50) NOT NULL,
    base_cost DECIMAL(15, 2) NOT NULL,
    cost_per_kg DECIMAL(15, 2) DEFAULT 0,
    free_above DECIMAL(15, 2),
    min_days INT DEFAULT 1,
    max_days INT DEFAULT 3,
    max_weight DECIMAL(10, 2),
    available_areas JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_shipping_methods_tenant_active ON shipping_methods(tenant_id, is_active);

CREATE TABLE shipping_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    provinces VARCHAR(100)[] DEFAULT '{}',
    cities VARCHAR(100)[] DEFAULT '{}',
    rate_multiplier DECIMAL(5, 2) DEFAULT 1,
    extra_days INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shipping_zones_tenant_active ON shipping_zones(tenant_id, is_active);

-- ═══════════════════════════════════════════════════════════════════════════
-- 14. CART & WISHLIST
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(255),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    UNIQUE(tenant_id, user_id)
);

CREATE INDEX idx_carts_tenant_session ON carts(tenant_id, session_id);
CREATE INDEX idx_carts_expires_at ON carts(expires_at);

CREATE TABLE cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    quantity INT DEFAULT 1,
    options JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cart_id, product_id)
);

CREATE INDEX idx_cart_items_tenant ON cart_items(tenant_id);

CREATE TABLE wishlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, user_id)
);

CREATE TABLE wishlist_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wishlist_id UUID NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(wishlist_id, product_id)
);

CREATE INDEX idx_wishlist_items_tenant ON wishlist_items(tenant_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 15. SECURITY & AUDIT
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    description TEXT,
    conditions JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_permissions_resource_action ON permissions(resource, action);

CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    role user_role NOT NULL,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, role, permission_id)
);

CREATE INDEX idx_role_permissions_tenant_role ON role_permissions(tenant_id, role);

CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    action VARCHAR(50) NOT NULL,
    resource VARCHAR(50) NOT NULL,
    resource_id VARCHAR(255),
    success BOOLEAN NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    old_values JSONB,
    new_values JSONB,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_tenant_action ON audit_logs(tenant_id, action);
CREATE INDEX idx_audit_logs_tenant_resource ON audit_logs(tenant_id, resource);
CREATE INDEX idx_audit_logs_tenant_user ON audit_logs(tenant_id, user_id);
CREATE INDEX idx_audit_logs_tenant_created ON audit_logs(tenant_id, created_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- 16. MONITORING & ANALYTICS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE system_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    event_type VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255),
    user_id VARCHAR(255),
    data JSONB DEFAULT '{}',
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_system_events_tenant_type ON system_events(tenant_id, event_type);
CREATE INDEX idx_system_events_tenant_entity ON system_events(tenant_id, entity_type, entity_id);
CREATE INDEX idx_system_events_tenant_created ON system_events(tenant_id, occurred_at);

CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    metric_name VARCHAR(100) NOT NULL,
    value FLOAT NOT NULL,
    tags JSONB DEFAULT '{}',
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_performance_metrics_tenant_name ON performance_metrics(tenant_id, metric_name);
CREATE INDEX idx_performance_metrics_tenant_recorded ON performance_metrics(tenant_id, recorded_at);

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    data JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_tenant_user_read ON notifications(tenant_id, user_id, is_read);
CREATE INDEX idx_notifications_tenant_user_created ON notifications(tenant_id, user_id, created_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- 17. SETTINGS & CONFIGURATION
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    key VARCHAR(100) NOT NULL,
    value JSONB NOT NULL,
    "group" VARCHAR(50) DEFAULT 'general',
    type VARCHAR(20) DEFAULT 'string',
    is_public BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, key)
);

CREATE INDEX idx_settings_tenant_group ON settings(tenant_id, "group");

CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    subject_fa VARCHAR(255),
    body_html TEXT NOT NULL,
    body_text TEXT,
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);

CREATE TABLE sms_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    body VARCHAR(500) NOT NULL,
    body_fa VARCHAR(500),
    pattern_id VARCHAR(50),
    variables JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);

-- ═══════════════════════════════════════════════════════════════════════════
-- 18. QUEUE & JOBS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE queue_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    queue VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    scheduled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_queue_jobs_queue_status ON queue_jobs(queue, status);
CREATE INDEX idx_queue_jobs_scheduled_at ON queue_jobs(scheduled_at);

CREATE TABLE failed_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID REFERENCES tenants(id),
    queue VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    error TEXT NOT NULL,
    stack_trace TEXT,
    failed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_failed_jobs_queue ON failed_jobs(queue);
CREATE INDEX idx_failed_jobs_failed_at ON failed_jobs(failed_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- 19. MEDIA & ASSETS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    size INT NOT NULL,
    storage VARCHAR(50) DEFAULT 'local',
    path VARCHAR(500) NOT NULL,
    url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    title VARCHAR(255),
    width INT,
    height INT,
    variants JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255)
);

CREATE INDEX idx_media_tenant ON media(tenant_id);
CREATE INDEX idx_media_tenant_mime ON media(tenant_id, mime_type);

CREATE TABLE spatial_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    product_id UUID REFERENCES products(id),
    title VARCHAR(255) NOT NULL,
    asset_url VARCHAR(500) NOT NULL,
    format VARCHAR(32),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_spatial_assets_tenant ON spatial_assets(tenant_id);
CREATE INDEX idx_spatial_assets_product ON spatial_assets(product_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- 20. CONTENT PAGES & BANNERS
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    title VARCHAR(255) NOT NULL,
    title_fa VARCHAR(255),
    slug VARCHAR(255) NOT NULL,
    content TEXT,
    content_fa TEXT,
    meta_title VARCHAR(70),
    meta_description VARCHAR(160),
    is_published BOOLEAN DEFAULT FALSE,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_pages_tenant_published ON pages(tenant_id, is_published);

CREATE TABLE banners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    title VARCHAR(255) NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    link_url VARCHAR(500),
    position VARCHAR(50) NOT NULL,
    starts_at TIMESTAMP,
    ends_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_banners_tenant_position_active ON banners(tenant_id, position, is_active);

-- ═══════════════════════════════════════════════════════════════════════════
-- 21. BRANDS & ATTRIBUTES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    name_fa VARCHAR(100),
    slug VARCHAR(100) NOT NULL,
    logo_url VARCHAR(500),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    meta_title VARCHAR(70),
    meta_description VARCHAR(160),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, slug)
);

CREATE INDEX idx_brands_tenant_active ON brands(tenant_id, is_active);

CREATE TABLE attribute_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    name_fa VARCHAR(100),
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, name)
);

CREATE TABLE attributes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    group_id UUID NOT NULL REFERENCES attribute_groups(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(100) NOT NULL,
    name_fa VARCHAR(100),
    code VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL,
    options JSONB DEFAULT '[]',
    is_filterable BOOLEAN DEFAULT FALSE,
    is_required BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(tenant_id, code)
);

CREATE INDEX idx_attributes_tenant_filterable ON attributes(tenant_id, is_filterable);

-- ═══════════════════════════════════════════════════════════════════════════
-- VIEWS & MATERIALIZED VIEWS
-- ═══════════════════════════════════════════════════════════════════════════

-- Top products by sales
CREATE MATERIALIZED VIEW top_products AS
SELECT 
    p.id,
    p.tenant_id,
    p.name,
    COUNT(oi.id) as sales_count,
    SUM(oi.total) as total_revenue,
    AVG(r.rating) as avg_rating
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN reviews r ON p.id = r.product_id
GROUP BY p.id, p.tenant_id, p.name
ORDER BY sales_count DESC;

CREATE INDEX idx_top_products_tenant ON top_products(tenant_id);

-- Order statistics by period
CREATE MATERIALIZED VIEW order_statistics AS
SELECT 
    DATE_TRUNC('day', o.created_at) as order_date,
    o.tenant_id,
    COUNT(o.id) as total_orders,
    SUM(o.total) as total_revenue,
    AVG(o.total) as avg_order_value,
    COUNT(DISTINCT o.user_id) as unique_customers
FROM orders o
WHERE o.status = 'COMPLETED'
GROUP BY DATE_TRUNC('day', o.created_at), o.tenant_id;

-- ═══════════════════════════════════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all relevant tables
DO $$ 
DECLARE
    t TEXT;
BEGIN
    FOR t IN 
        SELECT tablename FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename NOT LIKE '%_log%'
        AND tablename NOT LIKE 'pg_%'
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = t AND column_name = 'updated_at') THEN
            EXECUTE format('CREATE TRIGGER %I_updated_at_trigger BEFORE UPDATE ON %I 
                          FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', 
                          t, t);
        END IF;
    END LOOP;
END $$;

-- Audit trigger for order changes
CREATE OR REPLACE FUNCTION audit_order_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        tenant_id, user_id, action, resource, resource_id,
        success, old_values, new_values, created_at
    ) VALUES (
        NEW.tenant_id,
        current_setting('app.user_id')::UUID,
        TG_OP,
        'order',
        NEW.id::TEXT,
        TRUE,
        row_to_json(OLD),
        row_to_json(NEW),
        CURRENT_TIMESTAMP
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER orders_audit_trigger
AFTER INSERT OR UPDATE OR DELETE ON orders
FOR EACH ROW EXECUTE FUNCTION audit_order_changes();

-- ═══════════════════════════════════════════════════════════════════════════
-- PERMISSIONS SEED DATA
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO permissions (name, resource, action, description) VALUES
    ('view_products', 'products', 'read', 'View product catalog'),
    ('create_product', 'products', 'create', 'Create new product'),
    ('edit_product', 'products', 'update', 'Edit existing product'),
    ('delete_product', 'products', 'delete', 'Delete product'),
    
    ('view_orders', 'orders', 'read', 'View orders'),
    ('create_order', 'orders', 'create', 'Create new order'),
    ('edit_order', 'orders', 'update', 'Edit order'),
    ('cancel_order', 'orders', 'delete', 'Cancel order'),
    
    ('view_payments', 'payments', 'read', 'View payment history'),
    ('refund_payment', 'payments', 'update', 'Process refund'),
    
    ('view_users', 'users', 'read', 'View user list'),
    ('edit_user', 'users', 'update', 'Edit user details'),
    ('manage_roles', 'users', 'admin', 'Manage user roles'),
    
    ('view_reports', 'reports', 'read', 'View analytics'),
    ('export_data', 'reports', 'export', 'Export data'),
    
    ('manage_settings', 'settings', 'admin', 'Manage system settings'),
    ('view_audit_logs', 'audit', 'read', 'View audit logs')
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- SUMMARY STATISTICS FUNCTION
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_tenant_stats(p_tenant_id UUID)
RETURNS TABLE (
    total_users BIGINT,
    total_products BIGINT,
    total_orders BIGINT,
    total_revenue NUMERIC,
    avg_order_value NUMERIC,
    total_customers BIGINT,
    active_dealers BIGINT,
    pending_invoices BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(COUNT(DISTINCT u.id), 0)::BIGINT,
        COALESCE(COUNT(DISTINCT p.id), 0)::BIGINT,
        COALESCE(COUNT(DISTINCT o.id), 0)::BIGINT,
        COALESCE(SUM(o.total), 0)::NUMERIC,
        COALESCE(AVG(o.total), 0)::NUMERIC,
        COALESCE(COUNT(DISTINCT o.user_id), 0)::BIGINT,
        COALESCE(COUNT(DISTINCT CASE WHEN dp.is_verified THEN dp.id END), 0)::BIGINT,
        COALESCE(COUNT(DISTINCT CASE WHEN i.status = 'DRAFT' THEN i.id END), 0)::BIGINT
    FROM tenants t
    LEFT JOIN users u ON t.id = u.tenant_id
    LEFT JOIN products p ON t.id = p.tenant_id
    LEFT JOIN orders o ON t.id = o.tenant_id AND o.status = 'COMPLETED'
    LEFT JOIN dealer_profiles dp ON t.id = dp.tenant_id
    LEFT JOIN invoices i ON t.id = i.tenant_id
    WHERE t.id = p_tenant_id;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- COLUMN COMMENTS & DOCUMENTATION
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON TABLE tenants IS 'Multi-tenant isolation - each company has separate data';
COMMENT ON TABLE users IS 'User accounts with authentication & verification';
COMMENT ON TABLE orders IS 'Customer orders with full order lifecycle';
COMMENT ON TABLE products IS 'Product catalog with inventory management';
COMMENT ON TABLE dealer_profiles IS 'B2B dealer/wholesale buyers with credit limits';
COMMENT ON TABLE invoices IS 'Tax invoices with Moodian authority integration';
COMMENT ON TABLE executor_profiles IS 'Service contractors/installers for project execution';

-- ═══════════════════════════════════════════════════════════════════════════
-- FINAL VERIFICATION
-- ═══════════════════════════════════════════════════════════════════════════

-- Count all tables
SELECT 'Database setup complete!' as status,
       (SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE') as total_tables,
       (SELECT COUNT(*) FROM information_schema.views 
        WHERE table_schema = 'public') as total_views;
