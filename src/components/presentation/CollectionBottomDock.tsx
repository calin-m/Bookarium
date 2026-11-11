'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  SlidersHorizontal,
  ArrowUp,
  ArrowUpDown,
  Layers,
  Clock,
} from 'lucide-react';
import { useAmbientDockScrollState } from '@/hooks/useAmbientDockScrollState';
import { AmbientCapsuleDock } from '@/components/ui/AmbientCapsuleDock';

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
  const {
    effectiveVisible,
    isAtTop,
    isDockDimmed,
    handlePointerEnter,
    handlePointerLeave,
    handlePointerDown,
  } = useAmbientDockScrollState({
    isVisible,
    threshold,
    idleTimeoutMs,
    isPinnedAwake: isSearchOpen || isFiltersOpen,
  });

  return (
    <AmbientCapsuleDock
      effectiveVisible={effectiveVisible}
      isDockDimmed={isDockDimmed}
      asideTestId="collection-bottom-dock"
      auraTestId="collection-dock-ambient-aura"
      ariaLabel="Collection quick controls"
      maxWidthClass="max-w-[94vw]"
      className={className}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
    >
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
    </AmbientCapsuleDock>
  );
};
