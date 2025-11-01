import { User, IUser } from '../models/User.js';
import { hashPassword, comparePassword, generateToken, generateRefreshToken, generateEmail, JWTPayload, verifyToken } from '../utils/auth.js';
import { RegisterRequest, LoginRequest, ChangePasswordRequest } from '../utils/validation.js';

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    storageQuota: number;
    storageUsed: number;
    subscriptionPlan: string;
    preferences: {
      theme: string;
      language: string;
      emailNotifications: boolean;
      twoFactorEnabled: boolean;
    };
    createdAt: Date;
  };
  token: string;
  refreshToken: string;
}

export class AuthService {
  /**
   * Register a new user
   */
  static async register(data: RegisterRequest): Promise<AuthResponse> {
    const { username, password, publicKey, encryptedPrivateKey } = data;
    
    // Generate @odyssie.net email address
    const email = generateEmail(username);
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new Error('User with this email already exists');
    }
    
    // Hash password
    const passwordHash = await hashPassword(password);
    
    // Create user
    const user = new User({
      email,
      passwordHash,
      publicKey,
      encryptedPrivateKey,
      storageQuota: 5 * 1024 * 1024 * 1024, // 5GB
      storageUsed: 0,
      subscriptionPlan: 'free'
    });
    
    await user.save();
    
    // Generate JWT tokens
    const payload = {
      userId: user._id.toString(),
      email: user.email
    };
    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);
    
    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        storageQuota: user.storageQuota,
        storageUsed: user.storageUsed,
        subscriptionPlan: user.subscriptionPlan,
        preferences: user.preferences || {
          theme: 'auto',
          language: 'en',
          emailNotifications: true,
          twoFactorEnabled: false
        },
        createdAt: user.createdAt
      },
      token,
      refreshToken
    };
  }
  
  /**
   * Login user
   */
  static async login(data: LoginRequest): Promise<AuthResponse> {
    const { email, password } = data;
    
    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error('Invalid email or password');
    }
    
    // Verify password
    const isValidPassword = await comparePassword(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }
    
    // Update last login
    user.lastLoginAt = new Date();
    await user.save();
    
    // Generate JWT tokens
    const payload = {
      userId: user._id.toString(),
      email: user.email
    };
    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);
    
    return {
      user: {
        id: user._id.toString(),
        email: user.email,
        storageQuota: user.storageQuota,
        storageUsed: user.storageUsed,
        subscriptionPlan: user.subscriptionPlan,
        preferences: user.preferences || {
          theme: 'auto',
          language: 'en',
          emailNotifications: true,
          twoFactorEnabled: false
        },
        createdAt: user.createdAt
      },
      token,
      refreshToken
    };
  }
  
  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<{ token: string; refreshToken: string }> {
    try {
      // Verify refresh token
      const decoded = verifyToken(refreshToken);
      
      // Find user to ensure they still exist
      const user = await User.findById(decoded.userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      // Generate new tokens
      const payload = {
        userId: user._id.toString(),
        email: user.email
      };
      const newToken = generateToken(payload);
      const newRefreshToken = generateRefreshToken(payload);
      
      return {
        token: newToken,
        refreshToken: newRefreshToken
      };
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }
  
  /**
   * Change user password
   */
  static async changePassword(userId: string, data: ChangePasswordRequest): Promise<void> {
    const { currentPassword, newPassword, newEncryptedPrivateKey } = data;
    
    // Find user
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Verify current password
    const isValidPassword = await comparePassword(currentPassword, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Current password is incorrect');
    }
    
    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);
    
    // Update user
    user.passwordHash = newPasswordHash;
    user.encryptedPrivateKey = newEncryptedPrivateKey;
    await user.save();
  }
  
  /**
   * Get user profile
   */
  static async getProfile(userId: string): Promise<AuthResponse['user']> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    return {
      id: user._id.toString(),
      email: user.email,
      storageQuota: user.storageQuota,
      storageUsed: user.storageUsed,
      subscriptionPlan: user.subscriptionPlan,
      preferences: user.preferences || {
        theme: 'auto',
        language: 'en',
        emailNotifications: true,
        twoFactorEnabled: false
      },
      createdAt: user.createdAt
    };
  }

  /**
   * Update user profile
   */
  static async updateProfile(userId: string, updates: any): Promise<AuthResponse['user']> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Update preferences if provided
    if (updates.preferences) {
      user.preferences = { ...user.preferences, ...updates.preferences };
    }

    await user.save();

    return {
      id: user._id.toString(),
      email: user.email,
      storageQuota: user.storageQuota,
      storageUsed: user.storageUsed,
      subscriptionPlan: user.subscriptionPlan,
      preferences: user.preferences,
      createdAt: user.createdAt
    };
  }
  
  /**
   * Export user data for GDPR compliance
   */
  static async exportUserData(userId: string): Promise<any> {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    // Return user data (excluding sensitive information like password hash)
    return {
      id: user._id.toString(),
      email: user.email,
      publicKey: user.publicKey,
      storageQuota: user.storageQuota,
      storageUsed: user.storageUsed,
      subscriptionPlan: user.subscriptionPlan,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      exportedAt: new Date().toISOString()
    };
  }
}