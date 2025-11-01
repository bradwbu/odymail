/**
 * Animation System - Framer Motion presets and configurations
 */

import { Variants, Transition } from 'framer-motion';

// Easing curves
export const easings = {
  easeInOut: [0.4, 0, 0.2, 1],
  easeOut: [0, 0, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  sharp: [0.4, 0, 0.6, 1],
  bounce: [0.68, -0.55, 0.265, 1.55],
} as const;

// Duration presets
export const durations = {
  fast: 0.15,
  normal: 0.25,
  slow: 0.35,
  slower: 0.5,
} as const;

// Common transitions
export const transitions = {
  fast: {
    duration: durations.fast,
    ease: easings.easeOut,
  },
  normal: {
    duration: durations.normal,
    ease: easings.easeInOut,
  },
  slow: {
    duration: durations.slow,
    ease: easings.easeInOut,
  },
  bounce: {
    duration: durations.normal,
    ease: easings.bounce,
  },
  spring: {
    type: 'spring',
    stiffness: 300,
    damping: 30,
  },
  springBouncy: {
    type: 'spring',
    stiffness: 400,
    damping: 25,
  },
} as const;

// Fade animations
export const fadeVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: transitions.normal,
  },
  exit: {
    opacity: 0,
    transition: transitions.fast,
  },
};

// Slide animations
export const slideVariants = {
  up: {
    hidden: {
      opacity: 0,
      y: 20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: transitions.normal,
    },
    exit: {
      opacity: 0,
      y: -20,
      transition: transitions.fast,
    },
  },
  down: {
    hidden: {
      opacity: 0,
      y: -20,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: transitions.normal,
    },
    exit: {
      opacity: 0,
      y: 20,
      transition: transitions.fast,
    },
  },
  left: {
    hidden: {
      opacity: 0,
      x: 20,
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: transitions.normal,
    },
    exit: {
      opacity: 0,
      x: -20,
      transition: transitions.fast,
    },
  },
  right: {
    hidden: {
      opacity: 0,
      x: -20,
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: transitions.normal,
    },
    exit: {
      opacity: 0,
      x: 20,
      transition: transitions.fast,
    },
  },
} as const;

// Scale animations
export const scaleVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: transitions.fast,
  },
};

// Modal/Dialog animations
export const modalVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.9,
    y: 20,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: transitions.spring,
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    y: 20,
    transition: transitions.fast,
  },
};

// Toast notification animations
export const toastVariants: Variants = {
  hidden: {
    opacity: 0,
    y: -50,
    scale: 0.9,
  },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: transitions.springBouncy,
  },
  exit: {
    opacity: 0,
    y: -50,
    scale: 0.9,
    transition: transitions.fast,
  },
};

// Stagger animations for lists
export const staggerContainer: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  hidden: {
    opacity: 0,
    y: 20,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: transitions.normal,
  },
};

// Loading animations
export const loadingVariants: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};

export const pulseVariants: Variants = {
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: easings.easeInOut,
    },
  },
};

// Hover and tap animations
export const hoverTap = {
  whileHover: {
    scale: 1.02,
    transition: transitions.fast,
  },
  whileTap: {
    scale: 0.98,
    transition: transitions.fast,
  },
};

export const buttonHover = {
  whileHover: {
    scale: 1.05,
    transition: transitions.fast,
  },
  whileTap: {
    scale: 0.95,
    transition: transitions.fast,
  },
};

// Page transition animations
export const pageVariants: Variants = {
  initial: {
    opacity: 0,
    x: 20,
  },
  in: {
    opacity: 1,
    x: 0,
    transition: transitions.normal,
  },
  out: {
    opacity: 0,
    x: -20,
    transition: transitions.fast,
  },
};

// Drawer/Sidebar animations
export const drawerVariants = {
  left: {
    hidden: {
      x: '-100%',
      transition: transitions.normal,
    },
    visible: {
      x: 0,
      transition: transitions.normal,
    },
  },
  right: {
    hidden: {
      x: '100%',
      transition: transitions.normal,
    },
    visible: {
      x: 0,
      transition: transitions.normal,
    },
  },
} as const;

// Progress bar animations
export const progressVariants: Variants = {
  initial: {
    scaleX: 0,
    originX: 0,
  },
  animate: (progress: number) => ({
    scaleX: progress / 100,
    transition: transitions.normal,
  }),
};

// Accordion animations
export const accordionVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: transitions.normal,
  },
  expanded: {
    height: 'auto',
    opacity: 1,
    transition: transitions.normal,
  },
};