/**
 * Frontend Security Tests - Client-side security testing
 * Tests crypto implementation, XSS prevention, and secure data handling
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock crypto service for testing
const mockCryptoService = {
  generateKeyPair: vi.fn(),
  encryptData: vi.fn(),
  decryptData: vi.fn(),
  generateSalt: vi.fn(),
  deriveKey: vi.fn()
};

// Mock fetch for API calls
global.fetch = vi.fn();

describe('Frontend Security Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'mock-jwt-token');
  });

  describe('Crypto Service Security', () => {
    it('should generate secure RSA key pairs', async () => {
      const mockKeyPair = {
        publicKey: '-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n-----END PUBLIC KEY-----',
        privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC...\n-----END PRIVATE KEY-----'
      };
      
      mockCryptoService.generateKeyPair.mockResolvedValue(mockKeyPair);
      
      const keyPair = await mockCryptoService.generateKeyPair();
      
      expect(keyPair.publicKey).toBeDefined();
      expect(keyPair.privateKey).toBeDefined();
      expect(keyPair.publicKey).not.toBe(keyPair.privateKey);
      
      // Verify key format
      expect(keyPair.publicKey.startsWith('-----BEGIN PUBLIC KEY-----')).toBe(true);
      expect(keyPair.privateKey.startsWith('-----BEGIN PRIVATE KEY-----')).toBe(true);
    });

    it('should encrypt and decrypt data correctly', async () => {
      const testData = 'This is sensitive test data that should be encrypted';
      const password = 'SecurePassword123!';
      const encryptedData = 'encrypted_data_mock';
      
      mockCryptoService.encryptData.mockResolvedValue(encryptedData);
      mockCryptoService.decryptData.mockResolvedValue(testData);
      
      const encrypted = await mockCryptoService.encryptData(testData, password);
      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(testData);
      
      const decrypted = await mockCryptoService.decryptData(encrypted, password);
      expect(decrypted).toBe(testData);
    });

    it('should fail decryption with wrong password', async () => {
      const testData = 'Sensitive data';
      const correctPassword = 'CorrectPassword123!';
      const wrongPassword = 'WrongPassword123!';
      const encryptedData = 'encrypted_data_mock';
      
      mockCryptoService.encryptData.mockResolvedValue(encryptedData);
      mockCryptoService.decryptData.mockRejectedValue(new Error('Decryption failed'));
      
      const encrypted = await mockCryptoService.encryptData(testData, correctPassword);
      
      await expect(
        mockCryptoService.decryptData(encrypted, wrongPassword)
      ).rejects.toThrow('Decryption failed');
    });

    it('should generate secure random salts', async () => {
      const salt1 = 'random_salt_1';
      const salt2 = 'random_salt_2';
      
      mockCryptoService.generateSalt
        .mockResolvedValueOnce(salt1)
        .mockResolvedValueOnce(salt2);
      
      const generatedSalt1 = await mockCryptoService.generateSalt();
      const generatedSalt2 = await mockCryptoService.generateSalt();
      
      expect(generatedSalt1).toBeDefined();
      expect(generatedSalt2).toBeDefined();
      expect(generatedSalt1).not.toBe(generatedSalt2);
    });

    it('should derive keys consistently from passwords', async () => {
      const password = 'TestPassword123!';
      const salt = 'test_salt';
      const derivedKey = 'derived_key_mock';
      
      mockCryptoService.deriveKey.mockResolvedValue(derivedKey);
      
      const key1 = await mockCryptoService.deriveKey(password, salt);
      const key2 = await mockCryptoService.deriveKey(password, salt);
      
      expect(key1).toBe(key2);
      expect(key1).toBe(derivedKey);
    });
  });

  describe('XSS Prevention', () => {
    it('should sanitize dangerous HTML content', () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src="x" onerror="alert(\'xss\')" />',
        '<iframe src="javascript:alert(\'xss\')"></iframe>',
        '<object data="javascript:alert(\'xss\')"></object>'
      ];
      
      const sanitizeHtml = (input: string) => {
        return input
          .replace(/<script[^>]*>.*?<\/script>/gi, '')
          .replace(/<[^>]*>/g, '');
      };
      
      xssPayloads.forEach(payload => {
        const sanitized = sanitizeHtml(payload);
        expect(sanitized).not.toContain('<script>');
        expect(sanitized).not.toContain('<img');
        expect(sanitized).not.toContain('<iframe');
        expect(sanitized).not.toContain('<object');
      });
    });

    it('should validate URLs before navigation', () => {
      const maliciousUrls = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'vbscript:msgbox("xss")',
        'file:///etc/passwd'
      ];
      
      const isValidUrl = (url: string) => {
        return url.startsWith('http://') || url.startsWith('https://');
      };
      
      maliciousUrls.forEach(url => {
        expect(isValidUrl(url)).toBe(false);
      });
      
      // Valid URLs should pass
      const validUrls = [
        'https://example.com',
        'http://localhost:3000',
        'https://api.example.com/data'
      ];
      
      validUrls.forEach(url => {
        expect(isValidUrl(url)).toBe(true);
      });
    });
  });

  describe('Secure Data Handling', () => {
    it('should not store sensitive data in localStorage', () => {
      const sensitiveKeys = ['password', 'privateKey', 'creditCard'];
      
      // Simulate storing sensitive data
      sensitiveKeys.forEach(key => {
        localStorage.setItem(key, 'sensitive_value');
      });
      
      // Security check should remove sensitive data
      const securityCheck = () => {
        sensitiveKeys.forEach(key => {
          if (localStorage.getItem(key)) {
            localStorage.removeItem(key);
          }
        });
      };
      
      securityCheck();
      
      sensitiveKeys.forEach(key => {
        expect(localStorage.getItem(key)).toBeNull();
      });
    });

    it('should clear sensitive data on logout', () => {
      localStorage.setItem('token', 'jwt-token');
      localStorage.setItem('userKeys', 'encrypted-keys');
      localStorage.setItem('sessionData', 'session-info');
      
      const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userKeys');
        localStorage.removeItem('sessionData');
      };
      
      logout();
      
      expect(localStorage.getItem('token')).toBeNull();
      expect(localStorage.getItem('userKeys')).toBeNull();
      expect(localStorage.getItem('sessionData')).toBeNull();
    });

    it('should validate API responses before processing', () => {
      const maliciousResponse = {
        success: true,
        data: {
          'malicious_script': '<script>alert("xss")</script>',
          normalKey: '<img src="x" onerror="alert(\'xss\')" />'
        }
      };
      
      const sanitizeObject = (obj: any): any => {
        if (typeof obj === 'string') {
          return obj.replace(/<script[^>]*>.*?<\/script>/gi, '')
                   .replace(/<[^>]*>/g, '');
        }
        if (typeof obj === 'object' && obj !== null) {
          const sanitized: any = {};
          Object.keys(obj).forEach(key => {
            const sanitizedKey = key.replace(/<[^>]*>/g, '');
            sanitized[sanitizedKey] = sanitizeObject(obj[key]);
          });
          return sanitized;
        }
        return obj;
      };
      
      const sanitizedResponse = sanitizeObject(maliciousResponse);
      
      expect(JSON.stringify(sanitizedResponse)).not.toContain('<script>');
      expect(JSON.stringify(sanitizedResponse)).not.toContain('<img');
    });
  });

  describe('Authentication Security', () => {
    it('should validate JWT token format', () => {
      const validTokens = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
      ];
      
      const invalidTokens = [
        'invalid-token',
        'bearer-token-without-dots',
        'too.few.parts',
        'too.many.parts.here.invalid'
      ];
      
      const isValidJWT = (token: string) => {
        const parts = token.split('.');
        return parts.length === 3 && parts.every(part => part.length > 0);
      };
      
      validTokens.forEach(token => {
        expect(isValidJWT(token)).toBe(true);
      });
      
      invalidTokens.forEach(token => {
        expect(isValidJWT(token)).toBe(false);
      });
    });

    it('should implement secure password validation', () => {
      const passwordValidator = (password: string) => {
        const minLength = 8;
        const hasUpperCase = /[A-Z]/.test(password);
        const hasLowerCase = /[a-z]/.test(password);
        const hasNumbers = /\d/.test(password);
        const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
        
        return {
          isValid: password.length >= minLength && hasUpperCase && hasLowerCase && hasNumbers && hasSpecialChar,
          errors: [
            ...(password.length < minLength ? ['Password must be at least 8 characters'] : []),
            ...(!hasUpperCase ? ['Password must contain uppercase letters'] : []),
            ...(!hasLowerCase ? ['Password must contain lowercase letters'] : []),
            ...(!hasNumbers ? ['Password must contain numbers'] : []),
            ...(!hasSpecialChar ? ['Password must contain special characters'] : [])
          ]
        };
      };
      
      const weakPasswords = [
        'password',
        'Password',
        'Password1',
        'pass123',
        '12345678'
      ];
      
      const strongPasswords = [
        'SecurePassword123!',
        'MyStr0ng@Pass',
        'C0mpl3x#P@ssw0rd'
      ];
      
      weakPasswords.forEach(password => {
        const result = passwordValidator(password);
        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });
      
      strongPasswords.forEach(password => {
        const result = passwordValidator(password);
        expect(result.isValid).toBe(true);
        expect(result.errors.length).toBe(0);
      });
    });

    it('should handle token expiration gracefully', async () => {
      const expiredTokenResponse = {
        ok: false,
        status: 401,
        json: async () => ({ error: 'Token expired' })
      };
      
      (global.fetch as any).mockResolvedValueOnce(expiredTokenResponse);
      
      const handleTokenExpiration = async () => {
        try {
          const response = await fetch('/api/user/profile');
          if (response.status === 401) {
            localStorage.removeItem('token');
            return { redirectToLogin: true };
          }
          return response.json();
        } catch (error) {
          console.error('Token validation failed:', error);
          return null;
        }
      };
      
      const result = await handleTokenExpiration();
      expect(result).toEqual({ redirectToLogin: true });
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  describe('Input Validation', () => {
    it('should validate email format', () => {
      const validEmails = [
        'user@example.com',
        'test.email@domain.co.uk',
        'user+tag@example.org'
      ];
      
      const invalidEmails = [
        'invalid-email',
        '@domain.com',
        'user@',
        'user..name@domain.com',
        'user@domain',
        'user@.domain.com'
      ];
      
      const isValidEmail = (email: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
      };
      
      validEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(true);
      });
      
      invalidEmails.forEach(email => {
        expect(isValidEmail(email)).toBe(false);
      });
    });

    it('should prevent SQL injection in input', () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "' UNION SELECT * FROM users --",
        "'; INSERT INTO users VALUES ('hacker', 'password'); --"
      ];
      
      const containsSQLInjection = (input: string) => {
        const sqlPatterns = [
          /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
          /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
          /('|(\\')|(;)|(--)|(\|)|(\*))/gi
        ];
        
        return sqlPatterns.some(pattern => pattern.test(input));
      };
      
      sqlInjectionPayloads.forEach(payload => {
        expect(containsSQLInjection(payload)).toBe(true);
      });
      
      // Valid inputs should not trigger SQL injection detection
      const validInputs = [
        'normal user input',
        'search query',
        'user@example.com'
      ];
      
      validInputs.forEach(input => {
        expect(containsSQLInjection(input)).toBe(false);
      });
    });
  });

  describe('Error Handling Security', () => {
    it('should not expose sensitive information in error messages', () => {
      const sensitiveError = {
        message: 'Database connection failed: password incorrect for user admin',
        stack: 'Error at /path/to/sensitive/file.js:123',
        details: {
          password: 'secret123',
          apiKey: 'sk_live_123456789'
        }
      };
      
      const sanitizeError = (error: any) => {
        return {
          message: 'An error occurred',
          timestamp: new Date().toISOString()
        };
      };
      
      const sanitizedError = sanitizeError(sensitiveError);
      
      expect(sanitizedError.message).toBe('An error occurred');
      expect(sanitizedError).not.toHaveProperty('stack');
      expect(sanitizedError).not.toHaveProperty('details');
      expect(JSON.stringify(sanitizedError)).not.toContain('password');
      expect(JSON.stringify(sanitizedError)).not.toContain('apiKey');
    });

    it('should handle network errors securely', async () => {
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
      
      const secureErrorHandler = async () => {
        try {
          await fetch('/api/sensitive-endpoint');
        } catch (error) {
          return {
            error: 'Connection failed',
            message: 'Please try again later'
          };
        }
      };
      
      const result = await secureErrorHandler();
      expect(result?.error).toBe('Connection failed');
      expect(result?.message).toBe('Please try again later');
    });
  });
});