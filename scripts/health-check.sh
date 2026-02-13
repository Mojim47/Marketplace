#!/bin/bash

# ════════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - System Health Check
# 2026 Ready: Comprehensive Monitoring & Diagnostics
# ════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
COMPOSE_FILE="${1:-docker-compose.prod.yml}"
KUBE_NAMESPACE="${2:-nextgen-prod}"
CHECK_INTERVAL=30

# ────────────────────────────────────────────────────────────────────────────
# Health Check Functions
# ────────────────────────────────────────────────────────────────────────────

print_header() {
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════${NC}\n"
}

check_status() {
    local status=$?
    if [ $status -eq 0 ]; then
        echo -e "${GREEN}✅ $1${NC}"
        return 0
    else
        echo -e "${RED}❌ $1${NC}"
        return 1
    fi
}

# ────────────────────────────────────────────────────────────────────────────
# Docker Compose Checks
# ────────────────────────────────────────────────────────────────────────────

check_docker_containers() {
    print_header "Docker Container Status"
    
    if ! docker ps > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker daemon not running${NC}"
        return 1
    fi
    
    docker compose -f "${COMPOSE_FILE}" ps
    
    # Check for unhealthy containers
    local unhealthy=$(docker compose -f "${COMPOSE_FILE}" ps | grep -c "unhealthy" || true)
    if [ "${unhealthy}" -gt 0 ]; then
        echo -e "${YELLOW}⚠️  Found ${unhealthy} unhealthy containers${NC}"
    fi
}

check_postgres() {
    print_header "PostgreSQL Database"
    
    docker compose -f "${COMPOSE_FILE}" exec postgres \
        pg_isready -U nextgen || {
        check_status "PostgreSQL connection failed"
        return 1
    }
    
    echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
    
    # Check table count
    local table_count=$(docker compose -f "${COMPOSE_FILE}" exec postgres \
        psql -U nextgen -d nextgen_marketplace -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || echo "0")
    
    echo -e "   Tables: ${table_count}"
    
    # Check database size
    local db_size=$(docker compose -f "${COMPOSE_FILE}" exec postgres \
        psql -U nextgen -t -c \
        "SELECT pg_size_pretty(pg_database_size('nextgen_marketplace'));" 2>/dev/null || echo "N/A")
    
    echo -e "   Size: ${db_size}"
}

check_redis() {
    print_header "Redis Cache"
    
    docker compose -f "${COMPOSE_FILE}" exec redis \
        redis-cli -a nextgen123 ping 2>/dev/null | grep -q "PONG" || {
        check_status "Redis connection failed"
        return 1
    }
    
    echo -e "${GREEN}✅ Redis is ready${NC}"
    
    # Check memory usage
    local memory=$(docker compose -f "${COMPOSE_FILE}" exec redis \
        redis-cli -a nextgen123 info memory 2>/dev/null | grep "used_memory_human" | cut -d: -f2 || echo "N/A")
    
    echo -e "   Memory: ${memory}"
    
    # Check connected clients
    local clients=$(docker compose -f "${COMPOSE_FILE}" exec redis \
        redis-cli -a nextgen123 info clients 2>/dev/null | grep "connected_clients" | cut -d: -f2 || echo "N/A")
    
    echo -e "   Connected clients: ${clients}"
}

check_minio() {
    print_header "MinIO Object Storage"
    
    docker compose -f "${COMPOSE_FILE}" exec minio \
        curl -s http://localhost:9000/minio/health/live > /dev/null 2>&1 || {
        check_status "MinIO health check failed"
        return 1
    }
    
    echo -e "${GREEN}✅ MinIO is ready${NC}"
}

check_api() {
    print_header "API Server Health"
    
    local api_response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/v3/health)
    
    if [ "${api_response}" = "200" ]; then
        echo -e "${GREEN}✅ API is healthy (HTTP ${api_response})${NC}"
        
        # Get detailed health info
        curl -s http://localhost:3001/api/v3/health | jq . 2>/dev/null || echo "Cannot parse health response"
    else
        echo -e "${RED}❌ API health check failed (HTTP ${api_response})${NC}"
        return 1
    fi
}

# ────────────────────────────────────────────────────────────────────────────
# Kubernetes Checks
# ────────────────────────────────────────────────────────────────────────────

check_kubernetes() {
    print_header "Kubernetes Cluster Status"
    
    if ! command -v kubectl &> /dev/null; then
        echo -e "${YELLOW}⚠️  kubectl not found, skipping Kubernetes checks${NC}"
        return 0
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info > /dev/null 2>&1; then
        echo -e "${RED}❌ Cannot connect to Kubernetes cluster${NC}"
        return 1
    fi
    
    echo -e "${GREEN}✅ Connected to Kubernetes cluster${NC}\n"
    
    # Check namespace
    echo -e "${BLUE}Namespace Status:${NC}"
    kubectl get namespace "${KUBE_NAMESPACE}" 2>/dev/null || {
        echo -e "${YELLOW}⚠️  Namespace ${KUBE_NAMESPACE} not found${NC}"
        return 0
    }
    
    echo ""
    
    # Check deployments
    echo -e "${BLUE}Deployments:${NC}"
    kubectl get deployments -n "${KUBE_NAMESPACE}" || true
    
    echo ""
    
    # Check pod status
    echo -e "${BLUE}Pods:${NC}"
    kubectl get pods -n "${KUBE_NAMESPACE}" || true
    
    echo ""
    
    # Check services
    echo -e "${BLUE}Services:${NC}"
    kubectl get svc -n "${KUBE_NAMESPACE}" || true
    
    echo ""
    
    # Check PVCs
    echo -e "${BLUE}Persistent Volumes:${NC}"
    kubectl get pvc -n "${KUBE_NAMESPACE}" || true
}

