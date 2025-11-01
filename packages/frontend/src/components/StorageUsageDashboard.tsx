/**
 * Storage usage dashboard with animated charts and progress rings
 */

import React, { useMemo, useEffect, useState } from 'react';
import { FileMetadata, StorageQuota } from '../types/storage';

interface StorageUsageDashboardProps {
  files: FileMetadata[];
  storageQuota: StorageQuota;
  className?: string;
}

interface FileTypeStats {
  type: string;
  count: number;
  size: number;
  percentage: number;
  color: string;
}

export const StorageUsageDashboard: React.FC<StorageUsageDashboardProps> = ({
  files,
  storageQuota,
  className = ''
}) => {
  const [animatedPercentage, setAnimatedPercentage] = useState(0);
  const [animatedStats, setAnimatedStats] = useState<FileTypeStats[]>([]);

  // Calculate file type statistics
  const fileTypeStats = useMemo(() => {
    const typeMap = new Map<string, { count: number; size: number }>();
    
    files.forEach(file => {
      const category = getFileCategory(file.mimeType);
      const existing = typeMap.get(category) || { count: 0, size: 0 };
      typeMap.set(category, {
        count: existing.count + 1,
        size: existing.size + file.size
      });
    });

    const totalSize = Array.from(typeMap.values()).reduce((sum, stat) => sum + stat.size, 0);
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#84CC16'];
    
    return Array.from(typeMap.entries())
      .map(([type, stats], index) => ({
        type,
        count: stats.count,
        size: stats.size,
        percentage: totalSize > 0 ? (stats.size / totalSize) * 100 : 0,
        color: colors[index % colors.length]
      }))
      .sort((a, b) => b.size - a.size);
  }, [files]);

  // Recent files (last 7 days)
  const recentFiles = useMemo(() => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    return files
      .filter(file => new Date(file.uploadedAt) > sevenDaysAgo)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
      .slice(0, 5);
  }, [files]);

  // Largest files
  const largestFiles = useMemo(() => {
    return [...files]
      .sort((a, b) => b.size - a.size)
      .slice(0, 5);
  }, [files]);

  // Animate storage percentage
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercentage(storageQuota.percentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [storageQuota.percentage]);

  // Animate file type stats
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedStats(fileTypeStats);
    }, 200);
    return () => clearTimeout(timer);
  }, [fileTypeStats]);

  // Helper functions
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileCategory = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'Images';
    if (mimeType.startsWith('video/')) return 'Videos';
    if (mimeType.startsWith('audio/')) return 'Audio';
    if (mimeType.includes('pdf')) return 'PDFs';
    if (mimeType.includes('document') || mimeType.includes('word')) return 'Documents';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Spreadsheets';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'Presentations';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'Archives';
    return 'Other';
  };

  const formatDate = (date: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  };

  // Progress ring component
  const ProgressRing: React.FC<{ percentage: number; size: number; strokeWidth: number; color: string }> = ({
    percentage,
    size,
    strokeWidth,
    color
  }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const strokeDasharray = `${circumference} ${circumference}`;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
    );
  };

  return (
    <div className={`storage-usage-dashboard ${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Storage Overview */}
        <div className="lg:col-span-1">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Usage</h3>
            
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <ProgressRing
                  percentage={animatedPercentage}
                  size={120}
                  strokeWidth={8}
                  color="#3B82F6"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">
                      {Math.round(animatedPercentage)}%
                    </div>
                    <div className="text-xs text-gray-600">Used</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Used:</span>
                <span className="font-medium">{formatFileSize(storageQuota.used)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Total:</span>
                <span className="font-medium">{formatFileSize(storageQuota.total)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Available:</span>
                <span className="font-medium text-green-600">
                  {formatFileSize(storageQuota.total - storageQuota.used)}
                </span>
              </div>
            </div>

            {storageQuota.percentage > 80 && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex items-center">
                  <svg className="w-4 h-4 text-yellow-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm text-yellow-800">Storage almost full</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* File Type Breakdown */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">File Types</h3>
            
            <div className="space-y-3">
              {animatedStats.map((stat, index) => (
                <div
                  key={stat.type}
                  className="animate-slideUp"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: stat.color }}
                      />
                      <span className="text-sm font-medium text-gray-900">{stat.type}</span>
                      <span className="text-xs text-gray-500">({stat.count} files)</span>
                    </div>
                    <span className="text-sm text-gray-600">{formatFileSize(stat.size)}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full transition-all duration-1000 ease-out"
                      style={{
                        backgroundColor: stat.color,
                        width: `${stat.percentage}%`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {animatedStats.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                    clipRule="evenodd"
                  />
                </svg>
                <p>No files uploaded yet</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Files and Largest Files */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Recent Files */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Files</h3>
          
          {recentFiles.length > 0 ? (
            <div className="space-y-3">
              {recentFiles.map((file, index) => (
                <div
                  key={file.id}
                  className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 transition-colors animate-fadeIn"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="text-lg">
                    {getFileCategory(file.mimeType) === 'Images' ? '🖼️' :
                     getFileCategory(file.mimeType) === 'Videos' ? '🎥' :
                     getFileCategory(file.mimeType) === 'Audio' ? '🎵' :
                     getFileCategory(file.mimeType) === 'PDFs' ? '📄' :
                     getFileCategory(file.mimeType) === 'Documents' ? '📝' : '📁'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.filename}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(file.uploadedAt)} • {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <p>No recent files</p>
            </div>
          )}
        </div>

        {/* Largest Files */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Largest Files</h3>
          
          {largestFiles.length > 0 ? (
            <div className="space-y-3">
              {largestFiles.map((file, index) => (
                <div
                  key={file.id}
                  className="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-50 transition-colors animate-fadeIn"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="text-lg">
                    {getFileCategory(file.mimeType) === 'Images' ? '🖼️' :
                     getFileCategory(file.mimeType) === 'Videos' ? '🎥' :
                     getFileCategory(file.mimeType) === 'Audio' ? '🎵' :
                     getFileCategory(file.mimeType) === 'PDFs' ? '📄' :
                     getFileCategory(file.mimeType) === 'Documents' ? '📝' : '📁'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.filename}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-gray-500">
                      {((file.size / storageQuota.total) * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              <p>No files uploaded yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StorageUsageDashboard;