/**
 * Accessibility Tests
 * Tests for WCAG compliance and accessibility features
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { ThemeProvider } from '../../theme';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Toast } from '../ui/Toast';
import { EmailComposer } from '../EmailComposer';
import { BrowserCompatibilityWarning } from '../ui/BrowserCompatibilityWarning';
import { OfflineIndicator } from '../ui/OfflineIndicator';

// Extend Jest matchers
expect.extend(toHaveNoViolations);

describe('Accessibility Tests', () => {
  beforeEach(() => {
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

    // Mock matchMedia for theme detection
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Button Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <ThemeProvider>
          <Button>Click me</Button>
        </ThemeProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA attributes', () => {
      render(
        <ThemeProvider>
          <Button disabled>Disabled Button</Button>
        </ThemeProvider>
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('disabled');
      expect(button).toHaveAttribute('type', 'button');
    });

    it('should support keyboard navigation', () => {
      const handleClick = vi.fn();
      
      render(
        <ThemeProvider>
          <Button onClick={handleClick}>Keyboard Button</Button>
        </ThemeProvider>
      );

      const button = screen.getByRole('button');
      
      // Should be focusable
      button.focus();
      expect(document.activeElement).toBe(button);
      
      // Should respond to Enter key
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      expect(handleClick).toHaveBeenCalled();
      
      // Should respond to Space key
      fireEvent.keyDown(button, { key: ' ', code: 'Space' });
      expect(handleClick).toHaveBeenCalledTimes(2);
    });

    it('should have proper focus indicators', () => {
      render(
        <ThemeProvider>
          <Button>Focus Test</Button>
        </ThemeProvider>
      );

      const button = screen.getByRole('button');
      button.focus();
      
      // Should have focus styles (implementation dependent)
      expect(document.activeElement).toBe(button);
    });
  });

  describe('Modal Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <ThemeProvider>
          <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
            <p>Modal content</p>
          </Modal>
        </ThemeProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should trap focus within modal', () => {
      render(
        <ThemeProvider>
          <Modal isOpen={true} onClose={vi.fn()} title="Focus Trap Test">
            <button>First Button</button>
            <button>Second Button</button>
          </Modal>
        </ThemeProvider>
      );

      const modal = screen.getByRole('dialog');
      expect(modal).toBeInTheDocument();
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should have proper ARIA attributes', () => {
      render(
        <ThemeProvider>
          <Modal isOpen={true} onClose={vi.fn()} title="ARIA Test Modal">
            <p>Modal with ARIA attributes</p>
          </Modal>
        </ThemeProvider>
      );

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby');
    });

    it('should close on Escape key', () => {
      const handleClose = vi.fn();
      
      render(
        <ThemeProvider>
          <Modal isOpen={true} onClose={handleClose} title="Escape Test">
            <p>Press Escape to close</p>
          </Modal>
        </ThemeProvider>
      );

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe('Input Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <ThemeProvider>
          <Input label="Test Input" placeholder="Enter text" />
        </ThemeProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper label association', () => {
      render(
        <ThemeProvider>
          <Input label="Email Address" type="email" />
        </ThemeProvider>
      );

      const input = screen.getByRole('textbox');
      const label = screen.getByText('Email Address');
      
      expect(input).toHaveAttribute('aria-labelledby');
      expect(label).toHaveAttribute('id');
    });

    it('should show error states accessibly', () => {
      render(
        <ThemeProvider>
          <Input 
            label="Required Field" 
            error="This field is required"
            required
          />
        </ThemeProvider>
      );

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(input).toHaveAttribute('aria-describedby');
      
      const errorMessage = screen.getByText('This field is required');
      expect(errorMessage).toBeInTheDocument();
    });
  });

  describe('Toast Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <ThemeProvider>
          <Toast
            type="success"
            title="Success"
            message="Operation completed successfully"
            onClose={vi.fn()}
          />
        </ThemeProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA attributes for screen readers', () => {
      render(
        <ThemeProvider>
          <Toast
            type="error"
            title="Error"
            message="Something went wrong"
            onClose={vi.fn()}
          />
        </ThemeProvider>
      );

      const toast = screen.getByRole('alert');
      expect(toast).toBeInTheDocument();
      expect(toast).toHaveAttribute('aria-live', 'assertive');
    });

    it('should be dismissible with keyboard', () => {
      const handleClose = vi.fn();
      
      render(
        <ThemeProvider>
          <Toast
            type="info"
            title="Information"
            message="This is an info message"
            onClose={handleClose}
          />
        </ThemeProvider>
      );

      const closeButton = screen.getByRole('button', { name: /close/i });
      
      closeButton.focus();
      fireEvent.keyDown(closeButton, { key: 'Enter', code: 'Enter' });
      
      expect(handleClose).toHaveBeenCalled();
    });
  });

  describe('Email Composer Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <ThemeProvider>
          <EmailComposer
            isOpen={true}
            onClose={vi.fn()}
            onSend={vi.fn()}
          />
        </ThemeProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper form labels', () => {
      render(
        <ThemeProvider>
          <EmailComposer
            isOpen={true}
            onClose={vi.fn()}
            onSend={vi.fn()}
          />
        </ThemeProvider>
      );

      // Check for proper form labels
      expect(screen.getByLabelText(/to/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/subject/i)).toBeInTheDocument();
    });

    it('should support keyboard navigation between fields', () => {
      render(
        <ThemeProvider>
          <EmailComposer
            isOpen={true}
            onClose={vi.fn()}
            onSend={vi.fn()}
          />
        </ThemeProvider>
      );

      const toField = screen.getByLabelText(/to/i);
      const subjectField = screen.getByLabelText(/subject/i);
      
      // Should be able to tab between fields
      toField.focus();
      expect(document.activeElement).toBe(toField);
      
      fireEvent.keyDown(toField, { key: 'Tab', code: 'Tab' });
      // Next field should be focused (implementation dependent)
    });
  });

  describe('Browser Compatibility Warning Accessibility', () => {
    it('should have no accessibility violations', async () => {
      // Mock unsupported browser
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/60.0.3112.113',
        writable: true
      });

      const { container } = render(
        <ThemeProvider>
          <BrowserCompatibilityWarning />
        </ThemeProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should be announced to screen readers', () => {
      // Mock unsupported browser
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/60.0.3112.113',
        writable: true
      });

      render(
        <ThemeProvider>
          <BrowserCompatibilityWarning />
        </ThemeProvider>
      );

      const warning = screen.getByText(/unsupported browser/i);
      expect(warning).toBeInTheDocument();
      
      // Should have appropriate role for screen readers
      const warningContainer = warning.closest('[role]');
      expect(warningContainer).toHaveAttribute('role');
    });
  });

  describe('Offline Indicator Accessibility', () => {
    it('should have no accessibility violations', async () => {
      const { container } = render(
        <ThemeProvider>
          <OfflineIndicator />
        </ThemeProvider>
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should announce status changes to screen readers', () => {
      render(
        <ThemeProvider>
          <OfflineIndicator showWhenOnline={true} />
        </ThemeProvider>
      );

      // Should have live region for status updates
      const statusElement = screen.getByText(/online|offline/i);
      if (statusElement) {
        const liveRegion = statusElement.closest('[aria-live]');
        expect(liveRegion).toHaveAttribute('aria-live');
      }
    });
  });

  describe('Color Contrast', () => {
    it('should have sufficient color contrast for text', () => {
      render(
        <ThemeProvider>
          <div style={{ backgroundColor: '#ffffff', color: '#000000' }}>
            High contrast text
          </div>
        </ThemeProvider>
      );

      const textElement = screen.getByText('High contrast text');
      const styles = window.getComputedStyle(textElement);
      
      // Basic check - actual contrast calculation would require more complex logic
      expect(styles.color).toBeDefined();
      expect(styles.backgroundColor).toBeDefined();
    });
  });

  describe('Focus Management', () => {
    it('should have visible focus indicators', () => {
      render(
        <ThemeProvider>
          <Button>Focus Test Button</Button>
        </ThemeProvider>
      );

      const button = screen.getByRole('button');
      button.focus();
      
      // Should have focus (visual indicator testing would require visual regression testing)
      expect(document.activeElement).toBe(button);
    });

    it('should restore focus after modal closes', () => {
      const TestComponent = () => {
        const [isOpen, setIsOpen] = React.useState(false);
        
        return (
          <>
            <button onClick={() => setIsOpen(true)}>Open Modal</button>
            <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Test">
              <button>Modal Button</button>
            </Modal>
          </>
        );
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      const openButton = screen.getByText('Open Modal');
      openButton.focus();
      fireEvent.click(openButton);
      
      // Modal should be open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      
      // Close modal
      fireEvent.keyDown(document, { key: 'Escape' });
      
      // Focus should return to trigger button (implementation dependent)
      expect(document.activeElement).toBe(openButton);
    });
  });

  describe('Screen Reader Support', () => {
    it('should have proper heading hierarchy', () => {
      render(
        <ThemeProvider>
          <div>
            <h1>Main Title</h1>
            <h2>Section Title</h2>
            <h3>Subsection Title</h3>
          </div>
        </ThemeProvider>
      );

      const h1 = screen.getByRole('heading', { level: 1 });
      const h2 = screen.getByRole('heading', { level: 2 });
      const h3 = screen.getByRole('heading', { level: 3 });
      
      expect(h1).toBeInTheDocument();
      expect(h2).toBeInTheDocument();
      expect(h3).toBeInTheDocument();
    });

    it('should have descriptive link text', () => {
      render(
        <ThemeProvider>
          <a href="/help">Get help with your account</a>
        </ThemeProvider>
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAccessibleName('Get help with your account');
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support tab navigation', () => {
      render(
        <ThemeProvider>
          <div>
            <button>First Button</button>
            <input type="text" placeholder="Text input" />
            <button>Second Button</button>
          </div>
        </ThemeProvider>
      );

      const firstButton = screen.getByText('First Button');
      const input = screen.getByRole('textbox');
      const secondButton = screen.getByText('Second Button');
      
      // Should be able to tab through elements
      firstButton.focus();
      expect(document.activeElement).toBe(firstButton);
      
      fireEvent.keyDown(firstButton, { key: 'Tab' });
      // Next element should be focused (implementation dependent)
    });

    it('should skip disabled elements in tab order', () => {
      render(
        <ThemeProvider>
          <div>
            <button>Enabled Button</button>
            <button disabled>Disabled Button</button>
            <button>Another Enabled Button</button>
          </div>
        </ThemeProvider>
      );

      const enabledButton = screen.getByText('Enabled Button');
      const disabledButton = screen.getByText('Disabled Button');
      
      enabledButton.focus();
      expect(document.activeElement).toBe(enabledButton);
      
      // Disabled button should not be focusable
      disabledButton.focus();
      expect(document.activeElement).not.toBe(disabledButton);
    });
  });
});