import { EmailMetadata, EncryptedEmail, IEncryptedAttachment } from '../models/Email.js';
import { User } from '../models/User.js';
import { MessageQueue } from '../utils/messageQueue.js';
import { NotificationService } from './notificationService.js';

export interface SendEmailRequest {
  recipientEmails: string[];
  encryptedSubject: string;
  encryptedContent: string;
  encryptedAttachments: IEncryptedAttachment[];
  senderSignature: string;
  recipientKeys: { [email: string]: string }; // AES key encrypted with recipient's public key
  size: number;
}

export interface EmailListResponse {
  emails: {
    id: string;
    senderId: string;
    senderEmail: string;
    subject: string; // encrypted
    timestamp: Date;
    size: number;
    attachmentCount: number;
    isRead: boolean;
    deliveryStatus: string;
  }[];
  totalCount: number;
  hasMore: boolean;
}

export interface EmailDetailResponse {
  metadata: {
    id: string;
    senderId: string;
    senderEmail: string;
    recipientIds: string[];
    subject: string; // encrypted
    timestamp: Date;
    size: number;
    attachmentCount: number;
    isRead: boolean;
  };
  encryptedContent: string;
  encryptedSubject: string;
  encryptedAttachments: IEncryptedAttachment[];
  senderSignature: string;
  recipientKey: string; // AES key encrypted with user's public key
}

export class EmailService {
  private static messageQueue = new MessageQueue();

  /**
   * Send an encrypted email
   */
  static async sendEmail(senderId: string, emailData: SendEmailRequest): Promise<{ id: string; deliveryStatus: string }> {
    // Validate sender exists
    const sender = await User.findById(senderId);
    if (!sender) {
      throw new Error('Sender not found');
    }

    // Validate and get recipients
    const recipients = await User.find({
      email: { $in: emailData.recipientEmails }
    });

    if (recipients.length !== emailData.recipientEmails.length) {
      const foundEmails = recipients.map(r => r.email);
      const notFound = emailData.recipientEmails.filter(email => !foundEmails.includes(email));
      throw new Error(`Recipients not found: ${notFound.join(', ')}`);
    }

    // Create encrypted email document
    const encryptedEmail = new EncryptedEmail({
      encryptedContent: emailData.encryptedContent,
      encryptedSubject: emailData.encryptedSubject,
      encryptedAttachments: emailData.encryptedAttachments,
      senderSignature: emailData.senderSignature,
      recipientKeys: new Map(
        recipients.map(recipient => [
          recipient._id.toString(),
          emailData.recipientKeys[recipient.email]
        ])
      )
    });

    await encryptedEmail.save();

    // Create metadata document
    const emailMetadata = new EmailMetadata({
      senderId: senderId,
      recipientIds: recipients.map(r => r._id.toString()),
      subject: emailData.encryptedSubject,
      size: emailData.size,
      attachmentCount: emailData.encryptedAttachments.length,
      deliveryStatus: 'pending'
    });

    await emailMetadata.save();

    // Queue email for delivery
    await this.messageQueue.enqueue('email-delivery', {
      emailId: emailMetadata._id.toString(),
      encryptedEmailId: encryptedEmail._id.toString(),
      senderId: senderId,
      recipientIds: recipients.map(r => r._id.toString()),
      timestamp: new Date()
    });

    return {
      id: emailMetadata._id.toString(),
      deliveryStatus: 'pending'
    };
  }

  /**
   * Get inbox emails for a user
   */
  static async getInbox(
    userId: string, 
    page: number = 1, 
    limit: number = 20,
    folderId: string = 'inbox'
  ): Promise<EmailListResponse> {
    const skip = (page - 1) * limit;

    // Get emails where user is a recipient
    const emails = await EmailMetadata.find({
      recipientIds: userId,
      folderId: folderId
    })
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit + 1) // Get one extra to check if there are more
    .populate('senderId', 'email');

    const hasMore = emails.length > limit;
    const emailList = emails.slice(0, limit);

    // Get total count for pagination
    const totalCount = await EmailMetadata.countDocuments({
      recipientIds: userId,
      folderId: folderId
    });

