interface UsageStats {
  storageUsed: number;
  storageQuota: number;
  emailsSent: number;
  emailsReceived: number;
  filesUploaded: number;
  lastUpdated: Date;
}

interface UsageProjection {
  projectedStorageUsage: number;
  projectedEmailsSent: number;
  daysUntilQuotaFull: number | null;
  recommendedPlan?: string;
}

interface UsageTrend {
  date: string;
  storageUsed: number;
  emailsSent: number;
  emailsReceived: number;
  filesUploaded: number;
}

class UsageAnalyticsService {
  private baseUrl = '/api/usage';

  async getCurrentUsage(): Promise<UsageStats> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(`${this.baseUrl}/current`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch usage stats');
      }
      
      return result.data;
    } catch (error) {
      // Return mock data for now since the endpoint doesn't exist yet
      return {
        storageUsed: 2.5 * 1024 * 1024 * 1024, // 2.5GB
        storageQuota: 5 * 1024 * 1024 * 1024, // 5GB
        emailsSent: 145,
        emailsReceived: 289,
        filesUploaded: 23,
        lastUpdated: new Date()
      };
    }
  }

  async getUsageTrends(days: number = 30): Promise<UsageTrend[]> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(`${this.baseUrl}/trends?days=${days}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch usage trends');
      }
      
      return result.data;
    } catch (error) {
      // Return mock data for now
      const trends: UsageTrend[] = [];
      const now = new Date();
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        trends.push({
          date: date.toISOString().split('T')[0],
          storageUsed: Math.random() * 3 * 1024 * 1024 * 1024, // Random up to 3GB
          emailsSent: Math.floor(Math.random() * 20),
          emailsReceived: Math.floor(Math.random() * 30),
          filesUploaded: Math.floor(Math.random() * 5)
        });
      }
      
      return trends;
    }
  }

  async getUsageProjections(): Promise<UsageProjection> {
    const token = localStorage.getItem('authToken');
    if (!token) {
      throw new Error('Not authenticated');
    }

    try {
      const response = await fetch(`${this.baseUrl}/projections`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch usage projections');
      }
      
      return result.data;
    } catch (error) {
      // Return mock data for now
      const currentUsage = await this.getCurrentUsage();
      const storagePercentage = (currentUsage.storageUsed / currentUsage.storageQuota) * 100;
      
      return {
        projectedStorageUsage: currentUsage.storageUsed * 1.2, // 20% growth
        projectedEmailsSent: currentUsage.emailsSent * 1.1, // 10% growth
        daysUntilQuotaFull: storagePercentage > 80 ? Math.floor(Math.random() * 30) + 10 : null,
        recommendedPlan: storagePercentage > 75 ? 'basic' : undefined
      };
    }
  }

  formatStorageSize(bytes: number): string {
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = bytes / Math.pow(1024, i);
    
    return `${size.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  }

  calculateStoragePercentage(used: number, quota: number): number {
    return (used / quota) * 100;
  }

  getStorageStatus(percentage: number): 'low' | 'medium' | 'high' | 'critical' {
    if (percentage >= 95) return 'critical';
    if (percentage >= 85) return 'high';
    if (percentage >= 70) return 'medium';
    return 'low';
  }

  getRecommendedPlan(currentUsage: UsageStats): string | null {
    const percentage = this.calculateStoragePercentage(currentUsage.storageUsed, currentUsage.storageQuota);
    
    if (percentage >= 80) {
      // Recommend next tier based on current quota
      const currentQuotaGB = currentUsage.storageQuota / (1024 * 1024 * 1024);
      
      if (currentQuotaGB <= 5) return 'basic'; // 50GB
      if (currentQuotaGB <= 50) return 'standard'; // 200GB
      if (currentQuotaGB <= 200) return 'premium'; // 500GB
      if (currentQuotaGB <= 500) return 'pro'; // 1TB
    }
    
    return null;
  }

  async exportUsageData(format: 'json' | 'csv' = 'json'): Promise<Blob> {
    const [currentUsage, trends] = await Promise.all([
      this.getCurrentUsage(),
      this.getUsageTrends(30)
    ]);

    const data = {
      currentUsage,
      trends,
      exportDate: new Date().toISOString()
    };

    if (format === 'json') {
      return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    } else {
      // Convert to CSV format
      const csvHeader = 'Date,Storage Used (GB),Emails Sent,Emails Received,Files Uploaded\n';
      const csvRows = trends.map(trend => 
        `${trend.date},${(trend.storageUsed / (1024 * 1024 * 1024)).toFixed(2)},${trend.emailsSent},${trend.emailsReceived},${trend.filesUploaded}`
      ).join('\n');
      
      return new Blob([csvHeader + csvRows], { type: 'text/csv' });
    }
  }
}

export const usageAnalyticsService = new UsageAnalyticsService();
export type { UsageStats, UsageProjection, UsageTrend };