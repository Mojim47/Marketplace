#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Blue-Green Deployment Script
# ═══════════════════════════════════════════════════════════════════════════
# Zero-downtime deployment using Blue-Green strategy
# Requirements: 5.4
#
# Usage:
#   ./scripts/blue-green-deploy.sh deploy <image-tag>
#   ./scripts/blue-green-deploy.sh switch
#   ./scripts/blue-green-deploy.sh rollback
#   ./scripts/blue-green-deploy.sh status
# ═══════════════════════════════════════════════════════════════════════════

set -e

# Configuration
NAMESPACE="${NAMESPACE:-nextgen}"
SERVICE_NAME="${SERVICE_NAME:-api-blue-green}"
BLUE_DEPLOYMENT="api-blue"
GREEN_DEPLOYMENT="api-green"
HEALTH_CHECK_RETRIES="${HEALTH_CHECK_RETRIES:-30}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-10}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get current active deployment color
get_active_color() {
    kubectl get service "$SERVICE_NAME" -n "$NAMESPACE" -o jsonpath='{.spec.selector.version}' 2>/dev/null || echo "blue"
}

# Get inactive deployment color
get_inactive_color() {
    local active=$(get_active_color)
    if [ "$active" == "blue" ]; then
        echo "green"
    else
        echo "blue"
    fi
}

# Get deployment name from color
get_deployment_name() {
    local color=$1
    if [ "$color" == "blue" ]; then
        echo "$BLUE_DEPLOYMENT"
    else
        echo "$GREEN_DEPLOYMENT"
    fi
}

# Check if deployment is healthy
check_deployment_health() {
    local deployment=$1
    local retries=$HEALTH_CHECK_RETRIES
    local interval=$HEALTH_CHECK_INTERVAL

    log_info "Checking health of deployment: $deployment"

    for ((i=1; i<=retries; i++)); do
        local ready=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo "0")
        local desired=$(kubectl get deployment "$deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

        if [ "$ready" == "$desired" ] && [ "$ready" != "0" ]; then
            log_success "Deployment $deployment is healthy ($ready/$desired pods ready)"
            return 0
        fi

        log_info "Waiting for deployment to be ready ($ready/$desired)... Attempt $i/$retries"
        sleep "$interval"
    done

    log_error "Deployment $deployment failed health check"
    return 1
}

# Deploy new version to inactive deployment
deploy() {
    local image_tag=$1

    if [ -z "$image_tag" ]; then
        log_error "Image tag is required"
        echo "Usage: $0 deploy <image-tag>"
        exit 1
    fi

    local inactive_color=$(get_inactive_color)
    local inactive_deployment=$(get_deployment_name "$inactive_color")

    log_info "Deploying to $inactive_color deployment ($inactive_deployment)"
    log_info "Image tag: $image_tag"

    # Update the inactive deployment with new image
    kubectl set image deployment/"$inactive_deployment" \
        api="ghcr.io/nextgen/marketplace-api:$image_tag" \
        -n "$NAMESPACE"

    # Scale up the inactive deployment
    log_info "Scaling up $inactive_deployment to 3 replicas"
    kubectl scale deployment "$inactive_deployment" --replicas=3 -n "$NAMESPACE"

    # Wait for deployment to be ready
    log_info "Waiting for deployment to be ready..."
    kubectl rollout status deployment/"$inactive_deployment" -n "$NAMESPACE" --timeout=300s

    # Check health
    if check_deployment_health "$inactive_deployment"; then
        log_success "Deployment successful! New version is ready on $inactive_color"
        log_info "Run '$0 switch' to switch traffic to the new version"
        log_info "Run '$0 status' to see current deployment status"
    else
        log_error "Deployment failed health check"
        log_warning "Rolling back $inactive_deployment"
        kubectl rollout undo deployment/"$inactive_deployment" -n "$NAMESPACE"
        kubectl scale deployment "$inactive_deployment" --replicas=0 -n "$NAMESPACE"
        exit 1
    fi
}

