'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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

  if (!isOpen || !hasMounted) return null;

  return createPortal(
    <>
      {/* Click-outside backdrop to dismiss without dimming the background */}
      <div
        className="fixed inset-0 z-[9998] bg-transparent"
        onClick={onClose}
        aria-hidden="true"
        data-testid="toc-backdrop"
      />

      <div
        className={`fixed top-14 sm:top-16 right-2 sm:right-6 left-2 sm:left-auto z-[9999] w-[calc(100vw-1rem)] max-w-sm sm:w-96 max-h-[calc(100vh-4.5rem)] rounded-xl ${activeTheme.drawerBg} border ${activeTheme.border} shadow-2xl p-4 sm:p-4.5 transition-all animate-in fade-in duration-150 flex flex-col`}
        role="dialog"
        aria-modal="true"
        aria-label="Table of Contents"
      >
      {/* Header */}
      <div className={`flex items-center justify-between pb-3 mb-3 border-b ${activeTheme.border}`}>
        <div className="flex items-center gap-2 min-w-0">
          <BookOpen className="w-4 h-4 text-primary-600 dark:text-primary-400 shrink-0" />
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
          className="p-1 rounded-md text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors shrink-0"
          aria-label="Close Table of Contents"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Search Chapters Bar */}
      <div className="relative flex items-center mb-3">
        <Search className={`w-3.5 h-3.5 absolute left-2.5 pointer-events-none ${activeTheme.textMuted}`} />
        <input
          type="text"
          placeholder="Search chapters or sections..."
          aria-label="Search chapters or sections"
          value={tocSearch}
          onChange={(e) => setTocSearch(e.target.value)}
          className={`w-full pl-8 pr-7 py-1.5 text-xs font-mono rounded-lg border ${activeTheme.border} ${activeTheme.pill} ${activeTheme.inactivePill} focus:outline-hidden focus:ring-1 focus:ring-primary-600 shadow-xs transition-all`}
        />
        {tocSearch && (
          <button
            type="button"
            onClick={() => setTocSearch('')}
            className="absolute right-2 p-0.5 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            aria-label="Clear search"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Chapter List */}
      <div className={`max-h-[calc(100vh-16rem)] overflow-y-auto space-y-1.5 pr-1 font-mono text-xs ${activeTheme.scrollbarClass}`}>
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
                className={`w-full text-left p-2.5 rounded-lg transition-all flex items-center justify-between gap-2.5 border ${
                  isActive
                    ? `${activeTheme.activePill} border-primary-600 dark:border-primary-500/70 font-bold shadow-xs`
                    : `${activeTheme.pill} ${activeTheme.inactivePill} hover:border-primary-600/50`
                }`}
                data-testid={`chapter-item-${originalIndex >= 0 ? originalIndex : idx}`}
              >
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-sm leading-snug">
                    {ch.displayTitle || ch.title}
                  </span>
                  <span className={`text-[10px] block font-mono mt-0.5 ${activeTheme.textMuted}`}>
                    ~{calculateReadingTime(ch.content)} min read
                  </span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${activeTheme.border} ${activeTheme.textMuted}`}>
                    p. {ch.startPageNumber}
                  </span>
                  {isActive && <Check className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400 shrink-0" />}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  </>,
  document.body
);
};
