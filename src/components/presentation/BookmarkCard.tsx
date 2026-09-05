'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, CheckCircle2, PauseCircle, Clock, Trash2, Bookmark as BookmarkIcon } from 'lucide-react';
import type { ActiveReadingVolume, LedgerItemStatus } from '@/types/book.types';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { useReaderStore } from '@/stores/useReaderStore';
import { formatAuthorNames, formatRelativeTime } from '@/lib/utils';

export interface BookmarkCardProps {
  volume: ActiveReadingVolume;
  isOffline?: boolean;
  onResume?: (bookId: number) => void;
  onStatusChange?: (bookId: number, status: LedgerItemStatus) => void;
  onClear?: (bookId: number) => void;
}

export const BookmarkCard: React.FC<BookmarkCardProps> = ({
  volume,
  isOffline,
  onResume,
  onStatusChange,
  onClear,
}) => {
  const router = useRouter();
  const [imageError, setImageError] = useState(false);
  const { book, progressPercent, chapterIndex, globalPage, lastReadAt, status } = volume;
  const roundedProgress = Math.min(100, Math.max(0, Math.round(progressPercent)));

  const handleResume = () => {
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
      className="group relative bg-card rounded-xl border border-border shadow-booksaw hover:shadow-booksaw-hover transition-all duration-300 p-5 flex flex-col justify-between overflow-hidden"
      aria-label={`Reading ledger entry for ${book.title}`}
    >
      {/* Decorative Ribbon Accent */}
      <div
        className={`absolute top-0 right-6 w-3 h-6 rounded-b-sm shadow-2xs transition-colors ${
          status === 'completed'
            ? 'bg-emerald-500'
            : status === 'on_hold'
            ? 'bg-amber-500'
            : 'bg-primary'
        }`}
        aria-hidden="true"
      />

      <div className="space-y-4">
        {/* Top Meta: Cover + Title + Authors */}
        <div className="flex items-start gap-4">
          <div
            role="button"
            tabIndex={0}
            onClick={handleResume}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleResume();
              }
            }}
            aria-label={`Resume reading ${book.title} (cover)`}
            className="group/cover relative w-16 h-24 shrink-0 rounded overflow-hidden bg-muted border border-border shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          >
            {book.coverUrl && !imageError ? (
              <img
                src={book.coverUrl}
                alt={`Cover of ${book.title}`}
                loading="lazy"
                onError={() => setImageError(true)}
                className="w-full h-full object-cover group-hover/cover:scale-105 transition-transform duration-300"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-gradient-to-br from-primary-900/10 to-primary-800/20 text-center">
                <BookmarkIcon className="w-5 h-5 text-primary-500/60 mb-1" />
                <span className="text-[9px] font-mono uppercase text-muted-foreground line-clamp-2">
                  {book.title}
                </span>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 pr-4">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono uppercase tracking-wider font-semibold border ${currentBadge.className}`}
              >
                {currentBadge.icon}
                <span>{currentBadge.label}</span>
              </span>
              {isOffline && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 sepia:text-emerald-400 border border-emerald-500/30"
                  title="Downloaded for offline reading"
                  aria-label="Available offline"
                >
                  <CheckCircle2 className="w-2.5 h-2.5 shrink-0" />
                  <span>Offline</span>
                </span>
              )}
            </div>

            <h3 className="font-serif font-bold text-base text-foreground leading-snug line-clamp-2 group-hover:text-primary transition-colors">
              <Link href={ROUTES.READ(book.id)}>{book.title}</Link>
            </h3>

            <p className="font-sans text-xs text-muted-foreground truncate mt-1">
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
            </span>
            <span>{formatRelativeTime(lastReadAt)}</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center gap-2 pt-5 mt-4 border-t border-border">
        <Button
          variant="primary"
          size="sm"
          onClick={handleResume}
          aria-label={`Resume reading ${book.title}`}
          className="flex-1 gap-1.5 font-mono text-xs uppercase tracking-wider font-bold"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Resume</span>
        </Button>

        {onStatusChange && (
          <select
            value={status}
            onChange={(e) => onStatusChange(book.id, e.target.value as LedgerItemStatus)}
            aria-label={`Change reading status for ${book.title}`}
            className="h-8 px-2 rounded border border-border bg-background text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
          >
            <option value="in_progress">Reading</option>
            <option value="completed">Finished</option>
            <option value="on_hold">On Hold</option>
          </select>
        )}

        {onClear && (
          <button
            type="button"
            onClick={() => onClear(book.id)}
            aria-label={`Remove ${book.title} from reading ledger`}
            title="Remove from Ledger"
            className="h-8 w-8 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </article>
  );
};

