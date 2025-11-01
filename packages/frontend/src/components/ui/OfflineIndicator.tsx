/**
 * Offline Indicator Component
 * Shows connection status and sync information
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../theme';
import offlineService, { OfflineStatus } from '../../services/offlineService';

interface OfflineIndicatorProps {
  position?: 'top' | 'bottom';
  showWhenOnline?: boolean;
}

export const OfflineIndicator: React.FC<OfflineIndicatorProps> = ({
  position = 'bottom',
  showWhenOnline = false
}) => {
  const { theme } = useTheme();
  const [status, setStatus] = useState<OfflineStatus>(offlineService.getStatus());
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const unsubscribe = offlineService.onStatusChange(setStatus);
    return unsubscribe;
  }, []);

  const shouldShow = !status.isOnline || (showWhenOnline && status.hasPendingSync);

  if (!shouldShow) return null;

  const getStatusColor = () => {
    if (!status.isOnline) return theme.colors.semantic.error[500];
    if (status.syncInProgress) return theme.colors.semantic.warning[500];
    if (status.hasPendingSync) return theme.colors.semantic.warning[400];
    return theme.colors.semantic.success[500];
  };

  const getStatusText = () => {
    if (!status.isOnline) return 'Offline';
    if (status.syncInProgress) return 'Syncing...';
    if (status.hasPendingSync) return 'Pending sync';
    return 'Online';
  };

  const getStatusIcon = () => {
    if (!status.isOnline) return '📡';
    if (status.syncInProgress) return '🔄';
    if (status.hasPendingSync) return '⏳';
    return '✅';
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: position === 'bottom' ? 50 : -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: position === 'bottom' ? 50 : -50 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'fixed',
          [position]: theme.spacing[4],
          right: theme.spacing[4],
          zIndex: 1000,
          backgroundColor: theme.colors.surface.elevated,
          border: `1px solid ${theme.colors.border.primary}`,
          borderRadius: theme.borderRadius.lg,
          boxShadow: theme.shadows.lg,
          padding: theme.spacing[3],
          minWidth: '200px',
          cursor: 'pointer'
        }}
        onClick={() => setShowDetails(!showDetails)}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing[2]
        }}>
          <div style={{
            fontSize: '1.2rem',
            animation: status.syncInProgress ? 'spin 1s linear infinite' : 'none'
          }}>
            {getStatusIcon()}
          </div>
          
          <div style={{ flex: 1 }}>
            <div style={{
              fontWeight: 600,
              fontSize: theme.typography.fontSize.sm,
              color: getStatusColor()
            }}>
              {getStatusText()}
            </div>
            
            {status.hasPendingSync && (
              <div style={{
                fontSize: theme.typography.fontSize.xs,
                color: theme.colors.text.secondary,
                marginTop: theme.spacing[0.5]
              }}>
                Changes will sync when online
              </div>
            )}
          </div>

          <motion.div
            animate={{ rotate: showDetails ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            style={{
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.text.tertiary
            }}
          >
            ▼
          </motion.div>
        </div>

        <AnimatePresence>
          {showDetails && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                marginTop: theme.spacing[3],
                paddingTop: theme.spacing[3],
                borderTop: `1px solid ${theme.colors.border.secondary}`,
                overflow: 'hidden'
              }}
            >
              <div style={{
                display: 'grid',
                gap: theme.spacing[2],
                fontSize: theme.typography.fontSize.xs
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ color: theme.colors.text.secondary }}>
                    Service Worker:
                  </span>
                  <span style={{
                    color: status.isServiceWorkerReady 
                      ? theme.colors.semantic.success[600]
                      : theme.colors.semantic.error[600]
                  }}>
                    {status.isServiceWorkerReady ? 'Ready' : 'Not Ready'}
                  </span>
                </div>

                {status.lastSyncTime && (
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between'
                  }}>
                    <span style={{ color: theme.colors.text.secondary }}>
                      Last Sync:
                    </span>
                    <span style={{ color: theme.colors.text.primary }}>
                      {new Date(status.lastSyncTime).toLocaleTimeString()}
                    </span>
                  </div>
                )}

                {!status.isOnline && (
                  <div style={{
                    marginTop: theme.spacing[2],
                    padding: theme.spacing[2],
                    backgroundColor: theme.colors.semantic.warning[50],
                    borderRadius: theme.borderRadius.md,
                    fontSize: theme.typography.fontSize.xs,
                    color: theme.colors.semantic.warning[700]
                  }}>
                    You're working offline. Changes will be saved locally and synced when you're back online.
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </AnimatePresence>
  );
};