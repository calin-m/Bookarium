'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  Library,
  X,
  Sparkles,
  ArrowUp,
  Flame,
  Clock,
  Search,
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
  catalogSource?: 'supabase' | 'upstream' | 'cache';
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

export function formatApiLatency(ms?: number): string {
  if (ms === undefined || isNaN(ms)) {
    return '...';
  }
  const safeMs = Math.max(1, Math.round(ms));
  if (safeMs < 1000) {
    return `${safeMs}ms`;
  }
  const seconds = safeMs / 1000;
  return `${Number(seconds.toFixed(3))}s`;
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
  const [internalMobileDockVisible, setInternalMobileDockVisible] = useState(true);
  const [currentScrollY, setCurrentScrollY] = useState(0);
  const [isIdle, setIsIdle] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [popoverPlacement, setPopoverPlacement] = useState<'down' | 'up'>('down');
  const [isTappedOpen, setIsTappedOpen] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  const updatePlacement = React.useCallback(() => {
    if (!badgeRef.current) return;
    const rect = badgeRef.current.getBoundingClientRect();
    const estimatedPopoverHeight = 220; // safe bounding height for popover card + margin
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < estimatedPopoverHeight + 12 && spaceAbove > spaceBelow) {
      setPopoverPlacement('up');
    } else {
      setPopoverPlacement('down');
    }
  }, []);

  useEffect(() => {
    updatePlacement();
    const onScrollOrResize = () => {
      updatePlacement();
    };
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScrollOrResize);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [updatePlacement]);

  useEffect(() => {
    if (!isTappedOpen) return;
    const handleOutsidePointer = (e: PointerEvent) => {
      if (badgeRef.current && !badgeRef.current.contains(e.target as Node)) {
        setIsTappedOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
    };
  }, [isTappedOpen]);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      setCurrentScrollY(scrollY);
      if (isMobileDockVisible === undefined) {
        setInternalMobileDockVisible(true);
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
  const isAtTop = currentScrollY < 60;
  const isDockDimmed = (isIdle || isAtTop) && !isFiltersOpen && !isHovered && !isSearchOpen;

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

  const isLatencyPending = !isError && (latencyMs === undefined || isNaN(latencyMs));
  const displayLatencyText = formatApiLatency(latencyMs);
  const catalogProviderLabel =
    catalogSource === 'supabase'
      ? 'Bookarium Catalog'
      : catalogSource === 'upstream'
        ? 'Project Gutenberg Mirror'
        : 'Bookarium Catalog';
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
                    title={`Show ${size} books per page`}
                    aria-pressed={pageSize === size}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Unified API Status/Latency, View Mode & Sticky Pagination */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          
          {/* Zero-CLS Unified API Status, Latency & Diagnostic Radar Pill (Tablet & Desktop) */}
          <div
            ref={badgeRef}
            className={`group relative hidden sm:inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] sm:text-[11px] font-mono tracking-wider transition-all border border-border min-w-[72px] sm:min-w-[78px] text-center select-none cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-primary shadow-xs ${
              isError
                ? 'bg-destructive/10 text-destructive border-destructive/30'
                : activeFetching
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-success/10 text-success border-success/30'
            }`}
            tabIndex={0}
            role="status"
            data-expanded={isTappedOpen}
            aria-label={
              isError
                ? 'Catalog API status: Offline'
                : activeFetching
                  ? `Fetching page ${page} from archive. Hover or click for details.`
                  : isLatencyPending
                    ? 'Catalog status: Measuring response time'
                    : `${catalogProviderLabel} status: Online, response time ${displayLatencyText}`
            }
            data-testid="api-status-badge"
            onClick={() => {
              updatePlacement();
              setIsTappedOpen((prev) => !prev);
            }}
            onPointerEnter={updatePlacement}
            onFocus={updatePlacement}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                updatePlacement();
                setIsTappedOpen((prev) => !prev);
              } else if (e.key === 'Escape') {
                setIsTappedOpen(false);
                badgeRef.current?.blur();
              }
            }}
          >
            {activeFetching ? (
              <span
                className="relative flex items-center justify-center w-3.5 h-3.5 shrink-0"
                data-testid="archive-fetching-badge"
              >
                <span className="absolute inset-0 rounded-full border-[1.5px] border-primary/30 border-t-primary animate-spin" />
                <span className="text-[8px] font-serif font-bold italic text-primary leading-none select-none">
                  i
                </span>
              </span>
            ) : (
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 animate-pulse ${
                  isError ? 'bg-destructive' : 'bg-success'
                }`}
                data-testid="api-status-dot"
              />
            )}
            <span className="font-bold" data-testid="api-latency-badge">
              {isError ? (
                'Offline'
              ) : activeFetching || isLatencyPending ? (
                <span
                  className="inline-flex items-center tracking-widest animate-pulse"
                  data-testid="api-latency-loading"
                >
                  •••
                </span>
              ) : (
                displayLatencyText
              )}
            </span>

            {/* Rich Animated Dual-Service Diagnostics Popover Card */}
            <div
              className={`transition-all duration-200 ease-out absolute right-0 w-72 sm:w-80 p-3.5 bg-card text-foreground border border-border rounded-xl shadow-booksaw-hover z-50 text-xs space-y-2.5 text-left ${
                isTappedOpen
                  ? 'opacity-100 pointer-events-auto'
                  : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 group-hover:pointer-events-auto group-focus-within:pointer-events-auto pointer-events-none'
              } ${
                popoverPlacement === 'up'
                  ? 'bottom-full mb-2 origin-bottom-right'
                  : 'top-full mt-2 origin-top-right'
              }`}
              data-testid="catalog-telemetry-popover"
            >
              <div className="font-serif font-bold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-primary">
                  <Sparkles className="w-3.5 h-3.5" />
                  {activeFetching ? 'Deep Archive Query' : isError ? 'Catalog Disconnected' : 'Catalog Diagnostics'}
                </span>
                <span className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                  {activeFetching ? `Page ${page}` : isError ? 'Offline' : displayLatencyText}
                </span>
              </div>

              {/* Dual-Service Diagnostics Checklist */}
              <div className="space-y-1.5 pt-1 border-t border-border/60">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        !isError && catalogSource === 'supabase'
                          ? 'bg-success'
                          : 'bg-muted-foreground/40'
                      }`}
                    />
                    Bookarium DB
                  </span>
                  <span
                    className={
                      !isError && catalogSource === 'supabase'
                        ? 'text-success font-semibold'
                        : 'text-muted-foreground'
                    }
                  >
                    {isError
                      ? 'Offline'
                      : catalogSource === 'supabase'
                        ? `Online · ${displayLatencyText}`
                        : 'Standby / Unseeded'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        !isError && catalogSource === 'upstream'
                          ? 'bg-success'
                          : isError
                            ? 'bg-destructive'
                            : 'bg-muted-foreground/40'
                      }`}
                    />
                    Gutendex API
                  </span>
                  <span
                    className={
                      !isError && catalogSource === 'upstream'
                        ? 'text-success font-semibold'
                        : 'text-muted-foreground'
                    }
                  >
                    {isError
                      ? 'Offline'
                      : catalogSource === 'upstream'
                        ? `Active · ${displayLatencyText}`
                        : 'Standby'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground font-sans leading-relaxed pt-1 border-t border-border/60">
                {activeFetching ? (
                  <>
                    Scanning through <strong>70,000+ public domain titles</strong>. Large page offsets compute deep relational queries on live Gutenberg servers and may take a moment to deliver.
                  </>
                ) : isError ? (
                  <>
                    Network or service unavailable. Your cached bookshelf, saved quotes, and downloaded books remain fully accessible offline.
                  </>
                ) : catalogSource === 'upstream' ? (
                  <>
                    Serving public domain volumes via the upstream Gutendex REST mirror. Automatic failover active.
                  </>
                ) : (
                  <>
                    Connected to dedicated Supabase PostgreSQL database. Queries are accelerated with zero external rate limits.
                  </>
                )}
              </p>
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
      <aside
        className={`fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] inset-x-0 mx-auto w-fit max-w-[92vw] z-40 transition-all focus-within:opacity-100 focus-within:pointer-events-auto ${
          !effectiveMobileDockVisible
            ? 'translate-y-24 opacity-0 pointer-events-none duration-300 ease-in-out'
            : isDockDimmed
              ? 'translate-y-0 opacity-30 hover:opacity-100 duration-400 ease-out'
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
        <div className="relative group/dock-pill">
          {/* Hardware-Accelerated Ambient Light Aura (Dark & Sepia Modes) */}
          <div
            data-testid="mobile-dock-ambient-aura"
            className={`absolute -inset-1.5 rounded-full pointer-events-none -z-10 blur-md transition-all duration-500
              opacity-0 dark:opacity-60 sepia:opacity-40
              ${isDockDimmed ? 'scale-95 dark:opacity-35 sepia:opacity-25' : 'scale-100 dark:opacity-75 sepia:opacity-55'}
              group-hover/dock-pill:scale-105 group-hover/dock-pill:dark:opacity-90 group-hover/dock-pill:sepia:opacity-70
              bg-[radial-gradient(ellipse_at_center,rgba(217,119,6,0.32)_0%,rgba(245,158,11,0.16)_50%,transparent_80%)]
              motion-safe:animate-ambient-breathe`}
            aria-hidden="true"
          />

          <div className="flex items-center gap-1.5 p-1.5 bg-card/95 backdrop-blur-md border border-border/80 shadow-[0_12px_36px_-4px_rgba(0,0,0,0.22),0_4px_14px_-2px_rgba(0,0,0,0.10)] dark:shadow-[0_0_28px_rgba(217,119,6,0.18),0_12px_44px_rgba(0,0,0,0.7),0_0_0_1px_rgba(217,119,6,0.22)] sepia:shadow-[0_0_24px_rgba(180,83,9,0.16),0_10px_30px_rgba(67,40,24,0.18)] rounded-full text-foreground ring-1 ring-black/5 dark:ring-white/10">
          {/* Button 1: Catalog Floating Search Trigger */}
          {onSearchToggle && (
            <>
              <button
                type="button"
                onClick={onSearchToggle}
                data-testid="mobile-dock-search-btn"
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all cursor-pointer ${
                  isSearchOpen || searchQuery
                    ? 'text-primary bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                aria-label={isSearchOpen ? 'Close search' : 'Search catalog'}
                title={searchQuery ? `Search: "${searchQuery}"` : 'Search catalog'}
                aria-expanded={isSearchOpen}
              >
                <Search className="w-4 h-4" />
              </button>
              <div className="h-4 w-[1px] bg-border" />
            </>
          )}

          {/* Button 2: Filter Drawer Trigger with Invariant Geometry & Absolute Counter Badge */}
          <button
            type="button"
            onClick={onOpenFilters}
            data-testid="mobile-dock-filters-btn"
            className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all cursor-pointer ${
              isFiltersOpen || activeFilterCount > 0
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            aria-label={isFiltersOpen ? 'Close filters' : 'Open filters'}
            title={activeFilterCount > 0 ? `Filters (${activeFilterCount} active)` : 'Filters'}
            aria-expanded={isFiltersOpen}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {activeFilterCount > 0 && (
              <span
                data-testid="mobile-dock-filters-badge"
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] flex items-center justify-center font-mono font-bold bg-primary text-primary-foreground border border-background shadow-xs pointer-events-none"
              >
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="h-4 w-[1px] bg-border" />

          {/* Mobile View Mode Single-Button Toggle */}
          <button
            type="button"
            onClick={() => onViewModeChange(viewMode === 'grid' ? 'shelf' : 'grid')}
            data-testid="mobile-dock-view-mode-btn"
            className={`p-2 rounded-full text-xs transition-all cursor-pointer ${
              viewMode === 'shelf'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            aria-label={
              viewMode === 'grid'
                ? 'Switch to bookshelf rack layout'
                : 'Switch to cover grid layout'
            }
            title={viewMode === 'grid' ? 'Bookshelf Rack' : 'Cover Grid'}
            aria-pressed={viewMode === 'shelf'}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={viewMode}
                initial={{ opacity: 0, rotate: -15, scale: 0.85 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 15, scale: 0.85 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {viewMode === 'grid' ? (
                  <LayoutGrid className="w-4 h-4" />
                ) : (
                  <Library className="w-4 h-4" />
                )}
              </motion.div>
            </AnimatePresence>
          </button>

          {/* Mobile Sort Mode 2-State Toggle (Most Recent <-> Popular) */}
          {onSortToggle && (
            <>
              <div className="h-4 w-[1px] bg-border" />
              <button
                type="button"
                onClick={onSortToggle}
                data-testid="mobile-dock-sort-toggle-btn"
                className={`p-2 rounded-full text-xs transition-all cursor-pointer ${
                  currentSort === 'popular'
                    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                aria-label={
                  currentSort === 'popular'
                    ? 'Switch to most recent releases'
                    : 'Switch to most popular books'
                }
                title={
                  currentSort === 'popular'
                    ? 'Most Popular (Downloads)'
                    : 'Most Recent (Latest Releases)'
                }
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={currentSort === 'popular' ? 'popular' : 'recent'}
                    initial={{ opacity: 0, rotate: -15, scale: 0.85 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    exit={{ opacity: 0, rotate: 15, scale: 0.85 }}
                    transition={{ duration: 0.18, ease: 'easeOut' }}
                  >
                    {currentSort === 'popular' ? (
                      <Flame className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Clock className="w-4 h-4" />
                    )}
                  </motion.div>
                </AnimatePresence>
              </button>
            </>
          )}

          <div className="h-4 w-[1px] bg-border" />

          {/* Scroll to Top with context-aware muting when at top */}
          <button
            type="button"
            onClick={isAtTop ? undefined : () => window.scrollTo({ top: 0, behavior: 'smooth' })}
            disabled={isAtTop}
            aria-disabled={isAtTop}
            data-testid="mobile-dock-top-btn"
            className={`p-2 rounded-full transition-all ${
              isAtTop
                ? 'opacity-25 pointer-events-none text-muted-foreground'
                : 'text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer'
            }`}
            aria-label="Scroll to top"
            title={isAtTop ? 'Already at top' : 'Scroll to top'}
          >
            <ArrowUp className="w-4 h-4" />
          </button>
        </div>
        </div>
      </aside>
    </>
  );
};
