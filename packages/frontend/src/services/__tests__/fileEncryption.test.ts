/**
 * File encryption service tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FileEncryptionService } from '../fileEncryption';
import { CryptoEngine } from '../crypto';

// Mock Web Crypto API
const mockCrypto = {
  subtle: {
    generateKey: vi.fn(),
    encrypt: vi.fn(),
    decrypt: vi.fn(),
    exportKey: vi.fn(),
    importKey: vi.fn(),
  },
  getRandomValues: vi.fn(),
  randomUUID: vi.fn()
};

Object.defineProperty(global, 'crypto', {
  value: mockCrypto
});

// Mock FileReader
class MockFileReader {
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  result: ArrayBuffer | null = null;

  readAsArrayBuffer(file: Blob) {
    setTimeout(() => {
      this.result = new ArrayBuffer(file.size);
      if (this.onload) {
        this.onload({ target: { result: this.result } });
      }
    }, 0);
  }
}

Object.defineProperty(global, 'FileReader', {
  value: MockFileReader
});

describe('FileEncryptionService', () => {
  let mockUserKey: CryptoKey;
  let mockFileKey: CryptoKey;
  let testFile: File;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock crypto keys
    mockUserKey = {} as CryptoKey;
    mockFileKey = {} as CryptoKey;

    // Mock crypto operations
    mockCrypto.subtle.generateKey.mockResolvedValue(mockFileKey);
    mockCrypto.subtle.encrypt.mockResolvedValue(new ArrayBuffer(32));
    mockCrypto.subtle.decrypt.mockResolvedValue(new ArrayBuffer(16));
    mockCrypto.subtle.exportKey.mockResolvedValue(new ArrayBuffer(32));
    mockCrypto.subtle.importKey.mockResolvedValue(mockFileKey);
    mockCrypto.randomUUID.mockReturnValue('test-uuid');

    // Create test file
    testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
  });

  describe('File Validation', () => {
    it('should validate a normal file', () => {
      const result = FileEncryptionService.validateFile(testFile);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty file', () => {
      const emptyFile = new File([''], 'empty.txt', { type: 'text/plain' });
      const result = FileEncryptionService.validateFile(emptyFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File is empty');
    });

    it('should reject file without name', () => {
      const noNameFile = new File(['content'], '', { type: 'text/plain' });
      const result = FileEncryptionService.validateFile(noNameFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File name is required');
    });

    it('should reject dangerous file types', () => {
      const dangerousFile = new File(['content'], 'virus.exe', { type: 'application/exe' });
      const result = FileEncryptionService.validateFile(dangerousFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File type is not allowed for security reasons');
    });

    it('should reject oversized file', () => {
      // Mock a large file by overriding the size property
      Object.defineProperty(testFile, 'size', {
        value: 200 * 1024 * 1024, // 200MB
        writable: false
      });

      const result = FileEncryptionService.validateFile(testFile);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size exceeds maximum limit of 100MB');
    });
  });

  describe('File Encryption', () => {
    it('should encrypt a file successfully', async () => {
      const metadata = {
        userId: 'test-user',
        folderId: 'test-folder'
      };

      const result = await FileEncryptionService.encryptFile(testFile, mockUserKey, metadata);

      expect(result).toHaveProperty('encryptedContent');
      expect(result).toHaveProperty('encryptedFilename');
      expect(result).toHaveProperty('encryptionKey');
      expect(result).toHaveProperty('iv');
      expect(result).toHaveProperty('metadata');

      expect(result.metadata.userId).toBe('test-user');
      expect(result.metadata.folderId).toBe('test-folder');
      expect(result.metadata.originalName).toBe('test.txt');
      expect(result.metadata.mimeType).toBe('text/plain');

      // Verify crypto operations were called
      expect(mockCrypto.subtle.generateKey).toHaveBeenCalled();
      expect(mockCrypto.subtle.encrypt).toHaveBeenCalledTimes(3); // content, filename, key
      expect(mockCrypto.subtle.exportKey).toHaveBeenCalled();
    });

    it('should handle encryption errors', async () => {
      mockCrypto.subtle.generateKey.mockRejectedValue(new Error('Crypto error'));

      await expect(
        FileEncryptionService.encryptFile(testFile, mockUserKey, {})
      ).rejects.toThrow('Failed to encrypt file');
    });
  });

  describe('File Decryption', () => {
    it('should decrypt a file successfully', async () => {
      const encryptedFile = {
        id: 'test-id',
        encryptedFilename: 'encrypted-filename',
        encryptedContent: new ArrayBuffer(32),
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
      };

      // Mock CryptoEngine methods
      vi.spyOn(CryptoEngine, 'base64ToArrayBuffer').mockReturnValue(new ArrayBuffer(32));
      vi.spyOn(CryptoEngine, 'arrayBufferToString').mockReturnValue('test.txt');

      const result = await FileEncryptionService.decryptFile(encryptedFile, mockUserKey);

      expect(result).toHaveProperty('content');
      expect(result).toHaveProperty('filename');
      expect(result.filename).toBe('test.txt');

      // Verify crypto operations were called
      expect(mockCrypto.subtle.decrypt).toHaveBeenCalledTimes(2); // key and content
      expect(mockCrypto.subtle.importKey).toHaveBeenCalled();
    });

    it('should handle decryption errors', async () => {
      const encryptedFile = {
        id: 'test-id',
        encryptedFilename: 'encrypted-filename',
        encryptedContent: new ArrayBuffer(32),
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
      };

      mockCrypto.subtle.decrypt.mockRejectedValue(new Error('Decryption failed'));

      await expect(
        FileEncryptionService.decryptFile(encryptedFile, mockUserKey)
      ).rejects.toThrow('Failed to decrypt file');
    });
  });

  describe('Chunked Encryption', () => {
    it('should encrypt file in chunks', async () => {
      const metadata = { userId: 'test-user' };
      const onProgress = vi.fn();

      const result = await FileEncryptionService.encryptFileInChunks(
        testFile,
        mockUserKey,
        metadata,
        onProgress
      );

      expect(result).toHaveProperty('chunks');
      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('encryptionKey');

      expect(result.chunks).toBeInstanceOf(Array);
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(onProgress).toHaveBeenCalled();

      // Verify each chunk has required properties
      result.chunks.forEach(chunk => {
        expect(chunk).toHaveProperty('chunkId');
        expect(chunk).toHaveProperty('fileId');
        expect(chunk).toHaveProperty('chunkIndex');
        expect(chunk).toHaveProperty('totalChunks');
        expect(chunk).toHaveProperty('encryptedData');
        expect(chunk).toHaveProperty('size');
      });
    });
  });

  describe('File Hash Generation', () => {
    it('should generate file hash', async () => {
      // Mock crypto.subtle.digest
      mockCrypto.subtle.digest = vi.fn().mockResolvedValue(new ArrayBuffer(32));
      vi.spyOn(CryptoEngine, 'arrayBufferToBase64').mockReturnValue('mock-hash');

      const hash = await FileEncryptionService.generateFileHash(testFile);

      expect(hash).toBe('mock-hash');
      expect(mockCrypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(ArrayBuffer));
    });
  });

  describe('Utility Functions', () => {
    it('should create download blob', () => {
      const content = new ArrayBuffer(100);
      const mimeType = 'text/plain';

      const blob = FileEncryptionService.createDownloadBlob(content, mimeType);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe(mimeType);
      expect(blob.size).toBe(100);
    });

    it('should create and revoke download URL', () => {
      const mockUrl = 'blob:mock-url';
      
      // Mock URL methods
      global.URL.createObjectURL = vi.fn().mockReturnValue(mockUrl);
      global.URL.revokeObjectURL = vi.fn();

      const blob = new Blob(['test'], { type: 'text/plain' });
      const url = FileEncryptionService.createDownloadUrl(blob);

      expect(url).toBe(mockUrl);
      expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob);

      FileEncryptionService.revokeDownloadUrl(url);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(url);
    });
  });
});