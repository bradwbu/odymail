import express from 'express';
import { EmailService } from '../services/emailService.js';
import { LabelService } from '../services/labelService.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateSendEmail, validatePagination, validateEmailId } from '../utils/validation.js';

const router = express.Router();

// All email routes require authentication
router.use(authenticateToken);

/**
 * Send an encrypted email
 */
router.post('/send', validateSendEmail, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const result = await EmailService.sendEmail(userId, req.body);
    
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Send email error:', error);
    res.status(400).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to send email'
      }
    });
  }
});

/**
 * Get inbox emails
 */
router.get('/inbox', validatePagination, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const folderId = req.query.folder as string || 'inbox';
    
    const result = await EmailService.getInbox(userId, page, limit, folderId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get inbox error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to get inbox'
      }
    });
  }
});

/**
 * Get sent emails
 */
router.get('/sent', validatePagination, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    
    const result = await EmailService.getSentEmails(userId, page, limit);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get sent emails error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to get sent emails'
      }
    });
  }
});

/**
 * Get email by ID
 */
router.get('/:id', validateEmailId, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const emailId = req.params.id;
    
    const result = await EmailService.getEmailById(emailId, userId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get email error:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 
                   error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
    
    res.status(status).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to get email'
      }
    });
  }
});

/**
 * Delete email
 */
router.delete('/:id', validateEmailId, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const emailId = req.params.id;
    
    await EmailService.deleteEmail(emailId, userId);
    
    res.json({
      success: true,
      message: 'Email deleted successfully'
    });
  } catch (error) {
    console.error('Delete email error:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 
                   error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
    
    res.status(status).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to delete email'
      }
    });
  }
});

/**
 * Move email to folder
 */
router.put('/:id/folder', validateEmailId, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const emailId = req.params.id;
    const { folderId } = req.body;
    
    if (!folderId || typeof folderId !== 'string') {
      return res.status(400).json({
        error: {
          message: 'Folder ID is required'
        }
      });
    }
    
    await EmailService.moveToFolder(emailId, userId, folderId);
    
    res.json({
      success: true,
      message: 'Email moved successfully'
    });
  } catch (error) {
    console.error('Move email error:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 
                   error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
    
    res.status(status).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to move email'
      }
    });
  }
});

/**
 * Get delivery status
 */
router.get('/:id/delivery', validateEmailId, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const emailId = req.params.id;
    
    const result = await EmailService.getDeliveryStatus(emailId, userId);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Get delivery status error:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 
                   error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
    
    res.status(status).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to get delivery status'
      }
    });
  }
});

/**
 * Search emails metadata (for client-side decryption and search)
 */
router.get('/search-metadata', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const {
      folder,
      dateFrom,
      dateTo,
      sender,
      hasAttachments,
      isRead,
      limit = '50'
    } = req.query;

    const result = await EmailService.searchEmailsMetadata(userId, {
      folder: folder as string,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      sender: sender as string,
      hasAttachments: hasAttachments === 'true',
      isRead: isRead === 'true',
      limit: parseInt(limit as string)
    });
    
    res.json({
      success: true,
      emails: result
    });
  } catch (error) {
    console.error('Search emails metadata error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to search emails'
      }
    });
  }
});

/**
 * Mark email as read
 */
router.put('/:id/read', validateEmailId, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const emailId = req.params.id;
    
    await EmailService.markAsRead(emailId, userId);
    
    res.json({
      success: true,
      message: 'Email marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 
                   error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
    
    res.status(status).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to mark as read'
      }
    });
  }
});

/**
 * Mark email as unread
 */
router.put('/:id/unread', validateEmailId, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const emailId = req.params.id;
    
    await EmailService.markAsUnread(emailId, userId);
    
    res.json({
      success: true,
      message: 'Email marked as unread'
    });
  } catch (error) {
    console.error('Mark as unread error:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 
                   error instanceof Error && error.message.includes('Access denied') ? 403 : 500;
    
    res.status(status).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to mark as unread'
      }
    });
  }
});

/**
 * Bulk move emails to folder
 */
router.put('/bulk/folder', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { emailIds, folderId } = req.body;
    
    if (!Array.isArray(emailIds) || !folderId) {
      return res.status(400).json({
        error: {
          message: 'Email IDs array and folder ID are required'
        }
      });
    }
    
    await EmailService.bulkMoveToFolder(emailIds, userId, folderId);
    
    res.json({
      success: true,
      message: 'Emails moved successfully'
    });
  } catch (error) {
    console.error('Bulk move emails error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to move emails'
      }
    });
  }
});

/**
 * Add label to email
 */
router.post('/:id/labels', validateEmailId, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const emailId = req.params.id;
    const { labelId } = req.body;
    
    if (!labelId) {
      return res.status(400).json({
        error: {
          message: 'Label ID is required'
        }
      });
    }
    
    await LabelService.addLabelToEmail(emailId, labelId, userId);
    
    res.json({
      success: true,
      message: 'Label added to email'
    });
  } catch (error) {
    console.error('Add label to email error:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    
    res.status(status).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to add label'
      }
    });
  }
});

/**
 * Remove label from email
 */
router.delete('/:id/labels/:labelId', validateEmailId, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const emailId = req.params.id;
    const labelId = req.params.labelId;
    
    await LabelService.removeLabelFromEmail(emailId, labelId, userId);
    
    res.json({
      success: true,
      message: 'Label removed from email'
    });
  } catch (error) {
    console.error('Remove label from email error:', error);
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    
    res.status(status).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to remove label'
      }
    });
  }
});

/**
 * Get labels for email
 */
router.get('/:id/labels', validateEmailId, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const emailId = req.params.id;
    
    const labels = await LabelService.getEmailLabels(emailId, userId);
    
    res.json({
      success: true,
      labels
    });
  } catch (error) {
    console.error('Get email labels error:', error);
    res.status(500).json({
      error: {
        message: error instanceof Error ? error.message : 'Failed to get email labels'
      }
    });
  }
});

export default router;