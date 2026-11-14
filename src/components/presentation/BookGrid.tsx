'use client';

import React, { useState } from 'react';
import type { GutendexBook } from '@/types/book.types';
import { BookCard } from './BookCard';
import { BookshelfRack } from './BookshelfRack';
import { CollectionEmptyState, COLLECTION_EMPTY_ACTION_CLASS } from './CollectionEmptyState';
import { Button } from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useOfflineBooks } from '@/hooks/useOfflineBooks';
import { LayoutGrid, Library, RotateCcw, AlertTriangle, BookOpen, Heart, ChevronLeft, ChevronRight, Loader2, Info } from 'lucide-react';

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
  onRemoveOfflineClick?: (book: GutendexBook) => void;
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
  activeView?: 'catalog' | 'bookshelf' | 'favorites' | 'notebook' | 'bookmarks';
  showShelfControls?: boolean;
  totalBooksCount?: number;
  onTopicClick?: (topic: string) => void;
  pageSize?: number;
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
  onRemoveOfflineClick,
  onPreviewClick,
  activePreviewBookId = null,
  emptyTitle = 'No public domain books found',
  emptyDescription = 'Try adjusting your search criteria or topic selection.',
  viewMode: controlledViewMode,
  onViewModeChange,
  initialViewMode = 'grid',
  showViewToggle = true,
  onBrowseCatalog,
  searchQuery,
  onClearSearch,
  activeView,
  showShelfControls,
  totalBooksCount,
  onTopicClick,
  pageSize = 16,
}) => {
  const [internalViewMode, setInternalViewMode] = useState<BookViewMode>(initialViewMode);
  const activeViewMode = controlledViewMode ?? internalViewMode;
  const shouldShowShelfControls = showShelfControls ?? (activeView === 'bookshelf');
  const { isBookOffline } = useOfflineBooks();

  const handleViewToggle = (mode: BookViewMode) => {
    if (onViewModeChange) {
      onViewModeChange(mode);
    } else {
      setInternalViewMode(mode);
    }
  };

  if (isLoading) {
    const skeletonCount = Math.max(1, pageSize);
    return (
      <div className="space-y-6 py-8" data-testid="book-grid-loading">
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
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-6">
          {Array.from({ length: skeletonCount }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-border bg-card p-4 flex flex-col gap-4 animate-pulse min-h-[360px] sm:min-h-[420px]"
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
        {onPageChange && (
          <div data-testid="catalog-pagination-bar" className="flex items-center justify-center gap-3 pt-5 sm:pt-6 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              disabled={true}
              className="gap-1.5 text-xs font-medium opacity-50 cursor-not-allowed"
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
              disabled={true}
              className="gap-1.5 text-xs font-medium opacity-50 cursor-not-allowed"
              aria-label="Next page"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
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

  const paginationBar = onPageChange ? (
    <div data-testid="catalog-pagination-bar" className="flex items-center justify-center gap-3 pt-5 sm:pt-6 border-t border-border">
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
  ) : null;

  if (activeViewMode !== 'shelf' && books.length === 0) {
    const isFavoritesEmpty = activeView === 'favorites';
    const emptyState = (
      <CollectionEmptyState
        icon={isFavoritesEmpty ? <Heart className="w-8 h-8" /> : <BookOpen className="w-8 h-8" />}
        iconContainerClassName={
          isFavoritesEmpty ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
        }
        title={emptyTitle}
        description={emptyDescription}
        onExploreCatalog={isFavoritesEmpty && !onClearSearch ? onBrowseCatalog : undefined}
        actions={
          onClearSearch ? (
            <Button
              variant="outline"
              size="md"
              onClick={onClearSearch}
              className={COLLECTION_EMPTY_ACTION_CLASS}
            >
              <span>Clear Search</span>
            </Button>
          ) : undefined
        }
      />
    );

    if (onPageChange && page > 1) {
      return (
        <div className="space-y-6 sm:space-y-8" data-testid="book-grid-container">
          {emptyState}
          {paginationBar}
        </div>
      );
    }

    return emptyState;
  }

  return (
    <div className="space-y-6 sm:space-y-8" data-testid="book-grid-container">
      {/* Optional In-Section View Mode Switcher Header */}
      {showViewToggle && (
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            {books.length} Volumes Available
          </div>

          <SegmentedControl<BookViewMode>
            value={activeViewMode}
            onChange={handleViewToggle}
            className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border"
            optionClassName="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono transition-all"
            activeClassName="bg-card text-foreground shadow-xs font-bold"
            inactiveClassName="text-muted-foreground hover:text-foreground"
            options={[
              {
                value: 'grid',
                icon: <LayoutGrid className="w-3.5 h-3.5" />,
                label: <span className="hidden sm:inline">Cover Grid</span>,
                ariaLabel: 'Grid cover view',
              },
              {
                value: 'shelf',
                icon: <Library className="w-3.5 h-3.5" />,
                label: <span className="hidden sm:inline">Bookshelf Rack</span>,
                ariaLabel: 'Bookshelf spine view',
              },
            ]}
          />
        </div>
      )}

      {/* Main Content: Grid vs. Shelf with smooth page fade */}
      <div key={`catalog-page-${page}-${activeViewMode}`} className="animate-page-turn [overflow-anchor:none] relative z-20" id="book-grid-content">
        {activeViewMode === 'shelf' ? (
          <BookshelfRack
            books={books}
            onDownloadClick={onDownloadClick}
            onBrowseCatalog={onBrowseCatalog}
            searchQuery={searchQuery}
            onClearSearch={onClearSearch}
            showShelfControls={shouldShowShelfControls}
            totalBooksCount={totalBooksCount}
          />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2.5 sm:gap-6">
            {books.map((book) => (
              <BookCard
                key={book.id}
                book={book}
                isOffline={isBookOffline(book.id)}
                onDownloadClick={onDownloadClick}
                onRemoveOfflineClick={onRemoveOfflineClick}
                onPreviewClick={onPreviewClick}
                isPreviewActive={activePreviewBookId === book.id}
                activeView={activeView}
                onTopicClick={onTopicClick}
              />
            ))}
          </div>
        )}
      </div>

      {/* Pagination Bar */}
      {paginationBar}
    </div>
  );
};
