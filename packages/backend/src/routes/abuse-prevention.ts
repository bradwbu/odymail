/**
 * Abuse Prevention Routes - Management endpoints for rate limiting and abuse prevention
 */

import { Router, Request, Response } from 'express';
import { body, query, validationResult } from 'express-validator';
import abusePreventionService from '../services/abusePreventionService';
import { authenticateToken, requireAdmin, AuthenticatedRequest } from '../middleware/auth';
import { securityMonitoring } from '../middleware/securityMiddleware';

const router = Router();

// Apply security monitoring to all routes
router.use(securityMonitoring);

/**
 * Verify CAPTCHA
 */
router.post('/captcha/verify',
  [
    body('captchaId').isString(),
    body('solution').isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { captchaId, solution } = req.body;
      const verified = await abusePreventionService.verifyCaptcha(captchaId, solution, req);

      res.json({
        success: verified,
        message: verified ? 'CAPTCHA verified successfully' : 'Invalid CAPTCHA solution'
      });
    } catch (error) {
      console.error('Error verifying CAPTCHA:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to verify CAPTCHA'
      });
    }
  }
);

/**
 * Generate new CAPTCHA challenge
 */
router.post('/captcha/generate',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const captcha = abusePreventionService.generateCaptchaChallenge(req, req.user?.id);

      res.json({
        success: true,
        data: {
          id: captcha.id,
          challenge: captcha.challenge,
          expiresAt: captcha.expiresAt
        }
      });
    } catch (error) {
      console.error('Error generating CAPTCHA:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate CAPTCHA'
      });
    }
  }
);

/**
 * Unlock account with code
 */
router.post('/account/unlock',
  [
    body('userId').isString(),
    body('unlockCode').isString(),
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, unlockCode } = req.body;
      const unlocked = await abusePreventionService.unlockAccount(userId, unlockCode, req);

      if (!unlocked) {
        return res.status(400).json({
          success: false,
          error: 'Invalid unlock code or account not found'
        });
      }

      res.json({
        success: true,
        message: 'Account unlocked successfully'
      });
    } catch (error) {
      console.error('Error unlocking account:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to unlock account'
      });
    }
  }
);

/**
 * Check account lockout status
 */
router.get('/account/:userId/lockout',
  authenticateToken,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      
      // Users can only check their own lockout status, admins can check any
      if (req.user?.id !== userId && req.user?.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const lockoutResult = abusePreventionService.isAccountLocked(userId);

      res.json({
        success: true,
        data: {
          locked: lockoutResult.locked,
          lockout: lockoutResult.lockout ? {
            id: lockoutResult.lockout.id,
            reason: lockoutResult.lockout.reason,
            lockedAt: lockoutResult.lockout.lockedAt,
            expiresAt: lockoutResult.lockout.expiresAt,
            attempts: lockoutResult.lockout.attempts
          } : null
        }
      });
    } catch (error) {
      console.error('Error checking lockout status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check lockout status'
      });
    }
  }
);

/**
 * Detect spam in content (for testing)
 */
router.post('/spam/detect',
  authenticateToken,
  [
    body('content').isString(),
    body('subject').optional().isString(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { content, subject } = req.body;
      const spamResult = abusePreventionService.detectSpam(content, subject);

      res.json({
        success: true,
        data: spamResult
      });
    } catch (error) {
      console.error('Error detecting spam:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to detect spam'
      });
    }
  }
);

// Admin-only endpoints

/**
 * Get rate limit rules
 */
router.get('/admin/rate-limits',
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const rules = abusePreventionService.getRateLimitRules();

      res.json({
        success: true,
        data: rules
      });
    } catch (error) {
      console.error('Error fetching rate limit rules:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch rate limit rules'
      });
    }
  }
);

/**
 * Update rate limit rule
 */
router.put('/admin/rate-limits/:ruleId',
  authenticateToken,
  requireAdmin,
  [
    body('windowMs').optional().isInt({ min: 1000 }),
    body('maxRequests').optional().isInt({ min: 1 }),
    body('enabled').optional().isBoolean(),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { ruleId } = req.params;
      const updated = abusePreventionService.updateRateLimitRule(ruleId, req.body);

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: 'Rate limit rule not found'
        });
      }

      res.json({
        success: true,
        message: 'Rate limit rule updated successfully'
      });
    } catch (error) {
      console.error('Error updating rate limit rule:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update rate limit rule'
      });
    }
  }
);

/**
 * Get abuse patterns
 */
router.get('/admin/abuse-patterns',
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const patterns = abusePreventionService.getAbusePatterns();

      res.json({
        success: true,
        data: patterns
      });
    } catch (error) {
      console.error('Error fetching abuse patterns:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch abuse patterns'
      });
    }
  }
);

/**
 * Update abuse pattern
 */
router.put('/admin/abuse-patterns/:patternId',
  authenticateToken,
  requireAdmin,
  [
    body('enabled').optional().isBoolean(),
    body('severity').optional().isIn(['low', 'medium', 'high', 'critical']),
    body('action').optional().isIn(['log', 'warn', 'block', 'captcha']),
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { patternId } = req.params;
      const updated = abusePreventionService.updateAbusePattern(patternId, req.body);

      if (!updated) {
        return res.status(404).json({
          success: false,
          error: 'Abuse pattern not found'
        });
      }

      res.json({
        success: true,
        message: 'Abuse pattern updated successfully'
      });
    } catch (error) {
      console.error('Error updating abuse pattern:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update abuse pattern'
      });
    }
  }
);

/**
 * Get active lockouts
 */
router.get('/admin/lockouts',
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const lockouts = abusePreventionService.getActiveLockouts();

      res.json({
        success: true,
        data: lockouts
      });
    } catch (error) {
      console.error('Error fetching active lockouts:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch active lockouts'
      });
    }
  }
);

/**
 * Get active CAPTCHA challenges
 */
router.get('/admin/captchas',
  authenticateToken,
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const captchas = abusePreventionService.getActiveCaptchas();

      // Don't expose solutions in admin view
      const safeCaptchas = captchas.map(({ solution, ...captcha }) => captcha);

      res.json({
        success: true,
        data: safeCaptchas
      });
    } catch (error) {
      console.error('Error fetching active CAPTCHAs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch active CAPTCHAs'
      });
    }
  }
);

/**
 * Manually lock account (admin action)
 */
router.post('/admin/account/:userId/lock',
  authenticateToken,
  requireAdmin,
  [
    body('reason').isString(),
    body('durationMs').isInt({ min: 60000 }), // At least 1 minute
  ],
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId } = req.params;
      const { reason, durationMs } = req.body;

      const lockout = await abusePreventionService.lockAccount(userId, reason, durationMs, req);

      res.json({
        success: true,
        data: {
          lockoutId: lockout.id,
          expiresAt: lockout.expiresAt,
          unlockCode: lockout.unlockCode
        }
      });
    } catch (error) {
      console.error('Error locking account:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to lock account'
      });
    }
  }
);

export default router;