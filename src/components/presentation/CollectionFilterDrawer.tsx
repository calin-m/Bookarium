'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, SlidersHorizontal, RotateCcw, Check, ArrowUp, ArrowDown, Layers, Clock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import type { SortOption } from './CollectionSortDropdown';

export interface ShelfOption {
  id: string;
  label: string;
  count?: number;
}

export interface CollectionFilterDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  activeFilterCount?: number;
  onResetAll?: () => void;
  onApply?: () => void;

  // Shelf / Category / Status Section
  shelfOptions?: ShelfOption[];
  selectedShelfId?: string;
  onSelectShelf?: (id: string) => void;
  shelfSectionTitle?: string;

  // View Mode Section (e.g. Notebook)
  viewMode?: 'book' | 'chronological';
  onViewModeChange?: (mode: 'book' | 'chronological') => void;

  // Sort Fields Section
  sortOptions?: SortOption[];
  selectedSort?: string;
  onSortChange?: (sort: string) => void;
  sortSectionTitle?: string;

  // Sort Direction Section
  sortDirection?: 'asc' | 'desc';
  onDirectionToggle?: () => void;
  onDirectionChange?: (dir: 'asc' | 'desc') => void;
  isDirectionDisabled?: boolean;
}

export const CollectionFilterDrawer: React.FC<CollectionFilterDrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  activeFilterCount = 0,
  onResetAll,
  onApply,
  shelfOptions,
  selectedShelfId,
  onSelectShelf,
  shelfSectionTitle = 'Shelves & Categories',
  viewMode,
  onViewModeChange,
  sortOptions,
  selectedSort,
  onSortChange,
  sortSectionTitle = 'Sort Order',
  sortDirection,
  onDirectionToggle,
  onDirectionChange,
  isDirectionDisabled = false,
}) => {
  // Dismiss on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleApplyClick = () => {
    onApply?.();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end pointer-events-none overflow-hidden [contain:strict]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="collection-filter-drawer-title"
          data-testid="collection-filter-drawer"
        >
          {/* Click-outside backdrop with 0-raster GPU crossfade & background scroll intercept */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ willChange: 'opacity' }}
            className="fixed inset-0 bg-black/60 pointer-events-auto touch-none"
            onClick={onClose}
            onTouchMove={(e) => e.preventDefault()}
            onWheel={(e) => e.preventDefault()}
            data-testid="collection-filter-drawer-backdrop"
            aria-hidden="true"
          />

          {/* Bottom Sheet Container */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            style={{ willChange: 'transform', backfaceVisibility: 'hidden' }}
            className="relative w-full max-w-4xl mx-auto max-h-[88dvh] rounded-t-2xl bg-background text-foreground flex flex-col justify-between shadow-2xl border-t border-border overflow-hidden pointer-events-auto z-10 [transform:translateZ(0)]"
          >
            {/* Mobile Grab Handle Bar */}
            <div className="w-12 h-1 rounded-full bg-muted-foreground/30 mx-auto mt-2.5 mb-1 shrink-0" aria-hidden="true" />

            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-background shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-border">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <h3 id="collection-filter-drawer-title" className="font-serif font-bold text-base sm:text-lg leading-tight text-foreground">
                    {title}
                  </h3>
                  <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                    {subtitle || (activeFilterCount > 0 ? `${activeFilterCount} active filters` : 'Customize collection view')}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                aria-label="Close filters"
                data-testid="collection-filter-drawer-close-btn"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Filter Sections */}
            <div className="flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable] p-4 sm:p-6 space-y-6">
              {/* Section: View Mode (When applicable, e.g. Notebook) */}
              {viewMode && onViewModeChange && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
                    Presentation Layout
                  </h4>
                  <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Presentation Layout">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={viewMode === 'book'}
                      onClick={() => onViewModeChange('book')}
                      className={`px-3 py-2 rounded-lg text-xs font-sans font-medium flex items-center gap-2 border transition-colors cursor-pointer ${
                        viewMode === 'book'
                          ? 'bg-foreground text-background border-foreground shadow-xs'
                          : 'bg-card border-border text-foreground hover:border-primary'
                      }`}
                      data-testid="filter-viewmode-book-btn"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Grouped by Book</span>
                      {viewMode === 'book' && <Check className="w-3.5 h-3.5 ml-0.5" />}
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={viewMode === 'chronological'}
                      onClick={() => onViewModeChange('chronological')}
                      className={`px-3 py-2 rounded-lg text-xs font-sans font-medium flex items-center gap-2 border transition-colors cursor-pointer ${
                        viewMode === 'chronological'
                          ? 'bg-foreground text-background border-foreground shadow-xs'
                          : 'bg-card border-border text-foreground hover:border-primary'
                      }`}
                      data-testid="filter-viewmode-chrono-btn"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>Chronological Stream</span>
                      {viewMode === 'chronological' && <Check className="w-3.5 h-3.5 ml-0.5" />}
                    </button>
                  </div>
                </div>
              )}

              {/* Section: Shelves / Categories / Statuses */}
              {shelfOptions && shelfOptions.length > 0 && onSelectShelf && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
                    {shelfSectionTitle}
                  </h4>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={shelfSectionTitle}>
                    {shelfOptions.map((opt) => {
                      const isSelected = selectedShelfId === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => onSelectShelf(opt.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium flex items-center gap-1.5 border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-foreground text-background border-foreground shadow-xs'
                              : 'bg-card border-border text-foreground hover:border-primary'
                          }`}
                          data-testid={`filter-shelf-${opt.id}`}
                        >
                          <span>{opt.label}</span>
                          {opt.count !== undefined && (
                            <span className={`text-[10px] font-mono font-bold ${isSelected ? 'text-background/80' : 'text-muted-foreground'}`}>
                              ({opt.count})
                            </span>
                          )}
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section: Sort Criteria */}
              {sortOptions && sortOptions.length > 0 && onSortChange && (
                <div className="space-y-2.5">
                  <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
                    {sortSectionTitle}
                  </h4>
                  <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={sortSectionTitle}>
                    {sortOptions.map((sort) => {
                      const isSelected = selectedSort === sort.value;
                      return (
                        <button
                          key={sort.value}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          onClick={() => onSortChange(sort.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-sans font-medium flex items-center gap-1.5 border transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-foreground text-background border-foreground shadow-xs'
                              : 'bg-card border-border text-foreground hover:border-primary'
                          }`}
                          data-testid={`filter-sort-${sort.value}`}
                        >
                          <span>{sort.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Section: Sort Direction */}
              <AnimatePresence initial={false}>
                {sortDirection && (onDirectionToggle || onDirectionChange) && !isDirectionDisabled && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, scale: 0.96 }}
                    animate={{ opacity: 1, height: 'auto', scale: 1 }}
                    exit={{ opacity: 0, height: 0, scale: 0.96 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-2.5 overflow-hidden"
                  >
                    <h4 className="text-xs font-mono font-bold uppercase tracking-widest text-foreground">
                      Sort Direction
                    </h4>
                    <div className="flex gap-2" role="radiogroup" aria-label="Sort Direction">
                      <button
                        type="button"
                        role="radio"
                        aria-checked={sortDirection === 'asc'}
                        onClick={() => {
                          if (sortDirection !== 'asc') {
                            if (onDirectionChange) onDirectionChange('asc');
                            else onDirectionToggle?.();
                          }
                        }}
                        className={`px-3.5 py-2 rounded-lg text-xs font-sans font-medium flex items-center gap-2 border transition-all cursor-pointer active:scale-95 ${
                          sortDirection === 'asc'
                            ? 'bg-foreground text-background border-foreground shadow-xs'
                            : 'bg-card border-border text-foreground hover:border-primary'
                        }`}
                        data-testid="filter-direction-asc-btn"
                      >
                        <motion.span
                          animate={{ scale: sortDirection === 'asc' ? 1.15 : 1, y: sortDirection === 'asc' ? -1 : 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                          className="inline-flex"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </motion.span>
                        <span>Ascending</span>
                        {sortDirection === 'asc' && (
                          <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            className="inline-flex ml-0.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </motion.span>
                        )}
                      </button>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={sortDirection === 'desc'}
                        onClick={() => {
                          if (sortDirection !== 'desc') {
                            if (onDirectionChange) onDirectionChange('desc');
                            else onDirectionToggle?.();
                          }
                        }}
                        className={`px-3.5 py-2 rounded-lg text-xs font-sans font-medium flex items-center gap-2 border transition-all cursor-pointer active:scale-95 ${
                          sortDirection === 'desc'
                            ? 'bg-foreground text-background border-foreground shadow-xs'
                            : 'bg-card border-border text-foreground hover:border-primary'
                        }`}
                        data-testid="filter-direction-desc-btn"
                      >
                        <motion.span
                          animate={{ scale: sortDirection === 'desc' ? 1.15 : 1, y: sortDirection === 'desc' ? 1 : 0 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                          className="inline-flex"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </motion.span>
                        <span>Descending</span>
                        {sortDirection === 'desc' && (
                          <motion.span
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                            className="inline-flex ml-0.5"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </motion.span>
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:p-5 border-t border-border bg-card flex items-center justify-between gap-3 shrink-0">
              {onResetAll ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onResetAll}
                  data-testid="collection-filter-reset-btn"
                  className="text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground gap-1.5"
                  aria-label="Reset all filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset All</span>
                </Button>
              ) : <div />}

              <Button
                variant="primary"
                size="sm"
                onClick={handleApplyClick}
                data-testid="collection-filter-apply-btn"
                className="px-6 py-2.5 text-xs font-mono uppercase tracking-wider font-bold rounded-lg bg-primary hover:opacity-90 text-primary-foreground shadow-xs cursor-pointer"
                aria-label="Apply filters"
              >
                Show Results {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
