import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BillingManagement } from '../BillingManagement';
import { billingService } from '../../services/billingService';

// Mock the billing service
vi.mock('../../services/billingService', () => ({
  billingService: {
    getCurrentSubscription: vi.fn(),
    changePlan: vi.fn(),
    getBillingInfo: vi.fn(),
    getStoragePlans: vi.fn()
  }
}));

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>
  },
  AnimatePresence: ({ children }: any) => <>{children}</>
}));

// Mock child components
vi.mock('../StoragePlanSelector', () => ({
  StoragePlanSelector: ({ onPlanSelect, currentPlan }: any) => (
    <div data-testid="storage-plan-selector">
      <div>Current Plan: {currentPlan}</div>
      <button onClick={() => onPlanSelect('basic')}>Select Basic</button>
      <button onClick={() => onPlanSelect('standard')}>Select Standard</button>
    </div>
  )
}));

vi.mock('../BillingCycleManager', () => ({
  BillingCycleManager: ({ onBillingUpdate }: any) => (
    <div data-testid="billing-cycle-manager">
      <button onClick={onBillingUpdate}>Update Billing</button>
    </div>
  )
}));

vi.mock('../BillingDashboard', () => ({
  BillingDashboard: () => (
    <div data-testid="billing-dashboard">Billing Dashboard</div>
  )
}));

