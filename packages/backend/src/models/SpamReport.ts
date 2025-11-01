import mongoose, { Document, Schema } from 'mongoose';

export interface ISpamReport extends Document {
  userId: string;
  emailId?: string;
  senderEmail: string;
  action: 'block' | 'spam' | 'quarantine';
  reason: string;
  createdAt: Date;
}

const spamReportSchema = new Schema<ISpamReport>({
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  emailId: {
    type: String,
    ref: 'EmailMetadata'
  },
  senderEmail: {
    type: String,
    required: true
  },
  action: {
    type: String,
    enum: ['block', 'spam', 'quarantine'],
    required: true
  },
  reason: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
spamReportSchema.index({ userId: 1, createdAt: -1 });
spamReportSchema.index({ userId: 1, senderEmail: 1 });
spamReportSchema.index({ userId: 1, action: 1, createdAt: -1 });

export const SpamReport = mongoose.model<ISpamReport>('SpamReport', spamReportSchema);