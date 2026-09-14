'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  BookMarked,
  Sparkles,
  Search,
  Sliders,
  Headphones,
  Highlighter,
  Sun,
  Moon,
  Coffee,
  Globe,
} from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme, NEXT_READER_THEME } from '@/config/reader-themes';

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
  onToggleToc?: () => void;
  onToggleControls?: () => void;
  onToggleSearch?: () => void;
  onToggleSpeech?: () => void;
  onToggleAnnotations?: () => void;
  onToggleTranslations?: () => void;
  onThemeChange?: (theme: ReaderTheme) => void;
  isTocOpen?: boolean;
  isControlsOpen?: boolean;
  isSearchOpen?: boolean;
  isSpeechOpen?: boolean;
  isAnnotationsOpen?: boolean;
  isTranslationsOpen?: boolean;
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
  onToggleToc,
  onToggleControls,
  onToggleSearch,
  onToggleSpeech,
  onToggleAnnotations,
  onToggleTranslations,
  onThemeChange,
  isTocOpen: _isTocOpen = false,
  isControlsOpen = false,
  isSearchOpen = false,
  isSpeechOpen = false,
  isAnnotationsOpen = false,
  isTranslationsOpen = false,
}) => {
  const activeTheme = getReaderTheme(theme);

  return (
    <footer
      className={`sticky bottom-0 z-40 shrink-0 border-t pb-[env(safe-area-inset-bottom,0px)] transition-colors duration-theme ${activeTheme.footer}`}
    >
      {/* Mobile Top Tier: Slim Chapter Ribbon & Quick Tools (< md) */}
      <div className={`md:hidden w-full px-3 py-1.5 border-b ${activeTheme.border} flex items-center justify-between gap-2 text-xs font-mono transition-colors duration-theme`}>
        {/* Left: Chapter Title (tappable to open TOC if onToggleToc is provided) */}
        <button
          type="button"
          onClick={onToggleToc}
          disabled={!onToggleToc}
          className={`flex items-center gap-1.5 min-w-0 max-w-[50%] text-left truncate transition-opacity active:scale-98 ${
            onToggleToc ? 'cursor-pointer hover:opacity-80' : 'pointer-events-none'
          }`}
          title="Open Table of Contents"
          aria-label="Open Table of Contents"
          data-testid="footer-toc-trigger"
        >
          <BookMarked className="w-3.5 h-3.5 text-primary-500 shrink-0" />
          <span className="font-serif font-medium truncate" title={chapterTitle || 'Preamble'}>
            {chapterTitle || 'Preamble'}
          </span>
          {readingMode === 'paginated' && chapterPageCount > 1 && (
            <span className={`text-[10px] font-mono shrink-0 ${activeTheme.textMuted}`}>
              ({chapterPage}/{chapterPageCount})
            </span>
          )}
        </button>

        {/* Right: Quick Reading Tools Row */}
        <div className="flex items-center gap-1 shrink-0" data-testid="footer-quick-tools">
          {onToggleSearch && (
            <button
              type="button"
              onClick={onToggleSearch}
              aria-label="Search in Book"
              title="Search in Book"
              className={`p-1.5 rounded-lg border transition-all cursor-pointer active:scale-95 ${
                isSearchOpen ? activeTheme.activePill : activeTheme.button
              }`}
            >
              <Search className="w-3.5 h-3.5" />
            </button>
          )}

          {onToggleSpeech && (
            <button
              type="button"
              onClick={onToggleSpeech}
              aria-label="Read Aloud Narration"
              title="Listen with Read Aloud"
              className={`p-1.5 rounded-lg border transition-all cursor-pointer active:scale-95 ${
                isSpeechOpen ? activeTheme.activePill : activeTheme.button
              }`}
            >
              <Headphones className="w-3.5 h-3.5" />
            </button>
          )}

          {onToggleAnnotations && (
            <button
              type="button"
              onClick={onToggleAnnotations}
              aria-label="Notes & Highlights"
              title="View Notes & Highlights"
              className={`p-1.5 rounded-lg border transition-all cursor-pointer active:scale-95 ${
                isAnnotationsOpen ? activeTheme.activePill : activeTheme.button
              }`}
            >
              <Highlighter className="w-3.5 h-3.5" />
            </button>
          )}

          {onToggleControls && (
            <button
              type="button"
              onClick={onToggleControls}
              aria-label="Typography & Theme Controls"
              title="Typography & Appearance"
              className={`p-1.5 rounded-lg border transition-all cursor-pointer active:scale-95 ${
                isControlsOpen ? activeTheme.activePill : activeTheme.button
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          )}

          {onToggleTranslations && (
            <button
              type="button"
              onClick={onToggleTranslations}
              aria-label="Language Editions & Translations"
              title="Translations"
              className={`p-1.5 rounded-lg border transition-all cursor-pointer active:scale-95 ${
                isTranslationsOpen ? activeTheme.activePill : activeTheme.button
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
            </button>
          )}

          {onThemeChange && (
            <button
              type="button"
              onClick={() => onThemeChange(NEXT_READER_THEME[theme])}
              aria-label={`Current theme: ${theme}. Click to switch theme.`}
              title={`Current theme: ${theme}. Click to switch theme.`}
              className={`p-1.5 rounded-lg border shrink-0 transition-all cursor-pointer active:scale-95 ${activeTheme.button}`}
            >
              {theme === 'light' ? (
                <Sun className="w-3.5 h-3.5 text-amber-500" />
              ) : theme === 'sepia' ? (
                <Coffee className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
              )}
            </button>
          )}
        </div>
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
        <div className="flex items-center gap-2 sm:gap-1.5 shrink-0 md:justify-self-end">
          {readingMode === 'paginated' ? (
            <>
              <button
                type="button"
                onClick={onPrevPage}
                disabled={isPrevDisabled}
                className={`inline-flex items-center justify-center gap-1 min-h-[42px] sm:min-h-0 px-3.5 sm:px-3 py-1.5 sm:py-1 rounded-lg border font-bold text-xs transition-all shadow-xs active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${activeTheme.button}`}
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
                <span>Prev</span>
              </button>

              <button
                type="button"
                onClick={onNextPage}
                disabled={isNextDisabled}
                className="inline-flex items-center justify-center gap-1 min-h-[42px] sm:min-h-0 px-3.5 sm:px-3 py-1.5 sm:py-1 rounded-lg font-bold text-xs bg-primary-600 hover:bg-primary-700 text-white shadow-xs transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Next Page"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
              </button>
            </>
          ) : (
            onSelectChapter && totalChapters > 1 && (
              <>
                <button
                  type="button"
                  disabled={currentChapterIndex <= 0}
                  onClick={() => onSelectChapter(currentChapterIndex - 1)}
                  className={`inline-flex items-center justify-center gap-1 min-h-[42px] sm:min-h-0 px-3 sm:px-2.5 py-1.5 sm:py-1 rounded-lg border font-bold text-xs transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${activeTheme.button}`}
                  aria-label="Previous Chapter"
                >
                  <ChevronLeft className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
                  <span>Prev Chapter</span>
                </button>
                <button
                  type="button"
                  disabled={currentChapterIndex >= totalChapters - 1}
                  onClick={() => onSelectChapter(currentChapterIndex + 1)}
                  className={`inline-flex items-center justify-center gap-1 min-h-[42px] sm:min-h-0 px-3 sm:px-2.5 py-1.5 sm:py-1 rounded-lg border font-bold text-xs transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${activeTheme.button}`}
                  aria-label="Next Chapter"
                >
                  <span>Next Chapter</span>
                  <ChevronRight className="w-4 h-4 sm:w-3.5 sm:h-3.5 shrink-0" />
                </button>
              </>
            )
          )}
        </div>

      </div>
    </footer>
  );
};
