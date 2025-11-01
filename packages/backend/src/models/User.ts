import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  publicKey: string;
  encryptedPrivateKey: string;
  storageQuota: number;
  storageUsed: number;
  subscriptionPlan: 'free' | 'basic' | 'standard' | 'premium' | 'pro';
  preferences: {
    theme: 'light' | 'dark' | 'auto';
    language: string;
    emailNotifications: boolean;
    twoFactorEnabled: boolean;
  };
  createdAt: Date;
  lastLoginAt?: Date;
}

const userSchema = new Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    match: [/^[^\s@]+@odyssie\.net$/, 'Email must be a valid @odyssie.net address']
  },
  passwordHash: {
    type: String,
    required: true,
    minlength: 60 // bcrypt hash length
  },
  publicKey: {
    type: String,
    required: true
  },
  encryptedPrivateKey: {
    type: String,
    required: true
  },
  storageQuota: {
    type: Number,
    required: true,
    default: 5 * 1024 * 1024 * 1024 // 5GB in bytes
  },
  storageUsed: {
    type: Number,
    required: true,
    default: 0
  },
  subscriptionPlan: {
    type: String,
    enum: ['free', 'basic', 'standard', 'premium', 'pro'],
    default: 'free'
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'auto'
    },
    language: {
      type: String,
      default: 'en'
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastLoginAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Index for efficient email lookups
userSchema.index({ email: 1 });

export const User = mongoose.model<IUser>('User', userSchema);