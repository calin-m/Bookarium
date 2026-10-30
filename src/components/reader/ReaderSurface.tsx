'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { BookOpen, Bookmark, ZoomIn } from 'lucide-react';
import type { ReaderTheme, ReaderFontFamily } from '@/stores/useReaderStore';
import type { ChapterSection } from '@/lib/gutenberg-parser';
import type { FellowAnnotation } from '@/stores/useAnnotationStore';
import { getReaderTheme } from '@/config/reader-themes';
import { READER_FONT_CONFIG } from '@/config/reader-config';
import { ANNOTATION_COLOR_CONFIG } from '@/config/annotation-tokens';
import { useReaderGestures } from '@/hooks/reader/useReaderGestures';
import { computeAnnotationSpans, type AnyAnnotation } from '@/lib/reader-annotator';
import { ReaderErrorView } from './ReaderErrorView';
import { ReaderLoadingView } from './ReaderLoadingView';

export interface ReaderSurfaceProps {
  theme: ReaderTheme;
  brightness?: number;
  fontFamily: ReaderFontFamily;
  fontSize: number;
  lineHeight: number;
  columnWidth: 'narrow' | 'normal' | 'wide';
  readingMode: 'paginated' | 'scroll';
  chapter?: ChapterSection;
  currentPageText: string;
  chapterPage?: number;
  bookmarkRow?: number;
  bookmarkText?: string;
  onBookmarkRowChange?: (row: number, bookmarkText?: string) => void;
  activeChapterIndex: number;
  totalChapters: number;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  onRetry?: () => void;
  bookTitle?: string;
  bookAuthor?: string;
  onPreviousPage?: () => void;
  onNextPage?: () => void;
  onFontSizeChange?: (size: number) => void;
  onTapSurface?: () => void;
  isSpeechOpen?: boolean;
  highlightedSentence?: string;
  annotations?: AnyAnnotation[];
  targetAnnotationId?: string | null;
  onSelectAnnotation?: (
    annotation: AnyAnnotation,
    position?: { top: number; left: number },
    overlappingFellow?: FellowAnnotation
  ) => void;
  onTextSelected?: (selection: { text: string; position: { top: number; left: number; bottom?: number } }) => void;
}

