#!/bin/bash

# Disaster Recovery Script for Encrypted Email Service
# Handles backup, restore, and disaster recovery procedures

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="backups"
S3_BUCKET="${BACKUP_S3_BUCKET:-encrypted-email-backups}"
RETENTION_DAYS=30
COMPOSE_FILE="docker-compose.prod.yml"

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
    log_info "Checking disaster recovery prerequisites..."
    
    # Check if required tools are available
    local missing_tools=()
    
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi
    
    if ! command -v aws &> /dev/null; then
        missing_tools+=("aws-cli")
    fi
    
    if ! command -v gpg &> /dev/null; then
        missing_tools+=("gpg")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured"
        exit 1
    fi
    
    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    
    log_success "Prerequisites check passed"
}

create_full_backup() {
    local backup_timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_name="full_backup_$backup_timestamp"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    log_info "Creating full backup: $backup_name"
    
    mkdir -p "$backup_path"
    
    # Backup MongoDB
    log_info "Backing up MongoDB..."
    if docker ps | grep -q mongodb; then
        docker exec encrypted-email-mongodb-prod mongodump --out /tmp/mongodb_backup
        docker cp encrypted-email-mongodb-prod:/tmp/mongodb_backup "$backup_path/"
        docker exec encrypted-email-mongodb-prod rm -rf /tmp/mongodb_backup
    else
        log_warning "MongoDB container not running, skipping database backup"
    fi
    
    # Backup Redis
    log_info "Backing up Redis..."
    if docker ps | grep -q redis; then
        docker exec encrypted-email-redis-prod redis-cli BGSAVE
        sleep 5  # Wait for background save to complete
        docker cp encrypted-email-redis-prod:/data/dump.rdb "$backup_path/redis_dump.rdb"
    else
        log_warning "Redis container not running, skipping Redis backup"
    fi
    
    # Backup uploaded files
    log_info "Backing up uploaded files..."
    if docker volume ls | grep -q backend-uploads; then
        docker run --rm -v backend-uploads:/data -v "$(pwd)/$backup_path":/backup alpine tar czf /backup/uploads.tar.gz -C /data .
    else
        log_warning "Uploads volume not found, skipping files backup"
    fi
    
    # Backup configuration files
    log_info "Backing up configuration..."
    cp -r .env* "$backup_path/" 2>/dev/null || true
    cp -r ssl/ "$backup_path/" 2>/dev/null || true
    cp -r monitoring/ "$backup_path/" 2>/dev/null || true
    cp docker-compose*.yml "$backup_path/" 2>/dev/null || true
    
    # Create backup manifest
    cat > "$backup_path/manifest.json" << EOF
{
  "backup_name": "$backup_name",
  "timestamp": "$backup_timestamp",
  "type": "full_backup",
  "components": {
    "mongodb": $([ -d "$backup_path/mongodb_backup" ] && echo "true" || echo "false"),
    "redis": $([ -f "$backup_path/redis_dump.rdb" ] && echo "true" || echo "false"),
    "uploads": $([ -f "$backup_path/uploads.tar.gz" ] && echo "true" || echo "false"),
    "config": true
  },
  "size_bytes": $(du -sb "$backup_path" | cut -f1)
}
EOF
    
    # Compress backup
    log_info "Compressing backup..."
    tar czf "$backup_path.tar.gz" -C "$BACKUP_DIR" "$backup_name"
    rm -rf "$backup_path"
    
    # Encrypt backup
    log_info "Encrypting backup..."
    gpg --symmetric --cipher-algo AES256 --compress-algo 1 --s2k-mode 3 \
        --s2k-digest-algo SHA512 --s2k-count 65536 \
        --passphrase "${BACKUP_ENCRYPTION_KEY}" \
        --batch --yes --quiet \
        "$backup_path.tar.gz"
    rm "$backup_path.tar.gz"
    
    # Upload to S3
    log_info "Uploading backup to S3..."
    aws s3 cp "$backup_path.tar.gz.gpg" "s3://$S3_BUCKET/backups/"
    
    log_success "Full backup completed: $backup_name.tar.gz.gpg"
    echo "Backup size: $(du -sh "$backup_path.tar.gz.gpg" | cut -f1)"
    echo "S3 location: s3://$S3_BUCKET/backups/$backup_name.tar.gz.gpg"
}

