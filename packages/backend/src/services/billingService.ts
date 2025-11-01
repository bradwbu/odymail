import { StoragePlan, IStoragePlan } from '../models/StoragePlan.js';
import { Subscription, ISubscription } from '../models/Subscription.js';
import { User, IUser } from '../models/User.js';
import { StripeService } from './stripeService.js';

export class BillingService {
  // Initialize default storage plans
  static async initializeStoragePlans(): Promise<void> {
    const defaultPlans = [
      {
        id: 'free',
        name: 'free',
        displayName: 'Free',
        storageLimit: 5 * 1024 * 1024 * 1024, // 5GB
        price: 0,
        currency: 'usd',
        billingInterval: 'month' as const,
        features: ['5GB Storage', 'Basic Email Encryption', 'Web Access'],
        isActive: true
      },
      {
        id: 'basic',
        name: 'basic',
        displayName: 'Basic',
        storageLimit: 50 * 1024 * 1024 * 1024, // 50GB
        price: 199, // $1.99 in cents
        currency: 'usd',
        billingInterval: 'month' as const,
        features: ['50GB Storage', 'Advanced Email Encryption', 'Priority Support'],
        isActive: true
      },
      {
        id: 'standard',
        name: 'standard',
        displayName: 'Standard',
        storageLimit: 200 * 1024 * 1024 * 1024, // 200GB
        price: 499, // $4.99 in cents
        currency: 'usd',
        billingInterval: 'month' as const,
        features: ['200GB Storage', 'Advanced Email Encryption', 'Priority Support', 'Mobile Apps'],
        isActive: true
      },
      {
        id: 'premium',
        name: 'premium',
        displayName: 'Premium',
        storageLimit: 500 * 1024 * 1024 * 1024, // 500GB
        price: 999, // $9.99 in cents
        currency: 'usd',
        billingInterval: 'month' as const,
        features: ['500GB Storage', 'Advanced Email Encryption', 'Priority Support', 'Mobile Apps', 'Advanced Search'],
        isActive: true
      },
      {
        id: 'pro',
        name: 'pro',
        displayName: 'Pro',
        storageLimit: 1024 * 1024 * 1024 * 1024, // 1TB
        price: 1499, // $14.99 in cents
        currency: 'usd',
        billingInterval: 'month' as const,
        features: ['1TB Storage', 'Advanced Email Encryption', 'Priority Support', 'Mobile Apps', 'Advanced Search', 'API Access'],
        isActive: true
      }
    ];

    for (const planData of defaultPlans) {
      const existingPlan = await StoragePlan.findOne({ name: planData.name });
      if (!existingPlan) {
        await StoragePlan.create(planData);
      }
    }
  }

  // Get all available storage plans
  static async getStoragePlans(): Promise<IStoragePlan[]> {
    return await StoragePlan.find({ isActive: true }).sort({ price: 1 });
  }

  // Get storage plan by ID
  static async getStoragePlan(planId: string): Promise<IStoragePlan | null> {
    return await StoragePlan.findOne({ id: planId, isActive: true });
  }

  // Get user's current subscription
  static async getUserSubscription(userId: string): Promise<ISubscription | null> {
    return await Subscription.findOne({ 
      userId, 
      status: { $in: ['active', 'past_due'] } 
    }).populate('planId');
  }

  // Create or update subscription
  static async createSubscription(
    userId: string, 
    planId: string, 
    stripeSubscriptionId?: string,
    stripeCustomerId?: string
  ): Promise<ISubscription> {
    const plan = await this.getStoragePlan(planId);
    if (!plan) {
      throw new Error('Invalid storage plan');
    }

    // Cancel existing subscription if any
    const existingSubscription = await this.getUserSubscription(userId);
    if (existingSubscription) {
      await this.cancelSubscription(userId);
    }

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1); // Monthly billing

    const subscription = await Subscription.create({
      userId,
      planId,
      stripeSubscriptionId,
      stripeCustomerId,
      status: 'active',
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      cancelAtPeriodEnd: false
    });

    // Update user's storage quota and subscription plan
    await User.findByIdAndUpdate(userId, {
      storageQuota: plan.storageLimit,
      subscriptionPlan: plan.name
    });

