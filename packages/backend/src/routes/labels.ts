import express from 'express';
import { LabelService } from '../services/labelService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All label routes require authentication
router.use(authenticateToken);

/**
 * Get all labels for user
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const labels = await LabelService.getLabels(userId);
    
    res.json({
      success: true,
      labels
    });
  } catch (error) {
    console.error('Get labels error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to get labels'
      }
    });
  }
});

/**
 * Create new label
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { name, color } = req.body;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: {
          message: 'Label name is required'
        }
      });
    }
    
    if (!color || typeof color !== 'string') {
      return res.status(400).json({
        error: {
          message: 'Label color is required'
        }
      });
    }
    
    const label = await LabelService.createLabel(userId, { name, color });
    
    res.status(201).json({
      success: true,
      label
    });
  } catch (error) {
    console.error('Create label error:', error);
    res.status(400).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to create label'
      }
    });
  }
});

/**
 * Update label
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const labelId = req.params.id;
    const updates = req.body;
    
    const label = await LabelService.updateLabel(labelId, userId, updates);
    
    res.json({
      success: true,
      label
    });
  } catch (error) {
    console.error('Update label error:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 
                   error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
    
    res.status(status).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to update label'
      }
    });
  }
});

/**
 * Delete label
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const labelId = req.params.id;
    
    await LabelService.deleteLabel(labelId, userId);
    
    res.json({
      success: true,
      message: 'Label deleted successfully'
    });
  } catch (error) {
    console.error('Delete label error:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 
                   error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
    
    res.status(status).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to delete label'
      }
    });
  }
});

export default router;