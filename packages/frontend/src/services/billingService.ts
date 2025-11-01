interface StoragePlan {
  id: string;
  name: string;
  displayName: string;
  storageLimit: number;
  price: number;
  currency: string;
  billingInterval: string;
  features: string[];
  formattedPrice: string;
  formattedStorage: string;
}

interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  billingInfo?: {
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    daysUntilRenewal: number;
    isActive: boolean;
    willCancelAtPeriodEnd: boolean;
  };
}

interface BillingInfo {
  hasSubscription: boolean;
  plan?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
  daysUntilRenewal?: number;
  isActive?: boolean;
  willCancelAtPeriodEnd?: boolean;
}

class BillingService {
  private baseUrl = '/api/billing';

  async getStoragePlans(): Promise<StoragePlan[]> {
    const response = await fetch(`${this.baseUrl}/plans`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch storage plans');
    }
    
    return result.data;
  }

  async getCurrentSubscription(): Promise<Subscription | null> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}/subscription`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch subscription');
    }
    
    return result.data;
  }

  async changePlan(planId: string): Promise<void> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}/change-plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ planId })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to change plan');
    }
  }

  async cancelSubscription(): Promise<void> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to cancel subscription');
    }
  }

  async getBillingInfo(): Promise<BillingInfo> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}/billing-info`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch billing info');
    }
    
    return result.data;
  }

  formatStorageSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);
    
    return `${size.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  }

  formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(2)}`;
  }

  calculateDaysUntilRenewal(endDate: string | Date): number {
    const end = new Date(endDate);
    const now = new Date();
    const diffTime = end.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  async createSubscription(planId: string, paymentMethodId?: string): Promise<{ subscription: Subscription; clientSecret?: string }> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}/create-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ planId, paymentMethodId })
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to create subscription');
    }
    
    return {
      subscription: result.data,
      clientSecret: result.clientSecret
    };
  }

  async setupPayment(): Promise<{ clientSecret: string; customerId: string }> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}/setup-payment`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to setup payment');
    }
    
    return result.data;
  }

  async getPaymentMethods(): Promise<any[]> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}/payment-methods`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch payment methods');
    }
    
    return result.data;
  }

  async removePaymentMethod(paymentMethodId: string): Promise<void> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}/payment-methods/${paymentMethodId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to remove payment method');
    }
  }

  async getInvoices(limit: number = 10): Promise<any[]> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}/invoices?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch invoices');
    }
    
    return result.data;
  }
}

export const billingService = new BillingService();
export type { StoragePlan, Subscription, BillingInfo };