/**
 * Storage quota management service for tracking and enforcing storage limits
 */

import { User } from '../models/User';
import { File } from '../models/File';
import { NotificationService } from './notificationService';

export interface StorageAnalytics {
  totalFiles: number;
  totalSize: number;
  filesByType: { [mimeType: string]: number };
  recentUploads: any[];
  largestFiles: any[];
  storageGrowth: { date: string; size: number }[];
}

export interface CleanupSuggestion {
  type: 'large_files' | 'old_files' | 'duplicates' | 'unused_files';
  title: string;
  description: string;
  files: any[];
  potentialSavings: number;
}

export class StorageQuotaService {
  private static readonly QUOTA_WARNING_THRESHOLD = 0.8; // 80%
  private static readonly QUOTA_CRITICAL_THRESHOLD = 0.95; // 95%
  
  /**
   * Check if user has sufficient storage for a file
   */
  static async checkStorageAvailability(userId: string, fileSize: number): Promise<{
    available: boolean;
    quota: { used: number; total: number; percentage: number };
    message?: string;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      const quota = {
        used: user.storageUsed,
        total: user.storageQuota,
        percentage: user.storageQuota > 0 ? (user.storageUsed / user.storageQuota) * 100 : 0
      };

      const wouldExceed = (user.storageUsed + fileSize) > user.storageQuota;
      
      if (wouldExceed) {
        const needed = (user.storageUsed + fileSize) - user.storageQuota;
        return {
          available: false,
          quota,
          message: `Storage quota exceeded. Need ${this.formatFileSize(needed)} more space.`
        };
      }

      return { available: true, quota };
    } catch (error) {
      throw new Error(`Failed to check storage availability: ${error}`);
    }
  }

  /**
   * Update user storage usage
   */
  static async updateStorageUsage(userId: string, sizeChange: number): Promise<void> {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        { $inc: { storageUsed: sizeChange } },
        { new: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      // Check if user has exceeded warning thresholds
      const percentage = user.storageQuota > 0 ? user.storageUsed / user.storageQuota : 0;
      
      if (percentage >= this.QUOTA_CRITICAL_THRESHOLD) {
        await this.sendQuotaNotification(userId, 'critical', percentage);
      } else if (percentage >= this.QUOTA_WARNING_THRESHOLD) {
        await this.sendQuotaNotification(userId, 'warning', percentage);
      }
    } catch (error) {
      throw new Error(`Failed to update storage usage: ${error}`);
    }
  }

  /**
   * Get storage analytics for a user
   */
  static async getStorageAnalytics(userId: string): Promise<StorageAnalytics> {
    try {
      const files = await File.find({ userId, isDeleted: false });
      
      // Calculate file type distribution
      const filesByType: { [mimeType: string]: number } = {};
      let totalSize = 0;

      files.forEach(file => {
        const category = this.getFileCategory(file.mimeType);
        filesByType[category] = (filesByType[category] || 0) + 1;
        totalSize += file.size;
      });

      // Get recent uploads (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentUploads = files
        .filter(file => new Date(file.uploadedAt) > thirtyDaysAgo)
        .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
        .slice(0, 10)
        .map(file => ({
          id: file._id,
          filename: file.filename,
          size: file.size,
          uploadedAt: file.uploadedAt
        }));

      // Get largest files
      const largestFiles = files
        .sort((a, b) => b.size - a.size)
        .slice(0, 10)
        .map(file => ({
          id: file._id,
          filename: file.filename,
          size: file.size,
          uploadedAt: file.uploadedAt
        }));

      // Calculate storage growth (simplified - in production, you'd store historical data)
      const storageGrowth = await this.calculateStorageGrowth(userId);

      return {
        totalFiles: files.length,
        totalSize,
        filesByType,
        recentUploads,
        largestFiles,
        storageGrowth
      };
    } catch (error) {
      throw new Error(`Failed to get storage analytics: ${error}`);
    }
  }

  /**
   * Generate cleanup suggestions
   */
  static async getCleanupSuggestions(userId: string): Promise<CleanupSuggestion[]> {
    try {
      const files = await File.find({ userId, isDeleted: false });
      const suggestions: CleanupSuggestion[] = [];

      // Large files suggestion
      const largeFiles = files
        .filter(file => file.size > 50 * 1024 * 1024) // Files larger than 50MB
        .sort((a, b) => b.size - a.size)
        .slice(0, 10);

      if (largeFiles.length > 0) {
        const potentialSavings = largeFiles.reduce((sum, file) => sum + file.size, 0);
        suggestions.push({
          type: 'large_files',
          title: 'Large Files',
          description: `You have ${largeFiles.length} files larger than 50MB`,
          files: largeFiles.map(file => ({
            id: file._id,
            filename: file.filename,
            size: file.size,
            uploadedAt: file.uploadedAt
          })),
          potentialSavings
        });
      }

      // Old files suggestion
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      
      const oldFiles = files
        .filter(file => new Date(file.uploadedAt) < sixMonthsAgo && !file.accessedAt)
        .sort((a, b) => b.size - a.size)
        .slice(0, 20);

      if (oldFiles.length > 0) {
        const potentialSavings = oldFiles.reduce((sum, file) => sum + file.size, 0);
        suggestions.push({
          type: 'old_files',
          title: 'Old Unused Files',
          description: `You have ${oldFiles.length} files older than 6 months that haven't been accessed`,
          files: oldFiles.map(file => ({
            id: file._id,
            filename: file.filename,
            size: file.size,
            uploadedAt: file.uploadedAt
          })),
          potentialSavings
        });
      }

      // Duplicate files suggestion (simplified - based on filename similarity)
      const duplicates = this.findPotentialDuplicates(files);
      if (duplicates.length > 0) {
        const potentialSavings = duplicates.reduce((sum, file) => sum + file.size, 0);
        suggestions.push({
          type: 'duplicates',
          title: 'Potential Duplicates',
          description: `You have ${duplicates.length} files that might be duplicates`,
          files: duplicates.map(file => ({
            id: file._id,
            filename: file.filename,
            size: file.size,
            uploadedAt: file.uploadedAt
          })),
          potentialSavings
        });
      }

      return suggestions.sort((a, b) => b.potentialSavings - a.potentialSavings);
    } catch (error) {
      throw new Error(`Failed to get cleanup suggestions: ${error}`);
    }
  }

  /**
   * Upgrade user storage plan
   */
  static async upgradeStoragePlan(
    userId: string, 
    newPlan: 'basic' | 'standard' | 'premium' | 'pro'
  ): Promise<{ success: boolean; newQuota: number }> {
    try {
      const quotaMap = {
        free: 5 * 1024 * 1024 * 1024,      // 5GB
        basic: 50 * 1024 * 1024 * 1024,    // 50GB
        standard: 200 * 1024 * 1024 * 1024, // 200GB
        premium: 500 * 1024 * 1024 * 1024,  // 500GB
        pro: 1024 * 1024 * 1024 * 1024      // 1TB
      };

      const newQuota = quotaMap[newPlan];
      
      const user = await User.findByIdAndUpdate(
        userId,
        { 
          subscriptionPlan: newPlan,
          storageQuota: newQuota
        },
        { new: true }
      );

      if (!user) {
        throw new Error('User not found');
      }

      // Send upgrade confirmation notification
      await NotificationService.sendNotification(userId, {
        type: 'storage_upgrade',
        title: 'Storage Plan Upgraded',
        message: `Your storage plan has been upgraded to ${newPlan}. You now have ${this.formatFileSize(newQuota)} of storage.`,
        timestamp: new Date()
      });

      return { success: true, newQuota };
    } catch (error) {
      throw new Error(`Failed to upgrade storage plan: ${error}`);
    }
  }

  /**
   * Clean up deleted files (background job)
   */
  static async cleanupDeletedFiles(): Promise<{ cleaned: number; spaceSaved: number }> {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Find files deleted more than 30 days ago
      const filesToCleanup = await File.find({
        isDeleted: true,
        deletedAt: { $lt: thirtyDaysAgo }
      });

      let spaceSaved = 0;
      let cleaned = 0;

      for (const file of filesToCleanup) {
        try {
          // Delete physical file
          const fs = require('fs/promises');
          await fs.unlink(file.storageLocation);
          
          // Remove from database
          await File.findByIdAndDelete(file._id);
          
          spaceSaved += file.size;
          cleaned++;
        } catch (error) {
          console.error(`Failed to cleanup file ${file._id}:`, error);
        }
      }

      return { cleaned, spaceSaved };
    } catch (error) {
      throw new Error(`Failed to cleanup deleted files: ${error}`);
    }
  }

  /**
   * Private helper methods
   */
  private static async sendQuotaNotification(
    userId: string, 
    level: 'warning' | 'critical', 
    percentage: number
  ): Promise<void> {
    const message = level === 'critical' 
      ? `Your storage is ${Math.round(percentage * 100)}% full. Please delete some files or upgrade your plan.`
      : `Your storage is ${Math.round(percentage * 100)}% full. Consider cleaning up files or upgrading your plan.`;

    await NotificationService.sendNotification(userId, {
      type: `storage_${level}`,
      title: level === 'critical' ? 'Storage Almost Full' : 'Storage Warning',
      message,
      timestamp: new Date()
    });
  }

  private static getFileCategory(mimeType: string): string {
    if (mimeType.startsWith('image/')) return 'Images';
    if (mimeType.startsWith('video/')) return 'Videos';
    if (mimeType.startsWith('audio/')) return 'Audio';
    if (mimeType.includes('pdf')) return 'PDFs';
    if (mimeType.includes('document') || mimeType.includes('word')) return 'Documents';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Spreadsheets';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'Presentations';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'Archives';
    return 'Other';
  }

  private static async calculateStorageGrowth(userId: string): Promise<{ date: string; size: number }[]> {
    // Simplified implementation - in production, you'd store historical data
    const files = await File.find({ userId, isDeleted: false }).sort({ uploadedAt: 1 });
    const growth: { date: string; size: number }[] = [];
    let cumulativeSize = 0;

    // Group by month
    const monthlyData = new Map<string, number>();
    
    files.forEach(file => {
      const monthKey = new Date(file.uploadedAt).toISOString().substring(0, 7); // YYYY-MM
      cumulativeSize += file.size;
      monthlyData.set(monthKey, cumulativeSize);
    });

    // Convert to array
    monthlyData.forEach((size, date) => {
      growth.push({ date, size });
    });

    return growth.slice(-12); // Last 12 months
  }

  private static findPotentialDuplicates(files: any[]): any[] {
    const duplicates: any[] = [];
    const nameMap = new Map<string, any[]>();

    // Group files by similar names
    files.forEach(file => {
      const baseName = file.filename.toLowerCase().replace(/\.[^/.]+$/, ''); // Remove extension
      const existing = nameMap.get(baseName) || [];
      existing.push(file);
      nameMap.set(baseName, existing);
    });

    // Find groups with multiple files
    nameMap.forEach(group => {
      if (group.length > 1) {
        // Add all but the first file as potential duplicates
        duplicates.push(...group.slice(1));
      }
    });

    return duplicates;
  }

  private static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}