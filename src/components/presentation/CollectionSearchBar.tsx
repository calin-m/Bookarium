'use client';

import React from 'react';
import { Search, X } from 'lucide-react';

export interface CollectionSearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  placeholder?: string;
  totalCount: number;
  filteredCount: number;
  collectionName?: 'bookshelf' | 'favorites';
  className?: string;
}

export const CollectionSearchBar: React.FC<CollectionSearchBarProps> = ({
  query,
  onQueryChange,
  placeholder = 'Search by title, author, or subject...',
  totalCount,
  filteredCount,
  collectionName = 'bookshelf',
  className = '',
}) => {
  const isFiltering = Boolean(query.trim());

  return (
    <div
      className={`w-full max-w-xl mx-auto mb-8 space-y-2 ${className}`}
      data-testid="collection-search-container"
    >
      <div className="relative flex items-center">
        <div className="absolute left-3.5 pointer-events-none flex items-center justify-center text-muted-foreground">
          <Search className="w-4 h-4" aria-hidden="true" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              onQueryChange('');
            }
          }}
          placeholder={placeholder}
          aria-label={`Search ${collectionName}`}
          className="w-full h-11 pl-10 pr-24 sm:pr-28 text-sm font-sans rounded-xl bg-card border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 text-foreground placeholder:text-muted-foreground/70 transition-all outline-none shadow-xs"
        />

        <div className="absolute right-3 flex items-center gap-1.5">
          {isFiltering && (
            <button
              type="button"
              onClick={() => onQueryChange('')}
              aria-label={`Clear ${collectionName} search`}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Clear search (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {isFiltering && (
            <span
              className="text-[10px] sm:text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border select-none animate-in fade-in duration-150"
              aria-live="polite"
            >
              {filteredCount} / {totalCount}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
