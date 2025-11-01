import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { EmailMetadata, EncryptedEmail } from '../models/Email.js';
import { EmailService } from '../services/emailService.js';
import { generateToken } from '../utils/auth.js';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { beforeEach } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { beforeEach } from 'vitest';
import { describe } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { expect } from 'vitest';
import { it } from 'vitest';
import { describe } from 'vitest';
import { beforeEach } from 'vitest';
import { describe } from 'vitest';

describe('Email Service', () => {
  let testUser1: any;
  let testUser2: any;
  let authToken1: string;
  let authToken2: string;

  beforeEach(async () => {
    // Clear database
    await User.deleteMany({});
    await EmailMetadata.deleteMany({});
    await EncryptedEmail.deleteMany({});

    // Create test users with proper bcrypt hash length (60 chars)
    testUser1 = new User({
      email: 'user1@odyssie.net',
      passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
      publicKey: 'publickey1',
      encryptedPrivateKey: 'encryptedprivatekey1'
    });
    await testUser1.save();

    testUser2 = new User({
      email: 'user2@odyssie.net',
      passwordHash: '$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ123456',
      publicKey: 'publickey2',
      encryptedPrivateKey: 'encryptedprivatekey2'
    });
    await testUser2.save();

    // Generate auth tokens
    authToken1 = generateToken({
      userId: testUser1._id.toString(),
      email: testUser1.email
    });

    authToken2 = generateToken({
      userId: testUser2._id.toString(),
      email: testUser2.email
    });
  });

  describe('EmailService.sendEmail', () => {
    it('should send an encrypted email successfully', async () => {
      const emailData = {
        recipientEmails: ['user2@odyssie.net'],
        encryptedSubject: 'encrypted-subject-data',
        encryptedContent: 'encrypted-email-content',
        encryptedAttachments: [],
        senderSignature: 'digital-signature',
        recipientKeys: {
          'user2@odyssie.net': 'encrypted-aes-key-for-user2'
        },
        size: 1024
      };

      const result = await EmailService.sendEmail(testUser1._id.toString(), emailData);

      expect(result.id).toBeDefined();
      expect(result.deliveryStatus).toBe('pending');

      // Verify email was created in database
      const emailCount = await EmailMetadata.countDocuments();
      expect(emailCount).toBe(1);
    });

    it('should reject email with invalid recipient', async () => {
      const emailData = {
        recipientEmails: ['nonexistent@odyssie.net'],
        encryptedSubject: 'encrypted-subject-data',
        encryptedContent: 'encrypted-email-content',
        encryptedAttachments: [],
        senderSignature: 'digital-signature',
        recipientKeys: {
          'nonexistent@odyssie.net': 'encrypted-aes-key'
        },
        size: 1024
      };

      await expect(EmailService.sendEmail(testUser1._id.toString(), emailData))
        .rejects.toThrow('Recipients not found');
    });
  });

  describe('EmailService.getInbox', () => {
    beforeEach(async () => {
      // Create test email
      const encryptedEmail = new EncryptedEmail({
        encryptedContent: 'encrypted-content',
        encryptedSubject: 'encrypted-subject',
        encryptedAttachments: [],
        senderSignature: 'signature',
        recipientKeys: new Map([[testUser2._id.toString(), 'encrypted-key']])
      });
      await encryptedEmail.save();

      const emailMetadata = new EmailMetadata({
        senderId: testUser1._id.toString(),
        recipientIds: [testUser2._id.toString()],
        subject: 'encrypted-subject',
        size: 1024,
        attachmentCount: 0,
        deliveryStatus: 'delivered'
      });
      await emailMetadata.save();
    });

    it('should get inbox emails for authenticated user', async () => {
      const result = await EmailService.getInbox(testUser2._id.toString());

      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].subject).toBe('encrypted-subject');
      expect(result.totalCount).toBe(1);
    });

    it('should return empty inbox for user with no emails', async () => {
      const result = await EmailService.getInbox(testUser1._id.toString());

      expect(result.emails).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('EmailService.getSentEmails', () => {
    beforeEach(async () => {
      // Create test email sent by user1
      const encryptedEmail = new EncryptedEmail({
        encryptedContent: 'encrypted-content',
        encryptedSubject: 'encrypted-subject',
        encryptedAttachments: [],
        senderSignature: 'signature',
        recipientKeys: new Map([[testUser2._id.toString(), 'encrypted-key']])
      });
      await encryptedEmail.save();

      const emailMetadata = new EmailMetadata({
        senderId: testUser1._id.toString(),
        recipientIds: [testUser2._id.toString()],
        subject: 'encrypted-subject',
        size: 1024,
        attachmentCount: 0,
        deliveryStatus: 'delivered'
      });
      await emailMetadata.save();
    });

    it('should get sent emails for authenticated user', async () => {
      const result = await EmailService.getSentEmails(testUser1._id.toString());

      expect(result.emails).toHaveLength(1);
      expect(result.emails[0].subject).toBe('encrypted-subject');
    });
  });
});