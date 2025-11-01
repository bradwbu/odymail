/**
 * Browser compatibility detection and utilities
 * Provides feature detection and polyfill loading for cross-browser support
 */

export interface BrowserInfo {
  name: string;
  version: string;
  isSupported: boolean;
  missingFeatures: string[];
}

export interface FeatureSupport {
  webCrypto: boolean;
  indexedDB: boolean;
  webSocket: boolean;
  serviceWorker: boolean;
  webWorkers: boolean;
  es6Modules: boolean;
  fetch: boolean;
  localStorage: boolean;
  sessionStorage: boolean;
  mediaQuery: boolean;
  intersectionObserver: boolean;
  resizeObserver: boolean;
}

/**
 * Detect current browser and version
 */
export function detectBrowser(): BrowserInfo {
  const userAgent = navigator.userAgent;
  let name = 'Unknown';
  let version = 'Unknown';
  let isSupported = false;
  const missingFeatures: string[] = [];

  // Chrome
  if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
    name = 'Chrome';
    const match = userAgent.match(/Chrome\/(\d+)/);
    version = match ? match[1] : 'Unknown';
    isSupported = parseInt(version) >= 80; // Chrome 80+ for good Web Crypto support
  }
  // Firefox
  else if (userAgent.includes('Firefox')) {
    name = 'Firefox';
    const match = userAgent.match(/Firefox\/(\d+)/);
    version = match ? match[1] : 'Unknown';
    isSupported = parseInt(version) >= 75; // Firefox 75+ for good Web Crypto support
  }
  // Safari
  else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    name = 'Safari';
    const match = userAgent.match(/Version\/(\d+)/);
    version = match ? match[1] : 'Unknown';
    isSupported = parseInt(version) >= 13; // Safari 13+ for good Web Crypto support
  }
  // Edge
  else if (userAgent.includes('Edg')) {
    name = 'Edge';
    const match = userAgent.match(/Edg\/(\d+)/);
    version = match ? match[1] : 'Unknown';
    isSupported = parseInt(version) >= 80; // Edge 80+ (Chromium-based)
  }

  // Check for missing critical features
  const features = checkFeatureSupport();
  if (!features.webCrypto) missingFeatures.push('Web Crypto API');
  if (!features.indexedDB) missingFeatures.push('IndexedDB');
  if (!features.fetch) missingFeatures.push('Fetch API');
  if (!features.webSocket) missingFeatures.push('WebSocket');

  // Mark as unsupported if critical features are missing
  if (missingFeatures.length > 0) {
    isSupported = false;
  }

  return {
    name,
    version,
    isSupported,
    missingFeatures
  };
}

/**
 * Check support for various web features
 */
export function checkFeatureSupport(): FeatureSupport {
  return {
    webCrypto: !!(window.crypto && window.crypto.subtle),
    indexedDB: !!window.indexedDB,
    webSocket: !!window.WebSocket,
    serviceWorker: 'serviceWorker' in navigator,
    webWorkers: !!window.Worker,
    es6Modules: 'noModule' in HTMLScriptElement.prototype,
    fetch: !!window.fetch,
    localStorage: (() => {
      try {
        return !!window.localStorage;
      } catch {
        return false;
      }
    })(),
    sessionStorage: (() => {
      try {
        return !!window.sessionStorage;
      } catch {
        return false;
      }
    })(),
    mediaQuery: !!window.matchMedia,
    intersectionObserver: !!window.IntersectionObserver,
    resizeObserver: !!window.ResizeObserver
  };
}

/**
 * Load polyfills for missing features
 */
export async function loadPolyfills(): Promise<void> {
  const features = checkFeatureSupport();
  const polyfillsToLoad: Promise<void>[] = [];

  // Fetch polyfill
  if (!features.fetch) {
    polyfillsToLoad.push(
      loadFetchPolyfill()
    );
  }

  // IntersectionObserver polyfill
  if (!features.intersectionObserver) {
    polyfillsToLoad.push(
      loadIntersectionObserverPolyfill()
    );
  }

  // ResizeObserver polyfill
  if (!features.resizeObserver) {
    polyfillsToLoad.push(
      loadResizeObserverPolyfill()
    );
  }

  // Web Crypto polyfill (limited support)
  if (!features.webCrypto) {
    console.warn('Web Crypto API not supported. Some features may not work.');
    // Note: Full Web Crypto polyfill is complex and not recommended for production
    // Instead, we'll show a compatibility warning to the user
  }

  await Promise.all(polyfillsToLoad);
}

/**
 * Load IntersectionObserver polyfill
 */
async function loadIntersectionObserverPolyfill(): Promise<void> {
  try {
    // Create a simple polyfill for basic functionality
    if (!window.IntersectionObserver) {
      (window as any).IntersectionObserver = class {
        private callback: IntersectionObserverCallback;

        constructor(callback: IntersectionObserverCallback, _options: IntersectionObserverInit = {}) {
          this.callback = callback;
        }

        observe(target: Element): void {
          // Simple fallback: immediately call callback with isIntersecting: true
          setTimeout(() => {
            this.callback([{
              target,
              isIntersecting: true,
              intersectionRatio: 1,
              boundingClientRect: target.getBoundingClientRect(),
              intersectionRect: target.getBoundingClientRect(),
              rootBounds: null,
              time: Date.now()
            } as IntersectionObserverEntry], this as any);
          }, 0);
        }

        unobserve(_target: Element): void {
          // No-op in polyfill
        }

        disconnect(): void {
          // No-op in polyfill
        }

        get root() { return null; }
        get rootMargin() { return '0px'; }
        get thresholds() { return [0]; }
        takeRecords() { return []; }
      };
      console.log('IntersectionObserver polyfill loaded');
    }
  } catch (err) {
    console.warn('Failed to load IntersectionObserver polyfill:', err);
  }
}

