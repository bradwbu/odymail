/**
 * Email Composer Component with sleek UI and smooth animations
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmailService } from '../services/emailService';
import { EmailDraft, EmailRecipient, EmailAttachment, ComposeState } from '../types/email';
import { RecipientInput } from './RecipientInput';
import { AttachmentManager } from './AttachmentManager';
import { RichTextEditor } from './RichTextEditor';

interface EmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSend?: (draft: EmailDraft) => void;
  initialDraft?: EmailDraft;
  className?: string;
}

export const EmailComposer: React.FC<EmailComposerProps> = ({
  isOpen,
  onClose,
  onSend,
  initialDraft,
  className = ''
}) => {
  const [composeState, setComposeState] = useState<ComposeState>({
    isOpen,
    isMinimized: false,
    isExpanded: false,
    draft: initialDraft || new EmailService().createEmptyDraft(),
    isSending: false
  });

  const [emailService] = useState(() => new EmailService());
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [showValidation, setShowValidation] = useState(false);

  const composerRef = useRef<HTMLDivElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);

  // Initialize email service
  useEffect(() => {
    emailService.initialize().catch(console.error);
  }, [emailService]);

  // Update compose state when isOpen prop changes
  useEffect(() => {
    setComposeState(prev => ({ ...prev, isOpen }));
  }, [isOpen]);

  // Auto-save draft
  useEffect(() => {
    const timer = setTimeout(() => {
      if (composeState.draft.subject || composeState.draft.body || composeState.draft.to.length > 0) {
        emailService.saveDraft(composeState.draft);
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [composeState.draft, emailService]);

  const updateDraft = useCallback((updates: Partial<EmailDraft>) => {
    setComposeState(prev => ({
      ...prev,
      draft: {
        ...prev.draft,
        ...updates,
        updatedAt: new Date()
      }
    }));
  }, []);

  const validateAndSend = useCallback(async () => {
    setComposeState(prev => ({ ...prev, isSending: true }));
    setShowValidation(true);

    try {
      // Validate recipients
      const recipientValidation = await emailService.validateRecipients(composeState.draft.to);
      
      // Validate draft
      const draftValidation = emailService.validateDraft(composeState.draft);
      
      const allErrors = [...recipientValidation.errors, ...draftValidation.errors];
      const allWarnings = [...recipientValidation.warnings, ...draftValidation.warnings];
      
      setValidationErrors(allErrors);
      setValidationWarnings(allWarnings);

      if (allErrors.length > 0) {
        setComposeState(prev => ({ ...prev, isSending: false }));
        return;
      }

      // Get user credentials (in a real app, this would come from auth context)
      const userKeyId = localStorage.getItem('userKeyId') || '';
      const userPassword = prompt('Enter your password to send encrypted email:');
      
      if (!userPassword) {
        setComposeState(prev => ({ ...prev, isSending: false }));
        return;
      }

      // Encrypt and send email
      const encryptedEmail = await emailService.encryptEmail(composeState.draft, userKeyId, userPassword);
      await emailService.sendEmail(encryptedEmail);

      // Clean up
      if (composeState.draft.id) {
        emailService.deleteDraft(composeState.draft.id);
      }

      onSend?.(composeState.draft);
      onClose();
      
    } catch (error) {
      console.error('Failed to send email:', error);
      setValidationErrors([`Failed to send email: ${error}`]);
    } finally {
      setComposeState(prev => ({ ...prev, isSending: false }));
    }
  }, [composeState.draft, emailService, onSend, onClose]);

  const handleMinimize = useCallback(() => {
    setComposeState(prev => ({ ...prev, isMinimized: !prev.isMinimized }));
  }, []);

  const handleExpand = useCallback(() => {
    setComposeState(prev => ({ ...prev, isExpanded: !prev.isExpanded }));
  }, []);

  const handleClose = useCallback(() => {
    // Save draft before closing
    if (composeState.draft.subject || composeState.draft.body || composeState.draft.to.length > 0) {
      emailService.saveDraft(composeState.draft);
    }
    onClose();
  }, [composeState.draft, emailService, onClose]);

  const handleRecipientsChange = useCallback((recipients: EmailRecipient[]) => {
    updateDraft({ to: recipients });
  }, [updateDraft]);

  const handleAttachmentsChange = useCallback((attachments: EmailAttachment[]) => {
    updateDraft({ attachments });
  }, [updateDraft]);

  const handleSubjectChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    updateDraft({ subject: e.target.value });
  }, [updateDraft]);

  const handleBodyChange = useCallback((content: string) => {
    updateDraft({ body: content });
  }, [updateDraft]);

  // Animation variants
  const composerVariants = {
    hidden: {
      opacity: 0,
      scale: 0.8,
      y: 50,
      transition: {
        duration: 0.2,
        ease: 'easeOut'
      }
    },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        duration: 0.3,
        ease: 'easeOut'
      }
    },
    minimized: {
      opacity: 1,
      scale: 0.95,
      y: 20,
      height: 60,
      transition: {
        duration: 0.2,
        ease: 'easeInOut'
      }
    },
    expanded: {
      opacity: 1,
      scale: 1,
      y: 0,
      height: 'auto',
      transition: {
        duration: 0.3,
        ease: 'easeOut'
      }
    }
  };

  const overlayVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 }
  };

  return (
    <AnimatePresence>
      {composeState.isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50"
          variants={overlayVariants}
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <motion.div
            ref={composerRef}
            className={`bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden ${className}`}
            variants={composerVariants}
            initial="hidden"
            animate={
              composeState.isMinimized 
                ? "minimized" 
                : composeState.isExpanded 
                ? "expanded" 
                : "visible"
            }
            exit="hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-semibold text-gray-800">
                  {composeState.draft.id ? 'Edit Draft' : 'Compose Email'}
                </h2>
                {composeState.isSending && (
                  <motion.div
                    className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                )}
              </div>
              
              <div className="flex items-center space-x-2">
                <motion.button
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
                  onClick={handleMinimize}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                  </svg>
                </motion.button>
                
                <motion.button
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
                  onClick={handleExpand}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </motion.button>
                
                <motion.button
                  className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-200 rounded-md transition-colors"
                  onClick={handleClose}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </motion.button>
              </div>
            </div>

            {/* Content */}
            <AnimatePresence>
              {!composeState.isMinimized && (
                <motion.div
                  className="flex flex-col h-full"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {/* Validation Messages */}
                  <AnimatePresence>
                    {showValidation && (validationErrors.length > 0 || validationWarnings.length > 0) && (
                      <motion.div
                        className="p-4 border-b border-gray-200"
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                      >
                        {validationErrors.length > 0 && (
                          <div className="mb-2">
                            {validationErrors.map((error, index) => (
                              <div key={index} className="text-red-600 text-sm flex items-center">
                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {error}
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {validationWarnings.length > 0 && (
                          <div>
                            {validationWarnings.map((warning, index) => (
                              <div key={index} className="text-yellow-600 text-sm flex items-center">
                                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                {warning}
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Recipients */}
                  <div className="p-4 border-b border-gray-200">
                    <RecipientInput
                      recipients={composeState.draft.to}
                      onChange={handleRecipientsChange}
                      placeholder="To: Enter email addresses..."
                    />
                  </div>

                  {/* Subject */}
                  <div className="p-4 border-b border-gray-200">
                    <input
                      ref={subjectRef}
                      type="text"
                      placeholder="Subject"
                      value={composeState.draft.subject}
                      onChange={handleSubjectChange}
                      className="w-full px-0 py-2 text-lg border-none outline-none focus:ring-0 placeholder-gray-400"
                      disabled={composeState.isSending}
                    />
                  </div>

                  {/* Attachments */}
                  <AttachmentManager
                    attachments={composeState.draft.attachments}
                    onChange={handleAttachmentsChange}
                    disabled={composeState.isSending}
                  />

                  {/* Body */}
                  <div className="flex-1 min-h-0">
                    <RichTextEditor
                      content={composeState.draft.body}
                      onChange={handleBodyChange}
                      placeholder="Write your message..."
                      disabled={composeState.isSending}
                    />
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                      </svg>
                      <span>End-to-end encrypted</span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <motion.button
                        className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                        onClick={handleClose}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={composeState.isSending}
                      >
                        Cancel
                      </motion.button>
                      
                      <motion.button
                        className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        onClick={validateAndSend}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={composeState.isSending || composeState.draft.to.length === 0}
                      >
                        {composeState.isSending ? 'Sending...' : 'Send'}
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};