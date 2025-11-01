/**
 * Mobile Navigation Component - Touch-optimized navigation with gestures
 */

import React, { useState, useRef, useEffect } from 'react';
import styled from '@emotion/styled';
import { motion, PanInfo, useMotionValue } from 'framer-motion';
import { useTheme } from '../../theme/ThemeProvider';
import { Button } from '../ui';

const MobileNavigationContainer = styled.nav`
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: ${({ theme }) => theme.colors.surface.primary};
  position: relative;
`;

const NavigationHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${({ theme }) => theme.spacing[6]};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border.primary};
`;

const Logo = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[3]};
`;

const LogoIcon = styled.div`
  width: 36px;
  height: 36px;
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.brand[500]}, ${({ theme }) => theme.colors.brand[600]});
  border-radius: ${({ theme }) => theme.borderRadius.xl};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
`;

const LogoText = styled.div`
  display: flex;
  flex-direction: column;
`;

const LogoTitle = styled.h1`
  font-size: ${({ theme }) => theme.typography.fontSize.lg};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin: 0;
  line-height: 1.2;
`;

const LogoSubtitle = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  color: ${({ theme }) => theme.colors.text.secondary};
  line-height: 1.2;
`;

const CloseButton = styled(Button)`
  padding: ${({ theme }) => theme.spacing[2]};
  min-width: auto;
`;

const NavigationContent = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing[4]} 0;
  -webkit-overflow-scrolling: touch;
`;

const NavigationList = styled.ul`
  list-style: none;
  padding: 0;
  margin: 0;
`;

const NavigationSection = styled.div`
  margin-bottom: ${({ theme }) => theme.spacing[6]};
`;

const SectionTitle = styled.h3`
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  color: ${({ theme }) => theme.colors.text.tertiary};
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 ${({ theme }) => theme.spacing[3]} 0;
  padding: 0 ${({ theme }) => theme.spacing[6]};
`;

const NavigationItem = styled(motion.li)<{ isActive?: boolean }>`
  margin-bottom: ${({ theme }) => theme.spacing[1]};
`;

const NavigationLink = styled(motion.button)<{ isActive?: boolean }>`
  display: flex;
  align-items: center;
  width: 100%;
  padding: ${({ theme }) => theme.spacing[4]} ${({ theme }) => theme.spacing[6]};
  background: none;
  border: none;
  text-align: left;
  cursor: pointer;
  border-radius: 0;
  position: relative;
  transition: all 0.2s ease;
  min-height: 56px; /* Touch-friendly height */
  
  color: ${({ theme, isActive }) => 
    isActive ? theme.colors.brand[600] : theme.colors.text.secondary};
  
  background-color: ${({ theme, isActive }) => 
    isActive ? theme.colors.brand[50] : 'transparent'};
  
  &:hover, &:active {
    color: ${({ theme }) => theme.colors.text.primary};
    background-color: ${({ theme }) => theme.colors.surface.hover};
  }
  
  &:focus {
    outline: none;
    box-shadow: inset 0 0 0 2px ${({ theme }) => theme.colors.border.focus};
  }
  
  ${({ theme, isActive }) => isActive && `
    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
      background-color: ${theme.colors.brand[600]};
    }
  `}
`;

const LinkIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-right: ${({ theme }) => theme.spacing[4]};
  flex-shrink: 0;
`;

const LinkText = styled.span`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  flex: 1;
`;

const Badge = styled.span`
  background-color: ${({ theme }) => theme.colors.brand[500]};
  color: white;
  font-size: ${({ theme }) => theme.typography.fontSize.xs};
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  padding: ${({ theme }) => theme.spacing[1]} ${({ theme }) => theme.spacing[2]};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  min-width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const SwipeIndicator = styled(motion.div)`
  position: absolute;
  top: 50%;
  right: ${({ theme }) => theme.spacing[4]};
  transform: translateY(-50%);
  width: 4px;
  height: 40px;
  background-color: ${({ theme }) => theme.colors.border.secondary};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  opacity: 0.5;
`;

const NavigationFooter = styled.div`
  padding: ${({ theme }) => theme.spacing[6]};
  border-top: 1px solid ${({ theme }) => theme.colors.border.primary};
  background-color: ${({ theme }) => theme.colors.surface.secondary};
`;

const UserProfile = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing[4]};
  padding: ${({ theme }) => theme.spacing[4]};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  background-color: ${({ theme }) => theme.colors.surface.primary};
`;

const UserAvatar = styled.div`
  width: 40px;
  height: 40px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background: linear-gradient(135deg, ${({ theme }) => theme.colors.brand[400]}, ${({ theme }) => theme.colors.brand[600]});
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: ${({ theme }) => theme.typography.fontWeight.semibold};
  font-size: ${({ theme }) => theme.typography.fontSize.base};
`;

const UserInfo = styled.div`
  flex: 1;
  min-width: 0;
`;

const UserName = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.base};
  font-weight: ${({ theme }) => theme.typography.fontWeight.medium};
  color: ${({ theme }) => theme.colors.text.primary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const UserEmail = styled.div`
  font-size: ${({ theme }) => theme.typography.fontSize.sm};
  color: ${({ theme }) => theme.colors.text.tertiary};
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

interface MobileNavigationProps {
  onItemClick: (item: string) => void;
  onClose: () => void;
}

