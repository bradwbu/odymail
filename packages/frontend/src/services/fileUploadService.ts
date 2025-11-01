/**
 * File upload service for handling encrypted file uploads with progress tracking
 */

import { FileEncryptionService } from './fileEncryption';
import { 
  FileUploadProgress, 
  FileUploadOptions, 
  FileMetadata, 
  FileChunk,
  StorageQuota 
} from '../types/storage';

export interface UploadResult {
  success: boolean;
  fileId?: string;
  error?: string;
  metadata?: FileMetadata;
}

export class FileUploadService {
  private static readonly API_BASE_URL = '/api/storage';
  private static readonly DEFAULT_CHUNK_SIZE = 1024 * 1024; // 1MB
  private static readonly MAX_CONCURRENT_UPLOADS = 3;
  
  private static activeUploads = new Map<string, AbortController>();
  private static uploadQueue: Array<() => Promise<void>> = [];
  private static concurrentUploads = 0;

  /**
   * Upload a single file with encryption and progress tracking
   */
  static async uploadFile(
    file: File,
    userKey: CryptoKey,
    options: FileUploadOptions = {},
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<UploadResult> {
    const fileId = crypto.randomUUID();
    const abortController = new AbortController();
    this.activeUploads.set(fileId, abortController);

    try {
      // Validate file
      const validation = FileEncryptionService.validateFile(file);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Check storage quota
      const quota = await this.getStorageQuota();
      if (quota.used + file.size > quota.total) {
        throw new Error('Insufficient storage space');
      }

      // Initialize progress
      const progress: FileUploadProgress = {
        fileId,
        filename: file.name,
        progress: 0,
        status: 'pending',
        uploadedBytes: 0,
        totalBytes: file.size
      };

      if (onProgress) onProgress(progress);

      // Determine upload method based on file size
      const useChunkedUpload = file.size > (options.chunkSize || this.DEFAULT_CHUNK_SIZE);

      if (useChunkedUpload) {
        return await this.uploadFileInChunks(file, userKey, fileId, options, onProgress);
      } else {
        return await this.uploadFileDirectly(file, userKey, fileId, options, onProgress);
      }
    } catch (error) {
      const errorProgress: FileUploadProgress = {
        fileId,
        filename: file.name,
        progress: 0,
        status: 'error',
        error: error instanceof Error ? error.message : 'Upload failed',
        uploadedBytes: 0,
        totalBytes: file.size
      };
      
      if (onProgress) onProgress(errorProgress);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Upload failed'
      };
    } finally {
      this.activeUploads.delete(fileId);
    }
  }

