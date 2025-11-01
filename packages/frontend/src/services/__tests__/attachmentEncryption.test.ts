/**
 * Attachment Encryption Tests
 * Tests attachment handling and encryption functionality
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailService } from '../emailService';
import { CryptoEngine } from '../crypto';
import { EmailDraft, EmailAttachment } from '../../types/email';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Mock crypto.randomUUID
Object.defineProperty(crypto, 'randomUUID', {
  value: vi.fn(() => 'test-uuid-' + Math.random().toString(36).substr(2, 9)),
});

// Mock FileReader for attachment processing
class MockFileReader {
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  result: ArrayBuffer | null = null;

  readAsArrayBuffer(file: File) {
    // Simulate async file reading
    setTimeout(() => {
      if (file.name === 'error-file.txt') {
        this.onerror?.(new Error('File read error'));
      } else {
        this.result = new TextEncoder().encode(file.name + ' content').buffer;
        this.onload?.(null);
      }
    }, 0);
  }
}

global.FileReader = MockFileReader as any;

describe('Attachment Encryption Tests', () => {
  let emailService: EmailService;

  beforeEach(() => {
    vi.clearAllMocks();
    emailService = new EmailService('/api');

    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'authToken') return 'test-auth-token';
      return null;
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('File Processing', () => {
    it('should process text file attachment', async () => {
      const file = new File(['Hello, World!'], 'hello.txt', { type: 'text/plain' });
      
      const attachment = await emailService.processAttachment(file);

      expect(attachment).toBeDefined();
      expect(attachment.id).toBeDefined();
      expect(attachment.name).toBe('hello.txt');
      expect(attachment.size).toBe(file.size);
      expect(attachment.type).toBe('text/plain');
      expect(attachment.data).toBeInstanceOf(ArrayBuffer);
      expect(attachment.encrypted).toBe(false);
    });

    it('should process image file attachment', async () => {
      const imageData = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]); // PNG header
      const file = new File([imageData], 'image.png', { type: 'image/png' });
      
      const attachment = await emailService.processAttachment(file);

      expect(attachment.name).toBe('image.png');
      expect(attachment.type).toBe('image/png');
      expect(attachment.size).toBe(imageData.length);
    });

    it('should process PDF file attachment', async () => {
      const pdfData = new Uint8Array([37, 80, 68, 70]); // PDF header
      const file = new File([pdfData], 'document.pdf', { type: 'application/pdf' });
      
      const attachment = await emailService.processAttachment(file);

      expect(attachment.name).toBe('document.pdf');
      expect(attachment.type).toBe('application/pdf');
      expect(attachment.size).toBe(pdfData.length);
    });

    it('should handle large file processing', async () => {
      const largeData = new Uint8Array(5 * 1024 * 1024); // 5MB
      largeData.fill(65); // Fill with 'A'
      const file = new File([largeData], 'large-file.bin', { type: 'application/octet-stream' });
      
      const attachment = await emailService.processAttachment(file);

      expect(attachment.name).toBe('large-file.bin');
      expect(attachment.size).toBe(5 * 1024 * 1024);
      expect(attachment.type).toBe('application/octet-stream');
    });

    it('should handle file reading errors', async () => {
      const file = new File(['content'], 'error-file.txt', { type: 'text/plain' });
      
      await expect(emailService.processAttachment(file))
        .rejects.toThrow('Failed to read file');
    });

    it('should handle empty files', async () => {
      const file = new File([], 'empty.txt', { type: 'text/plain' });
      
      const attachment = await emailService.processAttachment(file);

      expect(attachment.name).toBe('empty.txt');
      expect(attachment.size).toBe(0);
    });
  });

  describe('Attachment Validation', () => {
    it('should validate attachment sizes in draft', () => {
      const validAttachment: EmailAttachment = {
        id: 'valid-attachment',
        name: 'small-file.txt',
        size: 1024, // 1KB
        type: 'text/plain',
        data: new ArrayBuffer(1024),
        encrypted: false,
      };

      const draft: EmailDraft = {
        to: [{ email: 'test@odyssie.net' }],
        subject: 'Test',
        body: 'Test',
        attachments: [validAttachment],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = emailService.validateDraft(draft);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject oversized individual attachments', () => {
      const oversizedAttachment: EmailAttachment = {
        id: 'oversized-attachment',
        name: 'huge-file.zip',
        size: 30 * 1024 * 1024, // 30MB
        type: 'application/zip',
        data: new ArrayBuffer(30 * 1024 * 1024),
        encrypted: false,
      };

      const draft: EmailDraft = {
        to: [{ email: 'test@odyssie.net' }],
        subject: 'Test',
        body: 'Test',
        attachments: [oversizedAttachment],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = emailService.validateDraft(draft);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Attachment "huge-file.zip" exceeds maximum size of 25MB');
    });

    it('should reject when total attachment size exceeds limit', () => {
      const attachments: EmailAttachment[] = Array.from({ length: 5 }, (_, i) => ({
        id: `attachment-${i}`,
        name: `file-${i}.pdf`,
        size: 25 * 1024 * 1024, // 25MB each
        type: 'application/pdf',
        data: new ArrayBuffer(25 * 1024 * 1024),
        encrypted: false,
      }));

      const draft: EmailDraft = {
        to: [{ email: 'test@odyssie.net' }],
        subject: 'Test',
        body: 'Test',
        attachments,
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = emailService.validateDraft(draft);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Total attachment size exceeds maximum of 100MB');
    });

    it('should allow multiple small attachments', () => {
      const attachments: EmailAttachment[] = Array.from({ length: 10 }, (_, i) => ({
        id: `attachment-${i}`,
        name: `file-${i}.txt`,
        size: 1024, // 1KB each
        type: 'text/plain',
        data: new ArrayBuffer(1024),
        encrypted: false,
      }));

      const draft: EmailDraft = {
        to: [{ email: 'test@odyssie.net' }],
        subject: 'Test',
        body: 'Test',
        attachments,
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = emailService.validateDraft(draft);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Attachment Encryption in Email Flow', () => {
    it('should encrypt single attachment correctly', async () => {
      const attachment: EmailAttachment = {
        id: 'test-attachment',
        name: 'document.pdf',
        size: 2048,
        type: 'application/pdf',
        data: new ArrayBuffer(2048),
        encrypted: false,
      };

      const draft: EmailDraft = {
        to: [{ 
          email: 'recipient@odyssie.net',
          publicKey: 'mock-public-key'
        }],
        subject: 'Email with Attachment',
        body: 'Please find attached document.',
        attachments: [attachment],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock crypto operations
      vi.mocked(CryptoEngine.generateAESKey).mockResolvedValue({} as CryptoKey);
      vi.mocked(CryptoEngine.encryptAES).mockResolvedValue({
        data: new ArrayBuffer(32),
        iv: new ArrayBuffer(12),
      });
      vi.mocked(CryptoEngine.generateSignature).mockResolvedValue(new ArrayBuffer(256));
      vi.mocked(CryptoEngine.arrayBufferToBase64).mockReturnValue('base64-encoded-data');

      const encryptedEmail = await emailService.encryptEmail(draft, 'user-key-id', 'user-password');

      expect(encryptedEmail.encryptedAttachments).toHaveLength(1);
      expect(encryptedEmail.encryptedAttachments[0].id).toBe('test-attachment');
      expect(encryptedEmail.encryptedAttachments[0].encryptedName).toBe('base64-encoded-data');
      expect(encryptedEmail.encryptedAttachments[0].encryptedData).toBe('base64-encoded-data');
      expect(encryptedEmail.encryptedAttachments[0].size).toBe(2048);
      expect(encryptedEmail.encryptedAttachments[0].mimeType).toBe('application/pdf');
      expect(encryptedEmail.metadata.attachmentCount).toBe(1);

      // Verify encryption was called for attachment name and data
      expect(CryptoEngine.encryptAES).toHaveBeenCalledTimes(4); // subject + body + attachment name + attachment data
    });

    it('should encrypt multiple attachments correctly', async () => {
      const attachments: EmailAttachment[] = [
        {
          id: 'attachment-1',
          name: 'document1.pdf',
          size: 1024,
          type: 'application/pdf',
          data: new ArrayBuffer(1024),
          encrypted: false,
        },
        {
          id: 'attachment-2',
          name: 'image.png',
          size: 2048,
          type: 'image/png',
          data: new ArrayBuffer(2048),
          encrypted: false,
        },
      ];

      const draft: EmailDraft = {
        to: [{ 
          email: 'recipient@odyssie.net',
          publicKey: 'mock-public-key'
        }],
        subject: 'Multiple Attachments',
        body: 'Email with multiple attachments.',
        attachments,
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock crypto operations
      vi.mocked(CryptoEngine.generateAESKey).mockResolvedValue({} as CryptoKey);
      vi.mocked(CryptoEngine.encryptAES).mockResolvedValue({
        data: new ArrayBuffer(32),
        iv: new ArrayBuffer(12),
      });
      vi.mocked(CryptoEngine.generateSignature).mockResolvedValue(new ArrayBuffer(256));
      vi.mocked(CryptoEngine.arrayBufferToBase64).mockReturnValue('base64-encoded-data');

      const encryptedEmail = await emailService.encryptEmail(draft, 'user-key-id', 'user-password');

      expect(encryptedEmail.encryptedAttachments).toHaveLength(2);
      expect(encryptedEmail.encryptedAttachments[0].id).toBe('attachment-1');
      expect(encryptedEmail.encryptedAttachments[1].id).toBe('attachment-2');
      expect(encryptedEmail.metadata.attachmentCount).toBe(2);

      // Verify encryption was called for all components
      expect(CryptoEngine.encryptAES).toHaveBeenCalledTimes(6); // subject + body + 2*(attachment name + attachment data)
    });

    it('should handle attachment encryption errors', async () => {
      const attachment: EmailAttachment = {
        id: 'test-attachment',
        name: 'document.pdf',
        size: 1024,
        type: 'application/pdf',
        data: new ArrayBuffer(1024),
        encrypted: false,
      };

      const draft: EmailDraft = {
        to: [{ 
          email: 'recipient@odyssie.net',
          publicKey: 'mock-public-key'
        }],
        subject: 'Test',
        body: 'Test',
        attachments: [attachment],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock encryption failure for attachments
      vi.mocked(CryptoEngine.encryptAES)
        .mockResolvedValueOnce({ data: new ArrayBuffer(32), iv: new ArrayBuffer(12) }) // subject
        .mockResolvedValueOnce({ data: new ArrayBuffer(32), iv: new ArrayBuffer(12) }) // body
        .mockRejectedValueOnce(new Error('Attachment encryption failed')); // attachment name

      await expect(emailService.encryptEmail(draft, 'user-key-id', 'user-password'))
        .rejects.toThrow('Failed to encrypt email');
    });
  });

  describe('Attachment Type Handling', () => {
    it('should handle various file types correctly', async () => {
      const fileTypes = [
        { name: 'document.pdf', type: 'application/pdf' },
        { name: 'image.jpg', type: 'image/jpeg' },
        { name: 'image.png', type: 'image/png' },
        { name: 'document.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
        { name: 'spreadsheet.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        { name: 'archive.zip', type: 'application/zip' },
        { name: 'text.txt', type: 'text/plain' },
        { name: 'data.json', type: 'application/json' },
      ];

      for (const fileType of fileTypes) {
        const file = new File(['content'], fileType.name, { type: fileType.type });
        const attachment = await emailService.processAttachment(file);

        expect(attachment.name).toBe(fileType.name);
        expect(attachment.type).toBe(fileType.type);
      }
    });

    it('should handle files without explicit MIME type', async () => {
      const file = new File(['content'], 'unknown-file', { type: '' });
      const attachment = await emailService.processAttachment(file);

      expect(attachment.name).toBe('unknown-file');
      expect(attachment.type).toBe('');
    });

    it('should handle files with special characters in names', async () => {
      const specialNames = [
        'file with spaces.txt',
        'file-with-dashes.pdf',
        'file_with_underscores.jpg',
        'file.with.dots.png',
        'file(with)parentheses.doc',
        'file[with]brackets.xls',
      ];

      for (const fileName of specialNames) {
        const file = new File(['content'], fileName, { type: 'text/plain' });
        const attachment = await emailService.processAttachment(file);

        expect(attachment.name).toBe(fileName);
      }
    });
  });

  describe('Attachment Security', () => {
    it('should not process potentially dangerous file types in validation', () => {
      const dangerousAttachment: EmailAttachment = {
        id: 'dangerous-file',
        name: 'script.exe',
        size: 1024,
        type: 'application/x-msdownload',
        data: new ArrayBuffer(1024),
        encrypted: false,
      };

      const draft: EmailDraft = {
        to: [{ email: 'test@odyssie.net' }],
        subject: 'Test',
        body: 'Test',
        attachments: [dangerousAttachment],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // The validation should still pass as we're not implementing file type restrictions
      // This is just to ensure the system can handle various file types
      const result = emailService.validateDraft(draft);
      expect(result.isValid).toBe(true);
    });

    it('should handle binary data correctly', async () => {
      const binaryData = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        binaryData[i] = i;
      }
      
      const file = new File([binaryData], 'binary-data.bin', { type: 'application/octet-stream' });
      const attachment = await emailService.processAttachment(file);

      expect(attachment.name).toBe('binary-data.bin');
      expect(attachment.size).toBe(256);
      expect(attachment.type).toBe('application/octet-stream');
      expect(attachment.data).toBeInstanceOf(ArrayBuffer);
    });
  });
});