restore_from_backup() {
    local backup_name="$1"
    
    if [ -z "$backup_name" ]; then
        log_error "Backup name not specified"
        echo "Available backups:"
        aws s3 ls "s3://$S3_BUCKET/backups/" | grep "\.tar\.gz\.gpg$"
        exit 1
    fi
    
    log_info "Restoring from backup: $backup_name"
    
    # Download backup from S3
    log_info "Downloading backup from S3..."
    aws s3 cp "s3://$S3_BUCKET/backups/$backup_name" "$BACKUP_DIR/"
    
    # Decrypt backup
    log_info "Decrypting backup..."
    gpg --decrypt --passphrase "${BACKUP_ENCRYPTION_KEY}" \
        --batch --yes --quiet \
        "$BACKUP_DIR/$backup_name" > "$BACKUP_DIR/${backup_name%.gpg}"
    
    # Extract backup
    log_info "Extracting backup..."
    tar xzf "$BACKUP_DIR/${backup_name%.gpg}" -C "$BACKUP_DIR"
    
    local backup_dir="$BACKUP_DIR/${backup_name%.tar.gz.gpg}"
    
    # Read manifest
    if [ -f "$backup_dir/manifest.json" ]; then
        log_info "Backup manifest:"
        cat "$backup_dir/manifest.json"
    fi
    
    # Stop services
    log_info "Stopping services..."
    docker-compose -f "$COMPOSE_FILE" down
    
    # Restore MongoDB
    if [ -d "$backup_dir/mongodb_backup" ]; then
        log_info "Restoring MongoDB..."
        docker-compose -f "$COMPOSE_FILE" up -d mongodb
        sleep 10
        docker cp "$backup_dir/mongodb_backup" encrypted-email-mongodb-prod:/tmp/
        docker exec encrypted-email-mongodb-prod mongorestore --drop /tmp/mongodb_backup
        docker exec encrypted-email-mongodb-prod rm -rf /tmp/mongodb_backup
    fi
    
    # Restore Redis
    if [ -f "$backup_dir/redis_dump.rdb" ]; then
        log_info "Restoring Redis..."
        docker volume create redis-data 2>/dev/null || true
        docker run --rm -v redis-data:/data -v "$(pwd)/$backup_dir":/backup alpine cp /backup/redis_dump.rdb /data/dump.rdb
    fi
    
    # Restore uploaded files
    if [ -f "$backup_dir/uploads.tar.gz" ]; then
        log_info "Restoring uploaded files..."
        docker volume create backend-uploads 2>/dev/null || true
        docker run --rm -v backend-uploads:/data -v "$(pwd)/$backup_dir":/backup alpine tar xzf /backup/uploads.tar.gz -C /data
    fi
    
    # Restore configuration
    log_info "Restoring configuration..."
    cp "$backup_dir"/.env* . 2>/dev/null || true
    cp -r "$backup_dir/ssl" . 2>/dev/null || true
    cp -r "$backup_dir/monitoring" . 2>/dev/null || true
    
    # Start services
    log_info "Starting services..."
    docker-compose -f "$COMPOSE_FILE" up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 30
    
    # Verify restoration
    if curl -f -s "http://localhost/health" > /dev/null; then
        log_success "Service restoration verified"
    else
        log_error "Service restoration verification failed"
        return 1
    fi
    
    # Cleanup
    rm -rf "$backup_dir"
    rm -f "$BACKUP_DIR/$backup_name" "$BACKUP_DIR/${backup_name%.gpg}"
    
    log_success "Restore completed successfully"
}

list_backups() {
    log_info "Available backups:"
    aws s3 ls "s3://$S3_BUCKET/backups/" | grep "\.tar\.gz\.gpg$" | while read -r line; do
        local date=$(echo "$line" | awk '{print $1, $2}')
        local size=$(echo "$line" | awk '{print $3}')
        local name=$(echo "$line" | awk '{print $4}')
        printf "%-20s %-10s %s\n" "$date" "$size" "$name"
    done
}

cleanup_old_backups() {
    log_info "Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Local cleanup
    find "$BACKUP_DIR" -name "*.tar.gz.gpg" -mtime +$RETENTION_DAYS -delete
    
    # S3 cleanup
    aws s3 ls "s3://$S3_BUCKET/backups/" | while read -r line; do
        local date=$(echo "$line" | awk '{print $1}')
        local name=$(echo "$line" | awk '{print $4}')
        
        if [ -n "$date" ] && [ -n "$name" ]; then
            local backup_date=$(date -d "$date" +%s)
            local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%s)
            
            if [ "$backup_date" -lt "$cutoff_date" ]; then
                log_info "Deleting old backup: $name"
                aws s3 rm "s3://$S3_BUCKET/backups/$name"
            fi
        fi
    done
    
    log_success "Cleanup completed"
}

