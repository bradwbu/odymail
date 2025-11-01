/**
 * Security Service - Security monitoring, logging, and intrusion detection
 * Provides comprehensive security event logging and monitoring capabilities
 */

import { Request } from 'express';
import { createHash } from 'crypto';

export interface SecurityEvent {
  id: string;
  timestamp: Date;
  type: SecurityEventType;
  severity: SecuritySeverity;
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  details: Record<string, any>;
  location?: {
    country?: string;
    city?: string;
    coordinates?: [number, number];
  };
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
}

export enum SecurityEventType {
  // Authentication Events
  LOGIN_SUCCESS = 'login_success',
  LOGIN_FAILURE = 'login_failure',
  LOGIN_BRUTE_FORCE = 'login_brute_force',
  PASSWORD_CHANGE = 'password_change',
  ACCOUNT_LOCKOUT = 'account_lockout',
  
  // Authorization Events
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
  
  // Data Access Events
  SENSITIVE_DATA_ACCESS = 'sensitive_data_access',
  DATA_EXPORT = 'data_export',
  DATA_DELETION = 'data_deletion',
  
  // Encryption Events
  KEY_GENERATION = 'key_generation',
  ENCRYPTION_FAILURE = 'encryption_failure',
  DECRYPTION_FAILURE = 'decryption_failure',
  
  // Network Events
  SUSPICIOUS_REQUEST = 'suspicious_request',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  DDoS_ATTEMPT = 'ddos_attempt',
  
  // System Events
  SYSTEM_ERROR = 'system_error',
  CONFIGURATION_CHANGE = 'configuration_change',
  
  // Privacy Events
  GDPR_REQUEST = 'gdpr_request',
  CONSENT_CHANGE = 'consent_change'
}

export enum SecuritySeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface SecurityAlert {
  id: string;
  timestamp: Date;
  type: string;
  severity: SecuritySeverity;
  message: string;
  events: SecurityEvent[];
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface SecurityMetrics {
  totalEvents: number;
  eventsByType: Record<SecurityEventType, number>;
  eventsBySeverity: Record<SecuritySeverity, number>;
  activeAlerts: number;
  resolvedAlerts: number;
  topThreats: Array<{
    type: SecurityEventType;
    count: number;
    lastOccurrence: Date;
  }>;
  suspiciousIPs: Array<{
    ip: string;
    eventCount: number;
    lastActivity: Date;
  }>;
}

class SecurityService {
  private events: SecurityEvent[] = [];
  private alerts: SecurityAlert[] = [];
  private suspiciousIPs: Map<string, { count: number; lastActivity: Date }> = new Map();
  private failedLogins: Map<string, { count: number; lastAttempt: Date }> = new Map();

  /**
   * Log a security event
   */
  async logSecurityEvent(
    type: SecurityEventType,
    severity: SecuritySeverity,
    req: Request,
    details: Record<string, any> = {},
    userId?: string
  ): Promise<SecurityEvent> {
    const event: SecurityEvent = {
      id: this.generateEventId(),
      timestamp: new Date(),
      type,
      severity,
      userId,
      sessionId: req.sessionID,
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent') || 'Unknown',
      details,
      location: await this.getLocationFromIP(this.getClientIP(req)),
      resolved: false
    };

    this.events.push(event);
    
    // Update suspicious IP tracking
    this.updateSuspiciousIPTracking(event.ipAddress);
    
    // Check for patterns that might trigger alerts
    await this.analyzeEventForAlerts(event);
    
    // Log to console and external systems
    this.logToConsole(event);
    await this.logToExternalSystems(event);
    
    return event;
  }

  /**
   * Log authentication attempt
   */
  async logAuthenticationAttempt(
    success: boolean,
    req: Request,
    userId?: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    const ip = this.getClientIP(req);
    
    if (success) {
      // Clear failed login tracking on success
      this.failedLogins.delete(ip);
      
      await this.logSecurityEvent(
        SecurityEventType.LOGIN_SUCCESS,
        SecuritySeverity.LOW,
        req,
        { ...details, method: 'password' },
        userId
      );
    } else {
      // Track failed login attempts
      const failedAttempts = this.failedLogins.get(ip) || { count: 0, lastAttempt: new Date() };
      failedAttempts.count++;
      failedAttempts.lastAttempt = new Date();
      this.failedLogins.set(ip, failedAttempts);
      
      const severity = failedAttempts.count >= 5 ? SecuritySeverity.HIGH : SecuritySeverity.MEDIUM;
      const eventType = failedAttempts.count >= 5 
        ? SecurityEventType.LOGIN_BRUTE_FORCE 
        : SecurityEventType.LOGIN_FAILURE;
      
      await this.logSecurityEvent(
        eventType,
        severity,
        req,
        { ...details, failedAttempts: failedAttempts.count },
        userId
      );
    }
  }

