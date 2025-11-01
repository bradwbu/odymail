/**
 * Theme System - Light and Dark theme configurations
 */

import { colors, typography, spacing, borderRadius, shadows, zIndex, breakpoints } from './tokens';

export interface Theme {
  colors: {
    background: {
      primary: string;
      secondary: string;
      tertiary: string;
      elevated: string;
    };
    text: {
      primary: string;
      secondary: string;
      tertiary: string;
      inverse: string;
    };
    border: {
      primary: string;
      secondary: string;
      focus: string;
    };
    surface: {
      primary: string;
      secondary: string;
      hover: string;
      active: string;
    };
    brand: typeof colors.primary;
    semantic: {
      success: typeof colors.success;
      warning: typeof colors.warning;
      error: typeof colors.error;
    };
  };
  typography: typeof typography;
  spacing: typeof spacing;
  borderRadius: typeof borderRadius;
  shadows: typeof shadows;
  zIndex: typeof zIndex;
  breakpoints: typeof breakpoints;
}

// Light theme
export const lightTheme: Theme = {
  colors: {
    background: {
      primary: colors.gray[50],
      secondary: colors.gray[100],
      tertiary: colors.gray[200],
      elevated: '#ffffff',
    },
    text: {
      primary: colors.gray[900],
      secondary: colors.gray[700],
      tertiary: colors.gray[500],
      inverse: '#ffffff',
    },
    border: {
      primary: colors.gray[200],
      secondary: colors.gray[300],
      focus: colors.primary[500],
    },
    surface: {
      primary: '#ffffff',
      secondary: colors.gray[50],
      hover: colors.gray[100],
      active: colors.gray[200],
    },
    brand: colors.primary,
    semantic: {
      success: colors.success,
      warning: colors.warning,
      error: colors.error,
    },
  },
  typography,
  spacing,
  borderRadius,
  shadows,
  zIndex,
  breakpoints,
};

// Dark theme
export const darkTheme: Theme = {
  colors: {
    background: {
      primary: colors.gray[900],
      secondary: colors.gray[800],
      tertiary: colors.gray[700],
      elevated: colors.gray[800],
    },
    text: {
      primary: colors.gray[50],
      secondary: colors.gray[300],
      tertiary: colors.gray[400],
      inverse: colors.gray[900],
    },
    border: {
      primary: colors.gray[700],
      secondary: colors.gray[600],
      focus: colors.primary[400],
    },
    surface: {
      primary: colors.gray[800],
      secondary: colors.gray[700],
      hover: colors.gray[600],
      active: colors.gray[500],
    },
    brand: colors.primary,
    semantic: {
      success: colors.success,
      warning: colors.warning,
      error: colors.error,
    },
  },
  typography,
  spacing,
  borderRadius,
  shadows,
  zIndex,
  breakpoints,
};

// Theme context type
export type ThemeMode = 'light' | 'dark';

export const themes = {
  light: lightTheme,
  dark: darkTheme,
} as const;