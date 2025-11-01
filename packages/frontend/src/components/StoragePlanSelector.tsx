import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

interface StoragePlanSelectorProps {
  currentPlan?: string;
  onPlanSelect: (planId: string) => void;
  isLoading?: boolean;
}

export const StoragePlanSelector: React.FC<StoragePlanSelectorProps> = ({
  currentPlan = 'free',
  onPlanSelect,
  isLoading = false
}) => {
  const [plans, setPlans] = useState<StoragePlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState(currentPlan);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStoragePlans();
  }, []);

  useEffect(() => {
    setSelectedPlan(currentPlan);
  }, [currentPlan]);

  const fetchStoragePlans = async () => {
    try {
      const response = await fetch('/api/billing/plans');
      const result = await response.json();
      
      if (result.success) {
        setPlans(result.data);
      } else {
        setError('Failed to load storage plans');
      }
    } catch (err) {
      setError('Failed to load storage plans');
      console.error('Error fetching storage plans:', err);
    } finally {
      setFetchLoading(false);
    }
  };

  const handlePlanSelect = (planId: string) => {
    if (planId !== selectedPlan && !isLoading) {
      setSelectedPlan(planId);
      onPlanSelect(planId);
    }
  };

  const getPlanBadge = (plan: StoragePlan) => {
    if (plan.id === currentPlan) {
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded-full"
        >
          Current
        </motion.div>
      );
    }
    
    if (plan.id === 'standard') {
      return (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full"
        >
          Popular
        </motion.div>
      );
    }
    
    return null;
  };

  if (fetchLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        {[...Array(5)].map((_, index) => (
          <div key={index} className="animate-pulse">
            <div className="bg-gray-200 rounded-lg h-80"></div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">{error}</div>
        <button
          onClick={fetchStoragePlans}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Choose Your Storage Plan</h2>
        <p className="text-gray-600">Upgrade your storage capacity to fit your needs</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
        <AnimatePresence>
          {plans.map((plan, index) => (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative bg-white rounded-lg border-2 p-6 cursor-pointer transition-all duration-200 ${
                selectedPlan === plan.id
                  ? 'border-blue-500 shadow-lg scale-105'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
              } ${plan.id === 'standard' ? 'ring-2 ring-green-200' : ''}`}
              onClick={() => handlePlanSelect(plan.id)}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              {getPlanBadge(plan)}
              
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  {plan.displayName}
                </h3>
                
                <div className="mb-4">
                  <span className="text-3xl font-bold text-gray-900">
                    {plan.price === 0 ? 'Free' : plan.formattedPrice}
                  </span>
                  {plan.price > 0 && (
                    <span className="text-gray-500 text-sm">/{plan.billingInterval}</span>
                  )}
                </div>
                
                <div className="text-xl font-medium text-blue-600 mb-4">
                  {plan.formattedStorage}
                </div>
                
                <ul className="space-y-2 text-sm text-gray-600">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center">
                      <svg
                        className="w-4 h-4 text-green-500 mr-2 flex-shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
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
              </div>
              
              {selectedPlan === plan.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute inset-0 border-2 border-blue-500 rounded-lg pointer-events-none"
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {selectedPlan !== currentPlan && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-blue-800">
              {selectedPlan === 'free' 
                ? 'You will be downgraded to the free plan at the end of your current billing cycle.'
                : `You will be ${plans.find(p => p.id === selectedPlan)?.price! > plans.find(p => p.id === currentPlan)?.price! ? 'upgraded' : 'changed'} to the ${plans.find(p => p.id === selectedPlan)?.displayName} plan.`
              }
            </p>
          </div>
        </motion.div>
      )}

      {isLoading && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <span>Updating your plan...</span>
          </div>
        </div>
      )}
    </div>
  );
};