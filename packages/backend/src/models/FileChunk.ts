import mongoose, { Document, Schema } from 'mongoose';

export interface IFileChunk extends Document {
  chunkId: string;
  fileId: string;
  userId: string;
  chunkIndex: number;
  totalChunks: number;
  size: number;
  storageLocation: string;
  uploadedAt: Date;
  expiresAt: Date; // Cleanup incomplete uploads
}

const fileChunkSchema = new Schema<IFileChunk>({
  chunkId: {
    type: String,
    required: true,
    unique: true
  },
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
  chunkIndex: {
    type: Number,
    required: true,
    min: 0
  },
  totalChunks: {
    type: Number,
    required: true,
    min: 1
  },
  size: {
    type: Number,
    required: true,
    min: 0
  },
  storageLocation: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    index: { expireAfterSeconds: 0 } // MongoDB TTL index
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
fileChunkSchema.index({ fileId: 1, chunkIndex: 1 });
fileChunkSchema.index({ userId: 1 });
fileChunkSchema.index({ expiresAt: 1 }); // TTL index

export const FileChunk = mongoose.model<IFileChunk>('FileChunk', fileChunkSchema);