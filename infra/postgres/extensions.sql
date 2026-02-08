-- ═══════════════════════════════════════════════════════════════════════════
-- NextGen Marketplace - PostgreSQL Extensions
-- ═══════════════════════════════════════════════════════════════════════════

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cryptographic functions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Trigram similarity for fuzzy search
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Full text search configuration for Persian
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'persian') THEN
        CREATE TEXT SEARCH CONFIGURATION persian (COPY = simple);
    END IF;
END $$;

-- Create helper functions

-- Generate short unique ID
CREATE OR REPLACE FUNCTION generate_short_id(prefix TEXT DEFAULT '')
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := prefix;
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'ORD-' || to_char(NOW(), 'YYYY') || '-' || lpad(nextval('order_number_seq')::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Generate invoice number
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'INV-' || to_char(NOW(), 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Create sequences
CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

-- Jalali date conversion (simplified)
CREATE OR REPLACE FUNCTION to_jalali(gregorian_date DATE)
RETURNS TEXT AS $$
DECLARE
    g_y INTEGER;
    g_m INTEGER;
    g_d INTEGER;
    j_y INTEGER;
    j_m INTEGER;
    j_d INTEGER;
    gy INTEGER;
    g_day_no INTEGER;
    j_day_no INTEGER;
    j_np INTEGER;
    i INTEGER;
    g_days_in_month INTEGER[] := ARRAY[31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    j_days_in_month INTEGER[] := ARRAY[31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];
BEGIN
    g_y := EXTRACT(YEAR FROM gregorian_date)::INTEGER;
    g_m := EXTRACT(MONTH FROM gregorian_date)::INTEGER;
    g_d := EXTRACT(DAY FROM gregorian_date)::INTEGER;
    
    gy := g_y - 1600;
    g_day_no := 365 * gy + (gy + 3) / 4 - (gy + 99) / 100 + (gy + 399) / 400;
    
    FOR i IN 1..(g_m - 1) LOOP
        g_day_no := g_day_no + g_days_in_month[i];
    END LOOP;
    
    IF g_m > 2 AND ((g_y % 4 = 0 AND g_y % 100 != 0) OR g_y % 400 = 0) THEN
        g_day_no := g_day_no + 1;
    END IF;
    
    g_day_no := g_day_no + g_d - 1;
    j_day_no := g_day_no - 79;
    j_np := j_day_no / 12053;
    j_day_no := j_day_no % 12053;
    j_y := 979 + 33 * j_np + 4 * (j_day_no / 1461);
    j_day_no := j_day_no % 1461;
    
    IF j_day_no >= 366 THEN
        j_y := j_y + (j_day_no - 1) / 365;
        j_day_no := (j_day_no - 1) % 365;
    END IF;
    
    i := 1;
    WHILE i <= 11 AND j_day_no >= j_days_in_month[i] LOOP
        j_day_no := j_day_no - j_days_in_month[i];
        i := i + 1;
    END LOOP;
    
    j_m := i;
    j_d := j_day_no + 1;
    
    RETURN j_y || '/' || lpad(j_m::text, 2, '0') || '/' || lpad(j_d::text, 2, '0');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL extensions installed successfully!';
END $$;
