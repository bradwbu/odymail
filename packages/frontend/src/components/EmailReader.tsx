/**
 * Email reader component for displaying and decrypting email content
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEmailService } from '../hooks/useEmailService';
import { useCrypto } from '../hooks/useCrypto';
import { EmailDetailResponse } from '../types/email';

interface EmailReaderProps {
  emailId: string;
  onClose: () => void;
  onAction: (action: string, emailId: string) => void;
}

interface DecryptedEmail {
  subject: string;
  content: string;
  attachments: Array<{
    id: string;
    name: string;
    size: number;
    mimeType: string;
    data: ArrayBuffer;
  }>;
}

export const EmailReader: React.FC<EmailReaderProps> = ({
  emailId,
  onClose,
  onAction
}) => {
  const [emailData, setEmailData] = useState<EmailDetailResponse | null>(null);
  const [decryptedEmail, setDecryptedEmail] = useState<DecryptedEmail | null>(null);
  const [loading, setLoading] = useState(true);
  const [decrypting, setDecrypting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRawContent, setShowRawContent] = useState(false);

  const emailService = useEmailService();
  const crypto = useCrypto();

  // Load email data
  useEffect(() => {
    const loadEmail = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const data = await emailService.getEmailById(emailId);
        setEmailData(data);
        
        // Start decryption
        await decryptEmail(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load email');
      } finally {
        setLoading(false);
      }
    };

    loadEmail();
  }, [emailId, emailService]);

  // Decrypt email content
  const decryptEmail = async (data: EmailDetailResponse) => {
    try {
      setDecrypting(true);
      
      // Get user's private key (would need password prompt in real app)
      const userPassword = 'user-password'; // This should come from secure storage
      const privateKey = await crypto.getUserPrivateKey(userPassword);
      
      // Decrypt the AES key using user's private key
      const encryptedAESKey = crypto.base64ToArrayBuffer(data.recipientKey);
      const aesKeyBuffer = await crypto.decryptRSA(encryptedAESKey, privateKey);
      const aesKey = await crypto.importAESKey(aesKeyBuffer);
      
      // Decrypt subject
      const encryptedSubject = crypto.base64ToArrayBuffer(data.encryptedSubject);
      const subjectBuffer = await crypto.decryptAES(encryptedSubject, aesKey);
      const subject = crypto.arrayBufferToString(subjectBuffer);
      
      // Decrypt content
      const emailContent = JSON.parse(data.encryptedContent);
      const encryptedBody = crypto.base64ToArrayBuffer(emailContent.body);
      const bodyBuffer = await crypto.decryptAES(encryptedBody, aesKey);
      const content = crypto.arrayBufferToString(bodyBuffer);
      
      // Decrypt attachments
      const attachments = await Promise.all(
        data.encryptedAttachments.map(async (att: any) => {
          const encryptedName = crypto.base64ToArrayBuffer(att.encryptedName);
          const nameBuffer = await crypto.decryptAES(encryptedName, aesKey);
          const name = crypto.arrayBufferToString(nameBuffer);
          
          const encryptedData = crypto.base64ToArrayBuffer(att.encryptedData);
          const data = await crypto.decryptAES(encryptedData, aesKey);
          
          return {
            id: att.id,
            name,
            size: att.size,
            mimeType: att.mimeType,
            data
          };
        })
      );
      
      setDecryptedEmail({
        subject,
        content,
        attachments
      });
      
    } catch (err) {
      setError(`Failed to decrypt email: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDecrypting(false);
    }
  };

  // Download attachment
  const downloadAttachment = (attachment: any) => {
    const blob = new Blob([attachment.data], { type: attachment.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = attachment.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Format timestamp
  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleString();
  };

  if (loading) {
    return (
      <motion.div
        className="w-96 bg-white border-l border-gray-200 flex items-center justify-center"
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <motion.div
          className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        />
      </motion.div>
    );
  }

  if (error) {
    return (
      <motion.div
        className="w-96 bg-white border-l border-gray-200 p-6"
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="text-center">
          <div className="text-red-500 mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Error Loading Email</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <motion.button
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={onClose}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Close
          </motion.button>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="w-96 bg-white border-l border-gray-200 flex flex-col"
      initial={{ x: 300, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 300, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Email</h2>
          <motion.button
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
            onClick={onClose}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.button>
        </div>

        {/* Actions */}
        <div className="flex space-x-2">
          <motion.button
            className="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            onClick={() => onAction('reply', emailId)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Reply
          </motion.button>
          <motion.button
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            onClick={() => onAction('archive', emailId)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Archive
          </motion.button>
          <motion.button
            className="px-3 py-2 text-sm bg-red-100 text-red-700 rounded-md hover:bg-red-200"
            onClick={() => onAction('delete', emailId)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Delete
          </motion.button>
        </div>
      </div>

      {/* Email content */}
      <div className="flex-1 overflow-y-auto">
        {decrypting ? (
          <div className="p-6 text-center">
            <motion.div
              className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            />
            <p className="text-gray-600">Decrypting email...</p>
          </div>
        ) : emailData && decryptedEmail ? (
          <div className="p-4 space-y-4">
            {/* Email metadata */}
            <div className="space-y-2">
              <div className="text-sm text-gray-600">
                <span className="font-medium">From:</span> {emailData.metadata.senderEmail}
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">Date:</span> {formatTimestamp(emailData.metadata.timestamp)}
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">Size:</span> {(emailData.metadata.size / 1024).toFixed(1)} KB
              </div>
            </div>

            {/* Subject */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {decryptedEmail.subject || '(No Subject)'}
              </h3>
            </div>

            {/* Content */}
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-gray-800">
                {decryptedEmail.content}
              </div>
            </div>

            {/* Attachments */}
            {decryptedEmail.attachments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">
                  Attachments ({decryptedEmail.attachments.length})
                </h4>
                <div className="space-y-2">
                  {decryptedEmail.attachments.map((attachment) => (
                    <motion.div
                      key={attachment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                      whileHover={{ scale: 1.02 }}
                    >
                      <div className="flex items-center space-x-3">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{attachment.name}</div>
                          <div className="text-xs text-gray-500">
                            {(attachment.size / 1024).toFixed(1)} KB
                          </div>
                        </div>
                      </div>
                      <motion.button
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        onClick={() => downloadAttachment(attachment)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Download
                      </motion.button>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Debug toggle */}
            <div className="pt-4 border-t border-gray-200">
              <motion.button
                className="text-xs text-gray-500 hover:text-gray-700"
                onClick={() => setShowRawContent(!showRawContent)}
                whileHover={{ scale: 1.05 }}
              >
                {showRawContent ? 'Hide' : 'Show'} Raw Content
              </motion.button>
              
              <AnimatePresence>
                {showRawContent && (
                  <motion.div
                    className="mt-2 p-3 bg-gray-100 rounded text-xs font-mono overflow-auto max-h-40"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <pre>{JSON.stringify(emailData, null, 2)}</pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">
            No email data available
          </div>
        )}
      </div>
    </motion.div>
  );
};