const navigationItems = [
  {
    section: 'Mail',
    items: [
      { id: 'inbox', label: 'Inbox', icon: 'inbox', badge: 12, active: true },
      { id: 'sent', label: 'Sent', icon: 'send' },
      { id: 'drafts', label: 'Drafts', icon: 'file-text', badge: 3 },
      { id: 'archive', label: 'Archive', icon: 'archive' },
      { id: 'trash', label: 'Trash', icon: 'trash-2' },
    ],
  },
  {
    section: 'Storage',
    items: [
      { id: 'files', label: 'My Files', icon: 'folder' },
      { id: 'shared', label: 'Shared', icon: 'users' },
      { id: 'recent', label: 'Recent', icon: 'clock' },
    ],
  },
  {
    section: 'Account',
    items: [
      { id: 'settings', label: 'Settings', icon: 'settings' },
      { id: 'billing', label: 'Billing', icon: 'credit-card' },
      { id: 'security', label: 'Security', icon: 'shield' },
    ],
  },
];

const getIcon = (iconName: string) => {
  const icons: Record<string, JSX.Element> = {
    inbox: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="22,12 18,12 15,21 9,3 6,12 2,12" />
      </svg>
    ),
    send: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22,2 15,22 11,13 2,9 22,2" />
      </svg>
    ),
    'file-text': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2Z" />
        <polyline points="14,2 14,8 20,8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10,9 9,9 8,9" />
      </svg>
    ),
    archive: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="21,8 21,21 3,21 3,8" />
        <rect x="1" y="3" width="22" height="5" />
        <line x1="10" y1="12" x2="14" y2="12" />
      </svg>
    ),
    'trash-2': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <polyline points="3,6 5,6 21,6" />
        <path d="M19,6V20A2,2 0 0,1 17,22H7A2,2 0 0,1 5,20V6M8,6V4A2,2 0 0,1 10,2H14A2,2 0 0,1 16,4V6" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
      </svg>
    ),
    folder: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M22,19A2,2 0 0,1 20,21H4A2,2 0 0,1 2,19V5A2,2 0 0,1 4,3H9L11,5H20A2,2 0 0,1 22,7V19Z" />
      </svg>
    ),
    users: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M17,21V19A4,4 0 0,0 13,15H5A4,4 0 0,0 1,19V21" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23,21V19A4,4 0 0,0 19,15.3" />
        <path d="M16,3.13A4,4 0 0,1 16,10.87" />
      </svg>
    ),
    clock: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12,6 12,12 16,14" />
      </svg>
    ),
    settings: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4,15A1.65,1.65 0 0,0 20.25,16.5A1.65,1.65 0 0,0 22,15V9A1.65,1.65 0 0,0 20.25,7.5A1.65,1.65 0 0,0 19.4,9L19.4,15Z" />
      </svg>
    ),
    'credit-card': (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
    shield: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
        <path d="M12,22S2,16 2,10V6L12,2L22,6V10C22,16 12,22 12,22Z" />
      </svg>
    ),
  };
  
  return icons[iconName] || icons.folder;
};

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ onItemClick, onClose }) => {
  const { theme } = useTheme();
  const [activeItem, setActiveItem] = useState('inbox');
  const containerRef = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);

  const handleItemClick = (itemId: string) => {
    setActiveItem(itemId);
    onItemClick(itemId);
  };

  const handlePanEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Close navigation if swiped left significantly
    if (info.offset.x < -100 && info.velocity.x < -500) {
      onClose();
    }
  };

  const itemVariants = {
    tap: {
      scale: 0.98,
      backgroundColor: theme.colors.surface.active,
      transition: { duration: 0.1 },
    },
  };

  // Add touch event listeners for better mobile interaction
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let startY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      isScrolling = false;
    };

    const handleTouchMove = (e: TouchEvent) => {
      const currentY = e.touches[0].clientY;
      const diffY = Math.abs(currentY - startY);
      
      // Track scrolling for potential future use
      if (diffY > 10) {
        console.log('User is scrolling');
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  return (
    <MobileNavigationContainer
      ref={containerRef}
      as={motion.nav}
      drag="x"
      dragConstraints={{ left: -50, right: 0 }}
      dragElastic={0.2}
      onPanEnd={handlePanEnd}
      style={{ x: x as any }}
      role="navigation"
      aria-label="Mobile navigation"
    >
      <NavigationHeader>
        <Logo>
          <LogoIcon aria-hidden="true">O</LogoIcon>
          <LogoText>
            <LogoTitle>Odyssie</LogoTitle>
            <LogoSubtitle>Encrypted Email</LogoSubtitle>
          </LogoText>
        </Logo>
        
        <CloseButton
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </CloseButton>
      </NavigationHeader>

      <NavigationContent>
        <NavigationList>
          {navigationItems.map((section) => (
            <NavigationSection key={section.section}>
              <SectionTitle>{section.section}</SectionTitle>
              {section.items.map((item) => (
                <NavigationItem
                  key={item.id}
                  variants={itemVariants}
                  whileTap="tap"
                  isActive={activeItem === item.id}
                >
                  <NavigationLink
                    isActive={activeItem === item.id}
                    onClick={() => handleItemClick(item.id)}
                    aria-current={activeItem === item.id ? 'page' : undefined}
                    role="menuitem"
                  >
                    <LinkIcon aria-hidden="true">
                      {getIcon(item.icon)}
                    </LinkIcon>
                    <LinkText>{item.label}</LinkText>
                    {item.badge && (
                      <Badge aria-label={`${item.badge} unread`}>
                        {item.badge}
                      </Badge>
                    )}
                  </NavigationLink>
                </NavigationItem>
              ))}
            </NavigationSection>
          ))}
        </NavigationList>
      </NavigationContent>

      <SwipeIndicator
        animate={{
          scaleY: [1, 1.2, 1],
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      <NavigationFooter>
        <UserProfile>
          <UserAvatar aria-hidden="true">JD</UserAvatar>
          <UserInfo>
            <UserName>John Doe</UserName>
            <UserEmail>john@odyssie.net</UserEmail>
          </UserInfo>
        </UserProfile>
      </NavigationFooter>
    </MobileNavigationContainer>
  );
};