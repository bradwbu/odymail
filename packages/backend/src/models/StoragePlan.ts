import mongoose, { Document, Schema } from 'mongoose';

export interface IStoragePlan extends Document {
  id: string;
  name: string;
  displayName: string;
  storageLimit: number; // in bytes
  price: number; // in cents
  currency: string;
  billingInterval: 'month' | 'year';
  features: string[];
  isActive: boolean;
  stripePriceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const storagePlanSchema = new Schema<IStoragePlan>({
  id: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true,
    unique: true
  },
  displayName: {
    type: String,
    required: true
  },
  storageLimit: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    required: true,
    default: 'usd'
  },
  billingInterval: {
    type: String,
    enum: ['month', 'year'],
    required: true
  },
  features: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  stripePriceId: {
    type: String,
    sparse: true
  }
}, {
  timestamps: true
});

storagePlanSchema.index({ name: 1 });
storagePlanSchema.index({ isActive: 1 });

export const StoragePlan = mongoose.model<IStoragePlan>('StoragePlan', storagePlanSchema);