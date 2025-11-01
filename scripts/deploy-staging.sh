#!/bin/bash

# Staging Deployment Script
# Deploys the application to staging environment for testing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT="staging"
NAMESPACE="encrypted-email-staging"
DOMAIN="staging.yourdomain.com"
COMPOSE_FILE="docker-compose.yml"

# Functions
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

check_prerequisites() {
    log_info "Checking prerequisites for staging deployment..."
    
    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if kubectl is available (for Kubernetes deployment)
    if command -v kubectl &> /dev/null; then
        log_info "kubectl found - Kubernetes deployment available"
        DEPLOYMENT_TYPE="kubernetes"
    else
        log_info "kubectl not found - using Docker Compose deployment"
        DEPLOYMENT_TYPE="docker-compose"
    fi
    
    log_success "Prerequisites check passed"
}

build_images() {
    log_info "Building Docker images for staging..."
    
    # Build frontend image
    log_info "Building frontend image..."
    docker build -f packages/frontend/Dockerfile -t encrypted-email-frontend:staging .
    
    # Build backend image
    log_info "Building backend image..."
    docker build -f packages/backend/Dockerfile -t encrypted-email-backend:staging .
    
    log_success "Images built successfully"
}

deploy_docker_compose() {
    log_info "Deploying with Docker Compose..."
    
    # Create staging environment file
    cat > .env.staging << EOF
NODE_ENV=staging
DOMAIN=$DOMAIN
JWT_SECRET=staging-jwt-secret-change-in-production
ENCRYPTION_KEY=staging-encryption-key-32-chars
MONGO_USERNAME=staging_user
MONGO_PASSWORD=staging_password
REDIS_PASSWORD=staging_redis_password
CORS_ORIGIN=https://$DOMAIN
GRAFANA_PASSWORD=staging_grafana_password
ACME_EMAIL=admin@yourdomain.com
EOF

    # Deploy services
    docker-compose -f $COMPOSE_FILE --env-file .env.staging up -d
    
    log_success "Docker Compose deployment completed"
}

