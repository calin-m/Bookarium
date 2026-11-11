'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SlidersHorizontal, ArrowUp, ArrowDown, Layers, Clock } from 'lucide-react';
import { BottomSheetDrawerShell } from '@/components/ui/BottomSheetDrawerShell';
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
  const handleApplyClick = () => {
    onApply?.();
    onClose();
  };

  return (
    <BottomSheetDrawerShell
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      titleId="collection-filter-drawer-title"
      subtitle={subtitle || (activeFilterCount > 0 ? `${activeFilterCount} active filters` : 'Customize collection view')}
      icon={<SlidersHorizontal className="w-4 h-4" />}
      dialogTestId="collection-filter-drawer"
      backdropTestId="collection-filter-drawer-backdrop"
      closeBtnTestId="collection-filter-drawer-close-btn"
      resetBtnTestId="collection-filter-reset-btn"
      applyBtnTestId="collection-filter-apply-btn"
      activeFilterCount={activeFilterCount}
      onResetAll={onResetAll}
      onApply={handleApplyClick}
    >
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
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </BottomSheetDrawerShell>
  );
};
