#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# NETWORK SECURITY VALIDATION SCRIPT
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Validate network hardening and Istio policies
# Usage: ./network-security-validation.sh
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✅${NC} $1"; }
error() { echo -e "${RED}❌${NC} $1"; }
warn() { echo -e "${YELLOW}⚠️${NC} $1"; }

NAMESPACE="nextgen"
CLUSTER_IP=""
FAILED_TESTS=0

# Get cluster external IP
get_cluster_ip() {
    log "Getting cluster external IP..."
    CLUSTER_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="ExternalIP")].address}')
    if [ -z "$CLUSTER_IP" ]; then
        CLUSTER_IP=$(kubectl get nodes -o jsonpath='{.items[0].status.addresses[?(@.type=="InternalIP")].address}')
    fi
    log "Using cluster IP: $CLUSTER_IP"
}

# Test external port access (should be blocked)
test_external_access() {
    log "Testing external access to database ports..."
    
    # Test PostgreSQL port
    if timeout 5 nc -z "$CLUSTER_IP" 5432 2>/dev/null; then
        error "PostgreSQL port 5432 is accessible from external network!"
        ((FAILED_TESTS++))
    else
        success "PostgreSQL port 5432 is properly blocked from external access"
    fi
    
    # Test Redis port
    if timeout 5 nc -z "$CLUSTER_IP" 6379 2>/dev/null; then
        error "Redis port 6379 is accessible from external network!"
        ((FAILED_TESTS++))
    else
        success "Redis port 6379 is properly blocked from external access"
    fi
}

# Test nmap scan
test_nmap_scan() {
    log "Running nmap scan on database ports..."
    
    if command -v nmap >/dev/null 2>&1; then
        NMAP_RESULT=$(nmap -p 5432,6379 "$CLUSTER_IP" 2>/dev/null | grep -E "(5432|6379)")
        
        if echo "$NMAP_RESULT" | grep -q "open"; then
            error "nmap shows database ports as open:"
            echo "$NMAP_RESULT"
            ((FAILED_TESTS++))
        else
            success "nmap confirms database ports are filtered/closed"
            echo "$NMAP_RESULT"
        fi
    else
        warn "nmap not available, skipping port scan test"
    fi
}

# Test internal service access (should work)
test_internal_access() {
    log "Testing internal service mesh access..."
    
    # Get API pod name
    API_POD=$(kubectl get pods -n "$NAMESPACE" -l app=nextgen-api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -z "$API_POD" ]; then
        warn "No API pod found, skipping internal access test"
        return
    fi
    
    # Test PostgreSQL internal access
    if kubectl exec -n "$NAMESPACE" "$API_POD" -- timeout 5 nc -z postgres.nextgen.svc.cluster.local 5432 2>/dev/null; then
        success "Internal PostgreSQL access works via service mesh"
    else
        error "Internal PostgreSQL access failed!"
        ((FAILED_TESTS++))
    fi
    
    # Test Redis internal access
    if kubectl exec -n "$NAMESPACE" "$API_POD" -- timeout 5 nc -z redis.nextgen.svc.cluster.local 6379 2>/dev/null; then
        success "Internal Redis access works via service mesh"
    else
        error "Internal Redis access failed!"
        ((FAILED_TESTS++))
    fi
}

# Test Istio policies
test_istio_policies() {
    log "Validating Istio authorization policies..."
    
    # Check if policies exist
    POSTGRES_POLICY=$(kubectl get authorizationpolicy -n "$NAMESPACE" deny-postgres-direct-access -o name 2>/dev/null || echo "")
    REDIS_POLICY=$(kubectl get authorizationpolicy -n "$NAMESPACE" deny-redis-direct-access -o name 2>/dev/null || echo "")
    
    if [ -n "$POSTGRES_POLICY" ]; then
        success "PostgreSQL authorization policy exists"
    else
        error "PostgreSQL authorization policy not found!"
        ((FAILED_TESTS++))
    fi
    
    if [ -n "$REDIS_POLICY" ]; then
        success "Redis authorization policy exists"
    else
        error "Redis authorization policy not found!"
        ((FAILED_TESTS++))
    fi
    
    # Check mTLS policy
    MTLS_POLICY=$(kubectl get peerauthentication -n "$NAMESPACE" default -o name 2>/dev/null || echo "")
    if [ -n "$MTLS_POLICY" ]; then
        success "mTLS peer authentication policy exists"
    else
        error "mTLS peer authentication policy not found!"
        ((FAILED_TESTS++))
    fi
}

