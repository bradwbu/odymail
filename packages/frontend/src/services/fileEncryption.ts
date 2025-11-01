/**
 * File encryption service for handling client-side file encryption/decryption
 * Extends the CryptoEngine for file-specific operations
 */

import { CryptoEngine, EncryptedData } from './crypto';
import { FileMetadata, EncryptedFile, FileChunk } from '../types/storage';

export interface EncryptedFileData {
  encryptedContent: ArrayBuffer;
  encryptedFilename: string;
  encryptionKey: string; // Base64 encoded AES key
  iv: ArrayBuffer;
  metadata: FileMetadata;
}

export class FileEncryptionService {
  private static readonly CHUNK_SIZE = 1024 * 1024; // 1MB chunks
  private static readonly MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB max file size

  /**
   * Encrypt a file with client-side encryption
   */
  static async encryptFile(
    file: File,
    userKey: CryptoKey,
    metadata: Partial<FileMetadata>
  ): Promise<EncryptedFileData> {
    try {
      // Validate file size
      if (file.size > this.MAX_FILE_SIZE) {
        throw new Error(`File size exceeds maximum limit of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
      }

      // Generate AES key for file encryption
      const fileKey = await CryptoEngine.generateAESKey();
      
      // Read file content
      const fileBuffer = await this.fileToArrayBuffer(file);
      
      // Encrypt file content
      const encryptedContent = await CryptoEngine.encryptAES(fileBuffer, fileKey);
      
      // Encrypt filename
      const filenameBuffer = CryptoEngine.stringToArrayBuffer(file.name);
      const encryptedFilename = await CryptoEngine.encryptAES(filenameBuffer, fileKey);
      
      // Export and encrypt the file key with user's key
      const exportedFileKey = await CryptoEngine.exportKey(fileKey);
      const encryptedFileKey = await CryptoEngine.encryptAES(exportedFileKey, userKey);
      
      // Create metadata
      const fileMetadata: FileMetadata = {
        id: crypto.randomUUID(),
        userId: metadata.userId || '',
        filename: CryptoEngine.arrayBufferToBase64(encryptedFilename.data),
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
        uploadedAt: new Date(),
        modifiedAt: new Date(),
        folderId: metadata.folderId,
        tags: metadata.tags || [],
        isShared: false,
        ...metadata
      };

      return {
        encryptedContent: encryptedContent.data,
        encryptedFilename: CryptoEngine.arrayBufferToBase64(encryptedFilename.data),
        encryptionKey: CryptoEngine.arrayBufferToBase64(encryptedFileKey.data),
        iv: encryptedContent.iv,
        metadata: fileMetadata
      };
    } catch (error) {
      throw new Error(`Failed to encrypt file: ${error}`);
    }
  }

  /**
   * Decrypt a file with client-side decryption
   */
  static async decryptFile(
    encryptedFile: EncryptedFile,
    userKey: CryptoKey
  ): Promise<{ content: ArrayBuffer; filename: string }> {
    try {
      // Decrypt the file key
      const encryptedFileKeyBuffer = CryptoEngine.base64ToArrayBuffer(encryptedFile.encryptionKey);
      const fileKeyBuffer = await CryptoEngine.decryptAES(
        encryptedFileKeyBuffer,
        userKey,
        encryptedFile.iv
      );
      
      // Import the decrypted file key
      const fileKey = await CryptoEngine.importKey(
        fileKeyBuffer,
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
      );
      
      // Decrypt file content
      const decryptedContent = await CryptoEngine.decryptAES(
        encryptedFile.encryptedContent,
        fileKey,
        encryptedFile.iv
      );
      
      // Decrypt filename
      const encryptedFilenameBuffer = CryptoEngine.base64ToArrayBuffer(encryptedFile.encryptedFilename);
      const decryptedFilenameBuffer = await CryptoEngine.decryptAES(
        encryptedFilenameBuffer,
        fileKey,
        encryptedFile.iv
      );
      const filename = CryptoEngine.arrayBufferToString(decryptedFilenameBuffer);

      return {
        content: decryptedContent,
        filename
      };
    } catch (error) {
      throw new Error(`Failed to decrypt file: ${error}`);
    }
  }

  /**
   * Encrypt file in chunks for large file uploads
   */
  static async encryptFileInChunks(
    file: File,
    userKey: CryptoKey,
    metadata: Partial<FileMetadata>,
    onProgress?: (progress: number) => void
  ): Promise<{ chunks: FileChunk[]; metadata: FileMetadata; encryptionKey: string }> {
    try {
      const fileId = crypto.randomUUID();
      const totalChunks = Math.ceil(file.size / this.CHUNK_SIZE);
      const chunks: FileChunk[] = [];
      
      // Generate AES key for file encryption
      const fileKey = await CryptoEngine.generateAESKey();
      
      // Encrypt and export the file key
      const exportedFileKey = await CryptoEngine.exportKey(fileKey);
      const encryptedFileKey = await CryptoEngine.encryptAES(exportedFileKey, userKey);
      
      // Process file in chunks
      for (let i = 0; i < totalChunks; i++) {
        const start = i * this.CHUNK_SIZE;
        const end = Math.min(start + this.CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(start, end);
        const chunkBuffer = await this.fileToArrayBuffer(chunkBlob);
        
        // Encrypt chunk
        const encryptedChunk = await CryptoEngine.encryptAES(chunkBuffer, fileKey);
        
        chunks.push({
          chunkId: crypto.randomUUID(),
          fileId,
          chunkIndex: i,
          totalChunks,
          encryptedData: encryptedChunk.data,
          size: encryptedChunk.data.byteLength
        });
        
        // Report progress
        if (onProgress) {
          onProgress(Math.round(((i + 1) / totalChunks) * 100));
        }
      }
      
      // Create metadata
      const fileMetadata: FileMetadata = {
        id: fileId,
        userId: metadata.userId || '',
        filename: file.name,
        originalName: file.name,
        size: file.size,
        mimeType: file.type,
        uploadedAt: new Date(),
        modifiedAt: new Date(),
        folderId: metadata.folderId,
        tags: metadata.tags || [],
        isShared: false,
        ...metadata
      };

      return {
        chunks,
        metadata: fileMetadata,
        encryptionKey: CryptoEngine.arrayBufferToBase64(encryptedFileKey.data)
      };
    } catch (error) {
      throw new Error(`Failed to encrypt file in chunks: ${error}`);
    }
  }

  /**
   * Validate file before encryption
   */
  static validateFile(file: File): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      errors.push(`File size exceeds maximum limit of ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }
    
    if (file.size === 0) {
      errors.push('File is empty');
    }
    
    // Check file name
    if (!file.name || file.name.trim().length === 0) {
      errors.push('File name is required');
    }
    
    if (file.name.length > 255) {
      errors.push('File name is too long (maximum 255 characters)');
    }
    
    // Check for potentially dangerous file types
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.scr', '.pif', '.com'];
    const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    if (dangerousExtensions.includes(fileExtension)) {
      errors.push('File type is not allowed for security reasons');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Compress file before encryption (optional)
   */
  static async compressFile(file: File): Promise<File> {
    // For now, return the original file
    // In a real implementation, you might use compression libraries
    return file;
  }

  /**
   * Generate file hash for deduplication
   */
  static async generateFileHash(file: File): Promise<string> {
    try {
      const buffer = await this.fileToArrayBuffer(file);
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      return CryptoEngine.arrayBufferToBase64(hashBuffer);
    } catch (error) {
      throw new Error(`Failed to generate file hash: ${error}`);
    }
  }

  /**
   * Convert File to ArrayBuffer
   */
  private static fileToArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as ArrayBuffer);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Create downloadable blob from decrypted content
   */
  static createDownloadBlob(content: ArrayBuffer, mimeType: string): Blob {
    return new Blob([content], { type: mimeType });
  }

  /**
   * Generate download URL for decrypted file
   */
  static createDownloadUrl(blob: Blob): string {
    return URL.createObjectURL(blob);
  }

  /**
   * Clean up download URL
   */
  static revokeDownloadUrl(url: string): void {
    URL.revokeObjectURL(url);
  }
}