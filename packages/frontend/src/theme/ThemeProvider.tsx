/**
 * Theme Provider - Context for theme management and CSS-in-JS integration
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ThemeProvider as EmotionThemeProvider } from '@emotion/react';
import { Theme, ThemeMode, themes } from './theme';

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
  defaultMode?: ThemeMode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ 
  children, 
  defaultMode = 'light' 
}) => {
  const [mode, setMode] = useState<ThemeMode>(() => {
    // Check localStorage for saved theme preference
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme-mode') as ThemeMode;
      if (saved && (saved === 'light' || saved === 'dark')) {
        return saved;
      }
      
      // Check system preference
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return defaultMode;
  });

  const theme = themes[mode];

  const toggleTheme = () => {
    setMode(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  // Save theme preference to localStorage
  useEffect(() => {
    localStorage.setItem('theme-mode', mode);
  }, [mode]);

  // Apply theme to document root for CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    
    // Set CSS custom properties for theme colors
    root.style.setProperty('--color-bg-primary', theme.colors.background.primary);
    root.style.setProperty('--color-bg-secondary', theme.colors.background.secondary);
    root.style.setProperty('--color-bg-tertiary', theme.colors.background.tertiary);
    root.style.setProperty('--color-bg-elevated', theme.colors.background.elevated);
    
    root.style.setProperty('--color-text-primary', theme.colors.text.primary);
    root.style.setProperty('--color-text-secondary', theme.colors.text.secondary);
    root.style.setProperty('--color-text-tertiary', theme.colors.text.tertiary);
    root.style.setProperty('--color-text-inverse', theme.colors.text.inverse);
    
    root.style.setProperty('--color-border-primary', theme.colors.border.primary);
    root.style.setProperty('--color-border-secondary', theme.colors.border.secondary);
    root.style.setProperty('--color-border-focus', theme.colors.border.focus);
    
    root.style.setProperty('--color-surface-primary', theme.colors.surface.primary);
    root.style.setProperty('--color-surface-secondary', theme.colors.surface.secondary);
    root.style.setProperty('--color-surface-hover', theme.colors.surface.hover);
    root.style.setProperty('--color-surface-active', theme.colors.surface.active);
    
    // Brand colors
    root.style.setProperty('--color-brand-500', theme.colors.brand[500]);
    root.style.setProperty('--color-brand-600', theme.colors.brand[600]);
    root.style.setProperty('--color-brand-700', theme.colors.brand[700]);
    
    // Semantic colors
    root.style.setProperty('--color-success-500', theme.colors.semantic.success[500]);
    root.style.setProperty('--color-warning-500', theme.colors.semantic.warning[500]);
    root.style.setProperty('--color-error-500', theme.colors.semantic.error[500]);
    
    // Add theme class to body for conditional styling
    document.body.className = document.body.className.replace(/theme-\w+/g, '');
    document.body.classList.add(`theme-${mode}`);
  }, [theme, mode]);

  const contextValue: ThemeContextValue = {
    theme,
    mode,
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      <EmotionThemeProvider theme={theme}>
        {children}
      </EmotionThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};