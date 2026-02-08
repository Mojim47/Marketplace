#!/bin/bash
set -e

echo "🔄 Starting JWT key rotation..."

# Get current key version
CURRENT_VERSION=$(vault read -field=latest_version transit/keys/jwt-signing)
echo "Current key version: $CURRENT_VERSION"

# Rotate the key
vault write -f transit/keys/jwt-signing/rotate
NEW_VERSION=$((CURRENT_VERSION + 1))
echo "✅ Rotated to version: $NEW_VERSION"

# Wait 5 minutes for gradual cutover
echo "⏳ Waiting 5 minutes for gradual cutover..."
sleep 300

# Verify new key is active
LATEST_VERSION=$(vault read -field=latest_version transit/keys/jwt-signing)
if [ "$LATEST_VERSION" -eq "$NEW_VERSION" ]; then
    echo "✅ Key rotation completed successfully"
    echo "New version: $LATEST_VERSION"
else
    echo "❌ Key rotation verification failed"
    exit 1
fi

echo "🔐 JWT key rotation completed with zero downtime"