test_disaster_recovery() {
    log_info "Testing disaster recovery procedures..."
    
    # Create test backup
    log_info "Creating test backup..."
    create_full_backup
    
    # Get latest backup
    local latest_backup=$(aws s3 ls "s3://$S3_BUCKET/backups/" | grep "\.tar\.gz\.gpg$" | tail -1 | awk '{print $4}')
    
    if [ -z "$latest_backup" ]; then
        log_error "No backup found for testing"
        exit 1
    fi
    
    # Test restore (dry run)
    log_info "Testing restore procedure (dry run)..."
    
    # Download and decrypt backup
    aws s3 cp "s3://$S3_BUCKET/backups/$latest_backup" "$BACKUP_DIR/"
    gpg --decrypt --passphrase "${BACKUP_ENCRYPTION_KEY}" \
        --batch --yes --quiet \
        "$BACKUP_DIR/$latest_backup" > "$BACKUP_DIR/${latest_backup%.gpg}"
    
    # Verify backup integrity
    if tar tzf "$BACKUP_DIR/${latest_backup%.gpg}" > /dev/null; then
        log_success "Backup integrity verified"
    else
        log_error "Backup integrity check failed"
        exit 1
    fi
    
    # Cleanup test files
    rm -f "$BACKUP_DIR/$latest_backup" "$BACKUP_DIR/${latest_backup%.gpg}"
    
    log_success "Disaster recovery test completed successfully"
}

monitor_backup_health() {
    log_info "Monitoring backup health..."
    
    # Check last backup age
    local last_backup=$(aws s3 ls "s3://$S3_BUCKET/backups/" | grep "\.tar\.gz\.gpg$" | tail -1)
    
    if [ -z "$last_backup" ]; then
        log_error "No backups found"
        exit 1
    fi
    
    local backup_date=$(echo "$last_backup" | awk '{print $1}')
    local backup_age=$(( ($(date +%s) - $(date -d "$backup_date" +%s)) / 86400 ))
    
    if [ "$backup_age" -gt 1 ]; then
        log_warning "Last backup is $backup_age days old"
    else
        log_success "Backup is current (less than 1 day old)"
    fi
    
    # Check backup size consistency
    local backup_sizes=$(aws s3 ls "s3://$S3_BUCKET/backups/" | grep "\.tar\.gz\.gpg$" | tail -5 | awk '{print $3}')
    local avg_size=$(echo "$backup_sizes" | awk '{sum+=$1} END {print sum/NR}')
    local latest_size=$(echo "$backup_sizes" | tail -1)
    
    if [ "$latest_size" -lt $(echo "$avg_size * 0.5" | bc -l | cut -d. -f1) ]; then
        log_warning "Latest backup size is significantly smaller than average"
    else
        log_success "Backup size is consistent"
    fi
    
    log_success "Backup health monitoring completed"
}

# Main function
main() {
    case "${1:-help}" in
        "backup")
            check_prerequisites
            create_full_backup
            ;;
        "restore")
            check_prerequisites
            restore_from_backup "$2"
            ;;
        "list")
            list_backups
            ;;
        "cleanup")
            cleanup_old_backups
            ;;
        "test")
            check_prerequisites
            test_disaster_recovery
            ;;
        "monitor")
            monitor_backup_health
            ;;
        "help"|*)
            echo "Disaster Recovery Script for Encrypted Email Service"
            echo ""
            echo "Usage: $0 <command> [options]"
            echo ""
            echo "Commands:"
            echo "  backup              Create full backup"
            echo "  restore <name>      Restore from backup"
            echo "  list                List available backups"
            echo "  cleanup             Remove old backups"
            echo "  test                Test disaster recovery procedures"
            echo "  monitor             Monitor backup health"
            echo "  help                Show this help message"
            echo ""
            echo "Environment Variables:"
            echo "  BACKUP_S3_BUCKET           S3 bucket for backups"
            echo "  BACKUP_ENCRYPTION_KEY      Encryption key for backups"
            echo "  AWS_ACCESS_KEY_ID          AWS access key"
            echo "  AWS_SECRET_ACCESS_KEY      AWS secret key"
            ;;
    esac
}

main "$@"