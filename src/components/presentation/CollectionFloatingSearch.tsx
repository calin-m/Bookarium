'use client';

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useVisualViewportKeyboard } from '@/hooks/useVisualViewportKeyboard';

export interface CollectionFloatingSearchProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  clearAriaLabel?: string;
}

export const CollectionFloatingSearch: React.FC<CollectionFloatingSearchProps> = ({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search collection...',
  searchAriaLabel = 'Search collection',
  clearAriaLabel = 'Clear search query',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { keyboardHeight } = useVisualViewportKeyboard();

  useEffect(() => {
    if (!isOpen) return;

    // Focus input on mount to prompt the software keyboard on tactile screens
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Smoothly elevate above virtual keyboard when tactile screen summons keyboard, or rest above capsule dock
  const bottomPosition = keyboardHeight > 0
    ? `calc(1rem + ${keyboardHeight}px + env(safe-area-inset-bottom, 0px))`
    : `calc(5.25rem + env(safe-area-inset-bottom, 0px))`;

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 pointer-events-none"
          data-testid="collection-floating-search-wrapper"
        >
          {/* Click-outside backdrop: transparent & unblurred so user sees live filtered content while typing */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 pointer-events-auto touch-none"
            onClick={onClose}
            data-testid="collection-floating-search-backdrop"
            aria-hidden="true"
          />

          {/* Floating search container with prominent drop shadow and dynamic keyboard elevation */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ bottom: bottomPosition }}
            className="fixed inset-x-0 mx-auto w-[92vw] max-w-md pointer-events-auto transition-all duration-200 ease-out"
            data-testid="collection-floating-search-container"
          >
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-card/95 backdrop-blur-md border border-border/80 shadow-[0_12px_36px_-4px_rgba(0,0,0,0.28),0_4px_14px_-2px_rgba(0,0,0,0.16)] dark:shadow-[0_0_32px_rgba(217,119,6,0.18),0_12px_44px_rgba(0,0,0,0.7),0_0_0_1px_rgba(217,119,6,0.25)] rounded-2xl text-foreground ring-1 ring-black/5 dark:ring-white/10">
              <Search className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchAriaLabel}
                data-testid="collection-floating-search-input"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden"
                autoFocus
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    onSearchChange('');
                    inputRef.current?.focus();
                  }}
                  data-testid="collection-floating-search-clear-btn"
                  className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  aria-label={clearAriaLabel}
                >
                  <X className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
