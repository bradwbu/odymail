/**
 * Animation Demo Component - Showcase the animation system
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styled from '@emotion/styled';
import { 
  Button, 
  Modal, 
  Card, 
  Input, 
  useToast,
  fadeVariants,
  slideVariants,
  scaleVariants,
  staggerContainer,
  staggerItem,
} from './ui';
import { Theme } from '../theme/theme';

const DemoContainer = styled.div<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[8]};
  max-width: 1200px;
  margin: 0 auto;
`;

const Section = styled.section<{ theme: Theme }>`
  margin-bottom: ${({ theme }) => theme.spacing[12]};
`;

const SectionTitle = styled.h2<{ theme: Theme }>`
  font-size: ${({ theme }) => theme.typography.fontSize['2xl'][0]};
  font-weight: ${({ theme }) => theme.typography.fontWeight.bold};
  color: ${({ theme }) => theme.colors.text.primary};
  margin-bottom: ${({ theme }) => theme.spacing[6]};
`;

const Grid = styled.div<{ theme: Theme }>`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: ${({ theme }) => theme.spacing[4]};
  margin-bottom: ${({ theme }) => theme.spacing[6]};
`;

const ButtonGrid = styled.div<{ theme: Theme }>`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing[3]};
  margin-bottom: ${({ theme }) => theme.spacing[6]};
`;

const AnimatedList = styled(motion.div)<{ theme: Theme }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing[3]};
`;

const ListItem = styled(motion.div)<{ theme: Theme }>`
  padding: ${({ theme }) => theme.spacing[4]};
  background-color: ${({ theme }) => theme.colors.surface.secondary};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border: 1px solid ${({ theme }) => theme.colors.border.primary};
`;

export const AnimationDemo: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showList, setShowList] = useState(false);
  const [animationType, setAnimationType] = useState<'fade' | 'slide' | 'scale'>('fade');
  const toast = useToast();

  const listItems = [
    'First animated item',
    'Second animated item', 
    'Third animated item',
    'Fourth animated item',
    'Fifth animated item',
  ];

  const getVariants = () => {
    switch (animationType) {
      case 'slide':
        return slideVariants.up;
      case 'scale':
        return scaleVariants;
      default:
        return fadeVariants;
    }
  };

  return (
    <DemoContainer>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '2rem', textAlign: 'center' }}>
          Animation System Demo
        </h1>

        {/* Button Variants */}
        <Section>
          <SectionTitle>Button Variants</SectionTitle>
          <ButtonGrid>
            <Button variant="primary">Primary Button</Button>
            <Button variant="secondary">Secondary Button</Button>
            <Button variant="outline">Outline Button</Button>
            <Button variant="ghost">Ghost Button</Button>
            <Button variant="danger">Danger Button</Button>
            <Button loading>Loading Button</Button>
          </ButtonGrid>
          
          <ButtonGrid>
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
          </ButtonGrid>
        </Section>

        {/* Cards */}
        <Section>
          <SectionTitle>Animated Cards</SectionTitle>
          <Grid>
            <Card hover clickable onClick={() => toast.info('Card clicked!')}>
              <h3>Hoverable Card</h3>
              <p>This card has hover animations and is clickable.</p>
            </Card>
            <Card padding="lg">
              <h3>Large Padding Card</h3>
              <p>This card has larger padding for more spacious content.</p>
            </Card>
            <Card padding="sm">
              <h3>Small Padding Card</h3>
              <p>Compact card with minimal padding.</p>
            </Card>
          </Grid>
        </Section>

        {/* Form Elements */}
        <Section>
          <SectionTitle>Form Elements</SectionTitle>
          <Grid>
            <Input 
              label="Email Address" 
              placeholder="Enter your email"
              leftIcon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              }
            />
            <Input 
              label="Password" 
              type="password"
              placeholder="Enter your password"
              error="Password is required"
            />
            <Input 
              label="Search" 
              placeholder="Search..."
              variant="filled"
              rightIcon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
              }
            />
          </Grid>
        </Section>

        {/* Modal Demo */}
        <Section>
          <SectionTitle>Modal Animations</SectionTitle>
          <ButtonGrid>
            <Button onClick={() => setIsModalOpen(true)}>Open Modal</Button>
            <Button onClick={() => toast.success('Success!', { message: 'This is a success message' })}>
              Success Toast
            </Button>
            <Button onClick={() => toast.error('Error!', { message: 'This is an error message' })}>
              Error Toast
            </Button>
            <Button onClick={() => toast.warning('Warning!', { message: 'This is a warning message' })}>
              Warning Toast
            </Button>
          </ButtonGrid>
        </Section>

        {/* List Animations */}
        <Section>
          <SectionTitle>List Animations</SectionTitle>
          <ButtonGrid>
            <Button onClick={() => setShowList(!showList)}>
              {showList ? 'Hide' : 'Show'} Animated List
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setAnimationType('fade')}
              disabled={animationType === 'fade'}
            >
              Fade
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setAnimationType('slide')}
              disabled={animationType === 'slide'}
            >
              Slide
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setAnimationType('scale')}
              disabled={animationType === 'scale'}
            >
              Scale
            </Button>
          </ButtonGrid>

          <AnimatePresence>
            {showList && (
              <AnimatedList
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                exit="hidden"
              >
                {listItems.map((item, index) => (
                  <ListItem
                    key={index}
                    variants={staggerItem}
                  >
                    {item}
                  </ListItem>
                ))}
              </AnimatedList>
            )}
          </AnimatePresence>
        </Section>

        {/* Modal */}
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Demo Modal"
          size="md"
        >
          <div>
            <p style={{ marginBottom: '1rem' }}>
              This is a demo modal with smooth animations. It includes:
            </p>
            <ul style={{ marginBottom: '1.5rem', paddingLeft: '1.5rem' }}>
              <li>Backdrop blur effect</li>
              <li>Scale and fade animations</li>
              <li>Keyboard navigation (ESC to close)</li>
              <li>Click outside to close</li>
            </ul>
            <ButtonGrid>
              <Button onClick={() => setIsModalOpen(false)}>Close Modal</Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  toast.info('Action performed!');
                  setIsModalOpen(false);
                }}
              >
                Perform Action
              </Button>
            </ButtonGrid>
          </div>
        </Modal>
      </motion.div>
    </DemoContainer>
  );
};