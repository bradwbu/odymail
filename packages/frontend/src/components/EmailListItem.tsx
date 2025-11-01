/**
 * Individual email list item with smooth animations and swipe gestures
 */

import React, { useState, useRef } from 'react';
import { motion, PanInfo, useMotionValue, useTransform } from 'framer-motion';
import { EmailMetadata } from '../types/email';

interface EmailListItemProps {
  email: EmailMetadata;
  isSelected: boolean;
  onClick: () => void;
  onAction: (action: string, emailId: string) => void;
  animationDelay?: number;
}

export const EmailListItem: React.FC<EmailListItemProps> = ({
  email,
  isSelected,
  onClick,
  onAction,
  animationDelay = 0
}) => {
  const [isSwipeMenuOpen, setIsSwipeMenuOpen] = useState(false);
  const constraintsRef = useRef(null);
  const x = useMotionValue(0);
  const opacity = useTransform(x, [-100, 0], [0.5, 1]);
  const scale = useTransform(x, [-100, 0], [0.95, 1]);

  // Handle swipe gestures
  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = -80;
    
    if (info.offset.x < threshold) {
      setIsSwipeMenuOpen(true);
    } else {
      setIsSwipeMenuOpen(false);
      x.set(0);
    }
  };

  // Format timestamp
  const formatTime = (timestamp: Date) => {
    const now = new Date();
    const emailDate = new Date(timestamp);
    const diffMs = now.getTime() - emailDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) {
      return 'Just now';
    } else if (diffHours < 24) {
      return `${Math.floor(diffHours)}h ago`;
    } else if (diffDays < 7) {
      return `${Math.floor(diffDays)}d ago`;
    } else {
      return emailDate.toLocaleDateString();
    }
  };

  // Format file size
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <motion.div
      ref={constraintsRef}
      className="relative overflow-hidden border-b border-gray-100"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ delay: animationDelay }}
    >
      {/* Swipe action menu */}
      <motion.div
        className="absolute right-0 top-0 h-full flex items-center bg-red-500 text-white"
        initial={{ width: 0 }}
        animate={{ width: isSwipeMenuOpen ? 160 : 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <div className="flex h-full">
          <motion.button
            className="flex-1 px-4 py-2 bg-blue-500 hover:bg-blue-600 flex items-center justify-center"
            onClick={() => {
              onAction('archive', email.id);
              setIsSwipeMenuOpen(false);
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8l6 6 6-6" />
            </svg>
          </motion.button>
          <motion.button
            className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 flex items-center justify-center"
            onClick={() => {
              onAction('delete', email.id);
              setIsSwipeMenuOpen(false);
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </motion.button>
        </div>
      </motion.div>

      {/* Email item */}
      <motion.div
        className={`relative bg-white cursor-pointer transition-colors duration-200 ${
          isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'
        }`}
        style={{ x, opacity, scale }}
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.2}
        onDragEnd={handleDragEnd}
        onClick={onClick}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              {/* Sender and read status */}
              <div className="flex items-center space-x-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${email.isRead ? 'bg-transparent' : 'bg-blue-500'}`} />
                <span className={`text-sm font-medium truncate ${
                  email.isRead ? 'text-gray-700' : 'text-gray-900'
                }`}>
                  {email.senderEmail || 'Unknown Sender'}
                </span>
                {email.attachmentCount > 0 && (
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                  </svg>
                )}
              </div>

              {/* Subject (encrypted - would need to be decrypted for display) */}
              <div className={`text-sm mb-1 truncate ${
                email.isRead ? 'text-gray-600' : 'text-gray-900 font-medium'
              }`}>
                [Encrypted Subject]
              </div>

              {/* Metadata */}
              <div className="flex items-center space-x-4 text-xs text-gray-500">
                <span>{formatTime(email.timestamp)}</span>
                <span>{formatSize(email.size)}</span>
                {email.deliveryStatus && (
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    email.deliveryStatus === 'delivered' ? 'bg-green-100 text-green-800' :
                    email.deliveryStatus === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {email.deliveryStatus}
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2 ml-4">
              <motion.button
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction('mark_read', email.id);
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </motion.button>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};