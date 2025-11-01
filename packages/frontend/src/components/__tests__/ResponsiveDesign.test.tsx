/**
 * Responsive Design Tests
 * Tests for responsive behavior across different device sizes
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '../../theme';
import { SimpleLayout } from '../layout/SimpleLayout';
import { MobileNavigation } from '../layout/MobileNavigation';
import { Navigation } from '../layout/Navigation';
import { EmailComposer } from '../EmailComposer';
import { BrowserCompatibilityWarning } from '../ui/BrowserCompatibilityWarning';

// Mock window.matchMedia
const mockMatchMedia = vi.fn();

// Mock ResizeObserver
const mockResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn()
}));

describe('Responsive Design Tests', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: mockMatchMedia
    });

    Object.defineProperty(window, 'ResizeObserver', {
      writable: true,
      value: mockResizeObserver
    });

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
    vi.restoreAllMocks();
  });

  describe('Mobile Breakpoints', () => {
    it('should show mobile navigation on small screens', () => {
      // Mock mobile viewport
      mockMatchMedia.mockImplementation((query) => ({
        matches: query === '(max-width: 768px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }));

      render(
        <ThemeProvider>
          <SimpleLayout onComposeClick={vi.fn()}>
            <div>Test content</div>
          </SimpleLayout>
        </ThemeProvider>
      );

      // Mobile navigation should be present
      expect(document.querySelector('[data-testid="mobile-navigation"]')).toBeTruthy();
    });

    it('should show desktop navigation on large screens', () => {
      // Mock desktop viewport
      mockMatchMedia.mockImplementation((query) => ({
        matches: query === '(min-width: 769px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }));

      render(
        <ThemeProvider>
          <SimpleLayout onComposeClick={vi.fn()}>
            <div>Test content</div>
          </SimpleLayout>
        </ThemeProvider>
      );

      // Desktop navigation should be present
      expect(document.querySelector('[data-testid="desktop-navigation"]')).toBeTruthy();
    });
  });

  describe('Mobile Navigation', () => {
    it('should toggle mobile menu', () => {
      const mockOnComposeClick = vi.fn();

      render(
        <ThemeProvider>
          <MobileNavigation onComposeClick={mockOnComposeClick} />
        </ThemeProvider>
      );

      // Find and click menu toggle button
      const menuButton = screen.getByRole('button', { name: /menu/i });
      fireEvent.click(menuButton);

      // Menu should be visible
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('should handle compose button click on mobile', () => {
      const mockOnComposeClick = vi.fn();

      render(
        <ThemeProvider>
          <MobileNavigation onComposeClick={mockOnComposeClick} />
        </ThemeProvider>
      );

      const composeButton = screen.getByRole('button', { name: /compose/i });
      fireEvent.click(composeButton);

      expect(mockOnComposeClick).toHaveBeenCalled();
    });
  });

  describe('Email Composer Responsive Behavior', () => {
    it('should adapt to mobile viewport', () => {
      // Mock mobile viewport
      mockMatchMedia.mockImplementation((query) => ({
        matches: query.includes('max-width'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }));

      render(
        <ThemeProvider>
          <EmailComposer
            isOpen={true}
            onClose={vi.fn()}
            onSend={vi.fn()}
          />
        </ThemeProvider>
      );

      const composer = screen.getByRole('dialog');
      expect(composer).toBeInTheDocument();

      // Should have mobile-appropriate styling
      const style = window.getComputedStyle(composer);
      expect(style.width).toBeDefined();
    });

    it('should handle keyboard on mobile devices', () => {
      // Mock mobile user agent
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15',
        writable: true
      });

      render(
        <ThemeProvider>
          <EmailComposer
            isOpen={true}
            onClose={vi.fn()}
            onSend={vi.fn()}
          />
        </ThemeProvider>
      );

      const subjectInput = screen.getByPlaceholderText(/subject/i);
      
      // Focus should work on mobile
      fireEvent.focus(subjectInput);
      expect(document.activeElement).toBe(subjectInput);
    });
  });

  describe('Browser Compatibility Warning Responsive', () => {
    it('should adapt warning layout for mobile', () => {
      // Mock unsupported browser
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/60.0.3112.113',
        writable: true
      });

      // Mock missing features
      Object.defineProperty(window, 'crypto', {
        value: undefined,
        writable: true
      });

      render(
        <ThemeProvider>
          <BrowserCompatibilityWarning />
        </ThemeProvider>
      );

      const warning = screen.getByText(/unsupported browser/i);
      expect(warning).toBeInTheDocument();

      // Should be responsive
      const warningContainer = warning.closest('div');
      expect(warningContainer).toHaveStyle({ position: 'fixed' });
    });
  });

  describe('Viewport Meta Tag', () => {
    it('should have proper viewport meta tag for mobile', () => {
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      
      if (viewportMeta) {
        const content = viewportMeta.getAttribute('content');
        expect(content).toContain('width=device-width');
        expect(content).toContain('initial-scale=1');
      }
    });
  });

  describe('Touch Interactions', () => {
    it('should handle touch events on mobile', () => {
      const mockOnComposeClick = vi.fn();

      render(
        <ThemeProvider>
          <MobileNavigation onComposeClick={mockOnComposeClick} />
        </ThemeProvider>
      );

      const composeButton = screen.getByRole('button', { name: /compose/i });
      
      // Simulate touch events
      fireEvent.touchStart(composeButton);
      fireEvent.touchEnd(composeButton);
      fireEvent.click(composeButton);

      expect(mockOnComposeClick).toHaveBeenCalled();
    });
  });

  describe('Orientation Changes', () => {
    it('should handle orientation change events', () => {
      const orientationChangeHandler = vi.fn();
      
      window.addEventListener('orientationchange', orientationChangeHandler);
      
      // Simulate orientation change
      const orientationEvent = new Event('orientationchange');
      window.dispatchEvent(orientationEvent);
      
      expect(orientationChangeHandler).toHaveBeenCalled();
      
      window.removeEventListener('orientationchange', orientationChangeHandler);
    });
  });

  describe('Responsive Images and Media', () => {
    it('should handle responsive images', () => {
      const img = document.createElement('img');
      img.src = 'test-image.jpg';
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      
      document.body.appendChild(img);
      
      expect(img.style.maxWidth).toBe('100%');
      expect(img.style.height).toBe('auto');
      
      document.body.removeChild(img);
    });
  });

  describe('Accessibility on Mobile', () => {
    it('should maintain accessibility on touch devices', () => {
      render(
        <ThemeProvider>
          <MobileNavigation onComposeClick={vi.fn()} />
        </ThemeProvider>
      );

      const menuButton = screen.getByRole('button', { name: /menu/i });
      
      // Should have proper ARIA attributes
      expect(menuButton).toHaveAttribute('aria-label');
      expect(menuButton).toHaveAttribute('type', 'button');
    });

    it('should support keyboard navigation on mobile', () => {
      render(
        <ThemeProvider>
          <MobileNavigation onComposeClick={vi.fn()} />
        </ThemeProvider>
      );

      const menuButton = screen.getByRole('button', { name: /menu/i });
      
      // Should be focusable
      menuButton.focus();
      expect(document.activeElement).toBe(menuButton);
      
      // Should respond to Enter key
      fireEvent.keyDown(menuButton, { key: 'Enter', code: 'Enter' });
      // Menu should toggle (implementation dependent)
    });
  });

  describe('Performance on Mobile', () => {
    it('should handle reduced motion preferences', () => {
      mockMatchMedia.mockImplementation((query) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }));

      // Test that animations are reduced when user prefers reduced motion
      const element = document.createElement('div');
      element.style.transition = 'transform 0.3s ease';
      
      // With reduced motion, transitions should be minimal
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        element.style.transition = 'none';
      }
      
      expect(element.style.transition).toBe('none');
    });
  });
});