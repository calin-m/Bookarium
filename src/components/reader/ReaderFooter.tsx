'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, BookMarked, Sparkles } from 'lucide-react';

export interface ReaderFooterProps {
  globalPage: number;
  totalBookPages: number;
  chapterTitle: string;
  chapterPage: number;
  chapterPageCount: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  isPrevDisabled: boolean;
  isNextDisabled: boolean;
  readingMode: 'paginated' | 'scroll';
}

export const ReaderFooter: React.FC<ReaderFooterProps> = ({
  globalPage,
  totalBookPages,
  chapterTitle,
  chapterPage,
  chapterPageCount,
  onPrevPage,
  onNextPage,
  isPrevDisabled,
  isNextDisabled,
  readingMode,
}) => {
  return (
    <footer className="sticky bottom-0 z-40 shrink-0 border-t border-black/10 dark:border-white/10 bg-inherit/95 backdrop-blur-md transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4">
        
        {/* Left: Active Chapter & Section Breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <BookMarked className="w-4 h-4 text-primary-500 shrink-0" />
          <span className="text-xs font-serif font-medium text-stone-700 dark:text-stone-300 truncate max-w-[180px] sm:max-w-xs md:max-w-sm">
            {chapterTitle || 'Preamble'}
          </span>
          {readingMode === 'paginated' && chapterPageCount > 1 && (
            <span className="hidden sm:inline-block text-[11px] font-mono text-stone-400 dark:text-stone-500">
              (Sec. p. {chapterPage}/{chapterPageCount})
            </span>
          )}
        </div>

        {/* Center: True Continuous Book Pagination */}
        <div className="flex items-center gap-2">
          {readingMode === 'paginated' ? (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/5 text-xs font-mono font-bold text-stone-900 dark:text-stone-100">
              <span>Page</span>
              <span className="text-primary-600 dark:text-primary-400">{globalPage}</span>
              <span className="text-stone-400">/</span>
              <span>{totalBookPages}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs font-mono text-stone-500 dark:text-stone-400">
              <Sparkles className="w-3 h-3 text-primary-500" />
              <span>Continuous Flow Mode</span>
            </div>
          )}
        </div>

        {/* Right: Prev / Next Navigation Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {readingMode === 'paginated' && (
            <>
              <button
                type="button"
                onClick={onPrevPage}
                disabled={isPrevDisabled}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <button
                type="button"
                onClick={onNextPage}
                disabled={isNextDisabled}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium border border-primary-600 bg-primary-600 hover:bg-primary-700 text-white disabled:opacity-40 disabled:pointer-events-none transition-colors"
                aria-label="Next Page"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

      </div>
    </footer>
  );
};

