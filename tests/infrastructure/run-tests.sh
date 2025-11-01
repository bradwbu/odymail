#!/bin/bash

# Infrastructure Test Runner
# Runs comprehensive infrastructure and deployment tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$TEST_DIR/../.." && pwd)"
REPORT_DIR="$TEST_DIR/reports"
LOG_FILE="$REPORT_DIR/test-run.log"

# Test configuration
TEST_BASE_URL="${TEST_BASE_URL:-http://localhost}"
TEST_HTTPS_URL="${TEST_HTTPS_URL:-https://localhost}"
TEST_TIMEOUT="${TEST_TIMEOUT:-300000}"
TEST_VERBOSE="${TEST_VERBOSE:-false}"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

setup_test_environment() {
    log_info "Setting up test environment..."
    
    # Create reports directory
    mkdir -p "$REPORT_DIR"
    
    # Initialize log file
    echo "Infrastructure Test Run - $(date)" > "$LOG_FILE"
    
    # Install test dependencies if needed
    if [ ! -d "$TEST_DIR/node_modules" ]; then
        log_info "Installing test dependencies..."
        cd "$TEST_DIR"
        npm install
        cd "$PROJECT_ROOT"
    fi
    
    # Set environment variables
    export TEST_BASE_URL="$TEST_BASE_URL"
    export TEST_HTTPS_URL="$TEST_HTTPS_URL"
    export TEST_TIMEOUT="$TEST_TIMEOUT"
    export TEST_VERBOSE="$TEST_VERBOSE"
    export NODE_ENV="${NODE_ENV:-test}"
    
    log_success "Test environment setup completed"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check required tools
    local missing_tools=()
    
    if ! command -v node &> /dev/null; then
        missing_tools+=("node")
    fi
    
    if ! command -v npm &> /dev/null; then
        missing_tools+=("npm")
    fi
    
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    # Check Node.js version
    local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$node_version" -lt 16 ]; then
        log_error "Node.js version 16 or higher required (found: $(node --version))"
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

check_services() {
    log_info "Checking service availability..."
    
    local services_available=true
    
    # Check frontend service
    if curl -f -s "$TEST_BASE_URL/health" > /dev/null 2>&1; then
        log_success "Frontend service is available at $TEST_BASE_URL"
    else
        log_warning "Frontend service not available at $TEST_BASE_URL"
        services_available=false
    fi
    
    # Check backend service
    if curl -f -s "$TEST_BASE_URL/api/health" > /dev/null 2>&1; then
        log_success "Backend service is available at $TEST_BASE_URL/api"
    else
        log_warning "Backend service not available at $TEST_BASE_URL/api"
        services_available=false
    fi
    
    if [ "$services_available" = false ]; then
        log_warning "Some services are not available. Tests may be skipped or fail."
        log_info "To start services, run: docker-compose up -d"
    fi
}

run_deployment_tests() {
    log_info "Running deployment tests..."
    
    cd "$TEST_DIR"
    
    if npm run test:deployment 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Deployment tests passed"
        return 0
    else
        log_error "Deployment tests failed"
        return 1
    fi
}

run_security_tests() {
    log_info "Running security tests..."
    
    cd "$TEST_DIR"
    
    if npm run test:security 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Security tests passed"
        return 0
    else
        log_error "Security tests failed"
        return 1
    fi
}

run_load_tests() {
    log_info "Running load tests..."
    
    cd "$TEST_DIR"
    
    if npm run test:load 2>&1 | tee -a "$LOG_FILE"; then
        log_success "Load tests passed"
        return 0
    else
        log_error "Load tests failed"
        return 1
    fi
}

run_all_tests() {
    log_info "Running all infrastructure tests..."
    
    cd "$TEST_DIR"
    
    if npm run test:all 2>&1 | tee -a "$LOG_FILE"; then
        log_success "All tests passed"
        return 0
    else
        log_error "Some tests failed"
        return 1
    fi
}

generate_report() {
    log_info "Generating test report..."
    
    cd "$TEST_DIR"
    
    # Generate coverage report
    npm run report > /dev/null 2>&1 || true
    
    # Create summary report
    cat > "$REPORT_DIR/summary.md" << EOF
# Infrastructure Test Report

**Date:** $(date)
**Environment:** $NODE_ENV
**Base URL:** $TEST_BASE_URL

## Test Results

$(grep -E "\[SUCCESS\]|\[ERROR\]" "$LOG_FILE" | tail -20)

## Coverage Report

$([ -f coverage/lcov-report/index.html ] && echo "Coverage report available at: coverage/lcov-report/index.html" || echo "Coverage report not generated")

## Logs

Full test logs available at: $LOG_FILE

## Recommendations

$(if grep -q "\[ERROR\]" "$LOG_FILE"; then
    echo "- Review failed tests and fix issues before deployment"
    echo "- Check service availability and configuration"
else
    echo "- All tests passed - system ready for deployment"
fi)
EOF
    
    log_success "Test report generated at $REPORT_DIR/summary.md"
}

cleanup() {
    log_info "Cleaning up test environment..."
    
    # Clean up any test resources
    cd "$TEST_DIR"
    
    # Remove temporary files
    rm -f .env.test
    
    log_success "Cleanup completed"
}

show_help() {
    echo "Infrastructure Test Runner"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo "  all         Run all infrastructure tests (default)"
    echo "  deployment  Run deployment tests only"
    echo "  security    Run security tests only"
    echo "  load        Run load tests only"
    echo "  check       Check prerequisites and service availability"
    echo "  help        Show this help message"
    echo ""
    echo "Options:"
    echo "  --base-url URL     Base URL for testing (default: http://localhost)"
    echo "  --https-url URL    HTTPS URL for testing (default: https://localhost)"
    echo "  --timeout MS       Test timeout in milliseconds (default: 300000)"
    echo "  --verbose          Enable verbose output"
    echo "  --no-cleanup       Skip cleanup after tests"
    echo ""
    echo "Environment Variables:"
    echo "  TEST_BASE_URL      Base URL for testing"
    echo "  TEST_HTTPS_URL     HTTPS URL for testing"
    echo "  TEST_TIMEOUT       Test timeout in milliseconds"
    echo "  TEST_VERBOSE       Enable verbose output (true/false)"
    echo "  NODE_ENV           Node environment (test/development/production)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run all tests"
    echo "  $0 deployment                         # Run deployment tests only"
    echo "  $0 --base-url http://staging.example.com  # Test staging environment"
    echo "  $0 load --verbose                     # Run load tests with verbose output"
}

# Parse command line arguments
COMMAND="all"
SKIP_CLEANUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --base-url)
            TEST_BASE_URL="$2"
            shift 2
            ;;
        --https-url)
            TEST_HTTPS_URL="$2"
            shift 2
            ;;
        --timeout)
            TEST_TIMEOUT="$2"
            shift 2
            ;;
        --verbose)
            TEST_VERBOSE="true"
            shift
            ;;
        --no-cleanup)
            SKIP_CLEANUP=true
            shift
            ;;
        all|deployment|security|load|check|help)
            COMMAND="$1"
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
main() {
    case "$COMMAND" in
        "help")
            show_help
            exit 0
            ;;
        "check")
            setup_test_environment
            check_prerequisites
            check_services
            exit 0
            ;;
        *)
            setup_test_environment
            check_prerequisites
            check_services
            
            local exit_code=0
            
            case "$COMMAND" in
                "deployment")
                    run_deployment_tests || exit_code=1
                    ;;
                "security")
                    run_security_tests || exit_code=1
                    ;;
                "load")
                    run_load_tests || exit_code=1
                    ;;
                "all"|*)
                    run_all_tests || exit_code=1
                    ;;
            esac
            
            generate_report
            
            if [ "$SKIP_CLEANUP" = false ]; then
                cleanup
            fi
            
            if [ $exit_code -eq 0 ]; then
                log_success "Infrastructure tests completed successfully!"
            else
                log_error "Infrastructure tests failed!"
            fi
            
            exit $exit_code
            ;;
    esac
}

# Trap cleanup on exit
trap 'cleanup' EXIT

# Run main function
main