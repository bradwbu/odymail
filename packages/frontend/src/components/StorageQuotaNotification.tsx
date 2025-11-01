/**
 * Storage quota notification component for quota exceeded warnings
 */

import React, { useState, useEffect, useCallback } from 'react';
import { StorageQuota } from '../types/storage';
import { StorageQuotaService, StoragePlan } from '../services/storageQuotaService';

interface StorageQuotaNotificationProps {
  quota: StorageQuota;
  onUpgrade?: (plan: string) => void;
  onDismiss?: () => void;
  className?: string;
}

export const StorageQuotaNotification: React.FC<StorageQuotaNotificationProps> = ({
  quota,
  onUpgrade,
  onDismiss,
  className = ''
}) => {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>('');
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [availablePlans, setAvailablePlans] = useState<StoragePlan[]>([]);

  // Load available plans
  useEffect(() => {
    const plans = StorageQuotaService.getStoragePlans();
    setAvailablePlans(plans);
    
    // Set recommended plan as default
    const recommended = StorageQuotaService.getRecommendedPlan(quota);
    if (recommended) {
      setSelectedPlan(recommended.id);
    }
  }, [quota]);

  // Handle upgrade
  const handleUpgrade = useCallback(async () => {
    if (!selectedPlan) return;

    try {
      setIsUpgrading(true);
      await StorageQuotaService.upgradeStoragePlan(selectedPlan);
      
      if (onUpgrade) {
        onUpgrade(selectedPlan);
      }
      
      setShowUpgradeModal(false);
    } catch (error) {
      console.error('Failed to upgrade plan:', error);
      // You could show an error toast here
    } finally {
      setIsUpgrading(false);
    }
  }, [selectedPlan, onUpgrade]);

  // Don't show notification if storage is not critical
  if (quota.percentage < 80) {
    return null;
  }

  const statusColor = StorageQuotaService.getStorageStatusColor(quota.percentage);
  const statusMessage = StorageQuotaService.getStorageStatusMessage(quota);
  const isCritical = quota.percentage >= 95;

  return (
    <>
      {/* Notification Bar */}
      <div className={`
        storage-quota-notification border-l-4 p-4 mb-4 animate-slideUp
        ${isCritical 
          ? 'bg-red-50 border-red-400' 
          : 'bg-yellow-50 border-yellow-400'
        }
        ${className}
      `}>
        <div className="flex items-start">
          <div className="flex-shrink-0">
            <svg 
              className={`w-5 h-5 ${isCritical ? 'text-red-400' : 'text-yellow-400'}`}
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          
          <div className="ml-3 flex-1">
            <h3 className={`text-sm font-medium ${isCritical ? 'text-red-800' : 'text-yellow-800'}`}>
              {isCritical ? 'Storage Almost Full' : 'Storage Warning'}
            </h3>
            <div className={`mt-1 text-sm ${isCritical ? 'text-red-700' : 'text-yellow-700'}`}>
              <p>{statusMessage}</p>
              <div className="mt-2 flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(quota.percentage, 100)}%`,
                        backgroundColor: statusColor
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium">
                    {quota.percentage.toFixed(1)}% used
                  </span>
                </div>
                <span className="text-xs">
                  {StorageQuotaService.formatFileSize(quota.used)} / {StorageQuotaService.formatFileSize(quota.total)}
                </span>
              </div>
            </div>
          </div>

          <div className="ml-4 flex space-x-2">
            <button
              onClick={() => setShowUpgradeModal(true)}
              className={`
                px-3 py-1 text-xs font-medium rounded-md transition-colors
                ${isCritical
                  ? 'bg-red-100 text-red-800 hover:bg-red-200'
                  : 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200'
                }
              `}
            >
              Upgrade
            </button>
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className={`
                  text-xs font-medium transition-colors
                  ${isCritical ? 'text-red-600 hover:text-red-800' : 'text-yellow-600 hover:text-yellow-800'}
                `}
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl mx-4 max-h-[80vh] overflow-auto animate-scaleIn">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Upgrade Storage Plan</h3>
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {/* Current Usage */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Current Usage</h4>
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{ 
                        width: `${Math.min(quota.percentage, 100)}%`,
                        backgroundColor: statusColor
                      }}
                    />
                  </div>
                </div>
                <div className="text-sm text-gray-600">
                  {StorageQuotaService.formatFileSize(quota.used)} / {StorageQuotaService.formatFileSize(quota.total)}
                </div>
              </div>
            </div>

            {/* Plan Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {availablePlans.filter(plan => plan.id !== 'free').map((plan) => (
                <div
                  key={plan.id}
                  className={`
                    border-2 rounded-lg p-4 cursor-pointer transition-all duration-200
                    ${selectedPlan === plan.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-lg font-semibold text-gray-900">{plan.name}</h5>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        ${plan.price}
                      </div>
                      <div className="text-xs text-gray-500">per month</div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-3">
                    {StorageQuotaService.formatFileSize(plan.storage)} storage
                  </div>
                  
                  <ul className="text-xs text-gray-600 space-y-1">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-center">
                        <svg className="w-3 h-3 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  
                  {selectedPlan === plan.id && (
                    <div className="mt-3 flex items-center text-blue-600">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className="text-sm font-medium">Selected</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
                disabled={isUpgrading}
              >
                Cancel
              </button>
              <button
                onClick={handleUpgrade}
                disabled={!selectedPlan || isUpgrading}
                className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isUpgrading ? 'Upgrading...' : 'Upgrade Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default StorageQuotaNotification;