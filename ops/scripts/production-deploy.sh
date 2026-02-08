#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Production Deployment Script
# ═══════════════════════════════════════════════════════════════════════════
# این اسکریپت تمام مراحل لازم برای آماده‌سازی و استقرار سیستم را انجام می‌دهد
# بدون هیچ Mock یا شبیه‌سازی - فقط Production-Ready Code
# ═══════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

log_section() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Check if running as root
if [ "$EUID" -eq 0 ]; then 
    log_error "لطفاً این اسکریپت را به عنوان root اجرا نکنید"
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════
# STEP 1: Environment Check
# ═══════════════════════════════════════════════════════════════════════════
log_section "مرحله 1: بررسی محیط"

# Check Node.js
if ! command -v node &> /dev/null; then
    log_error "Node.js نصب نیست. لطفاً Node.js 20+ را نصب کنید"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    log_error "نسخه Node.js باید 18 یا بالاتر باشد. نسخه فعلی: $(node -v)"
    exit 1
fi
log_success "Node.js $(node -v) نصب است"

# Check npm
if ! command -v npm &> /dev/null; then
    log_error "npm نصب نیست"
    exit 1
fi
log_success "npm $(npm -v) نصب است"

# Check Docker
if ! command -v docker &> /dev/null; then
    log_warning "Docker نصب نیست. برای استقرار production نیاز است"
else
    log_success "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') نصب است"
fi

# Check PostgreSQL client
if ! command -v psql &> /dev/null; then
    log_warning "PostgreSQL client نصب نیست. برای تست اتصال نیاز است"
else
    log_success "PostgreSQL client نصب است"
fi

# ═══════════════════════════════════════════════════════════════════════════
# STEP 2: Install Dependencies
# ═══════════════════════════════════════════════════════════════════════════
log_section "مرحله 2: نصب وابستگی‌ها"

log_info "نصب npm packages..."
npm install --legacy-peer-deps

log_success "تمام وابستگی‌ها نصب شدند"

# ═══════════════════════════════════════════════════════════════════════════
# STEP 3: Environment Configuration
# ═══════════════════════════════════════════════════════════════════════════
log_section "مرحله 3: پیکربندی محیط"

if [ ! -f .env ]; then
    log_warning "فایل .env وجود ندارد. ایجاد از .env.example..."
    cp .env.example .env
    log_info "لطفاً فایل .env را با مقادیر واقعی پر کنید"
else
    log_success "فایل .env موجود است"
fi

# Validate critical environment variables
source .env

REQUIRED_VARS=("DATABASE_URL" "JWT_SECRET" "REDIS_URL")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    log_error "متغیرهای محیطی زیر تنظیم نشده‌اند:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    exit 1
fi

log_success "تمام متغیرهای محیطی حیاتی تنظیم شده‌اند"

# ═══════════════════════════════════════════════════════════════════════════
# STEP 4: Generate Prisma Client
# ═══════════════════════════════════════════════════════════════════════════
log_section "مرحله 4: تولید Prisma Client"

log_info "تولید Prisma Client..."
npx prisma generate

log_success "Prisma Client تولید شد"

# ═══════════════════════════════════════════════════════════════════════════
# STEP 5: Database Setup
# ═══════════════════════════════════════════════════════════════════════════
log_section "مرحله 5: راه‌اندازی پایگاه داده"

# Check if database is accessible
log_info "بررسی اتصال به پایگاه داده..."

if npx prisma db execute --stdin <<< "SELECT 1" &> /dev/null; then
    log_success "اتصال به پایگاه داده برقرار است"
else
    log_error "اتصال به پایگاه داده برقرار نیست"
    log_info "آیا می‌خواهید PostgreSQL را با Docker راه‌اندازی کنید؟ (y/n)"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        docker-compose up -d postgres redis
        log_info "منتظر راه‌اندازی PostgreSQL..."
        sleep 10
    else
        exit 1
    fi
fi

# Run migrations
log_info "اجرای migrations..."
npx prisma migrate deploy

log_success "Migrations با موفقیت اجرا شدند"

# ═══════════════════════════════════════════════════════════════════════════
# STEP 6: Build Application
# ═══════════════════════════════════════════════════════════════════════════
log_section "مرحله 6: Build برنامه"

log_info "Build کردن API..."
npm run build

log_success "Build با موفقیت انجام شد"

# ═══════════════════════════════════════════════════════════════════════════
# STEP 7: Run Tests (Optional)
# ═══════════════════════════════════════════════════════════════════════════
log_section "مرحله 7: اجرای تست‌ها (اختیاری)"

log_info "آیا می‌خواهید تست‌ها را اجرا کنید؟ (y/n)"
read -r response
if [[ "$response" =~ ^[Yy]$ ]]; then
    npm test || log_warning "برخی تست‌ها شکست خوردند"
else
    log_info "تست‌ها رد شدند"
fi

# ═══════════════════════════════════════════════════════════════════════════
# STEP 8: Health Check
# ═══════════════════════════════════════════════════════════════════════════
log_section "مرحله 8: بررسی سلامت"

log_info "شروع سرور برای بررسی سلامت..."
npm run start:dev &
SERVER_PID=$!

# Wait for server to start
sleep 10

# Check health endpoint
if curl -f http://localhost:3001/health &> /dev/null; then
    log_success "سرور با موفقیت راه‌اندازی شد"
    log_success "Health check: http://localhost:3001/health"
    log_success "API Docs: http://localhost:3001/api/docs"
else
    log_error "سرور راه‌اندازی نشد"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# Stop the server
kill $SERVER_PID 2>/dev/null || true

# ═══════════════════════════════════════════════════════════════════════════
# STEP 9: Production Deployment Options
# ═══════════════════════════════════════════════════════════════════════════
log_section "مرحله 9: گزینه‌های استقرار"

echo ""
echo "سیستم آماده استقرار است! گزینه‌های زیر را دارید:"
echo ""
echo "1️⃣  Development Mode:"
echo "   npm run start:dev"
echo ""
echo "2️⃣  Production Mode (Local):"
echo "   npm start"
echo ""
echo "3️⃣  Docker Compose:"
echo "   docker-compose up -d"
echo ""
echo "4️⃣  Kubernetes:"
echo "   kubectl apply -f k8s/"
echo ""

log_success "استقرار با موفقیت آماده شد! 🎉"

# ═══════════════════════════════════════════════════════════════════════════
# Summary
# ═══════════════════════════════════════════════════════════════════════════
log_section "خلاصه"

echo "✅ محیط بررسی شد"
echo "✅ وابستگی‌ها نصب شدند"
echo "✅ متغیرهای محیطی تنظیم شدند"
echo "✅ Prisma Client تولید شد"
echo "✅ پایگاه داده راه‌اندازی شد"
echo "✅ برنامه build شد"
echo "✅ Health check موفق بود"
echo ""
echo "🚀 سیستم آماده استقرار Production است!"
echo ""
echo "📚 مستندات:"
echo "   - API Docs: http://localhost:3001/api/docs"
echo "   - Health: http://localhost:3001/health"
echo "   - Metrics: http://localhost:3001/metrics"
echo ""
