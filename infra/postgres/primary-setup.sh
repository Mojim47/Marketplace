#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - PostgreSQL Primary Setup Script
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Configure primary PostgreSQL for streaming replication
# Requirements: 9.5 - Database replication with failover capability
# ═══════════════════════════════════════════════════════════════════════════

set -e

echo "Setting up PostgreSQL Primary for replication..."

# Create replication user
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Create replication user
    DO \$\$
    BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'replicator') THEN
            CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD '${REPLICATION_PASSWORD:-replicator_secret}';
        END IF;
    END
    \$\$;

    -- Grant necessary permissions
    GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO replicator;

    -- Create replication slot for replica
    SELECT pg_create_physical_replication_slot('replica1_slot', true)
    WHERE NOT EXISTS (
        SELECT 1 FROM pg_replication_slots WHERE slot_name = 'replica1_slot'
    );
EOSQL

# Configure pg_hba.conf for replication
cat >> "$PGDATA/pg_hba.conf" <<EOF

# Replication connections
host    replication     replicator      0.0.0.0/0               scram-sha-256
host    replication     replicator      ::/0                    scram-sha-256
EOF

# Create WAL archive directory
mkdir -p /var/lib/postgresql/wal_archive
chmod 700 /var/lib/postgresql/wal_archive

echo "Primary setup complete!"
echo "Replication user 'replicator' created"
echo "Replication slot 'replica1_slot' created"
