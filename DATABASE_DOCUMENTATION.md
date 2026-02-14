# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace 2026 - Database Schema Documentation
# ═══════════════════════════════════════════════════════════════════════════

## DATABASE OVERVIEW

**Type:** PostgreSQL 16 (advanced enterprise database)  
**Total Tables:** 50+  
**Total Indexes:** 100+  
**Schema Size:** ~500MB-1GB per tenant  

---

## CORE TABLES

### 1. **Tenants** (Multi-Tenant Isolation)
```
tenants
├─ id (UUID, PK)
├─ slug (UNIQUE) - URL-safe identifier
├─ name - Company/marketplace name
├─ status - ACTIVE, SUSPENDED, ARCHIVED
├─ tax_id - National tax identifier
├─ economic_code - Government code
├─ settings (JSONB) - Custom configuration
└─ features (JSONB) - Feature flags
```

**Purpose:** Complete data isolation between different marketplaces  
**Indexes:** status, slug  
**Partitioning:** None (typically 1-10 tenants)

---

### 2. **Users** (Authentication & Identity)
```
users
├─ id (UUID, PK)
├─ tenant_id (FK)
├─ email (UNIQUE per tenant) - Primary identifier
├─ phone (UNIQUE per tenant)
├─ national_id - کد ملی (Iranian ID)
├─ password_hash - Argon2id hashed
├─ totp_secret - 2FA configuration
├─ is_verified - Email verification status
├─ last_login_at - Security audit
├─ failed_attempts - Brute force protection
└─ locked_until - Temporary lockout
```

**Purpose:** User accounts with multi-factor authentication  
**Indexes:** tenant_id + email, tenant_id + phone, national_id  
**Security:** Row-level security (RLS) by tenant  
**Capacity:** 10M+ users per tenant

---

### 3. **Products** (Catalog)
```
products
├─ id (UUID, PK)
├─ tenant_id (FK)
├─ vendor_id (FK)
├─ category_id (FK)
├─ sku (UNIQUE per tenant)
├─ barcode
├─ name / name_fa - Bilingual
├─ slug (UNIQUE per tenant)
├─ description / description_fa
├─ price / compare_price / cost_price - Pricing
├─ tax_rate (DECIMAL) - Moodian tax
├─ stock / reserved_stock - Inventory
├─ status - DRAFT, ACTIVE, OUT_OF_STOCK, etc.
├─ images (JSONB) - Media array
├─ attributes (JSONB) - Key-value pairs
├─ specifications (JSONB) - Array of specs
├─ warranty_months
├─ search_vector (TEXT) - Full-text search
└─ is_featured (BOOLEAN)
```

**Purpose:** Product catalog with inventory management  
**Indexes:** tenant + category, tenant + vendor, full-text search (persian)  
**Partitioning:** By created_at (monthly) for large catalogs  
**Capacity:** 1M+ products per tenant

**Related Tables:**
- `product_tier_prices` - Dealer pricing tiers
- `inventory_logs` - Transaction history
- `warranties` - After-sales coverage

---

### 4. **Orders** (Commerce)
```
orders
├─ id (UUID, PK)
├─ tenant_id (FK)
├─ user_id (FK)
├─ order_number (UNIQUE per tenant) - Human-readable
├─ status - DRAFT → COMPLETED
├─ subtotal / discount_amount / tax_amount / total
├─ shipping_address (JSONB)
├─ shipping_method
├─ tracking_number
├─ metadata (JSONB) - Custom data
└─ created_at / updated_at
```

**Purpose:** Complete order lifecycle management  
**Indexes:** tenant + status, tenant + user_id, tenant + created_at  
**Partitioning:** By created_at (monthly for OLTP efficiency)  
**Capacity:** 100M+ orders per tenant  
**Performance:** 1M+ concurrent orders

**Related Tables:**
- `order_items` - Line items
- `order_idempotencies` - Duplicate prevention
- `payments` - Payment records
- `invoices` - Tax documents

---

### 5. **Invoices** (Moodian Integration)
```
invoices
├─ id (UUID, PK)
├─ order_id (FK)
├─ invoice_number (UNIQUE per tenant)
├─ serial_number - دفتر چک
├─ suid (UNIQUE) - Moodian unique ID
├─ tax_id - Tax authority ID
├─ status - DRAFT → MOODIAN_CONFIRMED
├─ subtotal / discount / tax_amount / total
├─ buyer_info (JSONB) - Customer snapshot
├─ items (JSONB) - Line items snapshot
├─ moodian_response (JSONB) - Authority response
├─ moodian_sent_at / moodian_confirmed_at
└─ qr_code - For verification
```

**Purpose:** Tax-compliant invoice generation & submission  
**Indexes:** tenant + status, suid (unique lookup)  
**Compliance:** GDPR, PCI-DSS, Iranian tax law  
**Archive:** Move to cold storage after 7 years

---

