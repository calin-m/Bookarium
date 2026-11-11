'use client';

import React, { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { ReaderTheme } from '@/stores/useReaderStore';

export interface ReaderExitBookmarkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmExitWithoutSaving: () => void;
  onConfirmBookmarkAndExit: () => void;
  bookTitle?: string;
  currentPage: number;
  isUnderThreshold: boolean;
  theme?: ReaderTheme;
  initialReminderEnabled?: boolean;
  onToggleReminder?: (enabled: boolean) => void;
}

export const ReaderExitBookmarkModal: React.FC<ReaderExitBookmarkModalProps> = ({
  isOpen,
  onClose,
  onConfirmExitWithoutSaving,
  onConfirmBookmarkAndExit,
  bookTitle,
  currentPage,
  isUnderThreshold,
  theme: _theme = 'light',
  initialReminderEnabled = true,
  onToggleReminder,
}) => {
  const [dontRemindAgain, setDontRemindAgain] = useState(!initialReminderEnabled);

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked;
    setDontRemindAgain(checked);
    onToggleReminder?.(!checked);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isUnderThreshold ? 'Bookmark this volume?' : 'Bookmark before leaving?'}
      maxWidth="md"
      backdropClassName="bg-transparent backdrop-blur-none"
      className="p-0 overflow-hidden shadow-2xl border border-border"
    >
      <div
        className="p-5 sm:p-6 space-y-4 font-sans text-foreground"
        data-testid="reader-exit-bookmark-modal"
      >
        {/* Narrative Description with Inline Ribbon Badge */}
        <p className="text-sm font-serif text-muted-foreground leading-relaxed">
          {isUnderThreshold ? (
            <>
              You are on <strong>Page {currentPage}</strong>
              {bookTitle ? ` of “${bookTitle}”` : ''}. Leaving now keeps your Bookmarks clean without adding an unread volume. Tap <strong>Bookmark</strong> to pin the margin ribbon (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px] font-semibold align-baseline">
                <Bookmark className="w-3 h-3 fill-current inline" /> Ribbon
              </span>
              ) to line 1 and save it to your collection, or tap <strong>Leave</strong> to exit cleanly.
            </>
          ) : (
            <>
              Your progress is saved at <strong>Page {currentPage}</strong>
              {bookTitle ? ` in “${bookTitle}”` : ''}. Tap <strong>Bookmark</strong> to pin the margin ribbon (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono text-[11px] font-semibold align-baseline">
                <Bookmark className="w-3 h-3 fill-current inline" /> Ribbon
              </span>
              ) to line 1 before closing. Or tap <strong>Leave</strong> to exit while preserving your earlier bookmark, or <strong>Keep Reading</strong> to adjust your ribbon.
            </>
          )}
        </p>

        {/* Action Buttons: Symmetrical 3-Button Grid with Styled Tooltips */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 w-full pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-9 text-xs font-mono uppercase tracking-wider justify-center"
            data-tooltip="Stay in the reader to adjust your bookmark line or keep reading"
            data-testid="keep-reading-btn"
          >
            Keep Reading
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onConfirmExitWithoutSaving}
            className="h-9 text-xs font-mono uppercase tracking-wider justify-center"
            data-tooltip={
              isUnderThreshold
                ? 'Exit without saving progress to your Bookmarks ledger'
                : 'Exit while preserving your existing bookmark as a failsafe'
            }
            data-testid="exit-without-bookmarking-btn"
          >
            Leave
          </Button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={onConfirmBookmarkAndExit}
            className="h-9 text-xs font-mono uppercase tracking-wider font-bold gap-1.5 justify-center shadow-xs"
            data-tooltip={
              isUnderThreshold
                ? 'Save this volume to your shelf with a line 1 bookmark'
                : 'Place a bookmark at the top of this page and exit'
            }
            data-testid="confirm-bookmark-and-exit-btn"
          >
            <Bookmark className="w-3.5 h-3.5 fill-current shrink-0" />
            <span>Bookmark</span>
          </Button>
        </div>

        {/* "Don't Remind Again" Toggle */}
        {onToggleReminder && (
          <div className="pt-3 border-t border-border flex items-center justify-between text-xs font-mono text-muted-foreground">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={dontRemindAgain}
                onChange={handleCheckboxChange}
                data-testid="dont-remind-again-checkbox"
                className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <span>Don&apos;t ask me again when closing</span>
            </label>
          </div>
        )}
      </div>
    </Modal>
  );
};