  /**
   * Log data access event
   */
  async logDataAccess(
    dataType: string,
    action: 'read' | 'write' | 'delete' | 'export',
    req: Request,
    userId: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    const severity = action === 'delete' || action === 'export' 
      ? SecuritySeverity.HIGH 
      : SecuritySeverity.LOW;
    
    await this.logSecurityEvent(
      SecurityEventType.SENSITIVE_DATA_ACCESS,
      severity,
      req,
      { dataType, action, ...details },
      userId
    );
  }

  /**
   * Log encryption/decryption events
   */
  async logCryptoEvent(
    operation: 'encrypt' | 'decrypt' | 'key_generation',
    success: boolean,
    req: Request,
    userId?: string,
    details: Record<string, any> = {}
  ): Promise<void> {
    let eventType: SecurityEventType;
    let severity: SecuritySeverity;
    
    if (operation === 'key_generation') {
      eventType = SecurityEventType.KEY_GENERATION;
      severity = SecuritySeverity.MEDIUM;
    } else if (success) {
      eventType = operation === 'encrypt' 
        ? SecurityEventType.SENSITIVE_DATA_ACCESS 
        : SecurityEventType.SENSITIVE_DATA_ACCESS;
      severity = SecuritySeverity.LOW;
    } else {
      eventType = operation === 'encrypt' 
        ? SecurityEventType.ENCRYPTION_FAILURE 
        : SecurityEventType.DECRYPTION_FAILURE;
      severity = SecuritySeverity.HIGH;
    }
    
    await this.logSecurityEvent(
      eventType,
      severity,
      req,
      { operation, success, ...details },
      userId
    );
  }

