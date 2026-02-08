#!/bin/bash
set -e

MIGRATIONS_DIR="prisma/migrations"
CHECKSUM_FILE=".migration-checksum"

# Calculate current checksum
CURRENT_CHECKSUM=$(find $MIGRATIONS_DIR -name "*.sql" -exec sha256sum {} \; | sort | sha256sum | cut -d' ' -f1)

# Check if checksum file exists
if [ -f "$CHECKSUM_FILE" ]; then
    PREVIOUS_CHECKSUM=$(cat $CHECKSUM_FILE)
    
    # Compare checksums
    if [ "$CURRENT_CHECKSUM" != "$PREVIOUS_CHECKSUM" ]; then
        echo "✅ Migration changes detected"
        echo "Previous: $PREVIOUS_CHECKSUM"
        echo "Current:  $CURRENT_CHECKSUM"
        
        # Update Helm values with new checksum
        sed -i "s/checksum: .*/checksum: \"$CURRENT_CHECKSUM\"/" helm/values.yaml
        
        # Update checksum file
        echo "$CURRENT_CHECKSUM" > $CHECKSUM_FILE
        
        echo "Updated checksum in Helm values"
    else
        echo "No migration changes detected"
    fi
else
    echo "Initializing checksum: $CURRENT_CHECKSUM"
    echo "$CURRENT_CHECKSUM" > $CHECKSUM_FILE
    sed -i "s/checksum: .*/checksum: \"$CURRENT_CHECKSUM\"/" helm/values.yaml
fi

echo "Migration checksum: $CURRENT_CHECKSUM"