'use client';

import React from 'react';
import { Bookmark } from 'lucide-react';

export interface ReaderRowBookmarkProps {
  bookmarkElRef?: React.RefObject<HTMLDivElement | null>;
  effectiveStartRow: number;
  effectiveEndRow: number;
  bookmarkSpanRows: number;
  estimatedMaxBookmarkRows: number;
  lineStepPx: number;
  isBookmarkActive: boolean;
  isDraggingBookmark: boolean;
  getMaxBookmarkRows: () => number;
  computeRowFromClientY: (clientY: number) => number;
  onStartDrag: () => void;
  onEmitRowChange: (nextRow: number) => void;
}

export const ReaderRowBookmark: React.FC<ReaderRowBookmarkProps> = ({
  bookmarkElRef,
  effectiveStartRow,
  effectiveEndRow,
  bookmarkSpanRows,
  estimatedMaxBookmarkRows,
  lineStepPx,
  isBookmarkActive,
  isDraggingBookmark,
  getMaxBookmarkRows,
  computeRowFromClientY,
  onStartDrag,
  onEmitRowChange,
}) => {
  return (
    <>
      {/* Click-to-Snap Margin Rail */}
      <div
        data-testid="reader-bookmark-rail"
        data-prevent-swipe
        aria-hidden="true"
        title="Click to snap reading bookmark to this line"
        onClick={(e) => {
          e.stopPropagation();
          onEmitRowChange(computeRowFromClientY(e.clientY));
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
          onStartDrag();
        }}
        onMouseDown={(e) => {
          e.stopPropagation();
          onStartDrag();
        }}
        onTouchStart={(e) => {
          e.stopPropagation();
          onStartDrag();
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          onEmitRowChange(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            onEmitRowChange(Math.min(getMaxBookmarkRows(), effectiveStartRow + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            onEmitRowChange(Math.max(0, effectiveStartRow - 1));
          } else if (e.key === 'Home') {
            e.preventDefault();
            onEmitRowChange(0);
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
  );
};

