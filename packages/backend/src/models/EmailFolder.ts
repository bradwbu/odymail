import mongoose, { Document, Schema } from 'mongoose';

export interface IEmailFolder extends Document {
  userId: string;
  name: string;
  type: 'system' | 'custom';
  color?: string;
  icon?: string;
  parentId?: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const emailFolderSchema = new Schema<IEmailFolder>({
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['system', 'custom'],
    required: true
  },
  color: {
    type: String
  },
  icon: {
    type: String
  },
  parentId: {
    type: String,
    ref: 'EmailFolder'
  },
  order: {
    type: Number,
    required: true,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
emailFolderSchema.index({ userId: 1, name: 1 }, { unique: true });
emailFolderSchema.index({ userId: 1, order: 1 });

export const EmailFolder = mongoose.model<IEmailFolder>('EmailFolder', emailFolderSchema);