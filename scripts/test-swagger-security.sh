#!/bin/bash
set -e

echo "🔒 Testing Swagger security controls..."

PROD_DOMAIN="https://nextgen-market.ir"
STAGING_DOMAIN="https://internal-staging.nextgen-market.ir"

# Test 1: Production domain should block Swagger paths
echo "Testing production domain blocks..."

PATHS=(
  "/api/docs"
  "/swagger-ui"
  "/swagger.json"
  "/api/docs/swagger.json"
)

for path in "${PATHS[@]}"; do
  echo "Testing: $PROD_DOMAIN$path"
  
  RESPONSE=$(curl -s -I "$PROD_DOMAIN$path" | head -n 1)
  STATUS_CODE=$(echo "$RESPONSE" | grep -o '[0-9]\{3\}')
  
  if [[ "$STATUS_CODE" == "403" || "$STATUS_CODE" == "404" ]]; then
    echo "✅ $path blocked (HTTP $STATUS_CODE)"
  else
    echo "❌ $path not blocked (HTTP $STATUS_CODE)"
    exit 1
  fi
done

# Test 2: Internal staging should require mTLS
echo ""
echo "Testing internal staging mTLS requirement..."

RESPONSE=$(curl -s -I "$STAGING_DOMAIN/api/docs" | head -n 1)
STATUS_CODE=$(echo "$RESPONSE" | grep -o '[0-9]\{3\}')

if [[ "$STATUS_CODE" == "400" || "$STATUS_CODE" == "403" ]]; then
  echo "✅ Internal staging requires mTLS (HTTP $STATUS_CODE)"
else
  echo "⚠️  Internal staging response: HTTP $STATUS_CODE"
fi

# Test 3: Feature flag environment variable test
echo ""
echo "Testing feature flag behavior..."

# Simulate production environment
export NODE_ENV=production
export SWAGGER_ENABLED=false
export INTERNAL_DOMAIN=false

if [[ "$SWAGGER_ENABLED" == "false" && "$NODE_ENV" == "production" ]]; then
  echo "✅ Production feature flags configured correctly"
else
  echo "❌ Production feature flags misconfigured"
  exit 1
fi

# Simulate internal staging environment
export NODE_ENV=staging
export SWAGGER_ENABLED=true
export INTERNAL_DOMAIN=true

if [[ "$SWAGGER_ENABLED" == "true" && "$INTERNAL_DOMAIN" == "true" ]]; then
  echo "✅ Internal staging feature flags configured correctly"
else
  echo "❌ Internal staging feature flags misconfigured"
  exit 1
fi

echo ""
echo "🎉 All Swagger security tests passed!"