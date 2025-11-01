#!/bin/bash

# Production Deployment Script for Encrypted Email Service
# This script handles the complete production deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env"
BACKUP_DIR="backups/$(date +%Y%m%d_%H%M%S)"

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
    log_info "Checking prerequisites..."
    
    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if .env file exists
    if [ ! -f "$ENV_FILE" ]; then
        log_error "Environment file $ENV_FILE not found. Please copy .env.example to .env and configure it."
        exit 1
    fi
    
    # Check if required environment variables are set
    source "$ENV_FILE"
    
    required_vars=("DOMAIN" "JWT_SECRET" "ENCRYPTION_KEY" "MONGO_USERNAME" "MONGO_PASSWORD" "REDIS_PASSWORD")
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "Required environment variable $var is not set in $ENV_FILE"
            exit 1
        fi
    done
    
    log_success "Prerequisites check passed"
}

create_backup() {
    log_info "Creating backup before deployment..."
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup MongoDB data
    if docker ps | grep -q mongodb; then
        log_info "Backing up MongoDB data..."
        docker exec encrypted-email-mongodb-prod mongodump --out /tmp/backup
        docker cp encrypted-email-mongodb-prod:/tmp/backup "$BACKUP_DIR/mongodb"
    fi
    
    # Backup Redis data
    if docker ps | grep -q redis; then
        log_info "Backing up Redis data..."
        docker exec encrypted-email-redis-prod redis-cli --rdb /tmp/dump.rdb
        docker cp encrypted-email-redis-prod:/tmp/dump.rdb "$BACKUP_DIR/redis-dump.rdb"
    fi
    
    # Backup uploaded files
    if docker volume ls | grep -q backend-uploads; then
        log_info "Backing up uploaded files..."
        docker run --rm -v backend-uploads:/data -v "$(pwd)/$BACKUP_DIR":/backup alpine tar czf /backup/uploads.tar.gz -C /data .
    fi
    
    log_success "Backup created in $BACKUP_DIR"
}

build_images() {
    log_info "Building Docker images..."
    
    # Build frontend image
    log_info "Building frontend image..."
    docker build -f packages/frontend/Dockerfile -t encrypted-email-frontend:latest .
    
    # Build backend image
    log_info "Building backend image..."
    docker build -f packages/backend/Dockerfile -t encrypted-email-backend:latest .
    
    log_success "Docker images built successfully"
}

deploy_services() {
    log_info "Deploying services..."
    
    # Pull latest images for third-party services
    docker-compose -f "$COMPOSE_FILE" pull mongodb redis traefik prometheus grafana loki promtail
    
    # Deploy services with rolling update
    docker-compose -f "$COMPOSE_FILE" up -d --remove-orphans
    
    log_success "Services deployed successfully"
}

wait_for_services() {
    log_info "Waiting for services to be healthy..."
    
    services=("frontend" "backend" "mongodb" "redis" "traefik")
    
    for service in "${services[@]}"; do
        log_info "Waiting for $service to be healthy..."
        
        timeout=300  # 5 minutes timeout
        elapsed=0
        
        while [ $elapsed -lt $timeout ]; do
            if docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "healthy\|Up"; then
                log_success "$service is healthy"
                break
            fi
            
            sleep 5
            elapsed=$((elapsed + 5))
            
            if [ $elapsed -ge $timeout ]; then
                log_error "$service failed to become healthy within $timeout seconds"
                return 1
            fi
        done
    done
    
    log_success "All services are healthy"
}

run_health_checks() {
    log_info "Running health checks..."
    
    # Check frontend health
    if curl -f -s "http://localhost/health" > /dev/null; then
        log_success "Frontend health check passed"
    else
        log_error "Frontend health check failed"
        return 1
    fi
    
    # Check backend health
    if curl -f -s "http://localhost/api/health" > /dev/null; then
        log_success "Backend health check passed"
    else
        log_error "Backend health check failed"
        return 1
    fi
    
    # Check database connectivity
    if docker exec encrypted-email-backend-prod node -e "
        const mongoose = require('mongoose');
        mongoose.connect(process.env.MONGODB_URI)
            .then(() => { console.log('DB connected'); process.exit(0); })
            .catch(() => process.exit(1));
    "; then
        log_success "Database connectivity check passed"
    else
        log_error "Database connectivity check failed"
        return 1
    fi
    
    log_success "All health checks passed"
}

