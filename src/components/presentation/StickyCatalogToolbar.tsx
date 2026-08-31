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
  WifiOff,
  Zap,
  Info,
  Sparkles,
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
  isFiltersOpen?: boolean;
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
  isFiltersOpen = false,
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
      className="sticky top-16 z-30 w-full bg-background border-b border-border shadow-md transition-colors py-2.5 px-4 sm:px-6 lg:px-8"
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
            data-testid="open-filters-btn"
            className={`text-xs font-mono uppercase tracking-wider font-bold gap-1.5 rounded-lg border transition-all ${
              isFiltersOpen || activeFilterCount > 0
                ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                : 'border-border text-foreground hover:border-primary'
            }`}
            aria-label={isFiltersOpen ? 'Close advanced filters' : 'Open advanced filters'}
            aria-expanded={isFiltersOpen}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono font-bold ${
                isFiltersOpen ? 'bg-white text-primary' : 'bg-primary text-primary-foreground'
              }`}>
                {activeFilterCount}
              </span>
            )}
          </Button>

          {/* Active Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full sm:max-w-md md:max-w-lg shrink min-w-0 py-0.5">
            {activeFilterChips.map((chip) => (
              <span
                key={chip.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-muted text-foreground border border-border shrink-0"
              >
                <span>{chip.label}</span>
                <button
                  type="button"
                  onClick={chip.onRemove}
                  className="hover:text-destructive rounded-full p-0.5 shrink-0"
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
                className="text-xs font-mono text-primary hover:underline px-1 py-0.5 ml-1 shrink-0"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Per Page / Batch Size Selector */}
          {onPageSizeChange && (
            <div className="hidden lg:flex items-center gap-1 text-xs font-mono text-muted-foreground pl-2 border-l border-border">
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Show:</span>
              <div className="flex items-center bg-muted p-0.5 rounded-md border border-border">
                {pageSizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onPageSizeChange(size)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                      pageSize === size
                        ? 'bg-card text-primary shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
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
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap justify-between sm:justify-end w-full sm:w-auto pt-1 sm:pt-0 border-t sm:border-t-0 border-border/60">
          
          {/* 2-Part API Status & Latency Indicator */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Part 1: Live API Status Badge */}
            <div
              className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-mono tracking-wider transition-all border ${
                isError
                  ? 'bg-destructive/10 text-destructive border-destructive/30'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
              }`}
              title="Gutenberg API Status"
              data-testid="api-status-badge"
            >
              {isError ? (
                <>
                  <WifiOff className="w-3 h-3 text-destructive" />
                  <span className="font-bold">Offline</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold">Live</span>
                </>
              )}
            </div>

            {/* Part 2: Live Latency / Roundtrip Badge */}
            <div
              className="flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-mono bg-muted text-foreground border border-border"
              title="Real-time API response roundtrip time"
              data-testid="api-latency-badge"
            >
              <Zap className="w-3 h-3 text-amber-500" />
              <span className="font-bold">{displayLatency}ms</span>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-border hidden xs:block" />

          {/* View Mode Toggle */}
          <div className="flex items-center bg-muted p-0.5 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`p-1.5 rounded-md text-xs transition-all ${
                viewMode === 'grid'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
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
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label="Shelf view"
              title="Spine Shelf View (Architectural Bookcase)"
              aria-pressed={viewMode === 'shelf'}
            >
              <Library className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-4 w-[1px] bg-border hidden xs:block" />

          {/* Sticky Pagination Controls */}
          {onPageChange && (
            <div className="flex items-center gap-1 sm:gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1 || isFetching}
                onClick={() => onPageChange(page - 1)}
                className="h-8 px-2 sm:px-2.5 rounded-md text-xs font-mono"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Prev</span>
              </Button>

              {/* Direct Page Jump Form */}
              <form
                onSubmit={handleJumpSubmit}
                className="flex items-center gap-1"
                title="Jump directly to any page (e.g. 35). Note: Deep offset queries scan 70,000+ volumes from the live Gutenberg archive."
              >
                <span className="text-xs font-mono text-muted-foreground select-none">Pg</span>
                <input
                  type="text"
                  value={jumpPageInput || page}
                  onChange={(e) => setJumpPageInput(e.target.value)}
                  onFocus={() => setJumpPageInput(String(page))}
                  className="w-9 sm:w-10 h-8 text-center text-xs font-mono font-bold rounded border border-border bg-card text-foreground focus:outline-hidden focus:border-primary"
                  aria-label="Jump to page"
                  title="Enter page number and press Enter"
                />
              </form>

              <Button
                variant="outline"
                size="sm"
                disabled={!hasNextPage || isFetching}
                onClick={() => onPageChange(page + 1)}
                onMouseEnter={onPrefetchNext}
                onFocus={onPrefetchNext}
                className="h-8 px-2 sm:px-2.5 rounded-md text-xs font-mono"
                aria-label="Next page"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>

              {isFetching && (
                <div
                  className="group relative inline-flex items-center ml-1"
                  data-testid="archive-fetching-badge"
                >
                  <div
                    tabIndex={0}
                    role="status"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-[11px] font-mono tracking-wider transition-all cursor-help focus:outline-hidden focus:ring-1 focus:ring-primary shadow-xs"
                    aria-label={`Fetching page ${page} from archive. Hover or click for details.`}
                  >
                    <Loader2 className="w-3 h-3 text-primary animate-spin shrink-0" />
                    <span className="hidden sm:inline">Fetching Pg {page}...</span>
                    <Info className="w-3.5 h-3.5 text-primary/80 animate-bounce hover:text-primary shrink-0" />
                  </div>

                  {/* Rich Animated Tooltip Popover Card */}
                  <div className="opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 group-hover:pointer-events-auto group-focus-within:pointer-events-auto pointer-events-none transition-all duration-200 ease-out absolute top-full right-0 mt-2 w-72 p-3.5 bg-card text-foreground border border-border rounded-xl shadow-booksaw-hover z-50 text-xs space-y-2 text-left">
                    <div className="font-serif font-bold text-foreground flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-primary">
                        <Sparkles className="w-3.5 h-3.5" />
                        Deep Archive Query
                      </span>
                      <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        Page {page}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-sans leading-relaxed">
                      Scanning through <strong>70,000+ public domain titles</strong>. Large page offsets compute deep relational queries on live Gutenberg servers and may take a moment to deliver.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
