'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Download, Library, Heart, Sparkles, X, CheckCircle2, HardDriveDownload, AlertTriangle, Loader2, Trash2, WifiOff } from 'lucide-react';
import type { GutendexBook } from '@/types/book.types';
import type { Bookshelf, BookshelfItem } from '@/types/database.types';
import { useReaderStore } from '@/stores/useReaderStore';
import { useHydratedBookshelf } from '@/stores/useBookshelfStore';
import { useBookCopyright } from '@/hooks/useBookCopyright';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { CopyrightNoticeBanner } from '@/components/presentation/CopyrightNoticeBanner';
import { StarRating } from '@/components/ui/StarRating';
import { ReadingStatusSelector } from '@/components/bookshelf/ReadingStatusSelector';
import { Button } from '@/components/ui/Button';
import {
  CopyBookLinkIndicator,
  handleCopyBookLinkClick,
} from '@/components/ui/CursorTooltip';
import { RemoveCollectionBookModal, type CollectionRemovalType } from '@/components/ui/RemoveCollectionBookModal';
import { useHasMounted } from '@/hooks/useHasMounted';
import { formatAuthorNames } from '@/lib/utils';
import { ROUTES } from '@/config/routes';

export interface BookshelfMobileModalProps {
  selectedMobileBook: GutendexBook | null;
  isClosingMobileSheet?: boolean;
  onClose: () => void;
  readingProgress?: number;
  isSaved?: boolean;
  isFavorite?: boolean;
  isOffline?: boolean;
  isDownloadingOffline?: boolean;
  onToggleSave?: (book: GutendexBook) => void;
  onToggleFavorite?: (book: GutendexBook) => void;
  onToggleOffline?: (book: GutendexBook) => void;
  onBookClick?: (book: GutendexBook) => void;
  onDownloadClick?: (book: GutendexBook) => void;
  cloudBookshelves?: Bookshelf[];
  cloudBookshelfItems?: BookshelfItem[];
  defaultShelfId?: string;
  currentActiveShelfId?: string;
  userId?: string;
  onMoveBookToShelf?: (bookId: number, targetShelfId: string, userId: string) => Promise<boolean | void>;
  activeView?: 'catalog' | 'bookshelf' | 'favorites' | 'notebook' | 'bookmarks';
  className?: string;
}

