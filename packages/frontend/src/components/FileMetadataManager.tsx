/**
 * File metadata manager component with expandable details and animations
 */

import React, { useState, useCallback } from 'react';
import { FileMetadata, FileShareSettings } from '../types/storage';

interface FileMetadataManagerProps {
  file: FileMetadata;
  onUpdate?: (metadata: FileMetadata) => void;
  onShare?: (shareSettings: Partial<FileShareSettings>) => void;
  onDelete?: (fileId: string) => void;
  className?: string;
}

export const FileMetadataManager: React.FC<FileMetadataManagerProps> = ({
  file,
  onUpdate,
  onShare,
  onDelete,
  className = ''
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedMetadata, setEditedMetadata] = useState<FileMetadata>(file);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareSettings, setShareSettings] = useState<Partial<FileShareSettings>>({
    expiresAt: undefined,
    downloadLimit: undefined,
    password: ''
  });

  // Toggle expanded view
  const handleToggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Start editing
  const handleStartEdit = useCallback(() => {
    setIsEditing(true);
    setEditedMetadata(file);
  }, [file]);

  // Cancel editing
  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
    setEditedMetadata(file);
  }, [file]);

  // Save changes
  const handleSaveEdit = useCallback(() => {
    if (onUpdate) {
      onUpdate(editedMetadata);
    }
    setIsEditing(false);
  }, [editedMetadata, onUpdate]);

  // Handle metadata field changes
  const handleMetadataChange = useCallback((field: keyof FileMetadata, value: any) => {
    setEditedMetadata(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  // Handle tag changes
  const handleTagsChange = useCallback((tags: string[]) => {
    setEditedMetadata(prev => ({
      ...prev,
      tags
    }));
  }, []);

  // Add new tag
  const handleAddTag = useCallback((tag: string) => {
    if (tag.trim() && !editedMetadata.tags?.includes(tag.trim())) {
      const newTags = [...(editedMetadata.tags || []), tag.trim()];
      handleTagsChange(newTags);
    }
  }, [editedMetadata.tags, handleTagsChange]);

  // Remove tag
  const handleRemoveTag = useCallback((tagToRemove: string) => {
    const newTags = (editedMetadata.tags || []).filter(tag => tag !== tagToRemove);
    handleTagsChange(newTags);
  }, [editedMetadata.tags, handleTagsChange]);

  // Handle share
  const handleShare = useCallback(() => {
    if (onShare) {
      onShare({
        ...shareSettings,
        fileId: file.id
      });
    }
    setShowShareDialog(false);
  }, [shareSettings, file.id, onShare]);

  // Handle delete
  const handleDelete = useCallback(() => {
    if (onDelete && window.confirm('Are you sure you want to delete this file?')) {
      onDelete(file.id);
    }
  }, [file.id, onDelete]);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format date
  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  return (
    <div className={`file-metadata-manager bg-white border border-gray-200 rounded-lg shadow-sm ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* File Icon */}
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <input
                  type="text"
                  value={editedMetadata.filename}
                  onChange={(e) => handleMetadataChange('filename', e.target.value)}
                  className="text-sm font-medium text-gray-900 bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none"
                />
              ) : (
                <h3 className="text-sm font-medium text-gray-900 truncate">
                  {file.filename}
                </h3>
              )}
              <p className="text-xs text-gray-500">
                {formatFileSize(file.size)} • {file.mimeType}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleSaveEdit}
                  className="p-1 text-green-600 hover:text-green-700 transition-colors"
                  title="Save changes"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Cancel editing"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleStartEdit}
                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Edit metadata"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
                <button
                  onClick={() => setShowShareDialog(true)}
                  className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                  title="Share file"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
                  </svg>
                </button>
                <button
                  onClick={handleToggleExpanded}
                  className={`p-1 text-gray-400 hover:text-gray-600 transition-all duration-200 ${
                    isExpanded ? 'transform rotate-180' : ''
                  }`}
                  title="Toggle details"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      <div className={`
        overflow-hidden transition-all duration-300 ease-in-out
        ${isExpanded ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}
      `}>
        <div className="p-4 space-y-4">
          {/* File Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Uploaded
              </label>
              <p className="text-gray-900">{formatDate(file.uploadedAt)}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Modified
              </label>
              <p className="text-gray-900">{formatDate(file.modifiedAt)}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                File ID
              </label>
              <p className="text-gray-900 font-mono text-xs truncate">{file.id}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Shared
              </label>
              <p className="text-gray-900">{file.isShared ? 'Yes' : 'No'}</p>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {(isEditing ? editedMetadata.tags : file.tags)?.map((tag, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full"
                >
                  {tag}
                  {isEditing && (
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="ml-1 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
              {isEditing && (
                <input
                  type="text"
                  placeholder="Add tag..."
                  className="px-2 py-1 text-xs border border-gray-300 rounded-full focus:outline-none focus:border-blue-500"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleAddTag(e.currentTarget.value);
                      e.currentTarget.value = '';
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-2 pt-2 border-t border-gray-100">
            <button
              onClick={handleDelete}
              className="px-3 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      {/* Share Dialog */}
      {showShareDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 animate-fadeIn">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Share File</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expires At (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={shareSettings.expiresAt ? new Date(shareSettings.expiresAt).toISOString().slice(0, 16) : ''}
                  onChange={(e) => setShareSettings(prev => ({
                    ...prev,
                    expiresAt: e.target.value ? new Date(e.target.value) : undefined
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Download Limit (Optional)
                </label>
                <input
                  type="number"
                  min="1"
                  value={shareSettings.downloadLimit || ''}
                  onChange={(e) => setShareSettings(prev => ({
                    ...prev,
                    downloadLimit: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                  placeholder="Unlimited"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password (Optional)
                </label>
                <input
                  type="password"
                  value={shareSettings.password || ''}
                  onChange={(e) => setShareSettings(prev => ({
                    ...prev,
                    password: e.target.value
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:border-blue-500"
                  placeholder="No password protection"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowShareDialog(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleShare}
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileMetadataManager;