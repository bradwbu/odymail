/**
 * Browser compatibility warning component
 * Shows warnings for unsupported browsers or missing features
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../theme';
import { detectBrowser, getCompatibilityMessage, isBrowserSupported } from '../../utils/browserCompat';

interface BrowserCompatibilityWarningProps {
  onDismiss?: () => void;
  showOnlyForUnsupported?: boolean;
}

export const BrowserCompatibilityWarning: React.FC<BrowserCompatibilityWarningProps> = ({
  onDismiss,
  showOnlyForUnsupported = true
}) => {
  const { theme } = useTheme();
  const [isVisible, setIsVisible] = useState(false);
  const [browserInfo, setBrowserInfo] = useState(detectBrowser());
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const browser = detectBrowser();
    setBrowserInfo(browser);

    // Check if user has previously dismissed the warning
    const dismissedKey = `browser-warning-dismissed-${browser.name}-${browser.version}`;
    const wasDismissed = localStorage.getItem(dismissedKey) === 'true';
    
    if (wasDismissed) {
      setIsDismissed(true);
      return;
    }

    // Show warning if browser is unsupported or if we should show for all browsers
    if (!showOnlyForUnsupported || !browser.isSupported) {
      setIsVisible(true);
    }
  }, [showOnlyForUnsupported]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    
    // Remember dismissal in localStorage
    const dismissedKey = `browser-warning-dismissed-${browserInfo.name}-${browserInfo.version}`;
    localStorage.setItem(dismissedKey, 'true');
    
    onDismiss?.();
  };

  if (isDismissed || !isVisible) {
    return null;
  }

  const isSupported = isBrowserSupported();
  const message = getCompatibilityMessage();

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -50 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          backgroundColor: isSupported ? theme.colors.semantic.warning[500] : theme.colors.semantic.error[500],
          color: theme.colors.text.inverse,
          padding: theme.spacing[4],
          boxShadow: theme.shadows.md,
          borderBottom: `1px solid ${isSupported ? theme.colors.semantic.warning[600] : theme.colors.semantic.error[600]}`,
        }}
      >
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.spacing[4],
          flexWrap: 'wrap',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing[2],
            flex: 1,
          }}>
            <div style={{
              fontSize: '1.2rem',
              flexShrink: 0,
            }}>
              {isSupported ? '⚠️' : '❌'}
            </div>
            
            <div style={{
              flex: 1,
            }}>
              <div style={{
                fontWeight: 600,
                marginBottom: theme.spacing[1],
                fontSize: theme.typography.fontSize.sm,
              }}>
                {isSupported ? 'Browser Compatibility Notice' : 'Unsupported Browser'}
              </div>
              
              <div style={{
                fontSize: theme.typography.fontSize.sm,
                opacity: 0.9,
                lineHeight: 1.4,
              }}>
                {message}
              </div>
              
              {browserInfo.missingFeatures.length > 0 && (
                <div style={{
                  marginTop: theme.spacing[1],
                  fontSize: theme.typography.fontSize.xs,
                  opacity: 0.8,
                }}>
                  Some features may not work properly without: {browserInfo.missingFeatures.join(', ')}
                </div>
              )}
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: theme.spacing[2],
            alignItems: 'center',
            flexShrink: 0,
          }}>
            {!isSupported && (
              <motion.a
                href="https://browsehappy.com/"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.2)',
                  color: theme.colors.text.inverse,
                  padding: `${theme.spacing[1]} ${theme.spacing[2]}`,
                  borderRadius: theme.borderRadius.sm,
                  textDecoration: 'none',
                  fontSize: theme.typography.fontSize.sm,
                  fontWeight: 500,
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  transition: 'all 0.2s ease',
                }}
              >
                Update Browser
              </motion.a>
            )}
            
            <motion.button
              onClick={handleDismiss}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: theme.colors.text.inverse,
                fontSize: '1.2rem',
                cursor: 'pointer',
                padding: theme.spacing[1],
                borderRadius: theme.borderRadius.sm,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0.8,
                transition: 'opacity 0.2s ease',
              }}
              aria-label="Dismiss browser compatibility warning"
            >
              ✕
            </motion.button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

/**
 * Hook to check browser compatibility and provide utilities
 */
export const useBrowserCompatibility = () => {
  const [browserInfo, setBrowserInfo] = useState(detectBrowser());
  const [isSupported, setIsSupported] = useState(isBrowserSupported());

  useEffect(() => {
    const browser = detectBrowser();
    setBrowserInfo(browser);
    setIsSupported(browser.isSupported);
  }, []);

  return {
    browserInfo,
    isSupported,
    message: getCompatibilityMessage(),
    checkFeature: (feature: keyof import('../../utils/browserCompat').FeatureSupport) => {
      const { checkFeatureSupport } = require('../../utils/browserCompat');
      return checkFeatureSupport()[feature];
    }
  };
};