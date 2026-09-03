'use client';

import React, { useRef, useEffect } from 'react';
import { BookOpen, ZoomIn, Sparkles } from 'lucide-react';
import type { ReaderTheme, ReaderFontFamily } from '@/stores/useReaderStore';
import type { ChapterSection } from '@/lib/gutenberg-parser';
import type { Annotation, HighlightColor } from '@/stores/useAnnotationStore';
import { getReaderTheme } from '@/config/reader-themes';
import { READER_FONT_CONFIG } from '@/config/reader-config';
import { useReaderGestures } from '@/hooks/reader/useReaderGestures';
import { ReaderLoadingView } from './ReaderLoadingView';
import { ReaderErrorView } from './ReaderErrorView';

export interface ReaderSurfaceProps {
  theme: ReaderTheme;
  fontFamily: ReaderFontFamily;
  fontSize: number;
  lineHeight: number;
  columnWidth: 'narrow' | 'normal' | 'wide';
  readingMode: 'paginated' | 'scroll';
  chapter?: ChapterSection;
  currentPageText: string;
  chapterPage?: number;
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
  highlightedSentence?: string;
  translationSegments?: Array<{ original: string; translated: string }>;
  translatedText?: string | null;
  displayMode?: 'translated' | 'bilingual';
  isTranslating?: boolean;
  annotations?: Annotation[];
  onSelectAnnotation?: (annotation: Annotation, position?: { top: number; left: number }) => void;
  onTextSelected?: (selection: { text: string; position: { top: number; left: number } }) => void;
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
  chapterPage,
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
  highlightedSentence,
  translationSegments,
  translatedText,
  displayMode = 'translated',
  isTranslating = false,
  annotations = [],
  onSelectAnnotation,
  onTextSelected,
}) => {
  const activeTheme = getReaderTheme(theme);
  const mainRef = useRef<HTMLElement>(null);

  const { zoomFeedback, handleTouchStart, handleTouchMove, handleTouchEnd } = useReaderGestures({
    fontSize,
    readingMode,
    onFontSizeChange,
    onNextPage,
    onPreviousPage,
  });

  // Smooth animated scroll-to-top on page or chapter transition
  useEffect(() => {
    if (readingMode === 'paginated' && mainRef.current) {
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      mainRef.current.scrollTo({
        top: 0,
        behavior: prefersReducedMotion ? 'instant' : 'smooth',
      });
    }
  }, [currentPageText, activeChapterIndex, readingMode]);

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
    return <ReaderErrorView activeTheme={activeTheme} onRetry={onRetry} />;
  }

  const baseContent = readingMode === 'paginated' ? currentPageText : (chapter?.content || '');
  const contentToDisplay = translatedText || baseContent;

  const handleMouseUp = () => {
    if (typeof window === 'undefined' || !onTextSelected) return;
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const text = selection.toString().trim();
    if (text.length < 2) return;

    try {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        onTextSelected({
          text,
          position: {
            top: rect.top,
            left: rect.left + rect.width / 2,
          },
        });
      }
    } catch {
      // Non-blocking fallback
    }
  };

  return (
    <main
      ref={mainRef}
      className={`relative flex-1 overflow-y-scroll transition-colors duration-theme select-text ${activeTheme.surface} ${activeTheme.scrollbarClass}`}
      role="main"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={(e) => {
        handleTouchEnd(e);
        handleMouseUp();
      }}
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
        onMouseUp={handleMouseUp}
        className={`mx-auto px-6 sm:px-12 pt-10 sm:pt-16 ${
          highlightedSentence ? 'pb-32 sm:pb-36' : 'pb-10 sm:pb-16'
        } select-text ${widthClass} ${fontClass} animate-page-turn`}
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: `${lineHeight}`,
        }}
      >
          {/* Subtle Translating Indicator */}
          {isTranslating && (
            <div
              data-testid="translating-indicator"
              className="flex items-center justify-center gap-2 py-1.5 px-3 mb-6 mx-auto w-fit rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-mono animate-pulse"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Translating page content...</span>
            </div>
          )}
          
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

          {/* Bilingual Parallel Mode Body */}
          {displayMode === 'bilingual' && translationSegments && translationSegments.length > 0 ? (
            <div
              data-testid="reader-bilingual-body"
              className="space-y-4 select-text text-inherit font-normal antialiased"
              style={{
                fontSize: `${fontSize}px`,
                lineHeight: `${lineHeight}`,
              }}
            >
              {translationSegments.map((seg, idx) => {
                const isHighlighted = highlightedSentence && seg.translated.includes(highlightedSentence);
                return (
                  <div key={idx} className="space-y-1 py-1 border-l-2 border-primary/30 pl-3">
                    <p className="font-normal text-inherit leading-relaxed">
                      {isHighlighted ? (
                        <mark
                          data-testid="speech-highlight"
                          className={`rounded-xs px-1 transition-colors duration-200 ${
                            theme === 'sepia'
                              ? 'bg-amber-500/25 text-[#fef6eb]'
                              : 'bg-primary-500/20 text-inherit'
                          }`}
                        >
                          {seg.translated}
                        </mark>
                      ) : (
                        renderContentWithAnnotations(
                          seg.translated,
                          annotations,
                          highlightedSentence,
                          theme,
                          onSelectAnnotation
                        )
                      )}
                    </p>
                    {seg.original && (
                      <p className={`text-[0.85em] italic ${activeTheme.textMuted} font-serif leading-normal`}>
                        {renderContentWithAnnotations(
                          seg.original,
                          annotations,
                          undefined,
                          theme,
                          onSelectAnnotation
                        )}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Standard / Translated Full Body */
            <div
              data-testid="reader-content-body"
              className="space-y-6 select-text whitespace-pre-wrap text-inherit font-normal antialiased [word-break:normal] [overflow-wrap:break-word] [hyphens:none]"
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
          )}
      </article>
    </main>
  );
};

const HIGHLIGHT_COLOR_CLASSES: Record<HighlightColor, string> = {
  yellow:
    'bg-amber-300/40 dark:bg-amber-400/25 border-b-2 border-amber-400/80 text-inherit cursor-pointer rounded-xs px-0.5 transition-colors hover:bg-amber-300/60 dark:hover:bg-amber-400/40 selection:bg-amber-300/70 dark:selection:bg-amber-400/50 selection:text-inherit',
  amber:
    'bg-orange-300/40 dark:bg-orange-400/25 border-b-2 border-orange-400/80 text-inherit cursor-pointer rounded-xs px-0.5 transition-colors hover:bg-orange-300/60 dark:hover:bg-orange-400/40 selection:bg-orange-300/70 dark:selection:bg-orange-400/50 selection:text-inherit',
  mint:
    'bg-emerald-300/40 dark:bg-emerald-400/25 border-b-2 border-emerald-400/80 text-inherit cursor-pointer rounded-xs px-0.5 transition-colors hover:bg-emerald-300/60 dark:hover:bg-emerald-400/40 selection:bg-emerald-300/70 dark:selection:bg-emerald-400/50 selection:text-inherit',
  rose:
    'bg-rose-300/40 dark:bg-rose-400/25 border-b-2 border-rose-400/80 text-inherit cursor-pointer rounded-xs px-0.5 transition-colors hover:bg-rose-300/60 dark:hover:bg-rose-400/40 selection:bg-rose-300/70 dark:selection:bg-rose-400/50 selection:text-inherit',
};

function renderContentWithAnnotations(
  text: string,
  annotations: Annotation[],
  highlightedSentence: string | undefined,
  theme: ReaderTheme,
  onSelectAnnotation?: (annotation: Annotation, position?: { top: number; left: number }) => void
): React.ReactNode {
  if (!highlightedSentence && (!annotations || annotations.length === 0)) {
    return text;
  }

  const matchingAnnotations = (annotations || []).filter(
    (a) => a.selectedText && text.includes(a.selectedText)
  );

  if (matchingAnnotations.length === 0) {
    if (highlightedSentence && text.includes(highlightedSentence)) {
      return (
        <>
          {text.split(highlightedSentence).map((part, index, arr) => (
            <React.Fragment key={index}>
              {part}
              {index < arr.length - 1 && (
                <mark
                  data-testid="speech-highlight"
                  className={`rounded-xs px-1 transition-colors duration-200 ${
                    theme === 'sepia'
                      ? 'bg-amber-500/25 text-[#fef6eb]'
                      : 'bg-primary-500/20 text-inherit'
                  }`}
                >
                  {highlightedSentence}
                </mark>
              )}
            </React.Fragment>
          ))}
        </>
      );
    }
    return text;
  }

  interface Span {
    start: number;
    end: number;
    annotation: Annotation;
  }
  const spans: Span[] = [];
  for (const ann of matchingAnnotations) {
    let searchStart = 0;
    while (searchStart < text.length) {
      const idx = text.indexOf(ann.selectedText, searchStart);
      if (idx === -1) break;
      spans.push({ start: idx, end: idx + ann.selectedText.length, annotation: ann });
      searchStart = idx + ann.selectedText.length;
    }
  }

  spans.sort((a, b) => a.start - b.start);

  const cleanSpans: Span[] = [];
  let lastEnd = 0;
  for (const span of spans) {
    if (span.start >= lastEnd) {
      cleanSpans.push(span);
      lastEnd = span.end;
    }
  }

  const elements: React.ReactNode[] = [];
  let currentIndex = 0;

  cleanSpans.forEach((span, i) => {
    if (span.start > currentIndex) {
      const rawSlice = text.slice(currentIndex, span.start);
      elements.push(
        highlightedSentence && rawSlice.includes(highlightedSentence) ? (
          <React.Fragment key={`text-${i}`}>
            {rawSlice.split(highlightedSentence).map((part, pIdx, pArr) => (
              <React.Fragment key={pIdx}>
                {part}
                {pIdx < pArr.length - 1 && (
                  <mark
                    data-testid="speech-highlight"
                    className={`rounded-xs px-1 transition-colors duration-200 ${
                      theme === 'sepia'
                        ? 'bg-amber-500/25 text-[#fef6eb]'
                        : 'bg-primary-500/20 text-inherit'
                    }`}
                  >
                    {highlightedSentence}
                  </mark>
                )}
              </React.Fragment>
            ))}
          </React.Fragment>
        ) : (
          rawSlice
        )
      );
    }

    elements.push(
      <mark
        key={`ann-${span.annotation.id}-${i}`}
        data-testid="user-annotation-highlight"
        data-annotation-id={span.annotation.id}
        data-annotation-color={span.annotation.color}
        onClick={(e) => {
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          onSelectAnnotation?.(span.annotation, {
            top: rect.top,
            left: rect.left + rect.width / 2,
          });
        }}
        className={HIGHLIGHT_COLOR_CLASSES[span.annotation.color] || HIGHLIGHT_COLOR_CLASSES.yellow}
      >
        {text.slice(span.start, span.end)}
      </mark>
    );

    currentIndex = span.end;
  });

  if (currentIndex < text.length) {
    const rawSlice = text.slice(currentIndex);
    elements.push(
      highlightedSentence && rawSlice.includes(highlightedSentence) ? (
        <React.Fragment key="text-end">
          {rawSlice.split(highlightedSentence).map((part, pIdx, pArr) => (
            <React.Fragment key={pIdx}>
              {part}
              {pIdx < pArr.length - 1 && (
                <mark
                  data-testid="speech-highlight"
                  className={`rounded-xs px-1 transition-colors duration-200 ${
                    theme === 'sepia'
                      ? 'bg-amber-500/25 text-[#fef6eb]'
                      : 'bg-primary-500/20 text-inherit'
                  }`}
                >
                  {highlightedSentence}
                </mark>
              )}
            </React.Fragment>
          ))}
        </React.Fragment>
      ) : (
        rawSlice
      )
    );
  }

  return <>{elements}</>;
}
