/**
 * Security Middleware - Automatic security monitoring and logging
 * Provides middleware for request monitoring, rate limiting, and security checks
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import securityService, { SecurityEventType, SecuritySeverity } from '../services/securityService';
import abusePreventionService from '../services/abusePreventionService';

// Extend Request interface to include security context
declare global {
  namespace Express {
    interface Request {
      securityContext?: {
        riskScore: number;
        isSuspicious: boolean;
        rateLimitInfo?: {
          limit: number;
          remaining: number;
          resetTime: Date;
        };
      };
    }
  }
}

/**
 * Security monitoring middleware
 */
export const securityMonitoring = async (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Initialize security context
  req.securityContext = {
    riskScore: 0,
    isSuspicious: false
  };
  
  // Check rate limits
  const rateLimitResult = abusePreventionService.checkRateLimit(req);
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      error: 'Rate limit exceeded',
      message: `Too many requests. Try again after ${Math.ceil((rateLimitResult.resetTime! - Date.now()) / 1000)} seconds`,
      retryAfter: Math.ceil((rateLimitResult.resetTime! - Date.now()) / 1000)
    });
  }
  
  // Detect abuse patterns
  const abusePatterns = await abusePreventionService.detectAbusePatterns(req, req.user?.id);
  if (abusePatterns.length > 0) {
    for (const pattern of abusePatterns) {
      if (pattern.action === 'block') {
        return res.status(403).json({
          error: 'Request blocked',
          message: 'Your request has been blocked due to suspicious activity',
          pattern: pattern.name
        });
      } else if (pattern.action === 'captcha') {
        const captcha = abusePreventionService.generateCaptchaChallenge(req, req.user?.id);
        return res.status(429).json({
          error: 'CAPTCHA required',
          message: 'Please solve the CAPTCHA to continue',
          captcha: {
            id: captcha.id,
            challenge: captcha.challenge
          }
        });
      }
    }
  }
  
  // Calculate risk score based on various factors
  const riskScore = calculateRiskScore(req);
  req.securityContext.riskScore = riskScore;
  req.securityContext.isSuspicious = riskScore > 50;
  
  // Log suspicious requests
  if (req.securityContext.isSuspicious) {
    securityService.logSecurityEvent(
      SecurityEventType.SUSPICIOUS_REQUEST,
      SecuritySeverity.MEDIUM,
      req,
      {
        riskScore,
        path: req.path,
        method: req.method,
        query: req.query,
        headers: sanitizeHeaders(req.headers)
      }
    );
  }
  
  // Monitor response
  const originalSend = res.send;
  res.send = function(data) {
    const responseTime = Date.now() - startTime;
    
    // Log slow responses as potential DoS indicators
    if (responseTime > 5000) {
      securityService.logSecurityEvent(
        SecurityEventType.SYSTEM_ERROR,
        SecuritySeverity.MEDIUM,
        req,
        {
          responseTime,
          statusCode: res.statusCode,
          path: req.path
        }
      );
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Authentication monitoring middleware
 */
export const authenticationMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Monitor authentication attempts
    if (req.path.includes('/auth/login') || req.path.includes('/auth/register')) {
      const success = res.statusCode >= 200 && res.statusCode < 300;
      
      securityService.logAuthenticationAttempt(
        success,
        req,
        req.body?.userId || req.body?.email,
        {
          endpoint: req.path,
          statusCode: res.statusCode
        }
      );
    }
    
    // Monitor password changes
    if (req.path.includes('/auth/change-password')) {
      const success = res.statusCode >= 200 && res.statusCode < 300;
      
      if (success) {
        securityService.logSecurityEvent(
          SecurityEventType.PASSWORD_CHANGE,
          SecuritySeverity.MEDIUM,
          req,
          {
            statusCode: res.statusCode
          },
          req.user?.id
        );
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Data access monitoring middleware
 */
export const dataAccessMonitoring = (req: Request, res: Response, next: NextFunction) => {
  const originalSend = res.send;
  
  res.send = function(data) {
    // Monitor sensitive data access
    if (req.path.includes('/email') || req.path.includes('/files') || req.path.includes('/user')) {
      const action = getActionFromMethod(req.method);
      const dataType = getDataTypeFromPath(req.path);
      
      if (req.user?.id) {
        securityService.logDataAccess(
          dataType,
          action,
          req,
          req.user.id,
          {
            statusCode: res.statusCode,
            path: req.path
          }
        );
      }
    }
    
    return originalSend.call(this, data);
  };
  
  next();
};

/**
 * Rate limiting middleware
 */
export const createRateLimit = (options: {
  windowMs: number;
  max: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs,
    max: options.max,
    message: options.message || 'Too many requests from this IP',
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    handler: (req: Request, res: Response) => {
      // Log rate limit exceeded
      securityService.logSecurityEvent(
        SecurityEventType.RATE_LIMIT_EXCEEDED,
        SecuritySeverity.MEDIUM,
        req,
        {
          limit: options.max,
          windowMs: options.windowMs,
          path: req.path
        }
      );
      
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: options.message || 'Too many requests from this IP',
        retryAfter: Math.ceil(options.windowMs / 1000)
      });
    },
    onLimitReached: (req: Request) => {
      // Update security context
      if (req.securityContext) {
        req.securityContext.riskScore += 20;
        req.securityContext.isSuspicious = true;
      }
    }
  });
};

/**
 * Helmet security headers middleware
 */
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for development
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

/**
 * Input validation and XSS prevention middleware
 */
export const inputValidation = (req: Request, res: Response, next: NextFunction) => {
  // Check for potential XSS in request body
  if (req.body && typeof req.body === 'object') {
    const hasXSS = checkForXSS(req.body);
    if (hasXSS) {
      securityService.logSecurityEvent(
        SecurityEventType.SUSPICIOUS_REQUEST,
        SecuritySeverity.HIGH,
        req,
        {
          reason: 'Potential XSS attempt detected',
          body: sanitizeObject(req.body)
        }
      );
      
      return res.status(400).json({
        error: 'Invalid input detected',
        message: 'Request contains potentially malicious content'
      });
    }
  }
  
  // Check for SQL injection patterns
  if (req.query && typeof req.query === 'object') {
    const hasSQLi = checkForSQLInjection(req.query);
    if (hasSQLi) {
      securityService.logSecurityEvent(
        SecurityEventType.SUSPICIOUS_REQUEST,
        SecuritySeverity.HIGH,
        req,
        {
          reason: 'Potential SQL injection attempt detected',
          query: sanitizeObject(req.query)
        }
      );
      
      return res.status(400).json({
        error: 'Invalid query parameters',
        message: 'Request contains potentially malicious content'
      });
    }
  }
  
  next();
};

/**
 * IP blocking middleware for suspicious IPs
 */
export const ipBlocking = (req: Request, res: Response, next: NextFunction) => {
  const clientIP = getClientIP(req);
  
  if (securityService.isSuspiciousIP(clientIP)) {
    securityService.logSecurityEvent(
      SecurityEventType.UNAUTHORIZED_ACCESS,
      SecuritySeverity.HIGH,
      req,
      {
        reason: 'Request from blocked IP address',
        blockedIP: clientIP
      }
    );
    
    return res.status(403).json({
      error: 'Access denied',
      message: 'Your IP address has been temporarily blocked due to suspicious activity'
    });
  }
  
  next();
};

// Helper functions

function calculateRiskScore(req: Request): number {
  let score = 0;
  
  // Check user agent
  const userAgent = req.get('User-Agent') || '';
  if (!userAgent || userAgent.length < 10) {
    score += 20; // Missing or suspicious user agent
  }
  
  // Check for automation tools
  const automationPatterns = [
    /curl/i, /wget/i, /python/i, /bot/i, /crawler/i, /spider/i
  ];
  if (automationPatterns.some(pattern => pattern.test(userAgent))) {
    score += 15;
  }
  
  // Check request frequency
  const clientIP = getClientIP(req);
  const failedAttempts = securityService.getFailedLoginAttempts(clientIP);
  score += Math.min(failedAttempts * 5, 30);
  
  // Check for suspicious headers
  const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip'];
  const headerCount = suspiciousHeaders.filter(header => req.headers[header]).length;
  if (headerCount > 1) {
    score += 10; // Multiple forwarding headers might indicate proxy chains
  }
  
  // Check request size
  const contentLength = parseInt(req.get('Content-Length') || '0');
  if (contentLength > 1024 * 1024) { // > 1MB
    score += 15;
  }
  
  return Math.min(score, 100);
}

function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers };
  
  // Remove sensitive headers
  delete sanitized.authorization;
  delete sanitized.cookie;
  delete sanitized['x-api-key'];
  
  return sanitized;
}

