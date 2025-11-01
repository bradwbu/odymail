import express from 'express';
import { FolderService } from '../services/folderService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All folder routes require authentication
router.use(authenticateToken);

/**
 * Get all folders for user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const folders = await FolderService.getFolders(userId);
    
    res.json({
      success: true,
      folders
    });
  } catch (error) {
    console.error('Get folders error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to get folders'
      }
    });
  }
});

/**
 * Create new folder
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { name, color, icon, parentId } = req.body;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: {
          message: 'Folder name is required'
        }
      });
    }
    
    const folder = await FolderService.createFolder(userId, {
      name,
      color,
      icon,
      parentId
    });
    
    res.status(201).json({
      success: true,
      folder
    });
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(400).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to create folder'
      }
    });
  }
});

/**
 * Update folder
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const folderId = req.params.id;
    const updates = req.body;
    
    const folder = await FolderService.updateFolder(folderId, userId, updates);
    
    res.json({
      success: true,
      folder
    });
  } catch (error) {
    console.error('Update folder error:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 
                   error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
    
    res.status(status).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to update folder'
      }
    });
  }
});

/**
 * Delete folder
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const folderId = req.params.id;
    const { moveToFolder } = req.query;
    
    await FolderService.deleteFolder(folderId, userId, moveToFolder as string);
    
    res.json({
      success: true,
      message: 'Folder deleted successfully'
    });
  } catch (error) {
    console.error('Delete folder error:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 
                   error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
    
    res.status(status).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to delete folder'
      }
    });
  }
});

/**
 * Get folder statistics
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const folderId = req.params.id;
    
    const stats = await FolderService.getFolderStats(folderId, userId);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get folder stats error:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 
                   error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
    
    res.status(status).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to get folder stats'
      }
    });
  }
});

export default router;