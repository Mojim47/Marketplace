-- ═══════════════════════════════════════════════════════════════════════════
-- NextGen Marketplace - CDC (Change Data Capture) Setup
-- ═══════════════════════════════════════════════════════════════════════════
-- Requirements: 3.3, 3.4 - CDC captures changes within 500ms
-- 
-- This script sets up PostgreSQL for Debezium CDC:
-- 1. Creates CDC heartbeat table for monitoring
-- 2. Creates publication for logical replication
-- 3. Configures WAL settings for CDC
-- ═══════════════════════════════════════════════════════════════════════════

-- Create CDC heartbeat table for monitoring replication lag
CREATE TABLE IF NOT EXISTS cdc_heartbeat (
    id INTEGER PRIMARY KEY,
    ts TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Insert initial heartbeat record
INSERT INTO cdc_heartbeat (id, ts) VALUES (1, NOW())
ON CONFLICT (id) DO UPDATE SET ts = NOW();

-- Create publication for CDC (Debezium will use this)
-- Include all tables that need to be replicated to Read_DB
DROP PUBLICATION IF EXISTS nextgen_cdc_publication;

CREATE PUBLICATION nextgen_cdc_publication FOR TABLE
    products,
    product_variants,
    orders,
    order_items,
    inventory_logs,
    categories;

-- Grant replication permissions to the database user
-- Note: The user must have REPLICATION privilege (set in PostgreSQL config)
-- ALTER USER ${DB_USER} WITH REPLICATION;

-- Create index on updated_at for efficient CDC queries
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at);
CREATE INDEX IF NOT EXISTS idx_categories_updated_at ON categories(updated_at);

-- Create CDC metadata table for tracking sync state
CREATE TABLE IF NOT EXISTS cdc_sync_state (
    table_name VARCHAR(100) PRIMARY KEY,
    last_sync_lsn VARCHAR(100),
    last_sync_timestamp TIMESTAMP WITH TIME ZONE,
    records_synced BIGINT DEFAULT 0,
    last_error TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert initial sync state for tracked tables
INSERT INTO cdc_sync_state (table_name, last_sync_timestamp) VALUES
    ('products', NOW()),
    ('product_variants', NOW()),
    ('orders', NOW()),
    ('order_items', NOW()),
    ('inventory_logs', NOW()),
    ('categories', NOW())
ON CONFLICT (table_name) DO NOTHING;

-- Create function to update sync state
CREATE OR REPLACE FUNCTION update_cdc_sync_state(
    p_table_name VARCHAR(100),
    p_lsn VARCHAR(100),
    p_records_synced BIGINT
) RETURNS VOID AS $$
BEGIN
    UPDATE cdc_sync_state
    SET last_sync_lsn = p_lsn,
        last_sync_timestamp = NOW(),
        records_synced = records_synced + p_records_synced,
        updated_at = NOW()
    WHERE table_name = p_table_name;
END;
$$ LANGUAGE plpgsql;

-- Create view for CDC monitoring
CREATE OR REPLACE VIEW cdc_monitoring AS
SELECT
    table_name,
    last_sync_lsn,
    last_sync_timestamp,
    records_synced,
    last_error,
    EXTRACT(EPOCH FROM (NOW() - last_sync_timestamp)) AS seconds_since_sync,
    CASE
        WHEN EXTRACT(EPOCH FROM (NOW() - last_sync_timestamp)) > 5 THEN 'LAGGING'
        ELSE 'OK'
    END AS status
FROM cdc_sync_state;

-- Grant permissions
GRANT SELECT ON cdc_monitoring TO PUBLIC;
GRANT SELECT, UPDATE ON cdc_sync_state TO PUBLIC;
GRANT SELECT, INSERT, UPDATE ON cdc_heartbeat TO PUBLIC;

COMMENT ON TABLE cdc_heartbeat IS 'Heartbeat table for CDC monitoring - updated every 10 seconds by Debezium';
COMMENT ON TABLE cdc_sync_state IS 'Tracks CDC synchronization state for each table';
COMMENT ON VIEW cdc_monitoring IS 'Real-time CDC monitoring view showing sync status and lag';
