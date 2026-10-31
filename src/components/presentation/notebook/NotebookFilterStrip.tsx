'use client';

import React, { useRef, useEffect } from 'react';
import type { HighlightColor, MarginaliaSourceFilter } from '@/stores/useAnnotationStore';
import {
  ANNOTATION_COLOR_LIST,
  ALL_COLORS_FILTER_BADGE,
} from '@/config/annotation-tokens';
import { attachHorizontalDragAndWheelScroll } from '@/lib/scroll-utils';

const COLOR_FILTERS: Array<{ id: HighlightColor | 'all'; label: string; badgeClass: string }> = [
  { id: 'all', label: 'All Colors', badgeClass: ALL_COLORS_FILTER_BADGE },
  ...ANNOTATION_COLOR_LIST.map((c) => ({
    id: c.id,
    label: c.label,
    badgeClass: c.filterBadgeClass,
  })),
];

export interface NotebookFilterStripProps {
  selectedColor: HighlightColor | 'all';
  onSelectColor: (color: HighlightColor | 'all') => void;
  marginaliaSourceFilter: MarginaliaSourceFilter;
  onSelectSourceFilter: (source: MarginaliaSourceFilter) => void;
  ownCount: number;
  fellowCount: number;
  pairedAllCount: number;
  sourceFilteredItems: Array<{ color: HighlightColor }>;
}

/**
 * Horizontal click-and-drag + wheel scrollable filter strip for the Literary Notebook,
 * combining Symposium source pills (`All Marginalia`, `My Marginalia`, `Fellows' Marginalia`)
 * and highlight color filter chips.
 */
export const NotebookFilterStrip: React.FC<NotebookFilterStripProps> = ({
  selectedColor,
  onSelectColor,
  marginaliaSourceFilter,
  onSelectSourceFilter,
  ownCount,
  fellowCount,
  pairedAllCount,
  sourceFilteredItems,
}) => {
  const colorTabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = colorTabsRef.current;
    if (!el) return;
    return attachHorizontalDragAndWheelScroll(el);
  }, []);

  return (
    <div
      ref={colorTabsRef}
      data-testid="notebook-color-tabs"
      data-no-swipe
      className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] overscroll-x-contain cursor-grab select-none"
    >
      {fellowCount > 0 && (
        <>
          <button
            type="button"
            data-testid="notebook-source-all"
            onClick={() => onSelectSourceFilter('all')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-all shrink-0 border cursor-pointer ${
              marginaliaSourceFilter === 'all'
                ? 'border-primary bg-primary text-primary-foreground font-bold shadow-xs'
                : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50'
            }`}
          >
            <span>All Marginalia</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-muted text-foreground">
              {pairedAllCount}
            </span>
          </button>
          <button
            type="button"
            data-testid="notebook-source-mine"
            onClick={() => onSelectSourceFilter('mine')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-all shrink-0 border cursor-pointer ${
              marginaliaSourceFilter === 'mine'
                ? 'border-primary bg-primary text-primary-foreground font-bold shadow-xs'
                : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50'
            }`}
          >
            <span>My Marginalia</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-muted text-foreground">
              {ownCount}
            </span>
          </button>
          <button
            type="button"
            data-testid="notebook-source-fellows"
            onClick={() => onSelectSourceFilter('fellows')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-all shrink-0 border cursor-pointer ${
              marginaliaSourceFilter === 'fellows'
                ? 'border-amber-600 bg-amber-600 text-white font-bold shadow-xs'
                : 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-300 hover:border-amber-500'
            }`}
          >
            <span>Fellows&apos; Marginalia</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-amber-500/20 text-inherit">
              {fellowCount}
            </span>
          </button>
          <span className="h-4 w-px bg-border shrink-0 mx-0.5" aria-hidden="true" />
        </>
      )}

      {COLOR_FILTERS.map((filter) => {
        const count =
          filter.id === 'all'
            ? sourceFilteredItems.length
            : sourceFilteredItems.filter((a) => a.color === filter.id).length;
        const isSelected = selectedColor === filter.id;

        return (
          <button
            key={filter.id}
            type="button"
            onClick={() => onSelectColor(filter.id)}
            data-testid={`notebook-filter-${filter.id}`}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono transition-all shrink-0 border cursor-pointer ${
              isSelected
                ? 'border-primary bg-primary text-primary-foreground font-bold shadow-xs'
                : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-primary/50'
            }`}
          >
            <span>{filter.label}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                isSelected ? 'bg-primary-foreground/20 text-inherit' : filter.badgeClass
              }`}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

