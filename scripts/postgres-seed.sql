-- ═══════════════════════════════════════════════════════════════════════════
-- NextGen Marketplace 2026 - Database Seed Data
-- ═══════════════════════════════════════════════════════════════════════════
-- Sample data for development & testing

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. INSERT TEST TENANT
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO tenants (id, slug, name, name_fa, status, tax_id, economic_code) VALUES
(
    '550e8400-e29b-41d4-a716-446655440000'::UUID,
    'nextgen-dev',
    'NextGen Marketplace Development',
    'بازار نکست جن توسعه',
    'ACTIVE',
    '14006547821',
    '409710222222222'
)
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. INSERT TEST USERS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO users (id, tenant_id, email, phone, first_name, last_name, password_hash, is_active, is_verified) VALUES
-- Admin user (password: Admin123!)
('550e8400-e29b-41d4-a716-446655440001'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'admin@nextgen.local', '+98-21-00000001', 'Admin', 'User', '$argon2id$v=19$m=65536,t=3,p=4$salt123456789012345678$hashvalue1234567890', TRUE, TRUE),

-- Customer user (password: Customer123!)
('550e8400-e29b-41d4-a716-446655440002'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'customer@nextgen.local', '+98-21-00000002', 'علی', 'محمدی', '$argon2id$v=19$m=65536,t=3,p=4$salt123456789012345678$hashvalue1234567890', TRUE, TRUE),

-- Dealer user (password: Dealer123!)
('550e8400-e29b-41d4-a716-446655440003'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'dealer@nextgen.local', '+98-21-00000003', 'فاطمه', 'علوی', '$argon2id$v=19$m=65536,t=3,p=4$salt123456789012345678$hashvalue1234567890', TRUE, TRUE),

-- Vendor user (password: Vendor123!)
('550e8400-e29b-41d4-a716-446655440004'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'vendor@nextgen.local', '+98-21-00000004', 'حسن', 'کریمی', '$argon2id$v=19$m=65536,t=3,p=4$salt123456789012345678$hashvalue1234567890', TRUE, TRUE),

