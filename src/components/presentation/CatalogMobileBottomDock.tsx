'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  SlidersHorizontal,
  LayoutGrid,
  Library,
  Flame,
  Clock,
  ArrowUp,
} from 'lucide-react';
import { useAmbientDockScrollState } from '@/hooks/useAmbientDockScrollState';
import { AmbientCapsuleDock } from '@/components/ui/AmbientCapsuleDock';

export interface CatalogMobileBottomDockProps {
  isMobileDockVisible?: boolean;
  mobileDockThreshold?: number;
  mobileDockIdleTimeoutMs?: number;
  isSearchOpen?: boolean;
  onSearchToggle?: () => void;
  searchQuery?: string;
  isFiltersOpen?: boolean;
  onOpenFilters: () => void;
  activeFilterCount: number;
  viewMode: 'grid' | 'shelf';
  onViewModeChange: (mode: 'grid' | 'shelf') => void;
  currentSort?: 'popular' | 'descending' | 'ascending' | '';
  onSortToggle?: () => void;
}

/**
 * Mobile floating bottom capsule dock for the main Catalog view, powered by
 * `useAmbientDockScrollState` and `AmbientCapsuleDock`.
 */
export const CatalogMobileBottomDock: React.FC<
  CatalogMobileBottomDockProps
> = ({
  isMobileDockVisible,
  mobileDockThreshold = 200,
  mobileDockIdleTimeoutMs = 1600,
  isSearchOpen = false,
  onSearchToggle,
  searchQuery = '',
  isFiltersOpen = false,
  onOpenFilters,
  activeFilterCount,
  viewMode,
  onViewModeChange,
  currentSort = 'descending',
  onSortToggle,
}) => {
  const {
    effectiveVisible,
    isAtTop,
    isDockDimmed,
    handlePointerEnter,
    handlePointerLeave,
    handlePointerDown,
  } = useAmbientDockScrollState({
    isVisible: isMobileDockVisible,
    threshold: mobileDockThreshold,
    idleTimeoutMs: mobileDockIdleTimeoutMs,
    isPinnedAwake: isFiltersOpen || isSearchOpen,
  });

  return (
    <AmbientCapsuleDock
      effectiveVisible={effectiveVisible}
      isDockDimmed={isDockDimmed}
      asideTestId="mobile-catalog-dock"
      auraTestId="mobile-dock-ambient-aura"
      ariaLabel="Mobile catalog controls"
      maxWidthClass="max-w-[92vw]"
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
    >
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
            title={
              searchQuery ? `Search: "${searchQuery}"` : 'Search catalog'
            }
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
        title={
          activeFilterCount > 0
            ? `Filters (${activeFilterCount} active)`
            : 'Filters'
        }
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
        onClick={() =>
          onViewModeChange(viewMode === 'grid' ? 'shelf' : 'grid')
        }
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
        onClick={
          isAtTop
            ? undefined
            : () => window.scrollTo({ top: 0, behavior: 'smooth' })
        }
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
    </AmbientCapsuleDock>
  );
};
