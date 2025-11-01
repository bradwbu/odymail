# Encrypted Email Service - Installation Guide

Welcome to the Encrypted Email Service installation guide. This document will walk you through setting up the application in development, staging, and production environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start (Development)](#quick-start-development)
- [Environment Configuration](#environment-configuration)
- [Development Setup](#development-setup)
- [Production Deployment](#production-deployment)
- [Monitoring Setup](#monitoring-setup)
- [Security Configuration](#security-configuration)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+ recommended), macOS 10.15+, or Windows 10+
- **Memory**: Minimum 8GB RAM (16GB recommended for production)
- **Storage**: Minimum 50GB free space (500GB+ recommended for production)
- **Network**: Stable internet connection for package downloads and SSL certificates

### Required Software

#### Core Dependencies
- **Node.js**: Version 18.x or higher
- **npm**: Version 8.x or higher (comes with Node.js)
- **Docker**: Version 20.x or higher
- **Docker Compose**: Version 2.x or higher

#### Optional (for advanced deployment)
- **Kubernetes**: Version 1.25+ (for K8s deployment)
- **kubectl**: Latest version
- **Helm**: Version 3.x (for K8s package management)

### Installation Commands

#### Ubuntu/Debian
```bash
# Update package list
sudo apt update

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for Docker group changes to take effect
```

#### macOS
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js
brew install node@18

# Install Docker Desktop
brew install --cask docker

# Start Docker Desktop from Applications
```

#### Windows
1. Download and install [Node.js 18.x](https://nodejs.org/)
2. Download and install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
3. Enable WSL2 integration in Docker Desktop settings

### Verification

Verify all prerequisites are installed correctly:

```bash
# Check Node.js version
node --version  # Should show v18.x.x or higher

# Check npm version
npm --version   # Should show 8.x.x or higher

# Check Docker version
docker --version  # Should show 20.x.x or higher

# Check Docker Compose version
docker-compose --version  # Should show 2.x.x or higher
```

## Quick Start (Development)

Get the application running locally in under 5 minutes:

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/encrypted-email-service.git
cd encrypted-email-service
```

### 2. Environment Setup

```bash
# Copy environment template
cp .env.example .env

# Edit the environment file with your settings
# At minimum, set secure values for:
# - JWT_SECRET
# - ENCRYPTION_KEY
# - MONGO_PASSWORD
# - REDIS_PASSWORD
```

### 3. Start Services

```bash
# Start all services with Docker Compose
docker-compose up -d

# Wait for services to be ready (about 30-60 seconds)
# Check service health
curl http://localhost/health
curl http://localhost/api/health
```

### 4. Access the Application

- **Frontend**: http://localhost
- **Backend API**: http://localhost/api
- **Grafana Dashboard**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090

That's it! The application should now be running locally.

## Environment Configuration

### Environment Variables

Create a `.env` file based on `.env.example` and configure the following variables:

#### Required Variables

```bash
# Domain Configuration
DOMAIN=yourdomain.com
ACME_EMAIL=admin@yourdomain.com

# Security Keys (MUST be changed for production)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
ENCRYPTION_KEY=your-32-character-encryption-key-here

# Database Configuration
MONGO_USERNAME=admin
MONGO_PASSWORD=your-secure-mongodb-password
REDIS_PASSWORD=your-secure-redis-password

# Payment Processing (Stripe)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
```

#### Optional Variables

```bash
# Email Configuration (for notifications)
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASSWORD=your-smtp-password

# Monitoring
GRAFANA_PASSWORD=your-secure-grafana-password

# Performance Tuning
NODE_OPTIONS=--max-old-space-size=2048
RATE_LIMIT_MAX_REQUESTS=100
```

### Security Considerations

⚠️ **Important Security Notes:**

1. **Never use default passwords in production**
2. **Generate strong, unique keys for JWT_SECRET and ENCRYPTION_KEY**
3. **Use environment-specific configurations**
4. **Keep .env files out of version control**

#### Generating Secure Keys

```bash
# Generate JWT secret (32+ characters)
openssl rand -base64 32

# Generate encryption key (exactly 32 characters)
openssl rand -base64 24

# Generate strong passwords
openssl rand -base64 16
```

## Development Setup

### Local Development

#### 1. Install Dependencies

```bash
# Install backend dependencies
cd packages/backend
npm install

# Install frontend dependencies
cd ../frontend
npm install

# Return to project root
cd ../..
```

#### 2. Database Setup

```bash
# Start only database services
docker-compose up -d mongodb redis

# Wait for databases to be ready
sleep 10

# Initialize MongoDB (optional - done automatically)
docker exec encrypted-email-mongodb mongo --eval "db.adminCommand('ping')"
```

#### 3. Development Servers

```bash
# Terminal 1: Start backend development server
cd packages/backend
npm run dev

# Terminal 2: Start frontend development server
cd packages/frontend
npm run dev
```

#### 4. Running Tests

```bash
# Run backend tests
cd packages/backend
npm test

# Run frontend tests
cd packages/frontend
npm test

# Run infrastructure tests
cd tests/infrastructure
npm install
npm test
```

### Development Tools

#### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type checking
npm run type-check
```

#### Database Management

```bash
# Access MongoDB shell
docker exec -it encrypted-email-mongodb mongo -u admin -p

# Access Redis CLI
docker exec -it encrypted-email-redis redis-cli -a your-redis-password
```

## Production Deployment

### Deployment Options

Choose the deployment method that best fits your infrastructure:

1. **Docker Compose** (Recommended for small to medium deployments)
2. **Kubernetes** (Recommended for large-scale deployments)
3. **Manual Installation** (For custom environments)

### Option 1: Docker Compose Deployment

#### 1. Server Preparation

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker and Docker Compose (see Prerequisites section)

# Create application directory
sudo mkdir -p /opt/encrypted-email
sudo chown $USER:$USER /opt/encrypted-email
cd /opt/encrypted-email

# Clone repository
git clone https://github.com/your-org/encrypted-email-service.git .
```

#### 2. Production Configuration

```bash
# Copy production environment template
cp .env.example .env

# Edit environment file with production values
nano .env

# Generate SSL certificates (for development/testing)
chmod +x scripts/generate-ssl-certs.sh
./scripts/generate-ssl-certs.sh
```

#### 3. Deploy Application

```bash
# Make deployment script executable
chmod +x scripts/deploy-production.sh

# Run production deployment
./scripts/deploy-production.sh
```

#### 4. Verify Deployment

```bash
# Check service status
docker-compose -f docker-compose.prod.yml ps

# Check application health
curl -k https://yourdomain.com/health
curl -k https://yourdomain.com/api/health

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Option 2: Kubernetes Deployment

#### 1. Cluster Preparation

```bash
# Ensure kubectl is configured for your cluster
kubectl cluster-info

# Create namespace
kubectl apply -f k8s/namespace.yaml
```

#### 2. Configure Secrets

```bash
# Update secrets with your values
nano k8s/secrets.yaml

# Apply secrets
kubectl apply -f k8s/secrets.yaml
```

#### 3. Deploy Application

```bash
# Apply all Kubernetes manifests
kubectl apply -f k8s/

# Wait for deployments to be ready
kubectl rollout status deployment/encrypted-email-frontend -n encrypted-email
kubectl rollout status deployment/encrypted-email-backend -n encrypted-email
```

#### 4. Configure Ingress

```bash
# Install cert-manager for SSL certificates
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Update ingress with your domain
nano k8s/ingress.yaml
kubectl apply -f k8s/ingress.yaml
```

### Option 3: Manual Installation

For custom environments or when Docker is not available:

#### 1. Install Dependencies

```bash
# Install Node.js, MongoDB, Redis (see Prerequisites)

# Install PM2 for process management
npm install -g pm2
```

#### 2. Build Application

```bash
# Build backend
cd packages/backend
npm install --production
npm run build

# Build frontend
cd ../frontend
npm install --production
npm run build
```

#### 3. Configure Services

```bash
# Configure MongoDB
sudo systemctl enable mongod
sudo systemctl start mongod

# Configure Redis
sudo systemctl enable redis
sudo systemctl start redis

# Configure Nginx (copy from packages/frontend/nginx.conf)
sudo cp packages/frontend/nginx.conf /etc/nginx/sites-available/encrypted-email
sudo ln -s /etc/nginx/sites-available/encrypted-email /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

#### 4. Start Application

```bash
# Start backend with PM2
cd packages/backend
pm2 start dist/index.js --name encrypted-email-backend

# Serve frontend with Nginx (already configured above)

# Save PM2 configuration
pm2 save
pm2 startup
```

## Monitoring Setup

### Prometheus and Grafana

The monitoring stack is included in the Docker Compose setup:

#### Access Monitoring

- **Grafana**: http://localhost:3000 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Alertmanager**: http://localhost:9093

#### Configure Alerting

1. **Email Alerts**:
   ```bash
   # Edit alertmanager configuration
   nano monitoring/alertmanager.yml
   
   # Update SMTP settings
   # Restart services
   docker-compose restart alertmanager
   ```

2. **Slack Integration**:
   ```bash
   # Add Slack webhook URL to alertmanager.yml
   # Configure channels and notification rules
   ```

#### Custom Dashboards

1. Access Grafana at http://localhost:3000
2. Import dashboards from `monitoring/grafana/dashboards/json/`
3. Configure data sources (Prometheus URL: http://prometheus:9090)

### Log Management

Logs are collected using Loki and Promtail:

1. **View Logs**: Access through Grafana → Explore → Loki
2. **Log Retention**: Configure in `monitoring/loki.yml`
3. **Log Shipping**: Configure additional sources in `monitoring/promtail.yml`

## Security Configuration

### SSL/TLS Setup

#### Development (Self-Signed Certificates)

```bash
# Generate development certificates
./scripts/generate-ssl-certs.sh
```

#### Production (Let's Encrypt)

```bash
# Using Docker Compose with Traefik
# Certificates are automatically generated and renewed

# Manual setup with Certbot
sudo apt install certbot
sudo certbot certonly --standalone -d yourdomain.com
```

### Firewall Configuration

```bash
# Ubuntu/Debian with UFW
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# Optional: Monitoring access
sudo ufw allow from trusted-ip to any port 3000  # Grafana
sudo ufw allow from trusted-ip to any port 9090  # Prometheus
```

### Security Hardening

1. **Database Security**:
   ```bash
   # MongoDB authentication is enabled by default
   # Redis password is required
   # Regular security updates
   ```

2. **Application Security**:
   - Rate limiting is enabled
   - Input validation and sanitization
   - CSRF protection
   - Security headers configured

3. **Infrastructure Security**:
   - Non-root containers
   - Read-only filesystems
   - Security contexts in Kubernetes

## Troubleshooting

### Common Issues

#### Services Won't Start

```bash
# Check Docker status
docker ps -a

# Check logs
docker-compose logs service-name

# Check disk space
df -h

# Check memory usage
free -h
```

#### Database Connection Issues

```bash
# Check MongoDB status
docker exec encrypted-email-mongodb mongo --eval "db.adminCommand('ping')"

# Check Redis status
docker exec encrypted-email-redis redis-cli ping

# Verify credentials in .env file
```

#### SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in ssl/certificate.crt -text -noout

# Verify certificate chain
openssl verify -CAfile ssl/ca.crt ssl/certificate.crt

# Check Let's Encrypt renewal
sudo certbot renew --dry-run
```

#### Performance Issues

```bash
# Check resource usage
docker stats

# Monitor application metrics
curl http://localhost/api/metrics

# Check database performance
docker exec encrypted-email-mongodb mongostat
```

### Log Analysis

#### Application Logs

```bash
# Backend logs
docker-compose logs -f backend

# Frontend logs (Nginx)
docker-compose logs -f frontend

# Database logs
docker-compose logs -f mongodb
```

#### System Logs

```bash
# System journal
sudo journalctl -f

# Docker daemon logs
sudo journalctl -u docker -f
```

### Health Checks

```bash
# Application health
curl http://localhost/health
curl http://localhost/api/health

# Database health
docker exec encrypted-email-mongodb mongo --eval "db.runCommand('ping')"
docker exec encrypted-email-redis redis-cli ping

# Service discovery
docker-compose ps
```

## Maintenance

### Regular Maintenance Tasks

#### Daily
- Monitor application health and performance
- Check error logs for issues
- Verify backup completion

#### Weekly
- Update security patches
- Review monitoring alerts
- Clean up old logs and temporary files

#### Monthly
- Update dependencies
- Review and rotate secrets
- Performance optimization review

### Backup and Recovery

#### Automated Backups

```bash
# Run backup script
./scripts/disaster-recovery.sh backup

# Schedule with cron
crontab -e
# Add: 0 2 * * * /path/to/encrypted-email/scripts/disaster-recovery.sh backup
```

#### Manual Backup

```bash
# Database backup
docker exec encrypted-email-mongodb mongodump --out /tmp/backup
docker cp encrypted-email-mongodb:/tmp/backup ./backup-$(date +%Y%m%d)

# File backup
docker run --rm -v backend-uploads:/data -v $(pwd):/backup alpine tar czf /backup/uploads-$(date +%Y%m%d).tar.gz -C /data .
```

#### Recovery

```bash
# Restore from backup
./scripts/disaster-recovery.sh restore backup_name.tar.gz.gpg

# Manual restore
docker exec encrypted-email-mongodb mongorestore /tmp/backup
```

### Updates and Upgrades

#### Application Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart services
docker-compose build
docker-compose up -d

# Run database migrations if needed
docker exec encrypted-email-backend npm run migrate
```

#### Security Updates

```bash
# Update base images
docker-compose pull

# Rebuild with latest base images
docker-compose build --no-cache

# Update system packages
sudo apt update && sudo apt upgrade -y
```

### Monitoring and Alerting

#### Key Metrics to Monitor

- **Application Performance**: Response times, error rates, throughput
- **Infrastructure**: CPU, memory, disk usage, network
- **Security**: Failed login attempts, suspicious activities
- **Business**: User registrations, email volume, storage usage

#### Alert Configuration

1. **Critical Alerts**: Service down, database unavailable, high error rate
2. **Warning Alerts**: High resource usage, slow response times
3. **Info Alerts**: Successful deployments, backup completion

### Support and Documentation

#### Getting Help

1. **Documentation**: Check this guide and inline code comments
2. **Logs**: Always check application and system logs first
3. **Community**: GitHub issues and discussions
4. **Professional Support**: Contact your system administrator

#### Reporting Issues

When reporting issues, include:
- Environment details (OS, Docker version, etc.)
- Error messages and logs
- Steps to reproduce
- Expected vs actual behavior

---

## Quick Reference

### Essential Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Check health
curl http://localhost/health

# Backup
./scripts/disaster-recovery.sh backup

# Deploy production
./scripts/deploy-production.sh
```

### Important URLs

- **Application**: http://localhost or https://yourdomain.com
- **API Documentation**: http://localhost/api/docs
- **Monitoring**: http://localhost:3000 (Grafana)
- **Metrics**: http://localhost:9090 (Prometheus)

### Support Contacts

- **Technical Issues**: Create GitHub issue
- **Security Issues**: security@yourdomain.com
- **General Questions**: support@yourdomain.com

---

**Congratulations!** You now have a fully functional Encrypted Email Service. For additional help, refer to the troubleshooting section or contact support.