'use client';

import React, { useState } from 'react';
import { BookOpen, AlertCircle, ChevronLeft, ChevronRight, RefreshCw, LayoutGrid, Library } from 'lucide-react';
import type { GutendexBook } from '@/mocks/handlers';
import { BookCard } from './BookCard';
import { BookshelfRack } from './BookshelfRack';
import { StaggerGroup } from '@/components/motion/StaggerGroup';
import { Button } from '@/components/ui/Button';

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
  initialViewMode = 'grid',
  showViewToggle = true,
}) => {
  const [viewMode, setViewMode] = useState<BookViewMode>(initialViewMode);

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
      <div className="py-16 text-center max-w-md mx-auto flex flex-col items-center">
        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center mb-4">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100 mb-2">
          Failed to load public domain catalog
        </h3>
        <p className="text-sm text-stone-600 dark:text-stone-400 mb-6">
          Unable to reach the Gutendex public domain book mirror. Check your network connection.
        </p>
        {onRetry && (
          <Button variant="primary" onClick={onRetry} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </Button>
        )}
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="py-16 text-center max-w-md mx-auto flex flex-col items-center">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center mb-4">
          <BookOpen className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-serif font-bold text-stone-900 dark:text-stone-100 mb-2">
          {emptyTitle}
        </h3>
        <p className="text-sm text-stone-600 dark:text-stone-400 leading-relaxed">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 py-4">
      {/* Top Header with Layout Switcher */}
      {showViewToggle && (
        <div className="flex items-center justify-between border-b border-stone-200/80 dark:border-stone-800/80 pb-3">
          <div className="text-xs font-mono text-stone-500 uppercase tracking-wider">
            Showing <span className="font-semibold text-stone-900 dark:text-stone-100">{books.length}</span> works
          </div>

          <div className="flex items-center gap-1 bg-stone-100 dark:bg-stone-800/80 p-1 rounded-lg border border-stone-200/80 dark:border-stone-700/80">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
              aria-label="Editorial grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Editorial Grid</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('shelf')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                viewMode === 'shelf'
                  ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-stone-100 shadow-sm'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
              }`}
              aria-label="Bookshelf spine view"
              aria-pressed={viewMode === 'shelf'}
            >
              <Library className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bookshelf Rack</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Content: Grid vs. Shelf */}
      {viewMode === 'shelf' ? (
        <BookshelfRack books={books} onDownloadClick={onDownloadClick} />
      ) : (
        <StaggerGroup className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {books.map((book) => (
            <BookCard key={book.id} book={book} onDownloadClick={onDownloadClick} />
          ))}
        </StaggerGroup>
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
