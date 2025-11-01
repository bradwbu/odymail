/**
 * File storage related type definitions for the encrypted email service
 */

export interface FileMetadata {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
  modifiedAt: Date;
  folderId?: string;
  tags?: string[];
  isShared: boolean;
  shareId?: string;
}

export interface EncryptedFile {
  id: string;
  encryptedFilename: string;
  encryptedContent: ArrayBuffer;
  size: number;
  mimeType: string;
  encryptionKey: string; // AES key encrypted with user's key
  iv: ArrayBuffer;
  metadata: FileMetadata;
}

export interface FileUploadProgress {
  fileId: string;
  filename: string;
  progress: number; // 0-100
  status: 'pending' | 'uploading' | 'encrypting' | 'completed' | 'error';
  error?: string;
  uploadedBytes: number;
  totalBytes: number;
}

export interface FileChunk {
  chunkId: string;
  fileId: string;
  chunkIndex: number;
  totalChunks: number;
  encryptedData: ArrayBuffer;
  size: number;
}

export interface StorageQuota {
  used: number;
  total: number;
  percentage: number;
}

export interface FileShareSettings {
  id: string;
  fileId: string;
  shareId: string;
  expiresAt?: Date;
  downloadLimit?: number;
  downloadCount: number;
  password?: string;
  createdAt: Date;
}

export interface FileUploadOptions {
  chunkSize?: number; // Default 1MB
  enableCompression?: boolean;
  enableDeduplication?: boolean;
  folderId?: string;
  tags?: string[];
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface StorageStats {
  totalFiles: number;
  totalSize: number;
  filesByType: { [mimeType: string]: number };
  recentUploads: FileMetadata[];
  largestFiles: FileMetadata[];
}