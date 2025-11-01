import { Router, Request, Response } from 'express';
import { AuthService } from '../services/authService.js';
import { authenticateToken } from '../middleware/auth.js';
import { 
  registerSchema, 
  loginSchema, 
  changePasswordSchema,
  RegisterRequest,
  LoginRequest,
  ChangePasswordRequest
} from '../utils/validation.js';

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = registerSchema.parse(req.body) as RegisterRequest;
    
    // Register user
    const result = await AuthService.register(validatedData);
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'User registered successfully'
    });
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof Error) {
      // Handle known errors
      if (error.message.includes('already exists')) {
        res.status(409).json({
          error: {
            code: 'USER_EXISTS',
            message: error.message,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
      
      if (error.name === 'ZodError') {
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
    }
    
    res.status(500).json({
      error: {
        code: 'REGISTRATION_FAILED',
        message: 'Failed to register user',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/auth/login
 * Login user
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = loginSchema.parse(req.body) as LoginRequest;
    
    // Login user
    const result = await AuthService.login(validatedData);
    
    res.json({
      success: true,
      data: result,
      message: 'Login successful'
    });
  } catch (error) {
    console.error('Login error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid email or password')) {
        res.status(401).json({
          error: {
            code: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
      
      if (error.name === 'ZodError') {
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
    }
    
    res.status(500).json({
      error: {
        code: 'LOGIN_FAILED',
        message: 'Failed to login',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/auth/logout
 * Logout user (client-side token removal)
 */
router.post('/logout', authenticateToken, (req: Request, res: Response) => {
  // In a JWT-based system, logout is typically handled client-side
  // by removing the token. We can add token blacklisting here if needed.
  res.json({
    success: true,
    message: 'Logout successful'
  });
});

/**
 * POST /api/auth/refresh
 * Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      res.status(400).json({
        error: {
          code: 'MISSING_REFRESH_TOKEN',
          message: 'Refresh token is required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }
    
    const tokens = await AuthService.refreshToken(refreshToken);
    
    res.json({
      success: true,
      data: tokens,
      message: 'Token refreshed successfully'
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    
    res.status(401).json({
      error: {
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Invalid or expired refresh token',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * POST /api/auth/change-password
 * Change user password
 */
router.post('/change-password', authenticateToken, async (req: Request, res: Response) => {
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
    const validatedData = changePasswordSchema.parse(req.body) as ChangePasswordRequest;
    
    // Change password
    await AuthService.changePassword(req.user.userId, validatedData);
    
    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Current password is incorrect')) {
        res.status(400).json({
          error: {
            code: 'INVALID_PASSWORD',
            message: error.message,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }
      
      if (error.name === 'ZodError') {
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
    }
    
    res.status(500).json({
      error: {
        code: 'PASSWORD_CHANGE_FAILED',
        message: 'Failed to change password',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user profile
 */
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
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

export default router;