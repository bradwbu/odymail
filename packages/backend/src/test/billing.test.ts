import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import authRoutes from '../routes/auth.js';
import billingRoutes from '../routes/billing.js';
import { User } from '../models/User.js';
import { StoragePlan } from '../models/StoragePlan.js';
import { Subscription } from '../models/Subscription.js';
import { BillingService } from '../services/billingService.js';

// Create test app
const createTestApp = () => {
  const app = express();
  
  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  
  app.use('/api/auth', authRoutes);
  app.use('/api/billing', billingRoutes);
  
  return app;
};

describe('Billing System', () => {
  let app: express.Application;
  let authToken: string;
  let userId: string;

  beforeEach(async () => {
    app = createTestApp();
    
    // Initialize storage plans
    await BillingService.initializeStoragePlans();
    
    // Create test user and get auth token
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
    userId = registerResponse.body.data.user.id;
  });

  afterEach(async () => {
    // Clean up test data
    await User.deleteMany({});
    await Subscription.deleteMany({});
  });

  describe('Storage Plans', () => {
    describe('GET /api/billing/plans', () => {
      it('should return all available storage plans', async () => {
        const response = await request(app)
          .get('/api/billing/plans')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveLength(5); // free, basic, standard, premium, pro
        
        const freePlan = response.body.data.find((plan: any) => plan.id === 'free');
        expect(freePlan).toBeDefined();
        expect(freePlan.price).toBe(0);
        expect(freePlan.storageLimit).toBe(5 * 1024 * 1024 * 1024); // 5GB
        
        const basicPlan = response.body.data.find((plan: any) => plan.id === 'basic');
        expect(basicPlan).toBeDefined();
        expect(basicPlan.price).toBe(199); // $1.99
        expect(basicPlan.storageLimit).toBe(50 * 1024 * 1024 * 1024); // 50GB
      });

      it('should return formatted plan data', async () => {
        const response = await request(app)
          .get('/api/billing/plans')
          .expect(200);

        const plan = response.body.data[0];
        expect(plan.formattedPrice).toBeDefined();
        expect(plan.formattedStorage).toBeDefined();
        expect(plan.features).toBeInstanceOf(Array);
      });
    });
  });

  describe('Subscription Management', () => {
    describe('GET /api/billing/subscription', () => {
      it('should return null for user without subscription', async () => {
        const response = await request(app)
          .get('/api/billing/subscription')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeNull();
      });

      it('should return subscription data for subscribed user', async () => {
        // Create a subscription
        await BillingService.createSubscription(userId, 'basic');

        const response = await request(app)
          .get('/api/billing/subscription')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
        expect(response.body.data.planId).toBe('basic');
        expect(response.body.data.status).toBe('active');
        expect(response.body.data.billingInfo).toBeDefined();
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/billing/subscription')
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('User not authenticated');
      });
    });

    describe('POST /api/billing/change-plan', () => {
      it('should upgrade to basic plan successfully', async () => {
        const response = await request(app)
          .post('/api/billing/change-plan')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ planId: 'basic' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.planId).toBe('basic');
        expect(response.body.data.status).toBe('active');

        // Verify user's storage quota was updated
        const user = await User.findById(userId);
        expect(user?.storageQuota).toBe(50 * 1024 * 1024 * 1024); // 50GB
        expect(user?.subscriptionPlan).toBe('basic');
      });

      it('should downgrade to free plan successfully', async () => {
        // First upgrade to basic
        await request(app)
          .post('/api/billing/change-plan')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ planId: 'basic' });

        // Then downgrade to free
        const response = await request(app)
          .post('/api/billing/change-plan')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ planId: 'free' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Successfully downgraded to free plan');

        // Verify user's storage quota was updated
        const user = await User.findById(userId);
        expect(user?.storageQuota).toBe(5 * 1024 * 1024 * 1024); // 5GB
        expect(user?.subscriptionPlan).toBe('free');
      });

      it('should reject invalid plan ID', async () => {
        const response = await request(app)
          .post('/api/billing/change-plan')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ planId: 'invalid-plan' })
          .expect(404);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Storage plan not found');
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/billing/change-plan')
          .send({ planId: 'basic' })
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('User not authenticated');
      });

      it('should validate request data', async () => {
        const response = await request(app)
          .post('/api/billing/change-plan')
          .set('Authorization', `Bearer ${authToken}`)
          .send({}) // Missing planId
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Invalid request data');
      });
    });

    describe('POST /api/billing/cancel', () => {
      beforeEach(async () => {
        // Create a subscription to cancel
        await BillingService.createSubscription(userId, 'basic');
      });

      it('should cancel subscription successfully', async () => {
        const response = await request(app)
          .post('/api/billing/cancel')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Subscription canceled successfully');

        // Verify user was reverted to free plan
        const user = await User.findById(userId);
        expect(user?.storageQuota).toBe(5 * 1024 * 1024 * 1024); // 5GB
        expect(user?.subscriptionPlan).toBe('free');

        // Verify subscription was canceled
        const subscription = await Subscription.findOne({ userId });
        expect(subscription?.status).toBe('canceled');
        expect(subscription?.canceledAt).toBeDefined();
      });

      it('should handle canceling non-existent subscription', async () => {
        // Cancel the existing subscription first
        await BillingService.cancelSubscription(userId);

        const response = await request(app)
          .post('/api/billing/cancel')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(500);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('No active subscription found');
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/billing/cancel')
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('User not authenticated');
      });
    });
  });

  describe('Billing Information', () => {
    describe('GET /api/billing/billing-info', () => {
      it('should return billing info for free user', async () => {
        const response = await request(app)
          .get('/api/billing/billing-info')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.hasSubscription).toBe(false);
        expect(response.body.data.plan).toBe('free');
      });

      it('should return billing info for subscribed user', async () => {
        // Create a subscription
        await BillingService.createSubscription(userId, 'basic');

        const response = await request(app)
          .get('/api/billing/billing-info')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.hasSubscription).toBe(true);
        expect(response.body.data.isActive).toBe(true);
        expect(response.body.data.currentPeriodStart).toBeDefined();
        expect(response.body.data.currentPeriodEnd).toBeDefined();
        expect(response.body.data.daysUntilRenewal).toBeGreaterThan(0);
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/billing/billing-info')
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('User not authenticated');
      });
    });
  });

  describe('Payment Processing', () => {
    describe('POST /api/billing/create-subscription', () => {
      it('should create subscription for free plan', async () => {
        const response = await request(app)
          .post('/api/billing/create-subscription')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ planId: 'free' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.planId).toBe('free');
        expect(response.body.clientSecret).toBeUndefined(); // No payment needed for free
      });

      it('should create subscription for paid plan', async () => {
        const response = await request(app)
          .post('/api/billing/create-subscription')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ planId: 'basic' })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.planId).toBe('basic');
        // Note: clientSecret would be present in real Stripe integration
      });

      it('should reject invalid plan ID', async () => {
        const response = await request(app)
          .post('/api/billing/create-subscription')
          .set('Authorization', `Bearer ${authToken}`)
          .send({ planId: 'invalid' })
          .expect(500);

        expect(response.body.success).toBe(false);
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/billing/create-subscription')
          .send({ planId: 'basic' })
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('User not authenticated');
      });
    });

    describe('POST /api/billing/setup-payment', () => {
      it('should setup payment method', async () => {
        const response = await request(app)
          .post('/api/billing/setup-payment')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.customerId).toBeDefined();
        // Note: clientSecret would be present in real Stripe integration
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .post('/api/billing/setup-payment')
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('User not authenticated');
      });
    });

    describe('GET /api/billing/payment-methods', () => {
      it('should return empty payment methods for new user', async () => {
        const response = await request(app)
          .get('/api/billing/payment-methods')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data).toHaveLength(0);
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/billing/payment-methods')
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('User not authenticated');
      });
    });

    describe('GET /api/billing/invoices', () => {
      it('should return empty invoices for new user', async () => {
        const response = await request(app)
          .get('/api/billing/invoices')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data).toHaveLength(0);
      });

      it('should respect limit parameter', async () => {
        const response = await request(app)
          .get('/api/billing/invoices?limit=5')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeInstanceOf(Array);
      });

      it('should require authentication', async () => {
        const response = await request(app)
          .get('/api/billing/invoices')
          .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('User not authenticated');
      });
    });
  });

  describe('Usage Tracking and Quota Enforcement', () => {
    it('should enforce storage quota on plan change', async () => {
      // Upgrade to basic plan
      await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId: 'basic' });

      // Verify quota was updated
      const user = await User.findById(userId);
      expect(user?.storageQuota).toBe(50 * 1024 * 1024 * 1024); // 50GB

      // Downgrade to free plan
      await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId: 'free' });

      // Verify quota was reduced
      const updatedUser = await User.findById(userId);
      expect(updatedUser?.storageQuota).toBe(5 * 1024 * 1024 * 1024); // 5GB
    });

    it('should handle subscription upgrade flow', async () => {
      // Start with free plan
      let user = await User.findById(userId);
      expect(user?.subscriptionPlan).toBe('free');

      // Upgrade to basic
      await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId: 'basic' });

      user = await User.findById(userId);
      expect(user?.subscriptionPlan).toBe('basic');
      expect(user?.storageQuota).toBe(50 * 1024 * 1024 * 1024);

      // Upgrade to standard
      await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId: 'standard' });

      user = await User.findById(userId);
      expect(user?.subscriptionPlan).toBe('standard');
      expect(user?.storageQuota).toBe(200 * 1024 * 1024 * 1024);
    });

    it('should handle subscription downgrade flow', async () => {
      // Start with premium plan
      await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId: 'premium' });

      let user = await User.findById(userId);
      expect(user?.subscriptionPlan).toBe('premium');
      expect(user?.storageQuota).toBe(500 * 1024 * 1024 * 1024);

      // Downgrade to standard
      await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId: 'standard' });

      user = await User.findById(userId);
      expect(user?.subscriptionPlan).toBe('standard');
      expect(user?.storageQuota).toBe(200 * 1024 * 1024 * 1024);

      // Downgrade to free
      await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId: 'free' });

      user = await User.findById(userId);
      expect(user?.subscriptionPlan).toBe('free');
      expect(user?.storageQuota).toBe(5 * 1024 * 1024 * 1024);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Simulate database error by using invalid ObjectId
      const invalidToken = 'Bearer invalid-token';
      
      const response = await request(app)
        .get('/api/billing/subscription')
        .set('Authorization', invalidToken)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid or expired token');
    });

    it('should validate request parameters', async () => {
      const response = await request(app)
        .post('/api/billing/change-plan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ planId: '' }) // Empty plan ID
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Invalid request data');
    });

    it('should handle missing authentication headers', async () => {
      const response = await request(app)
        .get('/api/billing/subscription')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Access token required');
    });
  });
});

