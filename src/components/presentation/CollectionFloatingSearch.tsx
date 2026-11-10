'use client';

import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ArrowRight } from 'lucide-react';
import { useVisualViewportKeyboard } from '@/hooks/useVisualViewportKeyboard';
import { smartScrollToContent } from '@/lib/scroll-utils';

export interface CollectionFloatingSearchProps {
  isOpen: boolean;
  onClose: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  clearAriaLabel?: string;
  /**
   * When true (used by Catalog), typing updates local input state,
   * and search execution waits for Enter / virtual keyboard 'Search' / submit button.
   */
  submitOnEnter?: boolean;
  onSubmit?: (query: string) => void;
  /**
   * Optional DOM element ID to smoothly center into view upon search submission.
   */
  contentAnchorId?: string;
}

export const CollectionFloatingSearch: React.FC<CollectionFloatingSearchProps> = ({
  isOpen,
  onClose,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search collection...',
  searchAriaLabel = 'Search collection',
  clearAriaLabel = 'Clear search query',
  submitOnEnter = false,
  onSubmit,
  contentAnchorId,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { keyboardHeight } = useVisualViewportKeyboard();

  // For submitOnEnter (Catalog), maintain local state until form submission
  const [localQuery, setLocalQuery] = useState(searchQuery);
  const [prevQuery, setPrevQuery] = useState(searchQuery);

  if (prevQuery !== searchQuery) {
    setPrevQuery(searchQuery);
    setLocalQuery(searchQuery);
  }

  const activeValue = submitOnEnter ? localQuery : searchQuery;

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

    // Outside-pointer dismissal without blocking touch scrolling on the page behind
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isOpen, onClose]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (submitOnEnter) {
      setLocalQuery(val);
      // If user clears the input entirely, also clear upstream
      if (val === '') {
        onSearchChange('');
        onSubmit?.('');
      }
    } else {
      onSearchChange(val);
    }
  };

  const handleClear = () => {
    if (submitOnEnter) {
      setLocalQuery('');
      onSearchChange('');
      onSubmit?.('');
    } else {
      onSearchChange('');
    }
    inputRef.current?.focus();
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    inputRef.current?.blur();

    if (submitOnEnter) {
      const normalized = localQuery.trim().replace(/\s+/g, ' ');
      // 2-character guardrail matching catalog rules (allow 0 to clear, or >= 2 to search)
      if (normalized.length === 1) {
        return;
      }
      onSearchChange(normalized);
      onSubmit?.(normalized);
    } else {
      onSubmit?.(searchQuery);
    }

    if (contentAnchorId) {
      smartScrollToContent(contentAnchorId, { offsetTop: 80 });
    }
  };

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
          {/* Subtle click-outside backdrop: transparent with touch-action auto so touch dragging & scrolling pass through */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 pointer-events-auto touch-pan-y"
            onClick={onClose}
            data-testid="collection-floating-search-backdrop"
            aria-hidden="true"
          />

          {/* Floating search container with prominent drop shadow and dynamic keyboard elevation */}
          <motion.div
            ref={containerRef}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            style={{ bottom: bottomPosition }}
            className="fixed inset-x-0 mx-auto w-[92vw] max-w-md pointer-events-auto transition-all duration-200 ease-out"
            data-testid="collection-floating-search-container"
          >
            <form
              onSubmit={handleFormSubmit}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-card/95 backdrop-blur-md border border-border/80 shadow-[0_12px_36px_-4px_rgba(0,0,0,0.28),0_4px_14px_-2px_rgba(0,0,0,0.16)] dark:shadow-[0_0_32px_rgba(217,119,6,0.18),0_12px_44px_rgba(0,0,0,0.7),0_0_0_1px_rgba(217,119,6,0.25)] rounded-2xl text-foreground ring-1 ring-black/5 dark:ring-white/10"
            >
              <Search className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                enterKeyHint="search"
                value={activeValue}
                onChange={handleInputChange}
                placeholder={searchPlaceholder}
                aria-label={searchAriaLabel}
                data-testid="collection-floating-search-input"
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-hidden [&::-webkit-search-cancel-button]:hidden"
                autoFocus
              />
              {activeValue ? (
                <button
                  type="button"
                  onClick={handleClear}
                  data-testid="collection-floating-search-clear-btn"
                  className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  aria-label={clearAriaLabel}
                >
                  <X className="w-4 h-4" />
                </button>
              ) : null}
              {(submitOnEnter ? activeValue.trim().length >= 2 : activeValue.trim().length > 0) ? (
                <button
                  type="submit"
                  data-testid="collection-floating-search-submit-btn"
                  className="p-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all cursor-pointer flex items-center justify-center shrink-0 shadow-xs active:scale-95"
                  aria-label="Submit search"
                  title={submitOnEnter ? 'Search catalog (Enter)' : 'Filter collection (Enter)'}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : null}
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
