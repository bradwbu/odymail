/**
 * Global Styles - CSS reset and base styles
 */

import { css } from '@emotion/react';
import { Theme } from './theme';

export const globalStyles = (theme: Theme) => css`
  /* CSS Reset */
  *,
  *::before,
  *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  /* Root and body styles */
  html {
    font-size: 16px;
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
  }

  body {
    font-family: ${theme.typography.fontFamily.sans.join(', ')};
    font-weight: ${theme.typography.fontWeight.normal};
    color: ${theme.colors.text.primary};
    background-color: ${theme.colors.background.primary};
    transition: background-color 0.3s ease, color 0.3s ease;
    min-height: 100vh;
  }

  /* Typography */
  h1, h2, h3, h4, h5, h6 {
    font-weight: ${theme.typography.fontWeight.semibold};
    line-height: 1.2;
    color: ${theme.colors.text.primary};
  }

  h1 {
    font-size: ${theme.typography.fontSize['3xl']};
    line-height: ${theme.typography.lineHeight['3xl']};
  }

  h2 {
    font-size: ${theme.typography.fontSize['2xl']};
    line-height: ${theme.typography.lineHeight['2xl']};
  }

  h3 {
    font-size: ${theme.typography.fontSize.xl};
    line-height: ${theme.typography.lineHeight.xl};
  }

  h4 {
    font-size: ${theme.typography.fontSize.lg};
    line-height: ${theme.typography.lineHeight.lg};
  }

  h5 {
    font-size: ${theme.typography.fontSize.base};
    line-height: ${theme.typography.lineHeight.base};
  }

  h6 {
    font-size: ${theme.typography.fontSize.sm};
    line-height: ${theme.typography.lineHeight.sm};
  }

  p {
    margin-bottom: ${theme.spacing[4]};
    color: ${theme.colors.text.secondary};
  }

  /* Links */
  a {
    color: ${theme.colors.brand[600]};
    text-decoration: none;
    transition: color 0.2s ease;

    &:hover {
      color: ${theme.colors.brand[700]};
      text-decoration: underline;
    }

    &:focus-visible {
      outline: 2px solid ${theme.colors.border.focus};
      outline-offset: 2px;
      border-radius: ${theme.borderRadius.sm};
    }
  }

  /* Form elements */
  button {
    font-family: inherit;
  }

  input, textarea, select {
    font-family: inherit;
  }

  /* Focus styles */
  *:focus-visible {
    outline: 2px solid ${theme.colors.border.focus};
    outline-offset: 2px;
  }

  /* Scrollbar styles */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${theme.colors.surface.secondary};
    border-radius: ${theme.borderRadius.full};
  }

  ::-webkit-scrollbar-thumb {
    background: ${theme.colors.border.secondary};
    border-radius: ${theme.borderRadius.full};
    transition: background-color 0.2s ease;

    &:hover {
      background: ${theme.colors.text.tertiary};
    }
  }

  /* Selection styles */
  ::selection {
    background-color: ${theme.colors.brand[200]};
    color: ${theme.colors.brand[900]};
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  /* High contrast mode support */
  @media (prefers-contrast: high) {
    * {
      border-color: currentColor !important;
    }
  }

  /* Print styles */
  @media print {
    * {
      background: transparent !important;
      color: black !important;
      box-shadow: none !important;
      text-shadow: none !important;
    }

    a,
    a:visited {
      text-decoration: underline;
    }

    a[href]:after {
      content: " (" attr(href) ")";
    }

    abbr[title]:after {
      content: " (" attr(title) ")";
    }

    .no-print {
      display: none !important;
    }
  }

  /* Utility classes */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .skip-link {
    position: absolute;
    top: -40px;
    left: 6px;
    background: ${theme.colors.surface.primary};
    color: ${theme.colors.text.primary};
    padding: 8px;
    text-decoration: none;
    border-radius: ${theme.borderRadius.md};
    z-index: ${theme.zIndex[50]};

    &:focus {
      top: 6px;
    }
  }

  /* Animation utilities */
  .animate-fade-in {
    animation: fadeIn 0.3s ease-out;
  }

  .animate-slide-up {
    animation: slideUp 0.3s ease-out;
  }

  .animate-scale-in {
    animation: scaleIn 0.3s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.95);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
`;