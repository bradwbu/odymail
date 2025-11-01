import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from '../routes/auth.js';
import userRoutes from '../routes/user.js';
import { User } from '../models/User.js';

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

describe('Authentication API', () => {
  let app: express.Application;
  
  beforeEach(() => {
    app = createTestApp();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        password: 'TestPassword123!',
        publicKey: 'test-public-key',
        encryptedPrivateKey: 'test-encrypted-private-key'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('testuser@odyssie.net');
      expect(response.body.data.user.storageQuota).toBe(5 * 1024 * 1024 * 1024); // 5GB
      expect(response.body.data.user.subscriptionPlan).toBe('free');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      // Verify user was created in database
      const user = await User.findOne({ email: 'testuser@odyssie.net' });
      expect(user).toBeTruthy();
      expect(user?.publicKey).toBe('test-public-key');
    });

    it('should reject registration with invalid username', async () => {
      const userData = {
        username: 'ab', // Too short
        password: 'TestPassword123!',
        publicKey: 'test-public-key',
        encryptedPrivateKey: 'test-encrypted-private-key'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject registration with weak password', async () => {
      const userData = {
        username: 'testuser',
        password: 'weak', // Too weak
        publicKey: 'test-public-key',
        encryptedPrivateKey: 'test-encrypted-private-key'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject duplicate username registration', async () => {
      const userData = {
        username: 'testuser',
        password: 'TestPassword123!',
        publicKey: 'test-public-key',
        encryptedPrivateKey: 'test-encrypted-private-key'
      };

      // First registration should succeed
      await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      // Second registration should fail
      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body.error.code).toBe('USER_EXISTS');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      const userData = {
        username: 'testuser',
        password: 'TestPassword123!',
        publicKey: 'test-public-key',
        encryptedPrivateKey: 'test-encrypted-private-key'
      };

      await request(app)
        .post('/api/auth/register')
        .send(userData);
    });

    it('should login successfully with valid credentials', async () => {
      const loginData = {
        email: 'testuser@odyssie.net',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.user.email).toBe('testuser@odyssie.net');
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();

      // Verify lastLoginAt was updated
      const user = await User.findOne({ email: 'testuser@odyssie.net' });
      expect(user?.lastLoginAt).toBeDefined();
    });

    it('should reject login with invalid email', async () => {
      const loginData = {
        email: 'nonexistent@odyssie.net',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with invalid password', async () => {
      const loginData = {
        email: 'testuser@odyssie.net',
        password: 'WrongPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('should reject login with invalid email format', async () => {
      const loginData = {
        email: 'invalid-email',
        password: 'TestPassword123!'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Register and login to get refresh token
      const userData = {
        username: 'testuser',
        password: 'TestPassword123!',
        publicKey: 'test-public-key',
        encryptedPrivateKey: 'test-encrypted-private-key'
      };

      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send(userData);

      refreshToken = registerResponse.body.data.refreshToken;
    });

    it('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.refreshToken).toBeDefined();
      expect(response.body.data.token).not.toBe(refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);

      expect(response.body.error.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('MISSING_REFRESH_TOKEN');
    });
  });

  describe('POST /api/auth/change-password', () => {
    let authToken: string;

    beforeEach(async () => {
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

    it('should change password successfully', async () => {
      const changePasswordData = {
        currentPassword: 'TestPassword123!',
        newPassword: 'NewTestPassword123!',
        newEncryptedPrivateKey: 'new-encrypted-private-key'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(changePasswordData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify old password no longer works
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@odyssie.net',
          password: 'TestPassword123!'
        })
        .expect(401);

      // Verify new password works
      const newLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@odyssie.net',
          password: 'NewTestPassword123!'
        })
        .expect(200);

      expect(newLoginResponse.body.success).toBe(true);
    });

    it('should reject change password with wrong current password', async () => {
      const changePasswordData = {
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewTestPassword123!',
        newEncryptedPrivateKey: 'new-encrypted-private-key'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${authToken}`)
        .send(changePasswordData)
        .expect(400);

      expect(response.body.error.code).toBe('INVALID_PASSWORD');
    });

    it('should reject change password without authentication', async () => {
      const changePasswordData = {
        currentPassword: 'TestPassword123!',
        newPassword: 'NewTestPassword123!',
        newEncryptedPrivateKey: 'new-encrypted-private-key'
      };

      const response = await request(app)
        .post('/api/auth/change-password')
        .send(changePasswordData)
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken: string;

    beforeEach(async () => {
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

    it('should get user profile successfully', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe('testuser@odyssie.net');
      expect(response.body.data.storageQuota).toBe(5 * 1024 * 1024 * 1024);
      expect(response.body.data.preferences).toBeDefined();
    });

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });
  });
});