# ────────────────────────────────────────────────────────────────────────────
# System Resource Checks
# ────────────────────────────────────────────────────────────────────────────

check_system_resources() {
    print_header "System Resources"
    
    # CPU Usage
    echo -e "${BLUE}CPU Usage:${NC}"
    if command -v top &> /dev/null; then
        top -bn1 | grep "Cpu(s)" | awk '{print "  " $0}'
    fi
    
    echo ""
    
    # Memory Usage
    echo -e "${BLUE}Memory Usage:${NC}"
    if command -v free &> /dev/null; then
        free -h | tail -n 1 | awk '{print "  Used: " $3 " / Total: " $2}'
    fi
    
    echo ""
    
    # Disk Usage
    echo -e "${BLUE}Disk Usage:${NC}"
    df -h | grep -E "/$|/var" | awk '{print "  " $0}'
    
    echo ""
    
    # Docker Stats
    echo -e "${BLUE}Container Stats:${NC}"
    if command -v docker &> /dev/null; then
        docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
    fi
}

# ────────────────────────────────────────────────────────────────────────────
# Network Checks
# ────────────────────────────────────────────────────────────────────────────

check_network() {
    print_header "Network Connectivity"
    
    # DNS resolution
    echo -e "${BLUE}DNS Resolution:${NC}"
    nslookup localhost > /dev/null 2>&1 && echo "  ✅ DNS working" || echo "  ❌ DNS failed"
    
    echo ""
    
    # Port availability
    echo -e "${BLUE}Port Availability:${NC}"
    
    local ports=(3001 5432 6379 9000 9001)
    for port in "${ports[@]}"; do
        if nc -z localhost "${port}" 2>/dev/null; then
            echo "  ✅ Port ${port} is open"
        else
            echo "  ⚠️  Port ${port} is closed"
        fi
    done
    
    echo ""
    
    # Network interfaces
    echo -e "${BLUE}Network Interfaces:${NC}"
    ip addr show | grep -E "inet " | awk '{print "  " $0}'
}

# ────────────────────────────────────────────────────────────────────────────
# Log Analysis
# ────────────────────────────────────────────────────────────────────────────

check_logs() {
    print_header "Recent Logs & Errors"
    
    # API logs
    echo -e "${BLUE}Latest API Errors (last 10):${NC}"
    docker compose -f "${COMPOSE_FILE}" logs api 2>/dev/null | grep -i "error\|exception" | tail -n 10 || echo "  No errors found"
    
    echo ""
    
    # Database logs
    echo -e "${BLUE}Latest Database Errors (last 10):${NC}"
    docker compose -f "${COMPOSE_FILE}" logs postgres 2>/dev/null | grep -i "error" | tail -n 10 || echo "  No errors found"
}

# ────────────────────────────────────────────────────────────────────────────
# Backup Status
# ────────────────────────────────────────────────────────────────────────────

check_backups() {
    print_header "Backup Status"
    
    local backup_dir="/backups/database"
    
    if [ ! -d "${backup_dir}" ]; then
        echo -e "${YELLOW}⚠️  Backup directory not found: ${backup_dir}${NC}"
        return 0
    fi
    
    echo -e "${BLUE}Latest Backups:${NC}"
    ls -lhS "${backup_dir}" | head -n 6 | tail -n 5 || echo "  No backups found"
    
    echo ""
    
    # Check backup age
    echo -e "${BLUE}Backup Age:${NC}"
    local latest=$(ls -t "${backup_dir}"/*.sql* 2>/dev/null | head -n 1)
    if [ -z "${latest}" ]; then
        echo -e "${RED}  ❌ No backups found${NC}"
    else
        local age=$(date -r "${latest}" +%s)
        local now=$(date +%s)
        local diff=$((now - age))
        local hours=$((diff / 3600))
        echo -e "  Last backup: ${hours} hours ago"
        
        if [ ${hours} -gt 24 ]; then
            echo -e "${YELLOW}  ⚠️  Backup is older than 24 hours${NC}"
        fi
    fi
}

# ────────────────────────────────────────────────────────────────────────────
# Main Health Check
# ────────────────────────────────────────────────────────────────────────────

main() {
    clear
    
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║   NextGen Marketplace - System Health Check               ║"
    echo "║   Time: $(date '+%Y-%m-%d %H:%M:%S')                          ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}\n"
    
    # Run all checks
    check_docker_containers
    echo ""
    
    check_postgres
    echo ""
    
    check_redis
    echo ""
    
    check_minio
    echo ""
    
    check_api
    echo ""
    
    check_kubernetes
    echo ""
    
    check_system_resources
    echo ""
    
    check_network
    echo ""
    
    check_backups
    echo ""
    
    check_logs
    
    # Summary
    echo -e "\n${BLUE}════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}Health check completed at $(date '+%Y-%m-%d %H:%M:%S')${NC}\n"
}

# ────────────────────────────────────────────────────────────────────────────
# Run main
# ────────────────────────────────────────────────────────────────────────────

if [ "${1:-}" = "--watch" ]; then
    while true; do
        main
        sleep "${CHECK_INTERVAL}"
        clear
    done
else
    main
fi
