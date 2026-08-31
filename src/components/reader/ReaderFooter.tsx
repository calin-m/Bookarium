'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, BookMarked, Sparkles } from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { READER_THEMES } from '@/config/reader-themes';

export interface ReaderFooterProps {
  globalPage: number;
  totalBookPages: number;
  chapterTitle: string;
  chapterPage: number;
  chapterPageCount: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onPageJump?: (page: number) => void;
  isPrevDisabled: boolean;
  isNextDisabled: boolean;
  readingMode: 'paginated' | 'scroll';
  theme?: ReaderTheme;
  currentChapterIndex?: number;
  totalChapters?: number;
  onSelectChapter?: (index: number) => void;
}

export const ReaderFooter: React.FC<ReaderFooterProps> = ({
  globalPage,
  totalBookPages,
  chapterTitle,
  chapterPage,
  chapterPageCount,
  onPrevPage,
  onNextPage,
  onPageJump,
  isPrevDisabled,
  isNextDisabled,
  readingMode,
  theme = 'light',
  currentChapterIndex = 0,
  totalChapters = 1,
  onSelectChapter,
}) => {
  const activeTheme = READER_THEMES[theme] || READER_THEMES.light;

  return (
    <footer
      className={`sticky bottom-0 z-40 shrink-0 border-t transition-colors duration-200 ${activeTheme.footer}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center justify-between gap-4 font-mono text-xs select-none">
        
        {/* Left: Active Chapter Breadcrumb */}
        <div className="flex items-center gap-2 min-w-0">
          <BookMarked className="w-4 h-4 text-primary-500 shrink-0" />
          <span className="font-serif font-medium truncate max-w-[180px] sm:max-w-xs md:max-w-sm">
            {chapterTitle || 'Preamble'}
          </span>
          {readingMode === 'paginated' && chapterPageCount > 1 && (
            <span className={`hidden sm:inline-block text-[11px] font-mono ${activeTheme.textMuted}`}>
              (Sec. p. {chapterPage}/{chapterPageCount})
            </span>
          )}
        </div>

        {/* Center: True Continuous Book Pagination & Page Jumper */}
        <div className="flex items-center gap-2">
          {readingMode === 'paginated' ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className={`hidden sm:inline ${activeTheme.textMuted}`}>Page</span>
              <input
                type="number"
                min={1}
                max={totalBookPages}
                value={globalPage}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= totalBookPages && onPageJump) {
                    onPageJump(val);
                  }
                }}
                className={`w-12 sm:w-14 text-center py-0.5 rounded border ${activeTheme.border} bg-transparent font-bold focus:outline-hidden focus:ring-1 focus:ring-primary-500`}
                aria-label="Current Page Number"
                aria-valuemin={1}
                aria-valuemax={totalBookPages}
                aria-valuenow={globalPage}
              />
              <span className={activeTheme.textMuted}>of {totalBookPages}</span>
              <span className={`hidden md:inline text-[10px] opacity-60 ml-1`}>
                • ❦ Public Domain ❦
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-xs">
              <Sparkles className="w-3.5 h-3.5 text-primary-500" />
              <span className={activeTheme.textMuted}>
                Chapter {currentChapterIndex + 1} of {totalChapters}
              </span>
            </div>
          )}
        </div>

        {/* Right: Prev / Next Navigation */}
        <div className="flex items-center gap-1.5 shrink-0">
          {readingMode === 'paginated' ? (
            <>
              <button
                type="button"
                onClick={onPrevPage}
                disabled={isPrevDisabled}
                className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg border font-bold transition-all shadow-xs disabled:opacity-30 disabled:pointer-events-none ${activeTheme.button}`}
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <button
                type="button"
                onClick={onNextPage}
                disabled={isNextDisabled}
                className="inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-lg font-bold bg-primary-600 hover:bg-primary-700 text-white shadow-xs transition-all disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Next Page"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            onSelectChapter && totalChapters > 1 && (
              <>
                <button
                  type="button"
                  disabled={currentChapterIndex <= 0}
                  onClick={() => onSelectChapter(currentChapterIndex - 1)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-bold transition-all disabled:opacity-30 disabled:pointer-events-none ${activeTheme.button}`}
                  aria-label="Previous Chapter"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Prev Chapter</span>
                </button>
                <button
                  type="button"
                  disabled={currentChapterIndex >= totalChapters - 1}
                  onClick={() => onSelectChapter(currentChapterIndex + 1)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border font-bold transition-all disabled:opacity-30 disabled:pointer-events-none ${activeTheme.button}`}
                  aria-label="Next Chapter"
                >
                  <span className="hidden sm:inline">Next Chapter</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </>
            )
          )}
        </div>

      </div>
    </footer>
  );
};