    return subscription;
  }

  // Create subscription with Stripe
  static async createStripeSubscription(
    userId: string,
    planId: string,
    paymentMethodId?: string
  ): Promise<{ subscription: ISubscription; clientSecret?: string }> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const plan = await this.getStoragePlan(planId);
    if (!plan) {
      throw new Error('Invalid storage plan');
    }

    // Handle free plan
    if (planId === 'free') {
      const subscription = await this.createSubscription(userId, planId);
      return { subscription };
    }

    // Create or get Stripe customer
    const customerId = await StripeService.createOrGetCustomer(userId, user.email);

    // Create or get Stripe price for the plan
    const priceId = await StripeService.createPriceForPlan(planId);

    // Create Stripe subscription
    const stripeSubscription = await StripeService.createSubscription(
      customerId,
      priceId,
      userId
    );

    // Create local subscription record
    const subscription = await this.createSubscription(
      userId,
      planId,
      stripeSubscription.id,
      customerId
    );

    // Get client secret for payment confirmation
    const latestInvoice = stripeSubscription.latest_invoice as any;
    const clientSecret = latestInvoice?.payment_intent?.client_secret;

    return { subscription, clientSecret };
  }

  // Cancel subscription
  static async cancelSubscription(userId: string): Promise<void> {
    const subscription = await this.getUserSubscription(userId);
    if (!subscription) {
      throw new Error('No active subscription found');
    }

    // Cancel in Stripe if it exists
    if (subscription.stripeSubscriptionId) {
      try {
        await StripeService.cancelSubscription(subscription.stripeSubscriptionId);
      } catch (error) {
        console.error('Error canceling Stripe subscription:', error);
      }
    }

    // Update subscription status
    await Subscription.findByIdAndUpdate(subscription._id, {
      status: 'canceled',
      canceledAt: new Date(),
      cancelAtPeriodEnd: true
    });

    // Revert user to free plan
    const freePlan = await this.getStoragePlan('free');
    if (freePlan) {
      await User.findByIdAndUpdate(userId, {
        storageQuota: freePlan.storageLimit,
        subscriptionPlan: 'free'
      });
    }
  }

  // Upgrade/downgrade subscription
  static async changeSubscription(userId: string, newPlanId: string): Promise<ISubscription> {
    const currentSubscription = await this.getUserSubscription(userId);
    const newPlan = await this.getStoragePlan(newPlanId);
    
    if (!newPlan) {
      throw new Error('Invalid storage plan');
    }

    // If user has an active paid subscription, handle the change
    if (currentSubscription && currentSubscription.stripeSubscriptionId && newPlan.stripePriceId) {
      try {
        // Update Stripe subscription
        await StripeService.updateSubscription(
          currentSubscription.stripeSubscriptionId,
          newPlan.stripePriceId
        );
      } catch (error) {
        console.error('Error updating Stripe subscription:', error);
        throw new Error('Failed to update subscription');
      }
    }

    // Create new subscription
    return await this.createSubscription(
      userId, 
      newPlanId, 
      currentSubscription?.stripeSubscriptionId,
      currentSubscription?.stripeCustomerId
    );
  }

  // Get billing cycle information
  static getBillingCycleInfo(subscription: ISubscription) {
    const now = new Date();
    const daysUntilRenewal = Math.ceil(
      (subscription.currentPeriodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      daysUntilRenewal,
      isActive: subscription.status === 'active',
      willCancelAtPeriodEnd: subscription.cancelAtPeriodEnd
    };
  }

  // Calculate prorated amount for plan changes
  static calculateProratedAmount(
    currentPlan: IStoragePlan,
    newPlan: IStoragePlan,
    daysRemaining: number
  ): number {
    const daysInMonth = 30; // Approximate
    const currentDailyRate = currentPlan.price / daysInMonth;
    const newDailyRate = newPlan.price / daysInMonth;
    
    const refund = currentDailyRate * daysRemaining;
    const newCharge = newDailyRate * daysRemaining;
    
    return Math.max(0, newCharge - refund);
  }
}