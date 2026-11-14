'use client';

import React, { useState } from 'react';
import {
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Library,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useHasMounted } from '@/hooks/useHasMounted';
import { CatalogTelemetryBadge, formatApiLatency } from './CatalogTelemetryBadge';
import { CatalogMobileBottomDock } from './CatalogMobileBottomDock';

export { formatApiLatency };

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
  catalogSource?: 'supabase' | 'cache';
  isError?: boolean;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  isHeaderVisible?: boolean;
  isVisible?: boolean;
  isDocked?: boolean;
  isMobileDockVisible?: boolean;
  mobileDockThreshold?: number;
  mobileDockIdleTimeoutMs?: number;
  currentSort?: 'popular' | 'descending' | 'ascending' | '';
  onSortToggle?: () => void;
  isSearchOpen?: boolean;
  onSearchToggle?: () => void;
  searchQuery?: string;
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
  catalogSource,
  isError = false,
  pageSize = 16,
  onPageSizeChange,
  isHeaderVisible = true,
  isVisible = true,
  isDocked = false,
  isMobileDockVisible,
  mobileDockThreshold = 300,
  mobileDockIdleTimeoutMs = 1400,
  currentSort,
  onSortToggle,
  isSearchOpen = false,
  onSearchToggle,
  searchQuery = '',
}) => {
  const hasMounted = useHasMounted();
  const activeFetching = hasMounted && isFetching;
  const [isFocused, setIsFocused] = useState(false);
  const [prevPage, setPrevPage] = useState(page);
  const [jumpPageInput, setJumpPageInput] = useState(String(page));

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

  const pageSizes = [8, 16];

  return (
    <>
      {/* Desktop / Tablet Sticky Sub-Header Toolbar */}
      <div
        className={`hidden sm:block sticky top-[calc(4rem+env(safe-area-inset-top,0px))] z-30 w-full bg-background ${
          isDocked && isHeaderVisible ? 'border-b border-border' : 'border-y border-border'
        } shadow-md transition-transform duration-300 ease-in-out py-2.5 px-4 sm:px-6 lg:px-8 ${
          !isVisible
            ? '-translate-y-[calc(100%+4rem+env(safe-area-inset-top,0px))] pointer-events-none'
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
              <div className="inline-flex h-9 items-center rounded-lg border border-primary-600 bg-primary-600 text-white shadow-xs overflow-hidden shrink-0">
                <button
                  type="button"
                  onClick={onOpenFilters}
                  data-testid="open-filters-btn"
                  className="h-full px-2.5 sm:px-3 text-xs font-mono uppercase tracking-wider font-bold gap-1.5 flex items-center hover:bg-primary-700 transition-colors"
                  aria-label={isFiltersOpen ? 'Close advanced filters' : 'Open advanced filters'}
                  title={isFiltersOpen ? 'Close advanced filters' : 'Open advanced filters'}
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
                  className="h-full px-2 flex items-center justify-center hover:bg-primary-700 hover:text-white transition-colors cursor-pointer"
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
                className="h-9 px-2.5 sm:px-3 text-xs font-mono uppercase tracking-wider font-bold gap-1.5 rounded-lg border border-border text-foreground hover:border-primary hover:bg-muted hover:text-foreground transition-colors shrink-0"
                aria-label={isFiltersOpen ? 'Close advanced filters' : 'Open advanced filters'}
                title={isFiltersOpen ? 'Close advanced filters' : 'Open advanced filters'}
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
                    title={`Remove filter: ${chip.label}`}
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
                  title="Clear all active filters"
                >
                  Clear all
                </button>
              )}
            </div>

            {/* Per Page / Batch Size Selector */}
            {onPageSizeChange && (
              <div className="hidden lg:flex items-center gap-1 text-xs font-mono text-muted-foreground pl-2 border-l border-border">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Show:</span>
                <SegmentedControl<number>
                  value={pageSize}
                  onChange={onPageSizeChange}
                  className="flex items-center bg-muted p-0.5 rounded-md border border-border"
                  optionClassName="px-2 py-0.5 rounded text-[11px] font-bold transition-all"
                  activeClassName="bg-card text-primary shadow-xs"
                  inactiveClassName="text-muted-foreground hover:text-foreground"
                  options={pageSizes.map((size) => ({
                    value: size,
                    label: size,
                    ariaLabel: `Show ${size} books per page`,
                    title: `Show ${size} books per page`,
                  }))}
                />
              </div>
            )}
          </div>

          {/* Right Side: Unified API Status/Latency, View Mode & Sticky Pagination */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Zero-CLS Unified API Status, Latency & Diagnostic Radar Pill (Tablet & Desktop) */}
            <CatalogTelemetryBadge
              page={page}
              activeFetching={activeFetching}
              latencyMs={latencyMs}
              catalogSource={catalogSource}
              isError={isError}
            />

            <div className="h-4 w-[1px] bg-border hidden sm:block" />

            {/* View Mode Toggle with Comfortable Mobile Touch Targets */}
            <SegmentedControl<'grid' | 'shelf'>
              value={viewMode}
              onChange={onViewModeChange}
              className="flex items-center bg-muted p-0.5 rounded-lg border border-border"
              optionClassName="p-2 sm:p-1.5 rounded-md text-xs transition-all"
              activeClassName="bg-card text-foreground shadow-xs"
              inactiveClassName="text-muted-foreground hover:text-foreground"
              options={[
                {
                  value: 'grid',
                  icon: <LayoutGrid className="w-4 h-4 sm:w-3.5 sm:h-3.5" />,
                  ariaLabel: 'Grid view',
                  title: 'Cover Grid View (2:3 Portrait Cards)',
                },
                {
                  value: 'shelf',
                  icon: <Library className="w-4 h-4 sm:w-3.5 sm:h-3.5" />,
                  ariaLabel: 'Shelf view',
                  title: 'Spine Shelf View (Architectural Bookcase)',
                },
              ]}
            />

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
                  title="Previous page"
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
                  title="Next page"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Floating Bottom Capsule Dock */}
      <CatalogMobileBottomDock
        isMobileDockVisible={isMobileDockVisible}
        mobileDockThreshold={mobileDockThreshold}
        mobileDockIdleTimeoutMs={mobileDockIdleTimeoutMs}
        isFiltersOpen={isFiltersOpen}
        activeFilterCount={activeFilterCount}
        onOpenFilters={onOpenFilters}
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        currentSort={currentSort}
        onSortToggle={onSortToggle}
        isSearchOpen={isSearchOpen}
        onSearchToggle={onSearchToggle}
        searchQuery={searchQuery}
      />
    </>
  );
};
