'use client';

import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { fadeInVariants } from './motion-config';

export interface MotionRevealProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  staggerChild?: boolean;
  disabled?: boolean;
}

export const MotionReveal: React.FC<MotionRevealProps> = ({
  children,
  delay = 0,
  className = '',
  staggerChild = false,
  disabled = false,
  ...props
}) => {
  if (staggerChild) {
    return (
      <motion.div
        variants={fadeInVariants}
        initial={disabled ? false : undefined}
        className={className}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={fadeInVariants}
      initial={disabled ? false : 'hidden'}
      animate="visible"
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

