/**
 * Abuse Prevention Service - Advanced rate limiting and abuse detection
 * Provides comprehensive protection against various types of abuse
 */

import { Request } from 'express';
import securityService, { SecurityEventType, SecuritySeverity } from './securityService';

export interface RateLimitRule {
  id: string;
  name: string;
  endpoint: string;
  method: string;
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  keyGenerator?: (req: Request) => string;
  enabled: boolean;
}

export interface AbusePattern {
  id: string;
  name: string;
  description: string;
  detectionRules: DetectionRule[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  action: 'log' | 'warn' | 'block' | 'captcha';
  enabled: boolean;
}

export interface DetectionRule {
  type: 'frequency' | 'pattern' | 'anomaly' | 'reputation';
  condition: string;
  threshold: number;
  timeWindow: number;
}

export interface CaptchaChallenge {
  id: string;
  userId?: string;
  ipAddress: string;
  challenge: string;
  solution: string;
  createdAt: Date;
  expiresAt: Date;
  attempts: number;
  solved: boolean;
}

export interface AccountLockout {
  id: string;
  userId: string;
  reason: string;
  lockedAt: Date;
  expiresAt: Date;
  unlockCode?: string;
  attempts: number;
  isActive: boolean;
}

export interface SpamDetectionResult {
  isSpam: boolean;
  confidence: number;
  reasons: string[];
  score: number;
}

class AbusePreventionService {
  private rateLimitCounters: Map<string, { count: number; resetTime: number }> = new Map();
  private captchaChallenges: Map<string, CaptchaChallenge> = new Map();
  private accountLockouts: Map<string, AccountLockout> = new Map();
  private suspiciousPatterns: Map<string, { count: number; lastSeen: Date }> = new Map();
  
  // Default rate limit rules
  private rateLimitRules: RateLimitRule[] = [
    {
      id: 'auth_login',
      name: 'Login Attempts',
      endpoint: '/api/auth/login',
      method: 'POST',
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      enabled: true
    },
    {
      id: 'auth_register',
      name: 'Registration Attempts',
      endpoint: '/api/auth/register',
      method: 'POST',
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3,
      skipSuccessfulRequests: true,
      skipFailedRequests: false,
      enabled: true
    },
    {
      id: 'email_send',
      name: 'Email Sending',
      endpoint: '/api/email/send',
      method: 'POST',
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 100,
      skipSuccessfulRequests: false,
      skipFailedRequests: true,
      enabled: true
    },
    {
      id: 'file_upload',
      name: 'File Upload',
      endpoint: '/api/storage/upload',
      method: 'POST',
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 50,
      skipSuccessfulRequests: false,
      skipFailedRequests: true,
      enabled: true
    },
    {
      id: 'password_reset',
      name: 'Password Reset',
      endpoint: '/api/auth/reset-password',
      method: 'POST',
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      enabled: true
    }
  ];

  // Abuse detection patterns
  private abusePatterns: AbusePattern[] = [
    {
      id: 'rapid_requests',
      name: 'Rapid Request Pattern',
      description: 'Detects unusually high request frequency from single source',
      detectionRules: [
        {
          type: 'frequency',
          condition: 'requests_per_minute > threshold',
          threshold: 60,
          timeWindow: 60000
        }
      ],
      severity: 'medium',
      action: 'warn',
      enabled: true
    },
    {
      id: 'brute_force_login',
      name: 'Brute Force Login',
      description: 'Detects repeated failed login attempts',
      detectionRules: [
        {
          type: 'frequency',
          condition: 'failed_logins > threshold',
          threshold: 10,
          timeWindow: 900000 // 15 minutes
        }
      ],
      severity: 'high',
      action: 'captcha',
      enabled: true
    },
    {
      id: 'spam_email_pattern',
      name: 'Spam Email Pattern',
      description: 'Detects potential spam email sending behavior',
      detectionRules: [
        {
          type: 'frequency',
          condition: 'emails_sent > threshold',
          threshold: 200,
          timeWindow: 3600000 // 1 hour
        }
      ],
      severity: 'high',
      action: 'block',
      enabled: true
    },
    {
      id: 'account_enumeration',
      name: 'Account Enumeration',
      description: 'Detects attempts to enumerate user accounts',
      detectionRules: [
        {
          type: 'pattern',
          condition: 'sequential_user_checks > threshold',
          threshold: 20,
          timeWindow: 600000 // 10 minutes
        }
      ],
      severity: 'medium',
      action: 'captcha',
      enabled: true
    }
  ];

