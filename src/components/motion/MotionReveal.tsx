'use client';

import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { fadeInVariants } from './motion-config';

export interface MotionRevealProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

export const MotionReveal: React.FC<MotionRevealProps> = ({
  children,
  delay = 0,
  className = '',
  ...props
}) => {
  return (
    <motion.div
      variants={fadeInVariants}
      initial="hidden"
      animate="visible"
      transition={{ delay }}
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

