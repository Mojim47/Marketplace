-- ═══════════════════════════════════════════════════════════════════════════
-- NextGen Marketplace - ClickHouse Analytics Schema
-- ═══════════════════════════════════════════════════════════════════════════
-- Purpose: Search analytics, user behavior tracking, business intelligence
-- Features: Real-time ingestion, time-series analysis, aggregations
-- ═══════════════════════════════════════════════════════════════════════════

-- Create database
CREATE DATABASE IF NOT EXISTS nextgen_analytics;
USE nextgen_analytics;

-- ═══════════════════════════════════════════════════════════════════════════
-- SEARCH ANALYTICS TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Search Events - Every search query with results
CREATE TABLE IF NOT EXISTS search_events (
    event_id String,
    timestamp DateTime64(3) DEFAULT now64(),
    date Date DEFAULT toDate(timestamp),
    
    -- User Context (GDPR compliant - hashed/anonymized)
    user_id Nullable(String), -- Hashed user ID, not plaintext
    session_id String,
    ip_address IPv4, -- Anonymized (last octet removed)
    user_agent String, -- Sanitized user agent
    
    -- Search Query
    query String,
    query_normalized String, -- Cleaned/normalized version
    query_language Enum8('fa' = 1, 'en' = 2, 'mixed' = 3),
    search_type Enum8('keyword' = 1, 'vector' = 2, 'hybrid' = 3),
    
    -- Search Parameters
    filters String DEFAULT '',
    sort_by String DEFAULT '',
    page UInt16 DEFAULT 1,
    per_page UInt16 DEFAULT 20,
    
    -- Results
    total_results UInt32,
    returned_results UInt16,
    search_time_ms UInt16,
    
    -- User Behavior
    clicked_result_position Nullable(UInt16),
    clicked_product_id Nullable(String),
    time_to_click_ms Nullable(UInt32),
    
    -- Business Context
    category_filter Nullable(String),
    price_range_min Nullable(UInt32),
    price_range_max Nullable(UInt32),
    vendor_filter Nullable(String),
    
    -- Technical
    search_engine Enum8('typesense' = 1, 'meilisearch' = 2, 'elasticsearch' = 3) DEFAULT 1,
    api_version String DEFAULT 'v1',
    
    -- Metadata
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, timestamp, user_id)
TTL date + INTERVAL 2 YEAR DELETE,
    date + INTERVAL 1 YEAR TO DISK 'cold',
    date + INTERVAL 6 MONTH TO VOLUME 'archive';

-- Failed Searches - Queries with no results (CRITICAL for marketplace)
CREATE TABLE IF NOT EXISTS failed_searches (
    event_id String,
    timestamp DateTime64(3) DEFAULT now64(),
    date Date DEFAULT toDate(timestamp),
    
    -- User Context (GDPR compliant)
    user_id Nullable(String), -- Hashed user ID
    session_id String,
    ip_address IPv4, -- Anonymized IP
    
    -- Failed Query
    query String,
    query_normalized String,
    query_language Enum8('fa' = 1, 'en' = 2, 'mixed' = 3),
    
    -- Context
    filters String DEFAULT '',
    category_attempted Nullable(String),
    
    -- Follow-up Actions
    refined_query Nullable(String), -- If user tried again
    found_results_after_refinement UInt8 DEFAULT 0,
    
    -- Business Impact
    potential_revenue_lost Nullable(UInt32), -- Estimated based on similar queries
    
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, timestamp, query)
TTL date + INTERVAL 2 YEAR DELETE,
    date + INTERVAL 1 YEAR TO DISK 'cold';

-- Product Impressions - Which products were shown in search results
CREATE TABLE IF NOT EXISTS product_impressions (
    event_id String,
    timestamp DateTime64(3) DEFAULT now64(),
    date Date DEFAULT toDate(timestamp),
    
    -- Search Context
    search_event_id String, -- Links to search_events
    query String,
    
    -- Product
    product_id String,
    product_name String,
    product_price UInt32,
    vendor_id String,
    category_id String,
    
    -- Position & Ranking
    position UInt16, -- 1-based position in results
    page UInt16,
    relevance_score Float32,
    
    -- User Action
    was_clicked UInt8 DEFAULT 0,
    click_timestamp Nullable(DateTime64(3)),
    
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, search_event_id, position)
TTL date + INTERVAL 1 YEAR DELETE,
    date + INTERVAL 6 MONTH TO DISK 'cold';

-- ═══════════════════════════════════════════════════════════════════════════
-- USER BEHAVIOR ANALYTICS
-- ═══════════════════════════════════════════════════════════════════════════