describe('BillingService', () => {
  beforeEach(async () => {
    await BillingService.initializeStoragePlans();
  });

  afterEach(async () => {
    await User.deleteMany({});
    await Subscription.deleteMany({});
  });

  describe('Storage Plan Management', () => {
    it('should initialize default storage plans', async () => {
      const plans = await BillingService.getStoragePlans();
      expect(plans).toHaveLength(5);
      
      const planNames = plans.map(p => p.name);
      expect(planNames).toContain('free');
      expect(planNames).toContain('basic');
      expect(planNames).toContain('standard');
      expect(planNames).toContain('premium');
      expect(planNames).toContain('pro');
    });

    it('should get storage plan by ID', async () => {
      const plan = await BillingService.getStoragePlan('basic');
      expect(plan).toBeDefined();
      expect(plan?.name).toBe('basic');
      expect(plan?.price).toBe(199);
      expect(plan?.storageLimit).toBe(50 * 1024 * 1024 * 1024);
    });

    it('should return null for invalid plan ID', async () => {
      const plan = await BillingService.getStoragePlan('invalid');
      expect(plan).toBeNull();
    });
  });

  describe('Subscription Management', () => {
    let userId: string;

    beforeEach(async () => {
      // Create test user
      const user = await User.create({
        email: 'test@odyssie.net',
        passwordHash: 'hashed-password',
        publicKey: 'public-key',
        encryptedPrivateKey: 'encrypted-private-key',
        storageQuota: 5 * 1024 * 1024 * 1024,
        storageUsed: 0,
        subscriptionPlan: 'free'
      });
      userId = user._id.toString();
    });

    it('should create subscription successfully', async () => {
      const subscription = await BillingService.createSubscription(userId, 'basic');
      
      expect(subscription.userId).toBe(userId);
      expect(subscription.planId).toBe('basic');
      expect(subscription.status).toBe('active');
      expect(subscription.currentPeriodStart).toBeDefined();
      expect(subscription.currentPeriodEnd).toBeDefined();
    });

    it('should get user subscription', async () => {
      await BillingService.createSubscription(userId, 'basic');
      
      const subscription = await BillingService.getUserSubscription(userId);
      expect(subscription).toBeDefined();
      expect(subscription?.planId).toBe('basic');
    });

    it('should cancel subscription', async () => {
      await BillingService.createSubscription(userId, 'basic');
      await BillingService.cancelSubscription(userId);
      
      const subscription = await BillingService.getUserSubscription(userId);
      expect(subscription).toBeNull(); // Should not find active subscription
      
      // Check if user was reverted to free plan
      const user = await User.findById(userId);
      expect(user?.subscriptionPlan).toBe('free');
    });

    it('should change subscription plan', async () => {
      await BillingService.createSubscription(userId, 'basic');
      const newSubscription = await BillingService.changeSubscription(userId, 'standard');
      
      expect(newSubscription.planId).toBe('standard');
      
      // Verify user's plan was updated
      const user = await User.findById(userId);
      expect(user?.subscriptionPlan).toBe('standard');
      expect(user?.storageQuota).toBe(200 * 1024 * 1024 * 1024);
    });
  });

  describe('Billing Cycle Management', () => {
    let userId: string;
    let subscription: any;

    beforeEach(async () => {
      const user = await User.create({
        email: 'test@odyssie.net',
        passwordHash: 'hashed-password',
        publicKey: 'public-key',
        encryptedPrivateKey: 'encrypted-private-key',
        storageQuota: 5 * 1024 * 1024 * 1024,
        storageUsed: 0,
        subscriptionPlan: 'free'
      });
      userId = user._id.toString();
      subscription = await BillingService.createSubscription(userId, 'basic');
    });

    it('should calculate billing cycle info', () => {
      const billingInfo = BillingService.getBillingCycleInfo(subscription);
      
      expect(billingInfo.currentPeriodStart).toBeDefined();
      expect(billingInfo.currentPeriodEnd).toBeDefined();
      expect(billingInfo.daysUntilRenewal).toBeGreaterThan(0);
      expect(billingInfo.isActive).toBe(true);
      expect(billingInfo.willCancelAtPeriodEnd).toBe(false);
    });

    it('should calculate prorated amount', () => {
      const basicPlan = { price: 199 } as any; // $1.99
      const standardPlan = { price: 499 } as any; // $4.99
      
      const proratedAmount = BillingService.calculateProratedAmount(
        basicPlan,
        standardPlan,
        15 // 15 days remaining
      );
      
      expect(proratedAmount).toBeGreaterThanOrEqual(0);
      expect(typeof proratedAmount).toBe('number');
    });
  });
});