/**
 * Storage API routes for file upload, download, and management
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import { FileStorageService } from '../services/fileStorageService';
import { StorageQuotaService } from '../services/storageQuotaService';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 1
  }
});

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Upload a file directly (for smaller files)
 */
router.post('/upload', upload.single('encryptedContent'), async (req: Request, res: Response) => {
  try {
    const { fileId, encryptedFilename, encryptionKey, iv, metadata } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const parsedMetadata = JSON.parse(metadata);

    const uploadData = {
      fileId,
      userId,
      filename: parsedMetadata.filename,
      originalName: parsedMetadata.originalName,
      encryptedFilename,
      size: parsedMetadata.size,
      mimeType: parsedMetadata.mimeType,
      encryptionKey,
      iv,
      encryptedContent: req.file.buffer,
      folderId: parsedMetadata.folderId,
      tags: parsedMetadata.tags
    };

    const file = await FileStorageService.uploadFile(uploadData);

    res.json({
      success: true,
      fileId: file._id,
      metadata: file.metadata
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Upload failed' 
    });
  }
});

/**
 * Initialize chunked upload
 */
router.post('/upload/init', async (req: Request, res: Response) => {
  try {
    const { fileId, totalChunks, encryptionKey, metadata } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const initData = {
      fileId,
      userId,
      totalChunks,
      encryptionKey,
      metadata
    };

    await FileStorageService.initializeChunkedUpload(initData);

    res.json({ success: true, fileId });
  } catch (error) {
    console.error('Chunked upload init error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Initialization failed' 
    });
  }
});

/**
 * Upload a file chunk
 */
router.post('/upload/chunk', upload.single('encryptedData'), async (req: Request, res: Response) => {
  try {
    const { fileId, chunkId, chunkIndex, totalChunks } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No chunk data uploaded' });
    }

    const chunkData = {
      chunkId,
      fileId,
      userId,
      chunkIndex: parseInt(chunkIndex),
      totalChunks: parseInt(totalChunks),
      encryptedData: req.file.buffer
    };

    await FileStorageService.uploadChunk(chunkData);

    res.json({ success: true, chunkId });
  } catch (error) {
    console.error('Chunk upload error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Chunk upload failed' 
    });
  }
});

/**
 * Finalize chunked upload
 */
router.post('/upload/finalize', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const file = await FileStorageService.finalizeChunkedUpload(fileId, userId);

    res.json({
      success: true,
      fileId: file._id,
      metadata: file.metadata
    });
  } catch (error) {
    console.error('Finalize upload error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Finalization failed' 
    });
  }
});

/**
 * Get user files
 */
router.get('/files', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const options = {
      folderId: req.query.folderId as string,
      tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset as string) : undefined,
      sortBy: req.query.sortBy as string,
      sortOrder: req.query.sortOrder as 'asc' | 'desc'
    };

    const result = await FileStorageService.getUserFiles(userId, options);

    res.json({
      files: result.files.map(file => file.metadata),
      total: result.total,
      limit: options.limit || 50,
      offset: options.offset || 0
    });
  } catch (error) {
    console.error('Get files error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get files' 
    });
  }
});

/**
 * Download a file
 */
router.get('/download/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { content, metadata } = await FileStorageService.downloadFile(fileId, userId);

    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${metadata.originalName}"`,
      'Content-Length': content.length.toString(),
      'X-File-Metadata': JSON.stringify({
        id: metadata._id,
        filename: metadata.filename,
        size: metadata.size,
        mimeType: metadata.mimeType,
        encryptionKey: metadata.encryptionKey,
        iv: metadata.iv
      })
    });

    res.send(content);
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Download failed' 
    });
  }
});

/**
 * Delete a file
 */
router.delete('/:fileId', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    await FileStorageService.deleteFile(fileId, userId);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Delete failed' 
    });
  }
});

/**
 * Get storage quota
 */
router.get('/quota', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const quota = await FileStorageService.getStorageQuota(userId);

    res.json(quota);
  } catch (error) {
    console.error('Get quota error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get quota' 
    });
  }
});

/**
 * Create file share
 */
router.post('/:fileId/share', async (req: Request, res: Response) => {
  try {
    const { fileId } = req.params;
    const { expiresAt, downloadLimit, password } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const shareSettings = {
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      downloadLimit,
      password
    };

    const fileShare = await FileStorageService.createFileShare(fileId, userId, shareSettings);

    res.json({
      success: true,
      shareId: fileShare.shareId,
      shareUrl: `${req.protocol}://${req.get('host')}/api/storage/shared/${fileShare.shareId}`
    });
  } catch (error) {
    console.error('Create share error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to create share' 
    });
  }
});

/**
 * Get storage analytics
 */
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const analytics = await StorageQuotaService.getStorageAnalytics(userId);

    res.json(analytics);
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get analytics' 
    });
  }
});

/**
 * Get cleanup suggestions
 */
router.get('/cleanup-suggestions', async (req: Request, res: Response) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const suggestions = await StorageQuotaService.getCleanupSuggestions(userId);

    res.json({ suggestions });
  } catch (error) {
    console.error('Get cleanup suggestions error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get cleanup suggestions' 
    });
  }
});

/**
 * Upgrade storage plan
 */
router.post('/upgrade-plan', async (req: Request, res: Response) => {
  try {
    const { plan } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!['basic', 'standard', 'premium', 'pro'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid storage plan' });
    }

    const result = await StorageQuotaService.upgradeStoragePlan(userId, plan);

    res.json(result);
  } catch (error) {
    console.error('Upgrade plan error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to upgrade plan' 
    });
  }
});

export default router;