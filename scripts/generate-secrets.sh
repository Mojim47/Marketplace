#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Secure Secrets Generator
# ═══════════════════════════════════════════════════════════════════════════
# Purpose: Generate cryptographically secure secrets for .env file
# Context: Part of emergency security hardening (2025-11-24)
# Security: Uses /dev/urandom and openssl for maximum entropy
# ═══════════════════════════════════════════════════════════════════════════

set -e
set -o pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ═══════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"
ENV_EXAMPLE="${PROJECT_ROOT}/.env.example"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔐 NextGen Marketplace - Secrets Generator${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "📍 Project Root: ${PROJECT_ROOT}"
echo -e "⏰ Started: $(date)"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Helper Functions
# ═══════════════════════════════════════════════════════════════════════════

# Generate random string using openssl
generate_random() {
  local length=${1:-32}
  openssl rand -base64 "$length" | tr -d "=+/" | cut -c1-"$length"
}

# Generate random hex string
generate_random_hex() {
  local length=${1:-32}
  openssl rand -hex "$((length / 2))"
}

# Generate UUID v4
generate_uuid() {
  if command -v uuidgen &> /dev/null; then
    uuidgen | tr '[:upper:]' '[:lower:]'
  else
    # Fallback: Generate UUID manually
    local hex=$(openssl rand -hex 16)
    echo "${hex:0:8}-${hex:8:4}-4${hex:13:3}-${hex:16:4}-${hex:20:12}"
  fi
}

# Generate strong password (alphanumeric + special chars)
generate_password() {
  local length=${1:-32}
  # Use alphanumeric + safe special chars (avoid quotes and backslashes)
  LC_ALL=C tr -dc 'A-Za-z0-9!@#$%^&*()_+-=[]{}:;<>?' < /dev/urandom | head -c "$length"
}

# Check if .env already exists
check_existing_env() {
  if [ -f "$ENV_FILE" ]; then
    echo -e "${YELLOW}⚠  WARNING: .env file already exists${NC}"
    echo -e "   Path: $ENV_FILE"
    echo ""
    read -p "   Overwrite existing file? (y/n) [n]: " -n 1 -r REPLY
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      echo -e "${RED}✗ Aborted by user${NC}"
      exit 0
    fi
    echo -e "${YELLOW}⚠  Creating backup...${NC}"
    cp "$ENV_FILE" "${ENV_FILE}.backup.$(date +%Y%m%d-%H%M%S)"
    echo -e "${GREEN}✓ Backup created${NC}"
    echo ""
  fi
}

# ═══════════════════════════════════════════════════════════════════════════
# Step 1: Check Prerequisites
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}[1/3]${NC} Checking prerequisites..."

if ! command -v openssl &> /dev/null; then
  echo -e "${RED}✗ ERROR: openssl is required but not installed${NC}"
  exit 1
fi

echo -e "${GREEN}✓${NC} openssl found: $(openssl version | cut -d' ' -f2)"

check_existing_env

echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Step 2: Generate Secrets
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}[2/3]${NC} Generating cryptographically secure secrets..."

# Database secrets
DB_PASSWORD=$(generate_password 32)
DB_USER="nextgen_user"
DB_NAME="nextgen_marketplace"

# Redis secrets
REDIS_PASSWORD=$(generate_password 32)

# JWT secrets
JWT_SECRET=$(generate_random_hex 64)
JWT_REFRESH_SECRET=$(generate_random_hex 64)
JWT_ACCESS_EXPIRY="15m"
JWT_REFRESH_EXPIRY="7d"

# Session secret
SESSION_SECRET=$(generate_random_hex 64)

# Encryption key (for sensitive data)
ENCRYPTION_KEY=$(generate_random_hex 64)

# API keys
API_KEY=$(generate_random_hex 32)
INTERNAL_API_KEY=$(generate_random_hex 32)

# Admin credentials (user must change on first login)
ADMIN_EMAIL="admin@nextgen-marketplace.local"
ADMIN_PASSWORD=$(generate_password 32)

# CORS (must be configured)
CORS_ORIGINS="https://your-domain.com"

# Generate unique instance ID
INSTANCE_ID=$(generate_uuid)

