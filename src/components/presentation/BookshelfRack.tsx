'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Library, Plus, Edit2, Trash2, Lock, AlertTriangle } from 'lucide-react';
import type { GutendexBook } from '@/types/book.types';
import { useHydratedBookshelf } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useOfflineBooks } from '@/hooks/useOfflineBooks';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useTouchDevice } from '@/hooks/useTouchDevice';
import { useJurisdiction } from '@/stores/useJurisdictionStore';
import { isBookPublicDomainInJurisdiction, partitionBooksByJurisdiction } from '@/lib/copyright-engine';
import {
  mergeDownloadedShelfBooks,
  resolveBookshelfViewState,
  filterCustomShelfBooks,
} from '@/lib/book-sorting';
import { attachHorizontalDragAndWheelScroll } from '@/lib/scroll-utils';
import { Button } from '@/components/ui/Button';
import { BookshelfSpine } from './bookshelf/BookshelfSpine';
import { BookshelfMobileModal } from './bookshelf/BookshelfMobileModal';
import { BookshelfManageModals } from './bookshelf/BookshelfManageModals';
import { CollectionEmptyState, COLLECTION_EMPTY_ACTION_CLASS } from './CollectionEmptyState';
import { RemoveOfflineBookModal } from '@/components/ui/RemoveOfflineBookModal';
import { ROUTES } from '@/config/routes';

export const DOWNLOADED_SHELF_ID = '__downloaded__';

export interface BookshelfRackProps {
  books: GutendexBook[];
  onBookClick?: (book: GutendexBook) => void;
  onDownloadClick?: (book: GutendexBook) => void;
  onBrowseCatalog?: () => void;
  searchQuery?: string;
  onClearSearch?: () => void;
  showShelfControls?: boolean;
  totalBooksCount?: number;
}

/**
 * Calculates deterministic shelf capacity given a measured or viewport width,
 * accounting for Tailwind container constraints (max-w-7xl = 1280px) and shelf padding.
 */
export function calculateShelfCapacity(viewportWidth: number): number {
  // Container is constrained by max-w-7xl (1280px) and horizontal padding (32px to 64px)
  const effectiveContainerWidth = Math.min(viewportWidth, 1280);
  const containerPadding = effectiveContainerWidth >= 1024 ? 64 : effectiveContainerWidth >= 640 ? 48 : 32;
  const contentWidth = effectiveContainerWidth - containerPadding;
  // Subtract shelf side bevel padding (approx 48px)
  const availableWidth = Math.max(300, contentWidth - 48);
  // Average book spine width (48px) + gap (14px) = 62px
  return Math.max(6, Math.floor(availableWidth / 62));
}

const EMPTY_OFFLINE_BOOKS: GutendexBook[] = [];

