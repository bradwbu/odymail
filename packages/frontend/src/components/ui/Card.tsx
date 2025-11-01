/**
 * Animated Card Component
 */

import React from 'react';
import { motion } from 'framer-motion';
import styled from '@emotion/styled';
import { hoverTap } from '../../theme/animations';

interface CardProps {
  children: React.ReactNode;
  padding?: 'sm' | 'md' | 'lg';
  hover?: boolean;
  clickable?: boolean;
  onClick?: () => void;
  className?: string;
}

const StyledCard = styled(motion.div)<{
  padding: string;
  clickable: boolean;
}>`
  background-color: ${({ theme }) => theme.colors.surface.primary};
  border: 1px solid ${({ theme }) => theme.colors.border.primary};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  box-shadow: ${({ theme }) => theme.shadows.sm};
  transition: all 0.2s ease;
  
  ${({ padding, theme }) => {
    switch (padding) {
      case 'sm':
        return `padding: ${theme.spacing[3]};`;
      case 'lg':
        return `padding: ${theme.spacing[6]};`;
      default:
        return `padding: ${theme.spacing[4]};`;
    }
  }}
  
  ${({ clickable }) => clickable && `
    cursor: pointer;
  `}
  
  &:hover {
    ${({ clickable, theme }) => clickable && `
      box-shadow: ${theme.shadows.md};
      border-color: ${theme.colors.border.secondary};
    `}
  }
`;

export const Card: React.FC<CardProps> = ({
  children,
  padding = 'md',
  hover = false,
  clickable = false,
  onClick,
  className,
}) => {
  const motionProps = hover || clickable ? hoverTap : {};

  return (
    <StyledCard
      padding={padding}
      clickable={clickable}
      onClick={onClick}
      className={className}
      {...motionProps}
    >
      {children}
    </StyledCard>
  );
};