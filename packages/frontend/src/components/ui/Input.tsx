/**
 * Animated Input Component
 */

import React, { forwardRef, useState } from 'react';
import { motion } from 'framer-motion';
import styled from '@emotion/styled';

interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'outline' | 'filled';
}

const InputContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[1]};
`;

const Label = styled(motion.label)<{ focused: boolean; hasError: boolean }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme, hasError, focused }) => 
    hasError 
      ? theme.colors.semantic.error[600]
      : focused 
        ? theme.colors.brand[600]
        : theme.colors.text.secondary
  };
  transition: color 0.2s ease;
`;

const InputWrapper = styled.div`
  position: relative;
  display: flex;
  align-items: center;
`;

const StyledInput = styled(motion.input)<{
  size: string;
  variant: string;
  hasLeftIcon: boolean;
  hasRightIcon: boolean;
  hasError: boolean;
}>`
  width: 100%;
  border: 1px solid ${({ theme, hasError }) => 
    hasError ? theme.colors.semantic.error[300] : theme.colors.border.primary
  };
  border-radius: ${({ theme }) => theme.borderRadius.md};
  font-family: ${({ theme }) => theme.typography.fontFamily.sans.join(', ')};
  font-size: ${({ theme }) => theme.typography.fontSize.base[0]};
  color: ${({ theme }) => theme.colors.text.primary};
  background-color: ${({ theme, variant }) => 
    variant === 'filled' ? theme.colors.surface.secondary : theme.colors.surface.primary
  };
  transition: all 0.2s ease;
  
  ${({ size, theme }) => {
    switch (size) {
      case 'sm':
        return `
          padding: ${theme.spacing[2]} ${theme.spacing[3]};
          font-size: ${theme.typography.fontSize.sm[0]};
        `;
      case 'lg':
        return `
          padding: ${theme.spacing[3]} ${theme.spacing[4]};
          font-size: ${theme.typography.fontSize.lg[0]};
        `;
      default:
        return `
          padding: ${theme.spacing[2.5]} ${theme.spacing[3]};
        `;
    }
  }}
  
  ${({ hasLeftIcon, theme }) => hasLeftIcon && `
    padding-left: ${theme.spacing[10]};
  `}
  
  ${({ hasRightIcon, theme }) => hasRightIcon && `
    padding-right: ${theme.spacing[10]};
  `}
  
  &:focus {
    outline: none;
    border-color: ${({ theme, hasError }) => 
      hasError ? theme.colors.semantic.error[500] : theme.colors.border.focus
    };
    box-shadow: 0 0 0 3px ${({ theme, hasError }) => 
      hasError 
        ? `${theme.colors.semantic.error[500]}20`
        : `${theme.colors.border.focus}20`
    };
  }
  
  &:hover:not(:focus) {
    border-color: ${({ theme, hasError }) => 
      hasError ? theme.colors.semantic.error[400] : theme.colors.border.secondary
    };
  }
  
  &::placeholder {
    color: ${({ theme }) => theme.colors.text.tertiary};
  }
  
  &:disabled {
    background-color: ${({ theme }) => theme.colors.surface.secondary};
    color: ${({ theme }) => theme.colors.text.tertiary};
    cursor: not-allowed;
    opacity: 0.6;
  }
`;

const IconContainer = styled.div<{ position: 'left' | 'right' }>`
  position: absolute;
  ${({ position }) => position}: ${({ theme }) => theme.spacing[3]};
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.text.tertiary};
  pointer-events: none;
`;

const HelperText = styled(motion.div)<{ hasError: boolean }>`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme, hasError }) => 
    hasError ? theme.colors.semantic.error[600] : theme.colors.text.tertiary
  };
`;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      size = 'md',
      variant = 'outline',
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const [focused, setFocused] = useState(false);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(true);
      onFocus?.(e);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setFocused(false);
      onBlur?.(e);
    };

    const hasError = Boolean(error);

    return (
      <InputContainer>
        {label && (
          <Label
            focused={focused}
            hasError={hasError}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {label}
          </Label>
        )}
        <InputWrapper>
          {leftIcon && (
            <IconContainer position="left">
              {leftIcon}
            </IconContainer>
          )}
          <StyledInput
            ref={ref}
            size={size}
            variant={variant}
            hasLeftIcon={Boolean(leftIcon)}
            hasRightIcon={Boolean(rightIcon)}
            hasError={hasError}
            onFocus={handleFocus}
            onBlur={handleBlur}
            whileFocus={{ scale: 1.01 }}
            transition={{ duration: 0.1 }}
            {...props}
          />
          {rightIcon && (
            <IconContainer position="right">
              {rightIcon}
            </IconContainer>
          )}
        </InputWrapper>
        {(error || helperText) && (
          <HelperText
            hasError={hasError}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            {error || helperText}
          </HelperText>
        )}
      </InputContainer>
    );
  }
);

Input.displayName = 'Input';