export const BookshelfRack: React.FC<BookshelfRackProps> = ({
  books,
  onBookClick,
  onDownloadClick,
  onBrowseCatalog,
  searchQuery,
  onClearSearch,
  showShelfControls = true,
  totalBooksCount,
}) => {
  const router = useRouter();
  const {
    isSaved: checkIsSaved,
    isFavorite: checkIsFavorite,
    savedBooks,
    toggleSaveBook: toggleSave,
    toggleFavoriteBook: toggleFavorite,
    cloudBookshelves,
    cloudBookshelfItems,
    activeBookshelfId,
    setActiveBookshelfId,
    createCloudBookshelf,
    updateCloudBookshelf,
    deleteCloudBookshelf,
    moveBookToShelf,
  } = useHydratedBookshelf();
  const user = useAuthStore((s) => s.user);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const { country } = useJurisdiction();
  const readingProgress = useReaderStore((s) => s.readingProgress);
  const {
    isBookOffline,
    offlineBooks = EMPTY_OFFLINE_BOOKS,
    isLoaded: isOfflineLoaded,
    downloadBook,
    removeBook,
    downloadingBookId,
  } = useOfflineBooks();
  const { isOffline: isNetworkOffline } = useNetworkStatus();
  const isTouchDevice = useTouchDevice();

  const [bookToRemoveOffline, setBookToRemoveOffline] = useState<GutendexBook | null>(null);

  const handleToggleOffline = async (book: GutendexBook) => {
    if (isBookOffline(book.id)) {
      setBookToRemoveOffline(book);
    } else {
      await downloadBook(book);
    }
  };

  const [isCreatingShelf, setIsCreatingShelf] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');
  const [newShelfIsPublic, setNewShelfIsPublic] = useState(true);
  const [editingShelfId, setEditingShelfId] = useState<string | null>(null);
  const [editingShelfName, setEditingShelfName] = useState('');
  const [editingShelfIsPublic, setEditingShelfIsPublic] = useState(true);
  const [deletingShelfId, setDeletingShelfId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMobileBook, setSelectedMobileBook] = useState<GutendexBook | null>(null);
  const [activeSpineBookId, setActiveSpineBookId] = useState<number | null>(null);
  const openModalTimerRef = useRef<NodeJS.Timeout | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const shelfRowRef = useRef<HTMLDivElement>(null);
  const [shelfCapacity, setShelfCapacity] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return calculateShelfCapacity(window.innerWidth);
    }
    return 18;
  });

  useEffect(() => {
    const el = shelfRowRef.current;
    if (!el) return;
    return attachHorizontalDragAndWheelScroll(el);
  }, []);

  useEffect(() => {
    return () => {
      if (openModalTimerRef.current) {
        clearTimeout(openModalTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const updateCapacity = () => {
      if (!containerRef.current) return;
      const width = containerRef.current.clientWidth;
      // Subtract shelf side bevel padding (approx 48px)
      const availableWidth = Math.max(300, width - 48);
      // Average book spine width (48px) + gap (14px) = 62px
      const capacity = Math.max(6, Math.floor(availableWidth / 62));
      setShelfCapacity(capacity);
    };

    updateCapacity();

    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      const observer = new ResizeObserver(updateCapacity);
      observer.observe(containerRef.current);
      return () => observer.disconnect();
    }
  }, []);

  const closeMobileSheet = () => {
    if (openModalTimerRef.current) {
      clearTimeout(openModalTimerRef.current);
      openModalTimerRef.current = null;
    }
    setSelectedMobileBook(null);
    setActiveSpineBookId(null);
  };

  const handleSpineClick = (book: GutendexBook) => {
    const isRestricted = !isBookPublicDomainInJurisdiction(book, country).isAllowed;
    const isUnavailableOffline = isNetworkOffline && !isBookOffline(book.id);
    const hasTouchTabletViewport =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      (navigator.maxTouchPoints || 0) > 0 &&
      window.innerWidth <= 1366;
    const isTouchOrCompact =
      isTouchDevice ||
      hasTouchTabletViewport ||
      (typeof window !== 'undefined' && window.innerWidth < 1024);

    if (isTouchOrCompact || isRestricted || isUnavailableOffline) {
      if (openModalTimerRef.current) {
        clearTimeout(openModalTimerRef.current);
      }
      setActiveSpineBookId(book.id);
      openModalTimerRef.current = setTimeout(() => {
        setSelectedMobileBook(book);
      }, 120);
    } else {
      if (onBookClick) onBookClick(book);
      else router.push(ROUTES.READ(book.id));
    }
  };

  const handleCreateShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShelfName.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      const newShelf = await createCloudBookshelf(newShelfName.trim(), user?.id || '', newShelfIsPublic);
      if (newShelf) {
        setActiveBookshelfId(newShelf.id);
        setNewShelfName('');
        setNewShelfIsPublic(true);
        setIsCreatingShelf(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenameShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingShelfId || !editingShelfName.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await updateCloudBookshelf(editingShelfId, editingShelfName.trim(), user?.id || '', editingShelfIsPublic);
      setEditingShelfId(null);
      setEditingShelfName('');
      setEditingShelfIsPublic(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteShelf = async () => {
    if (!deletingShelfId || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await deleteCloudBookshelf(deletingShelfId, user?.id || '');
      setDeletingShelfId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const downloadedSavedBooks = useMemo(() => {
    return mergeDownloadedShelfBooks(savedBooks, offlineBooks, isBookOffline);
  }, [savedBooks, offlineBooks, isBookOffline]);

  const {
    defaultShelf,
    currentActiveShelfId,
    isViewingDownloaded,
    isViewingGeneral,
  } = resolveBookshelfViewState({
    cloudBookshelves,
    activeBookshelfId,
    downloadedShelfId: DOWNLOADED_SHELF_ID,
  });

  // Auto-fallback to default shelf if user was viewing Downloaded shelf and it becomes empty
  useEffect(() => {
    if (isOfflineLoaded && activeBookshelfId === DOWNLOADED_SHELF_ID && downloadedSavedBooks.length === 0) {
      setActiveBookshelfId(defaultShelf?.id || null);
    }
  }, [isOfflineLoaded, activeBookshelfId, downloadedSavedBooks.length, defaultShelf?.id, setActiveBookshelfId]);

  // On the 'General' master shelf, show all books across all collections.
  // On 'Downloaded' virtual shelf, show only downloaded books.
  // On custom shelves, filter to only the books assigned to that shelf.
  const effectiveShelfBooks = useMemo(() => {
    if (isViewingDownloaded) {
      return books.filter((b) => isBookOffline(b.id));
    }
    if (!showShelfControls || cloudBookshelves.length <= 1 || isViewingGeneral) {
      return books;
    }
    return filterCustomShelfBooks(books, cloudBookshelfItems, currentActiveShelfId);
  }, [isViewingDownloaded, isBookOffline, showShelfControls, cloudBookshelves.length, isViewingGeneral, cloudBookshelfItems, currentActiveShelfId, books]);

  // Partition shelf books into public domain titles in current jurisdiction vs copyright-restricted titles
  const { downloadableBooks, restrictedBooks } = useMemo(() => {
    return partitionBooksByJurisdiction(effectiveShelfBooks, country);
  }, [effectiveShelfBooks, country]);

  // Chunk books into shelves:
  // - On Bookshelf page (showShelfControls = true): fill sequentially up to physical shelfCapacity per row
  //   (e.g. 18 on desktop, 14 on laptop, 10 on tablet, 6 on mobile). Shelf 1 fills first, then Shelf 2.
  // - On Catalog page (showShelfControls = false): predetermined batch sizes (8 or 16) up to shelfCapacity (18).
  const shelves = useMemo(() => {
    if (effectiveShelfBooks.length === 0) return [];

    if (showShelfControls) {
      const effectiveRowLimit = shelfCapacity;
      const result: GutendexBook[][] = [];
      for (let i = 0; i < effectiveShelfBooks.length; i += effectiveRowLimit) {
        result.push(effectiveShelfBooks.slice(i, i + effectiveRowLimit));
      }
      return result;
    }

    if (effectiveShelfBooks.length <= shelfCapacity) {
      return [effectiveShelfBooks];
    }

    const targetShelves = Math.ceil(effectiveShelfBooks.length / shelfCapacity);
    const balancedCapacity = Math.ceil(effectiveShelfBooks.length / targetShelves);
    const result: GutendexBook[][] = [];
    for (let i = 0; i < effectiveShelfBooks.length; i += balancedCapacity) {
      result.push(effectiveShelfBooks.slice(i, i + balancedCapacity));
    }
    return result;
  }, [effectiveShelfBooks, shelfCapacity, showShelfControls]);

  const activeShelf = cloudBookshelves.find((s) => s.id === currentActiveShelfId) || defaultShelf;
  const activeShelfDisplayName = isViewingDownloaded
    ? 'Downloaded'
    : (activeShelf?.is_default ? 'General' : (activeShelf?.name || 'General'));

  return (
    <div
      className={`relative w-full pt-1 sm:pt-2${effectiveShelfBooks.length > 0 ? ' pb-6' : ''}`}
      data-testid="bookshelf-rack"
      ref={containerRef}
    >
      <div className="w-full space-y-6 sm:space-y-8">
        {/* Cloud Bookshelf Header & Multi-Shelf Switcher */}
        {showShelfControls && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-2 min-h-[32px]">
            <div
              ref={shelfRowRef}
              data-testid="bookshelf-shelves-strip"
              data-no-swipe
              className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth flex-1 min-w-0 select-none py-1 px-1 touch-pan-x"
            >
          {user && cloudBookshelves.length > 0 ? (
            <>
              {cloudBookshelves.map((shelf, index) => {
                const isActive = !isViewingDownloaded && ((activeBookshelfId === shelf.id) || (!activeBookshelfId && shelf.is_default));
                const shelfDisplayName = shelf.is_default ? 'General' : shelf.name;
                const isGeneral = shelf.is_default || index === 0;
                return (
                  <React.Fragment key={shelf.id}>
                    <button
                      type="button"
                      onClick={() => setActiveBookshelfId(shelf.id)}
                      aria-label={shelfDisplayName}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-medium border transition-colors cursor-pointer select-none shrink-0 whitespace-nowrap ${
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground border-border'
                      }`}
                    >
                      <span>{shelfDisplayName}</span>
                      {!shelf.is_default && shelf.is_public === false && (
                        <Lock className="w-2.5 h-2.5 text-amber-500 inline ml-1 shrink-0" data-testid="private-shelf-badge" />
                      )}
                      {shelf.is_default && (
                        <span className="ml-1.5 opacity-70 text-[10px]">({totalBooksCount ?? books.length})</span>
                      )}
                      {!shelf.is_default && (
                        <span className="ml-1.5 opacity-70 text-[10px]">
                          ({cloudBookshelfItems.filter((item) => item.bookshelf_id === shelf.id).length})
                        </span>
                      )}
                    </button>
                    {isGeneral && downloadedSavedBooks.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveBookshelfId(DOWNLOADED_SHELF_ID)}
                        aria-label="Downloaded"
                        data-testid="downloaded-shelf-pill"
                        className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-medium border transition-colors cursor-pointer select-none shrink-0 whitespace-nowrap ${
                          isViewingDownloaded
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                        }`}
                      >
                        <span>Downloaded</span>
                        <span className="ml-1.5 opacity-80 text-[10px]">({downloadedSavedBooks.length})</span>
                      </button>
                    )}
                  </React.Fragment>
                );
              })}

              <button
                type="button"
                onClick={() => setIsCreatingShelf(true)}
                className="px-2.5 py-1.5 rounded-full text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted border border-dashed border-border transition-colors flex items-center gap-1 cursor-pointer shrink-0 whitespace-nowrap"
                title="Create New Shelf"
                aria-label="Create New Shelf"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Shelf</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setActiveBookshelfId(null)}
                aria-label="General"
                className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-medium border transition-colors cursor-pointer select-none shrink-0 whitespace-nowrap ${
                  !isViewingDownloaded
                    ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                    : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground border-border'
                }`}
              >
                <span>General</span>
              </button>
              <span className="text-xs font-mono text-muted-foreground shrink-0 whitespace-nowrap">({totalBooksCount ?? books.length} volumes)</span>
              {downloadedSavedBooks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveBookshelfId(DOWNLOADED_SHELF_ID)}
                  aria-label="Downloaded"
                  data-testid="downloaded-shelf-pill"
                  className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-medium border transition-colors cursor-pointer select-none shrink-0 whitespace-nowrap ${
                    isViewingDownloaded
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                  }`}
                >
                  <span>Downloaded</span>
                  <span className="ml-1.5 opacity-80 text-[10px]">({downloadedSavedBooks.length})</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Guest Mode Sync Prompt */}
        {!user && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground hidden sm:inline">Guest Mode</span>
            <Button
              variant="primary"
              size="chip"
              onClick={() => openAuthModal('sign_in')}
              className="text-xs font-mono"
            >
              <span>Sign In</span>
            </Button>
          </div>
        )}

        {/* Actions Cluster: Shelf Management (Edit/Delete) & Offline Downloads */}
        {((user && activeShelf && !activeShelf.is_default && !isViewingDownloaded) || effectiveShelfBooks.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap" data-testid="shelf-action-controls">
            {/* Action Controls for Non-Default Custom Shelves */}
            {user && activeShelf && !activeShelf.is_default && !isViewingDownloaded && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setEditingShelfId(activeShelf.id);
                    setEditingShelfName(activeShelf.name);
                    setEditingShelfIsPublic(activeShelf.is_public ?? true);
                  }}
                  className="h-[26px] w-[26px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors cursor-pointer shrink-0"
                  title={`Rename ${activeShelf.name}`}
                  aria-label={`Rename ${activeShelf.name}`}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeletingShelfId(activeShelf.id)}
                  className="h-[26px] w-[26px] flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 border border-destructive/20 transition-colors cursor-pointer shrink-0"
                  title={`Delete ${activeShelf.name}`}
                  aria-label={`Delete ${activeShelf.name}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Jurisdiction Restriction Notice */}
            {effectiveShelfBooks.length > 0 && downloadableBooks.length === 0 && restrictedBooks.length > 0 && (
              <div className="flex items-center gap-1.5">
                <div
                  role="status"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 select-none cursor-default"
                  title={`All titles on this shelf are protected by copyright in ${country}`}
                  aria-label={`All Restricted in ${country}`}
                  data-testid="all-restricted-offline-notice"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="hidden sm:inline font-medium">All Restricted in {country}</span>
                  <span className="sm:hidden font-medium">Restricted ({country})</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )}

      {/* Empty State vs Hardwood Shelf Rails with tactile page turn */}
      <div
        key={`shelf-content-${isViewingGeneral ? 'general' : (currentActiveShelfId || 'general')}`}
        className="animate-page-turn w-full"
        data-testid="shelf-content-container"
      >
        {effectiveShelfBooks.length === 0 ? (
          <CollectionEmptyState
            icon={showShelfControls ? <Library className="w-8 h-8" /> : <BookOpen className="w-8 h-8" />}
            iconContainerClassName="bg-primary/10 text-primary"
            title={
              searchQuery?.trim()
                ? !showShelfControls
                  ? `No volumes found matching "${searchQuery}"`
                  : `No books found matching "${searchQuery}" on "${activeShelfDisplayName}"`
                : !showShelfControls
                ? 'No volumes found'
                : `No books found on "${activeShelfDisplayName}"`
            }
            description={
              searchQuery?.trim()
                ? !showShelfControls
                  ? 'Try searching for different keywords or clear the search filter.'
                  : 'Try searching for different keywords or clear the search query to see all books on this shelf.'
                : !showShelfControls
                ? 'Try adjusting your search criteria or explore other categories in the catalog.'
                : isViewingGeneral
                ? 'Save your favorite books from the catalog to curate your personal classic library.'
                : 'Add books to this shelf using the "Move to Shelf" selector on book spine hover cards.'
            }
            onExploreCatalog={
              !(searchQuery?.trim() && onClearSearch) && showShelfControls
                ? () => {
                    if (onBrowseCatalog) {
                      onBrowseCatalog();
                    } else {
                      router.push(ROUTES.HOME);
                    }
                  }
                : undefined
            }
            actions={
              (searchQuery?.trim() && onClearSearch) || (showShelfControls && !user) ? (
                <>
                  {searchQuery?.trim() && onClearSearch && (
                    <Button
                      variant="outline"
                      size="md"
                      onClick={onClearSearch}
                      className={COLLECTION_EMPTY_ACTION_CLASS}
                    >
                      <span>Clear Search</span>
                    </Button>
                  )}
                  {showShelfControls && !user && (
                    <Button
                      variant="outline"
                      size="md"
                      onClick={() => openAuthModal('sign_in')}
                      className={COLLECTION_EMPTY_ACTION_CLASS}
                    >
                      <span>Sign In</span>
                    </Button>
                  )}
                </>
              ) : undefined
            }
          />
        ) : (
          shelves.map((shelfBooks, shelfIndex) => (
            <div key={`shelf-${shelfIndex}`} className="relative z-10 hover:z-30 w-full mb-8">
              {/* Unified Shelf Niche & Hardwood Rail Module */}
              <div className="relative w-full rounded-2xl border border-border shelf-ambient-niche shadow-md overflow-hidden sm:overflow-visible">
                
                {/* Shelf Items Row */}
                <div
                  data-testid={`shelf-items-row-${shelfIndex}`}
                  className="flex items-end justify-center gap-2 sm:gap-3.5 overflow-x-auto sm:overflow-visible scrollbar-none pt-10 px-4 sm:px-8 snap-x relative z-10 min-h-[320px]"
                >
                  {shelfBooks.map((book, bookIndex) => (
                    <BookshelfSpine
                      key={book.id}
                      book={book}
                      bookIndex={bookIndex}
                      readingProgress={readingProgress[book.id]}
                      isSaved={checkIsSaved(book.id)}
                      isFavorite={checkIsFavorite(book.id)}
                      isOffline={isBookOffline(book.id)}
                      isDownloadingOffline={downloadingBookId === book.id}
                      onToggleSave={toggleSave}
                      onToggleFavorite={toggleFavorite}
                      onToggleOffline={handleToggleOffline}
                      onSpineClick={handleSpineClick}
                      onBookClick={onBookClick}
                      onDownloadClick={onDownloadClick}
                      cloudBookshelves={cloudBookshelves}
                      cloudBookshelfItems={cloudBookshelfItems}
                      defaultShelfId={defaultShelf?.id}
                      currentActiveShelfId={currentActiveShelfId}
                      userId={user?.id}
                      onMoveBookToShelf={moveBookToShelf}
                      isActive={activeSpineBookId === book.id}
                    />
                  ))}
                </div>

                {/* Hardwood Shelf Plank Base */}
                <div className="shelf-wood-ledge w-full h-5 rounded-b-2xl relative z-20 border-t border-black/30 shadow-md" />
              </div>
            </div>
          ))
        )}
      </div>
      </div>

      {/* Mobile/Restricted In-Shelf Quick-Action Centered Floating Modal */}
      {selectedMobileBook && (
        <BookshelfMobileModal
          selectedMobileBook={selectedMobileBook}
          onClose={closeMobileSheet}
          readingProgress={readingProgress[selectedMobileBook.id]}
          isSaved={checkIsSaved(selectedMobileBook.id)}
          isFavorite={checkIsFavorite(selectedMobileBook.id)}
          isOffline={isBookOffline(selectedMobileBook.id)}
          isDownloadingOffline={downloadingBookId === selectedMobileBook.id}
          onToggleSave={toggleSave}
          onToggleFavorite={toggleFavorite}
          onToggleOffline={handleToggleOffline}
          onBookClick={onBookClick}
          onDownloadClick={onDownloadClick}
          cloudBookshelves={cloudBookshelves}
          cloudBookshelfItems={cloudBookshelfItems}
          defaultShelfId={defaultShelf?.id}
          currentActiveShelfId={currentActiveShelfId}
          userId={user?.id}
          onMoveBookToShelf={moveBookToShelf}
        />
      )}

      {/* Shelf Management Modals (Create / Rename / Delete) */}
      {showShelfControls && (
        <BookshelfManageModals
          isCreatingShelf={isCreatingShelf}
          newShelfName={newShelfName}
          newShelfIsPublic={newShelfIsPublic}
          onNewShelfNameChange={setNewShelfName}
          onNewShelfIsPublicChange={setNewShelfIsPublic}
          onCloseCreateShelf={() => {
            setIsCreatingShelf(false);
            setNewShelfName('');
            setNewShelfIsPublic(true);
          }}
          onCreateShelf={handleCreateShelf}
          editingShelfId={editingShelfId}
          editingShelfName={editingShelfName}
          editingShelfIsPublic={editingShelfIsPublic}
          onEditingShelfNameChange={setEditingShelfName}
          onEditingShelfIsPublicChange={setEditingShelfIsPublic}
          onCloseRenameShelf={() => {
            setEditingShelfId(null);
            setEditingShelfName('');
            setEditingShelfIsPublic(true);
          }}
          onRenameShelf={handleRenameShelf}
          deletingShelfId={deletingShelfId}
          onCloseDeleteShelf={() => setDeletingShelfId(null)}
          onDeleteShelf={handleDeleteShelf}
          isSubmitting={isSubmitting}
        />
      )}

      {/* Remove Single Offline Copy Confirmation Modal */}
      <RemoveOfflineBookModal
        isOpen={Boolean(bookToRemoveOffline)}
        bookTitle={bookToRemoveOffline?.title}
        onClose={() => setBookToRemoveOffline(null)}
        onConfirm={async () => {
          if (bookToRemoveOffline) {
            await removeBook(bookToRemoveOffline.id);
            setBookToRemoveOffline(null);
          }
        }}
      />
    </div>
  );
};
