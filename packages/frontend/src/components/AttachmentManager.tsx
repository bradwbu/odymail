/**
 * Attachment Manager Component with drag-drop and progress indicators
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmailAttachment } from '../types/email';
import { EmailService } from '../services/emailService';

interface AttachmentManagerProps {
  attachments: EmailAttachment[];
  onChange: (attachments: EmailAttachment[]) => void;
  disabled?: boolean;
  className?: string;
}

interface UploadProgress {
  [fileId: string]: {
    progress: number;
    status: 'uploading' | 'processing' | 'complete' | 'error';
    error?: string;
  };
}

export const AttachmentManager: React.FC<AttachmentManagerProps> = ({
  attachments,
  onChange,
  disabled = false,
  className = ''
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress>({});
  const [emailService] = useState(() => new EmailService());
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Initialize email service
  useEffect(() => {
    emailService.initialize().catch(console.error);
  }, [emailService]);

  // Format file size
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }, []);

  // Get file icon based on type
  const getFileIcon = useCallback((mimeType: string): string => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📈';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return '🗜️';
    return '📎';
  }, []);

  // Process files
  const processFiles = useCallback(async (files: FileList | File[]) => {
    if (disabled) return;

    const fileArray = Array.from(files);
    const newAttachments: EmailAttachment[] = [];

    for (const file of fileArray) {
      const fileId = crypto.randomUUID();
      
      // Initialize progress tracking
      setUploadProgress(prev => ({
        ...prev,
        [fileId]: { progress: 0, status: 'uploading' }
      }));

      try {
        // Simulate upload progress
        const progressInterval = setInterval(() => {
          setUploadProgress(prev => {
            const current = prev[fileId]?.progress || 0;
            if (current < 90) {
              return {
                ...prev,
                [fileId]: { ...prev[fileId], progress: current + 10 }
              };
            }
            return prev;
          });
        }, 100);

        // Process the file
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: { ...prev[fileId], status: 'processing', progress: 90 }
        }));

        const attachment = await emailService.processAttachment(file);
        attachment.id = fileId;

        clearInterval(progressInterval);
        
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: { progress: 100, status: 'complete' }
        }));

        newAttachments.push(attachment);

        // Remove progress after animation
        setTimeout(() => {
          setUploadProgress(prev => {
            const { [fileId]: removed, ...rest } = prev;
            return rest;
          });
        }, 1000);

      } catch (error) {
        setUploadProgress(prev => ({
          ...prev,
          [fileId]: { 
            progress: 0, 
            status: 'error', 
            error: error instanceof Error ? error.message : 'Upload failed'
          }
        }));

        // Remove error after delay
        setTimeout(() => {
          setUploadProgress(prev => {
            const { [fileId]: removed, ...rest } = prev;
            return rest;
          });
        }, 3000);
      }
    }

    if (newAttachments.length > 0) {
      onChange([...attachments, ...newAttachments]);
    }
  }, [disabled, attachments, onChange, emailService]);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
    // Reset input value to allow selecting the same file again
    e.target.value = '';
  }, [processFiles]);

  // Handle drag events
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Only set drag over to false if we're leaving the drop zone entirely
    const rect = dropZoneRef.current?.getBoundingClientRect();
    if (rect) {
      const { clientX, clientY } = e;
      if (
        clientX < rect.left ||
        clientX > rect.right ||
        clientY < rect.top ||
        clientY > rect.bottom
      ) {
        setIsDragOver(false);
      }
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processFiles(files);
    }
  }, [disabled, processFiles]);

  // Remove attachment
  const removeAttachment = useCallback((attachmentId: string) => {
    onChange(attachments.filter(att => att.id !== attachmentId));
  }, [attachments, onChange]);

  // Open file picker
  const openFilePicker = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  // Calculate total size
  const totalSize = attachments.reduce((sum, att) => sum + att.size, 0);
  const maxTotalSize = 100 * 1024 * 1024; // 100MB
  const sizePercentage = (totalSize / maxTotalSize) * 100;

  // Animation variants
  const attachmentVariants = {
    hidden: { opacity: 0, scale: 0.8, y: 20 },
    visible: { 
      opacity: 1, 
      scale: 1, 
      y: 0,
      transition: { duration: 0.3, ease: 'easeOut' }
    },
    exit: { 
      opacity: 0, 
      scale: 0.8, 
      y: -20,
      transition: { duration: 0.2, ease: 'easeIn' }
    }
  };

  const dropZoneVariants = {
    normal: { 
      borderColor: '#d1d5db',
      backgroundColor: '#f9fafb',
      scale: 1
    },
    dragOver: { 
      borderColor: '#3b82f6',
      backgroundColor: '#eff6ff',
      scale: 1.02,
      transition: { duration: 0.2 }
    }
  };

  const progressVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: { duration: 0.2 }
    },
    exit: { 
      opacity: 0, 
      y: -10,
      transition: { duration: 0.2 }
    }
  };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Attachments List */}
      <AnimatePresence>
        {attachments.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-b border-gray-200 pb-3"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">
                Attachments ({attachments.length})
              </span>
              <div className="text-xs text-gray-500">
                {formatFileSize(totalSize)} / {formatFileSize(maxTotalSize)}
              </div>
            </div>

            {/* Size indicator */}
            <div className="w-full bg-gray-200 rounded-full h-1 mb-3">
              <motion.div
                className={`h-1 rounded-full ${
                  sizePercentage > 90 ? 'bg-red-500' : sizePercentage > 70 ? 'bg-yellow-500' : 'bg-blue-500'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(sizePercentage, 100)}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            <div className="space-y-2">
              <AnimatePresence>
                {attachments.map((attachment) => (
                  <motion.div
                    key={attachment.id}
                    variants={attachmentVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="flex items-center justify-between p-2 bg-gray-50 rounded-md border border-gray-200"
                  >
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <span className="text-lg">{getFileIcon(attachment.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {attachment.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {formatFileSize(attachment.size)} • {attachment.type}
                        </div>
                      </div>
                    </div>

                    {!disabled && (
                      <motion.button
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        onClick={() => removeAttachment(attachment.id)}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </motion.button>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload Progress */}
      <AnimatePresence>
        {Object.entries(uploadProgress).map(([fileId, progress]) => (
          <motion.div
            key={fileId}
            variants={progressVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="p-3 bg-blue-50 border border-blue-200 rounded-md"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-blue-900">
                {progress.status === 'uploading' && 'Uploading...'}
                {progress.status === 'processing' && 'Processing...'}
                {progress.status === 'complete' && 'Complete!'}
                {progress.status === 'error' && 'Error'}
              </span>
              <span className="text-xs text-blue-700">{progress.progress}%</span>
            </div>

            {progress.status !== 'error' ? (
              <div className="w-full bg-blue-200 rounded-full h-2">
                <motion.div
                  className="bg-blue-600 h-2 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            ) : (
              <div className="text-sm text-red-600">{progress.error}</div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Drop Zone */}
      <motion.div
        ref={dropZoneRef}
        variants={dropZoneVariants}
        animate={isDragOver ? 'dragOver' : 'normal'}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={openFilePicker}
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          disabled ? 'cursor-not-allowed opacity-50' : 'hover:border-blue-400 hover:bg-blue-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          disabled={disabled}
          className="hidden"
        />

        <motion.div
          animate={isDragOver ? { scale: 1.1 } : { scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </motion.div>

        <div className="mt-4">
          <p className="text-sm text-gray-600">
            {isDragOver ? (
              <span className="font-medium text-blue-600">Drop files here</span>
            ) : (
              <>
                <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
              </>
            )}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Maximum file size: 25MB • Total limit: 100MB
          </p>
        </div>
      </motion.div>
    </div>
  );
};