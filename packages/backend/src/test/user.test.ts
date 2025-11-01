import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from '../routes/auth.js';
import userRoutes from '../routes/user.js';

// Create test app
const createTestApp = () => {
  const app = express();
  
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  app.use('/api/auth', authRoutes);
  app.use('/api/user', userRoutes);
  
  return app;
};

describe('User Profile API', () => {
  let app: express.Application;
  let authToken: string;

  beforeEach(async () => {
    app = createTestApp();

    // Register and login to get auth token
    const userData = {
      username: 'testuser',
      password: 'TestPassword123!',
      publicKey: 'test-public-key',
      encryptedPrivateKey: 'test-encrypted-private-key'
    };

    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send(userData);

    authToken = registerResponse.body.data.token;
  });

  describe('GET /api/user/profile', () => {
    it('should get user profile successfully', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('testuser@odyssie.net');
      expect(response.body.data.storageQuota).toBe(5 * 1024 * 1024 * 1024);
      expect(response.body.data.subscriptionPlan).toBe('free');
      expect(response.body.data.preferences).toBeDefined();
      expect(response.body.data.preferences.theme).toBe('auto');
      expect(response.body.data.preferences.language).toBe('en');
      expect(response.body.data.preferences.emailNotifications).toBe(true);
      expect(response.body.data.preferences.twoFactorEnabled).toBe(false);
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('PUT /api/user/profile', () => {
    it('should update user preferences successfully', async () => {
      const updateData = {
        preferences: {
          theme: 'dark',
          language: 'es',
          emailNotifications: false
        }
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.preferences.theme).toBe('dark');
      expect(response.body.data.preferences.language).toBe('es');
      expect(response.body.data.preferences.emailNotifications).toBe(false);
      expect(response.body.data.preferences.twoFactorEnabled).toBe(false); // Should remain unchanged
    });

    it('should update partial preferences', async () => {
      const updateData = {
        preferences: {
          theme: 'light'
        }
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.preferences.theme).toBe('light');
      expect(response.body.data.preferences.language).toBe('en'); // Should remain unchanged
      expect(response.body.data.preferences.emailNotifications).toBe(true); // Should remain unchanged
    });

    it('should reject invalid theme value', async () => {
      const updateData = {
        preferences: {
          theme: 'invalid-theme'
        }
      };

      const response = await request(app)
        .put('/api/user/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject request without authentication', async () => {
      const updateData = {
        preferences: {
          theme: 'dark'
        }
      };

      const response = await request(app)
        .put('/api/user/profile')
        .send(updateData)
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('GET /api/user/export', () => {
    it('should export user data successfully', async () => {
      const response = await request(app)
        .get('/api/user/export')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('testuser@odyssie.net');
      expect(response.body.data.publicKey).toBe('test-public-key');
      expect(response.body.data.storageQuota).toBe(5 * 1024 * 1024 * 1024);
      expect(response.body.data.subscriptionPlan).toBe('free');
      expect(response.body.data.exportedAt).toBeDefined();
      
      // Should not include sensitive data
      expect(response.body.data.passwordHash).toBeUndefined();
      expect(response.body.data.encryptedPrivateKey).toBeUndefined();

      // Check Content-Disposition header for file download
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('user-data-');
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/user/export')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });
});