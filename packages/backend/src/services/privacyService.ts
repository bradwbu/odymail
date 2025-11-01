/**
 * Privacy Service - GDPR compliance and privacy management
 * Handles consent management, data export, deletion, and retention policies
 */

import { Request } from 'express';
import securityService, { SecurityEventType, SecuritySeverity } from './securityService';

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: ConsentType;
  granted: boolean;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  version: string; // Privacy policy version
  expiresAt?: Date;
}

export enum ConsentType {
  ESSENTIAL = 'essential',
  ANALYTICS = 'analytics',
  MARKETING = 'marketing',
  FUNCTIONAL = 'functional',
  DATA_PROCESSING = 'data_processing',
  EMAIL_COMMUNICATIONS = 'email_communications'
}

export interface DataExportRequest {
  id: string;
  userId: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedAt?: Date;
  downloadUrl?: string;
  expiresAt?: Date;
  format: 'json' | 'csv' | 'xml';
  includeEmails: boolean;
  includeFiles: boolean;
  includeMetadata: boolean;
}

export interface DataDeletionRequest {
  id: string;
  userId: string;
  requestedAt: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  completedAt?: Date;
  deletionType: 'partial' | 'complete';
  retainBackups: boolean;
  confirmationCode: string;
  verifiedAt?: Date;
}

export interface PrivacySettings {
  userId: string;
  dataRetentionDays: number;
  autoDeleteEmails: boolean;
  autoDeleteFiles: boolean;
  allowAnalytics: boolean;
  allowMarketing: boolean;
  emailNotifications: boolean;
  shareUsageData: boolean;
  updatedAt: Date;
}

export interface DataRetentionPolicy {
  dataType: string;
  retentionDays: number;
  autoDelete: boolean;
  backupRetentionDays: number;
  description: string;
}

class PrivacyService {
  private consentRecords: ConsentRecord[] = [];
  private exportRequests: DataExportRequest[] = [];
  private deletionRequests: DataDeletionRequest[] = [];
  private privacySettings: Map<string, PrivacySettings> = new Map();
  
  // Default data retention policies
  private retentionPolicies: DataRetentionPolicy[] = [
    {
      dataType: 'emails',
      retentionDays: 2555, // 7 years
      autoDelete: false,
      backupRetentionDays: 90,
      description: 'Email messages and attachments'
    },
    {
      dataType: 'files',
      retentionDays: 2555, // 7 years
      autoDelete: false,
      backupRetentionDays: 90,
      description: 'User uploaded files'
    },
    {
      dataType: 'user_data',
      retentionDays: 2555, // 7 years
      autoDelete: false,
      backupRetentionDays: 90,
      description: 'User profile and account information'
    },
    {
      dataType: 'security_logs',
      retentionDays: 365, // 1 year
      autoDelete: true,
      backupRetentionDays: 30,
      description: 'Security and audit logs'
    },
    {
      dataType: 'analytics',
      retentionDays: 730, // 2 years
      autoDelete: true,
      backupRetentionDays: 30,
      description: 'Usage analytics and metrics'
    }
  ];

  /**
   * Record user consent
   */
  async recordConsent(
    userId: string,
    consentType: ConsentType,
    granted: boolean,
    req: Request,
    policyVersion: string = '1.0'
  ): Promise<ConsentRecord> {
    const consent: ConsentRecord = {
      id: this.generateConsentId(),
      userId,
      consentType,
      granted,
      timestamp: new Date(),
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'Unknown',
      version: policyVersion,
      expiresAt: this.calculateConsentExpiry(consentType)
    };

    this.consentRecords.push(consent);

    // Log consent change
    await securityService.logSecurityEvent(
      SecurityEventType.CONSENT_CHANGE,
      SecuritySeverity.LOW,
      req,
      {
        consentType,
        granted,
        policyVersion
      },
      userId
    );

    return consent;
  }

  /**
   * Get user consent status
   */
  getUserConsent(userId: string, consentType?: ConsentType): ConsentRecord[] {
    let consents = this.consentRecords.filter(c => c.userId === userId);
    
    if (consentType) {
      consents = consents.filter(c => c.consentType === consentType);
    }

    // Return only the latest consent for each type
    const latestConsents = new Map<ConsentType, ConsentRecord>();
    consents.forEach(consent => {
      const existing = latestConsents.get(consent.consentType);
      if (!existing || consent.timestamp > existing.timestamp) {
        latestConsents.set(consent.consentType, consent);
      }
    });

    return Array.from(latestConsents.values());
  }