function getActionFromMethod(method: string): 'read' | 'write' | 'delete' | 'export' {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'read';
    case 'POST':
    case 'PUT':
    case 'PATCH':
      return 'write';
    case 'DELETE':
      return 'delete';
    default:
      return 'read';
  }
}

function getDataTypeFromPath(path: string): string {
  if (path.includes('/email')) return 'email';
  if (path.includes('/files')) return 'file';
  if (path.includes('/user')) return 'user_data';
  if (path.includes('/billing')) return 'billing';
  return 'unknown';
}

function checkForXSS(obj: any): boolean {
  const xssPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe[^>]*>/gi,
    /<object[^>]*>/gi,
    /<embed[^>]*>/gi
  ];
  
  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return xssPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkValue);
    }
    return false;
  };
  
  return checkValue(obj);
}

function checkForSQLInjection(obj: any): boolean {
  const sqlPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /('|(\\')|(;)|(--)|(\|)|(\*)|(%27)|(%3D)|(%3B)|(%2D%2D))/gi
  ];
  
  const checkValue = (value: any): boolean => {
    if (typeof value === 'string') {
      return sqlPatterns.some(pattern => pattern.test(value));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.values(value).some(checkValue);
    }
    return false;
  };
  
  return checkValue(obj);
}

function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return obj.length > 100 ? obj.substring(0, 100) + '...' : obj;
  }
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    Object.keys(obj).forEach(key => {
      sanitized[key] = sanitizeObject(obj[key]);
    });
    return sanitized;
  }
  return obj;
}

