#!/bin/bash
set -e

IMAGE_NAME="nextgen-api"
VERSION=${1:-latest}
REGISTRY=${REGISTRY:-"ghcr.io/mojig"}

echo "🏗️ Building multi-architecture images for $IMAGE_NAME:$VERSION"

# Create and use buildx builder
docker buildx create --name multiarch --use --bootstrap || true

# Build for both architectures
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  --tag $REGISTRY/$IMAGE_NAME:$VERSION \
  --tag $REGISTRY/$IMAGE_NAME:latest \
  --push \
  --cache-from type=gha \
  --cache-to type=gha,mode=max \
  --sbom=true \
  --provenance=true \
  .

echo "✅ Multi-arch build completed"

# Inspect the manifest
echo "📋 Image manifest:"
docker buildx imagetools inspect $REGISTRY/$IMAGE_NAME:$VERSION

# Check image sizes
echo "📏 Image sizes:"
docker manifest inspect $REGISTRY/$IMAGE_NAME:$VERSION | \
jq -r '.manifests[] | "\(.platform.architecture): \(.size / 1024 / 1024 | floor)MB"'

# Verify ARM64 image works
echo "🧪 Testing ARM64 image..."
docker run --rm --platform linux/arm64 $REGISTRY/$IMAGE_NAME:$VERSION node --version

echo "🎉 Multi-architecture build and test completed successfully!"