    return {
      emails: emailList.map(email => ({
        id: email._id.toString(),
        senderId: (email.senderId as any)._id.toString(),
        senderEmail: (email.senderId as any).email,
        subject: email.subject,
        timestamp: email.timestamp,
        size: email.size,
        attachmentCount: email.attachmentCount,
        isRead: email.isRead,
        deliveryStatus: email.deliveryStatus
      })),
      totalCount,
      hasMore
    };
  }

  /**
   * Get sent emails for a user
   */
  static async getSentEmails(
    userId: string, 
    page: number = 1, 
    limit: number = 20
  ): Promise<EmailListResponse> {
    const skip = (page - 1) * limit;

    // Get emails sent by user
    const emails = await EmailMetadata.find({
      senderId: userId
    })
    .sort({ timestamp: -1 })
    .skip(skip)
    .limit(limit + 1)
    .populate('recipientIds', 'email');

    const hasMore = emails.length > limit;
    const emailList = emails.slice(0, limit);

    const totalCount = await EmailMetadata.countDocuments({
      senderId: userId
    });

    return {
      emails: emailList.map(email => ({
        id: email._id.toString(),
        senderId: email.senderId.toString(),
        senderEmail: '', // User's own email
        subject: email.subject,
        timestamp: email.timestamp,
        size: email.size,
        attachmentCount: email.attachmentCount,
        isRead: true, // Sent emails are always "read"
        deliveryStatus: email.deliveryStatus
      })),
      totalCount,
      hasMore
    };
  }

  /**
   * Get email details by ID
   */
  static async getEmailById(emailId: string, userId: string): Promise<EmailDetailResponse> {
    // Get metadata
    const metadata = await EmailMetadata.findById(emailId)
      .populate('senderId', 'email')
      .populate('recipientIds', 'email');

    if (!metadata) {
      throw new Error('Email not found');
    }

    // Check if user has access to this email
    const hasAccess = (metadata.senderId as any)._id.toString() === userId || 
                     metadata.recipientIds.some((r: any) => r._id.toString() === userId);

    if (!hasAccess) {
      throw new Error('Access denied');
    }

    // Get encrypted email content
    const encryptedEmail = await EncryptedEmail.findById(metadata._id);
    if (!encryptedEmail) {
      throw new Error('Email content not found');
    }

    // Mark as read if user is recipient
    if (metadata.recipientIds.some((r: any) => r._id.toString() === userId) && !metadata.isRead) {
      metadata.isRead = true;
      await metadata.save();
    }

    // Get the recipient key for this user
    const recipientKey = encryptedEmail.recipientKeys.get(userId) || '';

    return {
      metadata: {
        id: metadata._id.toString(),
        senderId: (metadata.senderId as any)._id.toString(),
        senderEmail: (metadata.senderId as any).email,
        recipientIds: metadata.recipientIds.map((r: any) => r._id.toString()),
        subject: metadata.subject,
        timestamp: metadata.timestamp,
        size: metadata.size,
        attachmentCount: metadata.attachmentCount,
        isRead: metadata.isRead
      },
      encryptedContent: encryptedEmail.encryptedContent,
      encryptedSubject: encryptedEmail.encryptedSubject,
      encryptedAttachments: encryptedEmail.encryptedAttachments,
      senderSignature: encryptedEmail.senderSignature,
      recipientKey: recipientKey
    };
  }

  /**
   * Delete an email
   */
  static async deleteEmail(emailId: string, userId: string): Promise<void> {
    const metadata = await EmailMetadata.findById(emailId);
    if (!metadata) {
      throw new Error('Email not found');
    }

    // Check if user has access to delete this email
    const hasAccess = metadata.senderId.toString() === userId || 
                     metadata.recipientIds.includes(userId);

    if (!hasAccess) {
      throw new Error('Access denied');
    }

    // For recipients, just remove them from the recipient list
    if (metadata.recipientIds.includes(userId) && metadata.senderId.toString() !== userId) {
      metadata.recipientIds = metadata.recipientIds.filter(id => id !== userId);
      
      // If no recipients left, delete the entire email
      if (metadata.recipientIds.length === 0) {
        await EncryptedEmail.findByIdAndDelete(metadata._id);
        await EmailMetadata.findByIdAndDelete(emailId);
      } else {
        await metadata.save();
      }
    } else {
      // Sender deleting - remove entire email
      await EncryptedEmail.findByIdAndDelete(metadata._id);
      await EmailMetadata.findByIdAndDelete(emailId);
    }
  }

  /**
   * Move email to folder
   */
  static async moveToFolder(emailId: string, userId: string, folderId: string): Promise<void> {
    const metadata = await EmailMetadata.findById(emailId);
    if (!metadata) {
      throw new Error('Email not found');
    }

    // Check if user is a recipient
    if (!metadata.recipientIds.includes(userId)) {
      throw new Error('Access denied');
    }

    metadata.folderId = folderId;
    await metadata.save();
  }

  /**
   * Process email delivery queue
   */
  static async processDeliveryQueue(): Promise<void> {
    const messages = await this.messageQueue.dequeue('email-delivery', 10);
    
    for (const message of messages) {
      try {
        await this.deliverEmail(message.data);
        await this.messageQueue.acknowledge(message.id);
      } catch (error) {
        console.error('Email delivery failed:', error);
        await this.messageQueue.retry(message.id, (error as Error).message);
      }
    }
  }

  /**
   * Deliver email (mark as delivered)
   */
  private static async deliverEmail(data: any): Promise<void> {
    const { emailId, senderId, recipientIds } = data;
    
    const metadata = await EmailMetadata.findById(emailId)
      .populate('senderId', 'email');
    if (!metadata) {
      throw new Error('Email metadata not found');
    }

    // Update delivery status
    metadata.deliveryStatus = 'delivered';
    metadata.deliveryAttempts += 1;
    metadata.lastDeliveryAttempt = new Date();
    
    await metadata.save();

    // Send real-time notifications to recipients
    await NotificationService.notifyUsers(recipientIds, {
      type: 'new_email',
      emailId: emailId,
      senderId: senderId,
      senderEmail: (metadata.senderId as any).email,
      subject: metadata.subject, // encrypted subject
      timestamp: metadata.timestamp
    });

    // Notify sender of successful delivery
    await NotificationService.notifyUser(senderId, {
      type: 'email_delivered',
      emailId: emailId,
      timestamp: new Date()
    });
  }

  /**
   * Get delivery confirmation
   */
  static async getDeliveryStatus(emailId: string, userId: string): Promise<{ status: string; attempts: number; lastAttempt?: Date }> {
    const metadata = await EmailMetadata.findById(emailId);
    if (!metadata) {
      throw new Error('Email not found');
    }

    // Check if user is the sender
    if (metadata.senderId.toString() !== userId) {
      throw new Error('Access denied');
    }

    return {
      status: metadata.deliveryStatus,
      attempts: metadata.deliveryAttempts,
      lastAttempt: metadata.lastDeliveryAttempt
    };
  }

  /**
   * Search emails metadata for client-side decryption
   */
  static async searchEmailsMetadata(userId: string, filters: {
    folder?: string;
    dateFrom?: Date;
    dateTo?: Date;
    sender?: string;
    hasAttachments?: boolean;
    isRead?: boolean;
    limit?: number;
  }): Promise<any[]> {
    const query: any = {
      recipientIds: userId
    };

    if (filters.folder) {
      query.folderId = filters.folder;
    }

    if (filters.dateFrom || filters.dateTo) {
      query.timestamp = {};
      if (filters.dateFrom) {
        query.timestamp.$gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        query.timestamp.$lte = filters.dateTo;
      }
    }

    if (filters.hasAttachments !== undefined) {
      if (filters.hasAttachments) {
        query.attachmentCount = { $gt: 0 };
      } else {
        query.attachmentCount = 0;
      }
    }

    if (filters.isRead !== undefined) {
      query.isRead = filters.isRead;
    }

    let emailQuery = EmailMetadata.find(query)
      .sort({ timestamp: -1 })
      .limit(filters.limit || 50)
      .populate('senderId', 'email');

    if (filters.sender) {
      // We need to filter by sender email after population
      const emails = await emailQuery.exec();
      return emails
        .filter(email => (email.senderId as any).email.includes(filters.sender!))
        .map(email => ({
          id: email._id.toString(),
          senderId: (email.senderId as any)._id.toString(),
          senderEmail: (email.senderId as any).email,
          subject: email.subject,
          timestamp: email.timestamp,
          size: email.size,
          attachmentCount: email.attachmentCount,
          isRead: email.isRead,
          folderId: email.folderId
        }));
    }

    const emails = await emailQuery.exec();
    return emails.map(email => ({
      id: email._id.toString(),
      senderId: (email.senderId as any)._id.toString(),
      senderEmail: (email.senderId as any).email,
      subject: email.subject,
      timestamp: email.timestamp,
      size: email.size,
      attachmentCount: email.attachmentCount,
      isRead: email.isRead,
      folderId: email.folderId
    }));
  }

  /**
   * Mark email as read
   */
  static async markAsRead(emailId: string, userId: string): Promise<void> {
    const metadata = await EmailMetadata.findById(emailId);
    if (!metadata) {
      throw new Error('Email not found');
    }

    // Check if user is a recipient
    if (!metadata.recipientIds.includes(userId)) {
      throw new Error('Access denied');
    }

    metadata.isRead = true;
    await metadata.save();
  }

  /**
   * Mark email as unread
   */
  static async markAsUnread(emailId: string, userId: string): Promise<void> {
    const metadata = await EmailMetadata.findById(emailId);
    if (!metadata) {
      throw new Error('Email not found');
    }

    // Check if user is a recipient
    if (!metadata.recipientIds.includes(userId)) {
      throw new Error('Access denied');
    }

    metadata.isRead = false;
    await metadata.save();
  }

  /**
   * Bulk move emails to folder
   */
  static async bulkMoveToFolder(emailIds: string[], userId: string, folderId: string): Promise<void> {
    const result = await EmailMetadata.updateMany(
      {
        _id: { $in: emailIds },
        recipientIds: userId
      },
      {
        $set: { folderId: folderId }
      }
    );

    if (result.matchedCount === 0) {
      throw new Error('No emails found or access denied');
    }
  }
}