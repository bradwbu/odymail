# Encrypted Email Service

A secure, end-to-end encrypted email service with cloud storage, built with modern web technologies and enterprise-grade security.

## ✨ Features

- 🔐 **End-to-End Encryption** - Client-side encryption using RSA and AES-256-GCM
- 📧 **Secure Email** - Encrypted email communication with @odyssie.net addresses
- ☁️ **Cloud Storage** - Encrypted file storage with sharing capabilities
- 💳 **Subscription Management** - Flexible billing with Stripe integration
- 📊 **Analytics Dashboard** - Usage tracking and storage management
- 🛡️ **Security Features** - Rate limiting, abuse prevention, and security monitoring
- 🌐 **Cross-Platform** - Responsive web interface with offline support
- 📈 **Monitoring** - Comprehensive monitoring with Prometheus and Grafana

## 🚀 Quick Start

Get up and running in under 5 minutes:

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- [Docker](https://www.docker.com/get-started)
- [Docker Compose](https://docs.docker.com/compose/install/)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/encrypted-email-service.git
cd encrypted-email-service

# Copy environment configuration
cp .env.example .env

# Start all services
docker-compose up -d

# Wait for services to be ready (30-60 seconds)
# Check health
curl http://localhost/health
```

### Access the Application

- **Web App**: http://localhost
- **API**: http://localhost/api
- **Monitoring**: http://localhost:3000 (admin/admin)

That's it! 🎉

## 📖 Documentation

- **[Installation Guide](INSTALLATION.md)** - Complete setup instructions
- **[API Documentation](docs/api.md)** - REST API reference
- **[Architecture Guide](docs/architecture.md)** - System design and components
- **[Security Guide](docs/security.md)** - Security features and best practices
- **[Deployment Guide](docs/deployment.md)** - Production deployment options

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │    Backend      │    │   Database      │
│   (React)       │◄──►│   (Node.js)     │◄──►│   (MongoDB)     │
│                 │    │                 │    │                 │
│ • React 18      │    │ • Express.js    │    │ • MongoDB 6.0   │
│ • TypeScript    │    │ • TypeScript    │    │ • Redis 7       │
│ • Vite          │    │ • JWT Auth      │    │                 │
│ • Framer Motion │    │ • WebSockets    │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Monitoring    │
                    │                 │
                    │ • Prometheus    │
                    │ • Grafana       │
                    │ • Loki          │
                    │ • Alertmanager  │
                    └─────────────────┘
```

## 🔧 Development

### Local Development

```bash
# Install dependencies
npm install

# Start backend development server
cd packages/backend
npm run dev

# Start frontend development server (new terminal)
cd packages/frontend
npm run dev
```

### Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:backend
npm run test:frontend
npm run test:e2e

# Run infrastructure tests
cd tests/infrastructure
npm test
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type checking
npm run type-check
```

## 🚀 Deployment

### Docker Compose (Recommended)

```bash
# Production deployment
./scripts/deploy-production.sh

# Staging deployment
./scripts/deploy-staging.sh
```

### Kubernetes

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/

# Check deployment status
kubectl get pods -n encrypted-email
```

### Manual Deployment

See the [Installation Guide](INSTALLATION.md) for detailed manual deployment instructions.

## 🛡️ Security

This application implements enterprise-grade security features:

- **Encryption**: End-to-end encryption with RSA-4096 and AES-256-GCM
- **Authentication**: JWT-based authentication with secure session management
- **Authorization**: Role-based access control and permission systems
- **Input Validation**: Comprehensive input sanitization and validation
- **Rate Limiting**: API rate limiting and abuse prevention
- **Security Headers**: HSTS, CSP, and other security headers
- **Monitoring**: Security event logging and intrusion detection

## 📊 Monitoring

Built-in monitoring stack includes:

- **Prometheus** - Metrics collection and alerting
- **Grafana** - Visualization and dashboards
- **Loki** - Log aggregation and analysis
- **Alertmanager** - Alert routing and notifications

Access monitoring at http://localhost:3000 (admin/admin)

## 🔄 CI/CD

Automated pipelines for:

- **Testing** - Unit, integration, and security tests
- **Building** - Docker image builds with security scanning
- **Deployment** - Blue-green deployments with rollback
- **Monitoring** - Health checks and performance monitoring

Supports both GitHub Actions and GitLab CI/CD.

## 📝 Environment Variables

Key configuration variables:

```bash
# Security (REQUIRED)
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters-long
ENCRYPTION_KEY=your-32-character-encryption-key-here

# Database
MONGO_USERNAME=admin
MONGO_PASSWORD=your-secure-mongodb-password
REDIS_PASSWORD=your-secure-redis-password

# Domain
DOMAIN=yourdomain.com
CORS_ORIGIN=https://yourdomain.com

# Payment (Stripe)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
```

See `.env.example` for all available options.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass (`npm test`)
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check our [Installation Guide](INSTALLATION.md)
- **Issues**: [GitHub Issues](https://github.com/your-org/encrypted-email-service/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/encrypted-email-service/discussions)
- **Security**: Report security issues to security@yourdomain.com

## 🙏 Acknowledgments

- Built with [React](https://reactjs.org/) and [Node.js](https://nodejs.org/)
- Encryption powered by [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- Monitoring by [Prometheus](https://prometheus.io/) and [Grafana](https://grafana.com/)
- Payments by [Stripe](https://stripe.com/)

---

**Made with ❤️ for secure communication**

[![Build Status](https://github.com/your-org/encrypted-email-service/workflows/CI/badge.svg)](https://github.com/your-org/encrypted-email-service/actions)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=encrypted-email-service&metric=security_rating)](https://sonarcloud.io/dashboard?id=encrypted-email-service)
[![Coverage](https://codecov.io/gh/your-org/encrypted-email-service/branch/main/graph/badge.svg)](https://codecov.io/gh/your-org/encrypted-email-service)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)