  /**
   * Check rate limit for a request
   */
  checkRateLimit(req: Request): { allowed: boolean; rule?: RateLimitRule; resetTime?: number } {
    const matchingRule = this.findMatchingRule(req);
    if (!matchingRule || !matchingRule.enabled) {
      return { allowed: true };
    }

    const key = this.generateRateLimitKey(req, matchingRule);
    const now = Date.now();
    const counter = this.rateLimitCounters.get(key);

    // Reset counter if window has expired
    if (!counter || now > counter.resetTime) {
      this.rateLimitCounters.set(key, {
        count: 1,
        resetTime: now + matchingRule.windowMs
      });
      return { allowed: true, rule: matchingRule };
    }

    // Check if limit exceeded
    if (counter.count >= matchingRule.maxRequests) {
      return { 
        allowed: false, 
        rule: matchingRule, 
        resetTime: counter.resetTime 
      };
    }

    // Increment counter
    counter.count++;
    return { allowed: true, rule: matchingRule, resetTime: counter.resetTime };
  }

  /**
   * Detect abuse patterns
   */
  async detectAbusePatterns(req: Request, userId?: string): Promise<AbusePattern[]> {
    const detectedPatterns: AbusePattern[] = [];
    const clientIP = this.getClientIP(req);

    for (const pattern of this.abusePatterns) {
      if (!pattern.enabled) continue;

      const detected = await this.evaluatePattern(pattern, req, clientIP, userId);
      if (detected) {
        detectedPatterns.push(pattern);
        
        // Log the detection
        await securityService.logSecurityEvent(
          SecurityEventType.SUSPICIOUS_REQUEST,
          this.mapSeverity(pattern.severity),
          req,
          {
            patternId: pattern.id,
            patternName: pattern.name,
            action: pattern.action
          },
          userId
        );
      }
    }

    return detectedPatterns;
  }

  /**
   * Generate CAPTCHA challenge
   */
  generateCaptchaChallenge(req: Request, userId?: string): CaptchaChallenge {
    const challenge = this.createMathChallenge();
    const captcha: CaptchaChallenge = {
      id: this.generateCaptchaId(),
      userId,
      ipAddress: this.getClientIP(req),
      challenge: challenge.question,
      solution: challenge.answer,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      attempts: 0,
      solved: false
    };

    this.captchaChallenges.set(captcha.id, captcha);
    return captcha;
  }

  /**
   * Verify CAPTCHA solution
   */
  async verifyCaptcha(captchaId: string, solution: string, req: Request): Promise<boolean> {
    const captcha = this.captchaChallenges.get(captchaId);
    if (!captcha) return false;

    captcha.attempts++;

    // Check if expired
    if (captcha.expiresAt < new Date()) {
      this.captchaChallenges.delete(captchaId);
      return false;
    }

    // Check if too many attempts
    if (captcha.attempts > 3) {
      this.captchaChallenges.delete(captchaId);
      
      // Log suspicious activity
      await securityService.logSecurityEvent(
        SecurityEventType.SUSPICIOUS_REQUEST,
        SecuritySeverity.MEDIUM,
        req,
        {
          reason: 'Too many CAPTCHA attempts',
          captchaId,
          attempts: captcha.attempts
        },
        captcha.userId
      );
      
      return false;
    }

    // Verify solution
    if (solution.trim() === captcha.solution) {
      captcha.solved = true;
      this.captchaChallenges.delete(captchaId);
      return true;
    }

    return false;
  }

  /**
   * Lock user account
   */
  async lockAccount(
    userId: string, 
    reason: string, 
    durationMs: number, 
    req: Request
  ): Promise<AccountLockout> {
    const lockout: AccountLockout = {
      id: this.generateLockoutId(),
      userId,
      reason,
      lockedAt: new Date(),
      expiresAt: new Date(Date.now() + durationMs),
      unlockCode: this.generateUnlockCode(),
      attempts: 0,
      isActive: true
    };

    this.accountLockouts.set(userId, lockout);

    // Log account lockout
    await securityService.logSecurityEvent(
      SecurityEventType.ACCOUNT_LOCKOUT,
      SecuritySeverity.HIGH,
      req,
      {
        reason,
        duration: durationMs,
        unlockCode: lockout.unlockCode
      },
      userId
    );

    return lockout;
  }

