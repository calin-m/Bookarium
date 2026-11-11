'use client';

import React from 'react';
import { Trophy } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { StarRating } from '@/components/ui/StarRating';

export interface VolumeCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookTitle: string;
  bookRating: number | null;
  onRateChange: (rating: number | null) => void;
  onOpenBookshelf: () => void;
}

/**
 * End-of-book completion celebration modal displaying a trophy badge,
 * inline star rating selector, and quick navigation to the user's Bookshelf.
 */
export const VolumeCompletionModal: React.FC<
  VolumeCompletionModalProps
> = ({
  isOpen,
  onClose,
  bookTitle,
  bookRating,
  onRateChange,
  onOpenBookshelf,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Volume Finished!"
      maxWidth="md"
    >
      <div
        className="p-6 space-y-5 text-center"
        data-testid="volume-completion-modal"
      >
        <div className="mx-auto w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
          <Trophy className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h3 className="font-serif font-bold text-lg text-foreground">
            Congratulations!
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
            You have completed reading{' '}
            <span className="font-semibold text-foreground">
              &ldquo;{bookTitle}&rdquo;
            </span>
            . Your reading status has been updated to{' '}
            <span className="font-mono text-emerald-500 font-medium">
              Finished
            </span>
            .
          </p>
        </div>

        <div className="pt-2 pb-1 space-y-2 flex flex-col items-center">
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground font-semibold">
            Leave a Rating
          </span>
          <StarRating
            value={bookRating}
            onChange={onRateChange}
            size="lg"
            showLabel
            aria-label={`Rate ${bookTitle}`}
          />
        </div>

        <div className="flex items-center justify-center gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenBookshelf}
            className="text-xs font-mono uppercase"
          >
            My Bookshelf
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={onClose}
            className="text-xs font-mono uppercase"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