  /**
   * Check if user has valid consent for a specific type
   */
  hasValidConsent(userId: string, consentType: ConsentType): boolean {
    const consents = this.getUserConsent(userId, consentType);
    if (consents.length === 0) return false;

    const latestConsent = consents[0];
    
    // Check if consent is granted and not expired
    if (!latestConsent.granted) return false;
    if (latestConsent.expiresAt && latestConsent.expiresAt < new Date()) return false;

    return true;
  }

  /**
   * Request data export
   */
  async requestDataExport(
    userId: string,
    format: 'json' | 'csv' | 'xml',
    options: {
      includeEmails: boolean;
      includeFiles: boolean;
      includeMetadata: boolean;
    },
    req: Request
  ): Promise<DataExportRequest> {
    const exportRequest: DataExportRequest = {
      id: this.generateExportId(),
      userId,
      requestedAt: new Date(),
      status: 'pending',
      format,
      includeEmails: options.includeEmails,
      includeFiles: options.includeFiles,
      includeMetadata: options.includeMetadata,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };

    this.exportRequests.push(exportRequest);

    // Log GDPR request
    await securityService.logSecurityEvent(
      SecurityEventType.GDPR_REQUEST,
      SecuritySeverity.MEDIUM,
      req,
      {
        requestType: 'data_export',
        format,
        options
      },
      userId
    );

    // Start processing in background
    this.processDataExport(exportRequest);

    return exportRequest;
  }

  /**
   * Request data deletion
   */
  async requestDataDeletion(
    userId: string,
    deletionType: 'partial' | 'complete',
    retainBackups: boolean,
    req: Request
  ): Promise<DataDeletionRequest> {
    const deletionRequest: DataDeletionRequest = {
      id: this.generateDeletionId(),
      userId,
      requestedAt: new Date(),
      status: 'pending',
      deletionType,
      retainBackups,
      confirmationCode: this.generateConfirmationCode()
    };

    this.deletionRequests.push(deletionRequest);

    // Log GDPR request
    await securityService.logSecurityEvent(
      SecurityEventType.GDPR_REQUEST,
      SecuritySeverity.HIGH,
      req,
      {
        requestType: 'data_deletion',
        deletionType,
        retainBackups
      },
      userId
    );

    return deletionRequest;
  }

  /**
   * Verify deletion request with confirmation code
   */
  async verifyDeletionRequest(
    requestId: string,
    confirmationCode: string,
    req: Request
  ): Promise<boolean> {
    const request = this.deletionRequests.find(r => r.id === requestId);
    if (!request || request.confirmationCode !== confirmationCode) {
      return false;
    }

    request.verifiedAt = new Date();
    request.status = 'processing';

    // Log verification
    await securityService.logSecurityEvent(
      SecurityEventType.GDPR_REQUEST,
      SecuritySeverity.HIGH,
      req,
      {
        action: 'deletion_verified',
        requestId
      },
      request.userId
    );

    // Start deletion process
    this.processDataDeletion(request);

    return true;
  }

  /**
   * Get user privacy settings
   */
  getPrivacySettings(userId: string): PrivacySettings {
    return this.privacySettings.get(userId) || this.getDefaultPrivacySettings(userId);
  }

  /**
   * Update user privacy settings
   */
  async updatePrivacySettings(
    userId: string,
    settings: Partial<PrivacySettings>,
    req: Request
  ): Promise<PrivacySettings> {
    const currentSettings = this.getPrivacySettings(userId);
    const updatedSettings: PrivacySettings = {
      ...currentSettings,
      ...settings,
      userId,
      updatedAt: new Date()
    };

    this.privacySettings.set(userId, updatedSettings);

    // Log settings change
    await securityService.logSecurityEvent(
      SecurityEventType.CONFIGURATION_CHANGE,
      SecuritySeverity.LOW,
      req,
      {
        settingsChanged: Object.keys(settings),
        newSettings: settings
      },
      userId
    );

    return updatedSettings;
  }

