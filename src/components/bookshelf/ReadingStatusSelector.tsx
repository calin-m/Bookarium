'use client';

import React, { useState } from 'react';
import { Bookmark, BookOpen, CheckCircle2, X } from 'lucide-react';
import type { ReadingStatus } from '@/types/book.types';
import { useReaderStore } from '@/stores/useReaderStore';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface ReadingStatusSelectorProps {
  status: ReadingStatus | null;
  onChange: (status: ReadingStatus | null) => void;
  bookId?: number;
  bookTitle?: string;
  size?: 'sm' | 'md';
  showClear?: boolean;
  className?: string;
}

interface StatusOption {
  id: ReadingStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  activeClasses: string;
}

const STATUS_OPTIONS: StatusOption[] = [
  {
    id: 'want_to_read',
    label: 'Want to Read',
    icon: Bookmark,
    activeClasses: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40 font-bold shadow-sm',
  },
  {
    id: 'currently_reading',
    label: 'Currently Reading',
    icon: BookOpen,
    activeClasses: 'bg-primary-500/15 text-primary-700 dark:text-primary-400 border-primary-500/40 font-bold shadow-sm',
  },
  {
    id: 'finished',
    label: 'Finished',
    icon: CheckCircle2,
    activeClasses: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 font-bold shadow-sm',
  },
];

export const ReadingStatusSelector: React.FC<ReadingStatusSelectorProps> = ({
  status,
  onChange,
  bookId,
  bookTitle,
  size = 'md',
  showClear = true,
  className = '',
}) => {
  const isSm = size === 'sm';
  const [isFinishConfirmOpen, setIsFinishConfirmOpen] = useState(false);

  const activePosition = bookId ? useReaderStore.getState().readingPositions[bookId] : undefined;
  const activeProgress = bookId ? (useReaderStore.getState().readingProgress[bookId] ?? 0) : 0;
  const hasPlacedBookmark =
    Boolean(activePosition?.bookmarkRow && activePosition.bookmarkRow > 0) ||
    Boolean(activePosition?.bookmarkText);

  const handleToggleStatus = (targetStatus: ReadingStatus) => {
    if (status === targetStatus) {
      onChange(null); // Click active status to clear
    } else if (targetStatus === 'finished' && bookId && hasPlacedBookmark) {
      setIsFinishConfirmOpen(true);
    } else {
      onChange(targetStatus);
    }
  };

  return (
    <div
      className={`inline-flex flex-wrap items-center gap-1.5 ${className}`}
      role="group"
      aria-label="Reading status selector"
    >
      {STATUS_OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const isActive = status === opt.id;

        return (
          <React.Fragment key={opt.id}>
            <button
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={opt.label}
              onClick={() => handleToggleStatus(opt.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isSm ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-xs sm:text-sm'
              } ${
                isActive
                  ? opt.activeClasses
                  : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/80 hover:text-foreground hover:border-primary/40'
              }`}
            >
              <Icon className={`${isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} shrink-0 ${isActive ? 'fill-current' : ''}`} />
              <span>{opt.label}</span>
            </button>

            {showClear && isActive && (
              <button
                type="button"
                onClick={() => onChange(null)}
                aria-label="Clear reading status"
                title="Clear reading status"
                className={`inline-flex items-center justify-center rounded-lg border border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer ${
                  isSm ? 'p-1' : 'p-1.5'
                }`}
              >
                <X className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
              </button>
            )}
          </React.Fragment>
        );
      })}

      <Modal
        isOpen={isFinishConfirmOpen}
        onClose={() => setIsFinishConfirmOpen(false)}
        title="Mark as Finished"
        maxWidth="sm"
        backdropClassName="bg-transparent backdrop-blur-none"
      >
        <div className="p-6 space-y-4" data-testid="finish-status-bookmark-dialog">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 sepia:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-1.5">
              <p className="font-semibold text-foreground text-sm">
                Mark {bookTitle ? `“${bookTitle}”` : 'this volume'} as finished?
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This will advance your recorded reading progress from{' '}
                <strong className="font-semibold text-foreground">
                  {Math.round(activeProgress)}%
                </strong>{' '}
                to <strong className="font-semibold text-foreground">100%</strong> and mark the volume as completed.
              </p>
              <div
                data-testid="finish-status-bookmark-reset-notice"
                className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300 sepia:text-amber-400"
              >
                <Bookmark className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>
                  Your placed bookmark
                  {activePosition?.bookmarkRow && activePosition.bookmarkRow > 0
                    ? ` on Line ${activePosition.bookmarkRow + 1} (Page ${activePosition.globalPage || 1})`
                    : ''}{' '}
                  will also be reset.
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="chip"
              onClick={() => setIsFinishConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="chip"
              onClick={() => {
                setIsFinishConfirmOpen(false);
                onChange('finished');
              }}
            >
              Mark as Finished
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