-- User Sessions - Aggregated session data
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id String,
    user_id Nullable(String), -- Hashed user ID for GDPR compliance
    start_time DateTime64(3),
    end_time Nullable(DateTime64(3)),
    date Date DEFAULT toDate(start_time),
    
    -- Session Metrics
    total_searches UInt16 DEFAULT 0,
    successful_searches UInt16 DEFAULT 0,
    failed_searches UInt16 DEFAULT 0,
    products_clicked UInt16 DEFAULT 0,
    
    -- Conversion
    orders_placed UInt8 DEFAULT 0,
    total_order_value UInt32 DEFAULT 0,
    
    -- Technical
    ip_address IPv4, -- Anonymized IP
    user_agent String, -- Sanitized user agent
    device_type Enum8('mobile' = 1, 'desktop' = 2, 'tablet' = 3),
    
    created_at DateTime DEFAULT now(),
    updated_at DateTime DEFAULT now()
) ENGINE = ReplacingMergeTree(updated_at)
PARTITION BY toYYYYMM(date)
ORDER BY (date, session_id)
TTL date + INTERVAL 6 MONTH DELETE,
    date + INTERVAL 3 MONTH TO DISK 'cold';

-- ═══════════════════════════════════════════════════════════════════════════
-- BUSINESS INTELLIGENCE TABLES
-- ═══════════════════════════════════════════════════════════════════════════

-- Popular Queries - Trending searches
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_queries_daily
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, query_normalized)
AS SELECT
    date,
    query_normalized,
    count() as search_count,
    uniq(user_id) as unique_users,
    avg(total_results) as avg_results,
    avg(search_time_ms) as avg_search_time
FROM search_events
GROUP BY date, query_normalized;

-- Search Performance Metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS search_performance_hourly
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, hour)
AS SELECT
    date,
    toHour(timestamp) as hour,
    count() as total_searches,
    countIf(total_results = 0) as zero_result_searches,
    avg(search_time_ms) as avg_search_time,
    quantile(0.95)(search_time_ms) as p95_search_time,
    uniq(user_id) as unique_users
FROM search_events
GROUP BY date, hour;

-- Category Performance
CREATE MATERIALIZED VIEW IF NOT EXISTS category_search_stats
ENGINE = SummingMergeTree()
PARTITION BY toYYYYMM(date)
ORDER BY (date, category_filter)
AS SELECT
    date,
    category_filter,
    count() as search_count,
    avg(total_results) as avg_results,
    countIf(clicked_result_position IS NOT NULL) as clicks,
    clicks / search_count as ctr
FROM search_events
WHERE category_filter != ''
GROUP BY date, category_filter;

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES FOR PERFORMANCE
-- ═══════════════════════════════════════════════════════════════════════════

-- Search events indexes
ALTER TABLE search_events ADD INDEX idx_query query TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 1;
ALTER TABLE search_events ADD INDEX idx_user_id user_id TYPE bloom_filter() GRANULARITY 1;
ALTER TABLE search_events ADD INDEX idx_session session_id TYPE bloom_filter() GRANULARITY 1;

-- Failed searches indexes
ALTER TABLE failed_searches ADD INDEX idx_query query TYPE tokenbf_v1(32768, 3, 0) GRANULARITY 1;

-- Product impressions indexes
ALTER TABLE product_impressions ADD INDEX idx_product_id product_id TYPE bloom_filter() GRANULARITY 1;
ALTER TABLE product_impressions ADD INDEX idx_search_event search_event_id TYPE bloom_filter() GRANULARITY 1;

-- ═══════════════════════════════════════════════════════════════════════════
-- SAMPLE QUERIES FOR BUSINESS INTELLIGENCE
-- ═══════════════════════════════════════════════════════════════════════════

/*
-- Top failed searches (product opportunities)
SELECT 
    query_normalized,
    count() as failure_count,
    uniq(user_id) as affected_users
FROM failed_searches 
WHERE date >= today() - 7
GROUP BY query_normalized
ORDER BY failure_count DESC
LIMIT 20;

-- Search performance by hour
SELECT 
    hour,
    total_searches,
    zero_result_searches,
    (zero_result_searches / total_searches) * 100 as failure_rate,
    avg_search_time
FROM search_performance_hourly 
WHERE date = today()
ORDER BY hour;

-- Most clicked products in search
SELECT 
    product_id,
    product_name,
    count() as impressions,
    sum(was_clicked) as clicks,
    (clicks / impressions) * 100 as ctr,
    avg(position) as avg_position
FROM product_impressions 
WHERE date >= today() - 7
GROUP BY product_id, product_name
HAVING impressions > 10
ORDER BY ctr DESC
LIMIT 20;
*/