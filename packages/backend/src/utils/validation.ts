import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// User registration validation schema
export const registerSchema = z.object({
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Username can only contain letters, numbers, dots, underscores, and hyphens'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  publicKey: z.string().min(1, 'Public key is required'),
  encryptedPrivateKey: z.string().min(1, 'Encrypted private key is required')
});

// User login validation schema
export const loginSchema = z.object({
  email: z.string()
    .email('Invalid email format')
    .refine(email => email.endsWith('@odyssie.net'), 'Email must be an @odyssie.net address'),
  password: z.string().min(1, 'Password is required')
});

// Password change validation schema
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
      'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  newEncryptedPrivateKey: z.string().min(1, 'New encrypted private key is required')
});

// User profile update validation schema
export const updateProfileSchema = z.object({
  preferences: z.object({
    theme: z.enum(['light', 'dark', 'auto']).optional(),
    language: z.string().optional(),
    emailNotifications: z.boolean().optional(),
    twoFactorEnabled: z.boolean().optional()
  }).optional()
}).partial();

// Email sending validation schema
export const sendEmailSchema = z.object({
  recipientEmails: z.array(z.string().email('Invalid email format'))
    .min(1, 'At least one recipient is required')
    .max(50, 'Maximum 50 recipients allowed'),
  encryptedSubject: z.string().min(1, 'Subject is required'),
  encryptedContent: z.string().min(1, 'Content is required'),
  encryptedAttachments: z.array(z.object({
    id: z.string(),
    filename: z.string(),
    encryptedContent: z.string(),
    size: z.number().min(0),
    mimeType: z.string(),
    encryptionKey: z.string()
  })).default([]),
  senderSignature: z.string().min(1, 'Sender signature is required'),
  recipientKeys: z.record(z.string(), z.string()),
  size: z.number().min(0, 'Size must be non-negative')
});

// Pagination validation schema
export const paginationSchema = z.object({
  page: z.string().optional().transform(val => val ? parseInt(val) : 1),
  limit: z.string().optional().transform(val => val ? Math.min(parseInt(val) || 20, 100) : 20),
  folder: z.string().optional().default('inbox')
});

// Email ID validation schema
export const emailIdSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid email ID format')
});

export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type ChangePasswordRequest = z.infer<typeof changePasswordSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileSchema>;
export type SendEmailRequest = z.infer<typeof sendEmailSchema>;

// Validation middleware functions
export const validateSendEmail = (req: Request, res: Response, next: NextFunction) => {
  try {
    req.body = sendEmailSchema.parse(req.body);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          message: 'Validation failed',
          details: error.errors
        }
      });
    }
    next(error);
  }
};

export const validatePagination = (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = paginationSchema.parse(req.query);
    req.query = parsed as any;
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          message: 'Invalid pagination parameters',
          details: error.errors
        }
      });
    }
    next(error);
  }
};

export const validateEmailId = (req: Request, res: Response, next: NextFunction) => {
  try {
    req.params = emailIdSchema.parse(req.params);
    next();
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          message: 'Invalid email ID',
          details: error.errors
        }
      });
    }
    next(error);
  }
};