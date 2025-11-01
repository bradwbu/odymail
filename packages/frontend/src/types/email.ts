/**
 * Email-related type definitions for the encrypted email service
 */

export interface EmailRecipient {
  email: string;
  name?: string;
  publicKey?: string;
}

export interface EmailAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  data: ArrayBuffer;
  encrypted?: boolean;
}

export interface EmailDraft {
  id?: string;
  to: EmailRecipient[];
  cc?: EmailRecipient[];
  bcc?: EmailRecipient[];
  subject: string;
  body: string;
  attachments: EmailAttachment[];
  isEncrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface EncryptedEmail {
  id: string;
  encryptedContent: string;
  encryptedSubject: string;
  encryptedAttachments: EncryptedEmailAttachment[];
  senderSignature: string;
  recipientKeys: { [userId: string]: string };
  metadata: EmailMetadata;
}

export interface EncryptedEmailAttachment {
  id: string;
  encryptedName: string;
  encryptedData: string;
  size: number;
  mimeType: string;
}

export interface EmailMetadata {
  id: string;
  senderId: string;
  senderEmail: string;
  recipientIds?: string[];
  timestamp: Date;
  size: number;
  attachmentCount: number;
  isRead: boolean;
  folderId?: string;
  deliveryStatus?: string;
}

export interface EmailValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ComposeState {
  isOpen: boolean;
  isMinimized: boolean;
  isExpanded: boolean;
  draft: EmailDraft;
  isSending: boolean;
  validationResult?: EmailValidationResult;
}

export interface EmailDetailResponse {
  metadata: {
    id: string;
    senderId: string;
    senderEmail: string;
    recipientIds: string[];
    subject: string;
    timestamp: Date;
    size: number;
    attachmentCount: number;
    isRead: boolean;
  };
  encryptedContent: string;
  encryptedSubject: string;
  encryptedAttachments: EncryptedEmailAttachment[];
  senderSignature: string;
  recipientKey: string;
}