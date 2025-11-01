import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { billingService, Subscription, BillingInfo } from '../services/billingService';
import { PaymentForm } from './PaymentForm';
import { InvoiceHistory } from './InvoiceHistory';

interface UsageData {
  storageUsed: number;
  storageQuota: number;
  emailsSent: number;
  emailsReceived: number;
  filesUploaded: number;
}

export const BillingDashboard: React.FC = () => {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null);
  const [usageData, setUsageData] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'payment' | 'invoices' | 'usage'>('overview');

  useEffect(() => {
    fetchBillingData();
  }, []);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const [subscriptionData, billingInfoData] = await Promise.all([
        billingService.getCurrentSubscription(),
        billingService.getBillingInfo()
      ]);

      setSubscription(subscriptionData);
      setBillingInfo(billingInfoData);
      
      // Mock usage data - in real implementation, this would come from an API
      setUsageData({
        storageUsed: 2.5 * 1024 * 1024 * 1024, // 2.5GB
        storageQuota: 5 * 1024 * 1024 * 1024, // 5GB
        emailsSent: 145,
        emailsReceived: 289,
        filesUploaded: 23
      });

      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch billing data');
    } finally {
      setLoading(false);
    }
  };

  const formatStorageSize = (bytes: number): string => {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);
    
    return `${size.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  };

  const calculateStoragePercentage = (): number => {
    if (!usageData) return 0;
    return (usageData.storageUsed / usageData.storageQuota) * 100;
  };

  const getStorageColor = (percentage: number): string => {
    if (percentage >= 90) return 'text-red-600';
    if (percentage >= 75) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getStorageBarColor = (percentage: number): string => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'payment', label: 'Payment Methods', icon: '💳' },
    { id: 'invoices', label: 'Invoices', icon: '📄' },
    { id: 'usage', label: 'Usage Analytics', icon: '📈' }
  ];

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="h-64 bg-gray-200 rounded-lg"></div>
              <div className="h-96 bg-gray-200 rounded-lg"></div>
            </div>
            <div className="space-y-6">
              <div className="h-48 bg-gray-200 rounded-lg"></div>
              <div className="h-32 bg-gray-200 rounded-lg"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing Dashboard</h1>
        <p className="text-gray-600">Manage your subscription, payments, and usage</p>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <div className="flex items-center">
            <svg
              className="w-5 h-5 text-red-400 mr-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-red-800">{error}</span>
          </div>
        </motion.div>
      )}

      {/* Tab Navigation */}
      <div className="mb-8">
        <nav className="flex space-x-8 border-b border-gray-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {activeTab === 'overview' && (
          <>
            {/* Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Subscription Status */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-lg shadow-sm border p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Status</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Current Plan</div>
                    <div className="text-2xl font-bold text-gray-900 capitalize">
                      {subscription?.planId || 'Free'}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm text-gray-600 mb-1">Status</div>
                    <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      billingInfo?.isActive 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {billingInfo?.isActive ? 'Active' : 'Inactive'}
                    </div>
                  </div>
                  {billingInfo?.currentPeriodEnd && (
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Next Billing Date</div>
                      <div className="font-medium">
                        {new Date(billingInfo.currentPeriodEnd).toLocaleDateString()}
                      </div>
                    </div>
                  )}
                  {billingInfo?.daysUntilRenewal !== undefined && (
                    <div>
                      <div className="text-sm text-gray-600 mb-1">Days Until Renewal</div>
                      <div className="font-medium">
                        {billingInfo.daysUntilRenewal > 0 
                          ? `${billingInfo.daysUntilRenewal} days`
                          : 'Expired'
                        }
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Storage Usage */}
              {usageData && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white rounded-lg shadow-sm border p-6"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Usage</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Used Storage</span>
                      <span className={`font-medium ${getStorageColor(calculateStoragePercentage())}`}>
                        {formatStorageSize(usageData.storageUsed)} of {formatStorageSize(usageData.storageQuota)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${calculateStoragePercentage()}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                        className={`h-2 rounded-full ${getStorageBarColor(calculateStoragePercentage())}`}
                      />
                    </div>
                    <div className="text-sm text-gray-500">
                      {calculateStoragePercentage().toFixed(1)}% used
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-white rounded-lg shadow-sm border p-6"
              >
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <button
                    onClick={() => setActiveTab('payment')}
                    className="w-full text-left px-4 py-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                  >
                    <div className="font-medium text-blue-900">Manage Payment Methods</div>
                    <div className="text-sm text-blue-600">Add or remove payment methods</div>
                  </button>
                  <button
                    onClick={() => setActiveTab('invoices')}
                    className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <div className="font-medium text-gray-900">View Invoices</div>
                    <div className="text-sm text-gray-600">Download billing history</div>
                  </button>
                  <button
                    onClick={() => setActiveTab('usage')}
                    className="w-full text-left px-4 py-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <div className="font-medium text-green-900">Usage Analytics</div>
                    <div className="text-sm text-green-600">View detailed usage stats</div>
                  </button>
                </div>
              </motion.div>

              {/* Usage Summary */}
              {usageData && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white rounded-lg shadow-sm border p-6"
                >
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">This Month</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Emails Sent</span>
                      <span className="font-medium">{usageData.emailsSent}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Emails Received</span>
                      <span className="font-medium">{usageData.emailsReceived}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Files Uploaded</span>
                      <span className="font-medium">{usageData.filesUploaded}</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </>
        )}

        {activeTab === 'payment' && (
          <div className="lg:col-span-3">
            <PaymentForm
              onPaymentMethodAdd={fetchBillingData}
              onPaymentMethodRemove={fetchBillingData}
            />
          </div>
        )}

        {activeTab === 'invoices' && (
          <div className="lg:col-span-3">
            <InvoiceHistory />
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="lg:col-span-3">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-lg shadow-sm border p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Usage Analytics</h3>
              
              {usageData && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-blue-600 text-sm font-medium">Storage Used</div>
                    <div className="text-2xl font-bold text-blue-900">
                      {formatStorageSize(usageData.storageUsed)}
                    </div>
                    <div className="text-blue-600 text-sm">
                      of {formatStorageSize(usageData.storageQuota)}
                    </div>
                  </div>
                  
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-green-600 text-sm font-medium">Emails Sent</div>
                    <div className="text-2xl font-bold text-green-900">
                      {usageData.emailsSent}
                    </div>
                    <div className="text-green-600 text-sm">This month</div>
                  </div>
                  
                  <div className="bg-purple-50 rounded-lg p-4">
                    <div className="text-purple-600 text-sm font-medium">Emails Received</div>
                    <div className="text-2xl font-bold text-purple-900">
                      {usageData.emailsReceived}
                    </div>
                    <div className="text-purple-600 text-sm">This month</div>
                  </div>
                  
                  <div className="bg-orange-50 rounded-lg p-4">
                    <div className="text-orange-600 text-sm font-medium">Files Uploaded</div>
                    <div className="text-2xl font-bold text-orange-900">
                      {usageData.filesUploaded}
                    </div>
                    <div className="text-orange-600 text-sm">This month</div>
                  </div>
                </div>
              )}

              <div className="mt-8">
                <div className="text-center py-12 text-gray-500">
                  <svg
                    className="w-16 h-16 mx-auto mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  <p className="text-lg">Detailed Analytics Coming Soon</p>
                  <p className="text-sm">Charts and graphs for usage trends will be available here</p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
};