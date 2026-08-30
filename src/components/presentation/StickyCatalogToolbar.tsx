'use client';

import React, { useState } from 'react';
import {
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Library,
  X,
  Loader2,
  Activity,
  Server,
  Database,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export interface ActiveFilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}

export interface StickyCatalogToolbarProps {
  page: number;
  onPageChange?: (page: number) => void;
  hasNextPage?: boolean;
  viewMode: 'grid' | 'shelf';
  onViewModeChange: (mode: 'grid' | 'shelf') => void;
  onOpenFilters: () => void;
  activeFilterCount: number;
  activeFilterChips: ActiveFilterChip[];
  onClearAllFilters: () => void;
  isFetching?: boolean;
  onPrefetchNext?: () => void;
  latencyMs?: number;
  isError?: boolean;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
}

export const StickyCatalogToolbar: React.FC<StickyCatalogToolbarProps> = ({
  page,
  onPageChange,
  hasNextPage = true,
  viewMode,
  onViewModeChange,
  onOpenFilters,
  activeFilterCount,
  activeFilterChips,
  onClearAllFilters,
  isFetching = false,
  onPrefetchNext,
  latencyMs,
  isError = false,
  pageSize = 16,
  onPageSizeChange,
}) => {
  const [jumpPageInput, setJumpPageInput] = useState('');

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(jumpPageInput, 10);
    if (!isNaN(target) && target >= 1 && onPageChange) {
      onPageChange(target);
      setJumpPageInput('');
    }
  };

  const displayLatency = latencyMs !== undefined ? latencyMs : 140;
  const pageSizes = [8, 16, 24, 32];

  return (
    <div
      className="sticky top-16 z-30 w-full backdrop-blur-xl bg-white/95 dark:bg-[#0e1117]/95 border-b border-stone-200/90 dark:border-stone-800/90 shadow-xs transition-colors py-2.5 px-4 sm:px-6 lg:px-8"
      data-testid="sticky-catalog-toolbar"
    >
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        
        {/* Left Side: Filter Trigger, Active Chips & Per Page Selector */}
        <div className="flex items-center gap-2.5 flex-wrap min-w-0">
          {/* Advanced Filters Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenFilters}
            className={`text-xs font-mono uppercase tracking-wider font-bold gap-1.5 rounded-lg border transition-all ${
              activeFilterCount > 0
                ? 'border-primary-600 bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300'
                : 'border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300'
            }`}
            aria-label="Open advanced filters"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-primary-600 text-white text-[10px] flex items-center justify-center font-mono font-bold">
                {activeFilterCount}
              </span>
            )}
          </Button>

          {/* Active Filter Chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {activeFilterChips.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700"
              >
                <span>{chip.label}</span>
                <button
                  type="button"
                  onClick={chip.onRemove}
                  className="hover:text-red-500 rounded-full p-0.5"
                  aria-label={`Remove filter ${chip.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}

            {activeFilterChips.length > 1 && (
              <button
                type="button"
                onClick={onClearAllFilters}
                className="text-xs font-mono text-primary-600 dark:text-primary-400 hover:underline px-1 py-0.5 ml-1"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Per Page / Batch Size Selector */}
          {onPageSizeChange && (
            <div className="hidden lg:flex items-center gap-1 text-xs font-mono text-stone-500 pl-2 border-l border-stone-200 dark:border-stone-700">
              <span className="text-[11px] uppercase tracking-wider text-stone-400">Show:</span>
              <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-0.5 rounded-md border border-stone-200 dark:border-stone-700">
                {pageSizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onPageSizeChange(size)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      pageSize === size
                        ? 'bg-white dark:bg-stone-700 text-primary-600 dark:text-primary-400 shadow-xs'
                        : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                    }`}
                    aria-label={`Show ${size} books per page`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: 2-Part API Telemetry, View Mode & Sticky Pagination */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-auto">
          
          {/* 2-Part API Status & Latency Indicator */}
          <div className="flex items-center gap-1.5">
            {/* Part 1: Live API Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono tracking-wider transition-all border ${
                isError
                  ? 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-300 border-red-300 dark:border-red-800'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
              }`}
              title="Gutenberg API Status"
              data-testid="api-status-badge"
            >
              {isError ? (
                <>
                  <WifiOff className="w-3 h-3 text-red-600 dark:text-red-400" />
                  <span className="font-bold">API Offline</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold">Live API</span>
                </>
              )}
            </div>

            {/* Part 2: Live Latency / Roundtrip Badge */}
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-mono bg-stone-100 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700"
              title="Real-time API response roundtrip time"
              data-testid="api-latency-badge"
            >
              <Zap className="w-3 h-3 text-amber-500" />
              <span className="font-bold">{displayLatency}ms</span>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700" />

          {/* View Mode Toggle */}
          <div className="flex items-center bg-stone-100 dark:bg-stone-800 p-0.5 rounded-lg border border-stone-200 dark:border-stone-700">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded-md text-xs transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
              aria-label="Grid view"
              title="Cover Grid View (2:3 Portrait Cards)"
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('shelf')}
              className={`p-1.5 rounded-md text-xs transition-all ${
                viewMode === 'shelf'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
              aria-label="Shelf view"
              title="Spine Shelf View (Architectural Bookcase)"
              aria-pressed={viewMode === 'shelf'}
            >
              <Library className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700" />

          {/* Sticky Pagination Controls */}
          {onPageChange && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => onPageChange(page - 1)}
                className="h-8 px-2.5 rounded-md text-xs font-mono"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </Button>

              {/* Direct Page Jump Form */}
              <form onSubmit={handleJumpSubmit} className="flex items-center gap-1">
                <span className="text-xs font-mono text-stone-500 select-none">Pg</span>
                <input
                  type="text"
                  value={jumpPageInput || page}
                  onChange={(e) => setJumpPageInput(e.target.value)}
                  onFocus={() => setJumpPageInput(String(page))}
                  className="w-10 h-8 text-center text-xs font-mono font-bold rounded border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-primary-500"
                  aria-label="Jump to page"
                />
              </form>

              <Button
                variant="outline"
                size="sm"
                disabled={!hasNextPage || isFetching}
                onClick={() => onPageChange(page + 1)}
                onMouseEnter={onPrefetchNext}
                onFocus={onPrefetchNext}
                className="h-8 px-2.5 rounded-md text-xs font-mono"
                aria-label="Next page"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>

              {isFetching && (
                <Loader2 className="w-3.5 h-3.5 text-primary-600 animate-spin ml-1" />
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
