/**
 * Browser compatibility initialization
 * Sets up polyfills and compatibility features on app startup
 */

import { loadPolyfills, detectBrowser, checkFeatureSupport, ProgressiveEnhancement } from './browserCompat';

/**
 * Initialize browser compatibility features
 */
export async function initBrowserCompatibility(): Promise<void> {
  console.log('Initializing browser compatibility...');
  
  // Detect browser and log info
  const browser = detectBrowser();
  console.log(`Browser detected: ${browser.name} ${browser.version} (Supported: ${browser.isSupported})`);
  
  if (browser.missingFeatures.length > 0) {
    console.warn('Missing features:', browser.missingFeatures);
  }

  // Load polyfills for missing features
  try {
    await loadPolyfills();
    console.log('Polyfills loaded successfully');
  } catch (error) {
    console.error('Failed to load some polyfills:', error);
  }

  // Apply feature classes to document body
  ProgressiveEnhancement.applyFeatureClasses(document.body);

  // Set up global error handling for unsupported features
  setupGlobalErrorHandling();

  // Add CSS custom properties for feature detection
  addFeatureDetectionCSS();

  console.log('Browser compatibility initialization complete');
}

/**
 * Set up global error handling for compatibility issues
 */
function setupGlobalErrorHandling(): void {
  // Handle Web Crypto API errors gracefully
  const originalSubtle = window.crypto?.subtle;
  if (originalSubtle) {
    const wrapCryptoMethod = (methodName: keyof SubtleCrypto) => {
      const originalMethod = originalSubtle[methodName] as any;
      if (typeof originalMethod === 'function') {
        (originalSubtle as any)[methodName] = async (...args: any[]) => {
          try {
            return await originalMethod.apply(originalSubtle, args);
          } catch (error) {
            console.error(`Web Crypto ${methodName} error:`, error);
            throw new Error(`Cryptographic operation failed. Your browser may not fully support this feature.`);
          }
        };
      }
    };

    // Wrap critical crypto methods
    wrapCryptoMethod('generateKey');
    wrapCryptoMethod('encrypt');
    wrapCryptoMethod('decrypt');
    wrapCryptoMethod('sign');
    wrapCryptoMethod('verify');
    wrapCryptoMethod('deriveKey');
  }

  // Handle storage errors gracefully
  const wrapStorageMethod = (storage: Storage, methodName: keyof Storage) => {
    const originalMethod = storage[methodName] as any;
    if (typeof originalMethod === 'function') {
      (storage as any)[methodName] = (...args: any[]) => {
        try {
          return originalMethod.apply(storage, args);
        } catch (error) {
          console.warn(`Storage ${methodName} error:`, error);
          // Return null for getItem, undefined for others
          return methodName === 'getItem' ? null : undefined;
        }
      };
    }
  };

  // Wrap localStorage and sessionStorage methods
  if (window.localStorage) {
    wrapStorageMethod(window.localStorage, 'getItem');
    wrapStorageMethod(window.localStorage, 'setItem');
    wrapStorageMethod(window.localStorage, 'removeItem');
  }

  if (window.sessionStorage) {
    wrapStorageMethod(window.sessionStorage, 'getItem');
    wrapStorageMethod(window.sessionStorage, 'setItem');
    wrapStorageMethod(window.sessionStorage, 'removeItem');
  }
}

/**
 * Add CSS custom properties for feature detection
 */
function addFeatureDetectionCSS(): void {
  const features = checkFeatureSupport();
  const root = document.documentElement;

  // Set CSS custom properties for feature support
  root.style.setProperty('--supports-webcrypto', features.webCrypto ? '1' : '0');
  root.style.setProperty('--supports-indexeddb', features.indexedDB ? '1' : '0');
  root.style.setProperty('--supports-websocket', features.webSocket ? '1' : '0');
  root.style.setProperty('--supports-serviceworker', features.serviceWorker ? '1' : '0');
  root.style.setProperty('--supports-intersection-observer', features.intersectionObserver ? '1' : '0');
  root.style.setProperty('--supports-resize-observer', features.resizeObserver ? '1' : '0');

  // Add browser-specific CSS custom properties
  const browser = detectBrowser();
  root.style.setProperty('--browser-name', `"${browser.name.toLowerCase()}"`);
  root.style.setProperty('--browser-version', browser.version);
  root.style.setProperty('--browser-supported', browser.isSupported ? '1' : '0');

  // Add reduced motion support
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  root.style.setProperty('--prefers-reduced-motion', prefersReducedMotion ? '1' : '0');

  // Listen for reduced motion changes
  const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handleMotionChange = (e: MediaQueryListEvent) => {
    root.style.setProperty('--prefers-reduced-motion', e.matches ? '1' : '0');
  };
  
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleMotionChange);
  } else {
    // Fallback for older browsers
    (mediaQuery as any).addListener(handleMotionChange);
  }
}

/**
 * Check if critical features are available
 */
export function checkCriticalFeatures(): { isSupported: boolean; missingFeatures: string[] } {
  const features = checkFeatureSupport();
  const missingFeatures: string[] = [];

  // Critical features for the encrypted email service
  if (!features.webCrypto) missingFeatures.push('Web Crypto API');
  if (!features.fetch) missingFeatures.push('Fetch API');
  if (!features.localStorage) missingFeatures.push('Local Storage');

  return {
    isSupported: missingFeatures.length === 0,
    missingFeatures
  };
}

/**
 * Show compatibility warning if needed
 */
export function showCompatibilityWarningIfNeeded(): boolean {
  const { isSupported } = checkCriticalFeatures();
  
  if (!isSupported) {
    // Create and show a simple warning banner
    const warning = document.createElement('div');
    warning.id = 'browser-compatibility-warning';
    warning.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 9999;
      background-color: #dc3545;
      color: white;
      padding: 12px;
      text-align: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      line-height: 1.4;
    `;
    
    const browser = detectBrowser();
    warning.innerHTML = `
      <strong>Unsupported Browser:</strong> 
      ${browser.name} ${browser.version} is not fully supported. 
      Please update to a modern browser for the best experience.
      <button onclick="this.parentElement.remove()" style="
        background: rgba(255,255,255,0.2);
        border: 1px solid rgba(255,255,255,0.3);
        color: white;
        padding: 4px 8px;
        margin-left: 12px;
        border-radius: 4px;
        cursor: pointer;
      ">Dismiss</button>
    `;
    
    document.body.insertBefore(warning, document.body.firstChild);
    return true;
  }
  
  return false;
}