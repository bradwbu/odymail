import mongoose, { Document, Schema } from 'mongoose';

export interface IEmailLabel extends Document {
  userId: string;
  name: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

const emailLabelSchema = new Schema<IEmailLabel>({
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  name: {
    type: String,
    required: true
  },
  color: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
emailLabelSchema.index({ userId: 1, name: 1 }, { unique: true });

export const EmailLabel = mongoose.model<IEmailLabel>('EmailLabel', emailLabelSchema);