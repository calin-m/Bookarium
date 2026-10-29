'use client';

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { BookOpen, CheckCircle2, PauseCircle, Clock, Trash2, Bookmark as BookmarkIcon, RotateCcw, Lock, AlertTriangle, Handshake, HardDriveDownload, Loader2, WifiOff, Heart, Library } from 'lucide-react';
import type { ActiveReadingVolume, LedgerItemStatus, GutendexBook, Book } from '@/types/book.types';
import { Button } from '@/components/ui/Button';
import { RemoveCollectionBookModal, type CollectionRemovalType } from '@/components/ui/RemoveCollectionBookModal';
import { ROUTES } from '@/config/routes';
import { useReaderStore } from '@/stores/useReaderStore';
import { useBookshelfStore, useIsBookSaved, useIsBookFavorite } from '@/stores/useBookshelfStore';
import { toGutendexBook } from '@/lib/adapters/book.adapter';
import { useBookCopyright } from '@/hooks/useBookCopyright';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { formatAuthorNames, formatRelativeTime } from '@/lib/utils';

const SymposiumInviteModal = dynamic(
  () => import('@/components/symposium/SymposiumInviteModal').then((mod) => mod.SymposiumInviteModal),
  { ssr: false }
);

export interface BookmarkCardProps {
  volume: ActiveReadingVolume;
  isOffline?: boolean;
  isDownloadingOffline?: boolean;
  isActive?: boolean;
  onActivate?: (bookId: number) => void;
  onDeactivate?: (bookId: number) => void;
  onToggleOffline?: (book: GutendexBook | Book) => void;
  onResume?: (bookId: number) => void;
  onStatusChange?: (bookId: number, status: LedgerItemStatus) => void;
  onClear?: (bookId: number) => void;
}