deploy_kubernetes() {
    log_info "Deploying to Kubernetes..."
    
    # Create namespace if it doesn't exist
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
    
    # Update image tags in manifests
    sed -i.bak "s|encrypted-email-frontend:latest|encrypted-email-frontend:staging|g" k8s/frontend-deployment.yaml
    sed -i.bak "s|encrypted-email-backend:latest|encrypted-email-backend:staging|g" k8s/backend-deployment.yaml
    sed -i.bak "s|namespace: encrypted-email|namespace: $NAMESPACE|g" k8s/*.yaml
    sed -i.bak "s|yourdomain.com|$DOMAIN|g" k8s/ingress.yaml
    
    # Apply Kubernetes manifests
    kubectl apply -f k8s/configmap.yaml -n $NAMESPACE
    kubectl apply -f k8s/secrets.yaml -n $NAMESPACE
    kubectl apply -f k8s/persistent-volumes.yaml -n $NAMESPACE
    kubectl apply -f k8s/frontend-deployment.yaml -n $NAMESPACE
    kubectl apply -f k8s/backend-deployment.yaml -n $NAMESPACE
    kubectl apply -f k8s/ingress.yaml -n $NAMESPACE
    
    # Wait for deployments to be ready
    kubectl rollout status deployment/encrypted-email-frontend -n $NAMESPACE --timeout=300s
    kubectl rollout status deployment/encrypted-email-backend -n $NAMESPACE --timeout=300s
    
    # Restore original manifests
    mv k8s/frontend-deployment.yaml.bak k8s/frontend-deployment.yaml
    mv k8s/backend-deployment.yaml.bak k8s/backend-deployment.yaml
    mv k8s/ingress.yaml.bak k8s/ingress.yaml
    find k8s/ -name "*.yaml.bak" -exec rm {} \;
    
    log_success "Kubernetes deployment completed"
}

run_health_checks() {
    log_info "Running health checks..."
    
    # Wait for services to be ready
    sleep 30
    
    # Check frontend health
    if curl -f -s "https://$DOMAIN/health" > /dev/null; then
        log_success "Frontend health check passed"
    else
        log_error "Frontend health check failed"
        return 1
    fi
    
    # Check backend health
    if curl -f -s "https://$DOMAIN/api/health" > /dev/null; then
        log_success "Backend health check passed"
    else
        log_error "Backend health check failed"
        return 1
    fi
    
    log_success "All health checks passed"
}

run_smoke_tests() {
    log_info "Running smoke tests..."
    
    # Test user registration endpoint
    REGISTER_RESPONSE=$(curl -s -w "%{http_code}" -X POST "https://$DOMAIN/api/auth/register" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"TestPassword123!","confirmPassword":"TestPassword123!"}' \
        -o /dev/null)
    
    if [ "$REGISTER_RESPONSE" = "201" ] || [ "$REGISTER_RESPONSE" = "400" ]; then
        log_success "Registration endpoint test passed"
    else
        log_error "Registration endpoint test failed (HTTP $REGISTER_RESPONSE)"
        return 1
    fi
    
    # Test login endpoint
    LOGIN_RESPONSE=$(curl -s -w "%{http_code}" -X POST "https://$DOMAIN/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"wrongpassword"}' \
        -o /dev/null)
    
    if [ "$LOGIN_RESPONSE" = "401" ]; then
        log_success "Login endpoint test passed"
    else
        log_error "Login endpoint test failed (HTTP $LOGIN_RESPONSE)"
        return 1
    fi
    
    log_success "Smoke tests passed"
}

show_deployment_info() {
    log_success "Staging deployment completed successfully!"
    echo ""
    echo "Environment: $ENVIRONMENT"
    echo "URL: https://$DOMAIN"
    echo "Deployment Type: $DEPLOYMENT_TYPE"
    echo ""
    
    if [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
        echo "Kubernetes Resources:"
        kubectl get pods -n $NAMESPACE
        echo ""
        echo "Services:"
        kubectl get services -n $NAMESPACE
    else
        echo "Docker Containers:"
        docker-compose -f $COMPOSE_FILE ps
    fi
    
    echo ""
    echo "To view logs:"
    if [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
        echo "  kubectl logs -f deployment/encrypted-email-frontend -n $NAMESPACE"
        echo "  kubectl logs -f deployment/encrypted-email-backend -n $NAMESPACE"
    else
        echo "  docker-compose -f $COMPOSE_FILE logs -f"
    fi
}

cleanup_on_failure() {
    log_warning "Deployment failed. Cleaning up..."
    
    if [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
        kubectl delete namespace $NAMESPACE --ignore-not-found=true
    else
        docker-compose -f $COMPOSE_FILE --env-file .env.staging down
        rm -f .env.staging
    fi
    
    log_info "Cleanup completed"
}

# Main deployment process
main() {
    log_info "Starting staging deployment..."
    
    # Trap errors and cleanup
    trap 'log_error "Deployment failed"; cleanup_on_failure; exit 1' ERR
    
    check_prerequisites
    build_images
    
    if [ "$DEPLOYMENT_TYPE" = "kubernetes" ]; then
        deploy_kubernetes
    else
        deploy_docker_compose
    fi
    
    run_health_checks
    run_smoke_tests
    show_deployment_info
    
    log_success "Staging deployment completed successfully!"
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "cleanup")
        cleanup_on_failure
        ;;
    "health")
        run_health_checks
        ;;
    "test")
        run_smoke_tests
        ;;
    *)
        echo "Usage: $0 [deploy|cleanup|health|test]"
        echo "  deploy  - Full staging deployment (default)"
        echo "  cleanup - Clean up staging environment"
        echo "  health  - Run health checks only"
        echo "  test    - Run smoke tests only"
        exit 1
        ;;
esac