echo -e "${GREEN}✓${NC} Generated $(echo -e "DB_PASSWORD\nREDIS_PASSWORD\nJWT_SECRET\nJWT_REFRESH_SECRET\nSESSION_SECRET\nENCRYPTION_KEY\nAPI_KEY\nINTERNAL_API_KEY\nADMIN_PASSWORD" | wc -l) secure secrets"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Step 3: Write .env File
# ═══════════════════════════════════════════════════════════════════════════
echo -e "${YELLOW}[3/3]${NC} Writing .env file..."

cat > "$ENV_FILE" <<EOF
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Production Environment Configuration
# ═══════════════════════════════════════════════════════════════════════════
# Generated: $(date)
# Instance ID: ${INSTANCE_ID}
# ═══════════════════════════════════════════════════════════════════════════
# 🔒 SECURITY WARNING:
# - This file contains SENSITIVE credentials
# - NEVER commit this file to version control
# - Store a copy in a secure password manager
# - Change ADMIN_PASSWORD on first login
# ═══════════════════════════════════════════════════════════════════════════

# ───────────────────────────────────────────────────────────────────────────
# 🌍 Application Configuration
# ───────────────────────────────────────────────────────────────────────────
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info

# Instance identification
INSTANCE_ID=${INSTANCE_ID}

# ───────────────────────────────────────────────────────────────────────────
# 🗄️ Database Configuration (PostgreSQL)
# ───────────────────────────────────────────────────────────────────────────
DB_HOST=postgres
DB_PORT=5432
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}

# Full connection string (auto-generated)
DATABASE_URL=postgresql://\${DB_USER}:\${DB_PASSWORD}@\${DB_HOST}:\${DB_PORT}/\${DB_NAME}?schema=public

# ───────────────────────────────────────────────────────────────────────────
# 🔴 Redis Configuration
# ───────────────────────────────────────────────────────────────────────────
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}

# Full connection string (auto-generated)
REDIS_URL=redis://:\${REDIS_PASSWORD}@\${REDIS_HOST}:\${REDIS_PORT}

# ───────────────────────────────────────────────────────────────────────────
# 🔑 JWT & Authentication
# ───────────────────────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
JWT_ACCESS_EXPIRY=${JWT_ACCESS_EXPIRY}
JWT_REFRESH_EXPIRY=${JWT_REFRESH_EXPIRY}

# Session management
SESSION_SECRET=${SESSION_SECRET}
SESSION_MAX_AGE=604800000

# ───────────────────────────────────────────────────────────────────────────
# 🔐 Encryption & Security
# ───────────────────────────────────────────────────────────────────────────
ENCRYPTION_KEY=${ENCRYPTION_KEY}
BCRYPT_ROUNDS=12

# API keys
API_KEY=${API_KEY}
INTERNAL_API_KEY=${INTERNAL_API_KEY}

# ───────────────────────────────────────────────────────────────────────────
# 🌐 CORS Configuration
# ───────────────────────────────────────────────────────────────────────────
# ⚠️  IMPORTANT: Configure your actual domain(s)
CORS_ORIGINS=${CORS_ORIGINS}

# ───────────────────────────────────────────────────────────────────────────
# 👤 Initial Admin Account
# ───────────────────────────────────────────────────────────────────────────
# ⚠️  CRITICAL: Change password on first login!
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}

# ───────────────────────────────────────────────────────────────────────────
# 📊 Monitoring (Nginx Basic Auth)
# ───────────────────────────────────────────────────────────────────────────
# Generate htpasswd with: cd infra/nginx && bash generate-htpasswd.sh
MONITORING_USER=admin
MONITORING_PASSWORD_HASH=

# ───────────────────────────────────────────────────────────────────────────
# 📧 Email Configuration (Optional)
# ───────────────────────────────────────────────────────────────────────────
# SMTP_HOST=smtp.example.com
# SMTP_PORT=587
# SMTP_USER=noreply@nextgen-marketplace.local
# SMTP_PASSWORD=
# SMTP_FROM=noreply@nextgen-marketplace.local

# ───────────────────────────────────────────────────────────────────────────
# 💳 Payment Gateway (Optional)
# ───────────────────────────────────────────────────────────────────────────
# PAYMENT_GATEWAY=stripe
# STRIPE_PUBLIC_KEY=
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=

# ───────────────────────────────────────────────────────────────────────────
# 🚀 Deployment
# ───────────────────────────────────────────────────────────────────────────
DEPLOY_USER=deploy
DEPLOY_PATH=/home/deploy/nextgen-market

# ═══════════════════════════════════════════════════════════════════════════
# End of Configuration
# ═══════════════════════════════════════════════════════════════════════════
EOF

