import { SpamRule } from '../models/SpamRule.js';
import { SpamReport } from '../models/SpamReport.js';
import { EmailMetadata } from '../models/Email.js';

export interface CreateSpamRuleData {
  type: 'sender' | 'subject' | 'content' | 'attachment';
  pattern: string;
  action: 'block' | 'spam' | 'quarantine';
  isRegex: boolean;
  isActive: boolean;
}

export interface SpamStats {
  totalBlocked: number;
  totalSpam: number;
  totalQuarantined: number;
  recentBlocked: number;
  topBlockedSenders: { sender: string; count: number }[];
}

export class SpamService {
  /**
   * Get spam rules for a user
   */
  static async getSpamRules(userId: string): Promise<any[]> {
    const rules = await SpamRule.find({ userId })
      .sort({ createdAt: -1 });

    return rules.map((rule: any) => ({
      id: rule._id.toString(),
      type: rule.type,
      pattern: rule.pattern,
      action: rule.action,
      isRegex: rule.isRegex,
      isActive: rule.isActive,
      createdAt: rule.createdAt
    }));
  }

  /**
   * Create a spam rule
   */
  static async createSpamRule(userId: string, ruleData: CreateSpamRuleData): Promise<any> {
    // Validate regex pattern if isRegex is true
    if (ruleData.isRegex) {
      try {
        new RegExp(ruleData.pattern);
      } catch (error) {
        throw new Error('Invalid regular expression pattern');
      }
    }

    const rule = new SpamRule({
      userId,
      type: ruleData.type,
      pattern: ruleData.pattern,
      action: ruleData.action,
      isRegex: ruleData.isRegex,
      isActive: ruleData.isActive
    });

    await rule.save();

    return {
      id: rule._id.toString(),
      type: rule.type,
      pattern: rule.pattern,
      action: rule.action,
      isRegex: rule.isRegex,
      isActive: rule.isActive,
      createdAt: rule.createdAt
    };
  }

  /**
   * Update a spam rule
   */
  static async updateSpamRule(ruleId: string, userId: string, updates: any): Promise<any> {
    const rule = await SpamRule.findOne({ _id: ruleId, userId });
    if (!rule) {
      throw new Error('Spam rule not found');
    }

    // Validate regex pattern if being updated
    if (updates.isRegex && updates.pattern) {
      try {
        new RegExp(updates.pattern);
      } catch (error) {
        throw new Error('Invalid regular expression pattern');
      }
    }

    Object.assign(rule, updates);
    await rule.save();

    return {
      id: rule._id.toString(),
      type: rule.type,
      pattern: rule.pattern,
      action: rule.action,
      isRegex: rule.isRegex,
      isActive: rule.isActive,
      createdAt: rule.createdAt
    };
  }

  /**
   * Delete a spam rule
   */
  static async deleteSpamRule(ruleId: string, userId: string): Promise<void> {
    const rule = await SpamRule.findOne({ _id: ruleId, userId });
    if (!rule) {
      throw new Error('Spam rule not found');
    }

    await SpamRule.findByIdAndDelete(ruleId);
  }