/**
 * CAPTCHA verification middleware
 */
export const verifyCaptcha = async (req: Request, res: Response, next: NextFunction) => {
  const { captchaId, captchaSolution } = req.body;
  
  if (!captchaId || !captchaSolution) {
    return res.status(400).json({
      error: 'CAPTCHA verification required',
      message: 'Please provide CAPTCHA ID and solution'
    });
  }
  
  const verified = await abusePreventionService.verifyCaptcha(captchaId, captchaSolution, req);
  if (!verified) {
    return res.status(400).json({
      error: 'CAPTCHA verification failed',
      message: 'Invalid or expired CAPTCHA solution'
    });
  }
  
  next();
};

/**
 * Account lockout checking middleware
 */
export const checkAccountLockout = (req: Request, res: Response, next: NextFunction) => {
  const userId = req.user?.id || req.body?.userId;
  if (!userId) {
    return next();
  }
  
  const lockoutResult = abusePreventionService.isAccountLocked(userId);
  if (lockoutResult.locked && lockoutResult.lockout) {
    const timeRemaining = Math.ceil((lockoutResult.lockout.expiresAt.getTime() - Date.now()) / 1000);
    
    return res.status(423).json({
      error: 'Account locked',
      message: `Account is temporarily locked due to ${lockoutResult.lockout.reason}`,
      lockedUntil: lockoutResult.lockout.expiresAt,
      timeRemaining,
      unlockCode: lockoutResult.lockout.unlockCode
    });
  }
  
  next();
};

/**
 * Spam detection middleware for email content
 */
export const spamDetection = (req: Request, res: Response, next: NextFunction) => {
  if (req.path.includes('/email/send') && req.body) {
    const { content, subject } = req.body;
    
    if (content) {
      const spamResult = abusePreventionService.detectSpam(content, subject);
      
      if (spamResult.isSpam) {
        securityService.logSecurityEvent(
          SecurityEventType.SUSPICIOUS_REQUEST,
          SecuritySeverity.HIGH,
          req,
          {
            reason: 'Spam content detected',
            spamScore: spamResult.score,
            confidence: spamResult.confidence,
            reasons: spamResult.reasons
          },
          req.user?.id
        );
        
        return res.status(400).json({
          error: 'Content blocked',
          message: 'Your message appears to contain spam content and cannot be sent',
          spamScore: spamResult.score,
          reasons: spamResult.reasons
        });
      }
      
      // Log potential spam for monitoring
      if (spamResult.score > 25) {
        securityService.logSecurityEvent(
          SecurityEventType.SUSPICIOUS_REQUEST,
          SecuritySeverity.MEDIUM,
          req,
          {
            reason: 'Potential spam content',
            spamScore: spamResult.score,
            confidence: spamResult.confidence
          },
          req.user?.id
        );
      }
    }
  }
  
  next();
};

function getClientIP(req: Request): string {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         'unknown';
}

// Rate limiting configurations
export const rateLimits = {
  // General API rate limit
  general: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000 // limit each IP to 1000 requests per windowMs
  }),
  
  // Authentication rate limit
  auth: createRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 login attempts per windowMs
    message: 'Too many authentication attempts, please try again later'
  }),
  
  // Email sending rate limit
  email: createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 100, // limit each IP to 100 emails per hour
    message: 'Email sending rate limit exceeded'
  }),
  
  // File upload rate limit
  upload: createRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 50, // limit each IP to 50 uploads per hour
    message: 'File upload rate limit exceeded'
  })
};