/**
 * Email Service Tests
 * Tests email encryption/decryption flows, sending/receiving between users,
 * and attachment handling with encryption
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailService } from '../emailService';
import { EmailDraft, EmailRecipient, EmailAttachment, EncryptedEmail } from '../../types/email';
import { CryptoEngine } from '../crypto';
import { KeyManager } from '../keyManager';

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

// Mock KeyManager
vi.mock('../keyManager', () => ({
  KeyManager: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    getKeyPair: vi.fn().mockResolvedValue({
      publicKey: {} as CryptoKey,
      privateKey: {} as CryptoKey,
    }),
  })),
}));

// Mock CryptoEngine methods
vi.mock('../crypto', () => ({
  CryptoEngine: {
    generateAESKey: vi.fn().mockResolvedValue({} as CryptoKey),
    stringToArrayBuffer: vi.fn((str: string) => new TextEncoder().encode(str).buffer),
    arrayBufferToString: vi.fn((buffer: ArrayBuffer) => new TextDecoder().decode(buffer)),
    arrayBufferToBase64: vi.fn((buffer: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)))),
    base64ToArrayBuffer: vi.fn((base64: string) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes.buffer;
    }),
    encryptAES: vi.fn().mockResolvedValue({
      data: new ArrayBuffer(32),
      iv: new ArrayBuffer(12),
    }),
    decryptAES: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    encryptRSA: vi.fn().mockResolvedValue(new ArrayBuffer(256)),
    decryptRSA: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    generateSignature: vi.fn().mockResolvedValue(new ArrayBuffer(256)),
    verifySignature: vi.fn().mockResolvedValue(true),
    exportKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
    importKey: vi.fn().mockResolvedValue({} as CryptoKey),
  },
}));

describe('EmailService', () => {
  let emailService: EmailService;
  let mockKeyManager: any;

  beforeEach(() => {
    vi.clearAllMocks();
    emailService = new EmailService('/api');
    mockKeyManager = new KeyManager();
    
    // Setup default localStorage responses
    mockLocalStorage.getItem.mockImplementation((key: string) => {
      if (key === 'authToken') return 'test-auth-token';
      if (key === 'emailDrafts') return '{}';
      return null;
    });

    // Setup default fetch responses
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await expect(emailService.initialize()).resolves.not.toThrow();
      expect(mockKeyManager.initialize).toHaveBeenCalled();
    });
  });

  describe('Email Validation', () => {
    it('should validate recipients successfully', async () => {
      const recipients: EmailRecipient[] = [
        { email: 'test@odyssie.net' },
        { email: 'user@odyssie.net' },
      ];

      // Mock public key fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ publicKey: 'mock-public-key-1' }),
      }).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ publicKey: 'mock-public-key-2' }),
      });

      const result = await emailService.validateRecipients(recipients);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(recipients[0].publicKey).toBe('mock-public-key-1');
      expect(recipients[1].publicKey).toBe('mock-public-key-2');
    });

    it('should reject invalid email addresses', async () => {
      const recipients: EmailRecipient[] = [
        { email: 'invalid-email' },
        { email: 'another@invalid' },
      ];

      const result = await emailService.validateRecipients(recipients);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain('Invalid email address');
      expect(result.errors[1]).toContain('Invalid email address');
    });

    it('should warn about non-odyssie.net addresses', async () => {
      const recipients: EmailRecipient[] = [
        { email: 'user@gmail.com' },
      ];

      const result = await emailService.validateRecipients(recipients);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0]).toContain('not an @odyssie.net address');
    });

    it('should require at least one recipient', async () => {
      const result = await emailService.validateRecipients([]);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('At least one recipient is required');
    });
  });

  describe('Draft Validation', () => {
    it('should validate draft successfully', () => {
      const draft: EmailDraft = {
        to: [{ email: 'test@odyssie.net' }],
        subject: 'Test Subject',
        body: 'Test body content',
        attachments: [],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = emailService.validateDraft(draft);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should warn about empty subject and body', () => {
      const draft: EmailDraft = {
        to: [{ email: 'test@odyssie.net' }],
        subject: '',
        body: '',
        attachments: [],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = emailService.validateDraft(draft);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Email subject is empty');
      expect(result.warnings).toContain('Email body is empty');
    });

    it('should reject oversized attachments', () => {
      const largeAttachment: EmailAttachment = {
        id: 'test-attachment',
        name: 'large-file.pdf',
        size: 30 * 1024 * 1024, // 30MB
        type: 'application/pdf',
        data: new ArrayBuffer(30 * 1024 * 1024),
        encrypted: false,
      };

      const draft: EmailDraft = {
        to: [{ email: 'test@odyssie.net' }],
        subject: 'Test',
        body: 'Test',
        attachments: [largeAttachment],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = emailService.validateDraft(draft);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Attachment "large-file.pdf" exceeds maximum size of 25MB');
    });

    it('should reject total attachment size over limit', () => {
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
  });

  describe('Email Encryption', () => {
    it('should encrypt email successfully', async () => {
      const draft: EmailDraft = {
        to: [{ 
          email: 'recipient@odyssie.net',
          publicKey: 'mock-public-key'
        }],
        subject: 'Test Subject',
        body: 'Test email body',
        attachments: [],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const encryptedEmail = await emailService.encryptEmail(draft, 'user-key-id', 'user-password');

      expect(encryptedEmail).toBeDefined();
      expect(encryptedEmail.id).toBeDefined();
      expect(encryptedEmail.encryptedContent).toBeDefined();
      expect(encryptedEmail.encryptedSubject).toBeDefined();
      expect(encryptedEmail.senderSignature).toBeDefined();
      expect(encryptedEmail.recipientKeys).toBeDefined();
      expect(encryptedEmail.metadata).toBeDefined();
      
      // Verify crypto operations were called
      expect(CryptoEngine.generateAESKey).toHaveBeenCalled();
      expect(CryptoEngine.encryptAES).toHaveBeenCalledTimes(2); // subject + body
      expect(CryptoEngine.generateSignature).toHaveBeenCalled();
      expect(mockKeyManager.getKeyPair).toHaveBeenCalledWith('user-key-id', 'user-password');
    });

    it('should encrypt email with attachments', async () => {
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
        subject: 'Test with Attachment',
        body: 'Email with attachment',
        attachments: [attachment],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const encryptedEmail = await emailService.encryptEmail(draft, 'user-key-id', 'user-password');

      expect(encryptedEmail.encryptedAttachments).toHaveLength(1);
      expect(encryptedEmail.encryptedAttachments[0].id).toBe('test-attachment');
      expect(encryptedEmail.encryptedAttachments[0].encryptedName).toBeDefined();
      expect(encryptedEmail.encryptedAttachments[0].encryptedData).toBeDefined();
      expect(encryptedEmail.metadata.attachmentCount).toBe(1);
      
      // Should encrypt attachment name and data
      expect(CryptoEngine.encryptAES).toHaveBeenCalledTimes(4); // subject + body + attachment name + attachment data
    });

    it('should handle multiple recipients', async () => {
      const draft: EmailDraft = {
        to: [
          { email: 'recipient1@odyssie.net', publicKey: 'public-key-1' },
          { email: 'recipient2@odyssie.net', publicKey: 'public-key-2' },
        ],
        subject: 'Multi-recipient email',
        body: 'Email to multiple recipients',
        attachments: [],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const encryptedEmail = await emailService.encryptEmail(draft, 'user-key-id', 'user-password');

      expect(Object.keys(encryptedEmail.recipientKeys)).toHaveLength(2);
      expect(encryptedEmail.recipientKeys['recipient1@odyssie.net']).toBeDefined();
      expect(encryptedEmail.recipientKeys['recipient2@odyssie.net']).toBeDefined();
      expect(encryptedEmail.metadata.recipientIds).toEqual(['recipient1@odyssie.net', 'recipient2@odyssie.net']);
    });

    it('should handle encryption errors gracefully', async () => {
      // Mock encryption failure
      vi.mocked(CryptoEngine.encryptAES).mockRejectedValueOnce(new Error('Encryption failed'));

      const draft: EmailDraft = {
        to: [{ email: 'recipient@odyssie.net', publicKey: 'mock-public-key' }],
        subject: 'Test Subject',
        body: 'Test body',
        attachments: [],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await expect(emailService.encryptEmail(draft, 'user-key-id', 'user-password'))
        .rejects.toThrow('Failed to encrypt email');
    });
  });

  describe('Email Sending', () => {
    it('should send encrypted email successfully', async () => {
      const encryptedEmail: EncryptedEmail = {
        id: 'test-email-id',
        encryptedContent: 'encrypted-content',
        encryptedSubject: 'encrypted-subject',
        encryptedAttachments: [],
        senderSignature: 'signature',
        recipientKeys: { 'recipient@odyssie.net': 'encrypted-key' },
        metadata: {
          id: 'metadata-id',
          senderId: 'sender-id',
          senderEmail: 'sender@odyssie.net',
          recipientIds: ['recipient@odyssie.net'],
          timestamp: new Date(),
          size: 1024,
          attachmentCount: 0,
          isRead: false,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await expect(emailService.sendEmail(encryptedEmail)).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-auth-token',
        },
        body: JSON.stringify(encryptedEmail),
      });
    });

    it('should handle send errors', async () => {
      const encryptedEmail: EncryptedEmail = {
        id: 'test-email-id',
        encryptedContent: 'encrypted-content',
        encryptedSubject: 'encrypted-subject',
        encryptedAttachments: [],
        senderSignature: 'signature',
        recipientKeys: { 'recipient@odyssie.net': 'encrypted-key' },
        metadata: {
          id: 'metadata-id',
          senderId: 'sender-id',
          senderEmail: 'sender@odyssie.net',
          recipientIds: ['recipient@odyssie.net'],
          timestamp: new Date(),
          size: 1024,
          attachmentCount: 0,
          isRead: false,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ message: 'Server error' }),
      });

      await expect(emailService.sendEmail(encryptedEmail))
        .rejects.toThrow('Failed to send email: Server error');
    });

    it('should handle network errors', async () => {
      const encryptedEmail: EncryptedEmail = {
        id: 'test-email-id',
        encryptedContent: 'encrypted-content',
        encryptedSubject: 'encrypted-subject',
        encryptedAttachments: [],
        senderSignature: 'signature',
        recipientKeys: {},
        metadata: {
          id: 'metadata-id',
          senderId: 'sender-id',
          senderEmail: 'sender@odyssie.net',
          recipientIds: [],
          timestamp: new Date(),
          size: 1024,
          attachmentCount: 0,
          isRead: false,
        },
      };

      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(emailService.sendEmail(encryptedEmail))
        .rejects.toThrow('Failed to send email: Network error');
    });
  });

  describe('Attachment Processing', () => {
    it('should process file attachment successfully', async () => {
      const fileContent = 'Test file content';
      const file = new File([fileContent], 'test.txt', { type: 'text/plain' });

      const attachment = await emailService.processAttachment(file);

      expect(attachment).toBeDefined();
      expect(attachment.id).toBeDefined();
      expect(attachment.name).toBe('test.txt');
      expect(attachment.size).toBe(file.size);
      expect(attachment.type).toBe('text/plain');
      expect(attachment.data).toBeInstanceOf(ArrayBuffer);
      expect(attachment.encrypted).toBe(false);
    });

    it('should handle file reading errors', async () => {
      // Create a mock file that will cause FileReader to fail
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      
      // Mock FileReader to simulate error
      const originalFileReader = global.FileReader;
      global.FileReader = vi.fn().mockImplementation(() => ({
        readAsArrayBuffer: vi.fn().mockImplementation(function() {
          setTimeout(() => this.onerror(), 0);
        }),
        onerror: null,
        onload: null,
      })) as any;

      await expect(emailService.processAttachment(file))
        .rejects.toThrow('Failed to read file');

      // Restore FileReader
      global.FileReader = originalFileReader;
    });
  });

  describe('Draft Management', () => {
    it('should create empty draft', () => {
      const draft = emailService.createEmptyDraft();

      expect(draft).toBeDefined();
      expect(draft.to).toEqual([]);
      expect(draft.cc).toEqual([]);
      expect(draft.bcc).toEqual([]);
      expect(draft.subject).toBe('');
      expect(draft.body).toBe('');
      expect(draft.attachments).toEqual([]);
      expect(draft.isEncrypted).toBe(true);
      expect(draft.createdAt).toBeInstanceOf(Date);
      expect(draft.updatedAt).toBeInstanceOf(Date);
    });

    it('should save draft to localStorage', () => {
      const draft: EmailDraft = {
        to: [{ email: 'test@odyssie.net' }],
        subject: 'Draft Subject',
        body: 'Draft body',
        attachments: [],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      emailService.saveDraft(draft);

      expect(draft.id).toBeDefined();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'emailDrafts',
        expect.stringContaining(draft.id!)
      );
    });

    it('should get saved drafts from localStorage', () => {
      const mockDrafts = {
        'draft-1': { id: 'draft-1', subject: 'Draft 1' },
        'draft-2': { id: 'draft-2', subject: 'Draft 2' },
      };

      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(mockDrafts));

      const drafts = emailService.getSavedDrafts();

      expect(drafts).toEqual(mockDrafts);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('emailDrafts');
    });

    it('should handle corrupted draft data', () => {
      mockLocalStorage.getItem.mockReturnValueOnce('invalid-json');

      const drafts = emailService.getSavedDrafts();

      expect(drafts).toEqual({});
    });

    it('should delete draft from localStorage', () => {
      const mockDrafts = {
        'draft-1': { id: 'draft-1', subject: 'Draft 1' },
        'draft-2': { id: 'draft-2', subject: 'Draft 2' },
      };

      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(mockDrafts));

      emailService.deleteDraft('draft-1');

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'emailDrafts',
        JSON.stringify({ 'draft-2': { id: 'draft-2', subject: 'Draft 2' } })
      );
    });
  });

  describe('Email Management Features', () => {
    it('should get inbox successfully', async () => {
      const mockInboxData = {
        emails: [
          {
            id: 'email-1',
            subject: 'Test Email 1',
            senderId: 'sender-1',
            timestamp: new Date(),
            isRead: false,
          },
        ],
        hasMore: false,
        totalCount: 1,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockInboxData }),
      });

      const result = await emailService.getInbox(1, 20, 'inbox');

      expect(result).toEqual(mockInboxData);
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/email/inbox?page=1&limit=20&folder=inbox',
        {
          headers: {
            'Authorization': 'Bearer test-auth-token',
          },
        }
      );
    });

    it('should delete email successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await expect(emailService.deleteEmail('email-id')).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith('/api/email/email-id', {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer test-auth-token',
        },
      });
    });

    it('should mark email as read', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await expect(emailService.markAsRead('email-id')).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith('/api/email/email-id/read', {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer test-auth-token',
        },
      });
    });

    it('should mark email as unread', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await expect(emailService.markAsUnread('email-id')).resolves.not.toThrow();

      expect(mockFetch).toHaveBeenCalledWith('/api/email/email-id/unread', {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer test-auth-token',
        },
      });
    });
  });

  describe('Public Key Management', () => {
    it('should fetch recipient public key successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ publicKey: 'mock-public-key' }),
      });

      const recipients: EmailRecipient[] = [{ email: 'test@odyssie.net' }];
      await emailService.validateRecipients(recipients);

      expect(recipients[0].publicKey).toBe('mock-public-key');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users/public-key/test%40odyssie.net',
        {
          headers: {
            'Authorization': 'Bearer test-auth-token',
          },
        }
      );
    });

    it('should handle missing public key', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const recipients: EmailRecipient[] = [{ email: 'test@odyssie.net' }];
      const result = await emailService.validateRecipients(recipients);

      expect(result.warnings).toContain('No public key found for test@odyssie.net. Email will be sent unencrypted.');
    });
  });
});