export const ReaderSurface: React.FC<ReaderSurfaceProps> = ({
  theme,
  brightness = READER_FONT_CONFIG.DEFAULT_BRIGHTNESS,
  fontFamily,
  fontSize,
  lineHeight,
  columnWidth,
  readingMode,
  chapter,
  currentPageText,
  chapterPage,
  bookmarkRow = 0,
  bookmarkText,
  onBookmarkRowChange,
  activeChapterIndex,
  totalChapters,
  isLoading,
  isError,
  error,
  onRetry,
  bookTitle,
  bookAuthor,
  onPreviousPage,
  onNextPage,
  onFontSizeChange,
  onTapSurface,
  isSpeechOpen = false,
  highlightedSentence,
  annotations = [],
  targetAnnotationId,
  onSelectAnnotation,
  onTextSelected,
}) => {
  const activeTheme = getReaderTheme(theme);
  const mainRef = useRef<HTMLElement>(null);
  const contentBodyRef = useRef<HTMLDivElement>(null);
  const bookmarkElRef = useRef<HTMLDivElement>(null);
  const [isDraggingBookmark, setIsDraggingBookmark] = useState(false);
  const [resolvedBookmarkSpan, setResolvedBookmarkSpan] = useState<{
    text: string;
    startRow: number;
    endRow: number;
  } | null>(null);
  const latestDragRowRef = useRef(bookmarkRow);
  const hasScrolledBookmarkRef = useRef(false);

  useEffect(() => {
    latestDragRowRef.current = bookmarkRow;
  }, [bookmarkRow]);

  const lineStepPx = Math.max(16, fontSize * lineHeight);
  const contentToDisplay = readingMode === 'paginated' ? currentPageText : (chapter?.content || '');
  const estimatedMaxBookmarkRows = Math.max(10, Math.ceil((contentToDisplay?.length || 800) / 65));
  const isBookmarkActive = bookmarkRow > 0 || isDraggingBookmark;
  const activeSpan =
    !isDraggingBookmark &&
    bookmarkRow > 0 &&
    bookmarkText &&
    resolvedBookmarkSpan?.text === bookmarkText
      ? resolvedBookmarkSpan
      : null;
  const effectiveStartRow = activeSpan ? activeSpan.startRow : bookmarkRow;
  const effectiveEndRow = activeSpan
    ? Math.max(activeSpan.startRow, activeSpan.endRow)
    : bookmarkRow;
  const bookmarkSpanRows = Math.max(1, effectiveEndRow - effectiveStartRow + 1);

  const getMaxBookmarkRows = useCallback(() => {
    const el = contentBodyRef.current;
    const measuredHeight = el ? el.scrollHeight || el.getBoundingClientRect().height || 0 : 0;
    if (measuredHeight <= 0) {
      return estimatedMaxBookmarkRows;
    }
    return Math.max(0, Math.floor((measuredHeight - lineStepPx / 2) / lineStepPx));
  }, [estimatedMaxBookmarkRows, lineStepPx]);

  const computeRowFromClientY = useCallback(
    (clientY: number) => {
      const el = contentBodyRef.current;
      const rectTop = el ? el.getBoundingClientRect().top : 0;
      const relY = clientY - rectTop;
      const rawRow = Math.round((relY - lineStepPx / 2) / lineStepPx);
      return Math.min(getMaxBookmarkRows(), Math.max(0, rawRow));
    },
    [lineStepPx, getMaxBookmarkRows]
  );

  const extractRowText = useCallback(
    (targetRow: number): string | undefined => {
      if (targetRow <= 0 || !contentToDisplay) return undefined;
      const el = contentBodyRef.current;
      if (!el) return undefined;

      const segments = collectContentTextSegments(el);
      const totalChars = segments.length > 0 ? segments[segments.length - 1].end : 0;
      if (totalChars <= 0) return undefined;

      const getCharRow = (charIdx: number): number | null => {
        const rect = measureCharRect(segments, charIdx);
        if (!rect) return null;
        return computeRowFromClientY(rect.top + rect.height / 2);
      };

      if (getCharRow(0) === null) return undefined;

      let lo = 0;
      let hi = totalChars - 1;
      let firstIdx = totalChars;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const r = getCharRow(mid);
        if (r === null) return undefined;
        if (r >= targetRow) {
          firstIdx = mid;
          hi = mid - 1;
        } else {
          lo = mid + 1;
        }
      }

      lo = 0;
      hi = totalChars - 1;
      let lastIdx = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const r = getCharRow(mid);
        if (r === null) return undefined;
        if (r <= targetRow) {
          lastIdx = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      if (firstIdx <= lastIdx && firstIdx < totalChars && lastIdx >= 0) {
        const extracted = contentToDisplay.slice(firstIdx, lastIdx + 1).trim();
        if (extracted.length > 0) return extracted;
      }

      if (firstIdx < totalChars) {
        const nearestRow = getCharRow(firstIdx);
        if (nearestRow !== null) {
          let endIdx = firstIdx;
          while (endIdx + 1 < totalChars && getCharRow(endIdx + 1) === nearestRow) {
            endIdx++;
          }
          const fallbackSlice = contentToDisplay.slice(firstIdx, endIdx + 1).trim();
          if (fallbackSlice.length > 0) return fallbackSlice;
        }
      }

      return undefined;
    },
    [contentToDisplay, computeRowFromClientY]
  );

  const resolveTextRowSpan = useCallback(
    (
      textToFind: string,
      fallbackRow: number
    ): { startRow: number; endRow: number } | null => {
      if (!textToFind || !contentToDisplay) return null;
      const el = contentBodyRef.current;
      if (!el) return null;

      const segments = collectContentTextSegments(el);
      const totalChars = segments.length > 0 ? segments[segments.length - 1].end : 0;
      if (totalChars <= 0) return null;

      const maxRows = Math.max(1, getMaxBookmarkRows());
      const targetRatio = Math.min(1, Math.max(0, fallbackRow / maxRows));
      const match = findBestTextMatch(contentToDisplay, textToFind, targetRatio);
      if (!match) return null;

      const startRect = measureCharRect(segments, match.start);
      const endRect = measureCharRect(segments, Math.max(match.start, match.end - 1));
      if (!startRect || !endRect) return null;

      const startRow = Math.max(
        1,
        computeRowFromClientY(startRect.top + startRect.height / 2)
      );
      const endRow = Math.max(
        startRow,
        computeRowFromClientY(endRect.top + endRect.height / 2)
      );

      return { startRow, endRow };
    },
    [contentToDisplay, getMaxBookmarkRows, computeRowFromClientY]
  );

  const emitUserBookmarkRowChange = useCallback(
    (nextRow: number) => {
      if (!onBookmarkRowChange) return;
      if (nextRow <= 0) {
        onBookmarkRowChange(0);
        return;
      }
      const extracted = extractRowText(nextRow);
      if (extracted) {
        setResolvedBookmarkSpan({
          text: extracted,
          startRow: nextRow,
          endRow: nextRow,
        });
        onBookmarkRowChange(nextRow, extracted);
      } else {
        onBookmarkRowChange(nextRow);
      }
    },
    [onBookmarkRowChange, extractRowText]
  );

  // Re-evaluate startRow..endRow when display width, columnWidth, or typography changes
  useEffect(() => {
    if (isDraggingBookmark || bookmarkRow <= 0 || !contentToDisplay) {
      return;
    }
    const el = contentBodyRef.current;
    if (!el || typeof window === 'undefined') return;

    const syncBookmarkToLayout = () => {
      if (!bookmarkText) {
        const healedText = extractRowText(bookmarkRow);
        if (healedText) {
          onBookmarkRowChange?.(bookmarkRow, healedText);
        }
        return;
      }

      const span = resolveTextRowSpan(bookmarkText, bookmarkRow);
      if (!span) return;

      setResolvedBookmarkSpan((prev) => {
        if (
          prev &&
          prev.text === bookmarkText &&
          prev.startRow === span.startRow &&
          prev.endRow === span.endRow
        ) {
          return prev;
        }
        return { text: bookmarkText, startRow: span.startRow, endRow: span.endRow };
      });

      if (span.startRow !== bookmarkRow) {
        onBookmarkRowChange?.(span.startRow);
      }
    };

    const rafId = window.requestAnimationFrame(syncBookmarkToLayout);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        syncBookmarkToLayout();
      });
      observer.observe(el);
    }

    return () => {
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, [
    isDraggingBookmark,
    bookmarkRow,
    bookmarkText,
    contentToDisplay,
    fontSize,
    lineHeight,
    fontFamily,
    columnWidth,
    extractRowText,
    resolveTextRowSpan,
    onBookmarkRowChange,
  ]);

  useEffect(() => {
    if (!isDraggingBookmark) return;

    const handlePointerMove = (e: PointerEvent | MouseEvent) => {
      const nextRow = computeRowFromClientY(e.clientY);
      latestDragRowRef.current = nextRow;
      onBookmarkRowChange?.(nextRow);
    };

    const handleTouchMoveWindow = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        if (e.cancelable) e.preventDefault();
        const nextRow = computeRowFromClientY(e.touches[0].clientY);
        latestDragRowRef.current = nextRow;
        onBookmarkRowChange?.(nextRow);
      }
    };

    const handleEnd = () => {
      setIsDraggingBookmark(false);
      const finalRow = latestDragRowRef.current;
      if (finalRow > 0) {
        const extracted = extractRowText(finalRow);
        if (extracted) {
          setResolvedBookmarkSpan({
            text: extracted,
            startRow: finalRow,
            endRow: finalRow,
          });
          onBookmarkRowChange?.(finalRow, extracted);
        }
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('touchmove', handleTouchMoveWindow, { passive: false });
    window.addEventListener('pointerup', handleEnd);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('touchmove', handleTouchMoveWindow);
      window.removeEventListener('pointerup', handleEnd);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDraggingBookmark, computeRowFromClientY, extractRowText, onBookmarkRowChange]);

  const { zoomFeedback, handleTouchStart, handleTouchMove, handleTouchEnd } = useReaderGestures({
    fontSize,
    readingMode,
    onFontSizeChange,
    onNextPage,
    onPreviousPage,
    onTapSurface,
  });

  useEffect(() => {
    hasScrolledBookmarkRef.current = false;
  }, [currentPageText, activeChapterIndex, chapterPage]);

  // Smooth animated scroll-to-top on page or chapter transition, or center on bookmarked row when resuming
  useEffect(() => {
    if (readingMode === 'paginated' && mainRef.current && !targetAnnotationId && !isDraggingBookmark) {
      const behavior: ScrollBehavior =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth';
      if (bookmarkRow > 0) {
        if (!hasScrolledBookmarkRef.current && bookmarkElRef.current) {
          hasScrolledBookmarkRef.current = true;
          bookmarkElRef.current.scrollIntoView?.({
            behavior,
            block: 'center',
          });
        }
      } else {
        mainRef.current.scrollTo({
          top: 0,
          behavior,
        });
      }
    }
  }, [currentPageText, activeChapterIndex, readingMode, targetAnnotationId, bookmarkRow, isDraggingBookmark]);

  // Center and visually accent the targeted highlighted passage
  useEffect(() => {
    if (!targetAnnotationId || isLoading) return;

    const timer = setTimeout(() => {
      const targetEl = mainRef.current?.querySelector<HTMLElement>(
        `[data-annotation-id="${targetAnnotationId}"]`
      );
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        targetEl.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'animate-pulse');
        const clearTimer = setTimeout(() => {
          targetEl.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'animate-pulse');
        }, 2500);
        return () => clearTimeout(clearTimer);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [targetAnnotationId, currentPageText, activeChapterIndex, isLoading, readingMode]);

  const handleSelection = useCallback(() => {
    if (typeof window === 'undefined' || !onTextSelected) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    let text = selection.toString().trim();
    if (text.length < 2) return;

    // Verify anchor or focus node belongs to reader surface when available
    const anchor = selection.anchorNode;
    if (anchor) {
      const targetElement = anchor.nodeType === Node.ELEMENT_NODE ? (anchor as Element) : anchor.parentElement;
      if (targetElement && !mainRef.current?.contains(targetElement)) return;
    }

    try {
      const range = selection.getRangeAt(0);
      // Strip any inline fellow username badges (@username) that may have been captured inside <mark>
      if (typeof range.cloneContents === 'function') {
        const cloned = range.cloneContents();
        const badges = cloned.querySelectorAll?.('[data-testid="fellow-highlight-badge"]');
        if (badges && badges.length > 0) {
          badges.forEach((b) => b.remove());
          const cleanedText = cloned.textContent?.trim();
          if (cleanedText && cleanedText.length >= 2) {
            text = cleanedText;
          }
        }
      }
      // Safety strip for trailing @fellow_username badge text
      text = text.replace(/@[a-zA-Z0-9_-]+$/, '').trim();
      if (text.length < 2) return;

      const rect = range.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        onTextSelected({
          text,
          position: {
            top: rect.top,
            bottom: rect.bottom,
            left: rect.left + rect.width / 2,
          },
        });
      }
    } catch {
      // Non-blocking fallback
    }
  }, [onTextSelected]);

  // Listen to standard selectionchange event (essential for mobile & tactile touch selection handles)
  useEffect(() => {
    if (typeof window === 'undefined' || !onTextSelected) return;

    let timer: NodeJS.Timeout;
    const handleSelectionChange = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        handleSelection();
      }, 250);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [onTextSelected, handleSelection]);

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
    return <ReaderLoadingView activeTheme={activeTheme} />;
  }

  if (isError) {
    return (
      <ReaderErrorView
        activeTheme={activeTheme}
        onRetry={onRetry}
        error={error}
        bookTitle={bookTitle}
        bookAuthor={bookAuthor}
      />
    );
  }

  return (
    <main
      ref={mainRef}
      data-brightness={brightness}
      className={`relative flex-1 overflow-y-scroll overscroll-y-contain transition-colors duration-theme select-text ${activeTheme.surface} ${activeTheme.scrollbarClass}`}
      role="main"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={(e) => {
        handleTouchEnd(e);
        handleSelection();
      }}
      style={{
        fontSize: `${fontSize}px`,
        lineHeight: `${lineHeight}`,
        ...(brightness < 100 ? { filter: `brightness(${brightness / 100})` } : {}),
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
          {zoomFeedback.size === READER_FONT_CONFIG.MIN_SIZE && (
            <span className="text-[10px] text-amber-400 font-bold uppercase">(Min)</span>
          )}
          {zoomFeedback.size === READER_FONT_CONFIG.MAX_SIZE && (
            <span className="text-[10px] text-amber-400 font-bold uppercase">(Max)</span>
          )}
        </div>
      )}
      <article
        key={readingMode === 'paginated' ? `p-${activeChapterIndex}-${chapterPage ?? (contentToDisplay?.slice(0, 30) || '0')}` : `s-${activeChapterIndex}`}
        onMouseUp={handleSelection}
        className={`mx-auto pl-12 pr-5 sm:px-14 md:px-16 pt-10 sm:pt-16 ${
          isSpeechOpen || highlightedSentence ? 'pb-36 sm:pb-40' : 'pb-10 sm:pb-16'
        } select-text ${widthClass} ${fontClass} animate-page-turn`}
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
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight text-inherit mb-3">
                {bookTitle || chapter?.displayTitle || chapter?.title}
              </h1>
              {bookAuthor && (
                <p className="text-base sm:text-lg italic text-muted-foreground">
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
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-inherit">
                {chapter.displayTitle || chapter.title}
              </h2>
            </header>
          ) : null}

          {/* Standard Reading Body with Interactive Margin Row Bookmark */}
          <div className="relative">
            {contentToDisplay && (
              <>
                {/* Click-to-Snap Margin Rail */}
                <div
                  data-testid="reader-bookmark-rail"
                  data-prevent-swipe
                  aria-hidden="true"
                  title="Click to snap reading bookmark to this line"
                  onClick={(e) => {
                    e.stopPropagation();
                    emitUserBookmarkRowChange(computeRowFromClientY(e.clientY));
                  }}
                  className="absolute right-full mr-0 top-0 bottom-0 w-10 sm:w-12 z-10 cursor-pointer group/rail select-none"
                >
                  <div className="mx-auto h-full w-px bg-transparent group-hover/rail:bg-primary/20 transition-colors" />
                </div>

                {/* Draggable Row-Snapping Bookmark Ribbon & Guide Line */}
                <div
                  ref={bookmarkElRef}
                  role="slider"
                  tabIndex={0}
                  aria-label="Reading line bookmark"
                  aria-valuemin={1}
                  aria-valuemax={estimatedMaxBookmarkRows + 1}
                  aria-valuenow={effectiveStartRow + 1}
                  aria-valuetext={
                    effectiveEndRow > effectiveStartRow
                      ? `Lines ${effectiveStartRow + 1} to ${effectiveEndRow + 1}`
                      : `Line ${effectiveStartRow + 1}`
                  }
                  data-testid="reader-page-bookmark"
                  data-bookmark-row={effectiveStartRow}
                  data-bookmark-end-row={effectiveEndRow}
                  data-prevent-swipe
                  title={
                    effectiveStartRow > 0
                      ? effectiveEndRow > effectiveStartRow
                        ? `Bookmarked at Lines ${effectiveStartRow + 1}–${effectiveEndRow + 1} (drag to move, double-click to reset)`
                        : `Bookmarked at Line ${effectiveStartRow + 1} (drag to move, double-click to reset)`
                      : 'Drag down to bookmark your reading line on this page'
                  }
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setIsDraggingBookmark(true);
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setIsDraggingBookmark(true);
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    setIsDraggingBookmark(true);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    emitUserBookmarkRowChange(0);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      emitUserBookmarkRowChange(
                        Math.min(getMaxBookmarkRows(), effectiveStartRow + 1)
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      emitUserBookmarkRowChange(Math.max(0, effectiveStartRow - 1));
                    } else if (e.key === 'Home') {
                      e.preventDefault();
                      emitUserBookmarkRowChange(0);
                    }
                  }}
                  style={{
                    top: `${effectiveStartRow * lineStepPx}px`,
                    height: `${bookmarkSpanRows * lineStepPx}px`,
                  }}
                  className={`absolute left-0 right-0 z-10 pointer-events-none select-none focus:outline-none group/bookmark ${
                    isDraggingBookmark ? 'transition-none' : 'transition-[top,height] duration-150 ease-out'
                  }`}
                >
                  {/* Interactive Margin Ribbon Tab */}
                  <div
                    data-prevent-swipe
                    className={`pointer-events-auto absolute right-full mr-1.5 sm:mr-2.5 origin-right top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1 sm:px-1.5 py-0.5 rounded-l-md rounded-r-xs border transition-all cursor-grab active:cursor-grabbing shadow-2xs ${
                      isBookmarkActive
                        ? 'bg-primary text-primary-foreground border-primary scale-105 opacity-100'
                        : 'bg-card/85 text-primary border-primary/30 opacity-65 hover:opacity-100 group-focus-visible/bookmark:opacity-100 group-focus-visible/bookmark:ring-2 group-focus-visible/bookmark:ring-primary'
                    }`}
                  >
                    <Bookmark className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current shrink-0" />
                    <span
                      data-testid="reader-bookmark-line-badge"
                      className={`text-[9px] font-mono font-bold leading-none ${
                        isBookmarkActive
                          ? 'inline'
                          : 'hidden sm:group-hover/bookmark:inline'
                      }`}
                    >
                      {effectiveEndRow > effectiveStartRow
                        ? `L${effectiveStartRow + 1}–${effectiveEndRow + 1}`
                        : `L${effectiveStartRow + 1}`}
                    </span>
                  </div>

                  {/* Subtle Full-Width Row Guide Line & Highlight */}
                  <div
                    data-testid="reader-bookmark-guide-line"
                    className={`w-full h-full rounded-xs border-b transition-opacity duration-150 ${
                      isBookmarkActive
                        ? 'opacity-100 border-primary/45 bg-primary/[0.04] dark:bg-primary/[0.08]'
                        : 'opacity-0 border-transparent bg-transparent'
                    }`}
                  />
                </div>
              </>
            )}

            <div
              ref={contentBodyRef}
              data-testid="reader-content-body"
              className="relative z-10 space-y-6 select-text whitespace-pre-wrap text-inherit font-normal antialiased [word-break:normal] [overflow-wrap:break-word] [hyphens:none]"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: `${lineHeight}`,
              }}
            >
              {contentToDisplay ? (
                renderContentWithAnnotations(
                  contentToDisplay,
                  annotations,
                  highlightedSentence,
                  theme,
                  onSelectAnnotation
                )
              ) : (
                <div className={`p-8 text-center text-xs font-mono ${activeTheme.textMuted}`}>
                  <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Empty section or end of text volume.
                </div>
              )}
            </div>
          </div>
      </article>
    </main>
  );
};

