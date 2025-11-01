/**
 * Progressive enhancement hook
 * Provides utilities for graceful feature degradation and enhancement
 */

import { useEffect, useRef, useState } from 'react';
import { checkFeatureSupport, ProgressiveEnhancement, type FeatureSupport } from '../utils/browserCompat';

interface ProgressiveEnhancementOptions {
  fallbackDelay?: number;
  enableIntersectionObserver?: boolean;
  enableResizeObserver?: boolean;
  enableAnimations?: boolean;
}

/**
 * Hook for progressive enhancement with feature detection
 */
export const useProgressiveEnhancement = (options: ProgressiveEnhancementOptions = {}) => {
  const {
    fallbackDelay = 100,
    enableIntersectionObserver = true,
    enableResizeObserver = true,
    enableAnimations = true
  } = options;

  const [features, setFeatures] = useState<FeatureSupport | null>(null);
  const [isEnhanced, setIsEnhanced] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);

  // Check feature support on mount
  useEffect(() => {
    const supportedFeatures = checkFeatureSupport();
    setFeatures(supportedFeatures);
    
    // Apply progressive enhancement after a short delay
    const timer = setTimeout(() => {
      setIsEnhanced(true);
    }, fallbackDelay);

    return () => clearTimeout(timer);
  }, [fallbackDelay]);

  // Apply enhancements to element
  const enhanceElement = (element: HTMLElement | null) => {
    if (!element || !features) return;

    elementRef.current = element;

    // Apply feature classes
    ProgressiveEnhancement.applyFeatureClasses(element);

    // Set up observers if supported and enabled
    const enhancements: Parameters<typeof ProgressiveEnhancement.enhanceElement>[1] = {};

    if (enableIntersectionObserver && features.intersectionObserver) {
      enhancements.intersectionObserver = (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in-viewport');
          } else {
            entry.target.classList.remove('in-viewport');
          }
        });
      };
    }

    if (enableResizeObserver && features.resizeObserver) {
      enhancements.resizeObserver = (entries) => {
        entries.forEach(entry => {
          const { width, height } = entry.contentRect;
          entry.target.setAttribute('data-width', width.toString());
          entry.target.setAttribute('data-height', height.toString());
          
          // Add responsive classes
          if (width < 768) {
            entry.target.classList.add('mobile-size');
            entry.target.classList.remove('desktop-size');
          } else {
            entry.target.classList.add('desktop-size');
            entry.target.classList.remove('mobile-size');
          }
        });
      };
    }

    ProgressiveEnhancement.enhanceElement(element, enhancements);
  };

  return {
    features,
    isEnhanced,
    enhanceElement,
    // Feature-specific utilities
    supportsFeature: (feature: keyof FeatureSupport) => features?.[feature] ?? false,
    shouldUseAnimations: enableAnimations && (features?.intersectionObserver ?? false),
    shouldUseLazyLoading: features?.intersectionObserver ?? false,
    shouldUseAdvancedCrypto: features?.webCrypto ?? false,
    shouldUseOfflineFeatures: features?.serviceWorker ?? false,
  };
};

/**
 * Hook for conditional feature loading
 */
export const useConditionalFeature = <T>(
  featureCheck: (features: FeatureSupport) => boolean,
  loader: () => Promise<T>,
  fallback?: T
) => {
  const [feature, setFeature] = useState<T | null>(fallback ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const features = checkFeatureSupport();
    
    if (featureCheck(features)) {
      setIsLoading(true);
      loader()
        .then(setFeature)
        .catch(setError)
        .finally(() => setIsLoading(false));
    } else if (fallback) {
      setFeature(fallback);
    }
  }, []);

  return { feature, isLoading, error };
};

/**
 * Hook for graceful animation degradation
 */
export const useAnimationSupport = () => {
  const [shouldAnimate, setShouldAnimate] = useState(true);

  useEffect(() => {
    // Check for reduced motion preference
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setShouldAnimate(!mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setShouldAnimate(!e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return {
    shouldAnimate,
    getAnimationProps: (animationProps: object, fallbackProps: object = {}) => {
      return shouldAnimate ? animationProps : fallbackProps;
    },
    conditionalAnimation: (animation: object) => {
      return shouldAnimate ? animation : {};
    }
  };
};

/**
 * Hook for storage fallbacks
 */
export const useStorageWithFallback = (storageType: 'localStorage' | 'sessionStorage' = 'localStorage') => {
  const [isSupported, setIsSupported] = useState(false);
  const fallbackStorage = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const features = checkFeatureSupport();
    setIsSupported(storageType === 'localStorage' ? features.localStorage : features.sessionStorage);
  }, [storageType]);

  const getItem = (key: string): string | null => {
    if (isSupported) {
      try {
        return window[storageType].getItem(key);
      } catch {
        // Fall through to fallback
      }
    }
    return fallbackStorage.current.get(key) ?? null;
  };

  const setItem = (key: string, value: string): void => {
    if (isSupported) {
      try {
        window[storageType].setItem(key, value);
        return;
      } catch {
        // Fall through to fallback
      }
    }
    fallbackStorage.current.set(key, value);
  };

  const removeItem = (key: string): void => {
    if (isSupported) {
      try {
        window[storageType].removeItem(key);
        return;
      } catch {
        // Fall through to fallback
      }
    }
    fallbackStorage.current.delete(key);
  };

  const clear = (): void => {
    if (isSupported) {
      try {
        window[storageType].clear();
        return;
      } catch {
        // Fall through to fallback
      }
    }
    fallbackStorage.current.clear();
  };

  return {
    isSupported,
    getItem,
    setItem,
    removeItem,
    clear
  };
};