describe('BillingManagement', () => {
  const mockSubscription = {
    id: 'sub_123',
    userId: 'user_123',
    planId: 'basic',
    status: 'active',
    currentPeriodStart: '2023-01-01',
    currentPeriodEnd: '2023-02-01',
    cancelAtPeriodEnd: false
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup default mocks
    vi.mocked(billingService.getCurrentSubscription).mockResolvedValue(mockSubscription);
    vi.mocked(billingService.getBillingInfo).mockResolvedValue({
      hasSubscription: true,
      isActive: true,
      currentPeriodStart: new Date('2023-01-01'),
      currentPeriodEnd: new Date('2023-02-01'),
      daysUntilRenewal: 15
    });
    vi.mocked(billingService.changePlan).mockResolvedValue();
  });

  describe('Dashboard View', () => {
    it('should render billing dashboard by default', async () => {
      render(<BillingManagement />);
      
      await waitFor(() => {
        expect(screen.getByTestId('billing-dashboard')).toBeInTheDocument();
      });
    });

    it('should render billing dashboard when view prop is dashboard', async () => {
      render(<BillingManagement view="dashboard" />);
      
      await waitFor(() => {
        expect(screen.getByTestId('billing-dashboard')).toBeInTheDocument();
      });
    });
  });

  describe('Plans View', () => {
    it('should render plans view when view prop is plans', async () => {
      render(<BillingManagement view="plans" />);
      
      await waitFor(() => {
        expect(screen.getByText('Billing & Subscription')).toBeInTheDocument();
        expect(screen.getByTestId('storage-plan-selector')).toBeInTheDocument();
        expect(screen.getByTestId('billing-cycle-manager')).toBeInTheDocument();
      });
    });

    it('should display current plan in plan selector', async () => {
      render(<BillingManagement view="plans" />);
      
      await waitFor(() => {
        expect(screen.getByText('Current Plan: basic')).toBeInTheDocument();
      });
    });

    it('should handle plan selection', async () => {
      render(<BillingManagement view="plans" />);
      
      await waitFor(() => {
        expect(screen.getByTestId('storage-plan-selector')).toBeInTheDocument();
      });

      const selectBasicButton = screen.getByText('Select Basic');
      fireEvent.click(selectBasicButton);

      await waitFor(() => {
        expect(billingService.changePlan).toHaveBeenCalledWith('basic');
      });
    });

    it('should show success message after plan change', async () => {
      render(<BillingManagement view="plans" />);
      
      await waitFor(() => {
        expect(screen.getByTestId('storage-plan-selector')).toBeInTheDocument();
      });

      const selectStandardButton = screen.getByText('Select Standard');
      fireEvent.click(selectStandardButton);

      await waitFor(() => {
        expect(screen.getByText('Successfully changed to standard plan')).toBeInTheDocument();
      });
    });

    it('should handle plan change errors', async () => {
      vi.mocked(billingService.changePlan).mockRejectedValue(new Error('Payment failed'));
      
      render(<BillingManagement view="plans" />);
      
      await waitFor(() => {
        expect(screen.getByTestId('storage-plan-selector')).toBeInTheDocument();
      });

      const selectBasicButton = screen.getByText('Select Basic');
      fireEvent.click(selectBasicButton);

      await waitFor(() => {
        expect(screen.getByText('Payment failed')).toBeInTheDocument();
      });
    });

    it('should show loading state during plan change', async () => {
      // Mock a delayed response
      vi.mocked(billingService.changePlan).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );
      
      render(<BillingManagement view="plans" />);
      
      await waitFor(() => {
        expect(screen.getByTestId('storage-plan-selector')).toBeInTheDocument();
      });

      const selectBasicButton = screen.getByText('Select Basic');
      fireEvent.click(selectBasicButton);

      // Should show loading state
      expect(screen.getByText('Updating your plan...')).toBeInTheDocument();
    });

    it('should handle billing update from cycle manager', async () => {
      render(<BillingManagement view="plans" />);
      
      await waitFor(() => {
        expect(screen.getByTestId('billing-cycle-manager')).toBeInTheDocument();
      });

      const updateButton = screen.getByText('Update Billing');
      fireEvent.click(updateButton);

      await waitFor(() => {
        expect(billingService.getCurrentSubscription).toHaveBeenCalledTimes(2); // Initial + update
      });
    });
  });

  describe('View Switching', () => {
    it('should switch between dashboard and plans views', async () => {
      render(<BillingManagement view="plans" />);
      
      await waitFor(() => {
        expect(screen.getByText('Billing & Subscription')).toBeInTheDocument();
      });

      const dashboardButton = screen.getByText('Dashboard');
      fireEvent.click(dashboardButton);

      await waitFor(() => {
        expect(screen.getByTestId('billing-dashboard')).toBeInTheDocument();
      });

      const plansButton = screen.getByText('Change Plan');
      fireEvent.click(plansButton);

      await waitFor(() => {
        expect(screen.getByText('Billing & Subscription')).toBeInTheDocument();
        expect(screen.getByTestId('storage-plan-selector')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle subscription fetch errors', async () => {
      vi.mocked(billingService.getCurrentSubscription).mockRejectedValue(
        new Error('Network error')
      );
      
      render(<BillingManagement view="plans" />);
      
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should handle billing info fetch errors', async () => {
      vi.mocked(billingService.getBillingInfo).mockRejectedValue(
        new Error('Server error')
      );
      
      render(<BillingManagement view="plans" />);
      
      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
    });
  });

  describe('Free Plan Handling', () => {
    beforeEach(() => {
      vi.mocked(billingService.getCurrentSubscription).mockResolvedValue(null);
      vi.mocked(billingService.getBillingInfo).mockResolvedValue({
        hasSubscription: false,
        plan: 'free'
      });
    });

    it('should handle free plan users', async () => {
      render(<BillingManagement view="plans" />);
      
      await waitFor(() => {
        expect(screen.getByText('Current Plan: free')).toBeInTheDocument();
      });
    });

    it('should handle downgrade to free plan', async () => {
      render(<BillingManagement view="plans" />);
      
      await waitFor(() => {
        expect(screen.getByTestId('storage-plan-selector')).toBeInTheDocument();
      });

      // Mock plan change to free
      vi.mocked(billingService.changePlan).mockImplementation(async (planId) => {
        if (planId === 'free') {
          // Simulate successful downgrade
          return;
        }
      });

      const selectBasicButton = screen.getByText('Select Basic');
      fireEvent.click(selectBasicButton);

      await waitFor(() => {
        expect(billingService.changePlan).toHaveBeenCalledWith('basic');
      });
    });
  });
});