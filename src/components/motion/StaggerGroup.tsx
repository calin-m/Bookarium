'use client';

import React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { staggerContainerVariants } from './motion-config';

export interface StaggerGroupProps extends HTMLMotionProps<'div'> {
  children: React.ReactNode;
  className?: string;
}

export const StaggerGroup: React.FC<StaggerGroupProps> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className={className}
      {...props}
    >
      {children}
    </motion.div>
  );
};

