/**
 * Email service for handling email composition, encryption, and sending
 */

import { CryptoEngine } from './crypto';
import { KeyManager } from './keyManager';
import { EmailDraft, EmailRecipient, EmailAttachment, EncryptedEmail, EmailValidationResult, EmailMetadata } from '../types/email';
import { SearchService, SearchOptions, SearchResult } from './searchService';
import { FolderService, EmailFolder, EmailLabel } from './folderService';
import { SpamService, SpamCheckResult } from './spamService';

export class EmailService {
  private keyManager: KeyManager;
  private apiBaseUrl: string;
  private searchService: SearchService;
  private folderService: FolderService;
  private spamService: SpamService;

  constructor(apiBaseUrl: string = '/api') {
    this.keyManager = new KeyManager();
    this.apiBaseUrl = apiBaseUrl;
    this.searchService = new SearchService(apiBaseUrl);
    this.folderService = new FolderService(apiBaseUrl);
    this.spamService = new SpamService(apiBaseUrl);
  }

  /**
   * Initialize the email service
   */
  async initialize(): Promise<void> {
    await this.keyManager.initialize();
  }

  /**
   * Validate email recipients
   */
  async validateRecipients(recipients: EmailRecipient[]): Promise<EmailValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (recipients.length === 0) {
      errors.push('At least one recipient is required');
    }

    for (const recipient of recipients) {
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(recipient.email)) {
        errors.push(`Invalid email address: ${recipient.email}`);
        continue;
      }

