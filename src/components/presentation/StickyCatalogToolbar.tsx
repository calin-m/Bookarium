'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Library,
  X,
  WifiOff,
  Zap,
  Sparkles,
  ArrowUp,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useHasMounted } from '@/hooks/useHasMounted';

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
  isHeaderVisible?: boolean;
  isVisible?: boolean;
  isMobileDockVisible?: boolean;
  mobileDockThreshold?: number;
  mobileDockIdleTimeoutMs?: number;
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
  isHeaderVisible = true,
  isVisible = true,
  isMobileDockVisible,
  mobileDockThreshold = 300,
  mobileDockIdleTimeoutMs = 1400,
}) => {
  const hasMounted = useHasMounted();
  const [isFocused, setIsFocused] = useState(false);
  const [prevPage, setPrevPage] = useState(page);
  const [jumpPageInput, setJumpPageInput] = useState(String(page));
  const [internalMobileDockVisible, setInternalMobileDockVisible] = useState(false);
  const [isIdle, setIsIdle] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      if (isMobileDockVisible === undefined) {
        const shouldShow = scrollY > mobileDockThreshold;
        setInternalMobileDockVisible((prev) => (prev !== shouldShow ? shouldShow : prev));
      }

      // Reset idle state immediately on active scrolling
      setIsIdle(false);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }

      // Schedule fade-out after idle timeout
      if (mobileDockIdleTimeoutMs > 0) {
        idleTimerRef.current = setTimeout(() => {
          setIsIdle(true);
        }, mobileDockIdleTimeoutMs);
      }
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [isMobileDockVisible, mobileDockThreshold, mobileDockIdleTimeoutMs]);

  const effectiveMobileDockVisible =
    isMobileDockVisible !== undefined ? isMobileDockVisible : internalMobileDockVisible;
  const isDockDimmed = effectiveMobileDockVisible && isIdle && !isFiltersOpen && !isHovered;

  // Synchronize input with external page changes during render when not actively editing
  if (page !== prevPage) {
    setPrevPage(page);
    if (!isFocused) {
      setJumpPageInput(String(page));
    }
  }

  const commitPageJump = (rawValue: string) => {
    const target = parseInt(rawValue, 10);
    if (!isNaN(target) && target >= 1 && onPageChange) {
      if (target !== page) {
        onPageChange(target);
      }
      setJumpPageInput(String(target));
    } else {
      setJumpPageInput(String(page));
    }
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    commitPageJump(jumpPageInput);
  };

  const displayLatency = latencyMs !== undefined ? latencyMs : 140;
  const pageSizes = [8, 16];

  return (
    <>
      {/* Desktop / Tablet Sticky Sub-Header Toolbar */}
      <div
        className={`hidden sm:block sticky top-16 z-30 w-full bg-background border-y border-border shadow-md transition-transform duration-300 ease-in-out py-2.5 px-4 sm:px-6 lg:px-8 ${
          !isVisible
            ? '-translate-y-[calc(100%+4rem)] pointer-events-none'
            : isHeaderVisible
              ? 'translate-y-0'
              : '-translate-y-16'
        }`}
        data-testid="sticky-catalog-toolbar"
      >
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-3">
        
        {/* Left Side: Filter Trigger, Active Chips & Per Page Selector */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 flex-1 overflow-hidden">
          {/* Advanced Filters Button / Split Quick-Clear Capsule */}
          {activeFilterCount > 0 ? (
            <div className="inline-flex items-center rounded-lg border border-primary-600 bg-primary-600 text-white shadow-xs overflow-hidden shrink-0">
              <button
                type="button"
                onClick={onOpenFilters}
                data-testid="open-filters-btn"
                className="h-9 px-2.5 sm:px-3 text-xs font-mono uppercase tracking-wider font-bold gap-1.5 flex items-center hover:bg-primary-700 transition-colors"
                aria-label={isFiltersOpen ? 'Close advanced filters' : 'Open advanced filters'}
                aria-expanded={isFiltersOpen}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                <span className="inline">Filters</span>
                <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono font-bold bg-primary-foreground/25 text-primary-foreground">
                  {activeFilterCount}
                </span>
              </button>
              <div className="h-4 w-[1px] bg-primary-400/40" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearAllFilters();
                }}
                data-testid="clear-all-filters-btn"
                className="h-9 px-2 flex items-center justify-center hover:bg-primary-700 hover:text-white transition-colors cursor-pointer"
                aria-label={`Clear all ${activeFilterCount} active filters`}
                title={`Clear all ${activeFilterCount} active filters`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenFilters}
              data-testid="open-filters-btn"
              className="h-9 px-2.5 sm:px-3 text-xs font-mono uppercase tracking-wider font-bold gap-1.5 rounded-lg border border-border text-foreground hover:border-primary hover:bg-muted hover:text-foreground transition-all shrink-0"
              aria-label={isFiltersOpen ? 'Close advanced filters' : 'Open advanced filters'}
              aria-expanded={isFiltersOpen}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span className="inline">Filters</span>
            </Button>
          )}

          {/* Active Filter Chips */}
          <div
            data-no-swipe
            className="flex items-center gap-1.5 overflow-x-auto scrollbar-none max-w-full sm:max-w-md md:max-w-lg shrink min-w-0 py-0.5"
          >
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
                    aria-pressed={pageSize === size}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: 2-Part API Telemetry, View Mode & Sticky Pagination */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          
          {/* 2-Part API Status & Latency Indicator (Tablet & Desktop) */}
          <div className="hidden sm:flex items-center gap-1 sm:gap-1.5">
            {/* Part 1: Live API Status Badge */}
            <div
              className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-mono tracking-wider transition-all border border-border ${
                isError
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-success/10 text-success'
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
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <span className="font-bold hidden md:inline">Live</span>
                </>
              )}
            </div>

            {/* Part 2: Live Latency / Roundtrip Badge */}
            <div
              className="hidden md:flex items-center gap-1 px-1.5 sm:px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-mono bg-muted text-foreground border border-border"
              title="Real-time API response roundtrip time"
              data-testid="api-latency-badge"
            >
              <Zap className="w-3 h-3 text-amber-500" />
              <span className="font-bold">{displayLatency}ms</span>
            </div>
          </div>

          <div className="h-4 w-[1px] bg-border hidden sm:block" />

          {/* View Mode Toggle with Comfortable Mobile Touch Targets */}
          <div className="flex items-center bg-muted p-0.5 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              className={`p-2 sm:p-1.5 rounded-md text-xs transition-all ${
                viewMode === 'grid'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label="Grid view"
              title="Cover Grid View (2:3 Portrait Cards)"
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('shelf')}
              className={`p-2 sm:p-1.5 rounded-md text-xs transition-all ${
                viewMode === 'shelf'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label="Shelf view"
              title="Spine Shelf View (Architectural Bookcase)"
              aria-pressed={viewMode === 'shelf'}
            >
              <Library className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            </button>
          </div>

          <div className="h-4 w-[1px] bg-border hidden sm:block" />

          {/* Sticky Pagination Controls (Tablet & Desktop; Mobile uses primary bottom pagination) */}
          {onPageChange && (
            <div className="hidden sm:flex items-center gap-1 sm:gap-1.5">
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
                className="flex items-center"
                title="Jump directly to any page (e.g. 35). Note: Deep offset queries scan 70,000+ volumes from the live Gutenberg archive."
              >
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={jumpPageInput}
                  onChange={(e) => {
                    const clean = e.target.value.replace(/\D/g, '');
                    setJumpPageInput(clean);
                  }}
                  onFocus={(e) => {
                    setIsFocused(true);
                    e.target.select();
                  }}
                  onClick={(e) => {
                    (e.target as HTMLInputElement).select();
                  }}
                  onBlur={() => {
                    setIsFocused(false);
                    commitPageJump(jumpPageInput);
                  }}
                  className="w-8 sm:w-9 h-8 text-center text-xs font-mono font-bold rounded border border-border bg-card text-foreground focus:outline-hidden focus:border-primary"
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

              {hasMounted && isFetching && (
                <div
                  className="group relative inline-flex items-center ml-1"
                  data-testid="archive-fetching-badge"
                >
                  <div
                    tabIndex={0}
                    role="status"
                    className="inline-flex items-center justify-center p-1.5 sm:px-2.5 sm:py-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-[11px] font-mono tracking-wider transition-all cursor-help focus:outline-hidden focus:ring-1 focus:ring-primary shadow-xs"
                    aria-label={`Fetching page ${page} from archive. Hover or click for details.`}
                  >
                    <span className="relative flex items-center justify-center w-4 h-4 shrink-0 animate-bounce">
                      <span className="absolute inset-0 rounded-full border-[1.5px] border-primary/30 border-t-primary animate-spin" />
                      <span className="text-[10px] font-serif font-bold italic text-primary leading-none select-none">
                        i
                      </span>
                    </span>
                    <span className="hidden sm:inline ml-1.5">Fetching Pg {page}...</span>
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

      {/* Mobile Floating Bottom Capsule Dock */}
      <aside
        className={`fixed bottom-6 inset-x-0 mx-auto w-fit max-w-[92vw] z-40 sm:hidden transition-all focus-within:opacity-100 focus-within:pointer-events-auto ${
          !effectiveMobileDockVisible
            ? 'translate-y-24 opacity-0 pointer-events-none duration-300 ease-in-out'
            : isDockDimmed
              ? 'translate-y-0 opacity-0 pointer-events-none duration-400 ease-out'
              : 'translate-y-0 opacity-100 duration-150 ease-in'
        }`}
        data-testid="mobile-catalog-dock"
        aria-label="Mobile catalog controls"
        onPointerEnter={() => {
          setIsHovered(true);
          setIsIdle(false);
          if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        }}
        onPointerLeave={() => {
          setIsHovered(false);
          if (mobileDockIdleTimeoutMs > 0) {
            if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
            idleTimerRef.current = setTimeout(() => setIsIdle(true), mobileDockIdleTimeoutMs);
          }
        }}
        onPointerDown={() => {
          setIsIdle(false);
          if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
        }}
      >
        <div className="flex items-center gap-1.5 p-1.5 bg-card border border-border shadow-2xl rounded-full text-foreground">
          {/* Mobile Filter Trigger / Split Quick-Clear Capsule */}
          {activeFilterCount > 0 ? (
            <div className="flex items-center rounded-full bg-primary text-primary-foreground shadow-xs overflow-hidden shrink-0">
              <button
                type="button"
                onClick={onOpenFilters}
                data-testid="mobile-dock-filters-btn"
                className="h-9 pl-3.5 pr-2 text-xs font-mono uppercase tracking-wider font-bold gap-1.5 flex items-center hover:bg-primary-700 transition-colors"
                aria-label={isFiltersOpen ? 'Close filters' : 'Open filters'}
                aria-expanded={isFiltersOpen}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                <span>Filters</span>
                <span className="w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-mono font-bold bg-primary-foreground/25 text-primary-foreground">
                  {activeFilterCount}
                </span>
              </button>
              <div className="h-4 w-[1px] bg-primary-foreground/30" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearAllFilters();
                }}
                data-testid="mobile-dock-clear-all-btn"
                className="h-9 px-2.5 flex items-center justify-center hover:bg-primary-700 transition-colors cursor-pointer"
                aria-label={`Clear all ${activeFilterCount} active filters`}
                title={`Clear all ${activeFilterCount} active filters`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenFilters}
              data-testid="mobile-dock-filters-btn"
              className="h-9 px-3.5 rounded-full text-xs font-mono uppercase tracking-wider font-bold gap-1.5 flex items-center transition-all bg-muted hover:bg-muted/80 text-foreground"
              aria-label={isFiltersOpen ? 'Close filters' : 'Open filters'}
              aria-expanded={isFiltersOpen}
            >
              <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
              <span>Filters</span>
            </button>
          )}

          <div className="h-4 w-[1px] bg-border" />

          {/* Mobile View Mode Toggle */}
          <div className="flex items-center bg-muted p-0.5 rounded-full border border-border">
            <button
              type="button"
              onClick={() => onViewModeChange('grid')}
              data-testid="mobile-dock-grid-btn"
              className={`p-2 rounded-full text-xs transition-all ${
                viewMode === 'grid'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label="Switch to grid layout"
              title="Cover Grid"
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('shelf')}
              data-testid="mobile-dock-shelf-btn"
              className={`p-2 rounded-full text-xs transition-all ${
                viewMode === 'shelf'
                  ? 'bg-card text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label="Switch to shelf layout"
              title="Bookshelf Rack"
              aria-pressed={viewMode === 'shelf'}
            >
              <Library className="w-4 h-4" />
            </button>
          </div>

          <div className="h-4 w-[1px] bg-border" />

          {/* Scroll to Top */}
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            data-testid="mobile-dock-top-btn"
            className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer"
            aria-label="Scroll to top"
            title="Scroll to top"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
      </aside>
    </>
  );
};
