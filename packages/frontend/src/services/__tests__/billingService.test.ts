import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { billingService } from '../billingService';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

describe('BillingService', () => {
  const mockAuthToken = 'mock-auth-token';
  
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(mockAuthToken);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('getStoragePlans', () => {
    const mockPlans = [
      {
        id: 'free',
        name: 'free',
        displayName: 'Free',
        storageLimit: 5368709120,
        price: 0,
        currency: 'usd',
        billingInterval: 'month',
        features: ['5GB Storage', 'Basic Email Encryption'],
        formattedPrice: '$0.00',
        formattedStorage: '5.0 GB'
      },
      {
        id: 'basic',
        name: 'basic',
        displayName: 'Basic',
        storageLimit: 53687091200,
        price: 199,
        currency: 'usd',
        billingInterval: 'month',
        features: ['50GB Storage', 'Advanced Email Encryption'],
        formattedPrice: '$1.99',
        formattedStorage: '50.0 GB'
      }
    ];

    it('should fetch storage plans successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: mockPlans
        })
      });

      const plans = await billingService.getStoragePlans();

      expect(mockFetch).toHaveBeenCalledWith('/api/billing/plans');
      expect(plans).toEqual(mockPlans);
    });

    it('should throw error when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Server error'
        })
      });

      await expect(billingService.getStoragePlans()).rejects.toThrow('Server error');
    });

    it('should throw error when fetch fails', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(billingService.getStoragePlans()).rejects.toThrow('Network error');
    });
  });

  describe('getCurrentSubscription', () => {
    const mockSubscription = {
      id: 'sub_123',
      userId: 'user_123',
      planId: 'basic',
      status: 'active',
      currentPeriodStart: '2023-01-01',
      currentPeriodEnd: '2023-02-01',
      cancelAtPeriodEnd: false
    };

    it('should fetch current subscription successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: mockSubscription
        })
      });

      const subscription = await billingService.getCurrentSubscription();

      expect(mockFetch).toHaveBeenCalledWith('/api/billing/subscription', {
        headers: {
          'Authorization': `Bearer ${mockAuthToken}`
        }
      });
      expect(subscription).toEqual(mockSubscription);
    });

    it('should return null when no subscription exists', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: null
        })
      });

      const subscription = await billingService.getCurrentSubscription();
      expect(subscription).toBeNull();
    });

    it('should throw error when not authenticated', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      await expect(billingService.getCurrentSubscription()).rejects.toThrow('Not authenticated');
    });

    it('should throw error when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Unauthorized'
        })
      });

      await expect(billingService.getCurrentSubscription()).rejects.toThrow('Unauthorized');
    });
  });

  describe('changePlan', () => {
    it('should change plan successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          message: 'Plan changed successfully'
        })
      });

      await billingService.changePlan('basic');

      expect(mockFetch).toHaveBeenCalledWith('/api/billing/change-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockAuthToken}`
        },
        body: JSON.stringify({ planId: 'basic' })
      });
    });

    it('should throw error when not authenticated', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      await expect(billingService.changePlan('basic')).rejects.toThrow('Not authenticated');
    });

    it('should throw error when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'Invalid plan'
        })
      });

      await expect(billingService.changePlan('invalid')).rejects.toThrow('Invalid plan');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          message: 'Subscription canceled'
        })
      });

      await billingService.cancelSubscription();

      expect(mockFetch).toHaveBeenCalledWith('/api/billing/cancel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mockAuthToken}`
        }
      });
    });

    it('should throw error when not authenticated', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      await expect(billingService.cancelSubscription()).rejects.toThrow('Not authenticated');
    });

    it('should throw error when API returns error', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: false,
          error: 'No active subscription'
        })
      });

      await expect(billingService.cancelSubscription()).rejects.toThrow('No active subscription');
    });
  });

  describe('getBillingInfo', () => {
    const mockBillingInfo = {
      hasSubscription: true,
      isActive: true,
      currentPeriodStart: new Date('2023-01-01'),
      currentPeriodEnd: new Date('2023-02-01'),
      daysUntilRenewal: 15
    };

    it('should fetch billing info successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: mockBillingInfo
        })
      });

      const billingInfo = await billingService.getBillingInfo();

      expect(mockFetch).toHaveBeenCalledWith('/api/billing/billing-info', {
        headers: {
          'Authorization': `Bearer ${mockAuthToken}`
        }
      });
      expect(billingInfo).toEqual(mockBillingInfo);
    });

    it('should throw error when not authenticated', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      await expect(billingService.getBillingInfo()).rejects.toThrow('Not authenticated');
    });
  });

  describe('createSubscription', () => {
    const mockResult = {
      subscription: {
        id: 'sub_123',
        planId: 'basic',
        status: 'active'
      },
      clientSecret: 'pi_123_secret'
    };

    it('should create subscription successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: mockResult.subscription,
          clientSecret: mockResult.clientSecret
        })
      });

      const result = await billingService.createSubscription('basic', 'pm_123');

      expect(mockFetch).toHaveBeenCalledWith('/api/billing/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockAuthToken}`
        },
        body: JSON.stringify({ planId: 'basic', paymentMethodId: 'pm_123' })
      });
      expect(result).toEqual(mockResult);
    });

    it('should create subscription without payment method', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: mockResult.subscription
        })
      });

      const result = await billingService.createSubscription('free');

      expect(mockFetch).toHaveBeenCalledWith('/api/billing/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockAuthToken}`
        },
        body: JSON.stringify({ planId: 'free' })
      });
      expect(result.subscription).toEqual(mockResult.subscription);
    });
  });

  describe('setupPayment', () => {
    const mockSetupResult = {
      clientSecret: 'seti_123_secret',
      customerId: 'cus_123'
    };

    it('should setup payment successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: mockSetupResult
        })
      });

      const result = await billingService.setupPayment();

      expect(mockFetch).toHaveBeenCalledWith('/api/billing/setup-payment', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${mockAuthToken}`
        }
      });
      expect(result).toEqual(mockSetupResult);
    });
  });

  describe('getPaymentMethods', () => {
    const mockPaymentMethods = [
      {
        id: 'pm_123',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
          expMonth: 12,
          expYear: 2025
        }
      }
    ];

    it('should fetch payment methods successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: mockPaymentMethods
        })
      });

      const paymentMethods = await billingService.getPaymentMethods();

      expect(mockFetch).toHaveBeenCalledWith('/api/billing/payment-methods', {
        headers: {
          'Authorization': `Bearer ${mockAuthToken}`
        }
      });
      expect(paymentMethods).toEqual(mockPaymentMethods);
    });
  });

  describe('removePaymentMethod', () => {
    it('should remove payment method successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          message: 'Payment method removed'
        })
      });

      await billingService.removePaymentMethod('pm_123');

      expect(mockFetch).toHaveBeenCalledWith('/api/billing/payment-methods/pm_123', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${mockAuthToken}`
        }
      });
    });
  });

  describe('getInvoices', () => {
    const mockInvoices = [
      {
        id: 'in_123',
        number: 'INV-001',
        status: 'paid',
        amountPaid: 199,
        currency: 'usd',
        created: '2023-01-01'
      }
    ];

    it('should fetch invoices successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: mockInvoices
        })
      });

      const invoices = await billingService.getInvoices(5);

      expect(mockFetch).toHaveBeenCalledWith('/api/billing/invoices?limit=5', {
        headers: {
          'Authorization': `Bearer ${mockAuthToken}`
        }
      });
      expect(invoices).toEqual(mockInvoices);
    });

    it('should use default limit when not specified', async () => {
      mockFetch.mockResolvedValueOnce({
        json: async () => ({
          success: true,
          data: mockInvoices
        })
      });

      await billingService.getInvoices();

      expect(mockFetch).toHaveBeenCalledWith('/api/billing/invoices?limit=10', {
        headers: {
          'Authorization': `Bearer ${mockAuthToken}`
        }
      });
    });
  });

  describe('Utility Methods', () => {
    describe('formatStorageSize', () => {
      it('should format bytes correctly', () => {
        expect(billingService.formatStorageSize(0)).toBe('0 B');
        expect(billingService.formatStorageSize(1024)).toBe('1.0 KB');
        expect(billingService.formatStorageSize(1024 * 1024)).toBe('1.0 MB');
        expect(billingService.formatStorageSize(5 * 1024 * 1024 * 1024)).toBe('5.0 GB');
        expect(billingService.formatStorageSize(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB');
      });
    });

    describe('formatPrice', () => {
      it('should format cents to dollars', () => {
        expect(billingService.formatPrice(0)).toBe('$0.00');
        expect(billingService.formatPrice(199)).toBe('$1.99');
        expect(billingService.formatPrice(1000)).toBe('$10.00');
        expect(billingService.formatPrice(1234)).toBe('$12.34');
      });
    });

    describe('calculateDaysUntilRenewal', () => {
      it('should calculate days until renewal', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 15);
        
        const days = billingService.calculateDaysUntilRenewal(futureDate);
        expect(days).toBe(15);
      });

      it('should handle past dates', () => {
        const pastDate = new Date();
        pastDate.setDate(pastDate.getDate() - 5);
        
        const days = billingService.calculateDaysUntilRenewal(pastDate);
        expect(days).toBeLessThan(0);
      });

      it('should handle string dates', () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 10);
        
        const days = billingService.calculateDaysUntilRenewal(futureDate.toISOString());
        expect(days).toBe(10);
      });
    });
  });
});