# Switch traffic to the other deployment
switch_traffic() {
    local active_color=$(get_active_color)
    local inactive_color=$(get_inactive_color)
    local inactive_deployment=$(get_deployment_name "$inactive_color")

    log_info "Current active deployment: $active_color"
    log_info "Switching traffic to: $inactive_color"

    # Verify inactive deployment is healthy before switching
    if ! check_deployment_health "$inactive_deployment"; then
        log_error "Cannot switch traffic - $inactive_color deployment is not healthy"
        exit 1
    fi

    # Update service selector to point to inactive deployment
    kubectl patch service "$SERVICE_NAME" -n "$NAMESPACE" \
        -p "{\"spec\":{\"selector\":{\"version\":\"$inactive_color\"}}}"

    log_success "Traffic switched to $inactive_color deployment"

    # Scale down the old deployment after a delay
    local old_deployment=$(get_deployment_name "$active_color")
    log_info "Keeping $active_color deployment running for quick rollback"
    log_info "Run '$0 cleanup' to scale down the old deployment"
}

# Rollback to previous deployment
rollback() {
    local active_color=$(get_active_color)
    local inactive_color=$(get_inactive_color)
    local inactive_deployment=$(get_deployment_name "$inactive_color")

    log_warning "Rolling back from $active_color to $inactive_color"

    # Check if inactive deployment has pods
    local replicas=$(kubectl get deployment "$inactive_deployment" -n "$NAMESPACE" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo "0")

    if [ "$replicas" == "0" ]; then
        log_error "Cannot rollback - $inactive_color deployment has no replicas"
        log_info "You may need to redeploy the previous version"
        exit 1
    fi

    # Verify inactive deployment is healthy
    if ! check_deployment_health "$inactive_deployment"; then
        log_error "Cannot rollback - $inactive_color deployment is not healthy"
        exit 1
    fi

    # Switch traffic back
    kubectl patch service "$SERVICE_NAME" -n "$NAMESPACE" \
        -p "{\"spec\":{\"selector\":{\"version\":\"$inactive_color\"}}}"

    log_success "Rolled back to $inactive_color deployment"
}

# Cleanup old deployment
cleanup() {
    local inactive_color=$(get_inactive_color)
    local inactive_deployment=$(get_deployment_name "$inactive_color")

    log_info "Scaling down $inactive_color deployment ($inactive_deployment)"
    kubectl scale deployment "$inactive_deployment" --replicas=0 -n "$NAMESPACE"

    log_success "Cleanup complete - $inactive_deployment scaled to 0"
}

# Show deployment status
status() {
    local active_color=$(get_active_color)

    echo ""
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo "                    Blue-Green Deployment Status"
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo ""
    echo -e "Active Deployment: ${GREEN}$active_color${NC}"
    echo ""

    echo "Blue Deployment ($BLUE_DEPLOYMENT):"
    kubectl get deployment "$BLUE_DEPLOYMENT" -n "$NAMESPACE" -o wide 2>/dev/null || echo "  Not found"
    echo ""

    echo "Green Deployment ($GREEN_DEPLOYMENT):"
    kubectl get deployment "$GREEN_DEPLOYMENT" -n "$NAMESPACE" -o wide 2>/dev/null || echo "  Not found"
    echo ""

    echo "Service ($SERVICE_NAME):"
    kubectl get service "$SERVICE_NAME" -n "$NAMESPACE" -o wide 2>/dev/null || echo "  Not found"
    echo ""

    echo "Pods:"
    kubectl get pods -n "$NAMESPACE" -l app=nextgen-api --show-labels 2>/dev/null || echo "  No pods found"
    echo ""
    echo "═══════════════════════════════════════════════════════════════════════════"
}

# Main script
case "${1:-status}" in
    deploy)
        deploy "$2"
        ;;
    switch)
        switch_traffic
        ;;
    rollback)
        rollback
        ;;
    cleanup)
        cleanup
        ;;
    status)
        status
        ;;
    help|--help|-h)
        echo "Blue-Green Deployment Script"
        echo ""
        echo "Usage: $0 <command> [options]"
        echo ""
        echo "Commands:"
        echo "  deploy <tag>  Deploy new version to inactive deployment"
        echo "  switch        Switch traffic to the new deployment"
        echo "  rollback      Rollback to the previous deployment"
        echo "  cleanup       Scale down the inactive deployment"
        echo "  status        Show current deployment status"
        echo "  help          Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  NAMESPACE              Kubernetes namespace (default: nextgen)"
        echo "  SERVICE_NAME           Service name (default: api-blue-green)"
        echo "  HEALTH_CHECK_RETRIES   Number of health check retries (default: 30)"
        echo "  HEALTH_CHECK_INTERVAL  Seconds between health checks (default: 10)"
        ;;
    *)
        log_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
