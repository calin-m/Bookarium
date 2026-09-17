'use client';

import React from 'react';
import { Search, X } from 'lucide-react';
import { CollectionSortDropdown, type SortOption } from './CollectionSortDropdown';
import { CollectionTopPagination } from './CollectionTopPagination';

export type { SortOption };

export interface CollectionToolbarProps {
  // Search Configuration
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  clearAriaLabel?: string;
  searchTestId?: string;
  totalCount?: number;
  filteredCount?: number;

  // Sort Configuration
  sortValue?: string;
  onSortChange?: (newSort: string) => void;
  sortOptions?: SortOption[];
  sortAriaLabel?: string;

  // Top Pagination Configuration
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (newPage: number) => void;
  paginationAriaLabel?: string;

  // Counters & Extra Controls
  itemCountLabel?: string;
  extraControls?: React.ReactNode;

  className?: string;
}

export const CollectionToolbar: React.FC<CollectionToolbarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search by title, author, or keywords...',
  searchAriaLabel = 'Search collection',
  clearAriaLabel,
  searchTestId,
  totalCount,
  filteredCount,
  sortValue,
  onSortChange,
  sortOptions,
  sortAriaLabel = 'Sort items',
  currentPage,
  totalPages,
  onPageChange,
  paginationAriaLabel,
  itemCountLabel,
  extraControls,
  className = '',
}) => {
  const isFiltering = Boolean(searchQuery.trim());
  const hasCountBadge = filteredCount !== undefined && totalCount !== undefined;
  const effectiveClearAriaLabel = clearAriaLabel || 'Clear search';
  const hasSort = Boolean(sortValue !== undefined && onSortChange && sortOptions && sortOptions.length > 0);
  const hasPagination = Boolean(
    currentPage !== undefined &&
    totalPages !== undefined &&
    totalPages > 1 &&
    onPageChange
  );

  return (
    <div
      data-testid="collection-toolbar"
      className={`flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-card border border-border rounded-xl shadow-booksaw ${className}`}
    >
      {/* Search Input (Row 1 on Mobile, Left-side on Desktop) */}
      <div className="relative flex-1 min-w-0 md:min-w-[220px]">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center text-muted-foreground">
          <Search className="w-4 h-4" aria-hidden="true" />
        </div>

        <input
          type="text"
          data-testid={searchTestId || 'collection-search-input'}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onSearchChange('');
            }
          }}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel}
          className={`w-full h-9 pl-9 ${
            isFiltering && hasCountBadge ? 'pr-20 sm:pr-24' : 'pr-8'
          } text-xs font-sans rounded-lg border border-border bg-background hover:border-primary/40 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground/70 placeholder:truncate transition-all shadow-2xs`}
        />

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
          {isFiltering && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label={effectiveClearAriaLabel}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Clear search (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {isFiltering && hasCountBadge && (
            <span
              className="text-[10px] sm:text-[11px] font-mono font-medium px-1.5 py-0.5 rounded-md bg-muted text-muted-foreground border border-border select-none animate-in fade-in duration-150"
              aria-live="polite"
            >
              {filteredCount} / {totalCount}
            </span>
          )}
        </div>
      </div>

      {/* Utility Controls Row (Row 2 on Mobile, Right-side on Desktop) */}
      <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-2.5 min-w-0">
        {/* Sort Dropdown */}
        {hasSort && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="hidden sm:inline text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
              Sort:
            </span>
            <CollectionSortDropdown
              value={sortValue!}
              onChange={onSortChange!}
              options={sortOptions!}
              ariaLabel={sortAriaLabel}
            />
          </div>
        )}

        {/* Extra Controls (e.g. Notebook's View Mode Toggle) */}
        {extraControls}

        {/* Right cluster: Top Pagination & Item Count */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {hasPagination && (
            <CollectionTopPagination
              currentPage={currentPage!}
              totalPages={totalPages!}
              onPageChange={onPageChange!}
              ariaLabel={paginationAriaLabel}
            />
          )}

          {itemCountLabel && (
            <span
              className={`text-[11px] font-mono text-muted-foreground whitespace-nowrap select-none ${
                hasPagination ? 'hidden sm:inline' : 'hidden min-[380px]:inline'
              }`}
              data-testid="collection-item-count"
            >
              {itemCountLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
