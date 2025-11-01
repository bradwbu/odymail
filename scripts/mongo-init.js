// MongoDB initialization script for production
// This script creates the application database and user with appropriate permissions

// Switch to the encrypted-email database
db = db.getSiblingDB('encrypted-email');

// Create application user with read/write permissions
db.createUser({
  user: process.env.MONGO_USERNAME || 'app_user',
  pwd: process.env.MONGO_PASSWORD || 'app_password',
  roles: [
    {
      role: 'readWrite',
      db: 'encrypted-email'
    }
  ]
});

// Create collections with validation schemas
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'passwordHash', 'createdAt'],
      properties: {
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
          description: 'must be a valid email address'
        },
        passwordHash: {
          bsonType: 'string',
          minLength: 60,
          description: 'must be a bcrypt hash'
        },
        publicKey: {
          bsonType: 'string',
          description: 'RSA public key for encryption'
        },
        encryptedPrivateKey: {
          bsonType: 'string',
          description: 'Encrypted RSA private key'
        },
        storageUsed: {
          bsonType: 'number',
          minimum: 0,
          description: 'Storage used in bytes'
        },
        storageLimit: {
          bsonType: 'number',
          minimum: 0,
          description: 'Storage limit in bytes'
        },
        subscriptionTier: {
          bsonType: 'string',
          enum: ['free', 'pro', 'business'],
          description: 'Subscription tier'
        },
        isActive: {
          bsonType: 'bool',
          description: 'Account active status'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Account creation date'
        },
        updatedAt: {
          bsonType: 'date',
          description: 'Last update date'
        }
      }
    }
  }
});

db.createCollection('emails', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['from', 'to', 'encryptedContent', 'createdAt'],
      properties: {
        from: {
          bsonType: 'string',
          description: 'Sender email address'
        },
        to: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'Recipient email addresses'
        },
        cc: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'CC email addresses'
        },
        bcc: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'BCC email addresses'
        },
        subject: {
          bsonType: 'string',
          description: 'Email subject (encrypted)'
        },
        encryptedContent: {
          bsonType: 'string',
          description: 'Encrypted email content'
        },
        attachments: {
          bsonType: 'array',
          items: {
            bsonType: 'object',
            properties: {
              filename: { bsonType: 'string' },
              size: { bsonType: 'number' },
              encryptedData: { bsonType: 'string' }
            }
          },
          description: 'Email attachments'
        },
        isRead: {
          bsonType: 'bool',
          description: 'Read status'
        },
        isStarred: {
          bsonType: 'bool',
          description: 'Starred status'
        },
        folder: {
          bsonType: 'string',
          description: 'Email folder'
        },
        labels: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'Email labels'
        },
        createdAt: {
          bsonType: 'date',
          description: 'Email creation date'
        }
      }
    }
  }
});

db.createCollection('files', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'filename', 'encryptedData', 'size', 'createdAt'],
      properties: {
        userId: {
          bsonType: 'objectId',
          description: 'File owner user ID'
        },
        filename: {
          bsonType: 'string',
          description: 'Original filename'
        },
        encryptedData: {
          bsonType: 'string',
          description: 'Encrypted file data'
        },
        size: {
          bsonType: 'number',
          minimum: 0,
          description: 'File size in bytes'
        },
        mimeType: {
          bsonType: 'string',
          description: 'File MIME type'
        },
        isShared: {
          bsonType: 'bool',
          description: 'File sharing status'
        },
        sharedWith: {
          bsonType: 'array',
          items: {
            bsonType: 'string'
          },
          description: 'Users file is shared with'
        },
        createdAt: {
          bsonType: 'date',
          description: 'File upload date'
        }
      }
    }
  }
});

// Create indexes for performance
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ createdAt: 1 });
db.users.createIndex({ subscriptionTier: 1 });

db.emails.createIndex({ from: 1 });
db.emails.createIndex({ to: 1 });
db.emails.createIndex({ createdAt: -1 });
db.emails.createIndex({ folder: 1 });
db.emails.createIndex({ labels: 1 });
db.emails.createIndex({ isRead: 1 });

db.files.createIndex({ userId: 1 });
db.files.createIndex({ createdAt: -1 });
db.files.createIndex({ isShared: 1 });
db.files.createIndex({ filename: 'text' });

// Create compound indexes for common queries
db.emails.createIndex({ from: 1, createdAt: -1 });
db.emails.createIndex({ to: 1, createdAt: -1 });
db.files.createIndex({ userId: 1, createdAt: -1 });

print('Database initialization completed successfully');
print('Created collections: users, emails, files');
print('Created indexes for optimal performance');
print('Application user created with readWrite permissions');