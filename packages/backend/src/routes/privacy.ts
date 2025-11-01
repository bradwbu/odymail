/**
 * Privacy Routes - GDPR compliance and privacy management endpoints
 */

import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import privacyService, { ConsentType } from '../services/privacyService';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';
import { securityMonitoring } from '../middleware/securityMiddleware';

const router = Router();

// Apply security monitoring to all routes
router.use(securityMonitoring);

/**
 * Record user consent
 */
router.post('/consent',
  authenticateToken,
  [
    body('consentType').isIn(Object.values(ConsentType)),
    body('granted').isBoolean(),
    body('policyVersion').optional().isString(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { consentType, granted, policyVersion } = req.body;
      const userId = req.user!.id;

      const consent = await privacyService.recordConsent(
        userId,
        consentType as ConsentType,
        granted,
        req,
        policyVersion
      );

      res.json({
        success: true,
        data: consent
      });
    } catch (error) {
      console.error('Error recording consent:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to record consent'
      });
    }
  }
);

/**
 * Get user consent status
 */
router.get('/consent',
  authenticateToken,
  [
    query('type').optional().isIn(Object.values(ConsentType)),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.id;
      const consentType = req.query.type as ConsentType | undefined;

      const consents = privacyService.getUserConsent(userId, consentType);

      res.json({
        success: true,
        data: consents
      });
    } catch (error) {
      console.error('Error fetching consent:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch consent status'
      });
    }
  }
);

/**
 * Check if user has valid consent for a specific type
 */
router.get('/consent/:type/valid',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { type } = req.params;
      const userId = req.user!.id;

      if (!Object.values(ConsentType).includes(type as ConsentType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid consent type'
        });
      }

      const hasValidConsent = privacyService.hasValidConsent(userId, type as ConsentType);

      res.json({
        success: true,
        data: {
          consentType: type,
          hasValidConsent
        }
      });
    } catch (error) {
      console.error('Error checking consent:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check consent status'
      });
    }
  }
);

/**
 * Request data export
 */
router.post('/export',
  authenticateToken,
  [
    body('format').isIn(['json', 'csv', 'xml']),
    body('includeEmails').isBoolean(),
    body('includeFiles').isBoolean(),
    body('includeMetadata').isBoolean(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { format, includeEmails, includeFiles, includeMetadata } = req.body;
      const userId = req.user!.id;

      const exportRequest = await privacyService.requestDataExport(
        userId,
        format,
        { includeEmails, includeFiles, includeMetadata },
        req
      );

      res.json({
        success: true,
        data: exportRequest
      });
    } catch (error) {
      console.error('Error requesting data export:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to request data export'
      });
    }
  }
);

/**
 * Get export request status
 */
router.get('/export/:requestId',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { requestId } = req.params;
      const userId = req.user!.id;

      const exportRequest = privacyService.getExportRequest(requestId);

      if (!exportRequest || exportRequest.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: 'Export request not found'
        });
      }

      res.json({
        success: true,
        data: exportRequest
      });
    } catch (error) {
      console.error('Error fetching export request:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch export request'
      });
    }
  }
);

/**
 * Get user's export requests
 */
router.get('/exports',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const exportRequests = privacyService.getUserExportRequests(userId);

      res.json({
        success: true,
        data: exportRequests
      });
    } catch (error) {
      console.error('Error fetching export requests:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch export requests'
      });
    }
  }
);

/**
 * Download exported data
 */
