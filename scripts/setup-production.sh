#!/bin/bash

# ════════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Production Environment Setup
# 2026 Ready: Automated, Secure, Validated
# ════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "${SCRIPT_DIR}")"
ENV_FILE="${PROJECT_ROOT}/.env.production"
BACKUP_DIR="/backups/database"
LOG_DIR="/var/log/nextgen"

# ────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ────────────────────────────────────────────────────────────────────────────

log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

check_command() {
    if ! command -v "$1" &> /dev/null; then
        log_error "$1 not found. Please install it."
        return 1
    fi
    log_success "$1 is installed"
}

generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

generate_jwt_secret() {
    openssl rand -base64 32
}

# ────────────────────────────────────────────────────────────────────────────
# Main Setup
# ────────────────────────────────────────────────────────────────────────────

main() {
    echo -e "${BLUE}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║   NextGen Marketplace - Production Setup 2026              ║"
    echo "║   Automated Configuration & Validation                     ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    # Step 1: Check Prerequisites
    log_info "Step 1/6: Checking prerequisites..."
    
    check_command docker || exit 1
    check_command docker-compose || exit 1
    check_command openssl || exit 1
    check_command psql || exit 1
    
    log_success "All prerequisites met"

    # Step 2: Create directories
    log_info "\nStep 2/6: Creating required directories..."
    
    mkdir -p "${BACKUP_DIR}"
    mkdir -p "${LOG_DIR}"
    mkdir -p "${PROJECT_ROOT}/scripts/db"
    
    log_success "Directories created"

    # Step 3: Generate secure environment file
    log_info "\nStep 3/6: Generating secure environment configuration..."
    
    if [ -f "${ENV_FILE}" ]; then
        log_warning "Environment file already exists at ${ENV_FILE}"
        read -p "Overwrite? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_warning "Skipping environment file generation"
            return 0
        fi
    fi

    # Generate secure passwords
    DB_PASSWORD=$(generate_password)
    REDIS_PASSWORD=$(generate_password)
    MINIO_PASSWORD=$(generate_password)
    JWT_SECRET=$(generate_jwt_secret)

    # Create environment file
    cat > "${ENV_FILE}" << EOF
# ════════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Production Environment
# Generated: $(date)
# ════════════════════════════════════════════════════════════════════════════

# ─── Application ──────────────────────────────────────────────────────────
NODE_ENV=production
LOG_LEVEL=info

# ─── Database Configuration ──────────────────────────────────────────────
DB_HOST=postgres
DB_PORT=5432
DB_USER=nextgen-prod
DB_PASSWORD=${DB_PASSWORD}
DB_NAME=nextgen_marketplace_prod
DATABASE_URL=postgresql://nextgen-prod:${DB_PASSWORD}@postgres:5432/nextgen_marketplace_prod

# ─── Redis Configuration ─────────────────────────────────────────────────
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379/0
REDIS_CACHE_URL=redis://:${REDIS_PASSWORD}@redis:6379/1
REDIS_QUEUE_URL=redis://:${REDIS_PASSWORD}@redis:6379/2

# ─── MinIO Configuration ─────────────────────────────────────────────────
MINIO_ENDPOINT=minio
MINIO_PORT=9000
MINIO_CONSOLE_PORT=9001
MINIO_ROOT_USER=minioadmin-prod
MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}
MINIO_BUCKET=nextgen-uploads
MINIO_USE_SSL=false
MINIO_SERVER_URL=http://minio:9000
MINIO_BROWSER_URL=http://localhost:9001

# ─── API Configuration ───────────────────────────────────────────────────
API_PORT=3001
API_HOST=0.0.0.0
API_WORKERS=4

# ─── JWT Configuration ──────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRATION=7d

# ─── CORS Configuration ──────────────────────────────────────────────────
ALLOWED_ORIGINS=https://app.nextgen.ir,https://admin.nextgen.ir,https://vendor.nextgen.ir

# ─── Monitoring & Logging ─────────────────────────────────────────────
LOG_DIR=${LOG_DIR}
METRICS_PORT=9090

# ─── Backup Configuration ────────────────────────────────────────────
BACKUP_DIR=${BACKUP_DIR}
BACKUP_RETENTION_DAYS=30
BACKUP_SCHEDULE="0 2 * * *"  # Daily at 2 AM

