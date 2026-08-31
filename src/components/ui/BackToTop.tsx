'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

export interface BackToTopProps {
  threshold?: number;
  className?: string;
}

export const BackToTop: React.FC<BackToTopProps> = ({
  threshold = 300,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const onScroll = () => {
      setIsVisible(window.scrollY > threshold);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [threshold]);

  const scrollToTop = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          type="button"
          onClick={scrollToTop}
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          transition={{ duration: 0.2 }}
          className={`fixed bottom-6 right-6 z-40 p-3 rounded-full bg-card hover:bg-muted text-foreground border border-border shadow-booksaw hover:shadow-booksaw-hover transition-colors active:scale-95 group cursor-pointer focus:outline-hidden focus:ring-2 focus:ring-primary ${className}`}
          aria-label="Back to top"
          title="Back to top"
          data-testid="back-to-top-btn"
        >
          <ArrowUp className="w-5 h-5 text-primary group-hover:-translate-y-0.5 transition-transform" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};