/**
 * Security Routes - API endpoints for security monitoring and dashboard
 */

import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import securityService, { SecurityEventType, SecuritySeverity } from '../services/securityService';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { securityMonitoring } from '../middleware/securityMiddleware';

const router = Router();

// Apply security monitoring to all routes
router.use(securityMonitoring);

/**
 * Get security metrics
 */
router.get('/metrics',
  authenticateToken,
  requireAdmin,
  [
    query('timeRange').optional().isIn(['1h', '24h', '7d', '30d']),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const timeRange = req.query.timeRange as string;
      let dateRange: { start: Date; end: Date } | undefined;

      if (timeRange) {
        const now = new Date();
        const start = new Date();
        
        switch (timeRange) {
          case '1h':
            start.setHours(now.getHours() - 1);
            break;
          case '24h':
            start.setDate(now.getDate() - 1);
            break;
          case '7d':
            start.setDate(now.getDate() - 7);
            break;
          case '30d':
            start.setDate(now.getDate() - 30);
            break;
        }
        
        dateRange = { start, end: now };
      }

      const metrics = securityService.getSecurityMetrics(dateRange);
      
      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      console.error('Error fetching security metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch security metrics'
      });
    }
  }
);

/**
 * Get security events with filtering
 */
router.get('/events',
  authenticateToken,
  requireAdmin,
  [
    query('type').optional().isIn(Object.values(SecurityEventType)),
    query('severity').optional().isIn(Object.values(SecuritySeverity)),
    query('userId').optional().isString(),
    query('ipAddress').optional().isIP(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('limit').optional().isInt({ min: 1, max: 1000 }),
    query('offset').optional().isInt({ min: 0 }),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const filters: any = {};
      
      if (req.query.type) filters.type = req.query.type as SecurityEventType;
      if (req.query.severity) filters.severity = req.query.severity as SecuritySeverity;
      if (req.query.userId) filters.userId = req.query.userId as string;
      if (req.query.ipAddress) filters.ipAddress = req.query.ipAddress as string;
      if (req.query.limit) filters.limit = parseInt(req.query.limit as string);
      if (req.query.offset) filters.offset = parseInt(req.query.offset as string);
      
      if (req.query.startDate && req.query.endDate) {
        filters.timeRange = {
          start: new Date(req.query.startDate as string),
          end: new Date(req.query.endDate as string)
        };
      }

      const result = securityService.getSecurityEvents(filters);
      
      res.json({
        success: true,
        data: result.events,
        pagination: {
          total: result.total,
          limit: filters.limit || result.total,
          offset: filters.offset || 0
        }
      });
    } catch (error) {
      console.error('Error fetching security events:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch security events'
      });
    }
  }
);

/**
 * Get active security alerts
 */
router.get('/alerts',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const alerts = securityService.getActiveAlerts();
      
      res.json({
        success: true,
        data: alerts
      });
    } catch (error) {
      console.error('Error fetching security alerts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch security alerts'
      });
    }
  }
);

/**
 * Acknowledge security alert
 */
router.post('/alerts/:alertId/acknowledge',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { alertId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: 'User not authenticated'
        });
      }

      const acknowledged = securityService.acknowledgeAlert(alertId, userId);
      
      if (!acknowledged) {
        return res.status(404).json({
          success: false,
          error: 'Alert not found or already acknowledged'
        });
      }

      // Log the acknowledgment
      await securityService.logSecurityEvent(
        SecurityEventType.SYSTEM_ERROR, // Using closest available type
        SecuritySeverity.LOW,
        req,
        {
          action: 'alert_acknowledged',
          alertId
        },
        userId
      );

      res.json({
        success: true,
        message: 'Alert acknowledged successfully'
      });
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to acknowledge alert'
      });
    }
  }
);

/**
 * Get security event details
 */
router.get('/events/:eventId',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { eventId } = req.params;
      
      // Get all events and find the specific one
      const { events } = securityService.getSecurityEvents({ limit: 10000 });
      const event = events.find(e => e.id === eventId);
      
      if (!event) {
        return res.status(404).json({
          success: false,
          error: 'Security event not found'
        });
      }

      res.json({
        success: true,
        data: event
      });
    } catch (error) {
      console.error('Error fetching security event:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch security event'
      });
    }
  }
);

/**
 * Create manual security event (for testing or manual logging)
 */
router.post('/events',
  authenticateToken,
  requireAdmin,
  [
    body('type').isIn(Object.values(SecurityEventType)),
    body('severity').isIn(Object.values(SecuritySeverity)),
    body('details').optional().isObject(),
    body('userId').optional().isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { type, severity, details, userId } = req.body;

      const event = await securityService.logSecurityEvent(
        type as SecurityEventType,
        severity as SecuritySeverity,
        req,
        details || {},
        userId
      );

      res.status(201).json({
        success: true,
        data: event
      });
    } catch (error) {
      console.error('Error creating security event:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create security event'
      });
    }
  }
);

/**
 * Get IP reputation information
 */
router.get('/ip/:ipAddress',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { ipAddress } = req.params;
      
      // Validate IP address format
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(ipAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid IP address format'
        });
      }

      const isSuspicious = securityService.isSuspiciousIP(ipAddress);
      const failedAttempts = securityService.getFailedLoginAttempts(ipAddress);
      
      // Get recent events from this IP
      const { events } = securityService.getSecurityEvents({
        ipAddress,
        limit: 50
      });

      res.json({
        success: true,
        data: {
          ipAddress,
          isSuspicious,
          failedLoginAttempts: failedAttempts,
          recentEvents: events.length,
          lastActivity: events.length > 0 ? events[0].timestamp : null,
          events: events.slice(0, 10) // Return only last 10 events
        }
      });
    } catch (error) {
      console.error('Error fetching IP information:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch IP information'
      });
    }
  }
);

/**
 * Clear failed login attempts for IP (admin action)
 */
router.post('/ip/:ipAddress/clear-attempts',
  authenticateToken,
  requireAdmin,
  async (req: Request, res: Response) => {
    try {
      const { ipAddress } = req.params;
      const userId = req.user?.id;

      securityService.clearFailedLoginAttempts(ipAddress);

      // Log the admin action
      await securityService.logSecurityEvent(
        SecurityEventType.SYSTEM_ERROR, // Using closest available type
        SecuritySeverity.LOW,
        req,
        {
          action: 'clear_failed_attempts',
          targetIP: ipAddress
        },
        userId
      );

      res.json({
        success: true,
        message: 'Failed login attempts cleared successfully'
      });
    } catch (error) {
      console.error('Error clearing failed attempts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear failed attempts'
      });
    }
  }
);

export default router;