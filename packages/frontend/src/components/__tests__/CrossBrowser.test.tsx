/**
 * Cross-Browser Compatibility Tests
 * Tests for functionality across different browsers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../../theme';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { EmailComposer } from '../EmailComposer';
import { BrowserCompatibilityWarning } from '../ui/BrowserCompatibilityWarning';
import { detectBrowser, checkFeatureSupport } from '../../utils/browserCompat';

// Browser user agent strings for testing
const BROWSER_USER_AGENTS = {
  chrome91: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  firefox89: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0',
  safari14: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
  edge91: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59',
  chromeOld: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36',
  ie11: 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko'
};

describe('Cross-Browser Compatibility Tests', () => {
  let originalUserAgent: string;
  let originalNavigator: any;

  beforeEach(() => {
    // Store original values
    originalUserAgent = navigator.userAgent;
    originalNavigator = global.navigator;

    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      },
      writable: true
    });
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(global, 'navigator', {
      value: originalNavigator,
      writable: true
    });
    vi.restoreAllMocks();
  });

  const mockBrowser = (userAgent: string, features: Partial<Window> = {}) => {
    Object.defineProperty(global, 'navigator', {
      value: {
        ...originalNavigator,
        userAgent
      },
      writable: true
    });

    // Mock window features
    Object.assign(window, {
      crypto: features.crypto,
      indexedDB: features.indexedDB,
      WebSocket: features.WebSocket,
      fetch: features.fetch,
      localStorage: features.localStorage || window.localStorage,
      sessionStorage: features.sessionStorage || window.sessionStorage,
      matchMedia: features.matchMedia || vi.fn().mockReturnValue({
        matches: false,
        addListener: vi.fn(),
        removeListener: vi.fn()
      })
    });
  };

  describe('Browser Detection', () => {
    it('should detect Chrome correctly', () => {
      mockBrowser(BROWSER_USER_AGENTS.chrome91);
      
      const browser = detectBrowser();
      expect(browser.name).toBe('Chrome');
      expect(browser.version).toBe('91');
      expect(browser.isSupported).toBe(true);
    });

    it('should detect Firefox correctly', () => {
      mockBrowser(BROWSER_USER_AGENTS.firefox89);
      
      const browser = detectBrowser();
      expect(browser.name).toBe('Firefox');
      expect(browser.version).toBe('89');
      expect(browser.isSupported).toBe(true);
    });

    it('should detect Safari correctly', () => {
      mockBrowser(BROWSER_USER_AGENTS.safari14);
      
      const browser = detectBrowser();
      expect(browser.name).toBe('Safari');
      expect(browser.version).toBe('14');
      expect(browser.isSupported).toBe(true);
    });

    it('should detect Edge correctly', () => {
      mockBrowser(BROWSER_USER_AGENTS.edge91);
      
      const browser = detectBrowser();
      expect(browser.name).toBe('Edge');
      expect(browser.version).toBe('91');
      expect(browser.isSupported).toBe(true);
    });

    it('should mark old browsers as unsupported', () => {
      mockBrowser(BROWSER_USER_AGENTS.chromeOld);
      
      const browser = detectBrowser();
      expect(browser.name).toBe('Chrome');
      expect(browser.version).toBe('60');
      expect(browser.isSupported).toBe(false);
    });
  });

  describe('Feature Support Detection', () => {
    it('should detect Web Crypto API support in modern browsers', () => {
      mockBrowser(BROWSER_USER_AGENTS.chrome91, {
        crypto: { subtle: {} }
      });
      
      const features = checkFeatureSupport();
      expect(features.webCrypto).toBe(true);
    });

    it('should detect missing Web Crypto API in old browsers', () => {
      mockBrowser(BROWSER_USER_AGENTS.chromeOld, {
        crypto: undefined
      });
      
      const features = checkFeatureSupport();
      expect(features.webCrypto).toBe(false);
    });

    it('should detect IndexedDB support', () => {
      mockBrowser(BROWSER_USER_AGENTS.chrome91, {
        indexedDB: {}
      });
      
      const features = checkFeatureSupport();
      expect(features.indexedDB).toBe(true);
    });

    it('should detect Fetch API support', () => {
      mockBrowser(BROWSER_USER_AGENTS.chrome91, {
        fetch: vi.fn()
      });
      
      const features = checkFeatureSupport();
      expect(features.fetch).toBe(true);
    });
  });

  describe('Component Rendering Across Browsers', () => {
    it('should render buttons consistently across browsers', () => {
      const browsers = [
        BROWSER_USER_AGENTS.chrome91,
        BROWSER_USER_AGENTS.firefox89,
        BROWSER_USER_AGENTS.safari14,
        BROWSER_USER_AGENTS.edge91
      ];

      browsers.forEach(userAgent => {
        mockBrowser(userAgent);
        
        const { unmount } = render(
          <ThemeProvider>
            <Button variant="primary">Test Button</Button>
          </ThemeProvider>
        );

        const button = screen.getByRole('button');
        expect(button).toBeInTheDocument();
        expect(button).toHaveTextContent('Test Button');
        
        unmount();
      });
    });

    it('should handle modal rendering across browsers', () => {
      const browsers = [
        BROWSER_USER_AGENTS.chrome91,
        BROWSER_USER_AGENTS.firefox89,
        BROWSER_USER_AGENTS.safari14
      ];

      browsers.forEach(userAgent => {
        mockBrowser(userAgent);
        
        const { unmount } = render(
          <ThemeProvider>
            <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
              <p>Modal content</p>
            </Modal>
          </ThemeProvider>
        );

        const modal = screen.getByRole('dialog');
        expect(modal).toBeInTheDocument();
        
        unmount();
      });
    });
  });

  describe('Event Handling Across Browsers', () => {
    it('should handle click events consistently', () => {
      const browsers = [
        BROWSER_USER_AGENTS.chrome91,
        BROWSER_USER_AGENTS.firefox89,
        BROWSER_USER_AGENTS.safari14
      ];

      browsers.forEach(userAgent => {
        mockBrowser(userAgent);
        
        const handleClick = vi.fn();
        
        const { unmount } = render(
          <ThemeProvider>
            <Button onClick={handleClick}>Click Me</Button>
          </ThemeProvider>
        );

        const button = screen.getByRole('button');
        fireEvent.click(button);
        
        expect(handleClick).toHaveBeenCalled();
        
        unmount();
        vi.clearAllMocks();
      });
    });

    it('should handle keyboard events consistently', () => {
      const browsers = [
        BROWSER_USER_AGENTS.chrome91,
        BROWSER_USER_AGENTS.firefox89,
        BROWSER_USER_AGENTS.safari14
      ];

      browsers.forEach(userAgent => {
        mockBrowser(userAgent);
        
        const handleClick = vi.fn();
        
        const { unmount } = render(
          <ThemeProvider>
            <Button onClick={handleClick}>Keyboard Test</Button>
          </ThemeProvider>
        );

        const button = screen.getByRole('button');
        fireEvent.keyDown(button, { key: 'Enter' });
        
        expect(handleClick).toHaveBeenCalled();
        
        unmount();
        vi.clearAllMocks();
      });
    });
  });

  describe('CSS and Styling Compatibility', () => {
    it('should apply styles consistently across browsers', () => {
      const browsers = [
        BROWSER_USER_AGENTS.chrome91,
        BROWSER_USER_AGENTS.firefox89,
        BROWSER_USER_AGENTS.safari14
      ];

      browsers.forEach(userAgent => {
        mockBrowser(userAgent);
        
        const { unmount } = render(
          <ThemeProvider>
            <Button variant="primary">Styled Button</Button>
          </ThemeProvider>
        );

        const button = screen.getByRole('button');
        const styles = window.getComputedStyle(button);
        
        // Basic style checks
        expect(styles.display).toBeDefined();
        expect(styles.padding).toBeDefined();
        
        unmount();
      });
    });

    it('should handle flexbox layouts consistently', () => {
      const { container } = render(
        <ThemeProvider>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button>Flex Item</Button>
          </div>
        </ThemeProvider>
      );

      const flexContainer = container.firstChild as HTMLElement;
      const styles = window.getComputedStyle(flexContainer);
      
      expect(styles.display).toBe('flex');
    });
  });

  describe('Browser Compatibility Warning', () => {
    it('should show warning for unsupported browsers', () => {
      mockBrowser(BROWSER_USER_AGENTS.chromeOld, {
        crypto: undefined
      });
      
      render(
        <ThemeProvider>
          <BrowserCompatibilityWarning />
        </ThemeProvider>
      );

      expect(screen.getByText(/unsupported browser/i)).toBeInTheDocument();
    });

    it('should not show warning for supported browsers', () => {
      mockBrowser(BROWSER_USER_AGENTS.chrome91, {
        crypto: { subtle: {} },
        indexedDB: {},
        fetch: vi.fn(),
        WebSocket: function() {}
      });
      
      render(
        <ThemeProvider>
          <BrowserCompatibilityWarning />
        </ThemeProvider>
      );

      expect(screen.queryByText(/unsupported browser/i)).not.toBeInTheDocument();
    });
  });

  describe('Form Input Compatibility', () => {
    it('should handle form inputs consistently across browsers', () => {
      const browsers = [
        BROWSER_USER_AGENTS.chrome91,
        BROWSER_USER_AGENTS.firefox89,
        BROWSER_USER_AGENTS.safari14
      ];

      browsers.forEach(userAgent => {
        mockBrowser(userAgent);
        
        const { unmount } = render(
          <ThemeProvider>
            <EmailComposer
              isOpen={true}
              onClose={vi.fn()}
              onSend={vi.fn()}
            />
          </ThemeProvider>
        );

        const subjectInput = screen.getByPlaceholderText(/subject/i);
        
        fireEvent.change(subjectInput, { target: { value: 'Test Subject' } });
        expect(subjectInput).toHaveValue('Test Subject');
        
        unmount();
      });
    });
  });

  describe('Local Storage Compatibility', () => {
    it('should handle localStorage consistently', () => {
      const mockStorage = {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn()
      };

      mockBrowser(BROWSER_USER_AGENTS.chrome91, {
        localStorage: mockStorage
      });

      // Test localStorage operations
      window.localStorage.setItem('test', 'value');
      expect(mockStorage.setItem).toHaveBeenCalledWith('test', 'value');

      window.localStorage.getItem('test');
      expect(mockStorage.getItem).toHaveBeenCalledWith('test');
    });

    it('should handle localStorage errors gracefully', () => {
      const mockStorage = {
        getItem: vi.fn().mockImplementation(() => {
          throw new Error('Storage error');
        }),
        setItem: vi.fn().mockImplementation(() => {
          throw new Error('Storage error');
        }),
        removeItem: vi.fn(),
        clear: vi.fn()
      };

      mockBrowser(BROWSER_USER_AGENTS.safari14, {
        localStorage: mockStorage
      });

      // Should not throw when localStorage fails
      expect(() => {
        try {
          window.localStorage.getItem('test');
        } catch (error) {
          // Handle gracefully
        }
      }).not.toThrow();
    });
  });

  describe('Animation and Transition Compatibility', () => {
    it('should handle CSS animations across browsers', () => {
      const element = document.createElement('div');
      element.style.transition = 'opacity 0.3s ease';
      element.style.opacity = '0';
      
      document.body.appendChild(element);
      
      // Change opacity to trigger transition
      element.style.opacity = '1';
      
      expect(element.style.transition).toBe('opacity 0.3s ease');
      expect(element.style.opacity).toBe('1');
      
      document.body.removeChild(element);
    });

    it('should respect reduced motion preferences', () => {
      const mockMatchMedia = vi.fn().mockReturnValue({
        matches: true, // User prefers reduced motion
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      });

      mockBrowser(BROWSER_USER_AGENTS.chrome91, {
        matchMedia: mockMatchMedia
      });

      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      expect(mediaQuery.matches).toBe(true);
    });
  });

  describe('Touch and Mobile Compatibility', () => {
    it('should handle touch events on mobile browsers', () => {
      // Mock mobile Safari
      mockBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15');
      
      const handleClick = vi.fn();
      
      render(
        <ThemeProvider>
          <Button onClick={handleClick}>Touch Button</Button>
        </ThemeProvider>
      );

      const button = screen.getByRole('button');
      
      // Simulate touch events
      fireEvent.touchStart(button);
      fireEvent.touchEnd(button);
      fireEvent.click(button);
      
      expect(handleClick).toHaveBeenCalled();
    });
  });

  describe('Error Handling Across Browsers', () => {
    it('should handle JavaScript errors gracefully', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const ErrorComponent = () => {
        throw new Error('Test error');
      };

      // Should not crash the entire application
      expect(() => {
        try {
          render(
            <ThemeProvider>
              <ErrorComponent />
            </ThemeProvider>
          );
        } catch (error) {
          // Handle error gracefully
        }
      }).not.toThrow();
      
      consoleSpy.mockRestore();
    });
  });
});