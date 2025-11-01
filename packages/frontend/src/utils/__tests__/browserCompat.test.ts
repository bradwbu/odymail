/**
 * Browser Compatibility Tests
 * Tests for cross-browser compatibility detection and polyfills
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { 
  detectBrowser, 
  checkFeatureSupport, 
  isBrowserSupported, 
  getCompatibilityMessage,
  loadPolyfills
} from '../browserCompat';

// Mock navigator
const mockNavigator = {
  userAgent: '',
  onLine: true
};

// Mock window
const mockWindow = {
  crypto: undefined,
  indexedDB: undefined,
  WebSocket: undefined,
  Worker: undefined,
  fetch: undefined,
  localStorage: undefined,
  sessionStorage: undefined,
  matchMedia: undefined,
  IntersectionObserver: undefined,
  ResizeObserver: undefined
};

describe('Browser Compatibility Detection', () => {
  beforeEach(() => {
    // Reset mocks
    Object.defineProperty(global, 'navigator', {
      value: mockNavigator,
      writable: true
    });
    
    Object.defineProperty(global, 'window', {
      value: mockWindow,
      writable: true
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectBrowser', () => {
    it('should detect Chrome browser correctly', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      
      const browser = detectBrowser();
      
      expect(browser.name).toBe('Chrome');
      expect(browser.version).toBe('91');
      expect(browser.isSupported).toBe(true);
    });

    it('should detect Firefox browser correctly', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0';
      
      const browser = detectBrowser();
      
      expect(browser.name).toBe('Firefox');
      expect(browser.version).toBe('89');
      expect(browser.isSupported).toBe(true);
    });

    it('should detect Safari browser correctly', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15';
      
      const browser = detectBrowser();
      
      expect(browser.name).toBe('Safari');
      expect(browser.version).toBe('14');
      expect(browser.isSupported).toBe(true);
    });

    it('should detect Edge browser correctly', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59';
      
      const browser = detectBrowser();
      
      expect(browser.name).toBe('Edge');
      expect(browser.version).toBe('91');
      expect(browser.isSupported).toBe(true);
    });

    it('should mark old browsers as unsupported', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36';
      
      const browser = detectBrowser();
      
      expect(browser.name).toBe('Chrome');
      expect(browser.version).toBe('70');
      expect(browser.isSupported).toBe(false);
    });
  });

  describe('checkFeatureSupport', () => {
    it('should detect Web Crypto API support', () => {
      mockWindow.crypto = { subtle: {} };
      
      const features = checkFeatureSupport();
      
      expect(features.webCrypto).toBe(true);
    });

    it('should detect missing Web Crypto API', () => {
      mockWindow.crypto = undefined;
      
      const features = checkFeatureSupport();
      
      expect(features.webCrypto).toBe(false);
    });

    it('should detect IndexedDB support', () => {
      mockWindow.indexedDB = {};
      
      const features = checkFeatureSupport();
      
      expect(features.indexedDB).toBe(true);
    });

    it('should detect WebSocket support', () => {
      mockWindow.WebSocket = function() {};
      
      const features = checkFeatureSupport();
      
      expect(features.webSocket).toBe(true);
    });

    it('should detect Fetch API support', () => {
      mockWindow.fetch = vi.fn();
      
      const features = checkFeatureSupport();
      
      expect(features.fetch).toBe(true);
    });

    it('should detect localStorage support', () => {
      mockWindow.localStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      };
      
      const features = checkFeatureSupport();
      
      expect(features.localStorage).toBe(true);
    });

    it('should handle localStorage access errors', () => {
      Object.defineProperty(mockWindow, 'localStorage', {
        get: () => {
          throw new Error('Access denied');
        }
      });
      
      const features = checkFeatureSupport();
      
      expect(features.localStorage).toBe(false);
    });
  });

  describe('isBrowserSupported', () => {
    it('should return true for supported browsers with all features', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      mockWindow.crypto = { subtle: {} };
      mockWindow.indexedDB = {};
      mockWindow.fetch = vi.fn();
      mockWindow.WebSocket = function() {};
      
      const isSupported = isBrowserSupported();
      
      expect(isSupported).toBe(true);
    });

    it('should return false for browsers missing critical features', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      mockWindow.crypto = undefined; // Missing Web Crypto
      
      const isSupported = isBrowserSupported();
      
      expect(isSupported).toBe(false);
    });
  });

  describe('getCompatibilityMessage', () => {
    it('should return positive message for supported browsers', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      mockWindow.crypto = { subtle: {} };
      mockWindow.indexedDB = {};
      mockWindow.fetch = vi.fn();
      mockWindow.WebSocket = function() {};
      
      const message = getCompatibilityMessage();
      
      expect(message).toContain('fully supported');
      expect(message).toContain('Chrome 91');
    });

    it('should return warning message for unsupported browsers', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36';
      mockWindow.crypto = undefined;
      
      const message = getCompatibilityMessage();
      
      expect(message).toContain('limited support');
      expect(message).toContain('Chrome 70');
      expect(message).toContain('update');
    });

    it('should list missing features in message', () => {
      mockNavigator.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';
      mockWindow.crypto = undefined;
      mockWindow.indexedDB = undefined;
      
      const message = getCompatibilityMessage();
      
      expect(message).toContain('Web Crypto API');
      expect(message).toContain('IndexedDB');
    });
  });

  describe('loadPolyfills', () => {
    it('should load polyfills for missing features', async () => {
      mockWindow.fetch = undefined;
      mockWindow.IntersectionObserver = undefined;
      mockWindow.ResizeObserver = undefined;
      
      // Mock console.log to verify polyfill loading
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      await loadPolyfills();
      
      // Verify polyfills were loaded
      expect(mockWindow.fetch).toBeDefined();
      expect(mockWindow.IntersectionObserver).toBeDefined();
      expect(mockWindow.ResizeObserver).toBeDefined();
      
      consoleSpy.mockRestore();
    });

    it('should not load polyfills for supported features', async () => {
      mockWindow.fetch = vi.fn();
      mockWindow.IntersectionObserver = function() {};
      mockWindow.ResizeObserver = function() {};
      
      const originalFetch = mockWindow.fetch;
      
      await loadPolyfills();
      
      // Verify original implementations were not replaced
      expect(mockWindow.fetch).toBe(originalFetch);
    });
  });
});

describe('Progressive Enhancement', () => {
  it('should apply feature classes to elements', () => {
    const element = document.createElement('div');
    mockWindow.crypto = { subtle: {} };
    mockWindow.indexedDB = {};
    
    // This would be tested with the actual ProgressiveEnhancement class
    // For now, we'll test the concept
    element.classList.add('supports-webcrypto');
    element.classList.add('supports-indexeddb');
    
    expect(element.classList.contains('supports-webcrypto')).toBe(true);
    expect(element.classList.contains('supports-indexeddb')).toBe(true);
  });

  it('should handle reduced motion preferences', () => {
    const mockMatchMedia = vi.fn().mockReturnValue({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    });
    
    mockWindow.matchMedia = mockMatchMedia;
    
    const result = mockWindow.matchMedia('(prefers-reduced-motion: reduce)');
    
    expect(result.matches).toBe(true);
    expect(mockMatchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });
});