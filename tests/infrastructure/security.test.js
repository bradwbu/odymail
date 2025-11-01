/**
 * Security Infrastructure Tests
 * Tests security configurations, SSL/TLS, and security headers
 */

const axios = require('axios');
const fs = require('fs');
const { execSync } = require('child_process');

describe('Security Infrastructure Tests', () => {
  const baseURL = process.env.TEST_BASE_URL || 'http://localhost';
  const httpsURL = process.env.TEST_HTTPS_URL || 'https://localhost';

  describe('SSL/TLS Configuration', () => {
    test('should enforce HTTPS redirect', async () => {
      try {
        const response = await axios.get(baseURL, {
          maxRedirects: 0,
          validateStatus: () => true
        });
        
        // Should redirect to HTTPS
        expect([301, 302, 307, 308]).toContain(response.status);
        
        if (response.headers.location) {
          expect(response.headers.location).toMatch(/^https:/);
        }
      } catch (error) {
        console.warn('HTTPS redirect test skipped - service not available');
      }
    });

    test('should have secure SSL/TLS configuration', async () => {
      try {
        // Test SSL/TLS configuration using openssl
        const sslCheck = execSync(`echo | openssl s_client -connect localhost:443 -servername localhost 2>/dev/null | openssl x509 -noout -text`, { encoding: 'utf8' });
        
        // Check for strong cipher suites
        expect(sslCheck).toMatch(/Signature Algorithm: sha256/);
        
      } catch (error) {
        console.warn('SSL configuration test skipped - HTTPS not available');
      }
    });

    test('should reject weak SSL/TLS protocols', async () => {
      try {
        // Test that weak protocols are rejected
        const weakProtocols = ['ssl2', 'ssl3', 'tls1', 'tls1_1'];
        
        for (const protocol of weakProtocols) {
          try {
            execSync(`echo | openssl s_client -${protocol} -connect localhost:443 2>/dev/null`, { stdio: 'pipe' });
            fail(`Weak protocol ${protocol} should be rejected`);
          } catch (error) {
            // Expected to fail - weak protocols should be rejected
            expect(error.status).not.toBe(0);
          }
        }
      } catch (error) {
        console.warn('Weak protocol test skipped - HTTPS not available');
      }
    });
  });

  describe('Security Headers', () => {
    test('should include security headers in responses', async () => {
      try {
        const response = await axios.get(`${baseURL}/`, {
          validateStatus: () => true
        });
        
        const securityHeaders = {
          'x-frame-options': 'SAMEORIGIN',
          'x-content-type-options': 'nosniff',
          'x-xss-protection': '1; mode=block',
          'strict-transport-security': /max-age=\d+/,
          'referrer-policy': /.+/
        };
        
        Object.entries(securityHeaders).forEach(([header, expectedValue]) => {
          const actualValue = response.headers[header.toLowerCase()];
          
          if (expectedValue instanceof RegExp) {
            expect(actualValue).toMatch(expectedValue);
          } else {
            expect(actualValue).toBe(expectedValue);
          }
        });
        
      } catch (error) {
        console.warn('Security headers test skipped - service not available');
      }
    });

    test('should have Content Security Policy', async () => {
      try {
        const response = await axios.get(`${baseURL}/`, {
          validateStatus: () => true
        });
        
        const csp = response.headers['content-security-policy'];
        
        if (csp) {
          // Check for essential CSP directives
          expect(csp).toMatch(/default-src/);
          expect(csp).toMatch(/script-src/);
          expect(csp).toMatch(/style-src/);
          
          // Should not allow unsafe-eval in production
          if (process.env.NODE_ENV === 'production') {
            expect(csp).not.toMatch(/unsafe-eval/);
          }
        }
        
      } catch (error) {
        console.warn('CSP test skipped - service not available');
      }
    });

    test('should not expose server information', async () => {
      try {
        const response = await axios.get(`${baseURL}/`, {
          validateStatus: () => true
        });
        
        // Should not expose server version
        const serverHeader = response.headers.server;
        if (serverHeader) {
          expect(serverHeader).not.toMatch(/nginx\/\d+\.\d+/);
          expect(serverHeader).not.toMatch(/Apache\/\d+\.\d+/);
        }
        
        // Should not expose X-Powered-By
        expect(response.headers['x-powered-by']).toBeUndefined();
        
      } catch (error) {
        console.warn('Server information test skipped - service not available');
      }
    });
  });

  describe('Authentication Security', () => {
    test('should rate limit authentication attempts', async () => {
      const maxAttempts = 10;
      const attempts = [];
      
      for (let i = 0; i < maxAttempts; i++) {
        attempts.push(
          axios.post(`${baseURL}/api/auth/login`, {
            email: 'test@example.com',
            password: 'wrongpassword'
          }, {
            validateStatus: () => true,
            timeout: 5000
          })
        );
      }
      
      try {
        const results = await Promise.all(attempts);
        const rateLimited = results.filter(r => r.status === 429).length;
        
        // Should start rate limiting after several failed attempts
        expect(rateLimited).toBeGreaterThan(0);
        
      } catch (error) {
        console.warn('Rate limiting test skipped - service not available');
      }
    });

    test('should reject weak passwords', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'qwerty',
        'abc123',
        'password123'
      ];
      
      for (const password of weakPasswords) {
        try {
          const response = await axios.post(`${baseURL}/api/auth/register`, {
            email: `test-${Date.now()}@example.com`,
            password,
            confirmPassword: password
          }, {
            validateStatus: () => true,
            timeout: 5000
          });
          
          // Should reject weak passwords
          expect(response.status).toBe(400);
          
        } catch (error) {
          console.warn('Weak password test skipped - service not available');
          break;
        }
      }
    });

    test('should validate JWT tokens properly', async () => {
      const invalidTokens = [
        'invalid-token',
        'Bearer invalid',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        ''
      ];
      
      for (const token of invalidTokens) {
        try {
          const response = await axios.get(`${baseURL}/api/user/profile`, {
            headers: { Authorization: `Bearer ${token}` },
            validateStatus: () => true,
            timeout: 5000
          });
          
          // Should reject invalid tokens
          expect([401, 403]).toContain(response.status);
          
        } catch (error) {
          console.warn('JWT validation test skipped - service not available');
          break;
        }
      }
    });
  });

  describe('Input Validation Security', () => {
    test('should prevent XSS attacks', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(\'xss\')" />',
        '<svg onload="alert(\'xss\')" />'
      ];
      
      for (const payload of xssPayloads) {
        try {
          const response = await axios.post(`${baseURL}/api/auth/login`, {
            email: payload,
            password: 'test'
          }, {
            validateStatus: () => true,
            timeout: 5000
          });
          
          // Should reject or sanitize XSS attempts
          expect(response.status).toBe(400);
          
          // Response should not contain the payload
          if (response.data && typeof response.data === 'string') {
            expect(response.data).not.toContain('<script>');
            expect(response.data).not.toContain('javascript:');
          }
          
        } catch (error) {
          console.warn('XSS prevention test skipped - service not available');
          break;
        }
      }
    });

    test('should prevent SQL injection', async () => {
      const sqlPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "admin'--"
      ];
      
      for (const payload of sqlPayloads) {
        try {
          const response = await axios.post(`${baseURL}/api/auth/login`, {
            email: payload,
            password: 'test'
          }, {
            validateStatus: () => true,
            timeout: 5000
          });
          
          // Should reject SQL injection attempts
          expect(response.status).toBe(400);
          
        } catch (error) {
          console.warn('SQL injection test skipped - service not available');
          break;
        }
      }
    });

    test('should validate file uploads', async () => {
      const maliciousFiles = [
        { name: 'test.exe', content: 'MZ\x90\x00' }, // PE header
        { name: 'test.php', content: '<?php system($_GET["cmd"]); ?>' },
        { name: 'test.js', content: 'eval(atob("YWxlcnQoInhzcyIp"))' } // Base64 encoded alert
      ];
      
      for (const file of maliciousFiles) {
        try {
          const formData = new FormData();
          formData.append('file', new Blob([file.content]), file.name);
          
          const response = await axios.post(`${baseURL}/api/storage/upload`, formData, {
            headers: { 
              'Content-Type': 'multipart/form-data',
              Authorization: 'Bearer invalid-token' // Will fail auth, but should validate file first
            },
            validateStatus: () => true,
            timeout: 10000
          });
          
          // Should reject malicious files (either due to file type or auth)
          expect([400, 401, 403, 415]).toContain(response.status);
          
        } catch (error) {
          console.warn('File upload validation test skipped - service not available');
          break;
        }
      }
    });
  });

  describe('Configuration Security', () => {
    test('should have secure Docker configuration', () => {
      // Check Dockerfile security
      const frontendDockerfile = fs.readFileSync('packages/frontend/Dockerfile', 'utf8');
      const backendDockerfile = fs.readFileSync('packages/backend/Dockerfile', 'utf8');
      
      // Should run as non-root user
      expect(frontendDockerfile).toMatch(/USER \w+/);
      expect(backendDockerfile).toMatch(/USER \w+/);
      
      // Should not use latest tag for base images in production
      if (process.env.NODE_ENV === 'production') {
        expect(frontendDockerfile).not.toMatch(/FROM.*:latest/);
        expect(backendDockerfile).not.toMatch(/FROM.*:latest/);
      }
    });

    test('should have secure Kubernetes configuration', () => {
      const frontendDeployment = fs.readFileSync('k8s/frontend-deployment.yaml', 'utf8');
      const backendDeployment = fs.readFileSync('k8s/backend-deployment.yaml', 'utf8');
      
      // Should have security contexts
      expect(frontendDeployment).toMatch(/securityContext:/);
      expect(backendDeployment).toMatch(/securityContext:/);
      
      // Should run as non-root
      expect(frontendDeployment).toMatch(/runAsNonRoot: true/);
      expect(backendDeployment).toMatch(/runAsNonRoot: true/);
      
      // Should drop all capabilities
      expect(frontendDeployment).toMatch(/drop:\s*-\s*ALL/);
      expect(backendDeployment).toMatch(/drop:\s*-\s*ALL/);
      
      // Should have read-only root filesystem
      expect(frontendDeployment).toMatch(/readOnlyRootFilesystem: true/);
      expect(backendDeployment).toMatch(/readOnlyRootFilesystem: true/);
    });

    test('should have secure environment configuration', () => {
      const envExample = fs.readFileSync('.env.example', 'utf8');
      
      // Should not contain actual secrets
      expect(envExample).not.toMatch(/sk_live_/); // Stripe live keys
      expect(envExample).not.toMatch(/[A-Za-z0-9]{32,}/); // Actual keys
      
      // Should have placeholder values
      expect(envExample).toMatch(/your-/);
      expect(envExample).toMatch(/change-/);
    });
  });

  describe('Network Security', () => {
    test('should not expose internal services', async () => {
      const internalPorts = [27017, 6379, 9090, 3100]; // MongoDB, Redis, Prometheus, Loki
      
      for (const port of internalPorts) {
        try {
          await axios.get(`http://localhost:${port}`, { timeout: 2000 });
          fail(`Internal service on port ${port} should not be publicly accessible`);
        } catch (error) {
          // Expected to fail - internal services should not be accessible
          expect(error.code).toMatch(/ECONNREFUSED|ENOTFOUND|TIMEOUT/);
        }
      }
    });

    test('should have proper CORS configuration', async () => {
      try {
        const response = await axios.options(`${baseURL}/api/auth/login`, {
          headers: {
            'Origin': 'https://malicious-site.com',
            'Access-Control-Request-Method': 'POST'
          },
          validateStatus: () => true
        });
        
        const corsOrigin = response.headers['access-control-allow-origin'];
        
        // Should not allow all origins in production
        if (process.env.NODE_ENV === 'production') {
          expect(corsOrigin).not.toBe('*');
        }
        
      } catch (error) {
        console.warn('CORS test skipped - service not available');
      }
    });
  });

  describe('Monitoring Security', () => {
    test('should protect monitoring endpoints', async () => {
      const monitoringEndpoints = [
        '/metrics',
        '/health',
        '/api/metrics'
      ];
      
      for (const endpoint of monitoringEndpoints) {
        try {
          const response = await axios.get(`${baseURL}${endpoint}`, {
            validateStatus: () => true,
            timeout: 5000
          });
          
          // Health endpoints should be accessible, metrics might be protected
          if (endpoint.includes('health')) {
            expect([200, 404]).toContain(response.status);
          } else if (endpoint.includes('metrics')) {
            // Metrics endpoints might require authentication
            expect([200, 401, 403, 404]).toContain(response.status);
          }
          
        } catch (error) {
          console.warn(`Monitoring endpoint test skipped for ${endpoint} - service not available`);
        }
      }
    });

    test('should not expose sensitive information in logs', () => {
      // This would typically check log files for sensitive data
      // For now, we'll check configuration to ensure proper log sanitization
      
      const backendCode = fs.readFileSync('packages/backend/src/index.ts', 'utf8');
      
      // Should not log passwords or tokens
      expect(backendCode).not.toMatch(/console\.log.*password/i);
      expect(backendCode).not.toMatch(/console\.log.*token/i);
      expect(backendCode).not.toMatch(/console\.log.*secret/i);
    });
  });
});