-- Executor user (password: Executor123!)
('550e8400-e29b-41d4-a716-446655440005'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'executor@nextgen.local', '+98-21-00000005', 'محمد', 'رضائی', '$argon2id$v=19$m=65536,t=3,p=4$salt123456789012345678$hashvalue1234567890', TRUE, TRUE)
ON CONFLICT (tenant_id, email) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. ASSIGN USER ROLES
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO user_role_assignments (user_id, tenant_id, role, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440001'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'SUPER_ADMIN', TRUE),
('550e8400-e29b-41d4-a716-446655440002'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'CUSTOMER', TRUE),
('550e8400-e29b-41d4-a716-446655440003'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'DEALER', TRUE),
('550e8400-e29b-41d4-a716-446655440004'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'VENDOR', TRUE),
('550e8400-e29b-41d4-a716-446655440005'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'EXECUTOR', TRUE)
ON CONFLICT (user_id, tenant_id, role) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. INSERT ADDRESSES
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO addresses (user_id, tenant_id, label, province, city, district, street, postal_code, is_default) VALUES
('550e8400-e29b-41d4-a716-446655440002'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'خانه', 'تهران', 'تهران', 'جنوب شرق', 'خیابان ولیعصر', '1418953714', TRUE),
('550e8400-e29b-41d4-a716-446655440003'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'محل کار', 'تهران', 'تهران', 'مرکز', 'خیابان فردوسی', '1311753743', TRUE)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. INSERT DEALER PROFILE
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO dealer_profiles (user_id, tenant_id, company_name, company_name_fa, tax_id, economic_code, tier, credit_limit, base_discount, is_verified) VALUES
(
    '550e8400-e29b-41d4-a716-446655440003'::UUID,
    '550e8400-e29b-41d4-a716-446655440000'::UUID,
    'Tech Solutions Iran',
    'راه حل های فناوری ایران',
    '14006547821',
    '409710222222222',
    'GOLD',
    1000000,
    15,
    TRUE
)
ON CONFLICT (user_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. INSERT VENDORS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO vendors (id, tenant_id, name, name_fa, slug, email, phone, is_active, is_verified, commission_rate) VALUES
('550e8400-e29b-41d4-a716-446655441001'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'Electronics Plus', 'الکترونیکس پلاس', 'electronics-plus', 'vendor1@nextgen.local', '+98-21-11111111', TRUE, TRUE, 10),
('550e8400-e29b-41d4-a716-446655441002'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'Fashion World', 'دنیای فشن', 'fashion-world', 'vendor2@nextgen.local', '+98-21-22222222', TRUE, TRUE, 12),
('550e8400-e29b-41d4-a716-446655441003'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'Home Essentials', 'ضروریات خانگی', 'home-essentials', 'vendor3@nextgen.local', '+98-21-33333333', TRUE, TRUE, 8),
('550e8400-e29b-41d4-a716-446655441004'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'Books & Media', 'کتاب و رسانه', 'books-media', 'vendor4@nextgen.local', '+98-21-44444444', TRUE, TRUE, 15)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. INSERT CATEGORIES
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO categories (id, tenant_id, name, name_fa, slug, level, is_active) VALUES
('550e8400-e29b-41d4-a716-446655442001'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'Electronics', 'الکترونیکس', 'electronics', 0, TRUE),
('550e8400-e29b-41d4-a716-446655442002'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'Fashion', 'فشن', 'fashion', 0, TRUE),
('550e8400-e29b-41d4-a716-446655442003'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'Home & Garden', 'خانه و باغ', 'home-garden', 0, TRUE),
('550e8400-e29b-41d4-a716-446655442004'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'Books', 'کتاب ها', 'books', 0, TRUE)
ON CONFLICT DO NOTHING;

-- Sub-categories
INSERT INTO categories (id, tenant_id, parent_id, name, name_fa, slug, level, is_active) VALUES
('550e8400-e29b-41d4-a716-446655442101'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, '550e8400-e29b-41d4-a716-446655442001'::UUID, 'Smartphones', 'گوشی های هوشمند', 'smartphones', 1, TRUE),
('550e8400-e29b-41d4-a716-446655442102'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, '550e8400-e29b-41d4-a716-446655442001'::UUID, 'Laptops', 'لپ تاپ ها', 'laptops', 1, TRUE),
('550e8400-e29b-41d4-a716-446655442103'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, '550e8400-e29b-41d4-a716-446655442001'::UUID, 'Accessories', 'لوازم جانبی', 'accessories', 1, TRUE)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. INSERT PRODUCTS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO products (
    id, tenant_id, vendor_id, category_id, sku, name, name_fa, slug, description,
    price, cost_price, stock, status, is_featured, warranty_months
) VALUES
-- Smartphones
('550e8400-e29b-41d4-a716-446655443001'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, '550e8400-e29b-41d4-a716-446655441001'::UUID, '550e8400-e29b-41d4-a716-446655442101'::UUID, 'SPH-001', 'iPhone 15 Pro', 'آیفون 15 پرو', 'iphone-15-pro', 'Latest Apple flagship smartphone', 3999000, 3500000, 50, 'ACTIVE', TRUE, 24),
('550e8400-e29b-41d4-a716-446655443002'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, '550e8400-e29b-41d4-a716-446655441001'::UUID, '550e8400-e29b-41d4-a716-446655442101'::UUID, 'SPH-002', 'Samsung Galaxy S24', 'سامسونگ گالکسی اس 24', 'samsung-galaxy-s24', 'Premium Android smartphone', 3299000, 2800000, 45, 'ACTIVE', TRUE, 24),

-- Laptops
('550e8400-e29b-41d4-a716-446655443003'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, '550e8400-e29b-41d4-a716-446655441001'::UUID, '550e8400-e29b-41d4-a716-446655442102'::UUID, 'LAP-001', 'MacBook Pro 16"', 'مک بوک پرو 16 اینچ', 'macbook-pro-16', 'Professional laptop for creators', 8999000, 7500000, 30, 'ACTIVE', TRUE, 24),
('550e8400-e29b-41d4-a716-446655443004'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, '550e8400-e29b-41d4-a716-446655441001'::UUID, '550e8400-e29b-41d4-a716-446655442102'::UUID, 'LAP-002', 'Dell XPS 15', 'دل اکس پی اس 15', 'dell-xps-15', 'High-performance Windows laptop', 6999000, 5500000, 25, 'ACTIVE', FALSE, 24),

-- Accessories
('550e8400-e29b-41d4-a716-446655443005'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, '550e8400-e29b-41d4-a716-446655441001'::UUID, '550e8400-e29b-41d4-a716-446655442103'::UUID, 'ACC-001', 'Wireless Charger', 'شارژر بی سیم', 'wireless-charger', 'Fast wireless charging pad', 299000, 150000, 200, 'ACTIVE', FALSE, 12),
('550e8400-e29b-41d4-a716-446655443006'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, '550e8400-e29b-41d4-a716-446655441001'::UUID, '550e8400-e29b-41d4-a716-446655442103'::UUID, 'ACC-002', 'USB-C Cable', 'کابل یو اس بی سی', 'usb-c-cable', 'Durable USB-C charging cable', 89000, 30000, 500, 'ACTIVE', FALSE, 12),

-- Fashion items
('550e8400-e29b-41d4-a716-446655443007'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, '550e8400-e29b-41d4-a716-446655441002'::UUID, '550e8400-e29b-41d4-a716-446655442002'::UUID, 'FAH-001', 'Cotton T-Shirt', 'تی شرت کتان', 'cotton-tshirt', 'Comfortable casual t-shirt', 199000, 80000, 300, 'ACTIVE', FALSE, 12),
('550e8400-e29b-41d4-a716-446655443008'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, '550e8400-e29b-41d4-a716-446655441002'::UUID, '550e8400-e29b-41d4-a716-446655442002'::UUID, 'FAH-002', 'Jeans', 'شلوار جین', 'jeans', 'Classic denim jeans', 499000, 250000, 150, 'ACTIVE', FALSE, 12),

-- Home items
('550e8400-e29b-41d4-a716-446655443009'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, '550e8400-e29b-41d4-a716-446655441003'::UUID, '550e8400-e29b-41d4-a716-446655442003'::UUID, 'HOM-001', 'LED Lamp', 'لامپ ال ای دی', 'led-lamp', 'Energy-efficient LED table lamp', 349000, 150000, 100, 'ACTIVE', FALSE, 12),
('550e8400-e29b-41d4-a716-446655443010'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, '550e8400-e29b-41d4-a716-446655441003'::UUID, '550e8400-e29b-41d4-a716-446655442003'::UUID, 'HOM-002', 'Coffee Maker', 'قهوه ساز', 'coffee-maker', 'Automatic coffee brewing machine', 799000, 400000, 60, 'ACTIVE', FALSE, 24),

-- Books
('550e8400-e29b-41d4-a716-446655443011'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, '550e8400-e29b-41d4-a716-446655441004'::UUID, '550e8400-e29b-41d4-a716-446655442004'::UUID, 'BOK-001', 'Persian Literature', 'ادبیات فارسی', 'persian-literature', 'Collection of classic Persian poems', 189000, 90000, 200, 'ACTIVE', FALSE, 12)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. INSERT PRODUCT TIER PRICES
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO product_tier_prices (product_id, tenant_id, tier, price, min_qty) VALUES
-- Bronze tier (10% discount)
('550e8400-e29b-41d4-a716-446655443001'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'BRONZE', 3599100, 1),
('550e8400-e29b-41d4-a716-446655443001'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'BRONZE', 3519000, 5),

-- Silver tier (15% discount)
('550e8400-e29b-41d4-a716-446655443001'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'SILVER', 3399150, 1),
('550e8400-e29b-41d4-a716-446655443001'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'SILVER', 3299000, 5),

-- Gold tier (20% discount)
('550e8400-e29b-41d4-a716-446655443001'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'GOLD', 3199200, 1),
('550e8400-e29b-41d4-a716-446655443001'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'GOLD', 3079000, 5),

-- Platinum tier (25% discount)
('550e8400-e29b-41d4-a716-446655443001'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'PLATINUM', 2999250, 1),
('550e8400-e29b-41d4-a716-446655443001'::UUID, '550e8400-e29b-41d4-a716-446655440000'::UUID, 'PLATINUM', 2859000, 5)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. INSERT SHIPPING METHODS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO shipping_methods (tenant_id, name, name_fa, code, base_cost, cost_per_kg, min_days, max_days, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'Standard Delivery', 'ارسال استاندارد', 'STANDARD', 50000, 2000, 3, 5, TRUE),
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'Express Delivery', 'ارسال فوری', 'EXPRESS', 100000, 3000, 1, 2, TRUE),
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'Same Day Delivery', 'ارسال در همان روز', 'SAME_DAY', 200000, 5000, 0, 1, TRUE)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. INSERT DISCOUNTS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO discounts (tenant_id, code, name, type, value, usage_limit, starts_at, ends_at, is_active) VALUES
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'WELCOME20', 'Welcome Discount 20%', 'PERCENTAGE', 20, 1000, NOW(), NOW() + INTERVAL '30 days', TRUE),
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'SAVE100K', 'Save 100,000 Rials', 'FIXED_AMOUNT', 100000, 500, NOW(), NOW() + INTERVAL '30 days', TRUE),
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'FREESHIP', 'Free Shipping', 'FREE_SHIPPING', 0, 300, NOW(), NOW() + INTERVAL '30 days', TRUE)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. INSERT SETTINGS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO settings (tenant_id, key, value, "group", type, is_public) VALUES
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'site_name', '"NextGen Marketplace"'::JSONB, 'general', 'string', TRUE),
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'site_name_fa', '"بازار نکست جن"'::JSONB, 'general', 'string', TRUE),
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'currency', '"IRR"'::JSONB, 'general', 'string', TRUE),
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'tax_rate', '9'::JSONB, 'tax', 'number', FALSE),
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'min_order_amount', '50000'::JSONB, 'orders', 'number', FALSE),
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'max_order_amount', '10000000'::JSONB, 'orders', 'number', FALSE)
ON CONFLICT (tenant_id, key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. INSERT BRANDS
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO brands (tenant_id, name, name_fa, slug, is_active, is_featured) VALUES
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'Apple', 'اپل', 'apple', TRUE, TRUE),
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'Samsung', 'سامسونگ', 'samsung', TRUE, TRUE),
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'Dell', 'دل', 'dell', TRUE, FALSE),
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'Nike', 'نایک', 'nike', TRUE, FALSE)
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- 14. INSERT ATTRIBUTE GROUPS & ATTRIBUTES
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO attribute_groups (tenant_id, name, name_fa) VALUES
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'Technical Specs', 'مشخصات فنی'),
('550e8400-e29b-41d4-a716-446655440000'::UUID, 'Colors & Sizes', 'رنگ ها و سایزها')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- DATABASE STATISTICS
-- ═══════════════════════════════════════════════════════════════════════════

-- Display seed data summary
SELECT 
    'Seed Data Loaded Successfully!' as status,
    (SELECT COUNT(*) FROM tenants) as total_tenants,
    (SELECT COUNT(*) FROM users) as total_users,
    (SELECT COUNT(*) FROM vendors) as total_vendors,
    (SELECT COUNT(*) FROM categories) as total_categories,
    (SELECT COUNT(*) FROM products) as total_products,
    (SELECT COUNT(*) FROM shipping_methods) as total_shipping_methods,
    (SELECT COUNT(*) FROM discounts) as total_discounts,
    (SELECT COUNT(*) FROM brands) as total_brands;
