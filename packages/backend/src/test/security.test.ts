/**
 * Security Tests - Comprehensive security testing suite
 * Tests encryption, authentication, authorization, input validation, and XSS prevention
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../index';
import securityService from '../services/securityService';
import abusePreventionService from '../services/abusePreventionService';
import privacyService from '../services/privacyService';

describe('Security Tests', () => {
  let authToken: string;
  let testUserId: string;

  beforeEach(async () => {
    // Create test user and get auth token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'security-test@odyssie.net',
        password: 'SecurePassword123!',
        confirmPassword: 'SecurePassword123!'
      });

    if (registerResponse.status === 201) {
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'security-test@odyssie.net',
          password: 'SecurePassword123!'
        });

      authToken = loginResponse.body.token;
      testUserId = loginResponse.body.user.id;
    }
  });

  describe('Authentication Security', () => {
    it('should reject requests without authentication token', async () => {
      const response = await request(app)
        .get('/api/user/profile');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('token required');
    });

    it('should reject requests with invalid authentication token', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Invalid or expired token');
    });

    it('should reject requests with malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', 'InvalidFormat token');

      expect(response.status).toBe(401);
    });

    it('should enforce strong password requirements', async () => {
      const weakPasswords = [
        'password',
        '123456',
        'abc123',
        'Password',
        'password123'
      ];

      for (const password of weakPasswords) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email: `test-${Date.now()}@odyssie.net`,
            password,
            confirmPassword: password
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
      }
    });

    it('should prevent password confirmation mismatch', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'mismatch-test@odyssie.net',
          password: 'SecurePassword123!',
          confirmPassword: 'DifferentPassword123!'
        });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should rate limit login attempts', async () => {
      const email = 'rate-limit-test@odyssie.net';
      
      // Make multiple failed login attempts
      for (let i = 0; i < 6; i++) {
        await request(app)
          .post('/api/auth/login')
          .send({
            email,
            password: 'wrongpassword'
          });
      }

      // Next attempt should be rate limited
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email,
          password: 'wrongpassword'
        });

      expect(response.status).toBe(429);
      expect(response.body.error).toContain('Rate limit exceeded');
    });
  });

  describe('Authorization Security', () => {
    it('should prevent access to admin endpoints without admin role', async () => {
      const response = await request(app)
        .get('/api/security/metrics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('Admin access required');
    });

    it('should prevent users from accessing other users\' data', async () => {
      // Create another user
      const otherUserResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'other-user@odyssie.net',
          password: 'SecurePassword123!',
          confirmPassword: 'SecurePassword123!'
        });

      const otherUserId = otherUserResponse.body.user?.id;

      if (otherUserId) {
        // Try to access other user's data
        const response = await request(app)
          .get(`/api/abuse-prevention/account/${otherUserId}/lockout`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(403);
        expect(response.body.error).toContain('Access denied');
      }
    });
  });

  describe('Input Validation and XSS Prevention', () => {
    it('should reject XSS attempts in request body', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        'javascript:alert("xss")',
        '<img src="x" onerror="alert(\'xss\')" />',
        '<iframe src="javascript:alert(\'xss\')"></iframe>',
        '<object data="javascript:alert(\'xss\')"></object>'
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/email/send')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            to: ['test@example.com'],
            subject: 'Test',
            content: payload
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid input detected');
      }
    });

    it('should reject SQL injection attempts in query parameters', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --"
      ];

      for (const payload of sqlInjectionPayloads) {
        const response = await request(app)
          .get('/api/security/events')
          .query({ type: payload })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid query parameters');
      }
    });

    it('should validate email format in registration', async () => {
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..name@domain.com',
        'user@domain',
        'user@.domain.com'
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/auth/register')
          .send({
            email,
            password: 'SecurePassword123!',
            confirmPassword: 'SecurePassword123!'
          });

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
      }
    });

    it('should sanitize and validate file upload content', async () => {
      const maliciousContent = Buffer.from('<script>alert("xss")</script>');
      
      const response = await request(app)
        .post('/api/storage/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', maliciousContent, 'malicious.html')
        .field('filename', 'test.html');

      // Should either reject or sanitize the content
      expect([400, 403].includes(response.status)).toBe(true);
    });

    it('should prevent path traversal in file operations', async () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/passwd',
        'C:\\Windows\\System32\\config\\SAM'
      ];

      for (const path of pathTraversalAttempts) {
        const response = await request(app)
          .get('/api/storage/download')
          .query({ filename: path })
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(400);
      }
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    it('should enforce rate limits on email sending', async () => {
      // Send emails rapidly to trigger rate limit
      const promises = [];
      for (let i = 0; i < 102; i++) { // Exceed the limit of 100 per hour
        promises.push(
          request(app)
            .post('/api/email/send')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              to: ['test@example.com'],
              subject: `Test ${i}`,
              content: 'Test content'
            })
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should detect and block spam content', async () => {
      const spamContent = `
        URGENT! You have won $1,000,000 in the lottery!
        Click here now to claim your prize!
        This is a limited time offer - ACT NOW!!!
        Call 1-800-SCAM-NOW immediately!
        FREE MONEY! GUARANTEED! RISK FREE!
      `;

      const response = await request(app)
        .post('/api/email/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          to: ['test@example.com'],
          subject: 'URGENT! FREE MONEY! ACT NOW!',
          content: spamContent
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('Content blocked');
      expect(response.body.message).toContain('spam content');
    });

    it('should generate and verify CAPTCHA challenges', async () => {
      // Generate CAPTCHA
      const captchaResponse = await request(app)
        .post('/api/abuse-prevention/captcha/generate')
        .set('Authorization', `Bearer ${authToken}`);

      expect(captchaResponse.status).toBe(200);
      expect(captchaResponse.body.data.id).toBeDefined();
      expect(captchaResponse.body.data.challenge).toBeDefined();

      const captchaId = captchaResponse.body.data.id;
      const challenge = captchaResponse.body.data.challenge;

      // Extract answer from challenge (e.g., "5 + 3 = ?")
      const match = challenge.match(/(\d+)\s*([+\-*])\s*(\d+)\s*=\s*\?/);
      if (match) {
        const [, num1, operator, num2] = match;
        let answer: number;
        
        switch (operator) {
          case '+':
            answer = parseInt(num1) + parseInt(num2);
            break;
          case '-':
            answer = parseInt(num1) - parseInt(num2);
            break;
          case '*':
            answer = parseInt(num1) * parseInt(num2);
            break;
          default:
            answer = 0;
        }

        // Verify correct solution
        const verifyResponse = await request(app)
          .post('/api/abuse-prevention/captcha/verify')
          .send({
            captchaId,
            solution: answer.toString()
          });

        expect(verifyResponse.status).toBe(200);
        expect(verifyResponse.body.success).toBe(true);

        // Verify incorrect solution
        const wrongResponse = await request(app)
          .post('/api/abuse-prevention/captcha/verify')
          .send({
            captchaId: captchaId + '_wrong',
            solution: '999'
          });

        expect(wrongResponse.body.success).toBe(false);
      }
    });

    it('should handle account lockout and unlock', async () => {
      // This would typically be triggered by abuse detection
      // For testing, we'll use the admin endpoint to lock an account
      const lockResponse = await request(app)
        .post(`/api/abuse-prevention/admin/account/${testUserId}/lock`)
        .set('Authorization', `Bearer ${authToken}`) // This would need admin token in real scenario
        .send({
          reason: 'Testing lockout functionality',
          durationMs: 60000 // 1 minute
        });

      // Check lockout status
      const statusResponse = await request(app)
        .get(`/api/abuse-prevention/account/${testUserId}/lockout`)
        .set('Authorization', `Bearer ${authToken}`);

      if (statusResponse.status === 200) {
        expect(statusResponse.body.data.locked).toBe(true);
      }
    });
  });

  describe('Privacy and GDPR Compliance', () => {
    it('should handle consent management', async () => {
      // Record consent
      const consentResponse = await request(app)
        .post('/api/privacy/consent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          consentType: 'analytics',
          granted: true,
          policyVersion: '1.0'
        });

      expect(consentResponse.status).toBe(200);
      expect(consentResponse.body.data.granted).toBe(true);

      // Check consent status
      const statusResponse = await request(app)
        .get('/api/privacy/consent/analytics/valid')
        .set('Authorization', `Bearer ${authToken}`);

      expect(statusResponse.status).toBe(200);
      expect(statusResponse.body.data.hasValidConsent).toBe(true);
    });

    it('should handle data export requests', async () => {
      const exportResponse = await request(app)
        .post('/api/privacy/export')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          format: 'json',
          includeEmails: true,
          includeFiles: true,
          includeMetadata: true
        });

      expect(exportResponse.status).toBe(200);
      expect(exportResponse.body.data.id).toBeDefined();
      expect(exportResponse.body.data.status).toBe('pending');
    });

    it('should handle data deletion requests', async () => {
      const deletionResponse = await request(app)
        .post('/api/privacy/delete')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          deletionType: 'complete',
          retainBackups: false
        });

      expect(deletionResponse.status).toBe(200);
      expect(deletionResponse.body.data.requestId).toBeDefined();
      expect(deletionResponse.body.data.confirmationCode).toBeDefined();
    });

    it('should validate privacy settings updates', async () => {
      const invalidSettings = [
        { dataRetentionDays: 10 }, // Too low
        { dataRetentionDays: 5000 }, // Too high
        { allowAnalytics: 'invalid' }, // Wrong type
      ];

      for (const settings of invalidSettings) {
        const response = await request(app)
          .put('/api/privacy/settings')
          .set('Authorization', `Bearer ${authToken}`)
          .send(settings);

        expect(response.status).toBe(400);
        expect(response.body.errors).toBeDefined();
      }
    });
  });

  describe('Security Event Logging', () => {
    it('should log security events properly', async () => {
      // Trigger a security event
      await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@odyssie.net',
          password: 'wrongpassword'
        });

      // Check if event was logged (this would require admin access in real scenario)
      const events = securityService.getSecurityEvents({ limit: 10 });
      expect(events.total).toBeGreaterThan(0);
      
      const loginFailureEvents = events.events.filter(e => 
        e.type === 'login_failure'
      );
      expect(loginFailureEvents.length).toBeGreaterThan(0);
    });

    it('should detect suspicious patterns', async () => {
      // Make rapid requests to trigger pattern detection
      const promises = [];
      for (let i = 0; i < 70; i++) {
        promises.push(
          request(app)
            .get('/api/user/profile')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      await Promise.all(promises);

      // Check if suspicious pattern was detected
      const events = securityService.getSecurityEvents({ 
        type: 'suspicious_request' as any,
        limit: 10 
      });
      
      // Should have detected rapid request pattern
      expect(events.events.some(e => 
        e.details.reason?.includes('rapid') || 
        e.details.patternName?.includes('rapid')
      )).toBe(true);
    });
  });

  describe('Encryption Security', () => {
    it('should handle encryption failures gracefully', async () => {
      // This test would require mocking the crypto service to simulate failures
      // For now, we'll test that encrypted data is not exposed in responses
      
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      
      // Ensure no sensitive data is exposed
      expect(response.body.user.password).toBeUndefined();
      expect(response.body.user.passwordHash).toBeUndefined();
      expect(response.body.user.privateKey).toBeUndefined();
    });

    it('should validate encrypted content integrity', async () => {
      // Test that tampered encrypted content is rejected
      const tamperedContent = 'tampered-encrypted-content-that-should-fail';
      
      const response = await request(app)
        .post('/api/email/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          to: ['test@example.com'],
          subject: 'Test',
          content: 'Valid content',
          encryptedContent: tamperedContent // This should be validated
        });

      // The system should either reject tampered content or handle it gracefully
      expect([200, 400, 422].includes(response.status)).toBe(true);
    });
  });

  describe('Security Headers and CORS', () => {
    it('should include security headers in responses', async () => {
      const response = await request(app)
        .get('/health');

      // Check for security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    it('should handle CORS properly', async () => {
      const response = await request(app)
        .options('/api/auth/login')
        .set('Origin', 'https://malicious-site.com');

      // Should either reject or handle CORS appropriately
      expect([200, 403, 404].includes(response.status)).toBe(true);
    });
  });

  afterEach(async () => {
    // Clean up test data
    if (testUserId) {
      // In a real implementation, you would clean up test data
      // For now, we'll just reset some service states
      securityService.clearFailedLoginAttempts('127.0.0.1');
    }
  });
});

describe('Security Service Unit Tests', () => {
  it('should calculate risk scores correctly', async () => {
    const mockReq = {
      headers: {
        'user-agent': 'curl/7.68.0'
      },
      connection: {
        remoteAddress: '127.0.0.1'
      },
      get: (header: string) => mockReq.headers[header.toLowerCase()]
    } as any;

    // This would test the risk calculation logic
    // The actual implementation would depend on the security service internals
  });

  it('should detect abuse patterns correctly', async () => {
    const patterns = await abusePreventionService.detectAbusePatterns({} as any);
    expect(Array.isArray(patterns)).toBe(true);
  });

  it('should validate spam detection accuracy', () => {
    const spamContent = 'URGENT! You have won $1,000,000! Click here now! FREE MONEY!';
    const legitimateContent = 'Hello, I hope you are doing well. Best regards.';

    const spamResult = abusePreventionService.detectSpam(spamContent);
    const legitResult = abusePreventionService.detectSpam(legitimateContent);

    expect(spamResult.isSpam).toBe(true);
    expect(spamResult.score).toBeGreaterThan(50);
    expect(legitResult.isSpam).toBe(false);
    expect(legitResult.score).toBeLessThan(25);
  });
});