export const BookshelfMobileModal: React.FC<BookshelfMobileModalProps> = ({
  selectedMobileBook,
  onClose,
  readingProgress,
  isSaved,
  isFavorite,
  isOffline = false,
  isDownloadingOffline = false,
  onToggleSave,
  onToggleFavorite,
  onToggleOffline,
  onBookClick,
  onDownloadClick,
  cloudBookshelves = [],
  cloudBookshelfItems = [],
  defaultShelfId,
  currentActiveShelfId,
  userId,
  onMoveBookToShelf,
  activeView,
  className = '',
}) => {
  const router = useRouter();
  const hasMounted = useHasMounted();
  const { isOffline: isNetworkOffline } = useNetworkStatus();
  const isUnavailableOffline = isNetworkOffline && !isOffline;

  const {
    isSaved: storeIsSaved,
    isFavorite: storeIsFavorite,
    toggleSaveBook,
    toggleFavoriteBook,
    bookRatings,
    bookStatuses,
    setBookRating,
    setReadingStatus,
  } = useHydratedBookshelf();

  const effectiveIsSaved = isSaved !== undefined
    ? isSaved
    : selectedMobileBook
    ? storeIsSaved(selectedMobileBook.id)
    : false;

  const effectiveIsFavorite = isFavorite !== undefined
    ? isFavorite
    : selectedMobileBook
    ? storeIsFavorite(selectedMobileBook.id)
    : false;

  const handleToggleSave = onToggleSave || toggleSaveBook;
  const handleToggleFavorite = onToggleFavorite || toggleFavoriteBook;

  const currentRating = selectedMobileBook ? bookRatings[selectedMobileBook.id] ?? null : null;
  const currentStatus = selectedMobileBook ? bookStatuses[selectedMobileBook.id] ?? null : null;
  const isCuratable = activeView === undefined || activeView === 'bookshelf' || activeView === 'favorites';

  const { country, evaluation, isRestricted, ruleDescription, reason, publicDomainYear } = useBookCopyright(selectedMobileBook);
  const [pendingRemoval, setPendingRemoval] = React.useState<CollectionRemovalType | null>(null);
  const [previousMobileBookId, setPreviousMobileBookId] = React.useState<number | null>(
    selectedMobileBook?.id ?? null
  );
  const selectedMobileBookId = selectedMobileBook?.id ?? null;
  if (selectedMobileBookId !== previousMobileBookId) {
    setPreviousMobileBookId(selectedMobileBookId);
    setPendingRemoval(null);
  }

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedMobileBook && !pendingRemoval) {
        onClose();
      }
    };
    if (selectedMobileBook) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedMobileBook, onClose, pendingRemoval]);

  if (!hasMounted) return null;

  return createPortal(
    <AnimatePresence>
      {selectedMobileBook && (
        <>
          {/* Transparent Backdrop to capture outside taps without dimming */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={`fixed inset-0 bg-transparent z-50 cursor-pointer ${className}`.trim()}
            onClick={onClose}
            aria-hidden="true"
            data-testid="mobile-sheet-backdrop"
          />

          <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto pointer-events-none ${className}`.trim()}
            data-testid="mobile-book-action-sheet"
          >
            {/* Centered Floating Action Card with Fluid Scale In/Out Transition */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-sm bg-card text-foreground border border-border rounded-2xl p-5 shadow-2xl z-10 space-y-4 pointer-events-auto my-auto"
              role="dialog"
              aria-modal="true"
              aria-label={`Book actions for ${selectedMobileBook.title}`}
            >
              {/* Top Grab Handle & Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 pr-6">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-primary">
                    {isRestricted ? (
                      <span
                        className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold"
                        data-testid={`mobile-restricted-badge-${selectedMobileBook.id}`}
                      >
                        <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>Protected ({country})</span>
                      </span>
                    ) : isUnavailableOffline ? (
                      <span
                        className="text-amber-600 dark:text-amber-400 flex items-center gap-1 font-semibold"
                        data-testid={`mobile-offline-unavailable-badge-${selectedMobileBook.id}`}
                      >
                        <WifiOff className="w-3 h-3 text-amber-500 shrink-0" />
                        <span>Not Downloaded</span>
                      </span>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        <span>Public Domain</span>
                      </>
                    )}
                    {isOffline && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleOffline?.(selectedMobileBook);
                        }}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5 border border-emerald-500/30 hover:border-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer group/offline"
                        title="Downloaded for offline reading — Click to remove"
                        aria-label={`Downloaded for offline reading. Click to remove ${selectedMobileBook.title} from offline storage.`}
                      >
                        <CheckCircle2 className="w-2.5 h-2.5 shrink-0 group-hover/offline:hidden" />
                        <Trash2 className="w-2.5 h-2.5 shrink-0 hidden group-hover/offline:inline" />
                        <span className="group-hover/offline:hidden">Downloaded</span>
                        <span className="hidden group-hover/offline:inline">Remove</span>
                      </button>
                    )}
                    {readingProgress !== undefined && (
                      <span className="text-muted-foreground ml-1">
                        • {Math.round(readingProgress)}% read
                      </span>
                    )}
                  </div>
                  <div
                    data-testid={`mobile-modal-copy-meta-${selectedMobileBook.id}`}
                    data-copy-book-id={selectedMobileBook.id}
                    data-tooltip={`${selectedMobileBook.title} — by ${formatAuthorNames(selectedMobileBook.authors) || 'Anonymous'}`}
                    onClick={(e) => handleCopyBookLinkClick(e, selectedMobileBook.id)}
                    onKeyDown={(e) => handleCopyBookLinkClick(e, selectedMobileBook.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Copy link to ${selectedMobileBook.title} by ${formatAuthorNames(selectedMobileBook.authors) || 'Anonymous'}`}
                    className="group/copy cursor-pointer rounded-md -mx-1 px-1 py-0.5 hover:bg-muted/60 transition-colors"
                  >
                    <h3 className="font-serif font-bold text-base text-foreground group-hover/copy:text-primary transition-colors line-clamp-4 leading-snug">
                      {selectedMobileBook.title}
                    </h3>
                    <p className="text-xs text-muted-foreground font-sans flex items-center flex-wrap leading-snug mt-0.5">
                      <span className="line-clamp-2">
                        {formatAuthorNames(selectedMobileBook.authors) || 'Anonymous'}
                      </span>
                      <CopyBookLinkIndicator bookId={selectedMobileBook.id} />
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
                  aria-label="Close action sheet"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Regional Copyright Notice Banner if Restricted, or Offline Notice Banner if Not Downloaded */}
              {isRestricted ? (
                <CopyrightNoticeBanner
                  country={country}
                  ruleDescription={ruleDescription}
                  reason={reason}
                  publicDomainYear={publicDomainYear}
                  compact
                  testId="mobile-restricted-notice"
                />
              ) : isUnavailableOffline ? (
                <div
                  data-testid="mobile-offline-unavailable-notice"
                  className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-1"
                >
                  <div className="font-mono font-bold uppercase tracking-wider text-[10px] flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                    <WifiOff className="w-3.5 h-3.5 shrink-0" />
                    <span>Unavailable Offline</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground font-sans leading-relaxed">
                    This volume has not been saved to your device. Reconnect to the internet to read or download it.
                  </p>
                </div>
              ) : null}

              {/* Quick Actions Row */}
              <div className="flex items-center gap-2 pt-1">
                {isRestricted ? (
                  <Button
                    variant="outline"
                    size="md"
                    disabled
                    className="flex-1 font-mono text-xs uppercase tracking-wider font-bold gap-1.5 opacity-60 cursor-not-allowed"
                    title={evaluation?.reason || `Protected by copyright in ${country}`}
                    aria-label={`${selectedMobileBook.title} is restricted in ${country}`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Restricted</span>
                  </Button>
                ) : isUnavailableOffline ? (
                  <Button
                    variant="outline"
                    size="md"
                    disabled
                    className="flex-1 font-mono text-xs uppercase tracking-wider font-bold gap-1.5 opacity-60 cursor-not-allowed"
                    title="Not downloaded for offline reading"
                    aria-label={`Read ${selectedMobileBook.title} (Unavailable offline)`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Offline</span>
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="md"
                    className="flex-1 font-mono text-xs uppercase tracking-wider font-bold gap-1.5"
                    onClick={() => {
                      const target = selectedMobileBook;
                      onClose();
                      useReaderStore.getState().openReader(target);
                      if (onBookClick) onBookClick(target);
                      else router.push(ROUTES.READ(target.id));
                    }}
                    aria-label={`Read ${selectedMobileBook.title}`}
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Read Volume</span>
                  </Button>
                )}

                {isRestricted ? (
                  <button
                    type="button"
                    disabled
                    className="p-2.5 rounded-xl border border-border text-muted-foreground/50 opacity-50 cursor-not-allowed"
                    title={`Offline storage unavailable for protected titles in ${country}`}
                    aria-label={`Offline storage unavailable for ${selectedMobileBook.title}`}
                  >
                    <HardDriveDownload className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isDownloadingOffline || isUnavailableOffline}
                    onClick={() => onToggleOffline?.(selectedMobileBook)}
                    className={`p-2.5 rounded-xl border transition-colors shrink-0 ${
                      isDownloadingOffline
                        ? 'border-primary/40 bg-primary/10 text-primary cursor-wait'
                        : isUnavailableOffline
                        ? 'border-border text-muted-foreground/50 opacity-50 cursor-not-allowed'
                        : isOffline
                        ? 'group/offline-btn border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive cursor-pointer'
                        : 'border-border text-foreground hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer'
                    }`}
                    aria-label={
                      isDownloadingOffline
                        ? 'Downloading for offline reading'
                        : isOffline
                        ? 'Remove offline copy'
                        : 'Save for offline reading'
                    }
                    title={
                      isDownloadingOffline
                        ? 'Saving for offline reading...'
                        : isUnavailableOffline
                        ? 'Connect to the internet to save for offline reading'
                        : isOffline
                        ? 'Offline copy ready (Click to remove)'
                        : 'Save for offline reading'
                    }
                  >
                    {isDownloadingOffline ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : isOffline ? (
                      <>
                        <HardDriveDownload className="w-4 h-4 group-hover/offline-btn:hidden" />
                        <Trash2 className="w-4 h-4 hidden group-hover/offline-btn:inline" />
                      </>
                    ) : (
                      <HardDriveDownload className="w-4 h-4" />
                    )}
                  </button>
                )}

                <button
                  type="button"
                  disabled={isRestricted || isUnavailableOffline}
                  onClick={() => {
                    if (onDownloadClick) onDownloadClick(selectedMobileBook);
                    onClose();
                  }}
                  className={`p-2.5 rounded-xl border border-border transition-colors shrink-0 ${
                    isRestricted || isUnavailableOffline
                      ? 'text-muted-foreground/50 opacity-50 cursor-not-allowed'
                      : 'hover:bg-muted text-foreground cursor-pointer'
                  }`}
                  title={
                    isRestricted
                      ? `Download unavailable in ${country}`
                      : isUnavailableOffline
                      ? 'Connect to the internet to download this volume'
                      : undefined
                  }
                  aria-label={`Download ${selectedMobileBook.title}`}
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (effectiveIsSaved) {
                      setPendingRemoval('bookshelf');
                    } else {
                      handleToggleSave(selectedMobileBook);
                    }
                  }}
                  className={`p-2.5 rounded-xl border transition-colors shrink-0 cursor-pointer ${
                    effectiveIsSaved
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted text-foreground'
                  }`}
                  aria-label={effectiveIsSaved ? 'Remove from bookshelf' : 'Save to bookshelf'}
                >
                  <Library className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (effectiveIsFavorite) {
                      setPendingRemoval('favorite');
                    } else {
                      handleToggleFavorite(selectedMobileBook);
                    }
                  }}
                  className={`p-2.5 rounded-xl border transition-colors shrink-0 cursor-pointer ${
                    effectiveIsFavorite
                      ? 'border-destructive bg-destructive/10 text-destructive'
                      : 'border-border hover:bg-muted text-foreground'
                  }`}
                  aria-label={effectiveIsFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <Heart className={`w-4 h-4 ${effectiveIsFavorite ? 'fill-current' : ''}`} />
                </button>
              </div>

              {/* Personal Curation: Status & Rating */}
              {isCuratable && (
                <div className="pt-3 border-t border-border space-y-2.5" data-testid="mobile-curation-section">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
                      My Rating
                    </span>
                    <StarRating
                      value={currentRating}
                      onChange={(newRating) => setBookRating(selectedMobileBook.id, newRating)}
                      size="sm"
                      aria-label={`Rate ${selectedMobileBook.title}`}
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold block">
                      Reading Status
                    </span>
                    <ReadingStatusSelector
                      status={currentStatus}
                      onChange={(newStatus) => setReadingStatus(selectedMobileBook.id, newStatus)}
                      bookId={selectedMobileBook.id}
                      bookTitle={selectedMobileBook.title}
                      size="sm"
                    />
                  </div>
                </div>
              )}

              {/* Move to Shelf selector for multi-shelf users */}
              {cloudBookshelves.length > 1 && onMoveBookToShelf && (
                <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-muted-foreground">Shelf:</span>
                  <select
                    aria-label={`Move ${selectedMobileBook.title} to shelf`}
                    value={
                      cloudBookshelfItems.find((i) => i.book_id === selectedMobileBook.id)?.bookshelf_id ||
                      defaultShelfId ||
                      currentActiveShelfId ||
                      ''
                    }
                    onChange={async (e) => {
                      const targetShelfId = e.target.value;
                      if (targetShelfId) {
                        await onMoveBookToShelf(selectedMobileBook.id, targetShelfId, userId || '');
                      }
                    }}
                    className="text-base sm:text-xs font-mono bg-card text-foreground border border-border rounded-lg px-2.5 py-1 max-w-[200px] truncate cursor-pointer hover:border-primary transition-colors focus:outline-hidden"
                  >
                    {cloudBookshelves.map((shelf) => (
                      <option key={shelf.id} value={shelf.id}>
                        {shelf.is_default ? 'General (All)' : shelf.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <RemoveCollectionBookModal
                isOpen={pendingRemoval !== null}
                collectionType={pendingRemoval}
                bookTitle={selectedMobileBook.title}
                onClose={() => setPendingRemoval(null)}
                onConfirm={() => {
                  if (pendingRemoval === 'favorite') {
                    handleToggleFavorite(selectedMobileBook);
                  } else if (pendingRemoval === 'bookshelf') {
                    handleToggleSave(selectedMobileBook);
                  }
                  setPendingRemoval(null);
                }}
              />
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
};
