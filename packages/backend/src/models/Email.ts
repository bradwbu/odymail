import mongoose, { Document, Schema } from 'mongoose';

export interface IEmailMetadata extends Document {
  id: string;
  senderId: string;
  recipientIds: string[];
  subject: string; // encrypted
  timestamp: Date;
  size: number;
  attachmentCount: number;
  isRead: boolean;
  folderId?: string;
  deliveryStatus: 'pending' | 'delivered' | 'failed';
  deliveryAttempts: number;
  lastDeliveryAttempt?: Date;
}

export interface IEncryptedEmail extends Document {
  id: string;
  encryptedContent: string; // AES encrypted email body
  encryptedSubject: string; // AES encrypted subject
  encryptedAttachments: IEncryptedAttachment[];
  senderSignature: string; // Digital signature
  recipientKeys: Map<string, string>; // AES key encrypted with recipient's public key
}

export interface IEncryptedAttachment {
  id: string;
  filename: string; // encrypted
  encryptedContent: string; // Base64 encoded encrypted content
  size: number;
  mimeType: string;
  encryptionKey: string; // encrypted with email's AES key
}

const emailMetadataSchema = new Schema<IEmailMetadata>({
  senderId: {
    type: String,
    required: true,
    ref: 'User'
  },
  recipientIds: [{
    type: String,
    required: true,
    ref: 'User'
  }],
  subject: {
    type: String,
    required: true // encrypted subject
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  size: {
    type: Number,
    required: true
  },
  attachmentCount: {
    type: Number,
    default: 0
  },
  isRead: {
    type: Boolean,
    default: false
  },
  folderId: {
    type: String,
    default: 'inbox'
  },
  deliveryStatus: {
    type: String,
    enum: ['pending', 'delivered', 'failed'],
    default: 'pending'
  },
  deliveryAttempts: {
    type: Number,
    default: 0
  },
  lastDeliveryAttempt: {
    type: Date
  }
}, {
  timestamps: true
});

const encryptedAttachmentSchema = new Schema<IEncryptedAttachment>({
  filename: {
    type: String,
    required: true // encrypted filename
  },
  encryptedContent: {
    type: String,
    required: true // Base64 encoded encrypted content
  },
  size: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  encryptionKey: {
    type: String,
    required: true // encrypted with email's AES key
  }
});

const encryptedEmailSchema = new Schema<IEncryptedEmail>({
  encryptedContent: {
    type: String,
    required: true
  },
  encryptedSubject: {
    type: String,
    required: true
  },
  encryptedAttachments: [encryptedAttachmentSchema],
  senderSignature: {
    type: String,
    required: true
  },
  recipientKeys: {
    type: Map,
    of: String,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
emailMetadataSchema.index({ senderId: 1, timestamp: -1 });
emailMetadataSchema.index({ recipientIds: 1, timestamp: -1 });
emailMetadataSchema.index({ deliveryStatus: 1, deliveryAttempts: 1 });

export const EmailMetadata = mongoose.model<IEmailMetadata>('EmailMetadata', emailMetadataSchema);
export const EncryptedEmail = mongoose.model<IEncryptedEmail>('EncryptedEmail', encryptedEmailSchema);