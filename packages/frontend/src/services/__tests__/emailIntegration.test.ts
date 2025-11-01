/**
 * Email Integration Tests
 * Tests complete email flows between users including encryption, sending, receiving, and decryption
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmailService } from '../emailService';
import { CryptoEngine } from '../crypto';
import { KeyManager } from '../keyManager';
import { EmailDraft, EmailRecipient, EncryptedEmail } from '../../types/email';

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

describe('Email Integration Tests', () => {
  let senderEmailService: EmailService;
  let recipientEmailService: EmailService;
  let senderKeyPair: any;
  let recipientKeyPair: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    
    // Initialize services
    senderEmailService = new EmailService('/api');
    recipientEmailService = new EmailService('/api');

    // Generate real key pairs for testing
    senderKeyPair = await CryptoEngine.generateRSAKeyPair();
    recipientKeyPair = await CryptoEngine.generateRSAKeyPair();

    // Mock KeyManager to return real key pairs
    vi.mocked(KeyManager).mockImplementation(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
      getKeyPair: vi.fn().mockImplementation((keyId: string) => {
        if (keyId === 'sender-key-id') return Promise.resolve(senderKeyPair);
        if (keyId === 'recipient-key-id') return Promise.resolve(recipientKeyPair);
        return Promise.resolve(senderKeyPair);
      }),
    }) as any);

    // Setup localStorage
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

  describe('Complete Email Flow', () => {
    it('should complete full email encryption, sending, and receiving flow', async () => {
      // Step 1: Sender creates and validates draft
      const draft: EmailDraft = {
        to: [{ email: 'recipient@odyssie.net' }],
        subject: 'Integration Test Email',
        body: 'This is a test email for integration testing.',
        attachments: [],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Step 2: Mock recipient public key fetch
      const recipientPublicKeyBuffer = await CryptoEngine.exportKey(recipientKeyPair.publicKey, 'spki');
      const recipientPublicKeyBase64 = CryptoEngine.arrayBufferToBase64(recipientPublicKeyBuffer);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ publicKey: recipientPublicKeyBase64 }),
      });

      // Step 3: Validate recipients (this will fetch public keys)
      const validationResult = await senderEmailService.validateRecipients(draft.to);
      expect(validationResult.isValid).toBe(true);
      expect(draft.to[0].publicKey).toBe(recipientPublicKeyBase64);

      // Step 4: Validate draft
      const draftValidation = senderEmailService.validateDraft(draft);
      expect(draftValidation.isValid).toBe(true);

      // Step 5: Encrypt email
      const encryptedEmail = await senderEmailService.encryptEmail(draft, 'sender-key-id', 'sender-password');
      
      expect(encryptedEmail).toBeDefined();
      expect(encryptedEmail.encryptedContent).toBeDefined();
      expect(encryptedEmail.encryptedSubject).toBeDefined();
      expect(encryptedEmail.recipientKeys['recipient@odyssie.net']).toBeDefined();

      // Step 6: Mock successful send
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          id: encryptedEmail.id,
          status: 'sent',
          deliveredAt: new Date().toISOString()
        }),
      });

      // Step 7: Send email
      await expect(senderEmailService.sendEmail(encryptedEmail)).resolves.not.toThrow();

      // Step 8: Verify send API was called correctly
      expect(mockFetch).toHaveBeenCalledWith('/api/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-auth-token',
        },
        body: JSON.stringify(encryptedEmail),
      });

      // Step 9: Mock recipient inbox fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          data: {
            emails: [{
              id: encryptedEmail.id,
              senderId: 'sender-key-id',
              senderEmail: 'sender@odyssie.net',
              subject: encryptedEmail.encryptedSubject,
              timestamp: new Date(),
              size: encryptedEmail.metadata.size,
              attachmentCount: 0,
              isRead: false,
            }],
            hasMore: false,
            totalCount: 1,
          }
        }),
      });

      // Step 10: Recipient gets inbox
      const inbox = await recipientEmailService.getInbox();
      expect(inbox.emails).toHaveLength(1);
      expect(inbox.emails[0].id).toBe(encryptedEmail.id);
    });

    it('should handle email with attachments end-to-end', async () => {
      // Create test attachment
      const attachmentContent = 'Test document content';
      const attachmentBuffer = CryptoEngine.stringToArrayBuffer(attachmentContent);
      
      const attachment = await senderEmailService.processAttachment(
        new File([attachmentBuffer], 'test-document.txt', { type: 'text/plain' })
      );

      const draft: EmailDraft = {
        to: [{ email: 'recipient@odyssie.net' }],
        subject: 'Email with Attachment',
        body: 'Please find the attached document.',
        attachments: [attachment],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock recipient public key fetch
      const recipientPublicKeyBuffer = await CryptoEngine.exportKey(recipientKeyPair.publicKey, 'spki');
      const recipientPublicKeyBase64 = CryptoEngine.arrayBufferToBase64(recipientPublicKeyBuffer);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ publicKey: recipientPublicKeyBase64 }),
      });

      // Validate and encrypt
      await senderEmailService.validateRecipients(draft.to);
      const encryptedEmail = await senderEmailService.encryptEmail(draft, 'sender-key-id', 'sender-password');

      // Verify attachment encryption
      expect(encryptedEmail.encryptedAttachments).toHaveLength(1);
      expect(encryptedEmail.encryptedAttachments[0].encryptedName).toBeDefined();
      expect(encryptedEmail.encryptedAttachments[0].encryptedData).toBeDefined();
      expect(encryptedEmail.metadata.attachmentCount).toBe(1);

      // Mock successful send
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await expect(senderEmailService.sendEmail(encryptedEmail)).resolves.not.toThrow();
    });

    it('should handle multiple recipients correctly', async () => {
      const draft: EmailDraft = {
        to: [
          { email: 'recipient1@odyssie.net' },
          { email: 'recipient2@odyssie.net' },
        ],
        subject: 'Multi-recipient Email',
        body: 'This email goes to multiple recipients.',
        attachments: [],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock public key fetches for both recipients
      const publicKeyBuffer = await CryptoEngine.exportKey(recipientKeyPair.publicKey, 'spki');
      const publicKeyBase64 = CryptoEngine.arrayBufferToBase64(publicKeyBuffer);

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ publicKey: publicKeyBase64 }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ publicKey: publicKeyBase64 }),
        });

      // Validate recipients
      const validationResult = await senderEmailService.validateRecipients(draft.to);
      expect(validationResult.isValid).toBe(true);
      expect(draft.to[0].publicKey).toBe(publicKeyBase64);
      expect(draft.to[1].publicKey).toBe(publicKeyBase64);

      // Encrypt email
      const encryptedEmail = await senderEmailService.encryptEmail(draft, 'sender-key-id', 'sender-password');

      // Verify both recipients have encrypted keys
      expect(Object.keys(encryptedEmail.recipientKeys)).toHaveLength(2);
      expect(encryptedEmail.recipientKeys['recipient1@odyssie.net']).toBeDefined();
      expect(encryptedEmail.recipientKeys['recipient2@odyssie.net']).toBeDefined();
      expect(encryptedEmail.metadata.recipientIds).toEqual(['recipient1@odyssie.net', 'recipient2@odyssie.net']);

      // Mock successful send
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await expect(senderEmailService.sendEmail(encryptedEmail)).resolves.not.toThrow();
    });
  });

  describe('Error Handling in Integration Flow', () => {
    it('should handle recipient validation failure gracefully', async () => {
      const draft: EmailDraft = {
        to: [{ email: 'nonexistent@odyssie.net' }],
        subject: 'Test Email',
        body: 'Test body',
        attachments: [],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock failed public key fetch
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const validationResult = await senderEmailService.validateRecipients(draft.to);
      expect(validationResult.warnings).toContain('No public key found for nonexistent@odyssie.net. Email will be sent unencrypted.');
    });

    it('should handle encryption failure in complete flow', async () => {
      const draft: EmailDraft = {
        to: [{ email: 'recipient@odyssie.net', publicKey: 'invalid-key' }],
        subject: 'Test Email',
        body: 'Test body',
        attachments: [],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // This should fail during encryption due to invalid public key format
      await expect(senderEmailService.encryptEmail(draft, 'sender-key-id', 'sender-password'))
        .rejects.toThrow('Failed to encrypt email');
    });

    it('should handle send failure after successful encryption', async () => {
      const draft: EmailDraft = {
        to: [{ email: 'recipient@odyssie.net' }],
        subject: 'Test Email',
        body: 'Test body',
        attachments: [],
        isEncrypted: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock successful public key fetch
      const publicKeyBuffer = await CryptoEngine.exportKey(recipientKeyPair.publicKey, 'spki');
      const publicKeyBase64 = CryptoEngine.arrayBufferToBase64(publicKeyBuffer);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ publicKey: publicKeyBase64 }),
      });

      // Validate and encrypt successfully
      await senderEmailService.validateRecipients(draft.to);
      const encryptedEmail = await senderEmailService.encryptEmail(draft, 'sender-key-id', 'sender-password');

      // Mock send failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ message: 'Server error during send' }),
      });

      await expect(senderEmailService.sendEmail(encryptedEmail))
        .rejects.toThrow('Failed to send email: Server error during send');
    });

    it('should handle inbox fetch failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(recipientEmailService.getInbox())
        .rejects.toThrow('Failed to get inbox');
    });
  });

  describe('Email Management Integration', () => {
    it('should complete email management operations', async () => {
      const emailId = 'test-email-id';

      // Test mark as read
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await expect(recipientEmailService.markAsRead(emailId)).resolves.not.toThrow();

      // Test mark as unread
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await expect(recipientEmailService.markAsUnread(emailId)).resolves.not.toThrow();

      // Test delete
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await expect(recipientEmailService.deleteEmail(emailId)).resolves.not.toThrow();

      // Verify all operations called the correct endpoints
      expect(mockFetch).toHaveBeenCalledWith(`/api/email/${emailId}/read`, expect.any(Object));
      expect(mockFetch).toHaveBeenCalledWith(`/api/email/${emailId}/unread`, expect.any(Object));
      expect(mockFetch).toHaveBeenCalledWith(`/api/email/${emailId}`, expect.objectContaining({
        method: 'DELETE',
      }));
    });

    it('should handle folder operations', async () => {
      const emailId = 'test-email-id';
      const folderId = 'archive';

      // Mock folder service calls through email service
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      await expect(recipientEmailService.archiveEmail(emailId)).resolves.not.toThrow();
    });
  });

  describe('Draft Management Integration', () => {
    it('should manage drafts throughout email composition', async () => {
      // Create initial draft
      const draft = senderEmailService.createEmptyDraft();
      expect(draft.to).toEqual([]);
      expect(draft.subject).toBe('');

      // Update draft content
      draft.to = [{ email: 'recipient@odyssie.net' }];
      draft.subject = 'Draft Subject';
      draft.body = 'Draft content';

      // Save draft
      senderEmailService.saveDraft(draft);
      expect(draft.id).toBeDefined();
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'emailDrafts',
        expect.stringContaining(draft.id!)
      );

      // Retrieve drafts
      const savedDrafts = { [draft.id!]: draft };
      mockLocalStorage.getItem.mockReturnValueOnce(JSON.stringify(savedDrafts));

      const retrievedDrafts = senderEmailService.getSavedDrafts();
      expect(retrievedDrafts[draft.id!]).toBeDefined();
      expect(retrievedDrafts[draft.id!].subject).toBe('Draft Subject');

      // Delete draft after sending
      senderEmailService.deleteDraft(draft.id!);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'emailDrafts',
        '{}'
      );
    });
  });
});