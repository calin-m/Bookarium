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

  // Filter Dropdown Configuration (e.g. Status filter in Bookmarks)
  filterValue?: string;
  onFilterChange?: (newFilter: string) => void;
  filterOptions?: SortOption[];
  filterAriaLabel?: string;
  filterIcon?: React.ReactNode;

  // Sort Configuration
  sortValue?: string;
  onSortChange?: (newSort: string) => void;
  sortOptions?: SortOption[];
  sortAriaLabel?: string;
  sortDirection?: 'asc' | 'desc';
  onDirectionToggle?: () => void;
  isDirectionDisabled?: boolean;
  directionAriaLabel?: string;

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
  filterValue,
  onFilterChange,
  filterOptions,
  filterAriaLabel = 'Filter items',
  filterIcon,
  sortValue,
  onSortChange,
  sortOptions,
  sortAriaLabel = 'Sort items',
  sortDirection,
  onDirectionToggle,
  isDirectionDisabled,
  directionAriaLabel,
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
  const hasFilter = Boolean(filterValue !== undefined && onFilterChange && filterOptions && filterOptions.length > 0);
  const hasSort = Boolean(sortValue !== undefined && onSortChange && sortOptions && sortOptions.length > 0);
  const hasPagination = Boolean(
    currentPage !== undefined &&
    totalPages !== undefined &&
    totalPages > 1 &&
    onPageChange
  );
  const utilityCount =
    (hasFilter ? 1 : 0) + (hasSort ? 1 : 0) + (extraControls ? 1 : 0) + (hasPagination ? 1 : 0);
  const isSingleControl = utilityCount <= 1;

  return (
    <div
      data-testid="collection-toolbar"
      className={`flex flex-col ${
        isSingleControl ? 'sm:flex-row sm:items-center' : 'md:flex-row md:items-center'
      } items-stretch justify-between gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-card border border-border rounded-xl shadow-booksaw ${className}`}
    >
      {/* Search Input (Row 1 on Mobile, Left-side on Desktop) */}
      <div className={`relative flex-1 min-w-0 ${isSingleControl ? 'sm:min-w-[260px]' : ''} md:min-w-[280px]`}>
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

      {/* Utility Controls Row (Row 2 on Mobile/Tablet, Right-side on Desktop) */}
      <div
        className={`flex items-center ${
          isSingleControl
            ? 'justify-start sm:justify-end w-full sm:w-auto sm:shrink-0'
            : 'justify-between md:justify-end w-full md:w-auto md:shrink-0'
        } gap-2 sm:gap-2.5 min-w-0`}
      >
        {/* Status / Category Filter Dropdown */}
        {hasFilter && (
          <div className="flex items-center justify-start gap-1.5 flex-1 sm:flex-none min-w-0">
            <CollectionSortDropdown
              value={filterValue!}
              onChange={onFilterChange!}
              options={filterOptions!}
              ariaLabel={filterAriaLabel}
              icon={filterIcon}
              hideLeadingIcon={!filterIcon}
              dataTestId="collection-filter-dropdown"
              selectTestId="collection-filter-select"
            />
          </div>
        )}

        {/* Sort Dropdown */}
        {hasSort && (
          <div
            className={`flex items-center ${
              hasFilter ? 'justify-end' : 'justify-start'
            } gap-1.5 ${isSingleControl ? 'w-auto shrink-0' : 'flex-1 sm:flex-none'} min-w-0`}
          >
            <CollectionSortDropdown
              value={sortValue!}
              onChange={onSortChange!}
              options={sortOptions!}
              ariaLabel={sortAriaLabel}
              sortDirection={sortDirection}
              onDirectionToggle={onDirectionToggle}
              isDirectionDisabled={isDirectionDisabled}
              directionAriaLabel={directionAriaLabel}
              className={isSingleControl ? 'min-w-[125px] max-w-[170px] sm:max-w-[195px]' : undefined}
            />
          </div>
        )}

        {/* Extra Controls (e.g. Notebook's View Mode Toggle) */}
        {extraControls && (
          <div className="flex items-center justify-end shrink-0 ml-auto md:ml-0">
            {extraControls}
          </div>
        )}

        {/* Right cluster: Top Pagination & Item Count */}
        {(hasPagination || itemCountLabel) && (
          <div className="flex items-center gap-2 sm:gap-2.5 shrink-0 ml-auto md:ml-0">
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
        )}
      </div>
    </div>
  );
};