### 6. **Payments** (Gateway Integration)
```
payments
├─ id (UUID, PK)
├─ order_id (FK)
├─ tenant_id (FK)
├─ amount (DECIMAL)
├─ gateway - ZARINPAL, MELLAT, SAMAN, WALLET
├─ gateway_ref - Authority ID
├─ gateway_track - Tracking code
├─ status - PENDING → COMPLETED
├─ verified_at
├─ card_pan (masked) - Last 4 digits
├─ error_message - Failure reason
└─ metadata (JSONB)
```

**Purpose:** Multiple payment gateway support  
**Indexes:** order_id, gateway_ref (lookup), tenant + status  
**Compliance:** PCI-DSS Level 1 (no full card storage)  
**Reconciliation:** Daily auto-reconciliation jobs

---

### 7. **Dealers** (B2B System)
```
dealer_profiles
├─ id (UUID, PK)
├─ user_id (UNIQUE FK)
├─ tenant_id (FK)
├─ company_name / company_name_fa
├─ tax_id / economic_code
├─ tier - BRONZE, SILVER, GOLD, PLATINUM
├─ credit_limit / credit_used (DECIMAL)
├─ base_discount (%) 
├─ is_verified
└─ documents (JSONB)
```

**Purpose:** Wholesale buyer management  
**Pricing:** Dynamic tier-based discounts  
**Credit:** 30-90 day payment terms  
**Capacity:** 100K+ dealers per tenant

**Related Tables:**
- `cheques` - Postdated check management
- `proforma_invoices` - Quote management

---

### 8. **Executors** (Service Contractors)
```
executor_profiles
├─ id (UUID, PK)
├─ user_id (UNIQUE FK)
├─ tenant_id (FK)
├─ specialties (ARRAY) - Skills
├─ experience_years
├─ status - PENDING_VERIFICATION → VERIFIED/BLACKLISTED
├─ rating (0-5) / total_reviews / completed_projects
├─ portfolio (JSONB) - Previous work
├─ certificates (JSONB) - Credentials
├─ commission_rate (%)
└─ service_areas (JSONB) - Geographic zones
```

**Purpose:** Service contractor ecosystem  
**Vetting:** Multi-step verification process  
**Quality:** Rating system (3+ stars required)  
**Capacity:** 10K+ executors per tenant

**Related Tables:**
- `projects` - Service requests
- `project_bids` - Bid management

---

## CACHE LAYER (Redis/Dragonfly)

```
Session Cache:
  cache:session:{user_id} → User session data (24h)
  
Product Cache:
  cache:product:{product_id} → Product details (10m)
  cache:product:list:{category_id} → Category listing (5m)
  cache:top_products → Trending products (1h)
  
User Cache:
  cache:user:{user_id} → User profile (5m)
  cache:user:roles:{user_id} → User permissions (1h)
  
Order Cache:
  cache:order:{order_id} → Order details (1m)
  
Rate Limiting:
  ratelimit:user:{user_id}:{minute} → Request count (60s)
  ratelimit:ip:{ip_address}:{minute} → IP limit (60s)
  
Queue Data:
  bull:email_queue:* → Email job queue
  bull:payment_queue:* → Payment processing
  bull:inventory_queue:* → Inventory updates
  bull:notification_queue:* → Push notifications
```

---

## PERFORMANCE OPTIMIZATION

### Indexes Strategy

```
B-Tree Indexes (Default):
  ├─ Foreign keys
  ├─ Status fields
  ├─ Timestamps
  └─ Unique constraints

BRIN Indexes (Large tables):
  ├─ Created_at (millions of rows)
  └─ Updated_at (write-heavy tables)

GIN Indexes:
  ├─ JSONB columns (settings, attributes)
  └─ Array columns (specialties, services)

Full-Text Search:
  ├─ Products (title + description)
  ├─ Language: Persian (custom dictionary)
  └─ Query: to_tsvector('persian', col_name)
```

### Query Optimization

```sql
-- Slow query detection
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- Index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
```

---

## BACKUP & DISASTER RECOVERY

### Backup Strategy

```
Daily Full Backup:
  Time: 2:00 AM (low traffic)
  Retention: 7 days local + 30 days S3
  
Hourly Incremental:
  WAL archival to S3
  Point-in-time recovery available
  
Weekly Cold Backup:
  Full snapshot to Glacier storage
  Retention: 1 year
  
Test Recovery: Monthly (documented procedure)
```

### RPO & RTO

```
Scenario: Database corruption/data loss
  RTO (Recovery Time): 15 minutes
  RPO (Data Loss): 1 hour maximum
  
Scenario: Complete server loss
  RTO: 30 minutes (restore from backup)
  RPO: 1 hour
  
Scenario: Region failure
  RTO: 2 hours (failover to secondary region)
  RPO: 15 minutes (cross-region replication)
```

---

## SECURITY & COMPLIANCE

### Row-Level Security (RLS)