function renderContentWithAnnotations(
  text: string,
  annotations: AnyAnnotation[],
  highlightedSentence: string | undefined,
  theme: ReaderTheme,
  onSelectAnnotation?: (
    annotation: AnyAnnotation,
    position?: { top: number; left: number },
    overlappingFellow?: FellowAnnotation
  ) => void
): React.ReactNode {
  if (!highlightedSentence && (!annotations || annotations.length === 0)) {
    return text;
  }

  const speechHighlightClass = getReaderTheme(theme).speechHighlight;
  const renderSliceWithSpeechHighlight = (
    rawSlice: string,
    keyPrefix: string
  ): React.ReactNode => {
    if (!highlightedSentence || !rawSlice.includes(highlightedSentence)) {
      return rawSlice;
    }
    return (
      <React.Fragment key={keyPrefix}>
        {rawSlice.split(highlightedSentence).map((part, pIdx, pArr) => (
          <React.Fragment key={pIdx}>
            {part}
            {pIdx < pArr.length - 1 && (
              <mark
                data-testid="speech-highlight"
                className={`rounded-xs px-1 transition-colors duration-200 ${speechHighlightClass}`}
              >
                {highlightedSentence}
              </mark>
            )}
          </React.Fragment>
        ))}
      </React.Fragment>
    );
  };

  const matchingAnnotations = (annotations || []).filter(
    (a) => a.selectedText && text.includes(a.selectedText)
  );

  if (matchingAnnotations.length === 0) {
    return renderSliceWithSpeechHighlight(text, 'text-full');
  }

  const cleanSpans = computeAnnotationSpans(text, matchingAnnotations);

  const elements: React.ReactNode[] = [];
  let currentIndex = 0;

  cleanSpans.forEach((span, i) => {
    if (span.start > currentIndex) {
      elements.push(
        renderSliceWithSpeechHighlight(text.slice(currentIndex, span.start), `text-${i}`)
      );
    }

    const colorConfig = ANNOTATION_COLOR_CONFIG[span.annotation.color] || ANNOTATION_COLOR_CONFIG.yellow;
    const isFellowOnly = Boolean(span.fellowAnnotation && !span.selfAnnotation);
    const hasOverlap = Boolean(span.selfAnnotation && span.fellowAnnotation);

    const highlightClass = isFellowOnly
      ? 'bg-amber-500/15 border-b-2 border-dashed border-amber-600/75 dark:border-amber-400/75 rounded-xs px-0.5 cursor-pointer transition-colors hover:bg-amber-500/25 text-inherit'
      : hasOverlap
      ? 'py-[3.5px] px-0.5 bg-amber-500/20 dark:bg-amber-500/25 border-b-2 border-dashed border-amber-600/85 dark:border-amber-400/85 rounded-xs cursor-pointer transition-colors text-inherit'
      : colorConfig.surfaceHighlightClass;

    elements.push(
      <mark
        key={`ann-${span.annotation.id}-${i}`}
        data-testid={isFellowOnly ? 'fellow-annotation-highlight' : 'user-annotation-highlight'}
        data-annotation-id={span.annotation.id}
        data-annotation-color={span.annotation.color}
        data-fellow-username={span.fellowAnnotation?.fellowUsername}
        data-fellow-display-name={span.fellowAnnotation?.fellowDisplayName}
        onClick={(e) => {
          e.stopPropagation();
          // If the user has an active non-collapsed text selection (e.g. dragged to select text inside <mark>),
          // allow handleSelection to handle it without being clobbered by whole-annotation click.
          const sel = typeof window !== 'undefined' ? window.getSelection() : null;
          if (sel && !sel.isCollapsed && sel.toString().trim().length >= 2) {
            return;
          }

          const rect = e.currentTarget.getBoundingClientRect();
          const pos = {
            top: rect.top,
            left: rect.left + rect.width / 2,
          };
          if (hasOverlap && span.selfAnnotation && span.fellowAnnotation) {
            onSelectAnnotation?.(span.selfAnnotation, pos, span.fellowAnnotation);
          } else {
            onSelectAnnotation?.(span.annotation, pos);
          }
        }}
        className={highlightClass}
      >
        {hasOverlap ? (
          <span
            data-testid="overlapping-inner-highlight"
            className={`py-[0.5px] px-0.5 rounded-xs ring-1 ring-inset ${colorConfig.overlapRingClass} ${colorConfig.surfaceHighlightClass}`}
          >
            {text.slice(span.start, span.end)}
          </span>
        ) : (
          text.slice(span.start, span.end)
        )}
        {span.fellowAnnotation && span.isFellowEnd !== false && (
          <sup
            data-testid="fellow-highlight-badge"
            className="ml-0.5 inline-flex items-center px-1 py-0 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 select-none"
          >
            {span.fellowAnnotation.fellowDisplayName || `@${span.fellowAnnotation.fellowUsername}`}
          </sup>
        )}
      </mark>
    );

    currentIndex = span.end;
  });

  if (currentIndex < text.length) {
    elements.push(renderSliceWithSpeechHighlight(text.slice(currentIndex), 'text-end'));
  }

  return <>{elements}</>;
}

