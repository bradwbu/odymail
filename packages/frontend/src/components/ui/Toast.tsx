/**
 * Animated Toast Notification Component
 */

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styled from '@emotion/styled';
import { Theme } from '../../theme/theme';
import { toastVariants } from '../../theme/animations';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
  onClose: (id: string) => void;
}

const ToastContainer = styled(motion.div)<{ type: ToastType; theme: Theme }>`
  background-color: ${({ theme }) => theme.colors.surface.primary};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  border: 1px solid ${({ theme }) => theme.colors.border.primary};
  padding: ${({ theme }) => theme.spacing[4]};
  min-width: 300px;
  max-width: 500px;
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing[3]};
  position: relative;
  
  ${({ type, theme }) => {
    switch (type) {
      case 'success':
        return `border-left: 4px solid ${theme.colors.semantic.success[500]};`;
      case 'error':
        return `border-left: 4px solid ${theme.colors.semantic.error[500]};`;
      case 'warning':
        return `border-left: 4px solid ${theme.colors.semantic.warning[500]};`;
      case 'info':
        return `border-left: 4px solid ${theme.colors.brand[500]};`;
      default:
        return '';
    }
  }}
`;

const IconContainer = styled.div<{ type: ToastType; theme: Theme }>`
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  ${({ type, theme }) => {
    switch (type) {
      case 'success':
        return `color: ${theme.colors.semantic.success[500]};`;
      case 'error':
        return `color: ${theme.colors.semantic.error[500]};`;
      case 'warning':
        return `color: ${theme.colors.semantic.warning[500]};`;
      case 'info':
        return `color: ${theme.colors.brand[500]};`;
      default:
        return '';
    }
  }}
`;

const Content = styled.div`
  flex: 1;
`;

const Title = styled.div<{ theme: Theme }>`
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.primary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm[0]};
  line-height: ${({ theme }) => theme.typography.fontSize.sm[1].lineHeight};
  margin-bottom: ${({ theme }) => theme.spacing[1]};
`;

const Message = styled.div<{ theme: Theme }>`
  color: ${({ theme }) => theme.colors.text.secondary};
  font-size: ${({ theme }) => theme.typography.fontSize.sm[0]};
  line-height: ${({ theme }) => theme.typography.fontSize.sm[1].lineHeight};
`;

const CloseButton = styled(motion.button)<{ theme: Theme }>`
  background: none;
  border: none;
  padding: ${({ theme }) => theme.spacing[1]};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  cursor: pointer;
  color: ${({ theme }) => theme.colors.text.tertiary};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  
  &:hover {
    background-color: ${({ theme }) => theme.colors.surface.hover};
    color: ${({ theme }) => theme.colors.text.secondary};
  }
`;

const ProgressBar = styled(motion.div)<{ type: ToastType; theme: Theme }>`
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  border-radius: 0 0 ${({ theme }) => theme.borderRadius.lg} ${({ theme }) => theme.borderRadius.lg};
  
  ${({ type, theme }) => {
    switch (type) {
      case 'success':
        return `background-color: ${theme.colors.semantic.success[500]};`;
      case 'error':
        return `background-color: ${theme.colors.semantic.error[500]};`;
      case 'warning':
        return `background-color: ${theme.colors.semantic.warning[500]};`;
      case 'info':
        return `background-color: ${theme.colors.brand[500]};`;
      default:
        return '';
    }
  }}
`;

const getIcon = (type: ToastType) => {
  switch (type) {
    case 'success':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'error':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'warning':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      );
    case 'info':
      return (
        <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
            clipRule="evenodd"
          />
        </svg>
      );
    default:
      return null;
  }
};

export const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 5000,
  onClose,
}) => {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (duration <= 0) return;

    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, duration - elapsed);
      setProgress((remaining / duration) * 100);

      if (remaining === 0) {
        onClose(id);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [id, duration, onClose]);

  return (
    <ToastContainer
      type={type}
      variants={toastVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      layout
    >
      <IconContainer type={type}>{getIcon(type)}</IconContainer>
      <Content>
        <Title>{title}</Title>
        {message && <Message>{message}</Message>}
      </Content>
      <CloseButton
        onClick={() => onClose(id)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </CloseButton>
      {duration > 0 && (
        <ProgressBar
          type={type}
          initial={{ width: '100%' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.1, ease: 'linear' }}
        />
      )}
    </ToastContainer>
  );
};

// Toast Container for managing multiple toasts
const ToastListContainer = styled.div<{ theme: Theme }>`
  position: fixed;
  top: ${({ theme }) => theme.spacing[4]};
  right: ${({ theme }) => theme.spacing[4]};
  z-index: ${({ theme }) => theme.zIndex.toast};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[2]};
  pointer-events: none;
  
  > * {
    pointer-events: auto;
  }
`;

interface ToastListProps {
  toasts: Array<{
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
  }>;
  onClose: (id: string) => void;
}

export const ToastList: React.FC<ToastListProps> = ({ toasts, onClose }) => {
  return (
    <ToastListContainer>
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onClose={onClose} />
        ))}
      </AnimatePresence>
    </ToastListContainer>
  );
};