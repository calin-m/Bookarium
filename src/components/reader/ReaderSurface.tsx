'use client';

import React from 'react';
import { BookOpen, RefreshCw, AlertCircle } from 'lucide-react';
import type { ReaderTheme, ReaderFontFamily } from '@/stores/useReaderStore';
import type { ChapterSection } from '@/lib/gutenberg-parser';

export interface ReaderSurfaceProps {
  theme: ReaderTheme;
  fontFamily: ReaderFontFamily;
  fontSize: number;
  lineHeight: number;
  columnWidth: 'narrow' | 'normal' | 'wide';
  readingMode: 'paginated' | 'scroll';
  chapter?: ChapterSection;
  currentPageText: string;
  activeChapterIndex: number;
  totalChapters: number;
  isLoading: boolean;
  isError: boolean;
  onRetry?: () => void;
}

export const ReaderSurface: React.FC<ReaderSurfaceProps> = ({
  theme,
  fontFamily,
  fontSize,
  lineHeight,
  columnWidth,
  readingMode,
  chapter,
  currentPageText,
  activeChapterIndex,
  totalChapters,
  isLoading,
  isError,
  onRetry,
}) => {
  const fontClass =
    fontFamily === 'serif'
      ? 'font-serif'
      : fontFamily === 'mono'
      ? 'font-mono'
      : 'font-sans';

  const widthClass =
    columnWidth === 'narrow'
      ? 'max-w-xl'
      : columnWidth === 'wide'
      ? 'max-w-4xl'
      : 'max-w-2xl';

  const surfaceThemeClass =
    theme === 'sepia'
      ? 'reader-surface-sepia bg-[#f4ebd9] text-[#2c1d11]'
      : theme === 'dark'
      ? 'reader-surface-dark bg-[#0c0e12] text-[#e2e8f0]'
      : 'reader-surface-light bg-[#fcfbf9] text-[#1a1a1a]';

  if (isLoading) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8 text-center" role="main">
        <div className="w-12 h-12 rounded-full border-2 border-primary-500 border-t-transparent animate-spin mb-4" />
        <p className="font-serif text-base font-bold text-stone-700 dark:text-stone-300">
          Fetching Masterwork from Project Gutenberg Mirror...
        </p>
        <p className="text-xs font-mono text-stone-400 mt-1">
          Parsing typography AST, chapters, and volume pagination
        </p>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8 text-center" role="main">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100 mb-2">
          Unable to Load Masterwork Text
        </h2>
        <p className="text-xs font-mono text-stone-500 max-w-md mb-6">
          The Project Gutenberg plain-text mirror could not be streamed. Please check your network connection or try again.
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-mono font-bold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry Connection</span>
          </button>
        )}
      </main>
    );
  }

  const contentToDisplay = readingMode === 'paginated' ? currentPageText : (chapter?.content || '');

  return (
    <main
      className={`flex-1 overflow-y-scroll transition-colors duration-300 ${surfaceThemeClass}`}
      role="main"
      style={{
        fontSize: `${fontSize}px`,
        lineHeight,
      }}
    >
      <article className={`mx-auto px-6 sm:px-10 py-10 sm:py-16 ${widthClass} ${fontClass}`}>
        
        {/* Chapter Title Banner */}
        {chapter && (
          <header className="mb-10 pb-6 border-b border-black/10 dark:border-white/10 text-center">
            <span className="text-[11px] font-mono uppercase tracking-widest text-primary-600 dark:text-primary-400 font-bold block mb-2">
              Section {activeChapterIndex + 1} of {totalChapters}
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold tracking-tight text-inherit">
              {chapter.displayTitle || chapter.title}
            </h2>
          </header>
        )}

        {/* Formatted Book Body */}
        <div className="space-y-6 select-text whitespace-pre-wrap leading-relaxed text-inherit font-normal antialiased">
          {contentToDisplay || (
            <div className="p-8 text-center text-xs font-mono text-stone-400">
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Empty section or end of text volume.
            </div>
          )}
        </div>

      </article>
    </main>
  );
};