  /**
   * Create security alert
   */
  async createAlert(
    type: string,
    severity: SecuritySeverity,
    message: string,
    events: SecurityEvent[]
  ): Promise<SecurityAlert> {
    const alert: SecurityAlert = {
      id: this.generateAlertId(),
      timestamp: new Date(),
      type,
      severity,
      message,
      events,
      acknowledged: false
    };
    
    this.alerts.push(alert);
    
    // Send notifications for high/critical alerts
    if (severity === SecuritySeverity.HIGH || severity === SecuritySeverity.CRITICAL) {
      await this.sendAlertNotification(alert);
    }
    
    return alert;
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(timeRange?: { start: Date; end: Date }): SecurityMetrics {
    let filteredEvents = this.events;
    
    if (timeRange) {
      filteredEvents = this.events.filter(
        event => event.timestamp >= timeRange.start && event.timestamp <= timeRange.end
      );
    }
    
    const eventsByType = {} as Record<SecurityEventType, number>;
    const eventsBySeverity = {} as Record<SecuritySeverity, number>;
    
    // Initialize counters
    Object.values(SecurityEventType).forEach(type => {
      eventsByType[type] = 0;
    });
    Object.values(SecuritySeverity).forEach(severity => {
      eventsBySeverity[severity] = 0;
    });
    
    // Count events
    filteredEvents.forEach(event => {
      eventsByType[event.type]++;
      eventsBySeverity[event.severity]++;
    });
    
    // Get top threats
    const threatCounts = new Map<SecurityEventType, { count: number; lastOccurrence: Date }>();
    filteredEvents.forEach(event => {
      const existing = threatCounts.get(event.type) || { count: 0, lastOccurrence: event.timestamp };
      existing.count++;
      if (event.timestamp > existing.lastOccurrence) {
        existing.lastOccurrence = event.timestamp;
      }
      threatCounts.set(event.type, existing);
    });
    
    const topThreats = Array.from(threatCounts.entries())
      .map(([type, data]) => ({ type, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    // Get suspicious IPs
    const suspiciousIPs = Array.from(this.suspiciousIPs.entries())
      .map(([ip, data]) => ({ ip, eventCount: data.count, lastActivity: data.lastActivity }))
      .sort((a, b) => b.eventCount - a.eventCount)
      .slice(0, 10);
    
    return {
      totalEvents: filteredEvents.length,
      eventsByType,
      eventsBySeverity,
      activeAlerts: this.alerts.filter(alert => !alert.acknowledged).length,
      resolvedAlerts: this.alerts.filter(alert => alert.acknowledged).length,
      topThreats,
      suspiciousIPs
    };
  }

  /**
   * Get security events with filtering
   */
  getSecurityEvents(filters: {
    type?: SecurityEventType;
    severity?: SecuritySeverity;
    userId?: string;
    ipAddress?: string;
    timeRange?: { start: Date; end: Date };
    limit?: number;
    offset?: number;
  } = {}): { events: SecurityEvent[]; total: number } {
    let filteredEvents = this.events;
    
    // Apply filters
    if (filters.type) {
      filteredEvents = filteredEvents.filter(event => event.type === filters.type);
    }
    if (filters.severity) {
      filteredEvents = filteredEvents.filter(event => event.severity === filters.severity);
    }
    if (filters.userId) {
      filteredEvents = filteredEvents.filter(event => event.userId === filters.userId);
    }
    if (filters.ipAddress) {
      filteredEvents = filteredEvents.filter(event => event.ipAddress === filters.ipAddress);
    }
    if (filters.timeRange) {
      filteredEvents = filteredEvents.filter(
        event => event.timestamp >= filters.timeRange!.start && 
                 event.timestamp <= filters.timeRange!.end
      );
    }
    
    // Sort by timestamp (newest first)
    filteredEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    const total = filteredEvents.length;
    
    // Apply pagination
    if (filters.offset) {
      filteredEvents = filteredEvents.slice(filters.offset);
    }
    if (filters.limit) {
      filteredEvents = filteredEvents.slice(0, filters.limit);
    }
    
    return { events: filteredEvents, total };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): SecurityAlert[] {
    return this.alerts
      .filter(alert => !alert.acknowledged)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      alert.acknowledgedAt = new Date();
      return true;
    }
    return false;
  }

  /**
   * Check if IP is suspicious
   */
  isSuspiciousIP(ip: string): boolean {
    const data = this.suspiciousIPs.get(ip);
    if (!data) return false;
    
    // Consider IP suspicious if more than 10 events in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return data.count > 10 && data.lastActivity > oneHourAgo;
  }

  /**
   * Get failed login attempts for IP
   */
  getFailedLoginAttempts(ip: string): number {
    return this.failedLogins.get(ip)?.count || 0;
  }

  /**
   * Clear failed login attempts for IP
   */
  clearFailedLoginAttempts(ip: string): void {
    this.failedLogins.delete(ip);
  }

  // Private helper methods

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateAlertId(): string {
    return `alt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           'unknown';
  }

  private async getLocationFromIP(ip: string): Promise<{ country?: string; city?: string; coordinates?: [number, number] } | undefined> {
    // In a real implementation, you would use a GeoIP service
    // For now, return undefined
    return undefined;
  }

  private updateSuspiciousIPTracking(ip: string): void {
    const existing = this.suspiciousIPs.get(ip) || { count: 0, lastActivity: new Date() };
    existing.count++;
    existing.lastActivity = new Date();
    this.suspiciousIPs.set(ip, existing);
  }

  private async analyzeEventForAlerts(event: SecurityEvent): Promise<void> {
    // Check for brute force attacks
    if (event.type === SecurityEventType.LOGIN_BRUTE_FORCE) {
      await this.createAlert(
        'brute_force_attack',
        SecuritySeverity.HIGH,
        `Brute force attack detected from IP ${event.ipAddress}`,
        [event]
      );
    }
    
    // Check for multiple failed logins from same IP
    const recentFailures = this.events.filter(e => 
      e.type === SecurityEventType.LOGIN_FAILURE &&
      e.ipAddress === event.ipAddress &&
      e.timestamp > new Date(Date.now() - 15 * 60 * 1000) // Last 15 minutes
    );
    
    if (recentFailures.length >= 3) {
      await this.createAlert(
        'multiple_failed_logins',
        SecuritySeverity.MEDIUM,
        `Multiple failed login attempts from IP ${event.ipAddress}`,
        recentFailures
      );
    }
    
    // Check for encryption failures
    if (event.type === SecurityEventType.ENCRYPTION_FAILURE || 
        event.type === SecurityEventType.DECRYPTION_FAILURE) {
      await this.createAlert(
        'crypto_failure',
        SecuritySeverity.HIGH,
        `Cryptographic operation failure detected`,
        [event]
      );
    }
  }

  private logToConsole(event: SecurityEvent): void {
    const logLevel = this.getSeverityLogLevel(event.severity);
    console[logLevel](`[SECURITY] ${event.type}: ${JSON.stringify({
      id: event.id,
      timestamp: event.timestamp,
      userId: event.userId,
      ipAddress: event.ipAddress,
      details: event.details
    })}`);
  }

  private getSeverityLogLevel(severity: SecuritySeverity): 'log' | 'warn' | 'error' {
    switch (severity) {
      case SecuritySeverity.LOW:
        return 'log';
      case SecuritySeverity.MEDIUM:
        return 'warn';
      case SecuritySeverity.HIGH:
      case SecuritySeverity.CRITICAL:
        return 'error';
      default:
        return 'log';
    }
  }

  private async logToExternalSystems(event: SecurityEvent): Promise<void> {
    // In a real implementation, you would send to external logging systems
    // like Elasticsearch, Splunk, or cloud logging services
    
    // For now, we'll just store in memory
    // In production, you might want to:
    // - Send to SIEM systems
    // - Store in secure audit database
    // - Send to monitoring services like DataDog, New Relic
  }

  private async sendAlertNotification(alert: SecurityAlert): Promise<void> {
    // In a real implementation, you would send notifications via:
    // - Email to security team
    // - Slack/Teams notifications
    // - SMS for critical alerts
    // - Push notifications to admin dashboard
    
    console.error(`[SECURITY ALERT] ${alert.type}: ${alert.message}`);
  }
}

export default new SecurityService();