export const BookmarkCard: React.FC<BookmarkCardProps> = ({
  volume,
  isOffline,
  isDownloadingOffline = false,
  isActive = false,
  onActivate,
  onDeactivate,
  onToggleOffline,
  onResume,
  onStatusChange,
  onClear,
}) => {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const [isSymposiumModalOpen, setIsSymposiumModalOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<CollectionRemovalType | null>(null);
  const { book, progressPercent, chapterIndex, globalPage, bookmarkRow, lastReadAt, status } = volume;
  const roundedProgress = Math.min(100, Math.max(0, Math.round(progressPercent)));

  const { country, evaluation, isRestricted } = useBookCopyright(book);
  const { isOffline: isNetworkOffline } = useNetworkStatus();
  const isUnavailableOffline = isNetworkOffline && !isOffline;
  const isSaved = useIsBookSaved(book.id);
  const isFavorite = useIsBookFavorite(book.id);
  const toggleSaveBook = useBookshelfStore((s) => s.toggleSaveBook);
  const toggleFavoriteBook = useBookshelfStore((s) => s.toggleFavoriteBook);

  const handleResume = () => {
    if (isRestricted || isUnavailableOffline) return;
    useReaderStore.getState().openReader(book);
    if (onResume) {
      onResume(book.id);
    } else {
      router.push(ROUTES.READ(book.id));
    }
  };

  const statusBadges: Record<LedgerItemStatus, { label: string; className: string; icon: React.ReactNode }> = {
    in_progress: {
      label: 'In Progress',
      className: 'bg-primary/10 text-primary border-border',
      icon: <Clock className="w-3 h-3 shrink-0" />,
    },
    completed: {
      label: 'Completed',
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 sepia:text-emerald-400 border-emerald-500/30',
      icon: <CheckCircle2 className="w-3 h-3 shrink-0" />,
    },
    on_hold: {
      label: 'On Hold',
      className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 sepia:text-amber-400 border-amber-500/30',
      icon: <PauseCircle className="w-3 h-3 shrink-0" />,
    },
  };

  const currentBadge = statusBadges[status] || statusBadges.in_progress;

  return (
    <article
      onClick={() => onActivate?.(book.id)}
      onMouseLeave={() => {
        if (typeof window === 'undefined' || window.innerWidth >= 768) {
          onDeactivate?.(book.id);
        }
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          onDeactivate?.(book.id);
        }
      }}
      data-bookmark-card-id={book.id}
      data-active={isActive ? 'true' : 'false'}
      className={`group relative bg-card rounded-xl border transition-all duration-300 p-5 flex flex-col justify-between overflow-hidden ${
        isActive
          ? 'border-primary/50 ring-2 ring-primary/50 shadow-booksaw-hover'
          : 'border-border shadow-booksaw hover:shadow-booksaw-hover'
      }`}
      aria-label={`Reading ledger entry for ${book.title}`}
    >
      {/* Authentic Notched Bookmark Ribbon Marker */}
      <svg
        data-testid="bookmark-card-ribbon"
        viewBox="0 0 16 28"
        className={`absolute top-0 right-7 w-4 h-7 drop-shadow-2xs origin-top transition-transform duration-300 group-hover:scale-y-110 pointer-events-none ${
          status === 'completed'
            ? 'text-emerald-500'
            : status === 'on_hold'
            ? 'text-amber-500'
            : 'text-primary'
        }`}
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M0 0 H16 V28 L8 22 L0 28 Z" />
        <path d="M0 0 H16 V2 H0 Z" fill="black" fillOpacity="0.15" />
      </svg>

      <div className="space-y-4">
        {/* Top Meta: Cover + Title + Authors */}
        <div className="flex items-start gap-4">
          <div
            data-testid="bookmark-card-cover"
            className={`group/cover relative w-16 h-24 shrink-0 rounded overflow-hidden bg-muted border border-border shadow-2xs select-none ${
              isRestricted || isUnavailableOffline ? 'cursor-not-allowed' : ''
            }`}
          >
            {book.coverUrl && !imageError ? (
              <img
                src={book.coverUrl}
                alt={`Cover of ${book.title}`}
                loading="lazy"
                onError={() => setImageError(true)}
                className={`w-full h-full object-cover transition-transform duration-300 ${
                  isRestricted || isUnavailableOffline
                    ? 'opacity-65 grayscale-[35%]'
                    : 'group-hover/cover:scale-105'
                }`}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-gradient-to-br from-primary-900/10 to-primary-800/20 text-center">
                <BookmarkIcon className="w-5 h-5 text-primary-500/60 mb-1" />
                <span className="text-[9px] font-mono uppercase text-muted-foreground line-clamp-2">
                  {book.title}
                </span>
              </div>
            )}
            {isRestricted ? (
              <div
                className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center"
                title={evaluation.reason || `Protected by copyright in ${country}`}
              >
                <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 sepia:text-amber-400 shadow-xs">
                  <Lock className="w-3.5 h-3.5" />
                </div>
              </div>
            ) : isUnavailableOffline ? (
              <div
                className="absolute inset-0 bg-background/50 backdrop-blur-[1px] flex items-center justify-center"
                title="Not downloaded for offline reading"
                data-testid={`bookmark-card-offline-overlay-${book.id}`}
              >
                <div className="w-7 h-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-600 dark:text-amber-400 sepia:text-amber-400 shadow-xs">
                  <WifiOff className="w-3.5 h-3.5" />
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1.5 pr-10">
              <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider font-semibold border ${currentBadge.className}`}
                >
                  {currentBadge.icon}
                  <span>{currentBadge.label}</span>
                </span>
                {isRestricted ? (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 sepia:text-amber-400 border border-amber-500/30"
                    title={evaluation.reason || `Protected by copyright in ${country}`}
                    aria-label={`Protected in ${country}`}
                  >
                    <Lock className="w-2.5 h-2.5 shrink-0" />
                    <span>Protected ({country})</span>
                  </span>
                ) : isUnavailableOffline ? (
                  <span
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 sepia:text-amber-400 border border-amber-500/30"
                    title="Not downloaded for offline reading"
                    aria-label="Not downloaded for offline reading"
                    data-testid={`bookmark-card-unavailable-offline-badge-${book.id}`}
                  >
                    <WifiOff className="w-2.5 h-2.5 shrink-0" />
                    <span>Not Downloaded</span>
                  </span>
                ) : null}
              </div>

              <div
                className="flex items-center gap-2 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="w-8 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (isFavorite) {
                        setPendingRemoval('favorite');
                      } else {
                        toggleFavoriteBook(toGutendexBook(book));
                      }
                    }}
                    aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                    data-testid="bookmark-card-favorite-btn"
                    className={`relative h-6 w-6 rounded-full border flex items-center justify-center transition-all duration-200 cursor-pointer touch-manipulation after:absolute after:-inset-1 after:content-[''] ${
                      isFavorite
                        ? 'bg-destructive border-destructive text-destructive-foreground shadow-2xs'
                        : 'bg-background border-border text-muted-foreground hover:text-destructive hover:border-destructive/40'
                    }`}
                  >
                    <Heart className={`w-3 h-3 ${isFavorite ? 'fill-current' : ''}`} />
                  </button>
                </div>
                <div className="w-8 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (isSaved) {
                        setPendingRemoval('bookshelf');
                      } else {
                        toggleSaveBook(toGutendexBook(book));
                      }
                    }}
                    aria-label={isSaved ? 'Remove from bookshelf' : 'Save to bookshelf'}
                    title={isSaved ? 'Remove from bookshelf' : 'Save to bookshelf'}
                    data-testid="bookmark-card-bookshelf-btn"
                    className={`relative h-6 w-6 rounded-full border flex items-center justify-center transition-all duration-200 cursor-pointer touch-manipulation after:absolute after:-inset-1 after:content-[''] ${
                      isSaved
                        ? 'bg-primary border-primary text-primary-foreground shadow-2xs'
                        : 'bg-background border-border text-muted-foreground hover:text-primary hover:border-primary/40'
                    }`}
                  >
                    <Library className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <h3 className="font-serif font-bold text-base text-foreground leading-snug line-clamp-2 transition-colors pr-4">
              {isRestricted || isUnavailableOffline ? (
                <span
                  className="cursor-not-allowed opacity-85"
                  title={
                    isRestricted
                      ? evaluation.reason || `Protected by copyright in ${country}`
                      : 'Not downloaded for offline reading'
                  }
                >
                  {book.title}
                </span>
              ) : (
                <span
                  className={isActive ? 'text-primary' : 'group-hover:text-primary'}
                >
                  {book.title}
                </span>
              )}
            </h3>

            <p className="font-sans text-xs text-muted-foreground truncate mt-1 pr-4">
              {formatAuthorNames(book.authors) || 'Anonymous'}
            </p>
          </div>
        </div>

        {/* Reading Progress & Coordinates */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-bold text-foreground">{roundedProgress}%</span>
          </div>

          {/* Accessible Progress Bar */}
          <div
            role="progressbar"
            aria-valuenow={roundedProgress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${book.title} reading progress`}
            className="w-full h-2 rounded-full bg-muted overflow-hidden"
          >
            <div
              className={`h-full transition-all duration-500 ${
                status === 'completed'
                  ? 'bg-emerald-500'
                  : status === 'on_hold'
                  ? 'bg-amber-500'
                  : 'bg-primary'
              }`}
              style={{ width: `${roundedProgress}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground pt-1">
            <span>
              {chapterIndex > 0 ? `Chapter ${chapterIndex}` : 'Start'} • Page {globalPage || 1}
              {bookmarkRow && bookmarkRow > 0 ? ` • Line ${bookmarkRow + 1}` : ''}
            </span>
            <span>{formatRelativeTime(lastReadAt)}</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center gap-2 pt-5 mt-4 border-t border-border">
        {isRestricted ? (
          <Button
            variant="outline"
            size="sm"
            disabled
            className="flex-1 gap-1.5 font-mono text-xs uppercase tracking-wider font-bold opacity-60 cursor-not-allowed border-amber-500/40 text-amber-700 dark:text-amber-400 sepia:text-amber-400"
            aria-label={`Reading restricted for ${book.title} in ${country}`}
            title={evaluation.reason || `Protected by copyright in ${country}`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Restricted</span>
          </Button>
        ) : isUnavailableOffline ? (
          <Button
            variant="outline"
            size="sm"
            disabled
            className="flex-1 gap-1.5 font-mono text-xs uppercase tracking-wider font-bold opacity-60 cursor-not-allowed"
            aria-label={`Resume reading ${book.title} (Unavailable offline)`}
            title="Not downloaded for offline reading"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Offline</span>
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            onClick={handleResume}
            aria-label={
              status === 'completed'
                ? `Read ${book.title} again from beginning`
                : `Resume reading ${book.title}`
            }
            className="flex-1 gap-1.5 font-mono text-xs uppercase tracking-wider font-bold"
          >
            {status === 'completed' ? (
              <>
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Read Again</span>
              </>
            ) : (
              <>
                <BookOpen className="w-3.5 h-3.5" />
                <span>Resume</span>
              </>
            )}
          </Button>
        )}

        {onStatusChange && (
          <select
            value={status}
            onChange={(e) => onStatusChange(book.id, e.target.value as LedgerItemStatus)}
            aria-label={`Change reading status for ${book.title}`}
            className="h-8 px-2 rounded border border-border bg-background text-foreground font-mono text-base sm:text-xs max-w-[110px] truncate focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="in_progress">Reading</option>
            <option value="completed">Finished</option>
            <option value="on_hold">On Hold</option>
          </select>
        )}

        {!isRestricted && onToggleOffline && (
          <button
            type="button"
            disabled={isDownloadingOffline || isUnavailableOffline}
            onClick={() => onToggleOffline(book)}
            data-testid="bookmark-card-offline-toggle-btn"
            aria-label={
              isDownloadingOffline
                ? `Downloading ${book.title} for offline reading`
                : isOffline
                ? `Remove offline copy of ${book.title}`
                : `Save ${book.title} for offline reading`
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
            className={`h-8 w-8 flex items-center justify-center rounded border transition-colors shrink-0 ${
              isDownloadingOffline
                ? 'border-primary/40 bg-primary/10 text-primary cursor-wait'
                : isUnavailableOffline
                ? 'border-border bg-background text-muted-foreground/50 opacity-50 cursor-not-allowed'
                : isOffline
                ? 'group/offline-btn border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:border-destructive/60 hover:bg-destructive/10 hover:text-destructive cursor-pointer'
                : 'border-border bg-background text-muted-foreground hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer'
            }`}
          >
            {isDownloadingOffline ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : isOffline ? (
              <>
                <HardDriveDownload className="w-3.5 h-3.5 group-hover/offline-btn:hidden" />
                <Trash2 className="w-3.5 h-3.5 hidden group-hover/offline-btn:inline" />
              </>
            ) : (
              <HardDriveDownload className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        {!isRestricted && (
          <button
            type="button"
            disabled={isNetworkOffline}
            onClick={() => setIsSymposiumModalOpen(true)}
            data-testid="bookmark-card-invite-symposium-btn"
            aria-label={`Invite Fellow to Symposium on ${book.title}`}
            title={isNetworkOffline ? 'Connect to the internet to invite a Fellow' : 'Invite Fellow to Symposium'}
            className={`h-8 w-8 flex items-center justify-center rounded border border-border bg-background text-muted-foreground transition-colors shrink-0 ${
              isNetworkOffline
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:text-primary hover:border-primary/40 hover:bg-primary/5 cursor-pointer'
            }`}
          >
            <Handshake className="w-3.5 h-3.5" />
          </button>
        )}

        {onClear && (
          <button
            type="button"
            onClick={() => onClear(book.id)}
            aria-label={`Remove ${book.title} from reading ledger`}
            title="Remove from Ledger"
            className="h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {isSymposiumModalOpen && (
        <SymposiumInviteModal
          isOpen={isSymposiumModalOpen}
          onClose={() => setIsSymposiumModalOpen(false)}
          bookId={book.id}
          bookTitle={book.title}
        />
      )}

      <RemoveCollectionBookModal
        isOpen={pendingRemoval !== null}
        collectionType={pendingRemoval}
        bookTitle={book.title}
        onClose={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (pendingRemoval === 'favorite') {
            toggleFavoriteBook(toGutendexBook(book));
          } else if (pendingRemoval === 'bookshelf') {
            toggleSaveBook(toGutendexBook(book));
          }
          setPendingRemoval(null);
        }}
      />
    </article>
  );
};