  /**
   * Upload file directly (for smaller files)
   */
  private static async uploadFileDirectly(
    file: File,
    userKey: CryptoKey,
    fileId: string,
    options: FileUploadOptions,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<UploadResult> {
    try {
      // Update progress - encrypting
      if (onProgress) {
        onProgress({
          fileId,
          filename: file.name,
          progress: 10,
          status: 'encrypting',
          uploadedBytes: 0,
          totalBytes: file.size
        });
      }

      // Encrypt file
      const encryptedData = await FileEncryptionService.encryptFile(file, userKey, {
        folderId: options.folderId,
        tags: options.tags
      });

      // Update progress - uploading
      if (onProgress) {
        onProgress({
          fileId,
          filename: file.name,
          progress: 30,
          status: 'uploading',
          uploadedBytes: 0,
          totalBytes: file.size
        });
      }

      // Upload to server
      const formData = new FormData();
      formData.append('fileId', fileId);
      formData.append('encryptedContent', new Blob([encryptedData.encryptedContent]));
      formData.append('encryptedFilename', encryptedData.encryptedFilename);
      formData.append('encryptionKey', encryptedData.encryptionKey);
      formData.append('iv', CryptoEngine.arrayBufferToBase64(encryptedData.iv));
      formData.append('metadata', JSON.stringify(encryptedData.metadata));

      const response = await fetch(`${this.API_BASE_URL}/upload`, {
        method: 'POST',
        body: formData,
        signal: this.activeUploads.get(fileId)?.signal
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();

      // Update progress - completed
      if (onProgress) {
        onProgress({
          fileId,
          filename: file.name,
          progress: 100,
          status: 'completed',
          uploadedBytes: file.size,
          totalBytes: file.size
        });
      }

      return {
        success: true,
        fileId,
        metadata: result.metadata
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Upload file in chunks (for larger files)
   */
  private static async uploadFileInChunks(
    file: File,
    userKey: CryptoKey,
    fileId: string,
    options: FileUploadOptions,
    onProgress?: (progress: FileUploadProgress) => void
  ): Promise<UploadResult> {
    try {
      // Update progress - encrypting
      if (onProgress) {
        onProgress({
          fileId,
          filename: file.name,
          progress: 5,
          status: 'encrypting',
          uploadedBytes: 0,
          totalBytes: file.size
        });
      }

      // Encrypt file in chunks
      const { chunks, metadata, encryptionKey } = await FileEncryptionService.encryptFileInChunks(
        file,
        userKey,
        {
          folderId: options.folderId,
          tags: options.tags
        },
        (encryptionProgress) => {
          if (onProgress) {
            onProgress({
              fileId,
              filename: file.name,
              progress: 5 + (encryptionProgress * 0.2), // 5-25% for encryption
              status: 'encrypting',
              uploadedBytes: 0,
              totalBytes: file.size
            });
          }
        }
      );

      // Initialize chunked upload
      const initResponse = await fetch(`${this.API_BASE_URL}/upload/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileId,
          totalChunks: chunks.length,
          encryptionKey,
          metadata
        }),
        signal: this.activeUploads.get(fileId)?.signal
      });

      if (!initResponse.ok) {
        throw new Error(`Failed to initialize chunked upload: ${initResponse.statusText}`);
      }

      // Upload chunks
      let uploadedChunks = 0;
      for (const chunk of chunks) {
        const chunkFormData = new FormData();
        chunkFormData.append('fileId', fileId);
        chunkFormData.append('chunkId', chunk.chunkId);
        chunkFormData.append('chunkIndex', chunk.chunkIndex.toString());
        chunkFormData.append('totalChunks', chunk.totalChunks.toString());
        chunkFormData.append('encryptedData', new Blob([chunk.encryptedData]));

        const chunkResponse = await fetch(`${this.API_BASE_URL}/upload/chunk`, {
          method: 'POST',
          body: chunkFormData,
          signal: this.activeUploads.get(fileId)?.signal
        });

        if (!chunkResponse.ok) {
          throw new Error(`Failed to upload chunk ${chunk.chunkIndex}: ${chunkResponse.statusText}`);
        }

        uploadedChunks++;
        const progress = 25 + ((uploadedChunks / chunks.length) * 70); // 25-95% for upload

        if (onProgress) {
          onProgress({
            fileId,
            filename: file.name,
            progress,
            status: 'uploading',
            uploadedBytes: Math.round((uploadedChunks / chunks.length) * file.size),
            totalBytes: file.size
          });
        }
      }

      // Finalize upload
      const finalizeResponse = await fetch(`${this.API_BASE_URL}/upload/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId }),
        signal: this.activeUploads.get(fileId)?.signal
      });

      if (!finalizeResponse.ok) {
        throw new Error(`Failed to finalize upload: ${finalizeResponse.statusText}`);
      }

      const result = await finalizeResponse.json();

      // Update progress - completed
      if (onProgress) {
        onProgress({
          fileId,
          filename: file.name,
          progress: 100,
          status: 'completed',
          uploadedBytes: file.size,
          totalBytes: file.size
        });
      }

      return {
        success: true,
        fileId,
        metadata: result.metadata
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Upload multiple files with queue management
   */
  static async uploadMultipleFiles(
    files: File[],
    userKey: CryptoKey,
    options: FileUploadOptions = {},
    onProgress?: (fileId: string, progress: FileUploadProgress) => void
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    
    // Create upload promises
    const uploadPromises = files.map(file => 
      () => this.uploadFile(file, userKey, options, progress => {
        if (onProgress) onProgress(progress.fileId, progress);
      })
    );

    // Process uploads with concurrency limit
    for (const uploadPromise of uploadPromises) {
      if (this.concurrentUploads >= this.MAX_CONCURRENT_UPLOADS) {
        await new Promise(resolve => {
          this.uploadQueue.push(async () => {
            const result = await uploadPromise();
            results.push(result);
            this.concurrentUploads--;
            resolve(undefined);
          });
        });
      } else {
        this.concurrentUploads++;
        const result = await uploadPromise();
        results.push(result);
        this.concurrentUploads--;
        
        // Process queued uploads
        if (this.uploadQueue.length > 0) {
          const nextUpload = this.uploadQueue.shift();
          if (nextUpload) {
            this.concurrentUploads++;
            nextUpload();
          }
        }
      }
    }

    return results;
  }

  /**
   * Cancel file upload
   */
  static cancelUpload(fileId: string): boolean {
    const controller = this.activeUploads.get(fileId);
    if (controller) {
      controller.abort();
      this.activeUploads.delete(fileId);
      return true;
    }
    return false;
  }

  /**
   * Get current storage quota
   */
  static async getStorageQuota(): Promise<StorageQuota> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/quota`);
      if (!response.ok) {
        throw new Error('Failed to fetch storage quota');
      }
      return await response.json();
    } catch (error) {
      // Return default quota if API fails
      return {
        used: 0,
        total: 5 * 1024 * 1024 * 1024, // 5GB default
        percentage: 0
      };
    }
  }

  /**
   * Validate files before upload
   */
  static validateFiles(files: File[]): { valid: File[]; invalid: Array<{ file: File; errors: string[] }> } {
    const valid: File[] = [];
    const invalid: Array<{ file: File; errors: string[] }> = [];

    for (const file of files) {
      const validation = FileEncryptionService.validateFile(file);
      if (validation.isValid) {
        valid.push(file);
      } else {
        invalid.push({ file, errors: validation.errors });
      }
    }

    return { valid, invalid };
  }
}

// Import CryptoEngine for base64 conversion
import { CryptoEngine } from './crypto';