```
Policy: Tenant Isolation
  USING (tenant_id = current_setting('app.tenant_id')::UUID)
  
Policy: User Data Access
  USING (user_id = current_setting('app.user_id')::UUID)
  
Policy: Role-Based Access
  USING (check_user_role('view_orders'))
```

### Encryption

```
At Rest:
  - Database encryption enabled (pgcrypto)
  - Column-level encryption for sensitive data
  - Transparent Data Encryption (TDE)
  
In Transit:
  - SSL/TLS for all connections (sslmode=require)
  - Certificate pinning for critical operations
  
Key Management:
  - Vault for encryption key storage
  - Key rotation every 90 days
```

### Audit Logging

```
audit_logs table:
  - Every INSERT/UPDATE/DELETE on sensitive tables
  - User identity & IP address
  - Old & new values (JSONB)
  - Timestamp with microsecond precision
  
Retention: 7 years (compliance)
Query: 100M+ audit entries per year per tenant
```

---

## DATABASE INITIALIZATION

### Step-by-Step Setup

```bash
# 1. Connect to PostgreSQL
psql -U postgres -d template1

# 2. Create database
CREATE DATABASE nextgen_marketplace;

# 3. Connect to new database
\c nextgen_marketplace

# 4. Run schema setup
\i /path/to/scripts/postgres-init.sql

# 5. Load seed data
\i /path/to/scripts/postgres-seed.sql

# 6. Verify
SELECT * FROM tenants;
SELECT COUNT(*) FROM products;
```

### Maintenance Tasks

```bash
# Daily
VACUUM ANALYZE;  -- Optimize query planner

# Weekly
REINDEX DATABASE nextgen_marketplace;  -- Rebuild indexes

# Monthly
SELECT * FROM pg_stat_statements 
ORDER BY mean_exec_time DESC LIMIT 10;  -- Find slow queries

# Quarterly
ALTER TABLE orders SET (autovacuum_vacuum_scale_factor = 0.05);
-- Adjust for write-heavy tables
```

---

## MONITORING & ALERTING

### Key Metrics

```
Connection Pool:
  Active: < 80% of pool_size
  Alert: > 90%
  
Cache Hit Rate:
  Target: > 95%
  Alert: < 80%
  
Query Performance:
  Avg: < 50ms
  P95: < 200ms
  P99: < 1s
  
Storage:
  Growth: < 5GB/day per tenant
  Fragmentation: < 10%
```

### Prometheus Queries

```
pg_stat_database_tup_inserted  -- Row inserts
pg_stat_database_tup_updated   -- Row updates
pg_stat_database_tup_deleted   -- Row deletes
pg_stat_database_blks_hit      -- Cache hit rate
pg_replication_lag_seconds     -- Replication delay
pg_wal_segments_archived       -- Backup status
```

---

## CAPACITY PLANNING

### Current Scale

```
Tenants: 1 (dev) - 100 (production)
Users: 1K-1M per tenant
Products: 10K-1M per tenant
Orders: 1K-100M total per tenant
Daily: 100K-10M transactions per tenant
```

### Growth Projections (12 months)

```
Tenant 1 (Large):
  Users: 1M → 2M (+100%)
  Products: 1M → 2M (+100%)
  Orders: 100M → 200M (+100%)
  Storage: 500GB → 1TB
  
Recommended Action:
  - Partition orders by date
  - Archive old invoices
  - Replicate to secondary region
```

---

## TROUBLESHOOTING

### Common Issues

```
High Connection Count:
  SHOW max_connections;
  SELECT count(*) FROM pg_stat_activity;
  Solution: Increase pool_size or add connection pooler

Slow Queries:
  SELECT * FROM pg_stat_statements 
  WHERE mean_exec_time > 1000;
  Solution: Add index on WHERE/JOIN columns

Disk Space:
  SELECT schemaname, tablename, 
         pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
  FROM pg_tables;
  Solution: Archive or drop unused partitions

Lock Contention:
  SELECT * FROM pg_locks WHERE granted = false;
  Solution: Use FOR UPDATE SKIP LOCKED or async processing
```

---

## QUICK REFERENCE

| Table | Rows | Size | TTL | Partitioning |
|-------|------|------|-----|--------------|
| users | 1M | 100MB | ∞ | Tenant |
| products | 1M | 200MB | ∞ | Tenant |
| orders | 100M | 50GB | ∞ | Monthly |
| order_items | 300M | 80GB | ∞ | Monthly |
| payments | 100M | 10GB | ∞ | Monthly |
| audit_logs | 1B | 500GB | 7y | Yearly |
| invoices | 100M | 20GB | 7y | Yearly |

**Total Database Size: 500GB - 1TB per large tenant**

---

## RESOURCES

- PostgreSQL 16 Docs: https://www.postgresql.org/docs/16/
- DragonflyDB Docs: https://www.dragonflydb.io/docs
- Prisma ORM: https://www.prisma.io/docs/
- Query Optimization: https://explain.depesz.com/

---

**Last Updated:** 2024-01-15  
**Version:** 1.0  
**Status:** ✓ PRODUCTION READY
