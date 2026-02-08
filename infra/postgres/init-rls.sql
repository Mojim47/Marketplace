-- ═══════════════════════════════════════════════════════════════════════════
-- NextGen Marketplace - PostgreSQL RLS (Row-Level Security) Setup
-- ═══════════════════════════════════════════════════════════════════════════
-- Ultra-Fast 7-Layer Architecture - Database Hard Security Layer
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- Create application user for RLS
CREATE ROLE nextgen_app WITH LOGIN PASSWORD 'nextgen_app_secret_2024';
GRANT CONNECT ON DATABASE nextgen_db TO nextgen_app;

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

-- Performance optimization settings
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '1GB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;

-- Reload configuration
SELECT pg_reload_conf();