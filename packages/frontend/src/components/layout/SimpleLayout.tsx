/**
 * Simple Application Layout - Responsive layout with modern design
 */

import React, { useState } from 'react';
import styled from '@emotion/styled';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui';

const LayoutContainer = styled.div`
  display: flex;
  min-height: 100vh;
  background-color: var(--color-bg-primary);
  transition: background-color 0.3s ease;
`;

const Sidebar = styled(motion.aside)<{ isOpen: boolean }>`
  position: fixed;
  top: 0;
  left: 0;
  height: 100vh;
  width: 280px;
  background-color: var(--color-surface-primary);
  border-right: 1px solid var(--color-border-primary);
  box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  z-index: 40;
  overflow-y: auto;
  
  @media (min-width: 1024px) {
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
  
  @media (min-width: 1024px) {
    margin-left: ${({ sidebarOpen }) => sidebarOpen ? '280px' : '0'};
    transition: margin-left 0.3s ease;
  }
`;

const Header = styled.header`
  background-color: var(--color-surface-primary);
  border-bottom: 1px solid var(--color-border-primary);
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  position: sticky;
  top: 0;
  z-index: 30;
`;

const HeaderContent = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1rem;
  height: 4rem;
  
  @media (min-width: 640px) {
    padding: 0 1.5rem;
  }
`;

const HeaderLeft = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const HeaderRight = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
`;

const Logo = styled(motion.div)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const LogoIcon = styled.div`
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #0ea5e9, #0284c7);
  border-radius: 0.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 700;
  font-size: 1.125rem;
`;

const LogoText = styled.h1`
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  
  @media (max-width: 640px) {
    display: none;
  }
`;

const ContentArea = styled.div`
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
  
  @media (max-width: 640px) {
    padding: 1rem;
  }
`;

const Overlay = styled(motion.div)`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 30;
  
  @media (min-width: 1024px) {
    display: none;
  }
`;

const NavigationContainer = styled.nav`
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1.5rem 0;
`;

const NavigationHeader = styled.div`
  padding: 0 1.5rem;
  margin-bottom: 2rem;
`;

const NavigationList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
  flex: 1;
`;

const NavigationItem = styled(motion.li)`
  margin-bottom: 0.25rem;
`;

const NavigationLink = styled(motion.button)<{ isActive?: boolean }>`
  display: flex;
  align-items: center;
  width: 100%;
  padding: 0.75rem 1.5rem;
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  border-radius: 0;
  position: relative;
  transition: all 0.2s ease;
  min-height: 44px;
  
  color: ${({ isActive }) => 
    isActive ? '#0284c7' : 'var(--color-text-secondary)'};
  
  background-color: ${({ isActive }) => 
    isActive ? 'rgba(14, 165, 233, 0.1)' : 'transparent'};
  
  &:hover {
    color: var(--color-text-primary);
    background-color: var(--color-surface-hover);
  }
  
  &:focus {
    outline: none;
    box-shadow: inset 0 0 0 2px #0ea5e9;
  }
  
  ${({ isActive }) => isActive && `
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background-color: #0284c7;
    }
  `}
`;

const LinkIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-right: 0.75rem;
  flex-shrink: 0;
`;

const LinkText = styled.span`
  font-size: 0.875rem;
  font-weight: 500;
  flex: 1;
`;

interface SimpleLayoutProps {
  children: React.ReactNode;
  onComposeClick?: () => void;
}

const navigationItems = [
  { id: 'inbox', label: 'Inbox', icon: 'inbox', active: true },
  { id: 'sent', label: 'Sent', icon: 'send' },
  { id: 'drafts', label: 'Drafts', icon: 'file-text' },
  { id: 'files', label: 'Files', icon: 'folder' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const getIcon = (iconName: string) => {
  const icons: Record<string, JSX.Element> = {
    inbox: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
      </svg>
    ),
    send: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22,2 15,22 11,13 2,9 22,2" />
      </svg>
    ),
    'file-text': (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2Z" />
        <polyline points="14,2 14,8 20,8" />
      </svg>
    ),
    folder: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M22,19A2,2 0 0,1 20,21H4A2,2 0 0,1 2,19V5A2,2 0 0,1 4,3H9L11,5H20A2,2 0 0,1 22,7V19Z" />
      </svg>
    ),
    settings: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4,15A1.65,1.65 0 0,0 20.25,16.5A1.65,1.65 0 0,0 22,15V9A1.65,1.65 0 0,0 20.25,7.5A1.65,1.65 0 0,0 19.4,9L19.4,15Z" />
      </svg>
    ),
  };
  
  return icons[iconName] || icons.folder;
};

export const SimpleLayout: React.FC<SimpleLayoutProps> = ({ children, onComposeClick }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeItem, setActiveItem] = useState('inbox');

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

  const handleItemClick = (itemId: string) => {
    setActiveItem(itemId);
    setMobileMenuOpen(false);
  };

  return (
    <LayoutContainer>
      {/* Desktop Sidebar */}
      <AnimatePresence>
        {(sidebarOpen || window.innerWidth >= 1024) && (
          <Sidebar
            isOpen={sidebarOpen}
            initial="closed"
            animate="open"
            exit="closed"
            variants={sidebarVariants}
            role="navigation"
            aria-label="Main navigation"
          >
            <NavigationContainer>
              <NavigationHeader>
                <Logo>
                  <LogoIcon aria-hidden="true">O</LogoIcon>
                  <LogoText>Odyssie</LogoText>
                </Logo>
              </NavigationHeader>

              <NavigationList>
                {navigationItems.map((item) => (
                  <NavigationItem key={item.id}>
                    <NavigationLink
                      isActive={activeItem === item.id}
                      onClick={() => handleItemClick(item.id)}
                      aria-current={activeItem === item.id ? 'page' : undefined}
                    >
                      <LinkIcon aria-hidden="true">
                        {getIcon(item.icon)}
                      </LinkIcon>
                      <LinkText>{item.label}</LinkText>
                    </NavigationLink>
                  </NavigationItem>
                ))}
              </NavigationList>
            </NavigationContainer>
          </Sidebar>
        )}
      </AnimatePresence>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && window.innerWidth < 1024 && (
          <Overlay
            initial="closed"
            animate="open"
            exit="closed"
            variants={overlayVariants}
            onClick={() => setMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <MainContent sidebarOpen={sidebarOpen}>
        <Header>
          <HeaderContent>
            <HeaderLeft>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (window.innerWidth < 1024) {
                    setMobileMenuOpen(!mobileMenuOpen);
                  } else {
                    setSidebarOpen(!sidebarOpen);
                  }
                }}
                aria-label="Toggle navigation"
                leftIcon={
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                }
              />

              <Logo>
                <LogoIcon aria-hidden="true">O</LogoIcon>
                <LogoText>Odyssie</LogoText>
              </Logo>
            </HeaderLeft>

            <HeaderRight>
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