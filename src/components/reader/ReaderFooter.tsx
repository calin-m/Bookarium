'use client';

import React, { useRef } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  BookMarked,
  Sparkles,
} from 'lucide-react';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { getReaderTheme } from '@/config/reader-themes';
import { ReaderFloatingToolsPod } from './ReaderFloatingToolsPod';

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
  isSelectionPopoverOpen?: boolean;
  annotationsCount?: number;
  isHidden?: boolean;
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
  isTocOpen = false,
  isControlsOpen = false,
  isSearchOpen = false,
  isSpeechOpen = false,
  isAnnotationsOpen = false,
  isTranslationsOpen = false,
  isSelectionPopoverOpen = false,
  annotationsCount = 0,
  isHidden = false,
}) => {
  const activeTheme = getReaderTheme(theme);
  const scheduleIdleDimRef = useRef<(() => void) | null>(null);

  return (
    <footer
      data-bars-hidden={isHidden ? 'true' : 'false'}
      aria-hidden={isHidden || undefined}
      className={`fixed bottom-0 inset-x-0 z-40 shrink-0 border-t pb-[env(safe-area-inset-bottom,0px)] transition-[transform,opacity,background-color,border-color,color] duration-300 ease-in-out ${activeTheme.footer} ${
        isHidden ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'
      }`}
    >
      {/* Mobile & Tablet Top Tier: Contoured Chapter Button & [Search + Settings] Controls (< lg) */}
      <div className={`lg:hidden w-full px-3 sm:px-6 py-1.5 border-b ${activeTheme.border} flex items-center justify-between gap-2 text-xs font-mono transition-colors duration-theme`}>
        {/* Left: Contoured Chapter / Table of Contents Button */}
        <button
          type="button"
          onClick={() => {
            scheduleIdleDimRef.current?.();
            onToggleToc?.();
          }}
          disabled={!onToggleToc}
          aria-expanded={isTocOpen}
          className={`inline-flex items-center gap-1.5 min-w-0 max-w-[calc(100%-5.75rem)] min-h-[34px] px-3 py-1.5 rounded-lg border shadow-2xs text-left text-[13px] truncate transition-all active:scale-98 ${
            isTocOpen ? activeTheme.activePill : activeTheme.button
          } ${onToggleToc ? 'cursor-pointer' : 'pointer-events-none opacity-75'}`}
          title="Open Table of Contents"
          aria-label="Open Table of Contents"
          data-testid="footer-toc-trigger"
        >
          <BookMarked className="w-4 h-4 text-primary-500 shrink-0" />
          <span className="font-serif font-medium truncate" title={chapterTitle || 'Preamble'}>
            {chapterTitle || 'Preamble'}
          </span>
          {readingMode === 'paginated' && chapterPageCount > 1 && (
            <span className={`text-[11px] font-mono shrink-0 ${isTocOpen ? 'opacity-85' : activeTheme.textMuted}`}>
              ({chapterPage}/{chapterPageCount})
            </span>
          )}
          {onToggleToc && (
            <ChevronUp
              className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 opacity-65 ${
                isTocOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          )}
        </button>

        {/* Right: Search Button + Rightmost Settings Toggle & Vertical Draggable Floating Toolbar */}
        <ReaderFloatingToolsPod
          theme={theme}
          onToggleControls={onToggleControls}
          onToggleSearch={onToggleSearch}
          onToggleSpeech={onToggleSpeech}
          onToggleAnnotations={onToggleAnnotations}
          onToggleTranslations={onToggleTranslations}
          onThemeChange={onThemeChange}
          isTocOpen={isTocOpen}
          isControlsOpen={isControlsOpen}
          isSearchOpen={isSearchOpen}
          isSpeechOpen={isSpeechOpen}
          isAnnotationsOpen={isAnnotationsOpen}
          isTranslationsOpen={isTranslationsOpen}
          isSelectionPopoverOpen={isSelectionPopoverOpen}
          annotationsCount={annotationsCount}
          isHidden={isHidden}
          scheduleIdleDimRef={scheduleIdleDimRef}
        />
      </div>

      {/* Main Footer Controls Bar */}
      <div className="w-full px-3 sm:px-6 md:px-8 h-12 flex lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center justify-between lg:justify-normal gap-2 sm:gap-4 font-mono text-xs select-none">
        
        {/* Desktop Left Track (hidden on mobile/tablet, visible lg:flex) */}
        <div className="hidden lg:flex items-center gap-2 min-w-0 justify-self-start">
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
        <div className="flex items-center justify-center lg:justify-self-center">
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
                className={`w-12 sm:w-14 min-h-[32px] sm:min-h-0 text-center py-1 sm:py-0.5 rounded border ${activeTheme.border} bg-transparent font-bold focus:outline-hidden focus:ring-1 focus:ring-primary-500`}
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
        <div className="flex items-center gap-1.5 shrink-0 lg:justify-self-end">
          {readingMode === 'paginated' ? (
            <>
              <button
                type="button"
                onClick={onPrevPage}
                disabled={isPrevDisabled}
                className={`inline-flex items-center justify-center gap-1 min-h-[36px] sm:min-h-0 px-3 py-1 rounded-lg border font-bold text-xs transition-all shadow-xs active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${activeTheme.button}`}
                aria-label="Previous Page"
              >
                <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                <span>Prev</span>
              </button>

              <button
                type="button"
                onClick={onNextPage}
                disabled={isNextDisabled}
                className="inline-flex items-center justify-center gap-1 min-h-[36px] sm:min-h-0 px-3 py-1 rounded-lg font-bold text-xs bg-primary-600 hover:bg-primary-700 text-white shadow-xs transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none"
                aria-label="Next Page"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5 shrink-0" />
              </button>
            </>
          ) : (
            onSelectChapter && totalChapters > 1 && (
              <>
                <button
                  type="button"
                  disabled={currentChapterIndex <= 0}
                  onClick={() => onSelectChapter(currentChapterIndex - 1)}
                  className={`inline-flex items-center justify-center gap-1 min-h-[36px] sm:min-h-0 px-2.5 py-1 rounded-lg border font-bold text-xs transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${activeTheme.button}`}
                  aria-label="Previous Chapter"
                >
                  <ChevronLeft className="w-3.5 h-3.5 shrink-0" />
                  <span>Prev Chapter</span>
                </button>
                <button
                  type="button"
                  disabled={currentChapterIndex >= totalChapters - 1}
                  onClick={() => onSelectChapter(currentChapterIndex + 1)}
                  className={`inline-flex items-center justify-center gap-1 min-h-[36px] sm:min-h-0 px-2.5 py-1 rounded-lg border font-bold text-xs transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none ${activeTheme.button}`}
                  aria-label="Next Chapter"
                >
                  <span>Next Chapter</span>
                  <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                </button>
              </>
            )
          )}
        </div>

      </div>
    </footer>
  );
};
