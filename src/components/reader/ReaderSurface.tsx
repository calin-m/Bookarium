'use client';

import React from 'react';
import { BookOpen, RefreshCw, AlertCircle } from 'lucide-react';
import type { ReaderTheme, ReaderFontFamily } from '@/stores/useReaderStore';
import type { ChapterSection } from '@/lib/gutenberg-parser';
import { READER_THEMES } from '@/config/reader-themes';

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
  bookTitle?: string;
  bookAuthor?: string;
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
  bookTitle,
  bookAuthor,
}) => {
  const activeTheme = READER_THEMES[theme] || READER_THEMES.light;

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
      ? 'max-w-5xl'
      : 'max-w-3xl';

  if (isLoading) {
    return (
      <main className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${activeTheme.surface}`} role="main">
        <div className="w-12 h-12 rounded-full border-2 border-primary-500 border-t-transparent animate-spin mb-4" />
        <p className="font-serif text-base font-bold">
          Fetching Masterwork from Project Gutenberg Mirror...
        </p>
        <p className={`text-xs font-mono mt-1 ${activeTheme.textMuted}`}>
          Parsing typography AST, chapters, and volume pagination
        </p>
      </main>
    );
  }

  if (isError) {
    return (
      <main className={`flex-1 flex flex-col items-center justify-center p-8 text-center ${activeTheme.surface}`} role="main">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4" />
        <h2 className="font-serif text-lg font-bold mb-2">
          Unable to Load Masterwork Text
        </h2>
        <p className={`text-xs font-mono max-w-md mb-6 ${activeTheme.textMuted}`}>
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
      className={`flex-1 overflow-y-scroll transition-colors duration-200 ${activeTheme.surface} ${activeTheme.scrollbarClass}`}
      role="main"
      style={{
        fontSize: `${fontSize}px`,
        lineHeight: `${lineHeight}`,
      }}
    >
      <article
        className={`mx-auto px-6 sm:px-12 py-10 sm:py-16 ${widthClass} ${fontClass}`}
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: `${lineHeight}`,
        }}
      >
        
        {/* Archival Opening Frontispiece (Section 1 / Book Opening) */}
        {activeChapterIndex === 0 && (bookTitle || bookAuthor) ? (
          <header className={`mb-12 pb-8 border-b text-center ${activeTheme.border}`}>
            <span className="inline-block text-[10px] sm:text-[11px] font-mono uppercase tracking-widest text-primary-600 dark:text-primary-400 font-bold mb-3 px-2.5 py-0.5 rounded-full border border-primary-500/30">
              Project Gutenberg Public Domain Edition
            </span>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold tracking-tight text-inherit mb-3">
              {bookTitle || chapter?.displayTitle || chapter?.title}
            </h1>
            {bookAuthor && (
              <p className="text-base sm:text-lg font-serif italic text-muted-foreground">
                by {bookAuthor}
              </p>
            )}
          </header>
        ) : chapter ? (
          /* Chapter Title Banner for subsequent sections */
          <header className={`mb-10 pb-6 border-b text-center ${activeTheme.border}`}>
            <span className="text-[11px] font-mono uppercase tracking-widest text-primary-600 dark:text-primary-400 font-bold block mb-2">
              Section {activeChapterIndex + 1} of {totalChapters}
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-serif font-bold tracking-tight text-inherit">
              {chapter.displayTitle || chapter.title}
            </h2>
          </header>
        ) : null}

        {/* Formatted Book Body with Dynamic Line Height */}
        <div
          data-testid="reader-content-body"
          className="space-y-6 select-text whitespace-pre-wrap text-inherit font-normal antialiased"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: `${lineHeight}`,
          }}
        >
          {contentToDisplay || (
            <div className={`p-8 text-center text-xs font-mono ${activeTheme.textMuted}`}>
              <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Empty section or end of text volume.
            </div>
          )}
        </div>

      </article>
    </main>
  );
};
