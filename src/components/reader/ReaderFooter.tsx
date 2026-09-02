'use client';

import React from 'react';
import { ChevronLeft, ChevronRight, BookMarked, Sparkles } from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';

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
  const activeTheme = getReaderTheme(theme);

  return (
    <footer
      className={`sticky bottom-0 z-40 shrink-0 border-t pb-[env(safe-area-inset-bottom,0px)] transition-colors duration-200 ${activeTheme.footer}`}
    >
      {/* Mobile Top Tier: Centered Slim Chapter Title Ribbon (< md) */}
      <div className={`md:hidden w-full px-4 py-1.5 border-b ${activeTheme.border} flex items-center justify-center gap-1.5 text-xs font-mono transition-colors duration-200`}>
        <BookMarked className="w-3.5 h-3.5 text-primary-500 shrink-0" />
        <span className="font-serif font-medium truncate max-w-[85vw] text-center" title={chapterTitle || 'Preamble'}>
          {chapterTitle || 'Preamble'}
        </span>
        {readingMode === 'paginated' && chapterPageCount > 1 && (
          <span className={`text-[10px] font-mono shrink-0 ${activeTheme.textMuted}`}>
            ({chapterPage}/{chapterPageCount})
          </span>
        )}
      </div>

      {/* Main Footer Controls Bar */}
      <div className="w-full px-3 sm:px-6 md:px-8 h-12 flex md:grid md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center justify-between md:justify-normal gap-2 sm:gap-4 font-mono text-xs select-none">
        
        {/* Desktop Left Track (hidden on mobile, visible md:flex) */}
        <div className="hidden md:flex items-center gap-2 min-w-0 justify-self-start">
          <BookMarked className="w-4 h-4 text-primary-500 shrink-0" />
          <span className="font-serif font-medium truncate" title={chapterTitle || 'Preamble'}>
            {chapterTitle || 'Preamble'}
          </span>
          {readingMode === 'paginated' && chapterPageCount > 1 && (
            <span className={`text-[11px] font-mono shrink-0 ${activeTheme.textMuted}`}>
              (Sec. p. {chapterPage}/{chapterPageCount})
            </span>
          )}
        </div>

        {/* Center Track (auto): Page Input */}
        <div className="flex items-center justify-center md:justify-self-center">
          {readingMode === 'paginated' ? (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className={`hidden sm:inline ${activeTheme.textMuted}`}>Page</span>
              <input
                type="number"
                role="spinbutton"
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
              <span className={`hidden lg:inline text-[10px] opacity-60 ml-1`}>
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

        {/* Right Track (1fr): Prev / Next Navigation */}
        <div className="flex items-center gap-1.5 shrink-0 md:justify-self-end">
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
