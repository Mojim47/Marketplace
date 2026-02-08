#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# NextGen Marketplace - Semantic Version Management Script
# ═══════════════════════════════════════════════════════════════════════════
# Usage:
#   ./scripts/version.sh [major|minor|patch|get|validate <version>]
#
# Examples:
#   ./scripts/version.sh get          # Get current version
#   ./scripts/version.sh major        # Bump major version (1.0.0 -> 2.0.0)
#   ./scripts/version.sh minor        # Bump minor version (1.0.0 -> 1.1.0)
#   ./scripts/version.sh patch        # Bump patch version (1.0.0 -> 1.0.1)
#   ./scripts/version.sh validate 1.2.3  # Validate version format
#
# Requirements: 5.6
# ═══════════════════════════════════════════════════════════════════════════

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Semantic version regex pattern
SEMVER_REGEX="^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(-((0|[1-9][0-9]*|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*)(\.(0|[1-9][0-9]*|[0-9]*[a-zA-Z-][0-9a-zA-Z-]*))*))?(\+([0-9a-zA-Z-]+(\.[0-9a-zA-Z-]+)*))?$"

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
PACKAGE_JSON="$PROJECT_ROOT/package.json"

# Function to print colored output
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to validate semantic version format
validate_semver() {
    local version="$1"
    if [[ $version =~ $SEMVER_REGEX ]]; then
        return 0
    else
        return 1
    fi
}

# Function to get current version from package.json
get_current_version() {
    if [ ! -f "$PACKAGE_JSON" ]; then
        print_error "package.json not found at $PACKAGE_JSON"
        exit 1
    fi
    
    local version=$(grep -o '"version": *"[^"]*"' "$PACKAGE_JSON" | head -1 | cut -d'"' -f4)
    
    if [ -z "$version" ]; then
        print_error "Could not extract version from package.json"
        exit 1
    fi
    
    echo "$version"
}

# Function to set version in package.json
set_version() {
    local new_version="$1"
    
    if ! validate_semver "$new_version"; then
        print_error "Invalid semantic version format: $new_version"
        print_info "Expected format: MAJOR.MINOR.PATCH (e.g., 1.2.3)"
        exit 1
    fi
    
    # Update package.json
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/\"version\": *\"[^\"]*\"/\"version\": \"$new_version\"/" "$PACKAGE_JSON"
    else
        # Linux
        sed -i "s/\"version\": *\"[^\"]*\"/\"version\": \"$new_version\"/" "$PACKAGE_JSON"
    fi
    
    print_success "Version updated to $new_version"
}

# Function to bump version
bump_version() {
    local bump_type="$1"
    local current_version=$(get_current_version)
    
    # Parse current version
    local major=$(echo "$current_version" | cut -d. -f1)
    local minor=$(echo "$current_version" | cut -d. -f2)
    local patch=$(echo "$current_version" | cut -d. -f3 | cut -d- -f1)
    
    case "$bump_type" in
        major)
            major=$((major + 1))
            minor=0
            patch=0
            ;;
        minor)
            minor=$((minor + 1))
            patch=0
            ;;
        patch)
            patch=$((patch + 1))
            ;;
        *)
            print_error "Invalid bump type: $bump_type"
            print_info "Valid types: major, minor, patch"
            exit 1
            ;;
    esac
    
    local new_version="$major.$minor.$patch"
    
    print_info "Bumping version: $current_version -> $new_version"
    set_version "$new_version"
    
    echo "$new_version"
}

# Function to generate Docker build args
generate_docker_args() {
    local version=$(get_current_version)
    local build_date=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local vcs_ref=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local build_number="${BUILD_NUMBER:-0}"
    
    echo "--build-arg VERSION=$version"
    echo "--build-arg BUILD_DATE=$build_date"
    echo "--build-arg VCS_REF=$vcs_ref"
    echo "--build-arg BUILD_NUMBER=$build_number"
}

# Function to generate Docker image tags
generate_docker_tags() {
    local version=$(get_current_version)
    local vcs_ref=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    local branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    
    # Parse version components
    local major=$(echo "$version" | cut -d. -f1)
    local minor=$(echo "$version" | cut -d. -f2)
    
    echo "$version"           # Full version: 1.2.3
    echo "$major.$minor"      # Major.Minor: 1.2
    echo "$major"             # Major only: 1
    echo "$vcs_ref"           # Git SHA: abc1234
    
    # Add 'latest' tag only for main branch
    if [ "$branch" == "main" ]; then
        echo "latest"
    fi
}

# Main script logic
case "${1:-get}" in
    get)
        get_current_version
        ;;
    major|minor|patch)
        bump_version "$1"
        ;;
    validate)
        if [ -z "$2" ]; then
            print_error "Please provide a version to validate"
            exit 1
        fi
        if validate_semver "$2"; then
            print_success "Valid semantic version: $2"
            exit 0
        else
            print_error "Invalid semantic version: $2"
            exit 1
        fi
        ;;
    docker-args)
        generate_docker_args
        ;;
    docker-tags)
        generate_docker_tags
        ;;
    help|--help|-h)
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  get           Get current version (default)"
        echo "  major         Bump major version (X.0.0)"
        echo "  minor         Bump minor version (x.X.0)"
        echo "  patch         Bump patch version (x.x.X)"
        echo "  validate <v>  Validate version format"
        echo "  docker-args   Generate Docker build arguments"
        echo "  docker-tags   Generate Docker image tags"
        echo "  help          Show this help message"
        ;;
    *)
        print_error "Unknown command: $1"
        echo "Use '$0 help' for usage information"
        exit 1
        ;;
esac