  /**
   * Check if account is locked
   */
  isAccountLocked(userId: string): { locked: boolean; lockout?: AccountLockout } {
    const lockout = this.accountLockouts.get(userId);
    if (!lockout || !lockout.isActive) {
      return { locked: false };
    }

    // Check if lockout has expired
    if (lockout.expiresAt < new Date()) {
      lockout.isActive = false;
      return { locked: false };
    }

    return { locked: true, lockout };
  }

  /**
   * Unlock account with code
   */
  async unlockAccount(userId: string, unlockCode: string, req: Request): Promise<boolean> {
    const lockout = this.accountLockouts.get(userId);
    if (!lockout || !lockout.isActive) return false;

    lockout.attempts++;

    // Check unlock code
    if (lockout.unlockCode === unlockCode) {
      lockout.isActive = false;
      
      // Log successful unlock
      await securityService.logSecurityEvent(
        SecurityEventType.SYSTEM_ERROR, // Using closest available type
        SecuritySeverity.MEDIUM,
        req,
        {
          action: 'account_unlocked',
          unlockMethod: 'code'
        },
        userId
      );
      
      return true;
    }

    // Too many unlock attempts
    if (lockout.attempts >= 3) {
      // Extend lockout
      lockout.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await securityService.logSecurityEvent(
        SecurityEventType.SUSPICIOUS_REQUEST,
        SecuritySeverity.HIGH,
        req,
        {
          reason: 'Too many unlock attempts',
          lockoutExtended: true
        },
        userId
      );
    }

    return false;
  }

  /**
   * Detect spam content
   */
  detectSpam(content: string, subject?: string): SpamDetectionResult {
    const spamKeywords = [
      'viagra', 'cialis', 'lottery', 'winner', 'congratulations',
      'urgent', 'act now', 'limited time', 'free money', 'click here',
      'make money fast', 'work from home', 'guaranteed', 'risk free'
    ];

    const suspiciousPatterns = [
      /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/, // Credit card pattern
      /\$\d+[,\d]*(\.\d{2})?/, // Money amounts
      /\b[A-Z]{2,}\b/g, // Excessive caps
      /[!]{2,}/, // Multiple exclamation marks
      /\b(click|buy|order|call)\s+(now|today|immediately)\b/i
    ];

    let score = 0;
    const reasons: string[] = [];
    const fullText = `${subject || ''} ${content}`.toLowerCase();

    // Check for spam keywords
    spamKeywords.forEach(keyword => {
      if (fullText.includes(keyword)) {
        score += 10;
        reasons.push(`Contains spam keyword: ${keyword}`);
      }
    });

    // Check for suspicious patterns
    suspiciousPatterns.forEach((pattern, index) => {
      if (pattern.test(fullText)) {
        score += 15;
        reasons.push(`Matches suspicious pattern ${index + 1}`);
      }
    });

    // Check for excessive caps
    const capsRatio = (content.match(/[A-Z]/g) || []).length / content.length;
    if (capsRatio > 0.3) {
      score += 20;
      reasons.push('Excessive use of capital letters');
    }

    // Check for excessive punctuation
    const punctuationRatio = (content.match(/[!?]{2,}/g) || []).length;
    if (punctuationRatio > 2) {
      score += 15;
      reasons.push('Excessive punctuation');
    }

    const confidence = Math.min(score / 100, 1);
    const isSpam = score >= 50;

    return {
      isSpam,
      confidence,
      reasons,
      score
    };
  }

  /**
   * Get rate limit rules
   */
  getRateLimitRules(): RateLimitRule[] {
    return [...this.rateLimitRules];
  }

  /**
   * Update rate limit rule
   */
  updateRateLimitRule(ruleId: string, updates: Partial<RateLimitRule>): boolean {
    const index = this.rateLimitRules.findIndex(rule => rule.id === ruleId);
    if (index === -1) return false;

    this.rateLimitRules[index] = {
      ...this.rateLimitRules[index],
      ...updates
    };

    return true;
  }

