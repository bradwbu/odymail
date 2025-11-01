import Stripe from 'stripe';
import { env } from '../config/environment.js';
import { User } from '../models/User.js';
import { StoragePlan } from '../models/StoragePlan.js';
import { Subscription } from '../models/Subscription.js';

const stripe = new Stripe(env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16'
});

export class StripeService {
  // Create or get Stripe customer
  static async createOrGetCustomer(userId: string, email: string): Promise<string> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if user already has a Stripe customer ID
    const existingSubscription = await Subscription.findOne({ userId });
    if (existingSubscription?.stripeCustomerId) {
      return existingSubscription.stripeCustomerId;
    }

    // Create new Stripe customer
    const customer = await stripe.customers.create({
      email,
      metadata: {
        userId
      }
    });

    return customer.id;
  }

  // Create Stripe price for a storage plan
  static async createPriceForPlan(planId: string): Promise<string> {
    const plan = await StoragePlan.findOne({ id: planId });
    if (!plan) {
      throw new Error('Storage plan not found');
    }

    if (plan.stripePriceId) {
      return plan.stripePriceId;
    }

    const price = await stripe.prices.create({
      unit_amount: plan.price,
      currency: plan.currency,
      recurring: {
        interval: plan.billingInterval as 'month' | 'year'
      },
      product_data: {
        name: `${plan.displayName} Storage Plan`,
        description: `${plan.features.join(', ')}`,
        metadata: {
          planId: plan.id,
          storageLimit: plan.storageLimit.toString()
        }
      },
      metadata: {
        planId: plan.id
      }
    });

    // Update plan with Stripe price ID
    await StoragePlan.findOneAndUpdate(
      { id: planId },
      { stripePriceId: price.id }
    );

    return price.id;
  }

  // Create payment intent for one-time payment
  static async createPaymentIntent(
    amount: number,
    currency: string = 'usd',
    customerId?: string
  ): Promise<Stripe.PaymentIntent> {
    return await stripe.paymentIntents.create({
      amount,
      currency,
      customer: customerId,
      automatic_payment_methods: {
        enabled: true
      }
    });
  }

  // Create subscription
  static async createSubscription(
    customerId: string,
    priceId: string,
    userId: string
  ): Promise<Stripe.Subscription> {
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{
        price: priceId
      }],
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription'
      },
      expand: ['latest_invoice.payment_intent'],
      metadata: {
        userId
      }
    });

    return subscription;
  }

  // Update subscription
  static async updateSubscription(
    subscriptionId: string,
    newPriceId: string
  ): Promise<Stripe.Subscription> {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    return await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: subscription.items.data[0].id,
        price: newPriceId
      }],
      proration_behavior: 'create_prorations'
    });
  }

  // Cancel subscription
  static async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.cancel(subscriptionId);
  }

  // Get subscription
  static async getSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return await stripe.subscriptions.retrieve(subscriptionId);
  }

  // Create setup intent for saving payment method
  static async createSetupIntent(customerId: string): Promise<Stripe.SetupIntent> {
    return await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session'
    });
  }

  // Get customer's payment methods
  static async getPaymentMethods(customerId: string): Promise<Stripe.PaymentMethod[]> {
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });

    return paymentMethods.data;
  }

  // Detach payment method
  static async detachPaymentMethod(paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    return await stripe.paymentMethods.detach(paymentMethodId);
  }

  // Get invoices for customer
  static async getInvoices(customerId: string, limit: number = 10): Promise<Stripe.Invoice[]> {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit
    });

    return invoices.data;
  }

  // Handle webhook events
  static async handleWebhook(
    payload: string | Buffer,
    signature: string
  ): Promise<Stripe.Event> {
    const webhookSecret = env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('Stripe webhook secret not configured');
    }

    return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }

  // Process webhook event
  static async processWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'subscription.created':
      case 'subscription.updated':
        await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;
      
      case 'subscription.deleted':
        await this.handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
        break;
      
      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;
      
      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  }

  // Handle subscription updates
  private static async handleSubscriptionUpdate(stripeSubscription: Stripe.Subscription): Promise<void> {
    const userId = stripeSubscription.metadata.userId;
    if (!userId) return;

    const subscription = await Subscription.findOne({ 
      stripeSubscriptionId: stripeSubscription.id 
    });

    if (subscription) {
      await Subscription.findByIdAndUpdate(subscription._id, {
        status: stripeSubscription.status,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end
      });
    }
  }

  // Handle subscription cancellation
  private static async handleSubscriptionCanceled(stripeSubscription: Stripe.Subscription): Promise<void> {
    const userId = stripeSubscription.metadata.userId;
    if (!userId) return;

    await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: stripeSubscription.id },
      { 
        status: 'canceled',
        canceledAt: new Date()
      }
    );

    // Revert user to free plan
    const freePlan = await StoragePlan.findOne({ id: 'free' });
    if (freePlan) {
      await User.findByIdAndUpdate(userId, {
        storageQuota: freePlan.storageLimit,
        subscriptionPlan: 'free'
      });
    }
  }

  // Handle successful payment
  private static async handlePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
    console.log(`Payment succeeded for invoice: ${invoice.id}`);
    // Additional logic for successful payments can be added here
  }

  // Handle failed payment
  private static async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    console.log(`Payment failed for invoice: ${invoice.id}`);
    
    if (invoice.subscription) {
      const subscription = await Subscription.findOne({ 
        stripeSubscriptionId: invoice.subscription 
      });
      
      if (subscription) {
        await Subscription.findByIdAndUpdate(subscription._id, {
          status: 'past_due'
        });
      }
    }
  }
}