  /**
   * Get spam statistics for a user
   */
  static async getSpamStats(userId: string): Promise<SpamStats> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get spam reports
    const spamReports = await SpamReport.aggregate([
      {
        $match: {
          userId,
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      }
    ]);

    const statsMap = new Map(
      spamReports.map((report: any) => [report._id, report.count])
    );

    // Get recent blocked count (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentBlocked = await SpamReport.countDocuments({
      userId,
      action: 'block',
      createdAt: { $gte: sevenDaysAgo }
    });

    // Get top blocked senders
    const topBlockedSenders = await SpamReport.aggregate([
      {
        $match: {
          userId,
          action: 'block',
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$senderEmail',
          count: { $sum: 1 }
        }
      },
      {
        $sort: { count: -1 }
      },
      {
        $limit: 10
      },
      {
        $project: {
          sender: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    return {
      totalBlocked: (statsMap.get('block') as number) || 0,
      totalSpam: (statsMap.get('spam') as number) || 0,
      totalQuarantined: (statsMap.get('quarantine') as number) || 0,
      recentBlocked,
      topBlockedSenders
    };
  }

  /**
   * Report an email as spam
   */
  static async reportSpam(emailId: string, userId: string): Promise<void> {
    // Get email metadata
    const email = await EmailMetadata.findById(emailId)
      .populate('senderId', 'email');

    if (!email) {
      throw new Error('Email not found');
    }

    // Check if user has access to this email
    if (!email.recipientIds.includes(userId)) {
      throw new Error('Access denied');
    }

    // Create spam report
    const report = new SpamReport({
      userId,
      emailId,
      senderEmail: (email.senderId as any).email,
      action: 'spam',
      reason: 'User reported as spam'
    });

    await report.save();

    // Move email to spam folder
    email.folderId = 'spam';
    await email.save();
  }

  /**
   * Mark email as not spam
   */
  static async markNotSpam(emailId: string, userId: string): Promise<void> {
    // Get email metadata
    const email = await EmailMetadata.findById(emailId);

    if (!email) {
      throw new Error('Email not found');
    }

    // Check if user has access to this email
    if (!email.recipientIds.includes(userId)) {
      throw new Error('Access denied');
    }

    // Remove from spam reports
    await SpamReport.deleteMany({
      userId,
      emailId
    });

    // Move email back to inbox if it's in spam folder
    if (email.folderId === 'spam') {
      email.folderId = 'inbox';
      await email.save();
    }
  }

  /**
   * Check if email should be filtered as spam
   */
  static async checkEmailForSpam(
    userId: string,
    emailContent: {
      senderEmail: string;
      subject: string;
      body: string;
      attachments: { name: string; type: string }[];
    }
  ): Promise<{ isSpam: boolean; action: string; reason: string }> {
    // Get user's active spam rules
    const rules = await SpamRule.find({
      userId,
      isActive: true
    });

    for (const rule of rules) {
      const matches = this.checkRuleMatch(emailContent, rule);
      if (matches) {
        // Log the spam action
        const report = new SpamReport({
          userId,
          senderEmail: emailContent.senderEmail,
          action: rule.action,
          reason: `Matched rule: ${rule.pattern}`
        });

        await report.save();

        return {
          isSpam: true,
          action: rule.action,
          reason: `Matched spam rule: ${rule.pattern}`
        };
      }
    }

    return {
      isSpam: false,
      action: 'allow',
      reason: 'No spam rules matched'
    };
  }

  /**
   * Check if email content matches a spam rule
   */
  private static checkRuleMatch(
    emailContent: {
      senderEmail: string;
      subject: string;
      body: string;
      attachments: { name: string; type: string }[];
    },
    rule: any
  ): boolean {
    try {
      const pattern = rule.isRegex ? new RegExp(rule.pattern, 'i') : rule.pattern.toLowerCase();

      switch (rule.type) {
        case 'sender':
          if (rule.isRegex) {
            return (pattern as RegExp).test(emailContent.senderEmail);
          } else {
            return emailContent.senderEmail.toLowerCase().includes(pattern as string);
          }

        case 'subject':
          if (rule.isRegex) {
            return (pattern as RegExp).test(emailContent.subject);
          } else {
            return emailContent.subject.toLowerCase().includes(pattern as string);
          }

        case 'content':
          if (rule.isRegex) {
            return (pattern as RegExp).test(emailContent.body);
          } else {
            return emailContent.body.toLowerCase().includes(pattern as string);
          }

        case 'attachment':
          return emailContent.attachments.some(att => {
            if (rule.isRegex) {
              return (pattern as RegExp).test(att.name) || (pattern as RegExp).test(att.type);
            } else {
              return att.name.toLowerCase().includes(pattern as string) ||
                     att.type.toLowerCase().includes(pattern as string);
            }
          });

        default:
          return false;
      }
    } catch (error) {
      console.warn('Error checking spam rule:', error);
      return false;
    }
  }
}