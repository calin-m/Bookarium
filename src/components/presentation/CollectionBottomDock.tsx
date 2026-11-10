'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  SlidersHorizontal,
  ArrowUp,
  ArrowUpDown,
  Layers,
  Clock,
} from 'lucide-react';

export interface CollectionBottomDockProps {
  isVisible?: boolean;
  threshold?: number;
  idleTimeoutMs?: number;

  // Search Action
  searchQuery: string;
  isSearchOpen?: boolean;
  onSearchToggle: () => void;

  // Filter Drawer Action
  activeFilterCount?: number;
  isFiltersOpen?: boolean;
  onOpenFilters: () => void;

  // Mode / Direction Action
  modeType?: 'view_mode' | 'direction';
  viewMode?: 'book' | 'chronological';
  onViewModeToggle?: () => void;
  sortDirection?: 'asc' | 'desc';
  onDirectionToggle?: () => void;
  isDirectionDisabled?: boolean;

  // Scroll to Top Action
  onScrollToTop?: () => void;

  className?: string;
}

export const CollectionBottomDock: React.FC<CollectionBottomDockProps> = ({
  isVisible,
  threshold = 200,
  idleTimeoutMs = 1600,
  searchQuery,
  isSearchOpen = false,
  onSearchToggle,
  activeFilterCount = 0,
  isFiltersOpen = false,
  onOpenFilters,
  modeType = 'direction',
  viewMode = 'book',
  onViewModeToggle,
  sortDirection = 'desc',
  onDirectionToggle,
  isDirectionDisabled = false,
  onScrollToTop,
  className = '',
}) => {
  const [internalVisible, setInternalVisible] = useState(true);
  const [currentScrollY, setCurrentScrollY] = useState(0);
  const [isIdle, setIsIdle] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      setCurrentScrollY(scrollY);
      if (isVisible === undefined) {
        setInternalVisible(true);
      }

      setIsIdle(false);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
      if (idleTimeoutMs > 0) {
        idleTimerRef.current = setTimeout(() => {
          setIsIdle(true);
        }, idleTimeoutMs);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (idleTimerRef.current) {
        clearTimeout(idleTimerRef.current);
      }
    };
  }, [isVisible, threshold, idleTimeoutMs]);

  const effectiveVisible = isVisible !== undefined ? isVisible : internalVisible;
  const isAtTop = currentScrollY < 60;
  const isDockDimmed = (isIdle || isAtTop) && !isHovered && !isSearchOpen && !isFiltersOpen;

  return (
    <aside
      className={`fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] inset-x-0 mx-auto w-fit max-w-[94vw] z-40 transition-all focus-within:opacity-100 focus-within:pointer-events-auto ${
        !effectiveVisible
          ? 'translate-y-24 opacity-0 pointer-events-none duration-300 ease-in-out'
          : isDockDimmed
          ? 'translate-y-0 opacity-30 hover:opacity-100 duration-400 ease-out'
          : 'translate-y-0 opacity-100 duration-150 ease-in'
      } ${className}`}
      data-testid="collection-bottom-dock"
      aria-label="Collection quick controls"
      onPointerEnter={() => {
        setIsHovered(true);
        setIsIdle(false);
        if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      }}
      onPointerLeave={() => {
        setIsHovered(false);
        if (idleTimeoutMs > 0) {
          if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
          idleTimerRef.current = setTimeout(() => setIsIdle(true), idleTimeoutMs);
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
          data-testid="collection-dock-ambient-aura"
          className={`absolute -inset-1.5 rounded-full pointer-events-none -z-10 blur-md transition-all duration-500
            opacity-0 dark:opacity-60 sepia:opacity-40
            ${isDockDimmed ? 'scale-95 dark:opacity-35 sepia:opacity-25' : 'scale-100 dark:opacity-75 sepia:opacity-55'}
            group-hover/dock-pill:scale-105 group-hover/dock-pill:dark:opacity-90 group-hover/dock-pill:sepia:opacity-70
            bg-[radial-gradient(ellipse_at_center,rgba(217,119,6,0.32)_0%,rgba(245,158,11,0.16)_50%,transparent_80%)]
            motion-safe:animate-ambient-breathe`}
          aria-hidden="true"
        />

        <div className="flex items-center gap-1.5 p-1.5 bg-card/95 backdrop-blur-md border border-border/80 shadow-[0_12px_36px_-4px_rgba(0,0,0,0.22),0_4px_14px_-2px_rgba(0,0,0,0.10)] dark:shadow-[0_0_28px_rgba(217,119,6,0.18),0_12px_44px_rgba(0,0,0,0.7),0_0_0_1px_rgba(217,119,6,0.22)] sepia:shadow-[0_0_24px_rgba(180,83,9,0.16),0_10px_30px_rgba(67,40,24,0.18)] rounded-full text-foreground ring-1 ring-black/5 dark:ring-white/10">
        {/* Button 1: Floating Search Trigger */}
        <button
          type="button"
          onClick={onSearchToggle}
          data-testid="collection-dock-search-btn"
          className={`p-2 rounded-full text-xs transition-all cursor-pointer ${
            isSearchOpen || searchQuery.trim().length > 0
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          aria-label={isSearchOpen ? 'Close search' : 'Open search'}
          aria-expanded={isSearchOpen}
        >
          <Search className="w-4 h-4" />
        </button>

        <div className="h-4 w-[1px] bg-border" />

        {/* Button 2: Filters & Sort Drawer Trigger with Invariant Geometry & Absolute Badge */}
        <button
          type="button"
          onClick={onOpenFilters}
          data-testid="collection-dock-filters-btn"
          className={`relative p-2 w-8 h-8 rounded-full text-xs flex items-center justify-center transition-all cursor-pointer ${
            activeFilterCount > 0
              ? 'bg-primary text-primary-foreground shadow-xs hover:bg-primary/90'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
          aria-label={isFiltersOpen ? 'Close filters' : 'Open filters'}
          aria-expanded={isFiltersOpen}
        >
          <SlidersHorizontal className="w-4 h-4 shrink-0" />
          {activeFilterCount > 0 && (
            <span
              data-testid="collection-dock-filters-badge"
              className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] flex items-center justify-center font-mono font-bold bg-amber-500 text-white shadow-xs pointer-events-none"
            >
              {activeFilterCount}
            </span>
          )}
        </button>

        <div className="h-4 w-[1px] bg-border" />

        {/* Button 3: Quick Mode / Direction Toggle */}
        {modeType === 'view_mode' && onViewModeToggle ? (
          <button
            type="button"
            onClick={onViewModeToggle}
            data-testid="collection-dock-view-mode-btn"
            className={`p-2 rounded-full text-xs transition-all cursor-pointer ${
              viewMode === 'chronological'
                ? 'text-primary bg-primary/10'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
            }`}
            aria-label={`Switch to ${viewMode === 'book' ? 'chronological' : 'by book'} view`}
            title={viewMode === 'book' ? 'Grouped by Book' : 'Chronological Stream'}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={viewMode}
                initial={{ opacity: 0, rotate: -15, scale: 0.85 }}
                animate={{ opacity: 1, rotate: 0, scale: 1 }}
                exit={{ opacity: 0, rotate: 15, scale: 0.85 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              >
                {viewMode === 'book' ? <Layers className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
              </motion.div>
            </AnimatePresence>
          </button>
        ) : onDirectionToggle ? (
          <button
            type="button"
            disabled={isDirectionDisabled}
            onClick={onDirectionToggle}
            data-testid="collection-dock-direction-btn"
            className={`group/dockdir p-2 rounded-full text-xs transition-all cursor-pointer ${
              isDirectionDisabled
                ? 'opacity-30 cursor-not-allowed text-muted-foreground'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95'
            }`}
            aria-label={sortDirection === 'asc' ? 'Sort descending' : 'Sort ascending'}
            title={sortDirection === 'asc' ? 'Ascending (A → Z)' : 'Descending (Z → A)'}
          >
            <ArrowUpDown
              className={`w-4 h-4 pointer-events-none transition-transform duration-300 ease-in-out ${
                isDirectionDisabled
                  ? 'text-muted-foreground'
                  : sortDirection === 'asc'
                  ? 'rotate-180 group-hover/dockdir:rotate-[360deg]'
                  : 'rotate-0 group-hover/dockdir:rotate-180'
              }`}
            />
          </button>
        ) : null}

        <div className="h-4 w-[1px] bg-border" />

        {/* Button 4: Scroll to Top with context-aware muting when at top */}
        <button
          type="button"
          onClick={isAtTop ? undefined : (onScrollToTop || (() => window.scrollTo({ top: 0, behavior: 'smooth' })))}
          disabled={isAtTop}
          aria-disabled={isAtTop}
          data-testid="collection-dock-top-btn"
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
  );
};
