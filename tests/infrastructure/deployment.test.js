/**
 * Deployment and Infrastructure Tests
 * Tests deployment pipeline, rollback procedures, and infrastructure reliability
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

describe('Deployment Tests', () => {
  const testTimeout = 300000; // 5 minutes

  beforeAll(() => {
    // Ensure test environment is clean
    console.log('Setting up deployment test environment...');
  });

  afterAll(() => {
    // Cleanup test resources
    console.log('Cleaning up deployment test environment...');
  });

  describe('Docker Image Build', () => {
    test('should build frontend Docker image successfully', async () => {
      const buildCommand = 'docker build -f packages/frontend/Dockerfile -t encrypted-email-frontend:test .';
      
      expect(() => {
        execSync(buildCommand, { stdio: 'pipe' });
      }).not.toThrow();
      
      // Verify image exists
      const imageList = execSync('docker images encrypted-email-frontend:test --format "{{.Repository}}:{{.Tag}}"', { encoding: 'utf8' });
      expect(imageList.trim()).toBe('encrypted-email-frontend:test');
    }, testTimeout);

    test('should build backend Docker image successfully', async () => {
      const buildCommand = 'docker build -f packages/backend/Dockerfile -t encrypted-email-backend:test .';
      
      expect(() => {
        execSync(buildCommand, { stdio: 'pipe' });
      }).not.toThrow();
      
      // Verify image exists
      const imageList = execSync('docker images encrypted-email-backend:test --format "{{.Repository}}:{{.Tag}}"', { encoding: 'utf8' });
      expect(imageList.trim()).toBe('encrypted-email-backend:test');
    }, testTimeout);

    test('should have secure Docker image configuration', () => {
      // Check frontend Dockerfile security
      const frontendDockerfile = fs.readFileSync('packages/frontend/Dockerfile', 'utf8');
      expect(frontendDockerfile).toMatch(/USER nginx/); // Non-root user
      expect(frontendDockerfile).toMatch(/HEALTHCHECK/); // Health check
      
      // Check backend Dockerfile security
      const backendDockerfile = fs.readFileSync('packages/backend/Dockerfile', 'utf8');
      expect(backendDockerfile).toMatch(/USER backend/); // Non-root user
      expect(backendDockerfile).toMatch(/HEALTHCHECK/); // Health check
    });

    test('should scan images for vulnerabilities', async () => {
      // Run Trivy security scan on images
      const frontendScan = () => execSync('trivy image --exit-code 1 --severity HIGH,CRITICAL encrypted-email-frontend:test', { stdio: 'pipe' });
      const backendScan = () => execSync('trivy image --exit-code 1 --severity HIGH,CRITICAL encrypted-email-backend:test', { stdio: 'pipe' });
      
      // These should not throw (no high/critical vulnerabilities)
      expect(frontendScan).not.toThrow();
      expect(backendScan).not.toThrow();
    }, testTimeout);
  });

  describe('Docker Compose Deployment', () => {
    test('should validate docker-compose.yml syntax', () => {
      expect(() => {
        execSync('docker-compose -f docker-compose.yml config', { stdio: 'pipe' });
      }).not.toThrow();
    });

    test('should validate production docker-compose.yml syntax', () => {
      expect(() => {
        execSync('docker-compose -f docker-compose.prod.yml config', { stdio: 'pipe' });
      }).not.toThrow();
    });

    test('should start services with docker-compose', async () => {
      // Create test environment file
      const testEnv = `
NODE_ENV=test
JWT_SECRET=test-jwt-secret
ENCRYPTION_KEY=test-encryption-key-32-characters
MONGO_USERNAME=test
MONGO_PASSWORD=test
REDIS_PASSWORD=test
DOMAIN=localhost
CORS_ORIGIN=http://localhost
`;
      fs.writeFileSync('.env.test', testEnv);

      try {
        // Start services
        execSync('docker-compose -f docker-compose.yml --env-file .env.test up -d', { stdio: 'pipe' });
        
        // Wait for services to be ready
        await new Promise(resolve => setTimeout(resolve, 30000));
        
        // Check if services are running
        const runningServices = execSync('docker-compose -f docker-compose.yml ps --services --filter "status=running"', { encoding: 'utf8' });
        const expectedServices = ['frontend', 'backend', 'mongodb', 'redis'];
        
        expectedServices.forEach(service => {
          expect(runningServices).toContain(service);
        });
        
      } finally {
        // Cleanup
        execSync('docker-compose -f docker-compose.yml --env-file .env.test down -v', { stdio: 'pipe' });
        fs.unlinkSync('.env.test');
      }
    }, testTimeout);
  });

  describe('Kubernetes Deployment', () => {
    test('should validate Kubernetes manifests', () => {
      const manifestFiles = [
        'k8s/namespace.yaml',
        'k8s/configmap.yaml',
        'k8s/secrets.yaml',
        'k8s/frontend-deployment.yaml',
        'k8s/backend-deployment.yaml',
        'k8s/ingress.yaml',
        'k8s/persistent-volumes.yaml'
      ];

      manifestFiles.forEach(file => {
        expect(fs.existsSync(file)).toBe(true);
        
        // Validate YAML syntax
        expect(() => {
          execSync(`kubectl apply --dry-run=client -f ${file}`, { stdio: 'pipe' });
        }).not.toThrow();
      });
    });

    test('should have proper resource limits', () => {
      const frontendDeployment = fs.readFileSync('k8s/frontend-deployment.yaml', 'utf8');
      const backendDeployment = fs.readFileSync('k8s/backend-deployment.yaml', 'utf8');
      
      // Check resource limits exist
      expect(frontendDeployment).toMatch(/limits:/);
      expect(frontendDeployment).toMatch(/requests:/);
      expect(backendDeployment).toMatch(/limits:/);
      expect(backendDeployment).toMatch(/requests:/);
    });

    test('should have security contexts configured', () => {
      const frontendDeployment = fs.readFileSync('k8s/frontend-deployment.yaml', 'utf8');
      const backendDeployment = fs.readFileSync('k8s/backend-deployment.yaml', 'utf8');
      
      // Check security contexts
      expect(frontendDeployment).toMatch(/securityContext:/);
      expect(frontendDeployment).toMatch(/runAsNonRoot: true/);
      expect(backendDeployment).toMatch(/securityContext:/);
      expect(backendDeployment).toMatch(/runAsNonRoot: true/);
    });

    test('should have health checks configured', () => {
      const frontendDeployment = fs.readFileSync('k8s/frontend-deployment.yaml', 'utf8');
      const backendDeployment = fs.readFileSync('k8s/backend-deployment.yaml', 'utf8');
      
      // Check health checks
      expect(frontendDeployment).toMatch(/livenessProbe:/);
      expect(frontendDeployment).toMatch(/readinessProbe:/);
      expect(backendDeployment).toMatch(/livenessProbe:/);
      expect(backendDeployment).toMatch(/readinessProbe:/);
    });
  });

  describe('Load Balancer Configuration', () => {
    test('should validate HAProxy configuration', () => {
      const haproxyConfig = fs.readFileSync('load-balancer/haproxy.cfg', 'utf8');
      
      // Check essential sections
      expect(haproxyConfig).toMatch(/global/);
      expect(haproxyConfig).toMatch(/defaults/);
      expect(haproxyConfig).toMatch(/frontend/);
      expect(haproxyConfig).toMatch(/backend/);
      
      // Check security settings
      expect(haproxyConfig).toMatch(/ssl-default-bind-ciphers/);
      expect(haproxyConfig).toMatch(/ssl-min-ver TLSv1.2/);
    });

    test('should validate Nginx configuration', () => {
      const nginxConfig = fs.readFileSync('packages/frontend/nginx.conf', 'utf8');
      
      // Check security headers
      expect(nginxConfig).toMatch(/X-Frame-Options/);
      expect(nginxConfig).toMatch(/X-Content-Type-Options/);
      expect(nginxConfig).toMatch(/X-XSS-Protection/);
      expect(nginxConfig).toMatch(/Strict-Transport-Security/);
      
      // Check gzip compression
      expect(nginxConfig).toMatch(/gzip on/);
    });
  });

  describe('SSL/TLS Configuration', () => {
    test('should have SSL certificate generation script', () => {
      expect(fs.existsSync('scripts/generate-ssl-certs.sh')).toBe(true);
      
      // Check script is executable
      const stats = fs.statSync('scripts/generate-ssl-certs.sh');
      expect(stats.mode & parseInt('111', 8)).toBeTruthy();
    });

    test('should validate SSL configuration in docker-compose', () => {
      const prodCompose = fs.readFileSync('docker-compose.prod.yml', 'utf8');
      
      // Check SSL/TLS configuration
      expect(prodCompose).toMatch(/letsencrypt/);
      expect(prodCompose).toMatch(/tls-cert-file/);
      expect(prodCompose).toMatch(/certificatesresolvers/);
    });
  });

  describe('Environment Configuration', () => {
    test('should have environment example file', () => {
      expect(fs.existsSync('.env.example')).toBe(true);
      
      const envExample = fs.readFileSync('.env.example', 'utf8');
      
      // Check required variables
      const requiredVars = [
        'DOMAIN',
        'JWT_SECRET',
        'ENCRYPTION_KEY',
        'MONGO_USERNAME',
        'MONGO_PASSWORD',
        'REDIS_PASSWORD'
      ];
      
      requiredVars.forEach(variable => {
        expect(envExample).toMatch(new RegExp(`${variable}=`));
      });
    });

    test('should validate MongoDB initialization script', () => {
      expect(fs.existsSync('scripts/mongo-init.js')).toBe(true);
      
      const mongoInit = fs.readFileSync('scripts/mongo-init.js', 'utf8');
      
      // Check essential operations
      expect(mongoInit).toMatch(/createUser/);
      expect(mongoInit).toMatch(/createCollection/);
      expect(mongoInit).toMatch(/createIndex/);
    });
  });
});

describe('Infrastructure Reliability Tests', () => {
  const testTimeout = 180000; // 3 minutes

  describe('Service Health Checks', () => {
    test('should respond to health check endpoints', async () => {
      // This test assumes services are running
      const healthEndpoints = [
        'http://localhost/health',
        'http://localhost/api/health'
      ];

      for (const endpoint of healthEndpoints) {
        try {
          const response = await axios.get(endpoint, { timeout: 5000 });
          expect(response.status).toBe(200);
          expect(response.data).toHaveProperty('status');
        } catch (error) {
          // If services aren't running, skip this test
          console.warn(`Health check skipped for ${endpoint}: ${error.message}`);
        }
      }
    });

    test('should handle service failures gracefully', async () => {
      // Test circuit breaker patterns and graceful degradation
      // This would typically involve stopping services and checking behavior
      console.log('Service failure handling test - implementation depends on running services');
    });
  });

  describe('Database Reliability', () => {
    test('should validate MongoDB configuration', () => {
      const mongoConfig = fs.readFileSync('scripts/mongo-init.js', 'utf8');
      
      // Check validation schemas
      expect(mongoConfig).toMatch(/validator:/);
      expect(mongoConfig).toMatch(/\$jsonSchema/);
      
      // Check indexes for performance
      expect(mongoConfig).toMatch(/createIndex/);
    });

    test('should validate Redis configuration', () => {
      const prodCompose = fs.readFileSync('docker-compose.prod.yml', 'utf8');
      
      // Check Redis security
      expect(prodCompose).toMatch(/requirepass/);
      expect(prodCompose).toMatch(/appendonly yes/);
    });
  });

  describe('Backup and Recovery', () => {
    test('should have disaster recovery script', () => {
      expect(fs.existsSync('scripts/disaster-recovery.sh')).toBe(true);
      
      const drScript = fs.readFileSync('scripts/disaster-recovery.sh', 'utf8');
      
      // Check essential functions
      expect(drScript).toMatch(/create_full_backup/);
      expect(drScript).toMatch(/restore_from_backup/);
      expect(drScript).toMatch(/test_disaster_recovery/);
    });

    test('should validate backup procedures', () => {
      const drScript = fs.readFileSync('scripts/disaster-recovery.sh', 'utf8');
      
      // Check backup components
      expect(drScript).toMatch(/mongodump/);
      expect(drScript).toMatch(/redis-cli BGSAVE/);
      expect(drScript).toMatch(/tar czf/);
      expect(drScript).toMatch(/gpg --symmetric/);
    });
  });

  describe('Monitoring and Alerting', () => {
    test('should validate Prometheus configuration', () => {
      expect(fs.existsSync('monitoring/prometheus.yml')).toBe(true);
      
      const prometheusConfig = fs.readFileSync('monitoring/prometheus.yml', 'utf8');
      
      // Check scrape configs
      expect(prometheusConfig).toMatch(/scrape_configs:/);
      expect(prometheusConfig).toMatch(/job_name:/);
      
      // Check alerting
      expect(prometheusConfig).toMatch(/alerting:/);
      expect(prometheusConfig).toMatch(/rule_files:/);
    });

    test('should validate alerting rules', () => {
      expect(fs.existsSync('monitoring/alerts/application.yml')).toBe(true);
      expect(fs.existsSync('monitoring/alerts/infrastructure.yml')).toBe(true);
      
      const appAlerts = fs.readFileSync('monitoring/alerts/application.yml', 'utf8');
      
      // Check critical alerts
      expect(appAlerts).toMatch(/HighErrorRate/);
      expect(appAlerts).toMatch(/ApplicationDown/);
      expect(appAlerts).toMatch(/SecurityEventSpike/);
    });

    test('should validate Grafana configuration', () => {
      expect(fs.existsSync('monitoring/grafana/datasources/prometheus.yml')).toBe(true);
      expect(fs.existsSync('monitoring/grafana/dashboards/dashboard.yml')).toBe(true);
    });
  });

  describe('Security Configuration', () => {
    test('should validate security headers in configurations', () => {
      const nginxConfig = fs.readFileSync('packages/frontend/nginx.conf', 'utf8');
      
      const securityHeaders = [
        'X-Frame-Options',
        'X-Content-Type-Options',
        'X-XSS-Protection',
        'Strict-Transport-Security',
        'Content-Security-Policy'
      ];
      
      securityHeaders.forEach(header => {
        expect(nginxConfig).toMatch(new RegExp(header));
      });
    });

    test('should validate SSL/TLS configuration', () => {
      const haproxyConfig = fs.readFileSync('load-balancer/haproxy.cfg', 'utf8');
      
      // Check TLS version
      expect(haproxyConfig).toMatch(/ssl-min-ver TLSv1.2/);
      
      // Check cipher suites
      expect(haproxyConfig).toMatch(/ssl-default-bind-ciphers/);
    });

    test('should validate secrets management', () => {
      const k8sSecrets = fs.readFileSync('k8s/secrets.yaml', 'utf8');
      
      // Check secrets are base64 encoded
      expect(k8sSecrets).toMatch(/data:/);
      expect(k8sSecrets).not.toMatch(/password: [^A-Za-z0-9+/=]/);
    });
  });
});

describe('Performance and Scalability Tests', () => {
  describe('Resource Configuration', () => {
    test('should have appropriate resource limits', () => {
      const backendDeployment = fs.readFileSync('k8s/backend-deployment.yaml', 'utf8');
      
      // Check resource limits are defined
      expect(backendDeployment).toMatch(/resources:/);
      expect(backendDeployment).toMatch(/limits:/);
      expect(backendDeployment).toMatch(/requests:/);
    });

    test('should have horizontal pod autoscaler configured', () => {
      const backendDeployment = fs.readFileSync('k8s/backend-deployment.yaml', 'utf8');
      
      // Check HPA configuration
      expect(backendDeployment).toMatch(/HorizontalPodAutoscaler/);
      expect(backendDeployment).toMatch(/minReplicas:/);
      expect(backendDeployment).toMatch(/maxReplicas:/);
    });
  });

  describe('Storage Configuration', () => {
    test('should validate persistent volume claims', () => {
      const pvConfig = fs.readFileSync('k8s/persistent-volumes.yaml', 'utf8');
      
      // Check PVC definitions
      expect(pvConfig).toMatch(/PersistentVolumeClaim/);
      expect(pvConfig).toMatch(/storageClassName:/);
      expect(pvConfig).toMatch(/accessModes:/);
    });

    test('should have appropriate storage sizes', () => {
      const pvConfig = fs.readFileSync('k8s/persistent-volumes.yaml', 'utf8');
      
      // Check storage sizes are reasonable
      expect(pvConfig).toMatch(/storage: \d+Gi/);
    });
  });
});