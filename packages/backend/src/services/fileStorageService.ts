/**
 * File storage service for handling encrypted file operations
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { File, IFile } from '../models/File';
import { FileChunk, IFileChunk } from '../models/FileChunk';
import { FileShare, IFileShare } from '../models/FileShare';
import { User } from '../models/User';

export interface FileUploadData {
  fileId: string;
  userId: string;
  filename: string;
  originalName: string;
  encryptedFilename: string;
  size: number;
  mimeType: string;
  encryptionKey: string;
  iv: string;
  encryptedContent: Buffer;
  folderId?: string;
  tags?: string[];
}

export interface ChunkedUploadInit {
  fileId: string;
  userId: string;
  totalChunks: number;
  encryptionKey: string;
  metadata: {
    filename: string;
    originalName: string;
    size: number;
    mimeType: string;
    folderId?: string;
    tags?: string[];
  };
}

export interface ChunkUploadData {
  chunkId: string;
  fileId: string;
  userId: string;
  chunkIndex: number;
  totalChunks: number;
  encryptedData: Buffer;
}

export class FileStorageService {
  private static readonly STORAGE_BASE_PATH = process.env.FILE_STORAGE_PATH || './storage/files';
  private static readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
  private static readonly CHUNK_SIZE = 1024 * 1024; // 1MB

  /**
   * Initialize storage directories
   */
  static async initializeStorage(): Promise<void> {
    try {
      await fs.mkdir(this.STORAGE_BASE_PATH, { recursive: true });
      await fs.mkdir(path.join(this.STORAGE_BASE_PATH, 'chunks'), { recursive: true });
      await fs.mkdir(path.join(this.STORAGE_BASE_PATH, 'files'), { recursive: true });
    } catch (error) {
      throw new Error(`Failed to initialize storage: ${error}`);
    }
  }

  /**
   * Upload a file directly (for smaller files)
   */
  static async uploadFile(uploadData: FileUploadData): Promise<IFile> {
    try {
      // Check user storage quota
      await this.checkStorageQuota(uploadData.userId, uploadData.size);

      // Generate file hash for deduplication
      const fileHash = crypto.createHash('sha256').update(uploadData.encryptedContent).digest('hex');

      // Check for existing file with same hash (deduplication)
      const existingFile = await File.findOne({ 
        userId: uploadData.userId, 
        hash: fileHash,
        isDeleted: false 
      });

      if (existingFile) {
        // File already exists, return existing file metadata
        return existingFile;
      }

      // Generate storage location
      const storageLocation = this.generateStorageLocation(uploadData.fileId);

      // Save encrypted file to disk
      await fs.writeFile(storageLocation, uploadData.encryptedContent);

      // Create file record
      const file = new File({
        _id: uploadData.fileId,
        userId: uploadData.userId,
        filename: uploadData.filename,
        originalName: uploadData.originalName,
        encryptedFilename: uploadData.encryptedFilename,
        size: uploadData.size,
        mimeType: uploadData.mimeType,
        encryptionKey: uploadData.encryptionKey,
        iv: uploadData.iv,
        storageLocation,
        hash: fileHash,
        folderId: uploadData.folderId,
        tags: uploadData.tags || [],
        isShared: false
      });

      await file.save();

      // Update user storage usage
      await this.updateStorageUsage(uploadData.userId, uploadData.size);

      return file;
    } catch (error) {
      throw new Error(`Failed to upload file: ${error}`);
    }
  }

  /**
   * Initialize chunked upload
   */
  static async initializeChunkedUpload(initData: ChunkedUploadInit): Promise<void> {
    try {
      // Check user storage quota
      await this.checkStorageQuota(initData.userId, initData.metadata.size);

      // Create temporary file record to reserve space
      const file = new File({
        _id: initData.fileId,
        userId: initData.userId,
        filename: initData.metadata.filename,
        originalName: initData.metadata.originalName,
        encryptedFilename: initData.metadata.filename, // Will be updated when complete
        size: initData.metadata.size,
        mimeType: initData.metadata.mimeType,
        encryptionKey: initData.encryptionKey,
        iv: '', // Will be set when complete
        storageLocation: '', // Will be set when complete
        hash: '', // Will be calculated when complete
        folderId: initData.metadata.folderId,
        tags: initData.metadata.tags || [],
        isShared: false,
        isDeleted: true // Mark as deleted until upload is complete
      });

      await file.save();
    } catch (error) {
      throw new Error(`Failed to initialize chunked upload: ${error}`);
    }
  }

  /**
   * Upload a file chunk
   */
  static async uploadChunk(chunkData: ChunkUploadData): Promise<void> {
    try {
      // Generate chunk storage location
      const chunkStorageLocation = this.generateChunkStorageLocation(chunkData.chunkId);

      // Save encrypted chunk to disk
      await fs.writeFile(chunkStorageLocation, chunkData.encryptedData);

      // Create chunk record
      const chunk = new FileChunk({
        chunkId: chunkData.chunkId,
        fileId: chunkData.fileId,
        userId: chunkData.userId,
        chunkIndex: chunkData.chunkIndex,
        totalChunks: chunkData.totalChunks,
        size: chunkData.encryptedData.length,
        storageLocation: chunkStorageLocation
      });

      await chunk.save();
    } catch (error) {
      throw new Error(`Failed to upload chunk: ${error}`);
    }
  }

  /**
   * Finalize chunked upload
   */
  static async finalizeChunkedUpload(fileId: string, userId: string): Promise<IFile> {
    try {
      // Get all chunks for this file
      const chunks = await FileChunk.find({ fileId, userId }).sort({ chunkIndex: 1 });

      if (chunks.length === 0) {
        throw new Error('No chunks found for file');
      }

      // Verify all chunks are present
      const expectedChunks = chunks[0].totalChunks;
      if (chunks.length !== expectedChunks) {
        throw new Error(`Missing chunks: expected ${expectedChunks}, got ${chunks.length}`);
      }

      // Generate final storage location
      const finalStorageLocation = this.generateStorageLocation(fileId);

      // Combine chunks into final file
      const writeStream = await fs.open(finalStorageLocation, 'w');
      let totalSize = 0;
      const hash = crypto.createHash('sha256');

      try {
        for (const chunk of chunks) {
          const chunkData = await fs.readFile(chunk.storageLocation);
          await writeStream.write(chunkData);
          hash.update(chunkData);
          totalSize += chunkData.length;
        }
      } finally {
        await writeStream.close();
      }

      const fileHash = hash.digest('hex');

      // Update file record
      const file = await File.findById(fileId);
      if (!file) {
        throw new Error('File record not found');
      }

      file.storageLocation = finalStorageLocation;
      file.hash = fileHash;
      file.isDeleted = false; // Mark as complete
      await file.save();

      // Clean up chunks
      await this.cleanupChunks(fileId);

      // Update user storage usage
      await this.updateStorageUsage(userId, file.size);

      return file;
    } catch (error) {
      // Clean up on error
      await this.cleanupChunks(fileId);
      throw new Error(`Failed to finalize chunked upload: ${error}`);
    }
  }

  /**
   * Download a file
   */
  static async downloadFile(fileId: string, userId: string): Promise<{ content: Buffer; metadata: IFile }> {
    try {
      const file = await File.findOne({ _id: fileId, userId, isDeleted: false });
      if (!file) {
        throw new Error('File not found');
      }

      // Update access time
      file.accessedAt = new Date();
      await file.save();

      // Read encrypted file content
      const content = await fs.readFile(file.storageLocation);

      return { content, metadata: file };
    } catch (error) {
      throw new Error(`Failed to download file: ${error}`);
    }
  }

  /**
   * Delete a file
   */
  static async deleteFile(fileId: string, userId: string): Promise<void> {
    try {
      const file = await File.findOne({ _id: fileId, userId, isDeleted: false });
      if (!file) {
        throw new Error('File not found');
      }

      // Mark as deleted (soft delete)
      file.isDeleted = true;
      file.deletedAt = new Date();
      await file.save();

      // Update user storage usage
      await this.updateStorageUsage(userId, -file.size);

      // Schedule physical deletion (could be done by a background job)
      setTimeout(async () => {
        try {
          await fs.unlink(file.storageLocation);
        } catch (error) {
          console.error(`Failed to delete file from disk: ${error}`);
        }
      }, 1000); // Delete after 1 second
    } catch (error) {
      throw new Error(`Failed to delete file: ${error}`);
    }
  }

  /**
   * Get user files
   */
  static async getUserFiles(
    userId: string,
    options: {
      folderId?: string;
      tags?: string[];
      limit?: number;
      offset?: number;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ files: IFile[]; total: number }> {
    try {
      const query: any = { userId, isDeleted: false };

      if (options.folderId) {
        query.folderId = options.folderId;
      }

      if (options.tags && options.tags.length > 0) {
        query.tags = { $in: options.tags };
      }

      const sortField = options.sortBy || 'uploadedAt';
      const sortDirection = options.sortOrder === 'asc' ? 1 : -1;

      const [files, total] = await Promise.all([
        File.find(query)
          .sort({ [sortField]: sortDirection })
          .limit(options.limit || 50)
          .skip(options.offset || 0),
        File.countDocuments(query)
      ]);

      return { files, total };
    } catch (error) {
      throw new Error(`Failed to get user files: ${error}`);
    }
  }

  /**
   * Get storage quota for user
   */
  static async getStorageQuota(userId: string): Promise<{ used: number; total: number; percentage: number }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const percentage = user.storageQuota > 0 ? (user.storageUsed / user.storageQuota) * 100 : 0;

      return {
        used: user.storageUsed,
        total: user.storageQuota,
        percentage: Math.round(percentage * 100) / 100
      };
    } catch (error) {
      throw new Error(`Failed to get storage quota: ${error}`);
    }
  }

  /**
   * Create file share
   */
  static async createFileShare(
    fileId: string,
    userId: string,
    shareSettings: {
      expiresAt?: Date;
      downloadLimit?: number;
      password?: string;
    }
  ): Promise<IFileShare> {
    try {
      const file = await File.findOne({ _id: fileId, userId, isDeleted: false });
      if (!file) {
        throw new Error('File not found');
      }

      const shareId = crypto.randomBytes(16).toString('hex');

      const fileShare = new FileShare({
        fileId,
        userId,
        shareId,
        expiresAt: shareSettings.expiresAt,
        downloadLimit: shareSettings.downloadLimit,
        password: shareSettings.password ? await this.hashPassword(shareSettings.password) : undefined
      });

      await fileShare.save();

      // Update file share status
      file.isShared = true;
      file.shareId = shareId;
      await file.save();

      return fileShare;
    } catch (error) {
      throw new Error(`Failed to create file share: ${error}`);
    }
  }

  /**
   * Private helper methods
   */
  private static generateStorageLocation(fileId: string): string {
    const subDir = fileId.substring(0, 2);
    return path.join(this.STORAGE_BASE_PATH, 'files', subDir, fileId);
  }

  private static generateChunkStorageLocation(chunkId: string): string {
    const subDir = chunkId.substring(0, 2);
    return path.join(this.STORAGE_BASE_PATH, 'chunks', subDir, chunkId);
  }

  private static async checkStorageQuota(userId: string, fileSize: number): Promise<void> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    if (user.storageUsed + fileSize > user.storageQuota) {
      throw new Error('Storage quota exceeded');
    }
  }

  private static async updateStorageUsage(userId: string, sizeChange: number): Promise<void> {
    await User.findByIdAndUpdate(userId, {
      $inc: { storageUsed: sizeChange }
    });
  }

  private static async cleanupChunks(fileId: string): Promise<void> {
    try {
      const chunks = await FileChunk.find({ fileId });
      
      // Delete chunk files from disk
      await Promise.all(chunks.map(async (chunk) => {
        try {
          await fs.unlink(chunk.storageLocation);
        } catch (error) {
          console.error(`Failed to delete chunk file: ${error}`);
        }
      }));

      // Delete chunk records
      await FileChunk.deleteMany({ fileId });
    } catch (error) {
      console.error(`Failed to cleanup chunks: ${error}`);
    }
  }

  private static async hashPassword(password: string): Promise<string> {
    const bcrypt = require('bcrypt');
    return await bcrypt.hash(password, 12);
  }
}