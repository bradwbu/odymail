import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { billingService, BillingInfo } from '../services/billingService';

interface BillingCycleManagerProps {
  onBillingUpdate?: () => void;
}

export const BillingCycleManager: React.FC<BillingCycleManagerProps> = ({
  onBillingUpdate
}) => {
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    fetchBillingInfo();
  }, []);

  const fetchBillingInfo = async () => {
    try {
      setLoading(true);
      const info = await billingService.getBillingInfo();
      setBillingInfo(info);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch billing info');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will be downgraded to the free plan at the end of your current billing cycle.')) {
      return;
    }

    try {
      setCanceling(true);
      await billingService.cancelSubscription();
      await fetchBillingInfo();
      onBillingUpdate?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setCanceling(false);
    }
  };

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            <div className="h-3 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={fetchBillingInfo}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!billingInfo?.hasSubscription) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Billing Information</h3>
        <p className="text-gray-600">You are currently on the free plan.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-sm border p-6"
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Billing Cycle Information</h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Status:</span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
            billingInfo.isActive 
              ? 'bg-green-100 text-green-800' 
              : 'bg-red-100 text-red-800'
          }`}>
            {billingInfo.isActive ? 'Active' : 'Inactive'}
          </span>
        </div>

        {billingInfo.currentPeriodStart && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Current Period Start:</span>
            <span className="font-medium">{formatDate(billingInfo.currentPeriodStart)}</span>
          </div>
        )}

        {billingInfo.currentPeriodEnd && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Current Period End:</span>
            <span className="font-medium">{formatDate(billingInfo.currentPeriodEnd)}</span>
          </div>
        )}

        {billingInfo.daysUntilRenewal !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-gray-600">Days Until Renewal:</span>
            <span className="font-medium">
              {billingInfo.daysUntilRenewal > 0 
                ? `${billingInfo.daysUntilRenewal} days`
                : 'Expired'
              }
            </span>
          </div>
        )}

        {billingInfo.willCancelAtPeriodEnd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-yellow-50 border border-yellow-200 rounded-lg p-3"
          >
            <div className="flex items-center">
              <svg
                className="w-5 h-5 text-yellow-400 mr-2"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-yellow-800 text-sm">
                Your subscription will be canceled at the end of the current billing cycle.
              </span>
            </div>
          </motion.div>
        )}

        {billingInfo.isActive && !billingInfo.willCancelAtPeriodEnd && (
          <div className="pt-4 border-t">
            <button
              onClick={handleCancelSubscription}
              disabled={canceling}
              className="w-full px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {canceling ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600 mr-2"></div>
                  Canceling...
                </div>
              ) : (
                'Cancel Subscription'
              )}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
};