# ─── Security ──────────────────────────────────────────────────────
ENABLE_HTTPS=true
ENABLE_RATE_LIMITING=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# ─── Worker Configuration ──────────────────────────────────────────
WORKER_CONCURRENCY=10
WORKER_TIMEOUT=30000

# ─── Payment Gateways ──────────────────────────────────────────────
ZARINPAL_MERCHANT_ID=your-merchant-id
ZARINPAL_API_KEY=your-api-key
MOODIAN_API_KEY=your-api-key

# ─── Email Configuration ──────────────────────────────────────────
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=noreply@nextgen.ir

# ─── Slack Integration (optional) ──────────────────────────────
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# ─── AWS Configuration (for S3 backups) ────────────────────────
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_S3_BUCKET=nextgen-backups
EOF

    chmod 600 "${ENV_FILE}"
    log_success "Environment file created: ${ENV_FILE}"

    # Step 4: Validate environment
    log_info "\nStep 4/6: Validating environment configuration..."
    
    if ! grep -q "DB_PASSWORD" "${ENV_FILE}"; then
        log_error "Invalid environment file"
        exit 1
    fi
    
    log_success "Environment configuration is valid"

    # Step 5: Build Docker images
    log_info "\nStep 5/6: Building production Docker images..."
    
    cd "${PROJECT_ROOT}"
    
    if docker build -f Dockerfile.prod -t nextgen-marketplace:prod . > /dev/null 2>&1; then
        log_success "Docker image built successfully"
    else
        log_error "Docker build failed"
        exit 1
    fi

    # Step 6: Final checks
    log_info "\nStep 6/6: Running final validation checks..."
    
    # Check Docker daemon
    if ! docker ps > /dev/null 2>&1; then
        log_error "Docker daemon is not running"
        exit 1
    fi
    log_success "Docker daemon is running"

    # Check disk space
    DISK_USAGE=$(df -h "${PROJECT_ROOT}" | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "${DISK_USAGE}" -gt 90 ]; then
        log_warning "Disk usage is above 90%"
    else
        log_success "Adequate disk space available"
    fi

    # ────────────────────────────────────────────────────────────────────────
    # Summary
    # ────────────────────────────────────────────────────────────────────────

    echo -e "\n${GREEN}"
    echo "╔════════════════════════════════════════════════════════════╗"
    echo "║          ✅ Setup Completed Successfully!                 ║"
    echo "╚════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"

    cat << EOF

📋 Configuration Summary:
  • Environment file: ${ENV_FILE}
  • Backup directory: ${BACKUP_DIR}
  • Logs directory: ${LOG_DIR}
  • Database: PostgreSQL 16
  • Cache: Redis 7
  • Storage: MinIO (S3-compatible)

🚀 Next Steps:

  1. Review and update credentials:
     nano ${ENV_FILE}

  2. Start Docker Compose:
     source ${ENV_FILE}
     docker compose -f docker-compose.prod.yml up -d

  3. Initialize database:
     docker compose -f docker-compose.prod.yml exec api npx prisma migrate deploy

  4. Verify health:
     curl http://localhost:3001/api/v3/health

  5. For Kubernetes deployment:
     kubectl apply -f k8s/k8s-production.yaml

📚 Documentation:
  • Deployment Guide: ./DEPLOYMENT_2026_PRODUCTION.md
  • Database Scripts: ./scripts/
  • Kubernetes Manifests: ./k8s/

⚠️  IMPORTANT SECURITY NOTES:
  • Keep .env.production secure (never commit to git)
  • Update all passwords before production deployment
  • Configure SMTP credentials for email notifications
  • Setup SSL/TLS certificates
  • Enable automated backups

🔗 Useful Commands:

  # View logs
  docker compose -f docker-compose.prod.yml logs -f api

  # Database backup
  bash ./scripts/backup-database.sh

  # Database restore
  bash ./scripts/recover-database.sh -f /path/to/backup.sql.gz

  # Health check
  curl -s http://localhost:3001/api/v3/health | jq .

  # Monitor containers
  docker stats

EOF

    log_success "\n✨ Your NextGen Marketplace is ready for 2026!"
}

# ────────────────────────────────────────────────────────────────────────────
# Run main function
# ────────────────────────────────────────────────────────────────────────────

main "$@"
