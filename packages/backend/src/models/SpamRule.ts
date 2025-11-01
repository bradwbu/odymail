import mongoose, { Document, Schema } from 'mongoose';

export interface ISpamRule extends Document {
  userId: string;
  type: 'sender' | 'subject' | 'content' | 'attachment';
  pattern: string;
  action: 'block' | 'spam' | 'quarantine';
  isRegex: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const spamRuleSchema = new Schema<ISpamRule>({
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  type: {
    type: String,
    enum: ['sender', 'subject', 'content', 'attachment'],
    required: true
  },
  pattern: {
    type: String,
    required: true
  },
  action: {
    type: String,
    enum: ['block', 'spam', 'quarantine'],
    required: true
  },
  isRegex: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
spamRuleSchema.index({ userId: 1, isActive: 1 });
spamRuleSchema.index({ userId: 1, type: 1 });

export const SpamRule = mongoose.model<ISpamRule>('SpamRule', spamRuleSchema);