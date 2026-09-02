'use client';

import React, { useState } from 'react';
import type { GutendexBook } from '@/types/book.types';
import { BookCard } from './BookCard';
import { BookshelfRack } from './BookshelfRack';
import { Button } from '@/components/ui/Button';
import { LayoutGrid, Library, RotateCcw, AlertTriangle, BookOpen, ChevronLeft, ChevronRight, Loader2, Info } from 'lucide-react';

export type BookViewMode = 'grid' | 'shelf';

export interface BookGridProps {
  books?: GutendexBook[];
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  page?: number;
  onPageChange?: (page: number) => void;
  hasNextPage?: boolean;
  onDownloadClick?: (book: GutendexBook) => void;
  onPreviewClick?: (book: GutendexBook, rect?: { top: number; left: number; width: number; height: number }) => void;
  activePreviewBookId?: number | null;
  emptyTitle?: string;
  emptyDescription?: string;
  viewMode?: BookViewMode;
  onViewModeChange?: (mode: BookViewMode) => void;
  initialViewMode?: BookViewMode;
  showViewToggle?: boolean;
  onBrowseCatalog?: () => void;
  searchQuery?: string;
  onClearSearch?: () => void;
}

export const BookGrid: React.FC<BookGridProps> = ({
  books = [],
  isLoading = false,
  isError = false,
  onRetry,
  page = 1,
  onPageChange,
  hasNextPage = true,
  onDownloadClick,
  onPreviewClick,
  activePreviewBookId = null,
  emptyTitle = 'No public domain books found',
  emptyDescription = 'Try adjusting your search terms, topic filters, or language selection.',
  viewMode: controlledViewMode,
  onViewModeChange,
  initialViewMode = 'grid',
  showViewToggle = true,
  onBrowseCatalog,
  searchQuery,
  onClearSearch,
}) => {
  const [internalViewMode, setInternalViewMode] = useState<BookViewMode>(initialViewMode);
  const activeViewMode = controlledViewMode ?? internalViewMode;

  const handleViewToggle = (mode: BookViewMode) => {
    if (onViewModeChange) {
      onViewModeChange(mode);
    } else {
      setInternalViewMode(mode);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 py-8">
        <div
          className="flex items-center justify-center gap-2.5 p-3.5 bg-muted/70 border border-border rounded-xl text-xs font-mono text-muted-foreground text-center shadow-xs"
          title="Live public domain database query in progress"
        >
          <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
          <span>
            Fetching Page <span className="text-foreground font-bold">{page}</span> from the public domain archive... Deep page queries calculate relational offsets across 70,000+ volumes and may take a moment.
          </span>
          <span className="inline-flex items-center text-primary ml-1" title="Live Gutenberg relational query in progress">
            <Info className="w-3.5 h-3.5 animate-bounce text-primary/90 shrink-0" />
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4 animate-pulse"
              data-testid="book-skeleton"
            >
              <div className="aspect-[3/4] w-full bg-muted rounded-lg" />
              <div className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-auto">
                <div className="h-8 bg-muted rounded-lg" />
                <div className="h-8 bg-muted rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="py-16 text-center space-y-4 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-foreground font-serif">
          Failed to fetch books
        </h3>
        <p className="text-xs text-muted-foreground font-sans">
          There was an issue connecting to the public domain archive. Please check your internet
          connection and retry.
        </p>
        {onRetry && (
          <Button variant="primary" size="sm" onClick={onRetry} className="gap-2 mx-auto">
            <RotateCcw className="w-3.5 h-3.5" />
            Retry Query
          </Button>
        )}
      </div>
    );
  }

  if (activeViewMode !== 'shelf' && books.length === 0) {
    return (
      <div className="py-20 text-center space-y-3 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-muted text-muted-foreground flex items-center justify-center mx-auto">
          <BookOpen className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-foreground font-serif">
          {emptyTitle}
        </h3>
        <p className="text-xs text-muted-foreground font-sans leading-relaxed">{emptyDescription}</p>
        {onClearSearch && (
          <div className="pt-2">
            <Button variant="outline" size="sm" onClick={onClearSearch} className="font-mono text-xs uppercase">
              Clear Search
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="book-grid-container">
      {/* Optional In-Section View Mode Switcher Header */}
      {showViewToggle && (
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            {books.length} Volumes Available
          </div>

          <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => handleViewToggle('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-all ${
                activeViewMode === 'grid'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label="Grid cover view"
              aria-pressed={activeViewMode === 'grid'}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Cover Grid</span>
            </button>
            <button
              type="button"
              onClick={() => handleViewToggle('shelf')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-all ${
                activeViewMode === 'shelf'
                  ? 'bg-card text-foreground shadow-xs font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label="Bookshelf spine view"
              aria-pressed={activeViewMode === 'shelf'}
            >
              <Library className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bookshelf Rack</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content: Grid vs. Shelf with smooth page fade */}
      <div key={`catalog-page-${page}`} className="animate-page-turn">
        {activeViewMode === 'shelf' ? (
          <BookshelfRack
            books={books}
            onDownloadClick={onDownloadClick}
            onBrowseCatalog={onBrowseCatalog}
            searchQuery={searchQuery}
            onClearSearch={onClearSearch}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                onDownloadClick={onDownloadClick}
                onPreviewClick={onPreviewClick}
                isPreviewActive={activePreviewBookId === book.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination Bar */}
      {onPageChange && (
        <div className="flex items-center justify-center gap-3 pt-6 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className="gap-1.5 text-xs font-medium"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          <span className="text-xs font-mono px-3 text-muted-foreground">
            Page {page}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={!hasNextPage}
            onClick={() => onPageChange(page + 1)}
            className="gap-1.5 text-xs font-medium"
            aria-label="Next page"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}
    </div>
  );
};
