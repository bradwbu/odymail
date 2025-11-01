/**
 * Frontend service for storage quota management
 */

import { StorageQuota } from '../types/storage';

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

export interface StoragePlan {
  id: string;
  name: string;
  storage: number;
  price: number;
  features: string[];
}

export class StorageQuotaService {
  private static readonly API_BASE_URL = '/api/storage';

  /**
   * Get current storage quota
   */
  static async getStorageQuota(): Promise<StorageQuota> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/quota`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch storage quota');
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get storage quota: ${error}`);
    }
  }

  /**
   * Get storage analytics
   */
  static async getStorageAnalytics(): Promise<StorageAnalytics> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/analytics`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch storage analytics');
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to get storage analytics: ${error}`);
    }
  }

  /**
   * Get cleanup suggestions
   */
  static async getCleanupSuggestions(): Promise<CleanupSuggestion[]> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/cleanup-suggestions`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch cleanup suggestions');
      }

      const data = await response.json();
      return data.suggestions;
    } catch (error) {
      throw new Error(`Failed to get cleanup suggestions: ${error}`);
    }
  }

  /**
   * Upgrade storage plan
   */
  static async upgradeStoragePlan(plan: string): Promise<{ success: boolean; newQuota: number }> {
    try {
      const response = await fetch(`${this.API_BASE_URL}/upgrade-plan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ plan })
      });

      if (!response.ok) {
        throw new Error('Failed to upgrade storage plan');
      }

      return await response.json();
    } catch (error) {
      throw new Error(`Failed to upgrade storage plan: ${error}`);
    }
  }

  /**
   * Get available storage plans
   */
  static getStoragePlans(): StoragePlan[] {
    return [
      {
        id: 'free',
        name: 'Free',
        storage: 5 * 1024 * 1024 * 1024, // 5GB
        price: 0,
        features: [
          '5GB encrypted storage',
          'Basic email encryption',
          'Web access only'
        ]
      },
      {
        id: 'basic',
        name: 'Basic',
        storage: 50 * 1024 * 1024 * 1024, // 50GB
        price: 1.99,
        features: [
          '50GB encrypted storage',
          'Advanced email features',
          'File sharing',
          'Priority support'
        ]
      },
      {
        id: 'standard',
        name: 'Standard',
        storage: 200 * 1024 * 1024 * 1024, // 200GB
        price: 4.99,
        features: [
          '200GB encrypted storage',
          'Advanced file management',
          'Extended file sharing',
          'Version history',
          'Priority support'
        ]
      },
      {
        id: 'premium',
        name: 'Premium',
        storage: 500 * 1024 * 1024 * 1024, // 500GB
        price: 9.99,
        features: [
          '500GB encrypted storage',
          'Advanced collaboration',
          'Extended version history',
          'Advanced sharing controls',
          'Premium support'
        ]
      },
      {
        id: 'pro',
        name: 'Pro',
        storage: 1024 * 1024 * 1024 * 1024, // 1TB
        price: 14.99,
        features: [
          '1TB encrypted storage',
          'Team collaboration',
          'Advanced analytics',
          'API access',
          'Dedicated support'
        ]
      }
    ];
  }

  /**
   * Check if storage upgrade is needed
   */
  static shouldSuggestUpgrade(quota: StorageQuota): boolean {
    return quota.percentage > 80;
  }

  /**
   * Get recommended plan based on usage
   */
  static getRecommendedPlan(quota: StorageQuota): StoragePlan | null {
    const plans = this.getStoragePlans();
    const currentUsage = quota.used;
    
    // Find the smallest plan that provides at least 50% more space than current usage
    const recommendedSize = currentUsage * 1.5;
    
    return plans.find(plan => plan.storage >= recommendedSize) || plans[plans.length - 1];
  }

  /**
   * Format file size for display
   */
  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Calculate storage usage percentage
   */
  static calculateUsagePercentage(used: number, total: number): number {
    return total > 0 ? Math.round((used / total) * 100) : 0;
  }

  /**
   * Get storage status color based on usage
   */
  static getStorageStatusColor(percentage: number): string {
    if (percentage >= 95) return '#EF4444'; // Red
    if (percentage >= 80) return '#F59E0B'; // Yellow
    if (percentage >= 60) return '#3B82F6'; // Blue
    return '#10B981'; // Green
  }

  /**
   * Get storage status message
   */
  static getStorageStatusMessage(quota: StorageQuota): string {
    const percentage = quota.percentage;
    
    if (percentage >= 95) {
      return 'Storage almost full! Please delete files or upgrade your plan.';
    }
    if (percentage >= 80) {
      return 'Storage getting full. Consider cleaning up files or upgrading.';
    }
    if (percentage >= 60) {
      return 'Storage usage is moderate. You have plenty of space left.';
    }
    return 'Storage usage is low. You have lots of space available.';
  }

  /**
   * Estimate time until storage is full
   */
  static estimateTimeUntilFull(
    quota: StorageQuota, 
    recentUploads: any[]
  ): string | null {
    if (quota.percentage < 50 || recentUploads.length === 0) {
      return null;
    }

    // Calculate average upload rate over the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentSize = recentUploads
      .filter(upload => new Date(upload.uploadedAt) > thirtyDaysAgo)
      .reduce((sum, upload) => sum + upload.size, 0);

    if (recentSize === 0) {
      return null;
    }

    const dailyRate = recentSize / 30;
    const remainingSpace = quota.total - quota.used;
    const daysUntilFull = Math.floor(remainingSpace / dailyRate);

    if (daysUntilFull < 1) {
      return 'Less than a day';
    } else if (daysUntilFull < 7) {
      return `${daysUntilFull} days`;
    } else if (daysUntilFull < 30) {
      return `${Math.floor(daysUntilFull / 7)} weeks`;
    } else if (daysUntilFull < 365) {
      return `${Math.floor(daysUntilFull / 30)} months`;
    } else {
      return 'More than a year';
    }
  }
}