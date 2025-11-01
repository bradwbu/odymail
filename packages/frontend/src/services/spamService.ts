/**
 * Spam filtering service for incoming emails
 */

export interface SpamRule {
  id: string;
  type: 'sender' | 'subject' | 'content' | 'attachment';
  pattern: string;
  action: 'block' | 'spam' | 'quarantine';
  isRegex: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface SpamCheckResult {
  isSpam: boolean;
  confidence: number;
  reasons: string[];
  suggestedAction: 'allow' | 'spam' | 'block';
}

export interface SpamStats {
  totalBlocked: number;
  totalSpam: number;
  totalQuarantined: number;
  recentBlocked: number;
  topBlockedSenders: { sender: string; count: number }[];
}

export class SpamService {
  private apiBaseUrl: string;
  private spamKeywords: string[] = [
    'viagra', 'cialis', 'lottery', 'winner', 'congratulations',
    'urgent', 'act now', 'limited time', 'free money', 'get rich',
    'nigerian prince', 'inheritance', 'tax refund', 'click here',
    'unsubscribe', 'pharmacy', 'weight loss', 'make money fast'
  ];

  constructor(apiBaseUrl: string = '/api') {
    this.apiBaseUrl = apiBaseUrl;
  }

  /**
   * Check if an email is spam
   */
  async checkSpam(emailContent: {
    senderEmail: string;
    subject: string;
    body: string;
    attachments: { name: string; type: string }[];
  }): Promise<SpamCheckResult> {
    try {
      // Get user's spam rules
      const rules = await this.getSpamRules();
      
      let spamScore = 0;
      const reasons: string[] = [];
      
      // Check against user-defined rules
      for (const rule of rules) {
        if (!rule.isActive) continue;
        
        const ruleResult = this.checkRule(emailContent, rule);
        if (ruleResult.matches) {
          spamScore += ruleResult.score;
          reasons.push(ruleResult.reason);
        }
      }
      
      // Check against built-in spam detection
      const builtInResult = this.checkBuiltInSpamFilters(emailContent);
      spamScore += builtInResult.score;
      reasons.push(...builtInResult.reasons);
      
      // Determine spam confidence and action
      const confidence = Math.min(spamScore / 100, 1);
      const isSpam = confidence > 0.5;
      
      let suggestedAction: 'allow' | 'spam' | 'block' = 'allow';
      if (confidence > 0.8) {
        suggestedAction = 'block';
      } else if (confidence > 0.5) {
        suggestedAction = 'spam';
      }
      
      return {
        isSpam,
        confidence,
        reasons: reasons.filter(r => r.length > 0),
        suggestedAction
      };
      
    } catch (error) {
      console.warn('Spam check failed:', error);
      return {
        isSpam: false,
        confidence: 0,
        reasons: [],
        suggestedAction: 'allow'
      };
    }
  }

  /**
   * Get user's spam rules
   */
  async getSpamRules(): Promise<SpamRule[]> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/spam/rules`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch spam rules');
      }

      const data = await response.json();
      return data.rules;
    } catch (error) {
      console.warn('Failed to get spam rules:', error);
      return [];
    }
  }

  /**
   * Create a new spam rule
   */
  async createSpamRule(rule: Omit<SpamRule, 'id' | 'createdAt'>): Promise<SpamRule> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/spam/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(rule)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create spam rule');
      }

      const data = await response.json();
      return data.rule;
    } catch (error) {
      throw new Error(`Failed to create spam rule: ${error}`);
    }
  }

  /**
   * Update spam rule
   */
  async updateSpamRule(ruleId: string, updates: Partial<SpamRule>): Promise<SpamRule> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/spam/rules/${ruleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update spam rule');
      }

      const data = await response.json();
      return data.rule;
    } catch (error) {
      throw new Error(`Failed to update spam rule: ${error}`);
    }
  }

  /**
   * Delete spam rule
   */
  async deleteSpamRule(ruleId: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/spam/rules/${ruleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete spam rule');
      }
    } catch (error) {
      throw new Error(`Failed to delete spam rule: ${error}`);
    }
  }

  /**
   * Get spam statistics
   */
  async getSpamStats(): Promise<SpamStats> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/spam/stats`, {
        headers: {
          'Authorization': `Bearer ${this.getAuthToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch spam stats');
      }

      const data = await response.json();
      return data.stats;
    } catch (error) {
      throw new Error(`Failed to get spam stats: ${error}`);
    }
  }

  /**
   * Report email as spam
   */
  async reportSpam(emailId: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/spam/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ emailId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to report spam');
      }
    } catch (error) {
      throw new Error(`Failed to report spam: ${error}`);
    }
  }

  /**
   * Mark email as not spam
   */
  async markNotSpam(emailId: string): Promise<void> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/spam/not-spam`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: JSON.stringify({ emailId })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to mark as not spam');
      }
    } catch (error) {
      throw new Error(`Failed to mark as not spam: ${error}`);
    }
  }

