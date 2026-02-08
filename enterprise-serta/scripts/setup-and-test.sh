#!/bin/bash

# ═══════════════════════════════════════════════════════════════════════════
# Enterprise-SERTA Setup and Test Script
# ═══════════════════════════════════════════════════════════════════════════

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${CYAN}"
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo "$1"
    echo "═══════════════════════════════════════════════════════════════════════════"
    echo -e "${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js found: $NODE_VERSION"
    else
        print_error "Node.js not found. Please install Node.js 18+"
        exit 1
    fi
    
    # Check pnpm
    if command -v pnpm &> /dev/null; then
        PNPM_VERSION=$(pnpm --version)
        print_success "pnpm found: $PNPM_VERSION"
    else
        print_error "pnpm not found. Installing pnpm..."
        npm install -g pnpm
    fi
    
    # Check Docker
    if command -v docker &> /dev/null; then
        DOCKER_VERSION=$(docker --version)
        print_success "Docker found: $DOCKER_VERSION"
    else
        print_error "Docker not found. Please install Docker"
        exit 1
    fi
    
    # Check Docker Compose
    if command -v docker-compose &> /dev/null; then
        COMPOSE_VERSION=$(docker-compose --version)
        print_success "Docker Compose found: $COMPOSE_VERSION"
    else
        print_error "Docker Compose not found. Please install Docker Compose"
        exit 1
    fi
    
    # Check available memory
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        MEMORY_GB=$(free -g | awk '/^Mem:/{print $2}')
        if [ "$MEMORY_GB" -lt 8 ]; then
            print_warning "Available memory: ${MEMORY_GB}GB. Recommended: 8GB+"
        else
            print_success "Available memory: ${MEMORY_GB}GB"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        MEMORY_GB=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
        if [ "$MEMORY_GB" -lt 8 ]; then
            print_warning "Available memory: ${MEMORY_GB}GB. Recommended: 8GB+"
        else
            print_success "Available memory: ${MEMORY_GB}GB"
        fi
    fi
}

# Setup project
setup_project() {
    print_header "Setting Up Enterprise-SERTA"
    
    # Install dependencies
    print_status "Installing dependencies..."
    pnpm install
    print_success "Dependencies installed"
    
    # Build the project
    print_status "Building project..."
    pnpm run build
    print_success "Project built successfully"
    
    # Create necessary directories
    print_status "Creating data directories..."
    mkdir -p data/qdrant data/redis data/postgres data/grafana
    mkdir -p results config/grafana/dashboards config/grafana/datasources
    print_success "Directories created"
}

# Setup infrastructure
setup_infrastructure() {
    print_header "Setting Up Infrastructure Services"
    
    # Stop any existing containers
    print_status "Stopping existing containers..."
    docker-compose down -v 2>/dev/null || true
    
    # Start infrastructure services
    print_status "Starting infrastructure services..."
    docker-compose up -d
    
    # Wait for services to be ready
    print_status "Waiting for services to be ready..."
    
    # Wait for Qdrant
    print_status "Waiting for Qdrant..."
    for i in {1..30}; do
        if curl -s http://localhost:6333/health > /dev/null 2>&1; then
            print_success "Qdrant is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Qdrant failed to start"
            exit 1
        fi
        sleep 2
    done
    
    # Wait for Redis
    print_status "Waiting for Redis..."
    for i in {1..30}; do
        if redis-cli -h localhost -p 6379 ping > /dev/null 2>&1; then
            print_success "Redis is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "Redis failed to start"
            exit 1
        fi
        sleep 2
    done
    
    # Wait for PostgreSQL
    print_status "Waiting for PostgreSQL..."
    for i in {1..30}; do
        if pg_isready -h localhost -p 5432 -U serta > /dev/null 2>&1; then
            print_success "PostgreSQL is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_error "PostgreSQL failed to start"
            exit 1
        fi
        sleep 2
    done
    
    print_success "All infrastructure services are ready"
}

# Initialize SERTA
initialize_serta() {
    print_header "Initializing Enterprise-SERTA"
    
    print_status "Initializing vector database and models..."
    pnpm run init || node dist/index.js init
    print_success "Enterprise-SERTA initialized"
}