interface TextNodeSegment {
  node: Text;
  start: number;
  end: number;
}

function collectContentTextSegments(root: HTMLElement): TextNodeSegment[] {
  if (typeof document === 'undefined' || typeof document.createTreeWalker !== 'function') {
    return [];
  }
  const segments: TextNodeSegment[] = [];
  let offset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (parent?.closest('[data-testid="fellow-highlight-badge"]')) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let current = walker.nextNode() as Text | null;
  while (current) {
    const len = current.nodeValue?.length ?? 0;
    if (len > 0) {
      segments.push({
        node: current,
        start: offset,
        end: offset + len,
      });
      offset += len;
    }
    current = walker.nextNode() as Text | null;
  }
  return segments;
}

function measureCharRect(segments: TextNodeSegment[], charIdx: number): DOMRect | null {
  if (typeof document === 'undefined' || typeof document.createRange !== 'function') {
    return null;
  }
  for (const seg of segments) {
    if (charIdx >= seg.start && charIdx < seg.end) {
      try {
        const range = document.createRange();
        const localOffset = charIdx - seg.start;
        range.setStart(seg.node, localOffset);
        range.setEnd(seg.node, localOffset + 1);
        const rect = range.getBoundingClientRect();
        if (rect && (rect.height > 0 || rect.width > 0 || rect.top !== 0 || rect.bottom !== 0)) {
          return rect;
        }
        return null;
      } catch {
        return null;
      }
    }
  }
  return null;
}

function findBestTextMatch(
  haystack: string,
  needle: string,
  targetRatio: number
): { start: number; end: number } | null {
  const trimmed = needle.trim();
  if (!trimmed || !haystack) return null;

  let searchIndex = 0;
  let bestMatch: { start: number; end: number; distance: number } | null = null;
  const totalLen = Math.max(1, haystack.length);

  while (searchIndex <= haystack.length - trimmed.length) {
    const found = haystack.indexOf(trimmed, searchIndex);
    if (found === -1) break;
    const ratio = found / totalLen;
    const distance = Math.abs(ratio - targetRatio);
    if (!bestMatch || distance < bestMatch.distance) {
      bestMatch = {
        start: found,
        end: found + trimmed.length,
        distance,
      };
    }
    searchIndex = found + 1;
  }

  return bestMatch ? { start: bestMatch.start, end: bestMatch.end } : null;
}
