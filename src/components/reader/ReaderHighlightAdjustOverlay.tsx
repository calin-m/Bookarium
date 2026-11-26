'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, X, AlertTriangle, WrapText, Pilcrow } from 'lucide-react';
import type { Annotation } from '@/stores/useAnnotationStore';
import type { ReaderTheme } from '@/stores/useReaderStore';
import { ANNOTATION_COLOR_CONFIG } from '@/config/annotation-tokens';
import {
  MIN_ADJUSTED_SELECTION_LENGTH,
  MAX_ADJUSTED_SELECTION_LENGTH,
} from '@/lib/reader-annotator';

export interface EndpointOverlayBox {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
}

export interface ReaderHighlightAdjustOverlayProps {
  annotation: Annotation;
  draftStart: number;
  draftEnd: number;
  totalTextLength: number;
  draftText: string;
  occurrenceCount: number;
  hasChanged: boolean;
  canExpandSentence?: boolean;
  canExpandParagraph?: boolean;
  isMaxLengthReached?: boolean;
  startBox: EndpointOverlayBox | null;
  endBox: EndpointOverlayBox | null;
  containerSize: { width: number; height: number };
  draggingEdge: 'start' | 'end' | null;
  theme?: ReaderTheme;
  onStartDrag: (edge: 'start' | 'end') => void;
  onStepWord: (edge: 'start' | 'end', direction: -1 | 1) => void;
  onStepRow: (edge: 'start' | 'end', direction: -1 | 1) => void;
  onExpandSentence: () => void;
  onExpandParagraph: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export const ReaderHighlightAdjustOverlay: React.FC<ReaderHighlightAdjustOverlayProps> = ({
  annotation,
  draftStart,
  draftEnd,
  totalTextLength,
  draftText,
  occurrenceCount,
  hasChanged,
  canExpandSentence = true,
  canExpandParagraph = true,
  isMaxLengthReached = false,
  startBox,
  endBox,
  containerSize,
  draggingEdge,
  theme = 'light',
  onStartDrag,
  onStepWord,
  onStepRow,
  onExpandSentence,
  onExpandParagraph,
  onSave,
  onCancel,
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [measuredToolbarWidth, setMeasuredToolbarWidth] = useState<number>(380);

  useEffect(() => {
    const el = toolbarRef.current;
    if (!el || typeof window === 'undefined') return;
    const measure = () => {
      const w = el.offsetWidth || el.getBoundingClientRect().width;
      if (w > 0) {
        setMeasuredToolbarWidth((prev) => (Math.abs(prev - w) > 2 ? Math.ceil(w) : prev));
      }
    };
    const rafId = window.requestAnimationFrame(measure);
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure);
      observer.observe(el);
    }
    return () => {
      window.cancelAnimationFrame(rafId);
      observer?.disconnect();
    };
  }, [occurrenceCount, isMaxLengthReached]);

  const trimmedLen = draftText.trim().length;
  const isLengthValid =
    trimmedLen >= MIN_ADJUSTED_SELECTION_LENGTH && trimmedLen <= MAX_ADJUSTED_SELECTION_LENGTH;
  const canSave = hasChanged && isLengthValid;

  const colorToken = ANNOTATION_COLOR_CONFIG[annotation.color] || ANNOTATION_COLOR_CONFIG.yellow;

  // Provide predictable geometric anchors even when JSDOM has zero-rect layout
  const fallbackStart: EndpointOverlayBox = startBox ?? {
    top: 16,
    left: 24,
    bottom: 36,
    right: 36,
    width: 12,
    height: 20,
  };
  const fallbackEnd: EndpointOverlayBox = endBox ?? {
    top: 16,
    left: 220,
    bottom: 36,
    right: 232,
    width: 12,
    height: 20,
  };

  const hasSecondaryStatus = occurrenceCount > 1 || isMaxLengthReached;
  const containerWidth = Math.max(320, containerSize.width || 640);
  const effectiveToolbarWidth = Math.min(
    Math.max(360, measuredToolbarWidth),
    Math.max(304, containerWidth - 16)
  );
  const containerHeight = containerSize.height || 0;
  const flipExtraHeight = hasSecondaryStatus ? 28 : 0;
  const shouldFlipAbove =
    containerHeight > 0 &&
    fallbackEnd.bottom + 92 + flipExtraHeight > containerHeight &&
    fallbackStart.top > 76 + flipExtraHeight;

