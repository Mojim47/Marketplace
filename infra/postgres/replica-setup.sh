#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - PostgreSQL Replica Setup Script
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Configure PostgreSQL replica for streaming replication
# Requirements: 9.5 - Database replication with failover capability
# ═══════════════════════════════════════════════════════════════════════════

set -e

echo "Setting up PostgreSQL Replica..."

PRIMARY_HOST="${PRIMARY_HOST:-postgres-primary}"
PRIMARY_PORT="${PRIMARY_PORT:-5432}"
REPLICATION_USER="${REPLICATION_USER:-replicator}"
REPLICATION_PASSWORD="${REPLICATION_PASSWORD:-replicator_secret}"

# Wait for primary to be ready
echo "Waiting for primary database to be ready..."
until PGPASSWORD="$PGPASSWORD" pg_isready -h "$PRIMARY_HOST" -p "$PRIMARY_PORT" -U "$PGUSER"; do
    echo "Primary not ready, waiting..."
    sleep 2
done

echo "Primary is ready!"

# Check if data directory is empty (first run)
if [ -z "$(ls -A $PGDATA 2>/dev/null)" ]; then
    echo "Data directory is empty, performing base backup from primary..."
    
    # Perform base backup from primary
    PGPASSWORD="$REPLICATION_PASSWORD" pg_basebackup \
        -h "$PRIMARY_HOST" \
        -p "$PRIMARY_PORT" \
        -U "$REPLICATION_USER" \
        -D "$PGDATA" \
        -Fp \
        -Xs \
        -P \
        -R \
        -S replica1_slot \
        -C
    
    echo "Base backup complete!"
    
    # Create standby.signal file
    touch "$PGDATA/standby.signal"
    
    # Configure recovery settings
    cat >> "$PGDATA/postgresql.auto.conf" <<EOF

# Streaming Replication Settings
primary_conninfo = 'host=$PRIMARY_HOST port=$PRIMARY_PORT user=$REPLICATION_USER password=$REPLICATION_PASSWORD application_name=replica1'
primary_slot_name = 'replica1_slot'
recovery_target_timeline = 'latest'
EOF
    
    echo "Replica configuration complete!"
else
    echo "Data directory exists, assuming replica is already configured"
    
    # Ensure standby.signal exists
    if [ ! -f "$PGDATA/standby.signal" ]; then
        touch "$PGDATA/standby.signal"
    fi
fi

echo "Replica setup complete!"