# Run test analysis
run_test_analysis() {
    print_header "Running Test Analysis"
    
    # Create a simple test project
    TEST_PROJECT_DIR="./test-project"
    print_status "Creating test project..."
    
    mkdir -p "$TEST_PROJECT_DIR/src"
    
    # Create test files with various security patterns
    cat > "$TEST_PROJECT_DIR/src/auth.ts" << 'EOF'
// Test file with security vulnerabilities
export class AuthService {
    private readonly JWT_SECRET = "hardcoded-secret-123"; // Hardcoded secret
    
    async authenticate(username: string, password: string) {
        // SQL injection vulnerability
        const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
        
        // Missing input validation
        if (username && password) {
            return { token: "fake-jwt-token" };
        }
        
        return null;
    }
    
    // Missing authentication guard
    async getAdminData() {
        return { sensitive: "admin data" };
    }
}
EOF

    cat > "$TEST_PROJECT_DIR/src/payment.ts" << 'EOF'
// Test file with business logic vulnerabilities
export class PaymentService {
    async processPayment(amount: number, userId: string) {
        // Price manipulation vulnerability - amount from client
        const order = {
            amount: amount, // No server-side validation
            userId: userId,
            status: 'pending'
        };
        
        // Missing tenant isolation
        const user = await this.prisma.user.findFirst({
            where: { id: userId } // No tenant_id filter
        });
        
        return order;
    }
    
    // Payment bypass vulnerability
    async completePayment(orderId: string) {
        // No gateway verification
        await this.prisma.order.update({
            where: { id: orderId },
            data: { status: 'COMPLETED' }
        });
    }
}
EOF

    cat > "$TEST_PROJECT_DIR/package.json" << 'EOF'
{
  "name": "test-project",
  "version": "1.0.0",
  "description": "Test project for Enterprise-SERTA",
  "main": "index.js",
  "dependencies": {
    "@prisma/client": "^5.0.0",
    "express": "^4.18.0"
  }
}
EOF

    print_success "Test project created"
    
    # Run analysis on test project
    print_status "Running Enterprise-SERTA analysis on test project..."
    
    if [ -f "dist/index.js" ]; then
        node dist/index.js analyze "$TEST_PROJECT_DIR" --output "./results/test-analysis"
    else
        pnpm run analyze "$TEST_PROJECT_DIR"
    fi
    
    print_success "Test analysis completed"
    
    # Check results
    if [ -d "./results" ] || [ -d "./serta-results" ]; then
        print_success "Analysis results generated successfully"
        
        # Show summary if available
        SUMMARY_FILE=$(find ./results ./serta-results -name "executive-summary-*.md" 2>/dev/null | head -1)
        if [ -n "$SUMMARY_FILE" ]; then
            print_status "Executive Summary:"
            echo -e "${CYAN}"
            head -20 "$SUMMARY_FILE"
            echo -e "${NC}"
        fi
    else
        print_warning "No results directory found"
    fi
    
    # Cleanup test project
    rm -rf "$TEST_PROJECT_DIR"
}

# Check system status
check_system_status() {
    print_header "System Status Check"
    
    # Check services
    print_status "Checking service status..."
    
    # Qdrant
    if curl -s http://localhost:6333/health > /dev/null 2>&1; then
        print_success "✅ Qdrant: Running"
    else
        print_error "❌ Qdrant: Not responding"
    fi
    
    # Redis
    if redis-cli -h localhost -p 6379 ping > /dev/null 2>&1; then
        print_success "✅ Redis: Running"
    else
        print_error "❌ Redis: Not responding"
    fi
    
    # PostgreSQL
    if pg_isready -h localhost -p 5432 -U serta > /dev/null 2>&1; then
        print_success "✅ PostgreSQL: Running"
    else
        print_error "❌ PostgreSQL: Not responding"
    fi
    
    # Grafana
    if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
        print_success "✅ Grafana: Running (http://localhost:3000)"
    else
        print_warning "⚠️ Grafana: Not responding"
    fi
    
    # Check disk space
    DISK_USAGE=$(df -h . | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$DISK_USAGE" -gt 80 ]; then
        print_warning "Disk usage: ${DISK_USAGE}% (Consider freeing up space)"
    else
        print_success "Disk usage: ${DISK_USAGE}%"
    fi
}

# Show usage information
show_usage() {
    print_header "Enterprise-SERTA Usage Information"
    
    echo -e "${CYAN}Available Commands:${NC}"
    echo "  pnpm run analyze <project-path>     - Analyze a project"
    echo "  pnpm run init                       - Initialize the system"
    echo "  pnpm run status                     - Check system status"
    echo ""
    echo -e "${CYAN}Web Interfaces:${NC}"
    echo "  Grafana Dashboard: http://localhost:3000 (admin/serta_admin_2024)"
    echo "  Qdrant Console: http://localhost:6333/dashboard"
    echo ""
    echo -e "${CYAN}Example Analysis:${NC}"
    echo "  pnpm run analyze ../nextgen-marketplace"
    echo "  pnpm run analyze ./my-project --config custom.json"
    echo ""
    echo -e "${CYAN}Results Location:${NC}"
    echo "  ./serta-results/ or ./results/"
    echo ""
    echo -e "${CYAN}Docker Commands:${NC}"
    echo "  docker-compose up -d               - Start services"
    echo "  docker-compose down                - Stop services"
    echo "  docker-compose logs -f qdrant      - View Qdrant logs"
}

# Main execution
main() {
    print_header "🧠 Enterprise-SERTA Setup and Test"
    
    case "${1:-setup}" in
        "setup")
            check_prerequisites
            setup_project
            setup_infrastructure
            initialize_serta
            run_test_analysis
            check_system_status
            show_usage
            print_success "🎉 Enterprise-SERTA setup completed successfully!"
            ;;
        "test")
            run_test_analysis
            ;;
        "status")
            check_system_status
            ;;
        "infrastructure")
            setup_infrastructure
            ;;
        "init")
            initialize_serta
            ;;
        "help"|"--help"|"-h")
            echo "Usage: $0 [setup|test|status|infrastructure|init|help]"
            echo ""
            echo "Commands:"
            echo "  setup         - Full setup (default)"
            echo "  test          - Run test analysis only"
            echo "  status        - Check system status"
            echo "  infrastructure - Setup infrastructure only"
            echo "  init          - Initialize SERTA only"
            echo "  help          - Show this help"
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Use '$0 help' for usage information"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"