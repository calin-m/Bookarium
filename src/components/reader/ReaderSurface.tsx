'use client';

import React, { useRef, useState } from 'react';
import { BookOpen, RefreshCw, AlertCircle, ZoomIn } from 'lucide-react';
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
  onPreviousPage?: () => void;
  onNextPage?: () => void;
  onFontSizeChange?: (size: number) => void;
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
  onPreviousPage,
  onNextPage,
  onFontSizeChange,
}) => {
  const activeTheme = READER_THEMES[theme] || READER_THEMES.light;
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const pinchStartRef = useRef<{ distance: number; initialFontSize: number } | null>(null);
  const [zoomFeedback, setZoomFeedback] = useState<{ visible: boolean; size: number } | null>(null);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && onFontSizeChange) {
      // 2-finger touch: Initialize pinch-to-zoom font scaler
      touchStartRef.current = null;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      pinchStartRef.current = {
        distance: Math.max(10, dist),
        initialFontSize: fontSize,
      };
      setZoomFeedback({ visible: true, size: fontSize });
    } else if (e.touches.length === 1 && readingMode === 'paginated') {
      // 1-finger touch: Initialize page swipe
      pinchStartRef.current = null;
      touchStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        time: Date.now(),
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && pinchStartRef.current && onFontSizeChange) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = currentDist / pinchStartRef.current.distance;
      const targetSize = Math.round(pinchStartRef.current.initialFontSize * ratio);
      const clampedSize = Math.min(36, Math.max(12, targetSize));

      onFontSizeChange(clampedSize);
      setZoomFeedback({ visible: true, size: clampedSize });

      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (pinchStartRef.current) {
      pinchStartRef.current = null;
      if (zoomTimeoutRef.current) clearTimeout(zoomTimeoutRef.current);
      zoomTimeoutRef.current = setTimeout(() => {
        setZoomFeedback(null);
      }, 900);
      return;
    }

    if (readingMode !== 'paginated' || !touchStartRef.current) return;
    if (e.changedTouches.length === 1) {
      const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
      const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
      const deltaTime = Date.now() - touchStartRef.current.time;

      // Minimum swipe threshold of 45px and dominant horizontal axis within 800ms
      if (deltaTime < 800 && Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
        if (deltaX < 0) {
          onNextPage?.();
        } else {
          onPreviousPage?.();
        }
      }
    }
    touchStartRef.current = null;
  };

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
      className={`relative flex-1 overflow-y-scroll transition-colors duration-200 ${activeTheme.surface} ${activeTheme.scrollbarClass}`}
      role="main"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        fontSize: `${fontSize}px`,
        lineHeight: `${lineHeight}`,
      }}
    >
      {/* Floating Font Size Zoom HUD Pill */}
      {zoomFeedback?.visible && (
        <div
          data-testid="font-zoom-hud"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-stone-900/90 text-white dark:bg-stone-100/95 dark:text-stone-900 shadow-2xl border border-white/20 font-mono text-xs font-bold flex items-center gap-2 animate-in fade-in zoom-in-95 duration-150 pointer-events-none"
        >
          <ZoomIn className="w-3.5 h-3.5 text-primary-400 dark:text-primary-600" />
          <span>Font Size: {zoomFeedback.size}px</span>
          {zoomFeedback.size === 12 && (
            <span className="text-[10px] text-amber-400 font-bold uppercase">(Min)</span>
          )}
          {zoomFeedback.size === 36 && (
            <span className="text-[10px] text-amber-400 font-bold uppercase">(Max)</span>
          )}
        </div>
      )}
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

        {/* Formatted Book Body with Dynamic Line Height and Clean Word Boundaries */}
        <div
          data-testid="reader-content-body"
          className="space-y-6 select-text whitespace-pre-wrap text-inherit font-normal antialiased [word-break:normal] [overflow-wrap:break-word] [hyphens:none]"
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
