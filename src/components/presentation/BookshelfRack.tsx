'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Sparkles, Plus, Edit2, Trash2, CheckCircle2, HardDriveDownload } from 'lucide-react';
import type { GutendexBook } from '@/types/book.types';
import { useHydratedBookshelf } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useOfflineBooks } from '@/hooks/useOfflineBooks';
import { Button } from '@/components/ui/Button';
import { BookshelfSpine } from './bookshelf/BookshelfSpine';
import { BookshelfMobileModal } from './bookshelf/BookshelfMobileModal';
import { BookshelfManageModals } from './bookshelf/BookshelfManageModals';
import { ROUTES } from '@/config/routes';

export interface BookshelfRackProps {
  books: GutendexBook[];
  onBookClick?: (book: GutendexBook) => void;
  onDownloadClick?: (book: GutendexBook) => void;
  onBrowseCatalog?: () => void;
  searchQuery?: string;
  onClearSearch?: () => void;
}

export const BookshelfRack: React.FC<BookshelfRackProps> = ({
  books,
  onBookClick,
  onDownloadClick,
  onBrowseCatalog,
  searchQuery,
  onClearSearch,
}) => {
  const router = useRouter();
  const {
    isSaved: checkIsSaved,
    isLiked: checkIsLiked,
    toggleSaveBook: toggleSave,
    toggleLikeBook: toggleLike,
    cloudBookshelves,
    cloudBookshelfItems,
    activeBookshelfId,
    setActiveBookshelfId,
    createCloudBookshelf,
    updateCloudBookshelf,
    deleteCloudBookshelf,
    moveBookToShelf,
    isSyncing,
  } = useHydratedBookshelf();
  const readingProgress = useReaderStore((s) => s.readingProgress);
  const { user, openAuthModal } = useAuthStore();
  const {
    isBookOffline,
    downloadBook,
    removeBook,
    downloadAll,
    removeAll,
    isDownloading: isDownloadingOffline,
    downloadAllProgress: offlineProgress,
  } = useOfflineBooks();

  const handleToggleOffline = async (book: GutendexBook) => {
    if (isBookOffline(book.id)) {
      await removeBook(book.id);
    } else {
      await downloadBook(book);
    }
  };

  const [isCreatingShelf, setIsCreatingShelf] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');
  const [editingShelfId, setEditingShelfId] = useState<string | null>(null);
  const [editingShelfName, setEditingShelfName] = useState('');
  const [deletingShelfId, setDeletingShelfId] = useState<string | null>(null);
  const [isClearingOfflineShelf, setIsClearingOfflineShelf] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMobileBook, setSelectedMobileBook] = useState<GutendexBook | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const [shelfCapacity, setShelfCapacity] = useState<number>(18);

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
    setSelectedMobileBook(null);
  };

  const handleSpineClick = (book: GutendexBook) => {
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setSelectedMobileBook(book);
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
      const newShelf = await createCloudBookshelf(newShelfName.trim(), user?.id || '');
      if (newShelf) {
        setActiveBookshelfId(newShelf.id);
        setNewShelfName('');
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
      await updateCloudBookshelf(editingShelfId, editingShelfName.trim(), user?.id || '');
      setEditingShelfId(null);
      setEditingShelfName('');
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

  const defaultShelf = cloudBookshelves.find((s) => s.is_default) || cloudBookshelves[0];
  const currentActiveShelfId = activeBookshelfId || defaultShelf?.id;
  const isViewingGeneral = defaultShelf ? currentActiveShelfId === defaultShelf.id : true;

  // On the 'General' master shelf, show all books across all collections.
  // On custom shelves, filter to only the books assigned to that shelf.
  const effectiveShelfBooks = useMemo(() => {
    if (cloudBookshelves.length <= 1 || isViewingGeneral) {
      return books;
    }

    const currentShelfBookIds = new Set(
      cloudBookshelfItems
        .filter((item) => item.bookshelf_id === currentActiveShelfId)
        .map((item) => item.book_id)
    );
    return books.filter((b) => currentShelfBookIds.has(b.id));
  }, [cloudBookshelves.length, isViewingGeneral, cloudBookshelfItems, currentActiveShelfId, books]);

  // Chunk books dynamically into shelves based on container width
  const shelves = useMemo(() => {
    const result: GutendexBook[][] = [];
    for (let i = 0; i < effectiveShelfBooks.length; i += shelfCapacity) {
      result.push(effectiveShelfBooks.slice(i, i + shelfCapacity));
    }
    return result;
  }, [effectiveShelfBooks, shelfCapacity]);

  const activeShelf = cloudBookshelves.find((s) => s.id === currentActiveShelfId) || defaultShelf;
  const activeShelfDisplayName = activeShelf?.is_default ? 'General' : (activeShelf?.name || 'General');

  const handleConfirmClearOfflineShelf = async () => {
    try {
      setIsSubmitting(true);
      await removeAll(effectiveShelfBooks);
      setIsClearingOfflineShelf(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full space-y-8 py-6" data-testid="bookshelf-rack" ref={containerRef}>
      {/* Cloud Bookshelf Header & Multi-Shelf Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-2 flex-wrap">
          {user && cloudBookshelves.length > 0 ? (
            <>
              {cloudBookshelves.map((shelf) => {
                const isActive = (activeBookshelfId === shelf.id) || (!activeBookshelfId && shelf.is_default);
                const shelfDisplayName = shelf.is_default ? 'General' : shelf.name;
                return (
                  <button
                    key={shelf.id}
                    type="button"
                    onClick={() => setActiveBookshelfId(shelf.id)}
                    aria-label={shelfDisplayName}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-mono font-medium transition-all cursor-pointer select-none ${
                      isActive
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'bg-card hover:bg-muted text-muted-foreground hover:text-foreground border border-border'
                    }`}
                  >
                    <span>{shelfDisplayName}</span>
                    {shelf.is_default && (
                      <span className="ml-1.5 opacity-70 text-[10px]">({books.length})</span>
                    )}
                    {!shelf.is_default && (
                      <span className="ml-1.5 opacity-70 text-[10px]">
                        ({cloudBookshelfItems.filter((item) => item.bookshelf_id === shelf.id).length})
                      </span>
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setIsCreatingShelf(true)}
                className="px-2.5 py-1.5 rounded-full text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-muted border border-dashed border-border transition-colors flex items-center gap-1 cursor-pointer"
                title="Create New Shelf"
                aria-label="Create New Shelf"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">New Shelf</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <span className="px-3.5 py-1.5 rounded-full text-xs font-mono font-medium bg-primary text-primary-foreground shadow-sm">
                General
              </span>
              <span className="text-xs font-mono text-muted-foreground">({books.length} volumes)</span>
            </div>
          )}
        </div>

        {/* Guest Mode Sync Prompt */}
        {!user && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground hidden sm:inline">Guest Mode (Local)</span>
            <Button
              variant="primary"
              size="chip"
              onClick={() => openAuthModal('sign_in')}
              className="text-xs font-mono"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Sign in to Sync</span>
            </Button>
          </div>
        )}

        {/* Offline Download All / Clear Shelf Button */}
        {effectiveShelfBooks.length > 0 && (
          <div className="flex items-center gap-1.5">
            {isDownloadingOffline ? (
              <Button
                variant="outline"
                size="chip"
                disabled
                className="text-xs font-mono gap-1.5"
                title="Downloading shelf offline"
                aria-label="Downloading shelf offline"
              >
                <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                <span>
                  {offlineProgress
                    ? `Saving ${offlineProgress.current}/${offlineProgress.total}`
                    : 'Downloading...'}
                </span>
              </Button>
            ) : effectiveShelfBooks.every((b) => isBookOffline(b.id)) ? (
              <div className="flex items-center gap-1.5">
                <div
                  role="status"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 select-none cursor-default"
                  title="All books on this shelf are saved for offline reading"
                  aria-label="All Saved for Offline"
                  data-testid="all-saved-offline-notice"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span className="hidden sm:inline font-medium">All Saved for Offline</span>
                  <span className="sm:hidden font-medium">Saved</span>
                </div>
                <Button
                  variant="outline"
                  size="chip"
                  onClick={() => setIsClearingOfflineShelf(true)}
                  className="text-xs font-mono gap-1.5 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-500/30 hover:bg-rose-500/10 transition-colors"
                  title="Clear all downloaded offline books on this shelf"
                  aria-label="Clear Offline Shelf"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="hidden sm:inline">Clear Offline Shelf</span>
                  <span className="sm:hidden">Clear</span>
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="chip"
                onClick={() => downloadAll(effectiveShelfBooks)}
                className="text-xs font-mono gap-1.5"
                title="Download all books on this shelf for offline reading"
                aria-label="Download all books on this shelf for offline reading"
              >
                <HardDriveDownload className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="hidden sm:inline">Download Shelf Offline</span>
                <span className="sm:hidden">Download All</span>
              </Button>
            )}
          </div>
        )}

        {/* Action Controls for Non-Default Custom Shelves */}
        {user && activeShelf && !activeShelf.is_default && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setEditingShelfId(activeShelf.id);
                setEditingShelfName(activeShelf.name);
              }}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-colors cursor-pointer"
              title={`Rename ${activeShelf.name}`}
              aria-label={`Rename ${activeShelf.name}`}
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setDeletingShelfId(activeShelf.id)}
              className="p-1.5 rounded-lg text-destructive hover:bg-destructive/10 border border-destructive/20 transition-colors cursor-pointer"
              title={`Delete ${activeShelf.name}`}
              aria-label={`Delete ${activeShelf.name}`}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Sync Status Badge */}
      {isSyncing && (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 border border-primary/20 rounded-full w-fit text-[11px] font-mono text-primary animate-pulse">
          <Sparkles className="w-3 h-3" />
          <span>Syncing with Cloud Bookshelf...</span>
        </div>
      )}

      {/* Empty State vs Hardwood Shelf Rails */}
      {effectiveShelfBooks.length === 0 ? (
        <div className="text-center py-20 px-4 rounded-3xl border border-dashed border-border bg-card/40 backdrop-blur-xs max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <BookOpen className="w-6 h-6" />
          </div>
          <h3 className="font-serif font-bold text-lg text-foreground mb-1">
            {searchQuery?.trim()
              ? `No books found matching "${searchQuery}" on "${activeShelfDisplayName}"`
              : `No books found on "${activeShelfDisplayName}"`}
          </h3>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-6">
            {searchQuery?.trim()
              ? 'Try searching for different keywords or clear the search query to see all books on this shelf.'
              : isViewingGeneral
              ? 'Save your favorite books from the catalog to curate your personal classic library.'
              : 'Add books to this shelf using the "Move to Shelf" selector on book spine hover cards.'}
          </p>
          <div className="flex items-center justify-center gap-3">
            {searchQuery?.trim() && onClearSearch ? (
              <Button
                variant="outline"
                size="chip"
                onClick={onClearSearch}
              >
                Clear Search
              </Button>
            ) : (
              <Button
                variant="outline"
                size="chip"
                onClick={() => {
                  if (onBrowseCatalog) {
                    onBrowseCatalog();
                  } else {
                    router.push(ROUTES.HOME);
                  }
                }}
              >
                Browse Catalog
              </Button>
            )}
            {!user && (
              <Button
                variant="primary"
                size="chip"
                onClick={() => openAuthModal('sign_in')}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sign In to Sync</span>
              </Button>
            )}
          </div>
        </div>
      ) : (
        shelves.map((shelfBooks, shelfIndex) => (
          <div key={`shelf-${shelfIndex}-${shelfBooks[0]?.id || 0}`} className="relative z-10 hover:z-30 w-full mb-8">
            {/* Unified Shelf Niche & Hardwood Rail Module */}
            <div className="relative w-full rounded-2xl border border-border shelf-ambient-niche shadow-md overflow-hidden sm:overflow-visible">
              
              {/* Shelf Items Row */}
              <div className="flex items-end justify-center gap-2 sm:gap-3.5 overflow-x-auto sm:overflow-visible scrollbar-none pt-10 px-4 sm:px-8 snap-x relative z-10">
                {shelfBooks.map((book, bookIndex) => (
                  <BookshelfSpine
                    key={book.id}
                    book={book}
                    bookIndex={bookIndex}
                    readingProgress={readingProgress[book.id]}
                    isSaved={checkIsSaved(book.id)}
                    isLiked={checkIsLiked(book.id)}
                    isOffline={isBookOffline(book.id)}
                    onToggleSave={toggleSave}
                    onToggleLike={toggleLike}
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
                  />
                ))}
              </div>

              {/* Hardwood Shelf Plank Base */}
              <div className="shelf-wood-ledge w-full h-5 rounded-b-2xl relative z-20 border-t border-black/30 shadow-md" />

              {/* Mobile In-Shelf Quick-Action Centered Floating Modal */}
              {selectedMobileBook && shelfBooks.some((b) => b.id === selectedMobileBook.id) && (
                <BookshelfMobileModal
                  selectedMobileBook={selectedMobileBook}
                  onClose={closeMobileSheet}
                  readingProgress={readingProgress[selectedMobileBook.id]}
                  isSaved={checkIsSaved(selectedMobileBook.id)}
                  isLiked={checkIsLiked(selectedMobileBook.id)}
                  isOffline={isBookOffline(selectedMobileBook.id)}
                  onToggleSave={toggleSave}
                  onToggleLike={toggleLike}
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
            </div>
          </div>
        ))
      )}

      {/* Shelf Management Modals (Create / Rename / Delete) */}
      <BookshelfManageModals
        isCreatingShelf={isCreatingShelf}
        newShelfName={newShelfName}
        onNewShelfNameChange={setNewShelfName}
        onCloseCreateShelf={() => {
          setIsCreatingShelf(false);
          setNewShelfName('');
        }}
        onCreateShelf={handleCreateShelf}
        editingShelfId={editingShelfId}
        editingShelfName={editingShelfName}
        onEditingShelfNameChange={setEditingShelfName}
        onCloseRenameShelf={() => {
          setEditingShelfId(null);
          setEditingShelfName('');
        }}
        onRenameShelf={handleRenameShelf}
        deletingShelfId={deletingShelfId}
        onCloseDeleteShelf={() => setDeletingShelfId(null)}
        onDeleteShelf={handleDeleteShelf}
        isClearingOfflineShelf={isClearingOfflineShelf}
        onCloseClearOfflineShelf={() => setIsClearingOfflineShelf(false)}
        onConfirmClearOfflineShelf={handleConfirmClearOfflineShelf}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};
