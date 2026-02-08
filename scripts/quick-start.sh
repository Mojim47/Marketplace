#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Quick Start Script
# ═══════════════════════════════════════════════════════════════════════════
# این اسکریپت تمام مراحل راه‌اندازی را به صورت خودکار انجام می‌دهد
# ═══════════════════════════════════════════════════════════════════════════

set -e  # Exit on error

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo ""
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo -e "${BLUE}$1${NC}"
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo ""
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        print_error "$1 is not installed"
        echo "Please install $1 first: $2"
        exit 1
    fi
    print_success "$1 is installed"
}

# ═══════════════════════════════════════════════════════════════════════════
# مرحله 0: چک کردن پیش‌نیازها
# ═══════════════════════════════════════════════════════════════════════════

print_header "مرحله 0: چک کردن پیش‌نیازها"

check_command "node" "https://nodejs.org/"
check_command "pnpm" "npm install -g pnpm"
check_command "docker" "https://www.docker.com/get-started"
check_command "docker-compose" "https://docs.docker.com/compose/install/"

NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version must be >= 18 (current: $NODE_VERSION)"
    exit 1
fi
print_success "Node.js version is compatible (v$NODE_VERSION)"

# ═══════════════════════════════════════════════════════════════════════════
# مرحله 1: تنظیم Environment Variables
# ═══════════════════════════════════════════════════════════════════════════

print_header "مرحله 1: تنظیم Environment Variables"

if [ ! -f .env ]; then
    print_info "Creating .env from .env.example..."
    cp .env.example .env
    
    # تولید JWT secrets امن
    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    JWT_REFRESH_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    
    # جایگزینی در .env
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" .env
        sed -i '' "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|g" .env
    else
        # Linux
        sed -i "s|JWT_SECRET=.*|JWT_SECRET=$JWT_SECRET|g" .env
        sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET|g" .env
    fi
    
    print_success ".env file created with secure JWT secrets"
else
    print_warning ".env already exists, skipping..."
fi

# ═══════════════════════════════════════════════════════════════════════════
# مرحله 2: راه‌اندازی Database و Redis
# ═══════════════════════════════════════════════════════════════════════════

print_header "مرحله 2: راه‌اندازی Database و Redis"

print_info "Starting PostgreSQL and Redis..."
docker-compose up -d postgres redis

print_info "Waiting for services to be healthy (30 seconds)..."
sleep 30

# چک کردن وضعیت
if docker-compose ps | grep -q "postgres.*Up"; then
    print_success "PostgreSQL is running"
else
    print_error "PostgreSQL failed to start"
    docker-compose logs postgres
    exit 1
fi

if docker-compose ps | grep -q "redis.*Up"; then
    print_success "Redis is running"
else
    print_error "Redis failed to start"
    docker-compose logs redis
    exit 1
fi

# ═══════════════════════════════════════════════════════════════════════════
# مرحله 3: نصب Dependencies
# ═══════════════════════════════════════════════════════════════════════════

print_header "مرحله 3: نصب Dependencies"

if [ ! -d "node_modules" ]; then
    print_info "Installing dependencies with pnpm..."
    pnpm install
    print_success "Dependencies installed"
else
    print_warning "node_modules already exists, skipping install..."
    print_info "Run 'pnpm install' manually if you need to update dependencies"
fi

# ═══════════════════════════════════════════════════════════════════════════
# مرحله 4: Setup Database
# ═══════════════════════════════════════════════════════════════════════════

print_header "مرحله 4: Setup Database"

print_info "Generating Prisma Client..."
pnpm db:generate
print_success "Prisma Client generated"

print_info "Running database migrations..."
pnpm db:migrate:deploy
print_success "Migrations completed"

print_info "Seeding database with initial data..."
pnpm db:seed
print_success "Database seeded"

# ═══════════════════════════════════════════════════════════════════════════
# مرحله 5: Build API
# ═══════════════════════════════════════════════════════════════════════════

print_header "مرحله 5: Build API"

print_info "Building API..."
cd apps/api
pnpm build
cd ../..
print_success "API built successfully"

# ═══════════════════════════════════════════════════════════════════════════
# نتیجه نهایی
# ═══════════════════════════════════════════════════════════════════════════

print_header "🎉 راه‌اندازی با موفقیت انجام شد!"

echo ""
echo -e "${GREEN}✅ همه چیز آماده است!${NC}"
echo ""
echo "برای شروع API:"
echo -e "${BLUE}  pnpm dev:api${NC}"
echo ""
echo "سپس در مرورگر باز کنید:"
echo -e "${BLUE}  http://localhost:3001/health${NC}"
echo -e "${BLUE}  http://localhost:3001/api/docs${NC}"
echo ""
echo "برای تست سریع:"
echo -e "${BLUE}  curl http://localhost:3001/health${NC}"
echo ""
echo "مراحل بعدی را در QUICK_START.md ببینید"
echo ""

# ═══════════════════════════════════════════════════════════════════════════
# پیشنهاد: شروع خودکار API
# ═══════════════════════════════════════════════════════════════════════════

read -p "آیا می‌خواهید API را الان شروع کنید؟ (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Starting API server..."
    pnpm dev:api
fi