chmod 600 "$ENV_FILE"
echo -e "${GREEN}✓${NC} File created: $ENV_FILE"
echo -e "${GREEN}✓${NC} Permissions set: 600 (owner read/write only)"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# Step 4: Generate Credentials Summary
# ═══════════════════════════════════════════════════════════════════════════
SUMMARY_FILE="${PROJECT_ROOT}/CREDENTIALS_SUMMARY.txt"

cat > "$SUMMARY_FILE" <<EOF
═══════════════════════════════════════════════════════════════════════════
NextGen Marketplace - Credentials Summary
═══════════════════════════════════════════════════════════════════════════
Generated: $(date)
Instance: ${INSTANCE_ID}
───────────────────────────────────────────────────────────────────────────

🔒 CRITICAL SECURITY INSTRUCTIONS:
1. Store this file in a secure password manager
2. Delete this file after storing credentials: rm CREDENTIALS_SUMMARY.txt
3. Change ADMIN_PASSWORD on first login
4. Configure CORS_ORIGINS in .env with your actual domain
5. Never commit .env to version control

───────────────────────────────────────────────────────────────────────────
📋 GENERATED CREDENTIALS:
───────────────────────────────────────────────────────────────────────────

Database (PostgreSQL):
  User:     ${DB_USER}
  Password: ${DB_PASSWORD}
  Database: ${DB_NAME}

Redis:
  Password: ${REDIS_PASSWORD}

Initial Admin Account:
  Email:    ${ADMIN_EMAIL}
  Password: ${ADMIN_PASSWORD}
  ⚠️  CHANGE THIS PASSWORD ON FIRST LOGIN!

API Keys:
  API Key:          ${API_KEY}
  Internal API Key: ${INTERNAL_API_KEY}

───────────────────────────────────────────────────────────────────────────
🔧 NEXT STEPS:
───────────────────────────────────────────────────────────────────────────

1. Configure domain in .env:
   sed -i 's|CORS_ORIGINS=.*|CORS_ORIGINS=https://your-actual-domain.com|' .env

2. Generate monitoring auth:
   cd infra/nginx && bash generate-htpasswd.sh

3. Validate configuration:
   bash scripts/validate-env.sh

4. Deploy to production:
   git push origin main

───────────────────────────────────────────────────────────────────────────
⚠️  SECURITY REMINDER:
───────────────────────────────────────────────────────────────────────────
- All passwords are 32+ characters with high entropy
- JWT secrets are 64+ character hex strings
- All secrets generated using /dev/urandom
- Encryption uses SHA-256 level security

DELETE THIS FILE after storing credentials securely!

═══════════════════════════════════════════════════════════════════════════
EOF

chmod 600 "$SUMMARY_FILE"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Secrets Generated Successfully!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}📄 Files Created:${NC}"
echo -e "   ${GREEN}✓${NC} .env (600) - Production secrets"
echo -e "   ${GREEN}✓${NC} CREDENTIALS_SUMMARY.txt (600) - Human-readable backup"
echo ""
echo -e "${YELLOW}🔒 CRITICAL SECURITY ACTIONS:${NC}"
echo -e "   1. ${RED}Store credentials in password manager${NC}"
echo -e "   2. ${RED}Delete CREDENTIALS_SUMMARY.txt after storing:${NC}"
echo -e "      ${BLUE}rm CREDENTIALS_SUMMARY.txt${NC}"
echo -e "   3. ${YELLOW}Change ADMIN_PASSWORD on first login${NC}"
echo -e "   4. ${YELLOW}Configure CORS_ORIGINS in .env:${NC}"
echo -e "      ${BLUE}nano .env${NC}"
echo ""
echo -e "${CYAN}📋 Initial Admin Credentials:${NC}"
echo -e "   Email:    ${GREEN}${ADMIN_EMAIL}${NC}"
echo -e "   Password: ${GREEN}${ADMIN_PASSWORD}${NC}"
echo -e "   ${RED}⚠️  CHANGE PASSWORD ON FIRST LOGIN!${NC}"
echo ""
echo -e "${CYAN}🔧 Next Steps:${NC}"
echo -e "   1. Generate monitoring auth: ${GREEN}cd infra/nginx && bash generate-htpasswd.sh${NC}"
echo -e "   2. Validate configuration: ${GREEN}bash scripts/validate-env.sh${NC}"
echo -e "   3. Deploy to production: ${GREEN}git push origin main${NC}"
echo ""
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
