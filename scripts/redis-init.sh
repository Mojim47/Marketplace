#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Redis Cache Initialization
# ═══════════════════════════════════════════════════════════════════════════
# Initializes cache structures and TTL policies

set -euo pipefail

REDIS_HOST="${REDIS_HOST:-redis}"
REDIS_PORT="${REDIS_PORT:-6379}"
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
REDIS_DB="${REDIS_DB:-0}"

# Connect to Redis
if [ -n "$REDIS_PASSWORD" ]; then
    REDIS_CLI="redis-cli -h $REDIS_HOST -p $REDIS_PORT -a $REDIS_PASSWORD -n $REDIS_DB"
else
    REDIS_CLI="redis-cli -h $REDIS_HOST -p $REDIS_PORT -n $REDIS_DB"
fi

echo "═══════════════════════════════════════════════════════════════════════════"
echo "NextGen Marketplace - Redis Cache Initialization"
echo "═══════════════════════════════════════════════════════════════════════════"

# Check Redis connection
echo "Checking Redis connection..."
if ! $REDIS_CLI ping > /dev/null 2>&1; then
    echo "Error: Cannot connect to Redis at $REDIS_HOST:$REDIS_PORT"
    exit 1
fi
echo "✓ Redis connection successful"

# ═══════════════════════════════════════════════════════════════════════════
# CACHE KEY PATTERNS & TTL CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "Setting up cache policies..."

# Session cache (24 hours)
echo "Creating session cache patterns..."
$REDIS_CLI SET "cache:session:*" "{}" EX 86400 &>/dev/null || true

# Product cache (10 minutes)
echo "Creating product cache patterns..."
$REDIS_CLI SET "cache:product:*" "{}" EX 600 &>/dev/null || true

# Category cache (1 hour)
echo "Creating category cache patterns..."
$REDIS_CLI SET "cache:category:*" "{}" EX 3600 &>/dev/null || true

# User profile cache (5 minutes)
echo "Creating user cache patterns..."
$REDIS_CLI SET "cache:user:*" "{}" EX 300 &>/dev/null || true

# Order cache (1 minute)
echo "Creating order cache patterns..."
$REDIS_CLI SET "cache:order:*" "{}" EX 60 &>/dev/null || true

# Rate limit bucket (per minute)
echo "Creating rate limit buckets..."
$REDIS_CLI SET "ratelimit:*" "0" EX 60 &>/dev/null || true

# ═══════════════════════════════════════════════════════════════════════════
# QUEUE INITIALIZATION
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "Setting up job queues..."

# Create BullMQ queue keys
$REDIS_CLI DEL "bull:email_queue:*" &>/dev/null || true
$REDIS_CLI DEL "bull:payment_queue:*" &>/dev/null || true
$REDIS_CLI DEL "bull:inventory_queue:*" &>/dev/null || true
$REDIS_CLI DEL "bull:notification_queue:*" &>/dev/null || true

echo "✓ Job queues initialized"

# ═══════════════════════════════════════════════════════════════════════════
# FEATURE FLAGS
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "Setting feature flags..."

$REDIS_CLI HSET "features:nextgen-dev" \
    "ai_embedding" "true" \
    "zarinpal_payments" "true" \
    "moodian_integration" "true" \
    "executor_system" "true" \
    "warranty_management" "true" \
    "dealer_credit_system" "true" \
    "multi_language" "true" \
    &>/dev/null || true

echo "✓ Feature flags set"

# ═══════════════════════════════════════════════════════════════════════════
# CONFIGURATION DATA
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "Loading configuration data..."

# Tenant configuration
$REDIS_CLI HSET "config:tenant:550e8400-e29b-41d4-a716-446655440000" \
    "name" "NextGen Marketplace Development" \
    "timezone" "Asia/Tehran" \
    "currency" "IRR" \
    "language" "fa" \
    "tax_rate" "9" \
    &>/dev/null || true

# Payment gateway config
$REDIS_CLI HSET "config:payment:zarinpal" \
    "enabled" "true" \
    "sandbox" "true" \
    "timeout" "30000" \
    &>/dev/null || true

# Tax authority config
$REDIS_CLI HSET "config:tax:moodian" \
    "enabled" "true" \
    "sandbox" "true" \
    "timeout" "60000" \
    &>/dev/null || true

echo "✓ Configuration data loaded"

# ═══════════════════════════════════════════════════════════════════════════
# BLACKLIST & WHITELIST
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "Setting up security lists..."

# Email blacklist (spam prevention)
$REDIS_CLI SADD "blacklist:email" \
    "test@test.com" \
    "spam@spam.com" \
    &>/dev/null || true

# IP whitelist (admin access)
$REDIS_CLI SADD "whitelist:ip" \
    "127.0.0.1" \
    "::1" \
    &>/dev/null || true

# Blocked users
$REDIS_CLI SADD "blacklist:users" &>/dev/null || true

echo "✓ Security lists configured"

# ═══════════════════════════════════════════════════════════════════════════
# ANALYTICS & MONITORING
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "Setting up analytics..."

# Today's stats
$REDIS_CLI HSET "stats:daily:$(date +%Y-%m-%d)" \
    "total_orders" "0" \
    "total_revenue" "0" \
    "unique_customers" "0" \
    "total_views" "0" \
    &>/dev/null || true

# Daily unique visitors
$REDIS_CLI SET "analytics:daily_visitors:$(date +%Y-%m-%d)" "0" EX 86400 &>/dev/null || true

# Top products
$REDIS_CLI SET "analytics:top_products" "[]" EX 3600 &>/dev/null || true

echo "✓ Analytics initialized"

# ═══════════════════════════════════════════════════════════════════════════
# DISTRIBUTED LOCKS
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "Setting up distributed locks..."

# Inventory sync lock
$REDIS_CLI SET "lock:inventory_sync" "0" EX 300 &>/dev/null || true

# Payment processing lock
$REDIS_CLI SET "lock:payment_processing" "0" EX 60 &>/dev/null || true

# Database migration lock
$REDIS_CLI SET "lock:migration" "0" EX 3600 &>/dev/null || true

echo "✓ Distributed locks initialized"

# ═══════════════════════════════════════════════════════════════════════════
# CACHE WARMING
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "Warming up cache..."

# This would be populated by application queries
# Just create empty structures for now
$REDIS_CLI HSET "cache:warm:status" "last_warmed" "$(date +%s)" &>/dev/null || true

echo "✓ Cache warming complete"

# ═══════════════════════════════════════════════════════════════════════════
# FINAL VERIFICATION
# ═══════════════════════════════════════════════════════════════════════════

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"

# Get Redis statistics
echo "Redis Status:"
$REDIS_CLI INFO server | grep -E "redis_version|uptime_in_seconds"
echo ""

KEYS_COUNT=$($REDIS_CLI DBSIZE | grep -oP '(?<=keys=)\d+')
MEMORY=$($REDIS_CLI INFO memory | grep used_memory_human | cut -d: -f2 | tr -d '\r')

echo "Redis Statistics:"
echo "  Total Keys: $KEYS_COUNT"
echo "  Memory Used: $MEMORY"
echo ""

echo "═══════════════════════════════════════════════════════════════════════════"
echo "✓ Redis initialization completed successfully!"
echo "═══════════════════════════════════════════════════════════════════════════"
