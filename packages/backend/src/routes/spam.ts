import express from 'express';
import { SpamService } from '../services/spamService.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// All spam routes require authentication
router.use(authenticateToken);

/**
 * Get spam rules for user
 */
router.get('/rules', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const rules = await SpamService.getSpamRules(userId);
    
    res.json({
      success: true,
      rules
    });
  } catch (error) {
    console.error('Get spam rules error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to get spam rules'
      }
    });
  }
});

/**
 * Create spam rule
 */
router.post('/rules', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const ruleData = req.body;
    
    const rule = await SpamService.createSpamRule(userId, ruleData);
    
    res.status(201).json({
      success: true,
      rule
    });
  } catch (error) {
    console.error('Create spam rule error:', error);
    res.status(400).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to create spam rule'
      }
    });
  }
});

/**
 * Update spam rule
 */
router.put('/rules/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const ruleId = req.params.id;
    const updates = req.body;
    
    const rule = await SpamService.updateSpamRule(ruleId, userId, updates);
    
    res.json({
      success: true,
      rule
    });
  } catch (error) {
    console.error('Update spam rule error:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 
                   error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
    
    res.status(status).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to update spam rule'
      }
    });
  }
});

/**
 * Delete spam rule
 */
router.delete('/rules/:id', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const ruleId = req.params.id;
    
    await SpamService.deleteSpamRule(ruleId, userId);
    
    res.json({
      success: true,
      message: 'Spam rule deleted successfully'
    });
  } catch (error) {
    console.error('Delete spam rule error:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 
                   error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
    
    res.status(status).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to delete spam rule'
      }
    });
  }
});

/**
 * Get spam statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const stats = await SpamService.getSpamStats(userId);
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get spam stats error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to get spam stats'
      }
    });
  }
});

/**
 * Report email as spam
 */
router.post('/report', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { emailId } = req.body;
    
    if (!emailId) {
      return res.status(400).json({
        error: {
          message: 'Email ID is required'
        }
      });
    }
    
    await SpamService.reportSpam(emailId, userId);
    
    res.json({
      success: true,
      message: 'Email reported as spam'
    });
  } catch (error) {
    console.error('Report spam error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to report spam'
      }
    });
  }
});

/**
 * Mark email as not spam
 */
router.post('/not-spam', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { emailId } = req.body;
    
    if (!emailId) {
      return res.status(400).json({
        error: {
          message: 'Email ID is required'
        }
      });
    }
    
    await SpamService.markNotSpam(emailId, userId);
    
    res.json({
      success: true,
      message: 'Email marked as not spam'
    });
  } catch (error) {
    console.error('Mark not spam error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to mark as not spam'
      }
    });
  }
});

export default router;