  const idealBarLeft = fallbackEnd.left + (fallbackEnd.width || 0) / 2 - effectiveToolbarWidth / 2;
  const barLeft = Math.max(
    8,
    Math.min(idealBarLeft, Math.max(8, containerWidth - effectiveToolbarWidth - 8))
  );
  const barTop = shouldFlipAbove
    ? Math.max(8, fallbackStart.top - 58 - flipExtraHeight)
    : fallbackEnd.bottom + 14;

  const surfaceThemeClasses =
    theme === 'dark'
      ? 'bg-stone-900/95 border-stone-700/80 text-stone-100'
      : theme === 'sepia'
      ? 'bg-[#f4ecd8]/95 border-[#d5c5a3] text-[#433422]'
      : 'bg-white/95 border-stone-200/90 text-stone-900';

  const pillBtnClasses =
    theme === 'dark'
      ? 'bg-stone-800 hover:bg-stone-700 text-stone-200 border-stone-700'
      : theme === 'sepia'
      ? 'bg-[#ebe0c8] hover:bg-[#e1d2b3] text-[#433422] border-[#cbb893]'
      : 'bg-stone-100 hover:bg-stone-200 text-stone-700 border-stone-200';

  const handleKeyDown =
    (edge: 'start' | 'end') => (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        e.stopPropagation();
        onStepWord(edge, -1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        e.stopPropagation();
        onStepWord(edge, 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        onStepRow(edge, -1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        e.stopPropagation();
        onStepRow(edge, 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        if (canSave) onSave();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      }
    };

  const stopTouchAndMouse = (e: React.SyntheticEvent) => {
    e.stopPropagation();
  };

  return (
    <div
      data-testid="highlight-adjust-overlay"
      className="pointer-events-none absolute inset-0 z-20"
    >
      {/* Draggable Start Crop Handle */}
      <div
        role="slider"
        tabIndex={0}
        data-testid="highlight-adjust-handle-start"
        aria-label="Adjust highlight start boundary"
        aria-valuemin={0}
        aria-valuemax={Math.max(1, draftEnd - 1)}
        aria-valuenow={draftStart}
        aria-valuetext={draftText.slice(0, 80)}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onStartDrag('start');
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          onStartDrag('start');
        }}
        onClick={stopTouchAndMouse}
        onKeyDown={handleKeyDown('start')}
        style={{
          top: `${fallbackStart.top}px`,
          left: `${fallbackStart.left}px`,
        }}
        className="pointer-events-auto absolute -translate-x-1/2 -translate-y-full flex flex-col items-center cursor-ew-resize touch-none select-none focus:outline-none group"
      >
        <div
          className={`w-7 h-7 sm:w-5 sm:h-5 rounded-full border-2 border-white dark:border-stone-900 shadow-md flex items-center justify-center transition-transform ${
            draggingEdge === 'start' ? 'scale-125 ring-2 ring-primary-500/60' : 'group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-primary-500'
          } ${colorToken.dotClass}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
        </div>
        <span
          aria-hidden="true"
          className="w-0.5 rounded-full bg-stone-700/80 dark:bg-stone-200/80"
          style={{ height: `${Math.max(12, fallbackStart.height)}px` }}
        />
      </div>

      {/* Draggable End Crop Handle */}
      <div
        role="slider"
        tabIndex={0}
        data-testid="highlight-adjust-handle-end"
        aria-label="Adjust highlight end boundary"
        aria-valuemin={Math.min(draftStart + 1, Math.max(1, totalTextLength))}
        aria-valuemax={Math.max(1, totalTextLength)}
        aria-valuenow={draftEnd}
        aria-valuetext={draftText.slice(0, 80)}
        onPointerDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onStartDrag('end');
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          onStartDrag('end');
        }}
        onClick={stopTouchAndMouse}
        onKeyDown={handleKeyDown('end')}
        style={{
          top: `${fallbackEnd.top}px`,
          left: `${fallbackEnd.right}px`,
        }}
        className="pointer-events-auto absolute -translate-x-1/2 flex flex-col items-center cursor-ew-resize touch-none select-none focus:outline-none group"
      >
        <span
          aria-hidden="true"
          className="w-0.5 rounded-full bg-stone-700/80 dark:bg-stone-200/80"
          style={{ height: `${Math.max(12, fallbackEnd.height)}px` }}
        />
        <div
          className={`w-7 h-7 sm:w-5 sm:h-5 rounded-full border-2 border-white dark:border-stone-900 shadow-md flex items-center justify-center transition-transform ${
            draggingEdge === 'end' ? 'scale-125 ring-2 ring-primary-500/60' : 'group-hover:scale-110 group-focus-visible:ring-2 group-focus-visible:ring-primary-500'
          } ${colorToken.dotClass}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white/90" />
        </div>
      </div>

      {/* Floating Adjust Toolbar */}
      <div
        ref={toolbarRef}
        role="region"
        aria-label="Adjust highlight selection"
        data-testid="highlight-adjust-toolbar"
        onPointerDown={stopTouchAndMouse}
        onTouchStart={stopTouchAndMouse}
        onTouchMove={stopTouchAndMouse}
        onTouchEnd={stopTouchAndMouse}
        onMouseUp={stopTouchAndMouse}
        onClick={stopTouchAndMouse}
        style={{
          top: `${barTop}px`,
          left: `${barLeft}px`,
        }}
        className={`pointer-events-auto absolute w-max max-w-[calc(100%-1rem)] rounded-2xl border shadow-xl backdrop-blur-md px-2.5 py-2 flex flex-col items-stretch gap-1.5 ${surfaceThemeClasses}`}
      >
        <div
          data-testid="highlight-adjust-actions-row"
          className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 whitespace-nowrap"
        >
          <button
            type="button"
            data-testid="adjust-expand-sentence-btn"
            disabled={!canExpandSentence}
            title={
              canExpandSentence
                ? 'Expand to full sentence (or next sentence)'
                : 'Already at page or 5,000-character limit'
            }
            onClick={onExpandSentence}
            className={`px-2 py-1 rounded-lg border text-xs font-medium inline-flex items-center gap-1 shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${pillBtnClasses}`}
          >
            <WrapText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>+ Sentence</span>
          </button>

          <button
            type="button"
            data-testid="adjust-expand-paragraph-btn"
            disabled={!canExpandParagraph}
            title={
              canExpandParagraph
                ? 'Expand to full paragraph (or next paragraph)'
                : 'Already at page or 5,000-character limit'
            }
            onClick={onExpandParagraph}
            className={`px-2 py-1 rounded-lg border text-xs font-medium inline-flex items-center gap-1 shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${pillBtnClasses}`}
          >
            <Pilcrow className="w-3.5 h-3.5" aria-hidden="true" />
            <span>+ Paragraph</span>
          </button>

          <div className="flex items-center gap-1 ml-auto shrink-0 pl-1">
            <button
              type="button"
              data-testid="adjust-cancel-btn"
              aria-label="Cancel selection adjustment"
              title="Discard selection changes (Esc)"
              onClick={onCancel}
              className="px-2 py-1 rounded-lg text-xs font-medium text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-500/10 inline-flex items-center gap-1 shrink-0 transition-colors"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Cancel</span>
            </button>

            <button
              type="button"
              data-testid="adjust-save-btn"
              aria-label="Save adjusted highlight selection"
              title={
                canSave
                  ? 'Save adjusted highlight selection (Enter)'
                  : 'Adjust selection boundaries before saving'
              }
              disabled={!canSave}
              onClick={onSave}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 shrink-0 transition-colors"
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Save</span>
            </button>
          </div>
        </div>

        {hasSecondaryStatus && (
          <div
            data-testid="highlight-adjust-status-row"
            className="flex flex-wrap items-center gap-1.5 pt-0.5"
          >
            {occurrenceCount > 1 && (
              <span
                data-testid="adjust-ambiguity-warning"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30"
              >
                <AlertTriangle className="w-3 h-3 shrink-0" aria-hidden="true" />
                <span>Matches {occurrenceCount} passages</span>
              </span>
            )}
            {isMaxLengthReached && (
              <span
                data-testid="adjust-max-length-badge"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-500/15 text-stone-600 dark:text-stone-300 border border-stone-500/25"
              >
                <span>5,000 char limit</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
