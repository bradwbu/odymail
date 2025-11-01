/**
 * Animated Button Component
 */

import React, { forwardRef } from 'react';
import { motion } from 'framer-motion';
import styled from '@emotion/styled';
import { buttonHover } from '../../theme/animations';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'color'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const StyledButton = styled(motion.button)<{
  variant: ButtonVariant;
  size: ButtonSize;
  fullWidth?: boolean;
}>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing[2]};
  border: none;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-family: ${({ theme }) => theme.typography.fontFamily.sans.join(', ')};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
  
  ${({ fullWidth }) => fullWidth && 'width: 100%;'}
  
  /* Size variants */
  ${({ size, theme }) => {
    switch (size) {
      case 'sm':
        return `
          padding: ${theme.spacing[2]} ${theme.spacing[3]};
          font-size: ${theme.typography.fontSize.sm};
          line-height: ${theme.typography.lineHeight.sm};
        `;
      case 'lg':
        return `
          padding: ${theme.spacing[3]} ${theme.spacing[6]};
          font-size: ${theme.typography.fontSize.lg};
          line-height: ${theme.typography.lineHeight.lg};
        `;
      default:
        return `
          padding: ${theme.spacing[2.5]} ${theme.spacing[4]};
          font-size: ${theme.typography.fontSize.base};
          line-height: ${theme.typography.lineHeight.base};
        `;
    }
  }}
  
  /* Color variants */
  ${({ variant, theme }) => {
    switch (variant) {
      case 'primary':
        return `
          background-color: ${theme.colors.brand[600]};
          color: ${theme.colors.text.inverse};
          box-shadow: ${theme.shadows.sm};
          
          &:hover:not(:disabled) {
            background-color: ${theme.colors.brand[700]};
            box-shadow: ${theme.shadows.md};
          }
          
          &:active:not(:disabled) {
            background-color: ${theme.colors.brand[800]};
          }
        `;
      case 'secondary':
        return `
          background-color: ${theme.colors.surface.secondary};
          color: ${theme.colors.text.primary};
          border: 1px solid ${theme.colors.border.primary};
          
          &:hover:not(:disabled) {
            background-color: ${theme.colors.surface.hover};
            border-color: ${theme.colors.border.secondary};
          }
          
          &:active:not(:disabled) {
            background-color: ${theme.colors.surface.active};
          }
        `;
      case 'outline':
        return `
          background-color: transparent;
          color: ${theme.colors.brand[600]};
          border: 1px solid ${theme.colors.brand[600]};
          
          &:hover:not(:disabled) {
            background-color: ${theme.colors.brand[50]};
            border-color: ${theme.colors.brand[700]};
            color: ${theme.colors.brand[700]};
          }
          
          &:active:not(:disabled) {
            background-color: ${theme.colors.brand[100]};
          }
        `;
      case 'ghost':
        return `
          background-color: transparent;
          color: ${theme.colors.text.secondary};
          
          &:hover:not(:disabled) {
            background-color: ${theme.colors.surface.hover};
            color: ${theme.colors.text.primary};
          }
          
          &:active:not(:disabled) {
            background-color: ${theme.colors.surface.active};
          }
        `;
      case 'danger':
        return `
          background-color: ${theme.colors.semantic.error[600]};
          color: ${theme.colors.text.inverse};
          box-shadow: ${theme.shadows.sm};
          
          &:hover:not(:disabled) {
            background-color: ${theme.colors.semantic.error[700]};
            box-shadow: ${theme.shadows.md};
          }
          
          &:active:not(:disabled) {
            background-color: ${theme.colors.semantic.error[800]};
          }
        `;
      default:
        return '';
    }
  }}
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.border.focus};
    outline-offset: 2px;
  }
`;

const LoadingSpinner = styled(motion.div)`
  width: 1rem;
  height: 1rem;
  border: 2px solid transparent;
  border-top: 2px solid currentColor;
  border-radius: 50%;
`;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <StyledButton
        ref={ref}
        variant={variant}
        size={size}
        fullWidth={fullWidth}
        disabled={disabled || loading}
        {...buttonHover}
        {...props}
      >
        {loading ? (
          <LoadingSpinner
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </StyledButton>
    );
  }
);

Button.displayName = 'Button';