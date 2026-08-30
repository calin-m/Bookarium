'use client';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Search, BookOpen, Check } from 'lucide-react';
import type { ChapterSection } from '@/lib/gutenberg-parser';
import { calculateReadingTime } from '@/lib/gutenberg-parser';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { READER_THEMES } from '@/config/reader-themes';

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
  const activeTheme = READER_THEMES[theme] || READER_THEMES.light;

  // Escape key handler & body scroll lock
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Table of Contents">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
        data-testid="toc-backdrop"
      />

      {/* Drawer Panel */}
      <div className={`relative w-full max-w-sm h-full shadow-2xl flex flex-col border-l z-10 animate-in slide-in-from-right duration-200 ${activeTheme.drawerBg} border ${activeTheme.border} ${activeTheme.scrollbarClass}`}>
        
        {/* Header */}
        <div className={`p-5 border-b flex items-center justify-between gap-3 ${activeTheme.border}`}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-serif font-bold text-base leading-tight truncate">
                Table of Contents
              </h2>
              {bookTitle && (
                <p className={`text-xs font-mono truncate max-w-[200px] mt-0.5 ${activeTheme.textMuted}`}>
                  {bookTitle}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg opacity-60 hover:opacity-100 transition-opacity"
            aria-label="Close Table of Contents"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Chapters Bar */}
        <div className={`p-3.5 border-b ${activeTheme.border}`}>
          <div className="relative flex items-center">
            <Search className={`w-4 h-4 absolute left-3 pointer-events-none ${activeTheme.textMuted}`} />
            <input
              type="text"
              placeholder="Search chapters or sections..."
              aria-label="Search chapters or sections"
              value={tocSearch}
              onChange={(e) => setTocSearch(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 text-xs font-mono rounded-lg border ${activeTheme.border} ${activeTheme.pill} ${activeTheme.inactivePill} focus:outline-hidden focus:ring-2 focus:ring-primary shadow-xs transition-all`}
            />
            {tocSearch && (
              <button
                type="button"
                onClick={() => setTocSearch('')}
                className="absolute right-2.5 p-1 rounded opacity-60 hover:opacity-100"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Chapter List */}
        <div className="flex-1 overflow-y-auto p-3.5 space-y-2 font-mono text-xs">
          {filteredChapters.length === 0 ? (
            <div className={`p-8 text-center text-xs font-mono opacity-60 ${activeTheme.textMuted}`}>
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
                  className={`w-full text-left p-3 rounded-xl transition-all flex items-center justify-between gap-3 group border ${
                    isActive
                      ? `${activeTheme.activePill} border-2 border-primary shadow-sm font-bold`
                      : `${activeTheme.pill} ${activeTheme.inactivePill} border ${activeTheme.border} hover:border-primary/50 hover:opacity-95 shadow-xs`
                  }`}
                  data-testid={`chapter-item-${originalIndex >= 0 ? originalIndex : idx}`}
                >
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-serif text-sm leading-snug">
                      {ch.displayTitle || ch.title}
                    </span>
                    <span className={`text-[10px] block font-mono mt-1 ${activeTheme.textMuted}`}>
                      ~{calculateReadingTime(ch.content)} min read
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${activeTheme.border} opacity-80`}>
                      p. {ch.startPageNumber}
                    </span>
                    {isActive && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </div>
                </button>
              );
            })
          )}
        </div>

      </div>
    </div>
  );
};