/**
 * Load Fetch polyfill
 */
async function loadFetchPolyfill(): Promise<void> {
  try {
    if (!window.fetch) {
      // Simple fetch polyfill for basic functionality
      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        return new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          const url = typeof input === 'string' ? input : input.toString();
          
          xhr.open(init?.method || 'GET', url);
          
          // Set headers
          if (init?.headers) {
            const headers = init.headers as Record<string, string>;
            Object.entries(headers).forEach(([key, value]) => {
              xhr.setRequestHeader(key, value);
            });
          }
          
          xhr.onload = () => {
            resolve({
              ok: xhr.status >= 200 && xhr.status < 300,
              status: xhr.status,
              statusText: xhr.statusText,
              text: () => Promise.resolve(xhr.responseText),
              json: () => Promise.resolve(JSON.parse(xhr.responseText)),
            } as Response);
          };
          
          xhr.onerror = () => reject(new Error('Network error'));
          xhr.send(init?.body);
        });
      };
      console.log('Fetch polyfill loaded');
    }
  } catch (err) {
    console.warn('Failed to load fetch polyfill:', err);
  }
}

/**
 * Load ResizeObserver polyfill
 */
async function loadResizeObserverPolyfill(): Promise<void> {
  try {
    if (!window.ResizeObserver) {
      (window as any).ResizeObserver = class {
        private callback: ResizeObserverCallback;

        constructor(callback: ResizeObserverCallback) {
          this.callback = callback;
        }

        observe(target: Element): void {
          // Simple fallback using window resize event
          const handleResize = () => {
            const rect = target.getBoundingClientRect();
            this.callback([{
              target,
              contentRect: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                left: rect.left,
                toJSON: () => rect
              } as DOMRectReadOnly,
              borderBoxSize: [{
                blockSize: rect.height,
                inlineSize: rect.width
              }] as ResizeObserverSize[],
              contentBoxSize: [{
                blockSize: rect.height,
                inlineSize: rect.width
              }] as ResizeObserverSize[],
              devicePixelContentBoxSize: [{
                blockSize: rect.height,
                inlineSize: rect.width
              }] as ResizeObserverSize[]
            } as ResizeObserverEntry], this as any);
          };

          window.addEventListener('resize', handleResize);
          // Initial call
          setTimeout(handleResize, 0);
        }

        unobserve(_target: Element): void {
          // No-op in simple polyfill
        }

        disconnect(): void {
          // No-op in simple polyfill
        }
      };
      console.log('ResizeObserver polyfill loaded');
    }
  } catch (err) {
    console.warn('Failed to load ResizeObserver polyfill:', err);
  }
}

/**
 * Check if the current browser is supported
 */
export function isBrowserSupported(): boolean {
  const browser = detectBrowser();
  return browser.isSupported;
}

/**
 * Get a user-friendly browser compatibility message
 */
export function getCompatibilityMessage(): string {
  const browser = detectBrowser();
  
  if (browser.isSupported) {
    return `Your browser (${browser.name} ${browser.version}) is fully supported.`;
  }

  let message = `Your browser (${browser.name} ${browser.version}) has limited support. `;
  
  if (browser.missingFeatures.length > 0) {
    message += `Missing features: ${browser.missingFeatures.join(', ')}. `;
  }

  message += 'Please update to a newer version or use a modern browser like Chrome 80+, Firefox 75+, Safari 13+, or Edge 80+.';
  
  return message;
}

/**
 * Progressive enhancement utilities
 */
export class ProgressiveEnhancement {
  /**
   * Enhance element with modern features if supported
   */
  static enhanceElement(element: HTMLElement, enhancements: {
    intersectionObserver?: (entries: IntersectionObserverEntry[]) => void;
    resizeObserver?: (entries: ResizeObserverEntry[]) => void;
  }): void {
    const features = checkFeatureSupport();

    // Add intersection observer if supported and requested
    if (features.intersectionObserver && enhancements.intersectionObserver) {
      const observer = new IntersectionObserver(enhancements.intersectionObserver, {
        threshold: 0.1
      });
      observer.observe(element);
    }

    // Add resize observer if supported and requested
    if (features.resizeObserver && enhancements.resizeObserver) {
      const observer = new ResizeObserver(enhancements.resizeObserver);
      observer.observe(element);
    }
  }

  /**
   * Conditionally apply CSS classes based on feature support
   */
  static applyFeatureClasses(element: HTMLElement): void {
    const features = checkFeatureSupport();
    
    // Add classes for supported features
    if (features.webCrypto) element.classList.add('supports-webcrypto');
    if (features.indexedDB) element.classList.add('supports-indexeddb');
    if (features.webSocket) element.classList.add('supports-websocket');
    if (features.serviceWorker) element.classList.add('supports-serviceworker');
    if (features.intersectionObserver) element.classList.add('supports-intersection-observer');
    if (features.resizeObserver) element.classList.add('supports-resize-observer');
    
    // Add browser-specific classes
    const browser = detectBrowser();
    element.classList.add(`browser-${browser.name.toLowerCase()}`);
    element.classList.add(`browser-version-${browser.version}`);
    
    if (browser.isSupported) {
      element.classList.add('browser-supported');
    } else {
      element.classList.add('browser-unsupported');
    }
  }
}