      // Check if recipient has a public key (for @odyssie.net addresses)
      if (recipient.email.endsWith('@odyssie.net')) {
        try {
          const publicKey = await this.fetchRecipientPublicKey(recipient.email);
          if (!publicKey) {
            warnings.push(`No public key found for ${recipient.email}. Email will be sent unencrypted.`);
          } else {
            recipient.publicKey = publicKey;
          }
        } catch (error) {
          warnings.push(`Could not verify encryption capability for ${recipient.email}`);
        }
      } else {
        warnings.push(`${recipient.email} is not an @odyssie.net address. Email will be sent unencrypted.`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate email draft
   */
  validateDraft(draft: EmailDraft): EmailValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!draft.subject.trim()) {
      warnings.push('Email subject is empty');
    }

    if (!draft.body.trim()) {
      warnings.push('Email body is empty');
    }

    // Check attachment sizes
    const maxAttachmentSize = 25 * 1024 * 1024; // 25MB
    const totalSize = draft.attachments.reduce((sum, att) => sum + att.size, 0);
    const maxTotalSize = 100 * 1024 * 1024; // 100MB

    for (const attachment of draft.attachments) {
      if (attachment.size > maxAttachmentSize) {
        errors.push(`Attachment "${attachment.name}" exceeds maximum size of 25MB`);
      }
    }

    if (totalSize > maxTotalSize) {
      errors.push('Total attachment size exceeds maximum of 100MB');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Encrypt email content for sending
   */
  async encryptEmail(draft: EmailDraft, userKeyId: string, userPassword: string): Promise<EncryptedEmail> {
    try {
      // Get user's key pair for signing
      const userKeyPair = await this.keyManager.getKeyPair(userKeyId, userPassword);
      
      // Generate AES key for email content
      const contentKey = await CryptoEngine.generateAESKey();
      
      // Encrypt subject and body
      const subjectBuffer = CryptoEngine.stringToArrayBuffer(draft.subject);
      const bodyBuffer = CryptoEngine.stringToArrayBuffer(draft.body);
      
      const encryptedSubject = await CryptoEngine.encryptAES(subjectBuffer, contentKey);
      const encryptedBody = await CryptoEngine.encryptAES(bodyBuffer, contentKey);
      
      // Encrypt attachments
      const encryptedAttachments = await Promise.all(
        draft.attachments.map(async (attachment) => {
          const encryptedData = await CryptoEngine.encryptAES(attachment.data, contentKey);
          const encryptedName = await CryptoEngine.encryptAES(
            CryptoEngine.stringToArrayBuffer(attachment.name),
            contentKey
          );
          
          return {
            id: attachment.id,
            encryptedName: CryptoEngine.arrayBufferToBase64(encryptedName.data),
            encryptedData: CryptoEngine.arrayBufferToBase64(encryptedData.data),
            size: attachment.size,
            mimeType: attachment.type
          };
        })
      );
      
      // Create email content for signing
      const emailContent = JSON.stringify({
        subject: CryptoEngine.arrayBufferToBase64(encryptedSubject.data),
        body: CryptoEngine.arrayBufferToBase64(encryptedBody.data),
        attachments: encryptedAttachments,
        timestamp: new Date().toISOString()
      });
      
      // Sign the email content
      const signature = await CryptoEngine.generateSignature(
        CryptoEngine.stringToArrayBuffer(emailContent),
        userKeyPair.privateKey
      );
      
      // Encrypt content key for each recipient
      const recipientKeys: { [userId: string]: string } = {};
      
      for (const recipient of draft.to) {
        if (recipient.publicKey) {
          try {
            // Import recipient's public key
            const recipientPublicKey = await CryptoEngine.importKey(
              CryptoEngine.base64ToArrayBuffer(recipient.publicKey),
              {
                name: 'RSA-OAEP',
                hash: 'SHA-256'
              },
              false,
              ['encrypt'],
              'spki'
            );
            
            // Export and encrypt the content key
            const contentKeyBuffer = await CryptoEngine.exportKey(contentKey);
            const encryptedContentKey = await CryptoEngine.encryptRSA(contentKeyBuffer, recipientPublicKey);
            
            recipientKeys[recipient.email] = CryptoEngine.arrayBufferToBase64(encryptedContentKey);
          } catch (error) {
            console.warn(`Failed to encrypt for recipient ${recipient.email}:`, error);
          }
        }
      }
      
      return {
        id: crypto.randomUUID(),
        encryptedContent: emailContent,
        encryptedSubject: CryptoEngine.arrayBufferToBase64(encryptedSubject.data),
        encryptedAttachments,
        senderSignature: CryptoEngine.arrayBufferToBase64(signature),
        recipientKeys,
        metadata: {
          id: crypto.randomUUID(),
          senderId: userKeyId,
          senderEmail: '', // Will be filled by backend
          recipientIds: draft.to.map(r => r.email),
          timestamp: new Date(),
          size: new Blob([emailContent]).size,
          attachmentCount: draft.attachments.length,
          isRead: false
        }
      };
    } catch (error) {
      throw new Error(`Failed to encrypt email: ${error}`);
    }
  }

  /**
   * Send encrypted email
   */
  async sendEmail(encryptedEmail: EncryptedEmail): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/email/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(encryptedEmail)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to send email');
      }
    } catch (error) {
      throw new Error(`Failed to send email: ${error}`);
    }
  }

  /**
   * Process file for attachment
   */
  async processAttachment(file: File): Promise<EmailAttachment> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        resolve({
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          type: file.type,
          data: reader.result as ArrayBuffer,
          encrypted: false
        });
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Fetch recipient's public key
   */
  private async fetchRecipientPublicKey(email: string): Promise<string | null> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/users/public-key/${encodeURIComponent(email)}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.publicKey;
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to fetch public key:', error);
      return null;
    }
  }

  /**
   * Get authentication token from storage
   */
  private getAuthToken(): string {
    return localStorage.getItem('authToken') || '';
  }

  /**
   * Create empty draft
   */
  createEmptyDraft(): EmailDraft {
    return {
      to: [],
      cc: [],
      bcc: [],
      subject: '',
      body: '',
      attachments: [],
      isEncrypted: true,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  /**
   * Save draft to local storage
   */
  saveDraft(draft: EmailDraft): void {
    const drafts = this.getSavedDrafts();
    const draftId = draft.id || crypto.randomUUID();
    draft.id = draftId;
    draft.updatedAt = new Date();
    
    drafts[draftId] = draft;
    localStorage.setItem('emailDrafts', JSON.stringify(drafts));
  }

  /**
   * Get saved drafts from local storage
   */
  getSavedDrafts(): { [id: string]: EmailDraft } {
    try {
      const drafts = localStorage.getItem('emailDrafts');
      return drafts ? JSON.parse(drafts) : {};
    } catch (error) {
      console.warn('Failed to load drafts:', error);
      return {};
    }
  }

  /**
   * Delete draft from local storage
   */
  deleteDraft(draftId: string): void {
    const drafts = this.getSavedDrafts();
    delete drafts[draftId];
    localStorage.setItem('emailDrafts', JSON.stringify(drafts));
  }

  // Email Management Features

  /**
   * Search emails by content
   */
  async searchEmails(options: SearchOptions): Promise<SearchResult[]> {
    return this.searchService.searchEmails(options);
  }

  /**
   * Get inbox with folder support
   */
  async getInbox(page: number = 1, limit: number = 20, folder: string = 'inbox'): Promise<{
    emails: EmailMetadata[];
    hasMore: boolean;
    totalCount: number;
  }> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/email/inbox?page=${page}&limit=${limit}&folder=${folder}`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch inbox');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      throw new Error(`Failed to get inbox: ${error}`);
    }
  }

  /**
   * Delete email
   */
  async deleteEmail(emailId: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/email/${emailId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete email');
      }
    } catch (error) {
      throw new Error(`Failed to delete email: ${error}`);
    }
  }

  /**
   * Archive email (move to archive folder)
   */
  async archiveEmail(emailId: string): Promise<void> {
    return this.moveToFolder(emailId, 'archive');
  }

  /**
   * Move email to folder
   */
  async moveToFolder(emailId: string, folderId: string): Promise<void> {
    return this.folderService.moveEmailToFolder(emailId, folderId);
  }

  /**
   * Move multiple emails to folder
   */
  async moveEmailsToFolder(emailIds: string[], folderId: string): Promise<void> {
    return this.folderService.moveEmailsToFolder(emailIds, folderId);
  }

  /**
   * Mark email as read
   */
  async markAsRead(emailId: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/email/${emailId}/read`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to mark as read');
      }
    } catch (error) {
      throw new Error(`Failed to mark as read: ${error}`);
    }
  }

  /**
   * Mark email as unread
   */
  async markAsUnread(emailId: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/email/${emailId}/unread`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to mark as unread');
      }
    } catch (error) {
      throw new Error(`Failed to mark as unread: ${error}`);
    }
  }

  /**
   * Report email as spam
   */
  async reportSpam(emailId: string): Promise<void> {
    await this.spamService.reportSpam(emailId);
    // Move to spam folder
    await this.moveToFolder(emailId, 'spam');
  }

  /**
   * Mark email as not spam
   */
  async markNotSpam(emailId: string): Promise<void> {
    await this.spamService.markNotSpam(emailId);
    // Move back to inbox
    await this.moveToFolder(emailId, 'inbox');
  }

  /**
   * Check if email content is spam
   */
  async checkSpam(emailContent: {
    senderEmail: string;
    subject: string;
    body: string;
    attachments: { name: string; type: string }[];
  }): Promise<SpamCheckResult> {
    return this.spamService.checkSpam(emailContent);
  }

  // Folder Management

  /**
   * Get all folders
   */
  async getFolders(): Promise<EmailFolder[]> {
    return this.folderService.getFolders();
  }

  /**
   * Create new folder
   */
  async createFolder(name: string, color?: string, icon?: string): Promise<EmailFolder> {
    return this.folderService.createFolder(name, color, icon);
  }

  /**
   * Update folder
   */
  async updateFolder(folderId: string, updates: Partial<EmailFolder>): Promise<EmailFolder> {
    return this.folderService.updateFolder(folderId, updates);
  }

  /**
   * Delete folder
   */
  async deleteFolder(folderId: string, moveEmailsToFolderId?: string): Promise<void> {
    return this.folderService.deleteFolder(folderId, moveEmailsToFolderId);
  }

  // Label Management

  /**
   * Get all labels
   */
  async getLabels(): Promise<EmailLabel[]> {
    return this.folderService.getLabels();
  }

  /**
   * Create new label
   */
  async createLabel(name: string, color: string): Promise<EmailLabel> {
    return this.folderService.createLabel(name, color);
  }

  /**
   * Add label to email
   */
  async addLabelToEmail(emailId: string, labelId: string): Promise<void> {
    return this.folderService.addLabelToEmail(emailId, labelId);
  }

  /**
   * Remove label from email
   */
  async removeLabelFromEmail(emailId: string, labelId: string): Promise<void> {
    return this.folderService.removeLabelFromEmail(emailId, labelId);
  }
}