  /**
   * Get abuse patterns
   */
  getAbusePatterns(): AbusePattern[] {
    return [...this.abusePatterns];
  }

  /**
   * Update abuse pattern
   */
  updateAbusePattern(patternId: string, updates: Partial<AbusePattern>): boolean {
    const index = this.abusePatterns.findIndex(pattern => pattern.id === patternId);
    if (index === -1) return false;

    this.abusePatterns[index] = {
      ...this.abusePatterns[index],
      ...updates
    };

    return true;
  }

  /**
   * Get active lockouts
   */
  getActiveLockouts(): AccountLockout[] {
    return Array.from(this.accountLockouts.values())
      .filter(lockout => lockout.isActive && lockout.expiresAt > new Date());
  }

  /**
   * Get active CAPTCHA challenges
   */
  getActiveCaptchas(): CaptchaChallenge[] {
    return Array.from(this.captchaChallenges.values())
      .filter(captcha => !captcha.solved && captcha.expiresAt > new Date());
  }

  // Private helper methods

  private findMatchingRule(req: Request): RateLimitRule | undefined {
    return this.rateLimitRules.find(rule => {
      const pathMatches = req.path.includes(rule.endpoint) || rule.endpoint === '*';
      const methodMatches = rule.method === '*' || req.method === rule.method;
      return pathMatches && methodMatches;
    });
  }

  private generateRateLimitKey(req: Request, rule: RateLimitRule): string {
    if (rule.keyGenerator) {
      return rule.keyGenerator(req);
    }
    
    const clientIP = this.getClientIP(req);
    return `${rule.id}:${clientIP}`;
  }

  private async evaluatePattern(
    pattern: AbusePattern, 
    req: Request, 
    clientIP: string, 
    userId?: string
  ): Promise<boolean> {
    // This is a simplified implementation
    // In a real system, you would have more sophisticated pattern matching
    
    for (const rule of pattern.detectionRules) {
      if (rule.type === 'frequency') {
        const key = `${pattern.id}:${clientIP}:${userId || 'anonymous'}`;
        const patternData = this.suspiciousPatterns.get(key) || { count: 0, lastSeen: new Date() };
        
        // Reset if outside time window
        if (Date.now() - patternData.lastSeen.getTime() > rule.timeWindow) {
          patternData.count = 1;
          patternData.lastSeen = new Date();
        } else {
          patternData.count++;
        }
        
        this.suspiciousPatterns.set(key, patternData);
        
        if (patternData.count > rule.threshold) {
          return true;
        }
      }
    }
    
    return false;
  }

  private createMathChallenge(): { question: string; answer: string } {
    const num1 = Math.floor(Math.random() * 20) + 1;
    const num2 = Math.floor(Math.random() * 20) + 1;
    const operations = ['+', '-', '*'];
    const operation = operations[Math.floor(Math.random() * operations.length)];
    
    let answer: number;
    switch (operation) {
      case '+':
        answer = num1 + num2;
        break;
      case '-':
        answer = Math.max(num1, num2) - Math.min(num1, num2);
        break;
      case '*':
        answer = num1 * num2;
        break;
      default:
        answer = num1 + num2;
    }
    
    const question = operation === '-' 
      ? `${Math.max(num1, num2)} ${operation} ${Math.min(num1, num2)} = ?`
      : `${num1} ${operation} ${num2} = ?`;
    
    return { question, answer: answer.toString() };
  }

  private mapSeverity(severity: string): SecuritySeverity {
    switch (severity) {
      case 'critical': return SecuritySeverity.CRITICAL;
      case 'high': return SecuritySeverity.HIGH;
      case 'medium': return SecuritySeverity.MEDIUM;
      default: return SecuritySeverity.LOW;
    }
  }

  private getClientIP(req: Request): string {
    return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
           req.connection.remoteAddress ||
           req.socket.remoteAddress ||
           'unknown';
  }

  private generateCaptchaId(): string {
    return `captcha_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateLockoutId(): string {
    return `lockout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateUnlockCode(): string {
    return Math.random().toString(36).substr(2, 8).toUpperCase();
  }
}

export default new AbusePreventionService();