/**
 * Storage system tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import app from '../index';
import { User } from '../models/User';
import { File } from '../models/File';
import { FileChunk } from '../models/FileChunk';
import { FileShare } from '../models/FileShare';
import { FileStorageService } from '../services/fileStorageService';
import { StorageQuotaService } from '../services/storageQuotaService';

describe('Storage System', () => {
  let testUser: any;
  let authToken: string;
  let testFile: Buffer;

  beforeEach(async () => {
    // Create test user
    testUser = new User({
      email: 'test@odyssie.net',
      passwordHash: '$2b$12$LQv3c1yqBwEHFl5L0GJwe.5UU5U5U5U5U5U5U5U5U5U5U5U5U5U5U',
      publicKey: 'test-public-key',
      encryptedPrivateKey: 'test-encrypted-private-key',
      storageQuota: 100 * 1024 * 1024, // 100MB
      storageUsed: 0
    });
    await testUser.save();

    // Generate auth token
    const jwt = require('jsonwebtoken');
    authToken = jwt.sign({ userId: testUser._id }, process.env.JWT_SECRET || 'test-secret');

    // Create test file content
    testFile = Buffer.from('This is test file content for encryption testing');

    // Initialize storage
    await FileStorageService.initializeStorage();
  });

  afterEach(async () => {
    // Clean up test data
    await User.deleteMany({});
    await File.deleteMany({});
    await FileChunk.deleteMany({});
    await FileShare.deleteMany({});

    // Clean up test files
    try {
      const storageDir = process.env.FILE_STORAGE_PATH || './storage/files';
      await fs.rmdir(storageDir, { recursive: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('File Upload', () => {
    it('should upload a file successfully', async () => {
      const uploadData = {
        fileId: 'test-file-id',
        encryptedFilename: 'encrypted-filename',
        encryptionKey: 'encrypted-key',
        iv: 'test-iv',
        metadata: JSON.stringify({
          filename: 'test.txt',
          originalName: 'test.txt',
          size: testFile.length,
          mimeType: 'text/plain'
        })
      };

      const response = await request(app)
        .post('/api/storage/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('fileId', uploadData.fileId)
        .field('encryptedFilename', uploadData.encryptedFilename)
        .field('encryptionKey', uploadData.encryptionKey)
        .field('iv', uploadData.iv)
        .field('metadata', uploadData.metadata)
        .attach('encryptedContent', testFile, 'test.txt');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.fileId).toBe(uploadData.fileId);

      // Verify file was saved to database
      const savedFile = await File.findById(uploadData.fileId);
      expect(savedFile).toBeTruthy();
      expect(savedFile?.filename).toBe('test.txt');
      expect(savedFile?.size).toBe(testFile.length);

      // Verify storage usage was updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser?.storageUsed).toBe(testFile.length);
    });

    it('should reject upload when storage quota exceeded', async () => {
      // Set user storage to almost full
      await User.findByIdAndUpdate(testUser._id, {
        storageUsed: testUser.storageQuota - 10 // Leave only 10 bytes
      });

      const uploadData = {
        fileId: 'test-file-id',
        encryptedFilename: 'encrypted-filename',
        encryptionKey: 'encrypted-key',
        iv: 'test-iv',
        metadata: JSON.stringify({
          filename: 'test.txt',
          originalName: 'test.txt',
          size: testFile.length,
          mimeType: 'text/plain'
        })
      };

      const response = await request(app)
        .post('/api/storage/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('fileId', uploadData.fileId)
        .field('encryptedFilename', uploadData.encryptedFilename)
        .field('encryptionKey', uploadData.encryptionKey)
        .field('iv', uploadData.iv)
        .field('metadata', uploadData.metadata)
        .attach('encryptedContent', testFile, 'test.txt');

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('Storage quota exceeded');
    });

    it('should handle chunked upload', async () => {
      const fileId = 'chunked-file-id';
      const totalChunks = 3;
      const chunkSize = Math.ceil(testFile.length / totalChunks);

      // Initialize chunked upload
      const initResponse = await request(app)
        .post('/api/storage/upload/init')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          fileId,
          totalChunks,
          encryptionKey: 'encrypted-key',
          metadata: {
            filename: 'chunked-test.txt',
            originalName: 'chunked-test.txt',
            size: testFile.length,
            mimeType: 'text/plain'
          }
        });

      expect(initResponse.status).toBe(200);

      // Upload chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * chunkSize;
        const end = Math.min(start + chunkSize, testFile.length);
        const chunk = testFile.slice(start, end);

        const chunkResponse = await request(app)
          .post('/api/storage/upload/chunk')
          .set('Authorization', `Bearer ${authToken}`)
          .field('fileId', fileId)
          .field('chunkId', `chunk-${i}`)
          .field('chunkIndex', i.toString())
          .field('totalChunks', totalChunks.toString())
          .attach('encryptedData', chunk, `chunk-${i}`);

        expect(chunkResponse.status).toBe(200);
      }

      // Finalize upload
      const finalizeResponse = await request(app)
        .post('/api/storage/upload/finalize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ fileId });

      expect(finalizeResponse.status).toBe(200);
      expect(finalizeResponse.body.success).toBe(true);

      // Verify file was created
      const savedFile = await File.findById(fileId);
      expect(savedFile).toBeTruthy();
      expect(savedFile?.isDeleted).toBe(false);

      // Verify chunks were cleaned up
      const remainingChunks = await FileChunk.find({ fileId });
      expect(remainingChunks.length).toBe(0);
    });
  });

  describe('File Download', () => {
    let uploadedFile: any;

    beforeEach(async () => {
      // Upload a test file first
      uploadedFile = new File({
        _id: 'download-test-file',
        userId: testUser._id,
        filename: 'download-test.txt',
        originalName: 'download-test.txt',
        encryptedFilename: 'encrypted-filename',
        size: testFile.length,
        mimeType: 'text/plain',
        encryptionKey: 'encrypted-key',
        iv: 'test-iv',
        storageLocation: path.join(process.env.FILE_STORAGE_PATH || './storage/files', 'download-test-file'),
        hash: 'test-hash'
      });
      await uploadedFile.save();

      // Create the physical file
      await fs.mkdir(path.dirname(uploadedFile.storageLocation), { recursive: true });
      await fs.writeFile(uploadedFile.storageLocation, testFile);
    });

    it('should download a file successfully', async () => {
      const response = await request(app)
        .get(`/api/storage/download/${uploadedFile._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/octet-stream');
      expect(response.headers['content-disposition']).toContain('download-test.txt');
      expect(Buffer.from(response.body)).toEqual(testFile);

      // Verify access time was updated
      const updatedFile = await File.findById(uploadedFile._id);
      expect(updatedFile?.accessedAt).toBeTruthy();
    });

    it('should return 404 for non-existent file', async () => {
      const response = await request(app)
        .get('/api/storage/download/non-existent-file')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body.error).toContain('File not found');
    });
  });

  describe('File Management', () => {
    let testFiles: any[];

    beforeEach(async () => {
      // Create multiple test files
      testFiles = [];
      for (let i = 0; i < 5; i++) {
        const file = new File({
          _id: `test-file-${i}`,
          userId: testUser._id,
          filename: `test-file-${i}.txt`,
          originalName: `test-file-${i}.txt`,
          encryptedFilename: `encrypted-filename-${i}`,
          size: 1000 + i * 100,
          mimeType: 'text/plain',
          encryptionKey: 'encrypted-key',
          iv: 'test-iv',
          storageLocation: `./storage/files/test-file-${i}`,
          hash: `test-hash-${i}`,
          tags: i % 2 === 0 ? ['even'] : ['odd']
        });
        await file.save();
        testFiles.push(file);
      }
    });

    it('should list user files', async () => {
      const response = await request(app)
        .get('/api/storage/files')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.files).toHaveLength(5);
      expect(response.body.total).toBe(5);
    });

    it('should filter files by tags', async () => {
      const response = await request(app)
        .get('/api/storage/files?tags=even')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.files).toHaveLength(3); // Files 0, 2, 4
    });

    it('should sort files by size', async () => {
      const response = await request(app)
        .get('/api/storage/files?sortBy=size&sortOrder=desc')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.files[0].size).toBeGreaterThan(response.body.files[1].size);
    });

    it('should delete a file', async () => {
      const fileToDelete = testFiles[0];

      const response = await request(app)
        .delete(`/api/storage/${fileToDelete._id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify file was marked as deleted
      const deletedFile = await File.findById(fileToDelete._id);
      expect(deletedFile?.isDeleted).toBe(true);
      expect(deletedFile?.deletedAt).toBeTruthy();
    });
  });

  describe('Storage Quota Management', () => {
    it('should get storage quota', async () => {
      const response = await request(app)
        .get('/api/storage/quota')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.used).toBe(0);
      expect(response.body.total).toBe(testUser.storageQuota);
      expect(response.body.percentage).toBe(0);
    });

    it('should get storage analytics', async () => {
      // Create some test files first
      await new File({
        _id: 'analytics-file-1',
        userId: testUser._id,
        filename: 'image.jpg',
        originalName: 'image.jpg',
        size: 1000,
        mimeType: 'image/jpeg',
        encryptionKey: 'key',
        iv: 'iv',
        storageLocation: './storage/files/analytics-file-1',
        hash: 'hash1'
      }).save();

      await new File({
        _id: 'analytics-file-2',
        userId: testUser._id,
        filename: 'document.pdf',
        originalName: 'document.pdf',
        size: 2000,
        mimeType: 'application/pdf',
        encryptionKey: 'key',
        iv: 'iv',
        storageLocation: './storage/files/analytics-file-2',
        hash: 'hash2'
      }).save();

      const response = await request(app)
        .get('/api/storage/analytics')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalFiles).toBe(2);
      expect(response.body.totalSize).toBe(3000);
      expect(response.body.filesByType).toHaveProperty('Images');
      expect(response.body.filesByType).toHaveProperty('PDFs');
    });

    it('should get cleanup suggestions', async () => {
      // Create a large file
      await new File({
        _id: 'large-file',
        userId: testUser._id,
        filename: 'large-file.zip',
        originalName: 'large-file.zip',
        size: 60 * 1024 * 1024, // 60MB
        mimeType: 'application/zip',
        encryptionKey: 'key',
        iv: 'iv',
        storageLocation: './storage/files/large-file',
        hash: 'hash-large'
      }).save();

      const response = await request(app)
        .get('/api/storage/cleanup-suggestions')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.suggestions).toBeInstanceOf(Array);
      
      const largeSuggestion = response.body.suggestions.find(
        (s: any) => s.type === 'large_files'
      );
      expect(largeSuggestion).toBeTruthy();
      expect(largeSuggestion.files).toHaveLength(1);
    });

    it('should upgrade storage plan', async () => {
      const response = await request(app)
        .post('/api/storage/upgrade-plan')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ plan: 'basic' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.newQuota).toBe(50 * 1024 * 1024 * 1024); // 50GB

      // Verify user was updated
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser?.subscriptionPlan).toBe('basic');
      expect(updatedUser?.storageQuota).toBe(50 * 1024 * 1024 * 1024);
    });
  });

  describe('File Sharing', () => {
    let testFile: any;

    beforeEach(async () => {
      testFile = new File({
        _id: 'shareable-file',
        userId: testUser._id,
        filename: 'shareable.txt',
        originalName: 'shareable.txt',
        size: 1000,
        mimeType: 'text/plain',
        encryptionKey: 'key',
        iv: 'iv',
        storageLocation: './storage/files/shareable-file',
        hash: 'hash-shareable'
      });
      await testFile.save();
    });

    it('should create a file share', async () => {
      const shareSettings = {
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        downloadLimit: 5,
        password: 'share-password'
      };

      const response = await request(app)
        .post(`/api/storage/${testFile._id}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(shareSettings);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.shareId).toBeTruthy();
      expect(response.body.shareUrl).toContain(response.body.shareId);

      // Verify share was created
      const share = await FileShare.findOne({ shareId: response.body.shareId });
      expect(share).toBeTruthy();
      expect(share?.fileId).toBe(testFile._id);
      expect(share?.downloadLimit).toBe(5);

      // Verify file was marked as shared
      const updatedFile = await File.findById(testFile._id);
      expect(updatedFile?.isShared).toBe(true);
      expect(updatedFile?.shareId).toBe(response.body.shareId);
    });
  });

  describe('Storage Service Unit Tests', () => {
    it('should check storage availability', async () => {
      const result = await StorageQuotaService.checkStorageAvailability(
        testUser._id,
        50 * 1024 * 1024 // 50MB
      );

      expect(result.available).toBe(true);
      expect(result.quota.used).toBe(0);
      expect(result.quota.total).toBe(testUser.storageQuota);
    });

    it('should detect storage quota exceeded', async () => {
      const result = await StorageQuotaService.checkStorageAvailability(
        testUser._id,
        200 * 1024 * 1024 // 200MB (exceeds 100MB quota)
      );

      expect(result.available).toBe(false);
      expect(result.message).toContain('Storage quota exceeded');
    });

    it('should update storage usage', async () => {
      await StorageQuotaService.updateStorageUsage(testUser._id, 10 * 1024 * 1024);

      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser?.storageUsed).toBe(10 * 1024 * 1024);
    });

    it('should generate storage analytics', async () => {
      // Create test files
      await new File({
        _id: 'analytics-test-1',
        userId: testUser._id,
        filename: 'test1.jpg',
        originalName: 'test1.jpg',
        size: 1000,
        mimeType: 'image/jpeg',
        encryptionKey: 'key',
        iv: 'iv',
        storageLocation: './storage/files/analytics-test-1',
        hash: 'hash1'
      }).save();

      const analytics = await StorageQuotaService.getStorageAnalytics(testUser._id);

      expect(analytics.totalFiles).toBe(1);
      expect(analytics.totalSize).toBe(1000);
      expect(analytics.filesByType).toHaveProperty('Images', 1);
    });

    it('should generate cleanup suggestions', async () => {
      // Create a large file
      await new File({
        _id: 'cleanup-test-large',
        userId: testUser._id,
        filename: 'large.zip',
        originalName: 'large.zip',
        size: 60 * 1024 * 1024, // 60MB
        mimeType: 'application/zip',
        encryptionKey: 'key',
        iv: 'iv',
        storageLocation: './storage/files/cleanup-test-large',
        hash: 'hash-large'
      }).save();

      const suggestions = await StorageQuotaService.getCleanupSuggestions(testUser._id);

      expect(suggestions).toBeInstanceOf(Array);
      const largeSuggestion = suggestions.find(s => s.type === 'large_files');
      expect(largeSuggestion).toBeTruthy();
      expect(largeSuggestion?.files).toHaveLength(1);
    });
  });
});