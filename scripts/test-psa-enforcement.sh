#!/bin/bash
set -e

echo "🔒 Testing Pod Security Standards Enforcement"

# Test 1: Apply secure deployment (should succeed)
echo "✅ Testing secure deployment..."
kubectl apply -f k8s/secure-deployment.yaml --dry-run=server
echo "Secure deployment validation passed"

# Test 2: Try insecure deployment (should fail)
echo "❌ Testing insecure deployment (should fail)..."
if kubectl apply -f security/opa/sample-violations.yaml --dry-run=server 2>/dev/null; then
    echo "ERROR: Insecure deployment was allowed!"
    exit 1
else
    echo "✅ Insecure deployment correctly rejected"
fi

# Test 3: Check namespace PSA labels
echo "🏷️ Verifying namespace PSA labels..."
kubectl get namespace nextgen-market -o jsonpath='{.metadata.labels}' | grep -q "pod-security.kubernetes.io/enforce.*restricted"
echo "✅ Namespace PSA labels configured correctly"

# Test 4: Run kube-score on secure deployment
echo "📊 Running kube-score analysis..."
kubectl apply -f k8s/secure-deployment.yaml --dry-run=client -o yaml | kube-score score -
echo "✅ kube-score analysis completed"

echo "🎉 All PSA enforcement tests passed!"