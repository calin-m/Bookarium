'use client';

import React, { useState } from 'react';
import type { GutendexBook } from '@/mocks/handlers';
import { BookCard } from './BookCard';
import { BookshelfRack } from './BookshelfRack';
import { Button } from '@/components/ui/Button';
import { LayoutGrid, Library, RotateCcw, AlertTriangle, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';

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
  emptyTitle?: string;
  emptyDescription?: string;
  viewMode?: BookViewMode;
  onViewModeChange?: (mode: BookViewMode) => void;
  initialViewMode?: BookViewMode;
  showViewToggle?: boolean;
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
  emptyTitle = 'No public domain books found',
  emptyDescription = 'Try adjusting your search terms, topic filters, or language selection.',
  viewMode: controlledViewMode,
  onViewModeChange,
  initialViewMode = 'grid',
  showViewToggle = true,
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 flex flex-col gap-4 animate-pulse"
              data-testid="book-skeleton"
            >
              <div className="aspect-[3/4] w-full bg-stone-200 dark:bg-stone-800 rounded-lg" />
              <div className="space-y-2">
                <div className="h-4 bg-stone-200 dark:bg-stone-800 rounded w-3/4" />
                <div className="h-3 bg-stone-200 dark:bg-stone-800 rounded w-1/2" />
              </div>
              <div className="grid grid-cols-2 gap-2 mt-auto">
                <div className="h-8 bg-stone-200 dark:bg-stone-800 rounded-lg" />
                <div className="h-8 bg-stone-200 dark:bg-stone-800 rounded-lg" />
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
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100 font-serif">
          Failed to fetch books
        </h3>
        <p className="text-xs text-stone-500 font-sans">
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

  if (books.length === 0) {
    return (
      <div className="py-20 text-center space-y-3 max-w-md mx-auto">
        <div className="w-12 h-12 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-400 flex items-center justify-center mx-auto">
          <BookOpen className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-stone-800 dark:text-stone-200 font-serif">
          {emptyTitle}
        </h3>
        <p className="text-xs text-stone-500 font-sans leading-relaxed">{emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="book-grid-container">
      {/* Optional In-Section View Mode Switcher Header */}
      {showViewToggle && (
        <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-stone-800/80 pb-4">
          <div className="text-xs font-mono uppercase tracking-widest text-stone-500">
            {books.length} Volumes Available
          </div>

          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800 p-1 rounded-lg border border-stone-200 dark:border-stone-700">
            <button
              type="button"
              onClick={() => handleViewToggle('grid')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-all ${
                activeViewMode === 'grid'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs font-bold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
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
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-xs font-bold'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
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

      {/* Main Content: Grid vs. Shelf */}
      {activeViewMode === 'shelf' ? (
        <BookshelfRack books={books} onDownloadClick={onDownloadClick} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {books.map((book) => (
            <BookCard key={book.id} book={book} onDownloadClick={onDownloadClick} />
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {onPageChange && (
        <div className="flex items-center justify-center gap-3 pt-6 border-t border-stone-200/80 dark:border-stone-800/80">
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

          <span className="text-xs font-mono px-3 text-stone-600 dark:text-stone-400">
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
