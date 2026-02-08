-- ═══════════════════════════════════════════════════════════════════════════
-- INDEX ROLLBACK SCRIPT - Emergency Removal
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: Remove all optimization indexes if performance degrades
-- Execution: CONCURRENTLY to avoid locks during rollback
-- Usage: Execute in emergency situations only
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable timing for rollback measurement
\timing on

-- ───────────────────────────────────────────────────────────────────────────
-- CRITICAL PATH 1: User Authentication & Session Management
-- ───────────────────────────────────────────────────────────────────────────

DROP INDEX CONCURRENTLY IF EXISTS idx_users_auth_covering;
DROP INDEX CONCURRENTLY IF EXISTS idx_sessions_token_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_users_role_org_active;

-- ───────────────────────────────────────────────────────────────────────────
-- CRITICAL PATH 2: Product Catalog & Search
-- ───────────────────────────────────────────────────────────────────────────

DROP INDEX CONCURRENTLY IF EXISTS idx_products_catalog_covering;
DROP INDEX CONCURRENTLY IF EXISTS idx_products_search_unique;
DROP INDEX CONCURRENTLY IF EXISTS idx_products_vendor_dashboard;
DROP INDEX CONCURRENTLY IF EXISTS idx_categories_tree_active;

-- ───────────────────────────────────────────────────────────────────────────
-- CRITICAL PATH 3: Order Processing & Financial Transactions
-- ───────────────────────────────────────────────────────────────────────────

DROP INDEX CONCURRENTLY IF EXISTS idx_orders_customer_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_vendor_processing;
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_wallet_type;
DROP INDEX CONCURRENTLY IF EXISTS idx_order_items_order_product;

-- ───────────────────────────────────────────────────────────────────────────
-- CRITICAL PATH 4: B2B & Pricing Engine
-- ───────────────────────────────────────────────────────────────────────────

DROP INDEX CONCURRENTLY IF EXISTS idx_product_prices_b2b_lookup;
DROP INDEX CONCURRENTLY IF EXISTS idx_price_lists_org_active;
DROP INDEX CONCURRENTLY IF EXISTS idx_b2b_relations_supplier_active;

-- ───────────────────────────────────────────────────────────────────────────
-- CRITICAL PATH 5: Inventory & Stock Management
-- ───────────────────────────────────────────────────────────────────────────

DROP INDEX CONCURRENTLY IF EXISTS idx_products_stock_alerts;
DROP INDEX CONCURRENTLY IF EXISTS idx_inventory_logs_product_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_product_variants_stock;

-- ───────────────────────────────────────────────────────────────────────────
-- CRITICAL PATH 6: Reviews & Ratings
-- ───────────────────────────────────────────────────────────────────────────

DROP INDEX CONCURRENTLY IF EXISTS idx_reviews_product_approved;
DROP INDEX CONCURRENTLY IF EXISTS idx_reviews_user_status;

-- ───────────────────────────────────────────────────────────────────────────
-- CRITICAL PATH 7: Cart & Wishlist Operations
-- ───────────────────────────────────────────────────────────────────────────

DROP INDEX CONCURRENTLY IF EXISTS idx_cart_items_cart_product;
DROP INDEX CONCURRENTLY IF EXISTS idx_wishlist_user_product;

-- ───────────────────────────────────────────────────────────────────────────
-- CRITICAL PATH 8: Payment & Settlement Processing
-- ───────────────────────────────────────────────────────────────────────────

DROP INDEX CONCURRENTLY IF EXISTS idx_payment_transactions_user_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_payment_transactions_authority;
DROP INDEX CONCURRENTLY IF EXISTS idx_settlements_vendor_status;

-- ───────────────────────────────────────────────────────────────────────────
-- CRITICAL PATH 9: Executor & Project Management
-- ───────────────────────────────────────────────────────────────────────────

DROP INDEX CONCURRENTLY IF EXISTS idx_executor_profiles_available;
DROP INDEX CONCURRENTLY IF EXISTS idx_projects_executor_status;
DROP INDEX CONCURRENTLY IF EXISTS idx_project_quotes_status_date;

-- ───────────────────────────────────────────────────────────────────────────
-- CRITICAL PATH 10: Audit & Compliance
-- ───────────────────────────────────────────────────────────────────────────

DROP INDEX CONCURRENTLY IF EXISTS idx_audit_logs_tenant_action_date;
DROP INDEX CONCURRENTLY IF EXISTS idx_otp_verifications_mobile_active;

-- ───────────────────────────────────────────────────────────────────────────
-- ADVANCED OPTIMIZATION: Partial Indexes
-- ───────────────────────────────────────────────────────────────────────────

DROP INDEX CONCURRENTLY IF EXISTS idx_sessions_active_only;
DROP INDEX CONCURRENTLY IF EXISTS idx_orders_recent_hot;
DROP INDEX CONCURRENTLY IF EXISTS idx_transactions_high_value;

-- ───────────────────────────────────────────────────────────────────────────
-- FULL-TEXT SEARCH OPTIMIZATION
-- ───────────────────────────────────────────────────────────────────────────

DROP INDEX CONCURRENTLY IF EXISTS idx_products_fts;
DROP INDEX CONCURRENTLY IF EXISTS idx_organizations_fts;

-- ═══════════════════════════════════════════════════════════════════════════
-- ROLLBACK COMPLETION
-- ═══════════════════════════════════════════════════════════════════════════

-- Update table statistics after index removal
ANALYZE users, products, orders, transactions, reviews, cart_items;

-- Report completion
SELECT 
    'INDEX ROLLBACK COMPLETED' as status,
    NOW() as completed_at,
    'All optimization indexes removed successfully' as message;