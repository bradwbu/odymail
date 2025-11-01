/**
 * Metrics Service - Application performance monitoring and metrics collection
 * Provides Prometheus-compatible metrics for monitoring application health
 */

import { Request, Response } from 'express';
import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Enable default metrics collection (CPU, memory, etc.)
collectDefaultMetrics({ prefix: 'encrypted_email_' });

// HTTP request metrics
const httpRequestsTotal = new Counter({
  name: 'encrypted_email_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const httpRequestDuration = new Histogram({
  name: 'encrypted_email_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

// Email metrics
const emailsSentTotal = new Counter({
  name: 'encrypted_email_emails_sent_total',
  help: 'Total number of emails sent',
  labelNames: ['status']
});

const emailsReceivedTotal = new Counter({
  name: 'encrypted_email_emails_received_total',
  help: 'Total number of emails received'
});

const emailQueueSize = new Gauge({
  name: 'encrypted_email_queue_size',
  help: 'Current size of email queue'
});

const emailDeliveryFailures = new Counter({
  name: 'encrypted_email_delivery_failures_total',
  help: 'Total number of email delivery failures',
  labelNames: ['reason']
});

// Authentication metrics
const authenticationAttempts = new Counter({
  name: 'encrypted_email_authentication_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['status', 'method']
});

const authenticationFailures = new Counter({
  name: 'encrypted_email_authentication_failures_total',
  help: 'Total number of authentication failures',
  labelNames: ['reason']
});

// Storage metrics
const storageUsedBytes = new Gauge({
  name: 'encrypted_email_storage_used_bytes',
  help: 'Storage used in bytes',
  labelNames: ['user_id', 'tier']
});

const storageUsageRatio = new Gauge({
  name: 'encrypted_email_storage_usage_ratio',
  help: 'Storage usage ratio (used/limit)',
  labelNames: ['user_id', 'tier']
});

const fileUploadsTotal = new Counter({
  name: 'encrypted_email_file_uploads_total',
  help: 'Total number of file uploads',
  labelNames: ['status', 'file_type']
});

// Security metrics
const securityEventsTotal = new Counter({
  name: 'encrypted_email_security_events_total',
  help: 'Total number of security events',
  labelNames: ['type', 'severity']
});

const rateLimitHits = new Counter({
  name: 'encrypted_email_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['endpoint', 'ip']
});

// Database metrics
const databaseConnectionsActive = new Gauge({
  name: 'encrypted_email_database_connections_active',
  help: 'Number of active database connections'
});

const databaseQueryDuration = new Histogram({
  name: 'encrypted_email_database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'collection'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 5]
});

// User metrics
const activeUsersTotal = new Gauge({
  name: 'encrypted_email_active_users_total',
  help: 'Total number of active users'
});

const userRegistrations = new Counter({
  name: 'encrypted_email_user_registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['tier']
});

// Encryption metrics
const encryptionOperations = new Counter({
  name: 'encrypted_email_encryption_operations_total',
  help: 'Total number of encryption operations',
  labelNames: ['operation', 'status']
});

const encryptionDuration = new Histogram({
  name: 'encrypted_email_encryption_duration_seconds',
  help: 'Duration of encryption operations in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1]
});

class MetricsService {
  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    const labels = {
      method: method.toUpperCase(),
      route: this.normalizeRoute(route),
      status_code: statusCode.toString()
    };

    httpRequestsTotal.inc(labels);
    httpRequestDuration.observe(labels, duration / 1000); // Convert to seconds
  }

  /**
   * Record email sent
   */
  recordEmailSent(status: 'success' | 'failed'): void {
    emailsSentTotal.inc({ status });
  }

  /**
   * Record email received
   */
  recordEmailReceived(): void {
    emailsReceivedTotal.inc();
  }

  /**
   * Update email queue size
   */
  updateEmailQueueSize(size: number): void {
    emailQueueSize.set(size);
  }

  /**
   * Record email delivery failure
   */
  recordEmailDeliveryFailure(reason: string): void {
    emailDeliveryFailures.inc({ reason });
  }

  /**
   * Record authentication attempt
   */
  recordAuthenticationAttempt(status: 'success' | 'failed', method: string = 'password'): void {
    authenticationAttempts.inc({ status, method });
    
    if (status === 'failed') {
      authenticationFailures.inc({ reason: 'invalid_credentials' });
    }
  }

  /**
   * Record authentication failure with reason
   */
  recordAuthenticationFailure(reason: string): void {
    authenticationFailures.inc({ reason });
  }

  /**
   * Update storage metrics
   */
  updateStorageMetrics(userId: string, tier: string, usedBytes: number, limitBytes: number): void {
    storageUsedBytes.set({ user_id: userId, tier }, usedBytes);
    storageUsageRatio.set({ user_id: userId, tier }, usedBytes / limitBytes);
  }

  /**
   * Record file upload
   */
  recordFileUpload(status: 'success' | 'failed', fileType: string): void {
    fileUploadsTotal.inc({ status, file_type: fileType });
  }

  /**
   * Record security event
   */
  recordSecurityEvent(type: string, severity: string): void {
    securityEventsTotal.inc({ type, severity });
  }

  /**
   * Record rate limit hit
   */
  recordRateLimitHit(endpoint: string, ip: string): void {
    rateLimitHits.inc({ endpoint, ip });
  }

  /**
   * Update database connection count
   */
  updateDatabaseConnections(count: number): void {
    databaseConnectionsActive.set(count);
  }

  /**
   * Record database query duration
   */
  recordDatabaseQuery(operation: string, collection: string, duration: number): void {
    databaseQueryDuration.observe({ operation, collection }, duration / 1000);
  }

  /**
   * Update active users count
   */
  updateActiveUsers(count: number): void {
    activeUsersTotal.set(count);
  }

  /**
   * Record user registration
   */
  recordUserRegistration(tier: string = 'free'): void {
    userRegistrations.inc({ tier });
  }

  /**
   * Record encryption operation
   */
  recordEncryptionOperation(operation: 'encrypt' | 'decrypt', status: 'success' | 'failed', duration?: number): void {
    encryptionOperations.inc({ operation, status });
    
    if (duration !== undefined) {
      encryptionDuration.observe({ operation }, duration / 1000);
    }
  }

  /**
   * Get metrics for Prometheus scraping
   */
  async getMetrics(): Promise<string> {
    return register.metrics();
  }

  /**
   * Clear all metrics (useful for testing)
   */
  clearMetrics(): void {
    register.clear();
  }

  /**
   * Create middleware for automatic HTTP metrics collection
   */
  createHttpMetricsMiddleware() {
    return (req: Request, res: Response, next: Function) => {
      const startTime = Date.now();
      
      // Override res.end to capture metrics
      const originalEnd = res.end;
      res.end = function(this: Response, ...args: any[]) {
        const duration = Date.now() - startTime;
        
        // Record metrics
        metricsService.recordHttpRequest(
          req.method,
          req.route?.path || req.path,
          res.statusCode,
          duration
        );
        
        // Call original end method
        return originalEnd.apply(this, args);
      };
      
      next();
    };
  }

  /**
   * Start collecting periodic metrics
   */
  startPeriodicCollection(): void {
    // Collect metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);
  }

  /**
   * Collect system-level metrics
   */
  private collectSystemMetrics(): void {
    // Update active users (this would typically query the database)
    // For now, we'll use a placeholder
    const activeUsers = this.getActiveUsersCount();
    this.updateActiveUsers(activeUsers);
    
    // Update database connections
    const dbConnections = this.getDatabaseConnectionCount();
    this.updateDatabaseConnections(dbConnections);
  }

  /**
   * Get active users count (placeholder implementation)
   */
  private getActiveUsersCount(): number {
    // In a real implementation, this would query the database
    // for users active in the last 24 hours
    return Math.floor(Math.random() * 1000) + 100;
  }

  /**
   * Get database connection count (placeholder implementation)
   */
  private getDatabaseConnectionCount(): number {
    // In a real implementation, this would check the actual connection pool
    return Math.floor(Math.random() * 10) + 5;
  }

  /**
   * Normalize route for consistent labeling
   */
  private normalizeRoute(route: string): string {
    // Replace dynamic segments with placeholders
    return route
      .replace(/\/\d+/g, '/:id')
      .replace(/\/[a-f0-9-]{36}/g, '/:uuid')
      .replace(/\/[a-zA-Z0-9_-]+@[a-zA-Z0-9.-]+/g, '/:email');
  }
}

// Export singleton instance
const metricsService = new MetricsService();
export default metricsService;

// Export individual metrics for direct access if needed
export {
  httpRequestsTotal,
  httpRequestDuration,
  emailsSentTotal,
  emailsReceivedTotal,
  emailQueueSize,
  authenticationAttempts,
  storageUsedBytes,
  securityEventsTotal,
  activeUsersTotal
};