  /**
   * Get data retention policies
   */
  getRetentionPolicies(): DataRetentionPolicy[] {
    return [...this.retentionPolicies];
  }

  /**
   * Update data retention policy
   */
  updateRetentionPolicy(dataType: string, policy: Partial<DataRetentionPolicy>): boolean {
    const index = this.retentionPolicies.findIndex(p => p.dataType === dataType);
    if (index === -1) return false;

    this.retentionPolicies[index] = {
      ...this.retentionPolicies[index],
      ...policy
    };

    return true;
  }

  /**
   * Get export request status
   */
  getExportRequest(requestId: string): DataExportRequest | undefined {
    return this.exportRequests.find(r => r.id === requestId);
  }

  /**
   * Get deletion request status
   */
  getDeletionRequest(requestId: string): DataDeletionRequest | undefined {
    return this.deletionRequests.find(r => r.id === requestId);
  }

  /**
   * Get user's export requests
   */
  getUserExportRequests(userId: string): DataExportRequest[] {
    return this.exportRequests
      .filter(r => r.userId === userId)
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  /**
   * Get user's deletion requests
   */
  getUserDeletionRequests(userId: string): DataDeletionRequest[] {
    return this.deletionRequests
      .filter(r => r.userId === userId)
      .sort((a, b) => b.requestedAt.getTime() - a.requestedAt.getTime());
  }

  /**
   * Clean up expired data based on retention policies
   */
  async enforceRetentionPolicies(): Promise<void> {
    for (const policy of this.retentionPolicies) {
      if (policy.autoDelete) {
        const cutoffDate = new Date(Date.now() - policy.retentionDays * 24 * 60 * 60 * 1000);
        
        // In a real implementation, you would delete data from the database
        console.log(`Enforcing retention policy for ${policy.dataType}, deleting data older than ${cutoffDate}`);
        
        // Log retention enforcement
        await securityService.logSecurityEvent(
          SecurityEventType.SYSTEM_ERROR, // Using closest available type
          SecuritySeverity.LOW,
          {} as Request, // Mock request for system actions
          {
            action: 'retention_policy_enforced',
            dataType: policy.dataType,
            cutoffDate: cutoffDate.toISOString()
          }
        );
      }
    }
  }

  // Private helper methods

  private async processDataExport(request: DataExportRequest): Promise<void> {
    try {
      request.status = 'processing';
      
      // Simulate export processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In a real implementation, you would:
      // 1. Gather all user data from various sources
      // 2. Format according to requested format
      // 3. Create secure download link
      // 4. Send notification to user
      
      request.status = 'completed';
      request.completedAt = new Date();
      request.downloadUrl = `/api/privacy/export/${request.id}/download`;
      
    } catch (error) {
      request.status = 'failed';
      console.error('Data export failed:', error);
    }
  }

  private async processDataDeletion(request: DataDeletionRequest): Promise<void> {
    try {
      // Simulate deletion processing
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // In a real implementation, you would:
      // 1. Delete user data from all systems
      // 2. Anonymize logs and analytics
      // 3. Remove backups if requested
      // 4. Send confirmation to user
      
      request.status = 'completed';
      request.completedAt = new Date();
      
    } catch (error) {
      request.status = 'failed';
      console.error('Data deletion failed:', error);
    }
  }

  private getDefaultPrivacySettings(userId: string): PrivacySettings {
    return {
      userId,
      dataRetentionDays: 2555, // 7 years default
      autoDeleteEmails: false,
      autoDeleteFiles: false,
      allowAnalytics: false, // Opt-in by default
      allowMarketing: false, // Opt-in by default
      emailNotifications: true,
      shareUsageData: false, // Opt-in by default
      updatedAt: new Date()
    };
  }

  private calculateConsentExpiry(consentType: ConsentType): Date | undefined {
    // Most consents expire after 1 year, but essential consents don't expire
    if (consentType === ConsentType.ESSENTIAL) {
      return undefined;
    }
    
    return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
  }

  private generateConsentId(): string {
    return `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateExportId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDeletionId(): string {
    return `deletion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateConfirmationCode(): string {
    return Math.random().toString(36).substr(2, 12).toUpperCase();
  }

  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           'unknown';
  }
}

export default new PrivacyService();