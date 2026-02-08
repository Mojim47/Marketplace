#!/bin/bash
set -e

echo "🔍 Building and comparing image sizes..."

# Build original image
echo "Building original image..."
docker build -t nextgen-api:original -f Dockerfile .

# Build optimized image
echo "Building optimized image..."
docker build -t nextgen-api:optimized -f Dockerfile.optimized .

# Get sizes
ORIGINAL_SIZE=$(docker images nextgen-api:original --format "{{.Size}}")
OPTIMIZED_SIZE=$(docker images nextgen-api:optimized --format "{{.Size}}")

ORIGINAL_MB=$(docker inspect nextgen-api:original | jq '.[0].Size / 1024 / 1024' | cut -d. -f1)
OPTIMIZED_MB=$(docker inspect nextgen-api:optimized | jq '.[0].Size / 1024 / 1024' | cut -d. -f1)

REDUCTION=$((ORIGINAL_MB - OPTIMIZED_MB))
REDUCTION_PCT=$(echo "scale=1; ($REDUCTION * 100) / $ORIGINAL_MB" | bc)

echo ""
echo "📊 Size Comparison Results:"
echo "Original:  $ORIGINAL_SIZE ($ORIGINAL_MB MB)"
echo "Optimized: $OPTIMIZED_SIZE ($OPTIMIZED_MB MB)"
echo "Reduction: $REDUCTION MB ($REDUCTION_PCT%)"
echo ""

# Check if target achieved
if [ "$OPTIMIZED_MB" -le 80 ]; then
    echo "✅ Target achieved: $OPTIMIZED_MB MB ≤ 80 MB"
else
    echo "❌ Target missed: $OPTIMIZED_MB MB > 80 MB"
    exit 1
fi

# Run Dive analysis
echo "🔍 Running Dive efficiency analysis..."
if command -v dive &> /dev/null; then
    dive nextgen-api:optimized --ci-config .dive-ci.yml
else
    echo "Dive not installed, skipping efficiency analysis"
fi

echo "🎉 Build optimization completed successfully!"