router.get('/export/:requestId/download',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { requestId } = req.params;
      const userId = req.user!.id;

      const exportRequest = privacyService.getExportRequest(requestId);

      if (!exportRequest || exportRequest.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: 'Export request not found'
        });
      }

      if (exportRequest.status !== 'completed' || !exportRequest.downloadUrl) {
        return res.status(400).json({
          success: false,
          error: 'Export not ready for download'
        });
      }

      if (exportRequest.expiresAt && exportRequest.expiresAt < new Date()) {
        return res.status(410).json({
          success: false,
          error: 'Download link has expired'
        });
      }

      // In a real implementation, you would serve the actual file
      // For now, return a mock response
      const mockData = {
        userId: userId,
        exportedAt: exportRequest.completedAt,
        format: exportRequest.format,
        data: {
          profile: { email: req.user!.email },
          emails: exportRequest.includeEmails ? [] : undefined,
          files: exportRequest.includeFiles ? [] : undefined,
          metadata: exportRequest.includeMetadata ? {} : undefined
        }
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="data-export-${requestId}.json"`);
      res.json(mockData);
    } catch (error) {
      console.error('Error downloading export:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to download export'
      });
    }
  }
);

/**
 * Request data deletion
 */
router.post('/delete',
  authenticateToken,
  [
    body('deletionType').isIn(['partial', 'complete']),
    body('retainBackups').isBoolean(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { deletionType, retainBackups } = req.body;
      const userId = req.user!.id;

      const deletionRequest = await privacyService.requestDataDeletion(
        userId,
        deletionType,
        retainBackups,
        req
      );

      res.json({
        success: true,
        data: {
          requestId: deletionRequest.id,
          confirmationCode: deletionRequest.confirmationCode,
          message: 'Deletion request created. Please verify with the confirmation code to proceed.'
        }
      });
    } catch (error) {
      console.error('Error requesting data deletion:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to request data deletion'
      });
    }
  }
);

/**
 * Verify deletion request
 */
router.post('/delete/:requestId/verify',
  authenticateToken,
  [
    body('confirmationCode').isString().isLength({ min: 8, max: 20 }),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { requestId } = req.params;
      const { confirmationCode } = req.body;

      const verified = await privacyService.verifyDeletionRequest(
        requestId,
        confirmationCode,
        req
      );

      if (!verified) {
        return res.status(400).json({
          success: false,
          error: 'Invalid confirmation code or request not found'
        });
      }

      res.json({
        success: true,
        message: 'Deletion request verified and processing started'
      });
    } catch (error) {
      console.error('Error verifying deletion request:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify deletion request'
      });
    }
  }
);

/**
 * Get deletion request status
 */
router.get('/delete/:requestId',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { requestId } = req.params;
      const userId = req.user!.id;

      const deletionRequest = privacyService.getDeletionRequest(requestId);

      if (!deletionRequest || deletionRequest.userId !== userId) {
        return res.status(404).json({
          success: false,
          error: 'Deletion request not found'
        });
      }

      // Don't expose confirmation code in response
      const { confirmationCode, ...safeRequest } = deletionRequest;

      res.json({
        success: true,
        data: safeRequest
      });
    } catch (error) {
      console.error('Error fetching deletion request:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch deletion request'
      });
    }
  }
);

/**
 * Get user's deletion requests
 */
router.get('/deletions',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const deletionRequests = privacyService.getUserDeletionRequests(userId);

      // Don't expose confirmation codes
      const safeRequests = deletionRequests.map(({ confirmationCode, ...request }) => request);

      res.json({
        success: true,
        data: safeRequests
      });
    } catch (error) {
      console.error('Error fetching deletion requests:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch deletion requests'
      });
    }
  }
);

/**
 * Get user privacy settings
 */
router.get('/settings',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const settings = privacyService.getPrivacySettings(userId);

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error fetching privacy settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch privacy settings'
      });
    }
  }
);

/**
 * Update user privacy settings
 */
router.put('/settings',
  authenticateToken,
  [
    body('dataRetentionDays').optional().isInt({ min: 30, max: 3650 }),
    body('autoDeleteEmails').optional().isBoolean(),
    body('autoDeleteFiles').optional().isBoolean(),
    body('allowAnalytics').optional().isBoolean(),
    body('allowMarketing').optional().isBoolean(),
    body('emailNotifications').optional().isBoolean(),
    body('shareUsageData').optional().isBoolean(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const userId = req.user!.id;
      const settings = await privacyService.updatePrivacySettings(userId, req.body, req);

      res.json({
        success: true,
        data: settings
      });
    } catch (error) {
      console.error('Error updating privacy settings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update privacy settings'
      });
    }
  }
);

/**
 * Get data retention policies
 */
router.get('/retention-policies',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const policies = privacyService.getRetentionPolicies();

      res.json({
        success: true,
        data: policies
      });
    } catch (error) {
      console.error('Error fetching retention policies:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch retention policies'
      });
    }
  }
);

export default router;