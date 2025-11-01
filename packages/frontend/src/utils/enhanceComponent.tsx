/**
 * Component enhancement utilities for progressive enhancement
 * Provides HOCs and utilities to add cross-browser compatibility to components
 */

import React, { useEffect, useRef, ComponentType } from 'react';
import { useProgressiveEnhancement } from '../hooks/useProgressiveEnhancement';
import { useAnimationSupport } from '../hooks/useProgressiveEnhancement';

/**
 * Higher-order component for progressive enhancement
 */
export function withProgressiveEnhancement<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: {
    requiresWebCrypto?: boolean;
    requiresIndexedDB?: boolean;
    requiresWebSocket?: boolean;
    fallbackComponent?: ComponentType<P>;
    enhanceElement?: boolean;
  } = {}
) {
  const {
    requiresWebCrypto = false,
    requiresIndexedDB = false,
    requiresWebSocket = false,
    fallbackComponent: FallbackComponent,
    enhanceElement = true
  } = options;

  return function EnhancedComponent(props: P) {
    const elementRef = useRef<HTMLDivElement>(null);
    const { features, enhanceElement: enhance } = useProgressiveEnhancement();

    useEffect(() => {
      if (enhanceElement && elementRef.current) {
        enhance(elementRef.current);
      }
    }, [enhance, enhanceElement]);

    // Check if required features are available
    const hasRequiredFeatures = 
      (!requiresWebCrypto || features?.webCrypto) &&
      (!requiresIndexedDB || features?.indexedDB) &&
      (!requiresWebSocket || features?.webSocket);

    // Show fallback component if requirements not met
    if (!hasRequiredFeatures && FallbackComponent) {
      return <FallbackComponent {...props} />;
    }

    // Show warning if requirements not met but no fallback
    if (!hasRequiredFeatures) {
      return (
        <div 
          ref={elementRef}
          style={{
            padding: '16px',
            backgroundColor: '#fef3cd',
            border: '1px solid #ffeaa7',
            borderRadius: '8px',
            color: '#856404'
          }}
        >
          <strong>Feature Not Supported:</strong> This component requires modern browser features that are not available.
          Please update your browser for the best experience.
        </div>
      );
    }

    return (
      <div ref={enhanceElement ? elementRef : undefined}>
        <WrappedComponent {...props} />
      </div>
    );
  };
}

/**
 * Higher-order component for animation support
 */
export function withAnimationSupport<P extends object>(
  WrappedComponent: ComponentType<P & { shouldAnimate?: boolean }>
) {
  return function AnimationEnhancedComponent(props: P) {
    const { shouldAnimate, getAnimationProps } = useAnimationSupport();

    return (
      <WrappedComponent 
        {...props} 
        shouldAnimate={shouldAnimate}
        getAnimationProps={getAnimationProps}
      />
    );
  };
}

/**
 * Hook for conditional rendering based on feature support
 */
export function useConditionalRender() {
  const { features } = useProgressiveEnhancement();

  const renderIf = (condition: (features: any) => boolean, component: React.ReactNode) => {
    if (!features) return null;
    return condition(features) ? component : null;
  };

  const renderUnless = (condition: (features: any) => boolean, component: React.ReactNode) => {
    if (!features) return null;
    return !condition(features) ? component : null;
  };

  return { renderIf, renderUnless, features };
}

/**
 * Component for feature-gated content
 */
interface FeatureGateProps {
  requires: {
    webCrypto?: boolean;
    indexedDB?: boolean;
    webSocket?: boolean;
    serviceWorker?: boolean;
    intersectionObserver?: boolean;
    resizeObserver?: boolean;
  };
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const FeatureGate: React.FC<FeatureGateProps> = ({ 
  requires, 
  fallback = null, 
  children 
}) => {
  const { features } = useProgressiveEnhancement();

  if (!features) return null;

  const hasRequiredFeatures = Object.entries(requires).every(([feature, required]) => {
    if (!required) return true;
    return features[feature as keyof typeof features];
  });

  if (!hasRequiredFeatures) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
};

/**
 * Component for browser-specific content
 */
interface BrowserGateProps {
  browsers: string[];
  minVersions?: { [browser: string]: number };
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export const BrowserGate: React.FC<BrowserGateProps> = ({
  browsers,
  minVersions = {},
  fallback = null,
  children
}) => {
  const [isSupported, setIsSupported] = React.useState(false);

  React.useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const supported = browsers.some(browser => {
      const browserName = browser.toLowerCase();
      const hasMinVersion = minVersions[browser];
      
      if (!userAgent.includes(browserName)) return false;
      
      if (hasMinVersion) {
        // Extract version number (simplified)
        const versionMatch = userAgent.match(new RegExp(`${browserName}[/\\s](\\d+)`));
        if (versionMatch) {
          const version = parseInt(versionMatch[1]);
          return version >= hasMinVersion;
        }
        return false;
      }
      
      return true;
    });
    
    setIsSupported(supported);
  }, [browsers, minVersions]);

  return isSupported ? <>{children}</> : <>{fallback}</>;
};

/**
 * Utility component for smooth scrolling fallback
 */
export const SmoothScrollLink: React.FC<{
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}> = ({ href, children, className, onClick }) => {
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    
    // Check if browser supports smooth scrolling
    if (!CSS.supports('scroll-behavior', 'smooth')) {
      e.preventDefault();
      
      const target = document.querySelector(href);
      if (target) {
        // Fallback smooth scroll implementation
        const targetPosition = target.getBoundingClientRect().top + window.pageYOffset;
        const startPosition = window.pageYOffset;
        const distance = targetPosition - startPosition;
        const duration = 800;
        let start: number | null = null;

        function animation(currentTime: number) {
          if (start === null) start = currentTime;
          const timeElapsed = currentTime - start;
          const run = ease(timeElapsed, startPosition, distance, duration);
          window.scrollTo(0, run);
          if (timeElapsed < duration) requestAnimationFrame(animation);
        }

        function ease(t: number, b: number, c: number, d: number) {
          t /= d / 2;
          if (t < 1) return c / 2 * t * t + b;
          t--;
          return -c / 2 * (t * (t - 2) - 1) + b;
        }

        requestAnimationFrame(animation);
      }
    }
  };

  return (
    <a href={href} className={className} onClick={handleClick}>
      {children}
    </a>
  );
};