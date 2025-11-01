/**
 * Email inbox component with fluid animations and real-time updates
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { EmailListItem } from './EmailListItem';
import { EmailReader } from './EmailReader';
import { NotificationToast } from './NotificationToast';
import { useEmailService } from '../hooks/useEmailService';
import { useWebSocket } from '../hooks/useWebSocket';
import { EmailMetadata } from '../types/email';

interface EmailInboxProps {
  className?: string;
}

export const EmailInbox: React.FC<EmailInboxProps> = ({ className = '' }) => {
  const [emails, setEmails] = useState<EmailMetadata[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolder, setCurrentFolder] = useState('inbox');
  const [notifications, setNotifications] = useState<any[]>([]);
  
  const emailService = useEmailService();
  const { isConnected, lastMessage } = useWebSocket();
  const loadingRef = useRef(false);

  // Load emails
  const loadEmails = useCallback(async (pageNum: number = 1, folder: string = 'inbox', reset: boolean = false) => {
    if (loadingRef.current) return;
    
    loadingRef.current = true;
    setLoading(pageNum === 1);

    try {
      const response = await emailService.getInbox(pageNum, 20, folder);
      
      if (reset || pageNum === 1) {
        setEmails(response.emails);
      } else {
        setEmails(prev => [...prev, ...response.emails]);
      }
      
      setHasMore(response.hasMore);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load emails:', error);
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [emailService]);

  // Handle real-time notifications
  useEffect(() => {
    if (lastMessage?.type === 'notification') {
      const notification = lastMessage.data;
      
      if (notification.type === 'new_email') {
        // Add notification toast
        const toast = {
          id: crypto.randomUUID(),
          type: 'new_email',
          message: `New email from ${notification.senderEmail}`,
          timestamp: new Date()
        };
        
        setNotifications(prev => [...prev, toast]);
        
        // Auto-remove toast after 5 seconds
        setTimeout(() => {
          setNotifications(prev => prev.filter(n => n.id !== toast.id));
        }, 5000);
        
        // Refresh inbox if we're viewing the inbox
        if (currentFolder === 'inbox') {
          loadEmails(1, currentFolder, true);
        }
      }
    }
  }, [lastMessage, currentFolder, loadEmails]);

  // Initial load
  useEffect(() => {
    loadEmails(1, currentFolder, true);
  }, [currentFolder, loadEmails]);

  // Load more emails when scrolling
  const handleLoadMore = useCallback(() => {
    if (hasMore && !loading) {
      loadEmails(page + 1, currentFolder);
    }
  }, [hasMore, loading, page, currentFolder, loadEmails]);

  // Handle email selection
  const handleEmailSelect = useCallback((emailId: string) => {
    setSelectedEmailId(emailId);
  }, []);

  // Handle email actions
  const handleEmailAction = useCallback(async (action: string, emailId: string) => {
    try {
      switch (action) {
        case 'delete':
          await emailService.deleteEmail(emailId);
          setEmails(prev => prev.filter(e => e.id !== emailId));
          if (selectedEmailId === emailId) {
            setSelectedEmailId(null);
          }
          break;
        case 'archive':
          await emailService.moveToFolder(emailId, 'archive');
          setEmails(prev => prev.filter(e => e.id !== emailId));
          if (selectedEmailId === emailId) {
            setSelectedEmailId(null);
          }
          break;
        case 'mark_read':
          setEmails(prev => prev.map(e => 
            e.id === emailId ? { ...e, isRead: true } : e
          ));
          break;
      }
    } catch (error) {
      console.error(`Failed to ${action} email:`, error);
    }
  }, [emailService, selectedEmailId]);

  // Filter emails based on search
  const filteredEmails = emails.filter(_email => {
    if (!searchQuery) return true;
    // Note: Search would need to be done on decrypted content
    // For now, we'll just show all emails when searching
    return true;
  });

  return (
    <div className={`flex h-full bg-white ${className}`}>
      {/* Sidebar */}
      <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
        {/* Connection status */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-600">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        {/* Folder navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {['inbox', 'sent', 'drafts', 'archive', 'trash'].map((folder) => (
              <li key={folder}>
                <motion.button
                  className={`w-full text-left px-3 py-2 rounded-md text-sm font-medium capitalize ${
                    currentFolder === folder
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                  onClick={() => setCurrentFolder(folder)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {folder}
                </motion.button>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Email list */}
      <div className="flex-1 flex flex-col">
        {/* Search bar */}
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-2.5 h-5 w-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
        </div>

        {/* Email list */}
        <div className="flex-1 overflow-y-auto">
          {loading && emails.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <motion.div
                className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredEmails.map((email, index) => (
                <EmailListItem
                  key={email.id}
                  email={email}
                  isSelected={selectedEmailId === email.id}
                  onClick={() => handleEmailSelect(email.id)}
                  onAction={handleEmailAction}
                  animationDelay={index * 0.05}
                />
              ))}
            </AnimatePresence>
          )}

          {/* Load more trigger */}
          {hasMore && (
            <div className="p-4 text-center">
              <motion.button
                className="px-4 py-2 text-blue-600 hover:text-blue-800 font-medium"
                onClick={handleLoadMore}
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {loading ? 'Loading...' : 'Load More'}
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {/* Email reader */}
      {selectedEmailId && (
        <EmailReader
          emailId={selectedEmailId}
          onClose={() => setSelectedEmailId(null)}
          onAction={handleEmailAction}
        />
      )}

      {/* Notification toasts */}
      <div className="fixed top-4 right-4 z-50 space-y-2">
        <AnimatePresence>
          {notifications.map((notification) => (
            <NotificationToast
              key={notification.id}
              notification={notification}
              onDismiss={(id: string) => setNotifications(prev => prev.filter(n => n.id !== id))}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};