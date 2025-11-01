/**
 * Email Composer Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EmailComposer } from '../EmailComposer';
import { EmailDraft } from '../../types/email';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  },
  AnimatePresence: ({ children }: any) => children,
}));

// Mock EmailService
vi.mock('../../services/emailService', () => ({
  EmailService: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    createEmptyDraft: vi.fn().mockReturnValue({
      to: [],
      cc: [],
      bcc: [],
      subject: '',
      body: '',
      attachments: [],
      isEncrypted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    validateRecipients: vi.fn().mockResolvedValue({
      isValid: true,
      errors: [],
      warnings: [],
    }),
    validateDraft: vi.fn().mockReturnValue({
      isValid: true,
      errors: [],
      warnings: [],
    }),
    encryptEmail: vi.fn().mockResolvedValue({
      id: 'test-id',
      encryptedContent: 'encrypted-content',
      encryptedSubject: 'encrypted-subject',
      encryptedAttachments: [],
      senderSignature: 'signature',
      recipientKeys: {},
      metadata: {
        id: 'metadata-id',
        senderId: 'sender-id',
        recipientIds: [],
        timestamp: new Date(),
        size: 100,
        attachmentCount: 0,
        isRead: false,
      },
    }),
    sendEmail: vi.fn().mockResolvedValue(undefined),
    saveDraft: vi.fn(),
    deleteDraft: vi.fn(),
  })),
}));

// Mock child components
vi.mock('../RecipientInput', () => ({
  RecipientInput: ({ onChange, recipients }: any) => (
    <div data-testid="recipient-input">
      <input
        data-testid="recipient-input-field"
        onChange={(e) => {
          if (e.target.value) {
            onChange([{ email: e.target.value }]);
          }
        }}
      />
      <div data-testid="recipients-count">{recipients.length}</div>
    </div>
  ),
}));

vi.mock('../AttachmentManager', () => ({
  AttachmentManager: ({ onChange, attachments }: any) => (
    <div data-testid="attachment-manager">
      <input
        type="file"
        data-testid="file-input"
        onChange={(e) => {
          if (e.target.files?.[0]) {
            onChange([
              ...attachments,
              {
                id: 'test-attachment',
                name: e.target.files[0].name,
                size: e.target.files[0].size,
                type: e.target.files[0].type,
                data: new ArrayBuffer(100),
              },
            ]);
          }
        }}
      />
      <div data-testid="attachments-count">{attachments.length}</div>
    </div>
  ),
}));

vi.mock('../RichTextEditor', () => ({
  RichTextEditor: ({ onChange, content }: any) => (
    <textarea
      data-testid="rich-text-editor"
      value={content}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock prompt
Object.defineProperty(window, 'prompt', {
  value: vi.fn().mockReturnValue('test-password'),
});

describe('EmailComposer', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSend: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue('test-user-key');
  });

  it('should render email composer when open', () => {
    render(<EmailComposer {...defaultProps} />);
    
    expect(screen.getByText('Compose Email')).toBeInTheDocument();
    expect(screen.getByTestId('recipient-input')).toBeInTheDocument();
    expect(screen.getByTestId('attachment-manager')).toBeInTheDocument();
    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument();
  });

  it('should not render when closed', () => {
    render(<EmailComposer {...defaultProps} isOpen={false} />);
    
    expect(screen.queryByText('Compose Email')).not.toBeInTheDocument();
  });

  it('should handle subject input changes', async () => {
    render(<EmailComposer {...defaultProps} />);
    
    const subjectInput = screen.getByPlaceholderText('Subject');
    fireEvent.change(subjectInput, { target: { value: 'Test Subject' } });
    
    expect(subjectInput).toHaveValue('Test Subject');
  });

  it('should handle recipient changes', async () => {
    render(<EmailComposer {...defaultProps} />);
    
    const recipientInput = screen.getByTestId('recipient-input-field');
    fireEvent.change(recipientInput, { target: { value: 'test@odyssie.net' } });
    
    await waitFor(() => {
      expect(screen.getByTestId('recipients-count')).toHaveTextContent('1');
    });
  });

  it('should handle attachment uploads', async () => {
    render(<EmailComposer {...defaultProps} />);
    
    const fileInput = screen.getByTestId('file-input');
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    
    fireEvent.change(fileInput, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByTestId('attachments-count')).toHaveTextContent('1');
    });
  });

  it('should handle body content changes', async () => {
    render(<EmailComposer {...defaultProps} />);
    
    const bodyEditor = screen.getByTestId('rich-text-editor');
    fireEvent.change(bodyEditor, { target: { value: 'Test email body' } });
    
    expect(bodyEditor).toHaveValue('Test email body');
  });

  it('should show encryption indicator', () => {
    render(<EmailComposer {...defaultProps} />);
    
    expect(screen.getByText('End-to-end encrypted')).toBeInTheDocument();
  });

  it('should handle send button click with valid data', async () => {
    render(<EmailComposer {...defaultProps} />);
    
    // Add recipient
    const recipientInput = screen.getByTestId('recipient-input-field');
    fireEvent.change(recipientInput, { target: { value: 'test@odyssie.net' } });
    
    // Add subject
    const subjectInput = screen.getByPlaceholderText('Subject');
    fireEvent.change(subjectInput, { target: { value: 'Test Subject' } });
    
    // Add body
    const bodyEditor = screen.getByTestId('rich-text-editor');
    fireEvent.change(bodyEditor, { target: { value: 'Test body' } });
    
    // Click send
    const sendButton = screen.getByText('Send');
    fireEvent.click(sendButton);
    
    await waitFor(() => {
      expect(defaultProps.onSend).toHaveBeenCalled();
    });
  });

  it('should disable send button when no recipients', () => {
    render(<EmailComposer {...defaultProps} />);
    
    const sendButton = screen.getByText('Send');
    expect(sendButton).toBeDisabled();
  });

  it('should handle close button click', () => {
    render(<EmailComposer {...defaultProps} />);
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should handle cancel button click', () => {
    render(<EmailComposer {...defaultProps} />);
    
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('should show loading state when sending', async () => {
    render(<EmailComposer {...defaultProps} />);
    
    // Add recipient
    const recipientInput = screen.getByTestId('recipient-input-field');
    fireEvent.change(recipientInput, { target: { value: 'test@odyssie.net' } });
    
    // Click send
    const sendButton = screen.getByText('Send');
    fireEvent.click(sendButton);
    
    // Should show sending state briefly
    await waitFor(() => {
      expect(screen.getByText('Sending...')).toBeInTheDocument();
    });
  });

  it('should initialize with provided draft', () => {
    const initialDraft: EmailDraft = {
      to: [{ email: 'test@example.com' }],
      subject: 'Initial Subject',
      body: 'Initial Body',
      attachments: [],
      isEncrypted: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    render(<EmailComposer {...defaultProps} initialDraft={initialDraft} />);
    
    expect(screen.getByDisplayValue('Initial Subject')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Initial Body')).toBeInTheDocument();
  });

  it('should handle minimize and expand functionality', () => {
    render(<EmailComposer {...defaultProps} />);
    
    // Find minimize button (assuming it has a specific icon or aria-label)
    const minimizeButton = screen.getByRole('button', { name: /minimize/i });
    fireEvent.click(minimizeButton);
    
    // The composer should still be present but minimized
    expect(screen.getByText('Compose Email')).toBeInTheDocument();
  });
});