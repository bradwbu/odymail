import mongoose, { Document, Schema } from 'mongoose';

export interface IFileShare extends Document {
  id: string;
  fileId: string;
  userId: string;
  shareId: string;
  expiresAt?: Date;
  downloadLimit?: number;
  downloadCount: number;
  password?: string; // Hashed password for protected shares
  createdAt: Date;
  lastAccessedAt?: Date;
  isActive: boolean;
}

const fileShareSchema = new Schema<IFileShare>({
  fileId: {
    type: String,
    required: true,
    ref: 'File'
  },
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  shareId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  expiresAt: {
    type: Date,
    index: true
  },
  downloadLimit: {
    type: Number,
    min: 1
  },
  downloadCount: {
    type: Number,
    default: 0,
    min: 0
  },
  password: {
    type: String // Hashed with bcrypt if provided
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastAccessedAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
fileShareSchema.index({ shareId: 1, isActive: 1 });
fileShareSchema.index({ fileId: 1 });
fileShareSchema.index({ userId: 1 });
fileShareSchema.index({ expiresAt: 1 });

// Method to check if share is valid
fileShareSchema.methods.isValid = function(): boolean {
  if (!this.isActive) return false;
  if (this.expiresAt && this.expiresAt < new Date()) return false;
  if (this.downloadLimit && this.downloadCount >= this.downloadLimit) return false;
  return true;
};

export const FileShare = mongoose.model<IFileShare>('FileShare', fileShareSchema);