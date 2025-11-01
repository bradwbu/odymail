/**
 * Demo component to showcase email composition functionality
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { EmailComposer } from './EmailComposer';
import { EmailDraft } from '../types/email';

export const EmailComposerDemo: React.FC = () => {
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [sentEmails, setSentEmails] = useState<EmailDraft[]>([]);

  const handleSendEmail = (draft: EmailDraft) => {
    setSentEmails(prev => [...prev, draft]);
    setIsComposerOpen(false);
    
    // Show success notification
    console.log('Email sent successfully:', draft);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          Email Composition Demo
        </h2>
        <p className="text-gray-600 mb-6">
          Experience our sleek email composer with client-side encryption, 
          animated UI elements, and comprehensive attachment support.
        </p>
        
        <motion.button
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
          onClick={() => setIsComposerOpen(true)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Compose New Email
        </motion.button>
      </div>

      {/* Features showcase */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <motion.div
          className="bg-white p-6 rounded-lg shadow-md border border-gray-200"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </div>
            <h3 className="ml-3 text-lg font-semibold text-gray-900">Rich Text Editor</h3>
          </div>
          <p className="text-gray-600 text-sm">
            Full-featured rich text editing with formatting toolbar, 
            keyboard shortcuts, and smooth animations.
          </p>
        </motion.div>

        <motion.div
          className="bg-white p-6 rounded-lg shadow-md border border-gray-200"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </div>
            <h3 className="ml-3 text-lg font-semibold text-gray-900">Smart Attachments</h3>
          </div>
          <p className="text-gray-600 text-sm">
            Drag-and-drop file uploads with progress indicators, 
            file type detection, and size validation.
          </p>
        </motion.div>

        <motion.div
          className="bg-white p-6 rounded-lg shadow-md border border-gray-200"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            </div>
            <h3 className="ml-3 text-lg font-semibold text-gray-900">Recipient Validation</h3>
          </div>
          <p className="text-gray-600 text-sm">
            Real-time email validation with animated feedback, 
            contact suggestions, and encryption status indicators.
          </p>
        </motion.div>
      </div>

      {/* Sent emails list */}
      {sentEmails.length > 0 && (
        <motion.div
          className="bg-white rounded-lg shadow-md border border-gray-200 p-6"
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3 }}
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recently Sent ({sentEmails.length})
          </h3>
          <div className="space-y-3">
            {sentEmails.map((email, index) => (
              <motion.div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex-1">
                  <div className="font-medium text-gray-900">
                    {email.subject || '(No Subject)'}
                  </div>
                  <div className="text-sm text-gray-500">
                    To: {email.to.map(r => r.email).join(', ')}
                  </div>
                </div>
                <div className="flex items-center text-sm text-green-600">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                  </svg>
                  Encrypted
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Email Composer */}
      <EmailComposer
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        onSend={handleSendEmail}
      />
    </div>
  );
};