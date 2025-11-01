/**
 * File upload service tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileUploadService } from '../fileUploadService';
import { FileEncryptionService } from '../fileEncryption';

// Mock fetch
global.fetch = vi.fn();

// Mock FileEncryptionService
vi.mock('../fileEncryption', () => ({
  FileEncryptionService: {
    validateFile: vi.fn(),
    encryptFile: vi.fn(),
    encryptFileInChunks: vi.fn()
  }
}));

// Mock crypto
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: vi.fn().mockReturnValue('mock-uuid')
  }
});

describe('FileUploadService', () => {
  let mockUserKey: CryptoKey;
  let testFile: File;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockUserKey = {} as CryptoKey;
    testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });

    // Mock successful validation by default
    vi.mocked(FileEncryptionService.validateFile).mockReturnValue({
      isValid: true,
      errors: []
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('File Upload', () => {
    it('should upload a file successfully', async () => {
      // Mock encryption
      vi.mocked(FileEncryptionService.encryptFile).mockResolvedValue({
        encryptedContent: new ArrayBuffer(32),
        encryptedFilename: 'encrypted-filename',
        encryptionKey: 'encrypted-key',
        iv: new ArrayBuffer(12),
        metadata: {
          id: 'test-id',
          userId: 'test-user',
          filename: 'test.txt',
          originalName: 'test.txt',
          size: 100,
          mimeType: 'text/plain',
          uploadedAt: new Date(),
          modifiedAt: new Date(),
          isShared: false,
          tags: []
        }
      });

      // Mock storage quota check
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          used: 0,
          total: 5 * 1024 * 1024 * 1024, // 5GB
          percentage: 0
        })
      } as Response);

      // Mock upload response
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          fileId: 'test-id',
          metadata: { id: 'test-id', filename: 'test.txt' }
        })
      } as Response);

      const onProgress = vi.fn();
      const result = await FileUploadService.uploadFile(
        testFile,
        mockUserKey,
        {},
        onProgress
      );

      expect(result.success).toBe(true);
      expect(result.fileId).toBe('test-id');
      expect(onProgress).toHaveBeenCalled();

      // Verify encryption was called
      expect(FileEncryptionService.encryptFile).toHaveBeenCalledWith(
        testFile,
        mockUserKey,
        expect.any(Object)
      );

      // Verify upload request was made
      expect(fetch).toHaveBeenCalledWith(
        '/api/storage/upload',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData)
        })
      );
    });

    it('should handle validation errors', async () => {
      vi.mocked(FileEncryptionService.validateFile).mockReturnValue({
        isValid: false,
        errors: ['File is too large']
      });

      const result = await FileUploadService.uploadFile(testFile, mockUserKey);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File is too large');
    });

    it('should handle quota exceeded', async () => {
      // Mock quota check returning insufficient space
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          used: 4.9 * 1024 * 1024 * 1024, // 4.9GB used
          total: 5 * 1024 * 1024 * 1024,   // 5GB total
          percentage: 98
        })
      } as Response);

      const result = await FileUploadService.uploadFile(testFile, mockUserKey);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient storage space');
    });

    it('should handle upload failure', async () => {
      // Mock successful quota check
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          used: 0,
          total: 5 * 1024 * 1024 * 1024,
          percentage: 0
        })
      } as Response);

      // Mock encryption
      vi.mocked(FileEncryptionService.encryptFile).mockResolvedValue({
        encryptedContent: new ArrayBuffer(32),
        encryptedFilename: 'encrypted-filename',
        encryptionKey: 'encrypted-key',
        iv: new ArrayBuffer(12),
        metadata: {
          id: 'test-id',
          userId: 'test-user',
          filename: 'test.txt',
          originalName: 'test.txt',
          size: 100,
          mimeType: 'text/plain',
          uploadedAt: new Date(),
          modifiedAt: new Date(),
          isShared: false,
          tags: []
        }
      });

      // Mock failed upload
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        statusText: 'Server Error'
      } as Response);

      const result = await FileUploadService.uploadFile(testFile, mockUserKey);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Upload failed: Server Error');
    });
  });

  describe('Chunked Upload', () => {
    it('should handle chunked upload for large files', async () => {
      // Create a large file (mock)
      const largeFile = new File(['x'.repeat(2 * 1024 * 1024)], 'large.txt', { type: 'text/plain' });

      // Mock quota check
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          used: 0,
          total: 5 * 1024 * 1024 * 1024,
          percentage: 0
        })
      } as Response);

      // Mock chunked encryption
      vi.mocked(FileEncryptionService.encryptFileInChunks).mockResolvedValue({
        chunks: [
          {
            chunkId: 'chunk-0',
            fileId: 'test-id',
            chunkIndex: 0,
            totalChunks: 2,
            encryptedData: new ArrayBuffer(1024 * 1024),
            size: 1024 * 1024
          },
          {
            chunkId: 'chunk-1',
            fileId: 'test-id',
            chunkIndex: 1,
            totalChunks: 2,
            encryptedData: new ArrayBuffer(1024 * 1024),
            size: 1024 * 1024
          }
        ],
        metadata: {
          id: 'test-id',
          userId: 'test-user',
          filename: 'large.txt',
          originalName: 'large.txt',
          size: 2 * 1024 * 1024,
          mimeType: 'text/plain',
          uploadedAt: new Date(),
          modifiedAt: new Date(),
          isShared: false,
          tags: []
        },
        encryptionKey: 'encrypted-key'
      });

      // Mock chunked upload responses
      vi.mocked(fetch)
        .mockResolvedValueOnce({ ok: true } as Response) // init
        .mockResolvedValueOnce({ ok: true } as Response) // chunk 0
        .mockResolvedValueOnce({ ok: true } as Response) // chunk 1
        .mockResolvedValueOnce({ // finalize
          ok: true,
          json: () => Promise.resolve({
            success: true,
            fileId: 'test-id',
            metadata: { id: 'test-id', filename: 'large.txt' }
          })
        } as Response);

      const onProgress = vi.fn();
      const result = await FileUploadService.uploadFile(
        largeFile,
        mockUserKey,
        { chunkSize: 1024 * 1024 },
        onProgress
      );

      expect(result.success).toBe(true);
      expect(result.fileId).toBe('test-id');

      // Verify chunked encryption was called
      expect(FileEncryptionService.encryptFileInChunks).toHaveBeenCalled();

      // Verify all upload requests were made
      expect(fetch).toHaveBeenCalledTimes(5); // quota + init + 2 chunks + finalize
    });
  });

  describe('Multiple File Upload', () => {
    it('should upload multiple files', async () => {
      const files = [
        new File(['content1'], 'file1.txt', { type: 'text/plain' }),
        new File(['content2'], 'file2.txt', { type: 'text/plain' })
      ];

      // Mock quota check
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          used: 0,
          total: 5 * 1024 * 1024 * 1024,
          percentage: 0
        })
      } as Response);

      // Mock encryption for both files
      vi.mocked(FileEncryptionService.encryptFile)
        .mockResolvedValueOnce({
          encryptedContent: new ArrayBuffer(32),
          encryptedFilename: 'encrypted-filename-1',
          encryptionKey: 'encrypted-key-1',
          iv: new ArrayBuffer(12),
          metadata: {
            id: 'file-1',
            userId: 'test-user',
            filename: 'file1.txt',
            originalName: 'file1.txt',
            size: 100,
            mimeType: 'text/plain',
            uploadedAt: new Date(),
            modifiedAt: new Date(),
            isShared: false,
            tags: []
          }
        })
        .mockResolvedValueOnce({
          encryptedContent: new ArrayBuffer(32),
          encryptedFilename: 'encrypted-filename-2',
          encryptionKey: 'encrypted-key-2',
          iv: new ArrayBuffer(12),
          metadata: {
            id: 'file-2',
            userId: 'test-user',
            filename: 'file2.txt',
            originalName: 'file2.txt',
            size: 100,
            mimeType: 'text/plain',
            uploadedAt: new Date(),
            modifiedAt: new Date(),
            isShared: false,
            tags: []
          }
        });

      // Mock upload responses
      vi.mocked(fetch)
        .mockResolvedValueOnce({ // quota check
          ok: true,
          json: () => Promise.resolve({
            used: 0,
            total: 5 * 1024 * 1024 * 1024,
            percentage: 0
          })
        } as Response)
        .mockResolvedValueOnce({ // file 1 upload
          ok: true,
          json: () => Promise.resolve({
            success: true,
            fileId: 'file-1',
            metadata: { id: 'file-1', filename: 'file1.txt' }
          })
        } as Response)
        .mockResolvedValueOnce({ // quota check for file 2
          ok: true,
          json: () => Promise.resolve({
            used: 100,
            total: 5 * 1024 * 1024 * 1024,
            percentage: 0
          })
        } as Response)
        .mockResolvedValueOnce({ // file 2 upload
          ok: true,
          json: () => Promise.resolve({
            success: true,
            fileId: 'file-2',
            metadata: { id: 'file-2', filename: 'file2.txt' }
          })
        } as Response);

      const onProgress = vi.fn();
      const results = await FileUploadService.uploadMultipleFiles(
        files,
        mockUserKey,
        {},
        onProgress
      );

      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(onProgress).toHaveBeenCalled();
    });
  });

  describe('Upload Cancellation', () => {
    it('should cancel upload', () => {
      const fileId = 'test-file-id';
      
      // Start an upload (this would normally set up an AbortController)
      const result = FileUploadService.cancelUpload(fileId);
      
      // Since no upload was actually started, this should return false
      expect(result).toBe(false);
    });
  });

  describe('File Validation', () => {
    it('should validate files before upload', () => {
      const validFile = new File(['content'], 'valid.txt', { type: 'text/plain' });
      const invalidFile = new File([''], '', { type: 'text/plain' });

      vi.mocked(FileEncryptionService.validateFile)
        .mockReturnValueOnce({ isValid: true, errors: [] })
        .mockReturnValueOnce({ isValid: false, errors: ['Invalid file'] });

      const result = FileUploadService.validateFiles([validFile, invalidFile]);

      expect(result.valid).toHaveLength(1);
      expect(result.invalid).toHaveLength(1);
      expect(result.invalid[0].errors).toContain('Invalid file');
    });
  });

  describe('Storage Quota', () => {
    it('should get storage quota', async () => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          used: 1024 * 1024 * 1024, // 1GB
          total: 5 * 1024 * 1024 * 1024, // 5GB
          percentage: 20
        })
      } as Response);

      const quota = await FileUploadService.getStorageQuota();

      expect(quota.used).toBe(1024 * 1024 * 1024);
      expect(quota.total).toBe(5 * 1024 * 1024 * 1024);
      expect(quota.percentage).toBe(20);
    });

    it('should return default quota on API failure', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('API Error'));

      const quota = await FileUploadService.getStorageQuota();

      expect(quota.used).toBe(0);
      expect(quota.total).toBe(5 * 1024 * 1024 * 1024); // 5GB default
      expect(quota.percentage).toBe(0);
    });
  });
});