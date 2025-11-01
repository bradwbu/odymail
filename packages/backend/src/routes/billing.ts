import express from 'express';
import { BillingService } from '../services/billingService.js';
import { StripeService } from '../services/stripeService.js';
import { authenticateToken } from '../middleware/auth.js';
import { z } from 'zod';

const router = express.Router();

// Validation schemas
const changePlanSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required')
});

const createSubscriptionSchema = z.object({
  planId: z.string().min(1, 'Plan ID is required'),
  paymentMethodId: z.string().optional()
});

const setupPaymentSchema = z.object({
  customerId: z.string().optional()
});

// Get all available storage plans
router.get('/plans', async (req, res) => {
  try {
    const plans = await BillingService.getStoragePlans();
    res.json({
      success: true,
      data: plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        storageLimit: plan.storageLimit,
        price: plan.price,
        currency: plan.currency,
        billingInterval: plan.billingInterval,
        features: plan.features,
        formattedPrice: `$${(plan.price / 100).toFixed(2)}`,
        formattedStorage: formatStorageSize(plan.storageLimit)
      }))
    });
  } catch (error) {
    console.error('Error fetching storage plans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch storage plans'
    });
  }
});

// Get user's current subscription
router.get('/subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const subscription = await BillingService.getUserSubscription(userId);
    
    if (!subscription) {
      return res.json({
        success: true,
        data: null
      });
    }

    const billingInfo = BillingService.getBillingCycleInfo(subscription);
    
    res.json({
      success: true,
      data: {
        ...subscription.toObject(),
        billingInfo
      }
    });
  } catch (error) {
    console.error('Error fetching user subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription'
    });
  }
});

// Change subscription plan
router.post('/change-plan', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const validation = changePlanSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.errors
      });
    }

    const { planId } = validation.data;

    // Check if plan exists
    const plan = await BillingService.getStoragePlan(planId);
    if (!plan) {
      return res.status(404).json({
        success: false,
        error: 'Storage plan not found'
      });
    }

    // Handle free plan
    if (planId === 'free') {
      await BillingService.cancelSubscription(userId);
      return res.json({
        success: true,
        message: 'Successfully downgraded to free plan'
      });
    }

    // Create subscription with Stripe integration
    const result = await BillingService.createStripeSubscription(userId, planId);

    res.json({
      success: true,
      data: result.subscription,
      clientSecret: result.clientSecret,
      message: 'Subscription plan updated successfully'
    });
  } catch (error) {
    console.error('Error changing subscription plan:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to change subscription plan'
    });
  }
});

// Cancel subscription
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    await BillingService.cancelSubscription(userId);

    res.json({
      success: true,
      message: 'Subscription canceled successfully'
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel subscription'
    });
  }
});

// Get billing cycle information
router.get('/billing-info', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const subscription = await BillingService.getUserSubscription(userId);
    
    if (!subscription) {
      return res.json({
        success: true,
        data: {
          hasSubscription: false,
          plan: 'free'
        }
      });
    }

    const billingInfo = BillingService.getBillingCycleInfo(subscription);
    
    res.json({
      success: true,
      data: {
        hasSubscription: true,
        ...billingInfo
      }
    });
  } catch (error) {
    console.error('Error fetching billing info:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch billing information'
    });
  }
});

// Create subscription with payment
router.post('/create-subscription', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const validation = createSubscriptionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validation.error.errors
      });
    }

    const { planId, paymentMethodId } = validation.data;

    const result = await BillingService.createStripeSubscription(
      userId,
      planId,
      paymentMethodId
    );

    res.json({
      success: true,
      data: result.subscription,
      clientSecret: result.clientSecret
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create subscription'
    });
  }
});

// Setup payment method
router.post('/setup-payment', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const email = req.user?.email;
    
    if (!userId || !email) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Create or get Stripe customer
    const customerId = await StripeService.createOrGetCustomer(userId, email);

    // Create setup intent
    const setupIntent = await StripeService.createSetupIntent(customerId);

    res.json({
      success: true,
      data: {
        clientSecret: setupIntent.client_secret,
        customerId
      }
    });
  } catch (error) {
    console.error('Error setting up payment:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup payment method'
    });
  }
});

// Get payment methods
router.get('/payment-methods', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const email = req.user?.email;
    
    if (!userId || !email) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    // Get customer ID
    const customerId = await StripeService.createOrGetCustomer(userId, email);

    // Get payment methods
    const paymentMethods = await StripeService.getPaymentMethods(customerId);

    res.json({
      success: true,
      data: paymentMethods.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year
        } : null
      }))
    });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch payment methods'
    });
  }
});

// Remove payment method
router.delete('/payment-methods/:paymentMethodId', authenticateToken, async (req, res) => {
  try {
    const { paymentMethodId } = req.params;

    await StripeService.detachPaymentMethod(paymentMethodId);

    res.json({
      success: true,
      message: 'Payment method removed successfully'
    });
  } catch (error) {
    console.error('Error removing payment method:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove payment method'
    });
  }
});

// Get invoices
router.get('/invoices', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    const email = req.user?.email;
    
    if (!userId || !email) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const limit = parseInt(req.query.limit as string) || 10;

    // Get customer ID
    const customerId = await StripeService.createOrGetCustomer(userId, email);

    // Get invoices
    const invoices = await StripeService.getInvoices(customerId, limit);

    res.json({
      success: true,
      data: invoices.map(invoice => ({
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        amountPaid: invoice.amount_paid,
        amountDue: invoice.amount_due,
        currency: invoice.currency,
        created: new Date(invoice.created * 1000),
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
        hostedInvoiceUrl: invoice.hosted_invoice_url,
        invoicePdf: invoice.invoice_pdf
      }))
    });
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch invoices'
    });
  }
});

// Stripe webhook endpoint
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    
    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing Stripe signature'
      });
    }

    const event = await StripeService.handleWebhook(req.body, signature);
    await StripeService.processWebhookEvent(event);

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).json({
      success: false,
      error: 'Webhook processing failed'
    });
  }
});

// Helper function to format storage size
function formatStorageSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);
  
  return `${size.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
}

export default router;