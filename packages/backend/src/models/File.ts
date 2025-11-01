import mongoose, { Document, Schema } from 'mongoose';

export interface IFile extends Document {
  id: string;
  userId: string;
  filename: string;
  originalName: string;
  encryptedFilename: string;
  size: number;
  mimeType: string;
  encryptionKey: string; // AES key encrypted with user's key
  iv: string; // Base64 encoded IV
  storageLocation: string; // Path to encrypted file on disk/cloud
  hash: string; // SHA-256 hash for deduplication
  folderId?: string;
  tags: string[];
  isShared: boolean;
  shareId?: string;
  uploadedAt: Date;
  modifiedAt: Date;
  accessedAt?: Date;
  isDeleted: boolean;
  deletedAt?: Date;
}

const fileSchema = new Schema<IFile>({
  userId: {
    type: String,
    required: true,
    ref: 'User'
  },
  filename: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  encryptedFilename: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true,
    min: 0
  },
  mimeType: {
    type: String,
    required: true
  },
  encryptionKey: {
    type: String,
    required: true
  },
  iv: {
    type: String,
    required: true
  },
  storageLocation: {
    type: String,
    required: true
  },
  hash: {
    type: String,
    required: true,
    index: true // For deduplication
  },
  folderId: {
    type: String,
    ref: 'FileFolder'
  },
  tags: [{
    type: String,
    trim: true
  }],
  isShared: {
    type: Boolean,
    default: false
  },
  shareId: {
    type: String,
    unique: true,
    sparse: true // Only create index for non-null values
  },
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  modifiedAt: {
    type: Date,
    default: Date.now
  },
  accessedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
fileSchema.index({ userId: 1, isDeleted: 1 });
fileSchema.index({ userId: 1, folderId: 1, isDeleted: 1 });
fileSchema.index({ shareId: 1 });
fileSchema.index({ hash: 1 }); // For deduplication
fileSchema.index({ uploadedAt: -1 });
fileSchema.index({ tags: 1 });

// Virtual for file metadata
fileSchema.virtual('metadata').get(function() {
  return {
    id: this._id,
    userId: this.userId,
    filename: this.filename,
    originalName: this.originalName,
    size: this.size,
    mimeType: this.mimeType,
    uploadedAt: this.uploadedAt,
    modifiedAt: this.modifiedAt,
    folderId: this.folderId,
    tags: this.tags,
    isShared: this.isShared,
    shareId: this.shareId
  };
});

export const File = mongoose.model<IFile>('File', fileSchema);