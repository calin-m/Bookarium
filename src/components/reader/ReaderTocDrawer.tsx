'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, BookOpen, Check } from 'lucide-react';
import type { ChapterSection } from '@/lib/gutenberg-parser';
import { calculateReadingTime } from '@/lib/gutenberg-parser';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import { useHasMounted } from '@/hooks/useHasMounted';

export interface ReaderTocDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: ChapterSection[];
  activeChapterIndex: number;
  onSelectChapter: (index: number) => void;
  bookTitle?: string;
  theme?: ReaderTheme;
}

export const ReaderTocDrawer: React.FC<ReaderTocDrawerProps> = ({
  isOpen,
  onClose,
  chapters,
  activeChapterIndex,
  onSelectChapter,
  bookTitle,
  theme = 'light',
}) => {
  const [tocSearch, setTocSearch] = useState('');
  const activeItemRef = useRef<HTMLButtonElement | null>(null);
  const activeTheme = getReaderTheme(theme);
  const hasMounted = useHasMounted();

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Auto-scroll to active chapter when drawer opens
  useEffect(() => {
    if (isOpen && activeItemRef.current) {
      if (activeItemRef.current && typeof activeItemRef.current.scrollIntoView === 'function') {
        activeItemRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [isOpen]);

  const filteredChapters = useMemo(() => {
    if (!tocSearch.trim()) return chapters;
    const q = tocSearch.toLowerCase();
    return chapters.filter(
      (c) => c.title.toLowerCase().includes(q) || c.displayTitle.toLowerCase().includes(q)
    );
  }, [chapters, tocSearch]);

  if (!hasMounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Fluid Backdrop Fade */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[9998] bg-transparent"
            onClick={onClose}
            aria-hidden="true"
            data-testid="toc-backdrop"
          />

          {/* Fluid Spring Drawer Panel */}
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={`fixed top-[6.75rem] sm:top-[7.25rem] inset-x-3 sm:inset-x-auto sm:right-6 md:right-8 w-auto max-w-sm sm:w-96 mx-auto sm:mx-0 z-[9999] max-h-[calc(100dvh-8.5rem)] rounded-xl ${activeTheme.drawerBg} border ${activeTheme.border} shadow-2xl p-4 sm:p-4.5 flex flex-col origin-top sm:origin-top-right`}
            role="dialog"
            aria-modal="true"
            aria-label="Table of Contents"
          >
            {/* Header */}
            <div className={`flex items-center justify-between pb-3 mb-3 border-b ${activeTheme.border}`}>
              <div className="flex items-center gap-2 min-w-0">
                <BookOpen className={`w-4 h-4 shrink-0 ${theme === 'sepia' ? 'text-amber-500' : 'text-primary-600 dark:text-primary-400'}`} />
                <div className="min-w-0">
                  <h3 className="font-serif font-bold text-sm leading-tight truncate">
                    Table of Contents
                  </h3>
                  {bookTitle && (
                    <p className={`text-[10px] font-mono truncate max-w-[220px] mt-0.5 ${activeTheme.textMuted}`}>
                      {bookTitle}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className={`p-1.5 rounded-lg border transition-colors shrink-0 cursor-pointer active:scale-95 ${activeTheme.button}`}
                aria-label="Close Table of Contents"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Chapters Bar (Standardized Padding & Alignment) */}
            <div className="relative flex items-center mb-3">
              <Search className={`w-3.5 h-3.5 absolute left-3 pointer-events-none ${activeTheme.textMuted}`} />
              <input
                type="text"
                placeholder="Search chapters or sections..."
                aria-label="Search chapters or sections"
                value={tocSearch}
                onChange={(e) => setTocSearch(e.target.value)}
                className={`w-full h-9 pl-9 pr-8 py-2 text-xs font-mono rounded-lg border ${activeTheme.border} ${activeTheme.pill} focus:outline-hidden focus:ring-1 focus:ring-primary-600 shadow-xs transition-all leading-normal placeholder:text-muted-foreground`}
              />
              {tocSearch && (
                <button
                  type="button"
                  onClick={() => setTocSearch('')}
                  className={`absolute right-2.5 p-1 rounded-full ${activeTheme.textMuted} hover:text-foreground cursor-pointer transition-colors`}
                  aria-label="Clear search"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Chapter List */}
            <div className={`max-h-[calc(100dvh-16rem)] overflow-y-auto space-y-1.5 pr-1 font-mono text-xs ${activeTheme.scrollbarClass}`}>
              {filteredChapters.length === 0 ? (
                <div className={`p-6 text-center text-xs font-mono ${activeTheme.textMuted}`}>
                  No matching sections found for &quot;{tocSearch}&quot;
                </div>
              ) : (
                filteredChapters.map((ch, idx) => {
                  const originalIndex = chapters.findIndex((c) => c.id === ch.id);
                  const isActive = originalIndex === activeChapterIndex;

                  return (
                    <button
                      key={ch.id || idx}
                      ref={isActive ? activeItemRef : null}
                      type="button"
                      onClick={() => {
                        onSelectChapter(originalIndex >= 0 ? originalIndex : idx);
                        onClose();
                      }}
                      className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center justify-between gap-2.5 border cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary ${
                        isActive
                          ? `${activeTheme.activePill} ${theme === 'sepia' ? 'border-[#f59e0b]' : 'border-primary-600 dark:border-primary-500/70'} font-bold shadow-xs`
                          : `${activeTheme.pill} ${activeTheme.inactivePill} hover:border-primary-600/50`
                      }`}
                      data-testid={`chapter-item-${originalIndex >= 0 ? originalIndex : idx}`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className="block truncate font-serif text-sm leading-snug">
                          {ch.displayTitle || ch.title}
                        </span>
                        <span className={`text-[10px] block font-mono mt-0.5 ${isActive && theme === 'sepia' ? 'text-[#2b1d16]/80' : activeTheme.textMuted}`}>
                          ~{calculateReadingTime(ch.content)} min read
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                          isActive && theme === 'sepia'
                            ? 'border-[#2b1d16]/30 text-[#2b1d16]'
                            : `${activeTheme.border} ${activeTheme.textMuted}`
                        }`}>
                          p. {ch.startPageNumber}
                        </span>
                        {isActive && (
                          <Check className={`w-3.5 h-3.5 shrink-0 ${
                            theme === 'sepia' ? 'text-[#2b1d16]' : 'text-primary-600 dark:text-primary-400'
                          }`} />
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};

