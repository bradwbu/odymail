import { EmailFolder } from '../models/EmailFolder.js';
import { EmailMetadata } from '../models/Email.js';

export interface CreateFolderData {
  name: string;
  color?: string;
  icon?: string;
  parentId?: string;
}

export interface FolderStats {
  totalEmails: number;
  unreadEmails: number;
  storageUsed: number;
}

export class FolderService {
  /**
   * Get all folders for a user
   */
  static async getFolders(userId: string): Promise<any[]> {
    const folders = await EmailFolder.find({ userId })
      .sort({ order: 1, name: 1 });

    // Get email counts for each folder
    const folderStats = await EmailMetadata.aggregate([
      {
        $match: {
          recipientIds: userId
        }
      },
      {
        $group: {
          _id: '$folderId',
          emailCount: { $sum: 1 },
          unreadCount: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } }
        }
      }
    ]);

    const statsMap = new Map(
      folderStats.map((stat: any) => [stat._id, { emailCount: stat.emailCount, unreadCount: stat.unreadCount }])
    );

    return folders.map((folder: any) => ({
      id: folder._id.toString(),
      name: folder.name,
      type: folder.type,
      color: folder.color,
      icon: folder.icon,
      emailCount: statsMap.get(folder._id.toString())?.emailCount || 0,
      unreadCount: statsMap.get(folder._id.toString())?.unreadCount || 0,
      parentId: folder.parentId,
      order: folder.order
    }));
  }

  /**
   * Create a new folder
   */
  static async createFolder(userId: string, folderData: CreateFolderData): Promise<any> {
    // Check if folder name already exists for this user
    const existingFolder = await EmailFolder.findOne({
      userId,
      name: folderData.name
    });

    if (existingFolder) {
      throw new Error('Folder with this name already exists');
    }

    // Get the next order number
    const lastFolder = await EmailFolder.findOne({ userId })
      .sort({ order: -1 });
    
    const order = lastFolder ? lastFolder.order + 1 : 1;

    const folder = new EmailFolder({
      userId,
      name: folderData.name,
      type: 'custom',
      color: folderData.color,
      icon: folderData.icon,
      parentId: folderData.parentId,
      order
    });

    await folder.save();

    return {
      id: folder._id.toString(),
      name: folder.name,
      type: folder.type,
      color: folder.color,
      icon: folder.icon,
      emailCount: 0,
      unreadCount: 0,
      parentId: folder.parentId,
      order: folder.order
    };
  }

  /**
   * Update a folder
   */
  static async updateFolder(folderId: string, userId: string, updates: any): Promise<any> {
    const folder = await EmailFolder.findOne({ _id: folderId, userId });
    if (!folder) {
      throw new Error('Folder not found');
    }

    // Don't allow updating system folders
    if (folder.type === 'system') {
      throw new Error('Cannot modify system folders');
    }

    // Check for name conflicts if name is being updated
    if (updates.name && updates.name !== folder.name) {
      const existingFolder = await EmailFolder.findOne({
        userId,
        name: updates.name,
        _id: { $ne: folderId }
      });

      if (existingFolder) {
        throw new Error('Folder with this name already exists');
      }
    }

    Object.assign(folder, updates);
    await folder.save();

    return {
      id: folder._id.toString(),
      name: folder.name,
      type: folder.type,
      color: folder.color,
      icon: folder.icon,
      emailCount: 0, // Would need to recalculate
      unreadCount: 0, // Would need to recalculate
      parentId: folder.parentId,
      order: folder.order
    };
  }

  /**
   * Delete a folder
   */
  static async deleteFolder(folderId: string, userId: string, moveToFolderId?: string): Promise<void> {
    const folder = await EmailFolder.findOne({ _id: folderId, userId });
    if (!folder) {
      throw new Error('Folder not found');
    }

    // Don't allow deleting system folders
    if (folder.type === 'system') {
      throw new Error('Cannot delete system folders');
    }

    // Move emails to another folder or inbox
    const targetFolderId = moveToFolderId || 'inbox';
    
    await EmailMetadata.updateMany(
      {
        recipientIds: userId,
        folderId: folderId
      },
      {
        $set: { folderId: targetFolderId }
      }
    );

    // Delete the folder
    await EmailFolder.findByIdAndDelete(folderId);
  }

  /**
   * Get folder statistics
   */
  static async getFolderStats(folderId: string, userId: string): Promise<FolderStats> {
    const stats = await EmailMetadata.aggregate([
      {
        $match: {
          recipientIds: userId,
          folderId: folderId
        }
      },
      {
        $group: {
          _id: null,
          totalEmails: { $sum: 1 },
          unreadEmails: { $sum: { $cond: [{ $eq: ['$isRead', false] }, 1, 0] } },
          storageUsed: { $sum: '$size' }
        }
      }
    ]);

    if (stats.length === 0) {
      return {
        totalEmails: 0,
        unreadEmails: 0,
        storageUsed: 0
      };
    }

    return {
      totalEmails: stats[0].totalEmails,
      unreadEmails: stats[0].unreadEmails,
      storageUsed: stats[0].storageUsed
    };
  }

  /**
   * Initialize system folders for a user
   */
  static async initializeSystemFolders(userId: string): Promise<void> {
    const systemFolders = [
      { name: 'Inbox', id: 'inbox', icon: 'inbox', order: 1 },
      { name: 'Sent', id: 'sent', icon: 'send', order: 2 },
      { name: 'Drafts', id: 'drafts', icon: 'draft', order: 3 },
      { name: 'Archive', id: 'archive', icon: 'archive', order: 4 },
      { name: 'Spam', id: 'spam', icon: 'warning', order: 5 },
      { name: 'Trash', id: 'trash', icon: 'trash', order: 6 }
    ];

    for (const folderData of systemFolders) {
      const existingFolder = await EmailFolder.findOne({
        userId,
        name: folderData.name,
        type: 'system'
      });

      if (!existingFolder) {
        const folder = new EmailFolder({
          userId,
          name: folderData.name,
          type: 'system',
          icon: folderData.icon,
          order: folderData.order
        });

        await folder.save();
      }
    }
  }
}