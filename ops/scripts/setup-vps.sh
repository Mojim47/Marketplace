#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - VPS Production Setup Script
# ═══════════════════════════════════════════════════════════════════════════
# Description: Automated Ubuntu VPS setup for NextGen Marketplace deployment
# Author: NextGen DevOps Team
# Date: 2025-11-25
# Requirements: Fresh Ubuntu 20.04/22.04 LTS VPS with root access
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail  # Exit on error, undefined variable, or pipe failure

# ═══════════════════════════════════════════════════════════════════════════
# Color Output Functions
# ═══════════════════════════════════════════════════════════════════════════
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "\n${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN} $1${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════════════════════════════${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_info() {
    echo -e "${BLUE}→${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# ═══════════════════════════════════════════════════════════════════════════
# Configuration Variables
# ═══════════════════════════════════════════════════════════════════════════
SWAP_SIZE_GB=4
PROJECT_DIR="/opt/nextgen-market"
CADDY_VERSION="2.7.6"
DOCKER_COMPOSE_VERSION="2.24.5"
MIN_MEMORY_GB=2

# ═══════════════════════════════════════════════════════════════════════════
# Pre-flight Checks
# ═══════════════════════════════════════════════════════════════════════════
print_header "NextGen Marketplace VPS Setup - Pre-flight Checks"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "This script must be run as root (use: sudo bash setup-vps.sh)"
    exit 1
fi

print_success "Running as root"

