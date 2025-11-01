import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService.js';
import { authenticateToken } from '../middleware/auth.js';
import { updateProfileSchema, UpdateProfileRequest } from '../utils/validation.js';

const router = Router();

/**
 * GET /api/user/profile
 * Get user profile
 */
router.get('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }
    
    const profile = await AuthService.getProfile(req.user.userId);
    
    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    
    res.status(500).json({
      error: {
        code: 'PROFILE_FETCH_FAILED',
        message: 'Failed to fetch user profile',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * PUT /api/user/profile
 * Update user profile
 */
router.put('/profile', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }
    
    // Validate request body
    const validatedData = updateProfileSchema.parse(req.body) as UpdateProfileRequest;
    
    // Update user profile
    const profile = await AuthService.updateProfile(req.user.userId, validatedData);
    
    res.json({
      success: true,
      data: profile,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('Update profile error:', error);
    
    if (error instanceof Error && error.name === 'ZodError') {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input data',
          details: error,
          timestamp: new Date().toISOString()
        }
      });
      return;
    }
    
    res.status(500).json({
      error: {
        code: 'PROFILE_UPDATE_FAILED',
        message: 'Failed to update profile',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/user/export
 * Export user data for GDPR compliance
 */
router.get('/export', authenticateToken, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }
    
    const userData = await AuthService.exportUserData(req.user.userId);
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="user-data-${req.user.userId}.json"`);
    
    res.json({
      success: true,
      data: userData,
      message: 'User data exported successfully'
    });
  } catch (error) {
    console.error('Export user data error:', error);
    
    res.status(500).json({
      error: {
        code: 'EXPORT_FAILED',
        message: 'Failed to export user data',
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;