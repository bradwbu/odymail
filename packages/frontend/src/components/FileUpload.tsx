/**
 * File upload component with drag-and-drop interface and elegant animations
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { FileUploadService, UploadResult } from '../services/fileUploadService';
import { FileUploadProgress, FileUploadOptions } from '../types/storage';
import { useCrypto } from '../hooks/useCrypto';

interface FileUploadProps {
  onUploadComplete?: (results: UploadResult[]) => void;
  onUploadProgress?: (fileId: string, progress: FileUploadProgress) => void;
  options?: FileUploadOptions;
  multiple?: boolean;
  accept?: string;
  maxFiles?: number;
  className?: string;
}

interface UploadingFile {
  file: File;
  progress: FileUploadProgress;
  result?: UploadResult;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onUploadComplete,
  onUploadProgress,
  options = {},
  multiple = true,
  accept,
  maxFiles = 10,
  className = ''
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<Map<string, UploadingFile>>(new Map());
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const { userKey } = useCrypto();

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set drag over to false if leaving the drop zone entirely
    if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  // Process selected files
  const handleFiles = useCallback(async (files: File[]) => {
    if (!userKey) {
      console.error('User key not available for encryption');
      return;
    }

    // Limit number of files
    const filesToUpload = files.slice(0, maxFiles);
    
    // Validate files
    const { valid, invalid } = FileUploadService.validateFiles(filesToUpload);
    
    if (invalid.length > 0) {
      console.warn('Some files are invalid:', invalid);
      // You could show a toast notification here
    }

    if (valid.length === 0) {
      return;
    }

    setIsUploading(true);
    
    // Initialize uploading files state
    const newUploadingFiles = new Map<string, UploadingFile>();
    valid.forEach(file => {
      const fileId = crypto.randomUUID();
      newUploadingFiles.set(fileId, {
        file,
        progress: {
          fileId,
          filename: file.name,
          progress: 0,
          status: 'pending',
          uploadedBytes: 0,
          totalBytes: file.size
        }
      });
    });
    
    setUploadingFiles(newUploadingFiles);

    try {
      // Upload files
      const results = await FileUploadService.uploadMultipleFiles(
        valid,
        userKey,
        options,
        (fileId, progress) => {
          setUploadingFiles(prev => {
            const updated = new Map(prev);
            const uploadingFile = updated.get(fileId);
            if (uploadingFile) {
              updated.set(fileId, {
                ...uploadingFile,
                progress
              });
            }
            return updated;
          });
          
          if (onUploadProgress) {
            onUploadProgress(fileId, progress);
          }
        }
      );

      // Update results
      results.forEach((result, index) => {
        const fileId = Array.from(newUploadingFiles.keys())[index];
        setUploadingFiles(prev => {
          const updated = new Map(prev);
          const uploadingFile = updated.get(fileId);
          if (uploadingFile) {
            updated.set(fileId, {
              ...uploadingFile,
              result
            });
          }
          return updated;
        });
      });

      if (onUploadComplete) {
        onUploadComplete(results);
      }

      // Clear completed uploads after a delay
      setTimeout(() => {
        setUploadingFiles(new Map());
      }, 3000);

    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  }, [userKey, maxFiles, options, onUploadComplete, onUploadProgress]);

  // Click to select files
  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Cancel upload
  const handleCancelUpload = useCallback((fileId: string) => {
    FileUploadService.cancelUpload(fileId);
    setUploadingFiles(prev => {
      const updated = new Map(prev);
      updated.delete(fileId);
      return updated;
    });
  }, []);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className={`file-upload-container ${className}`}>
      {/* Drop Zone */}
      <div
        ref={dropZoneRef}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-all duration-300 ease-in-out transform
          ${isDragOver 
            ? 'border-blue-500 bg-blue-50 scale-105 shadow-lg' 
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
          ${isUploading ? 'pointer-events-none opacity-75' : ''}
        `}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleClick}
      >
        {/* Upload Icon */}
        <div className={`
          mx-auto mb-4 transition-transform duration-300
          ${isDragOver ? 'scale-110' : 'scale-100'}
        `}>
          <svg
            className="w-12 h-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>

        {/* Upload Text */}
        <div className="space-y-2">
          <p className={`
            text-lg font-medium transition-colors duration-300
            ${isDragOver ? 'text-blue-600' : 'text-gray-700'}
          `}>
            {isDragOver ? 'Drop files here' : 'Drag & drop files here'}
          </p>
          <p className="text-sm text-gray-500">
            or click to select files
          </p>
          {maxFiles > 1 && (
            <p className="text-xs text-gray-400">
              Maximum {maxFiles} files
            </p>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple={multiple}
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Drag Overlay */}
        {isDragOver && (
          <div className="absolute inset-0 bg-blue-500 bg-opacity-10 rounded-lg animate-pulse" />
        )}
      </div>

      {/* Upload Progress */}
      {uploadingFiles.size > 0 && (
        <div className="mt-6 space-y-3">
          <h3 className="text-sm font-medium text-gray-700">
            Uploading Files ({uploadingFiles.size})
          </h3>
          
          {Array.from(uploadingFiles.entries()).map(([fileId, uploadingFile]) => (
            <div
              key={fileId}
              className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm animate-fadeIn"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {uploadingFile.file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatFileSize(uploadingFile.file.size)}
                  </p>
                </div>
                
                <div className="flex items-center space-x-2">
                  {/* Status Badge */}
                  <span className={`
                    px-2 py-1 text-xs font-medium rounded-full
                    ${uploadingFile.progress.status === 'completed' 
                      ? 'bg-green-100 text-green-800' 
                      : uploadingFile.progress.status === 'error'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-blue-100 text-blue-800'
                    }
                  `}>
                    {uploadingFile.progress.status}
                  </span>
                  
                  {/* Cancel Button */}
                  {uploadingFile.progress.status !== 'completed' && 
                   uploadingFile.progress.status !== 'error' && (
                    <button
                      onClick={() => handleCancelUpload(fileId)}
                      className="text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`
                    h-full transition-all duration-300 ease-out
                    ${uploadingFile.progress.status === 'completed'
                      ? 'bg-green-500'
                      : uploadingFile.progress.status === 'error'
                      ? 'bg-red-500'
                      : 'bg-blue-500'
                    }
                  `}
                  style={{ width: `${uploadingFile.progress.progress}%` }}
                />
              </div>

              {/* Progress Text */}
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-gray-500">
                  {uploadingFile.progress.progress.toFixed(0)}%
                </span>
                <span className="text-xs text-gray-500">
                  {formatFileSize(uploadingFile.progress.uploadedBytes)} / {formatFileSize(uploadingFile.progress.totalBytes)}
                </span>
              </div>

              {/* Error Message */}
              {uploadingFile.progress.error && (
                <p className="text-xs text-red-600 mt-2">
                  {uploadingFile.progress.error}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;