  /**
   * Check a rule against email content
   */
  private checkRule(emailContent: any, rule: SpamRule): { matches: boolean; score: number; reason: string } {
    let matches = false;
    let score = 0;
    let reason = '';
    
    try {
      const pattern = rule.isRegex ? new RegExp(rule.pattern, 'i') : rule.pattern.toLowerCase();
      
      switch (rule.type) {
        case 'sender':
          if (rule.isRegex) {
            matches = (pattern as RegExp).test(emailContent.senderEmail);
          } else {
            matches = emailContent.senderEmail.toLowerCase().includes(pattern as string);
          }
          if (matches) {
            score = 50;
            reason = `Blocked sender: ${emailContent.senderEmail}`;
          }
          break;
          
        case 'subject':
          if (rule.isRegex) {
            matches = (pattern as RegExp).test(emailContent.subject);
          } else {
            matches = emailContent.subject.toLowerCase().includes(pattern as string);
          }
          if (matches) {
            score = 40;
            reason = `Suspicious subject pattern: ${rule.pattern}`;
          }
          break;
          
        case 'content':
          if (rule.isRegex) {
            matches = (pattern as RegExp).test(emailContent.body);
          } else {
            matches = emailContent.body.toLowerCase().includes(pattern as string);
          }
          if (matches) {
            score = 30;
            reason = `Suspicious content pattern: ${rule.pattern}`;
          }
          break;
          
        case 'attachment':
          matches = emailContent.attachments.some((att: any) => {
            if (rule.isRegex) {
              return (pattern as RegExp).test(att.name) || (pattern as RegExp).test(att.type);
            } else {
              return att.name.toLowerCase().includes(pattern as string) || 
                     att.type.toLowerCase().includes(pattern as string);
            }
          });
          if (matches) {
            score = 35;
            reason = `Suspicious attachment pattern: ${rule.pattern}`;
          }
          break;
      }
      
      // Adjust score based on action
      if (rule.action === 'block') {
        score *= 2;
      } else if (rule.action === 'quarantine') {
        score *= 1.5;
      }
      
    } catch (error) {
      console.warn('Error checking spam rule:', error);
    }
    
    return { matches, score, reason };
  }

  /**
   * Built-in spam detection filters
   */
  private checkBuiltInSpamFilters(emailContent: any): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];
    
    // Check for spam keywords
    const bodyLower = emailContent.body.toLowerCase();
    const subjectLower = emailContent.subject.toLowerCase();
    
    let keywordCount = 0;
    for (const keyword of this.spamKeywords) {
      if (bodyLower.includes(keyword) || subjectLower.includes(keyword)) {
        keywordCount++;
      }
    }
    
    if (keywordCount > 0) {
      score += keywordCount * 10;
      reasons.push(`Contains ${keywordCount} spam keyword(s)`);
    }
    
    // Check for excessive capitalization
    const capsRatio = (emailContent.subject.match(/[A-Z]/g) || []).length / emailContent.subject.length;
    if (capsRatio > 0.5 && emailContent.subject.length > 10) {
      score += 20;
      reasons.push('Excessive capitalization in subject');
    }
    
    // Check for suspicious attachments
    const suspiciousExtensions = ['.exe', '.scr', '.bat', '.com', '.pif', '.vbs', '.js'];
    const hasSuspiciousAttachment = emailContent.attachments.some((att: any) =>
      suspiciousExtensions.some(ext => att.name.toLowerCase().endsWith(ext))
    );
    
    if (hasSuspiciousAttachment) {
      score += 40;
      reasons.push('Contains suspicious attachment');
    }
    
    // Check for multiple exclamation marks
    const exclamationCount = (emailContent.subject.match(/!/g) || []).length;
    if (exclamationCount > 2) {
      score += 15;
      reasons.push('Excessive exclamation marks');
    }
    
    // Check for suspicious URLs (basic check)
    const urlPattern = /https?:\/\/[^\s]+/gi;
    const urls = emailContent.body.match(urlPattern) || [];
    if (urls.length > 5) {
      score += 25;
      reasons.push('Contains many URLs');
    }
    
    return { score, reasons };
  }

  /**
   * Get authentication token
   */
  private getAuthToken(): string {
    return localStorage.getItem('authToken') || '';
  }
}