# Check Ubuntu version
if [ -f /etc/os-release ]; then
    . /etc/os-release
    print_info "Detected: $PRETTY_NAME"
    
    if [[ "$ID" != "ubuntu" ]] || [[ ! "$VERSION_ID" =~ ^(20.04|22.04|24.04)$ ]]; then
        print_warning "This script is tested on Ubuntu 20.04/22.04/24.04 LTS"
        read -p "Continue anyway? (y/N): " continue_install
        if [[ ! "$continue_install" =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
else
    print_error "Cannot detect OS version"
    exit 1
fi

# Check available memory
total_memory=$(free -g | awk '/^Mem:/{print $2}')
if [ "$total_memory" -lt "$MIN_MEMORY_GB" ]; then
    print_warning "Recommended memory: ${MIN_MEMORY_GB}GB, Available: ${total_memory}GB"
    print_info "Will create ${SWAP_SIZE_GB}GB swap file to compensate"
fi

# ═══════════════════════════════════════════════════════════════════════════
# Step 1: System Update & Essential Tools
# ═══════════════════════════════════════════════════════════════════════════
print_header "Step 1: Updating System & Installing Essential Tools"

print_info "Updating package lists..."
apt-get update -qq

print_info "Installing security updates..."
apt-get upgrade -y -qq

print_info "Installing essential tools..."
apt-get install -y -qq \
    curl \
    wget \
    git \
    htop \
    vim \
    ufw \
    ca-certificates \
    gnupg \
    lsb-release \
    software-properties-common \
    apt-transport-https

print_success "System updated and essential tools installed"

# ═══════════════════════════════════════════════════════════════════════════
# Step 2: Create Swap Memory (Critical for Next.js builds)
# ═══════════════════════════════════════════════════════════════════════════
print_header "Step 2: Creating ${SWAP_SIZE_GB}GB Swap Memory"

if [ -f /swapfile ]; then
    print_warning "Swap file already exists, skipping..."
else
    print_info "Allocating ${SWAP_SIZE_GB}GB swap space (this may take a few minutes)..."
    
    # Create swap file
    dd if=/dev/zero of=/swapfile bs=1G count=$SWAP_SIZE_GB status=progress
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    
    # Make swap permanent
    if ! grep -q '/swapfile' /etc/fstab; then
        echo '/swapfile none swap sw 0 0' | tee -a /etc/fstab > /dev/null
    fi
    
    # Optimize swap usage
    sysctl vm.swappiness=10
    echo 'vm.swappiness=10' | tee -a /etc/sysctl.conf > /dev/null
    
    print_success "Swap memory created and activated"
    print_info "Current swap status:"
    free -h | grep -i swap
fi

# ═══════════════════════════════════════════════════════════════════════════
# Step 3: Install Docker & Docker Compose
# ═══════════════════════════════════════════════════════════════════════════
print_header "Step 3: Installing Docker & Docker Compose"

if command -v docker &> /dev/null; then
    print_warning "Docker already installed: $(docker --version)"
else
    print_info "Installing Docker..."
    
    # Add Docker's official GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Add Docker repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Start Docker service
    systemctl enable docker
    systemctl start docker
    
    print_success "Docker installed: $(docker --version)"
fi

# Install standalone docker-compose (for compatibility)
if command -v docker-compose &> /dev/null; then
    print_warning "docker-compose already installed: $(docker-compose --version)"
else
    print_info "Installing docker-compose..."
    curl -fsSL "https://github.com/docker/compose/releases/download/v${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    print_success "docker-compose installed: $(docker-compose --version)"
fi

# ═══════════════════════════════════════════════════════════════════════════
# Step 4: Firewall Configuration (UFW)
# ═══════════════════════════════════════════════════════════════════════════
print_header "Step 4: Configuring Firewall (UFW)"

print_info "Setting up firewall rules..."

# Reset UFW to default
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (CRITICAL - don't lock yourself out!)
ufw allow 22/tcp comment 'SSH'

# Allow HTTP/HTTPS for Caddy
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'

# Allow API port (if exposed directly)
# ufw allow 3000/tcp comment 'NextGen API'

# Enable firewall
ufw --force enable

print_success "Firewall configured and enabled"
ufw status numbered

# ═══════════════════════════════════════════════════════════════════════════
# Step 5: Install Caddy (Automatic SSL)
# ═══════════════════════════════════════════════════════════════════════════
print_header "Step 5: Installing Caddy Web Server"

if command -v caddy &> /dev/null; then
    print_warning "Caddy already installed: $(caddy version)"
else
    print_info "Installing Caddy ${CADDY_VERSION}..."
    
    # Install Caddy from official repo
    apt-get install -y -qq debian-keyring debian-archive-keyring
    curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -fsSL 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
    
    apt-get update -qq
    apt-get install -y -qq caddy
    
    # Stop default caddy (we'll configure it later)
    systemctl stop caddy
    systemctl disable caddy
    
    print_success "Caddy installed: $(caddy version)"
fi

# ═══════════════════════════════════════════════════════════════════════════
# Step 6: Clone Project Repository
# ═══════════════════════════════════════════════════════════════════════════
print_header "Step 6: Cloning Project Repository"

# Ask for repository URL
print_info "Enter your Git repository URL:"
read -p "Repository URL: " REPO_URL

if [ -z "$REPO_URL" ]; then
    print_error "Repository URL cannot be empty"
    exit 1
fi

# Clone project
if [ -d "$PROJECT_DIR" ]; then
    print_warning "Project directory already exists: $PROJECT_DIR"
    read -p "Remove and re-clone? (y/N): " re_clone
    if [[ "$re_clone" =~ ^[Yy]$ ]]; then
        rm -rf "$PROJECT_DIR"
        print_info "Cloning repository..."
        git clone "$REPO_URL" "$PROJECT_DIR"
        print_success "Repository cloned to $PROJECT_DIR"
    else
        print_info "Using existing directory"
    fi
else
    print_info "Cloning repository..."
    git clone "$REPO_URL" "$PROJECT_DIR"
    print_success "Repository cloned to $PROJECT_DIR"
fi

cd "$PROJECT_DIR"

# ═══════════════════════════════════════════════════════════════════════════
# Step 7: Environment Configuration
# ═══════════════════════════════════════════════════════════════════════════
print_header "Step 7: Environment Configuration"

if [ -f ".env" ]; then
    print_warning ".env file already exists"
    read -p "Overwrite with new configuration? (y/N): " overwrite_env
    if [[ ! "$overwrite_env" =~ ^[Yy]$ ]]; then
        print_info "Keeping existing .env file"
        print_warning "Make sure your .env has all required variables!"
    else
        rm .env
    fi
fi

if [ ! -f ".env" ]; then
    print_info "Creating .env file with secure configuration..."
    
    # Ask for domain
    read -p "Enter your domain (e.g., api.example.com): " DOMAIN
    
    # Ask for database credentials
    read -p "Enter database name [nextgen_market]: " DB_NAME
    DB_NAME=${DB_NAME:-nextgen_market}
    
    read -p "Enter database user [nextgen_admin]: " DB_USER
    DB_USER=${DB_USER:-nextgen_admin}
    
    print_info "Generate strong database password..."
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    
    print_info "Generate strong Redis password..."
    REDIS_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
    
    print_info "Generate JWT secrets..."
    JWT_SECRET=$(openssl rand -hex 48)
    JWT_REFRESH_SECRET=$(openssl rand -hex 48)
    
    print_info "Generate Grafana credentials..."
    read -p "Enter Grafana admin username [admin]: " GRAFANA_USER
    GRAFANA_USER=${GRAFANA_USER:-admin}
    GRAFANA_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-24)
    
    # Create .env file
    cat > .env << EOF
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Production Environment
# Generated: $(date -u +"%Y-%m-%d %H:%M:%S UTC")
# Domain: ${DOMAIN}
# ═══════════════════════════════════════════════════════════════════════════

# System
NODE_ENV=production
TZ=Asia/Tehran
API_PORT=3000

# Domain
DOMAIN=${DOMAIN}
API_URL=https://${DOMAIN}
CORS_ORIGINS=https://${DOMAIN}

# Database (PostgreSQL 16)
DB_HOST=172.28.0.10
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@172.28.0.10:5432/${DB_NAME}?schema=public

# Redis Cache
REDIS_HOST=172.28.0.11
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# JWT Secrets (CRITICAL - NEVER SHARE)
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Security
BCRYPT_ROUNDS=12
RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

# Monitoring (Grafana)
GRAFANA_USER=${GRAFANA_USER}
GRAFANA_PASSWORD=${GRAFANA_PASSWORD}
GRAFANA_ROOT_URL=https://${DOMAIN}:3001

# Docker
IMAGE_TAG=latest

# Observability
LOG_LEVEL=info
OTEL_SERVICE_NAME=nextgen-api
EOF

    chmod 600 .env
    print_success ".env file created with secure credentials"
    
    # Show important credentials
    print_warning "IMPORTANT: Save these credentials securely!"
    echo ""
    echo "Database Password: ${DB_PASSWORD}"
    echo "Redis Password: ${REDIS_PASSWORD}"
    echo "Grafana User: ${GRAFANA_USER}"
    echo "Grafana Password: ${GRAFANA_PASSWORD}"
    echo ""
    read -p "Press Enter to continue after saving credentials..."
fi

# ═══════════════════════════════════════════════════════════════════════════
# Step 8: Configure Caddy Reverse Proxy
# ═══════════════════════════════════════════════════════════════════════════
print_header "Step 8: Configuring Caddy Reverse Proxy"

# Load domain from .env
source .env

print_info "Setting up Caddy for domain: ${DOMAIN}"

# Create Caddyfile
cat > /etc/caddy/Caddyfile << EOF
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Caddy Configuration
# ═══════════════════════════════════════════════════════════════════════════

# Automatic HTTPS for main API
${DOMAIN} {
    # Enable compression
    encode gzip zstd

    # Reverse proxy to Docker container
    reverse_proxy localhost:3000 {
        # Health check
        health_uri /health
        health_interval 30s
        health_timeout 10s
        
        # Load balancing (single backend for now)
        lb_policy first
        
        # Headers
        header_up X-Real-IP {remote_host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
    }

    # Security headers
    header {
        # Enable HSTS
        Strict-Transport-Security "max-age=31536000; includeSubDomains; preload"
        
        # Prevent clickjacking
        X-Frame-Options "SAMEORIGIN"
        
        # Prevent MIME sniffing
        X-Content-Type-Options "nosniff"
        
        # XSS Protection
        X-XSS-Protection "1; mode=block"
        
        # Referrer Policy
        Referrer-Policy "strict-origin-when-cross-origin"
        
        # Remove server header
        -Server
    }

    # Logging
    log {
        output file /var/log/caddy/${DOMAIN}.log {
            roll_size 100MB
            roll_keep 10
        }
        format json
        level INFO
    }
}

# Monitoring endpoints (optional - secure with basic auth)
# monitor.${DOMAIN} {
#     encode gzip
#     
#     # Grafana
#     reverse_proxy /grafana/* localhost:3001
#     
#     # Prometheus
#     reverse_proxy /prometheus/* localhost:9090
#     
#     # Basic Auth (replace with your credentials)
#     basicauth {
#         admin \$2a\$14\$hashed_password_here
#     }
# }
EOF

# Test Caddy configuration
print_info "Testing Caddy configuration..."
caddy validate --config /etc/caddy/Caddyfile

if [ $? -eq 0 ]; then
    print_success "Caddy configuration is valid"
    
    # Start Caddy
    systemctl enable caddy
    systemctl restart caddy
    
    print_success "Caddy is running with automatic SSL"
else
    print_error "Caddy configuration is invalid!"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════
# Step 9: Initialize Database Schema
# ═══════════════════════════════════════════════════════════════════════════
print_header "Step 9: Preparing Database"

print_info "Starting PostgreSQL container for schema initialization..."

# Start only postgres
docker-compose -f docker-compose.prod.yml up -d postgres

# Wait for postgres to be ready
print_info "Waiting for PostgreSQL to be ready..."
sleep 10

# Use pnpm
PKG_MANAGER="pnpm"


# Run Prisma migrations
print_info "Running database migrations..."
if [ -f "package.json" ]; then
    pnpm install --frozen-lockfile
    
    npx prisma migrate deploy
    npx prisma generate
    
    print_success "Database schema initialized"
else
    print_warning "No package.json found, skipping Prisma migrations"
    print_warning "You may need to run migrations manually later"
fi

# ═══════════════════════════════════════════════════════════════════════════
# Step 10: Launch All Services
# ═══════════════════════════════════════════════════════════════════════════
print_header "Step 10: Launching All Services"

print_info "Building and starting all Docker containers..."
docker-compose -f docker-compose.prod.yml up -d --build

print_info "Waiting for services to start..."
sleep 15

# Check service health
print_header "Service Health Check"

services=("postgres" "redis" "api")
all_healthy=true

for service in "${services[@]}"; do
    if docker-compose -f docker-compose.prod.yml ps | grep -q "$service.*Up"; then
        print_success "$service is running"
    else
        print_error "$service is NOT running"
        all_healthy=false
    fi
done

# ═══════════════════════════════════════════════════════════════════════════
# Final Summary
# ═══════════════════════════════════════════════════════════════════════════
print_header "Deployment Complete! 🚀"

echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "                         DEPLOYMENT SUMMARY"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo "🌐 API Endpoint:      https://${DOMAIN}"
echo "🔧 API Health:        https://${DOMAIN}/health"
echo "📊 Swagger Docs:      https://${DOMAIN}/api/docs"
echo ""
echo "📁 Project Directory: ${PROJECT_DIR}"
echo "🐳 Docker Status:     docker-compose -f docker-compose.prod.yml ps"
echo "📋 Logs:              docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo "                         IMPORTANT NOTES"
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""
echo "✓ Swap Memory:        ${SWAP_SIZE_GB}GB created"
echo "✓ Firewall (UFW):     Enabled (SSH, HTTP, HTTPS)"
echo "✓ SSL Certificates:   Automatic via Caddy (Let's Encrypt)"
echo "✓ Auto-restart:       All services set to 'restart: always'"
echo ""
echo "⚠️  Security Checklist:"
echo "   1. Change default SSH port (optional): nano /etc/ssh/sshd_config"
echo "   2. Set up SSH key authentication (disable password auth)"
echo "   3. Configure backup strategy for database"
echo "   4. Set up monitoring alerts"
echo "   5. Review .env file permissions (should be 600)"
echo ""
echo "🔐 Credentials saved in: ${PROJECT_DIR}/.env"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════"
echo ""

if [ "$all_healthy" = true ]; then
    print_success "All services are healthy! 🎉"
    echo ""
    print_info "Your application should be accessible at: https://${DOMAIN}"
else
    print_warning "Some services are not healthy. Check logs:"
    echo "   docker-compose -f docker-compose.prod.yml logs"
fi

echo ""
print_info "Useful commands:"
echo "   View logs:    docker-compose -f docker-compose.prod.yml logs -f [service]"
echo "   Restart:      docker-compose -f docker-compose.prod.yml restart"
echo "   Stop:         docker-compose -f docker-compose.prod.yml down"
echo "   Update code:  cd ${PROJECT_DIR} && git pull && docker-compose -f docker-compose.prod.yml up -d --build"
echo ""

print_header "Setup Complete! 🎉"