# Test network policies
test_network_policies() {
    log "Validating Kubernetes network policies..."
    
    POSTGRES_NETPOL=$(kubectl get networkpolicy -n "$NAMESPACE" deny-direct-database-access -o name 2>/dev/null || echo "")
    REDIS_NETPOL=$(kubectl get networkpolicy -n "$NAMESPACE" deny-direct-redis-access -o name 2>/dev/null || echo "")
    
    if [ -n "$POSTGRES_NETPOL" ]; then
        success "PostgreSQL network policy exists"
    else
        error "PostgreSQL network policy not found!"
        ((FAILED_TESTS++))
    fi
    
    if [ -n "$REDIS_NETPOL" ]; then
        success "Redis network policy exists"
    else
        error "Redis network policy not found!"
        ((FAILED_TESTS++))
    fi
}

# Test unauthorized access from test pod
test_unauthorized_access() {
    log "Testing unauthorized access from test pod..."
    
    # Create test pod without proper service account
    kubectl run test-unauthorized --image=busybox --rm -i --restart=Never --namespace="$NAMESPACE" -- timeout 5 nc -z postgres.nextgen.svc.cluster.local 5432 2>/dev/null
    
    if [ $? -eq 0 ]; then
        error "Unauthorized pod can access PostgreSQL!"
        ((FAILED_TESTS++))
    else
        success "Unauthorized access to PostgreSQL is properly blocked"
    fi
}

# Test service mesh metrics
test_service_mesh_metrics() {
    log "Checking service mesh metrics..."
    
    # Check if Istio proxy is injected
    API_POD=$(kubectl get pods -n "$NAMESPACE" -l app=nextgen-api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -n "$API_POD" ]; then
        SIDECAR_COUNT=$(kubectl get pod -n "$NAMESPACE" "$API_POD" -o jsonpath='{.spec.containers[*].name}' | grep -c istio-proxy || echo "0")
        
        if [ "$SIDECAR_COUNT" -gt 0 ]; then
            success "Istio sidecar is properly injected"
        else
            error "Istio sidecar not found in API pod!"
            ((FAILED_TESTS++))
        fi
    fi
}

# Performance impact test
test_performance_impact() {
    log "Testing performance impact..."
    
    API_POD=$(kubectl get pods -n "$NAMESPACE" -l app=nextgen-api -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")
    
    if [ -n "$API_POD" ]; then
        # Test API response time
        RESPONSE_TIME=$(kubectl exec -n "$NAMESPACE" "$API_POD" -- timeout 10 curl -w "%{time_total}" -s -o /dev/null http://localhost:3000/health 2>/dev/null || echo "0")
        
        if (( $(echo "$RESPONSE_TIME < 1.0" | bc -l) )); then
            success "API response time is acceptable: ${RESPONSE_TIME}s"
        else
            warn "API response time is high: ${RESPONSE_TIME}s"
        fi
    fi
}

# Generate security report
generate_report() {
    log "Generating security validation report..."
    
    REPORT_FILE="network-security-validation-$(date +%Y%m%d-%H%M%S).txt"
    
    cat > "$REPORT_FILE" << EOF
NETWORK SECURITY VALIDATION REPORT
Generated: $(date)
Cluster IP: $CLUSTER_IP
Namespace: $NAMESPACE

SUMMARY:
- Total Tests: 8
- Failed Tests: $FAILED_TESTS
- Success Rate: $(( (8 - FAILED_TESTS) * 100 / 8 ))%

SECURITY STATUS: $([ $FAILED_TESTS -eq 0 ] && echo "✅ SECURE" || echo "❌ VULNERABILITIES FOUND")

RECOMMENDATIONS:
$([ $FAILED_TESTS -gt 0 ] && echo "- Review failed tests and fix security issues" || echo "- All security tests passed")
- Continue monitoring with regular validation
- Update security policies as needed
- Schedule next validation in 7 days

EOF
    
    success "Report saved to: $REPORT_FILE"
}

# Main execution
main() {
    log "Starting network security validation..."
    
    # Check prerequisites
    if ! command -v kubectl >/dev/null 2>&1; then
        error "kubectl not found. Please install kubectl."
        exit 1
    fi
    
    if ! kubectl cluster-info >/dev/null 2>&1; then
        error "Cannot connect to Kubernetes cluster."
        exit 1
    fi
    
    # Run tests
    get_cluster_ip
    test_external_access
    test_nmap_scan
    test_internal_access
    test_istio_policies
    test_network_policies
    test_unauthorized_access
    test_service_mesh_metrics
    test_performance_impact
    
    # Generate report
    generate_report
    
    # Final result
    if [ $FAILED_TESTS -eq 0 ]; then
        success "All security tests passed! Network is properly hardened."
        exit 0
    else
        error "$FAILED_TESTS security tests failed. Please review and fix issues."
        exit 1
    fi
}

# Run main function
main "$@"