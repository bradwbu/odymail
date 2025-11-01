/**
 * Main Application Layout - Responsive layout with navigation and content areas
 */

import React, { useState, useEffect } from 'react';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../ui';
import { Navigation } from './Navigation';
import { MobileNavigation } from './MobileNavigation';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const LayoutContainer = styled.div`
  display: flex;
  min-height: 100vh;
  background-color: ${({ theme }) => theme.colors.background.primary};
  transition: background-color 0.3s ease;
`;

const Sidebar = styled(motion.aside)<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 280px;
  background-color: ${({ theme }) => theme.colors.surface.primary};
  border-right: 1px solid ${({ theme }) => theme.colors.border.primary};
  box-shadow: ${({ theme }) => theme.shadows.lg};
  z-index: ${({ theme }) => theme.zIndex[40]};
  overflow-y: auto;
  
  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    position: relative;
    box-shadow: none;
  }
`;

const MainContent = styled.main<{ sidebarOpen: boolean }>`
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  margin-left: 0;
  
  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    margin-left: ${({ sidebarOpen }) => sidebarOpen ? '280px' : '0'};
    transition: margin-left 0.3s ease;
  }
`;

const Header = styled.header`
  background-color: ${({ theme }) => theme.colors.surface.primary};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.primary};
  box-shadow: ${({ theme }) => theme.shadows.sm};
  position: sticky;
  top: 0;
  z-index: ${({ theme }) => theme.zIndex[30]};
  transition: all 0.3s ease;
`;

const HeaderContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 ${({ theme }) => theme.spacing[4]};
  height: 4rem;
  
  @media (min-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: 0 ${({ theme }) => theme.spacing[6]};
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
`;

const MenuButton = styled(Button)`
  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    display: none;
  }
`;

const SidebarToggle = styled(Button)`
  display: none;
  
  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    display: flex;
  }
`;

const Logo = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[2]};
`;

const LogoIcon = styled.div`
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.brand[500]}, ${({ theme }) => theme.colors.brand[600]});
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
`;

const LogoText = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.xl};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0;
  
  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    display: none;
  }
`;

const ContentArea = styled.div`
  flex: 1;
  padding: ${({ theme }) => theme.spacing[6]};
  overflow-y: auto;
  
  @media (max-width: ${({ theme }) => theme.breakpoints.sm}) {
    padding: ${({ theme }) => theme.spacing[4]};
  }
`;

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: ${({ theme }) => theme.zIndex[30]};
  
  @media (min-width: ${({ theme }) => theme.breakpoints.lg}) {
    display: none;
  }
`;

const ThemeToggle = styled(Button)`
  position: relative;
  overflow: hidden;
`;

interface AppLayoutProps {
  children: React.ReactNode;
  onComposeClick?: () => void;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children, onComposeClick }) => {
  const { theme, mode, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDesktop = useMediaQuery(`(min-width: ${theme.breakpoints.lg})`);

  // Close mobile menu when switching to desktop
  useEffect(() => {
    if (isDesktop) {
      setMobileMenuOpen(false);
    }
  }, [isDesktop]);

  // Handle escape key to close mobile menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);

  const sidebarVariants = {
    open: {
      x: 0,
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 30,
      },
    },
    closed: {
      x: '-100%',
      transition: {
        type: 'spring',
        stiffness: 300,
        damping: 30,
      },
    },
  };

  const overlayVariants = {
    open: {
      opacity: 1,
      transition: { duration: 0.2 },
    },
    closed: {
      opacity: 0,
      transition: { duration: 0.2 },
    },
  };

  const logoVariants = {
    hover: {
      scale: 1.05,
      transition: { duration: 0.2 },
    },
  };

  return (
    <LayoutContainer>
      {/* Desktop Sidebar */}
      {isDesktop && (
        <AnimatePresence>
          {sidebarOpen && (
            <Sidebar
              isOpen={sidebarOpen}
              initial="closed"
              animate="open"
              exit="closed"
              variants={sidebarVariants}
              role="navigation"
              aria-label="Main navigation"
            >
              <Navigation onItemClick={() => {}} />
            </Sidebar>
          )}
        </AnimatePresence>
      )}

      {/* Mobile Sidebar */}
      {!isDesktop && (
        <>
          <AnimatePresence>
            {mobileMenuOpen && (
              <>
                <Overlay
                  initial="closed"
                  animate="open"
                  exit="closed"
                  variants={overlayVariants}
                  onClick={() => setMobileMenuOpen(false)}
                />
                <Sidebar
                  isOpen={mobileMenuOpen}
                  initial="closed"
                  animate="open"
                  exit="closed"
                  variants={sidebarVariants}
                  role="navigation"
                  aria-label="Main navigation"
                >
                  <MobileNavigation 
                    onItemClick={() => setMobileMenuOpen(false)}
                    onClose={() => setMobileMenuOpen(false)}
                  />
                </Sidebar>
              </>
            )}
          </AnimatePresence>
        </>
      )}

      <MainContent sidebarOpen={isDesktop && sidebarOpen}>
        <Header>
          <HeaderContent>
            <HeaderLeft>
              <MenuButton
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Open navigation menu"
                leftIcon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                }
              />
              
              <SidebarToggle
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
                leftIcon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                          d={sidebarOpen ? "M11 19l-7-7 7-7M21 12H3" : "M3 12h18M9 5l7 7-7 7"} />
                  </svg>
                }
              />

              <Logo
                variants={logoVariants}
                whileHover="hover"
                role="banner"
              >
                <LogoIcon aria-hidden="true">O</LogoIcon>
                <LogoText>Odyssie</LogoText>
              </Logo>
            </HeaderLeft>

            <HeaderRight>
              <ThemeToggle
                variant="ghost"
                size="sm"
                onClick={toggleTheme}
                aria-label={`Switch to ${mode === 'light' ? 'dark' : 'light'} theme`}
                leftIcon={
                  <motion.div
                    key={mode}
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    {mode === 'light' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="5" />
                        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                      </svg>
                    )}
                  </motion.div>
                }
              >
                {mode === 'light' ? 'Dark' : 'Light'}
              </ThemeToggle>

              {onComposeClick && (
                <Button
                  onClick={onComposeClick}
                  size="sm"
                  leftIcon={
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  }
                >
                  Compose
                </Button>
              )}
            </HeaderRight>
          </HeaderContent>
        </Header>

        <ContentArea role="main" aria-label="Main content">
          {children}
        </ContentArea>
      </MainContent>
    </LayoutContainer>
  );
};