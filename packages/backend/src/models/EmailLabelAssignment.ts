import mongoose, { Document, Schema } from 'mongoose';

export interface IEmailLabelAssignment extends Document {
  emailId: string;
  labelId: string;
  createdAt: Date;
}

const emailLabelAssignmentSchema = new Schema<IEmailLabelAssignment>({
  emailId: {
    type: String,
    required: true,
    ref: 'EmailMetadata'
  },
  labelId: {
    type: String,
    required: true,
    ref: 'EmailLabel'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
emailLabelAssignmentSchema.index({ emailId: 1, labelId: 1 }, { unique: true });
emailLabelAssignmentSchema.index({ labelId: 1 });

export const EmailLabelAssignment = mongoose.model<IEmailLabelAssignment>('EmailLabelAssignment', emailLabelAssignmentSchema);