cleanup_old_images() {
    log_info "Cleaning up old Docker images..."
    
    # Remove dangling images
    docker image prune -f
    
    # Remove old images (keep last 3 versions)
    docker images --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | \
        grep "encrypted-email" | \
        tail -n +4 | \
        awk '{print $1}' | \
        xargs -r docker rmi
    
    log_success "Old images cleaned up"
}

setup_monitoring() {
    log_info "Setting up monitoring and alerting..."
    
    # Wait for Prometheus to be ready
    timeout=60
    elapsed=0
    
    while [ $elapsed -lt $timeout ]; do
        if curl -f -s "http://localhost:9090/-/ready" > /dev/null; then
            log_success "Prometheus is ready"
            break
        fi
        
        sleep 2
        elapsed=$((elapsed + 2))
        
        if [ $elapsed -ge $timeout ]; then
            log_warning "Prometheus readiness check timed out"
            break
        fi
    done
    
    # Import Grafana dashboards
    if [ -d "monitoring/grafana/dashboards" ]; then
        log_info "Grafana dashboards will be automatically provisioned"
    fi
    
    log_success "Monitoring setup completed"
}

show_deployment_info() {
    log_success "Deployment completed successfully!"
    echo ""
    echo "Service URLs:"
    echo "  Application: https://${DOMAIN}"
    echo "  Traefik Dashboard: https://traefik.${DOMAIN}"
    echo "  Grafana: https://grafana.${DOMAIN}"
    echo "  Prometheus: https://prometheus.${DOMAIN}"
    echo ""
    echo "Service Status:"
    docker-compose -f "$COMPOSE_FILE" ps
    echo ""
    echo "To view logs:"
    echo "  docker-compose -f $COMPOSE_FILE logs -f [service_name]"
    echo ""
    echo "To scale services:"
    echo "  docker-compose -f $COMPOSE_FILE up -d --scale backend=3"
    echo ""
    echo "Backup location: $BACKUP_DIR"
}

rollback() {
    log_warning "Rolling back deployment..."
    
    # Stop current services
    docker-compose -f "$COMPOSE_FILE" down
    
    # Restore from backup if available
    if [ -d "$BACKUP_DIR" ]; then
        log_info "Restoring from backup..."
        
        # Restore MongoDB
        if [ -d "$BACKUP_DIR/mongodb" ]; then
            docker-compose -f "$COMPOSE_FILE" up -d mongodb
            sleep 10
            docker exec encrypted-email-mongodb-prod mongorestore /tmp/backup
        fi
        
        # Restore Redis
        if [ -f "$BACKUP_DIR/redis-dump.rdb" ]; then
            docker cp "$BACKUP_DIR/redis-dump.rdb" encrypted-email-redis-prod:/data/dump.rdb
            docker-compose -f "$COMPOSE_FILE" restart redis
        fi
        
        # Restore uploaded files
        if [ -f "$BACKUP_DIR/uploads.tar.gz" ]; then
            docker run --rm -v backend-uploads:/data -v "$(pwd)/$BACKUP_DIR":/backup alpine tar xzf /backup/uploads.tar.gz -C /data
        fi
    fi
    
    log_success "Rollback completed"
}

# Main deployment process
main() {
    log_info "Starting production deployment..."
    
    # Trap errors and rollback
    trap 'log_error "Deployment failed. Rolling back..."; rollback; exit 1' ERR
    
    check_prerequisites
    create_backup
    build_images
    deploy_services
    wait_for_services
    run_health_checks
    setup_monitoring
    cleanup_old_images
    show_deployment_info
    
    log_success "Production deployment completed successfully!"
}

# Handle command line arguments
case "${1:-deploy}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback
        ;;
    "health")
        run_health_checks
        ;;
    "backup")
        create_backup
        ;;
    *)
        echo "Usage: $0 [deploy|rollback|health|backup]"
        echo "  deploy  - Full production deployment (default)"
        echo "  rollback - Rollback to previous version"
        echo "  health  - Run health checks"
        echo "  backup  - Create backup only"
        exit 1
        ;;
esac