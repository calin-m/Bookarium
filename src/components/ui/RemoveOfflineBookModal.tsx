'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface RemoveOfflineBookModalProps {
  isOpen: boolean;
  bookTitle?: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
}

export const RemoveOfflineBookModal: React.FC<RemoveOfflineBookModalProps> = ({
  isOpen,
  bookTitle,
  onClose,
  onConfirm,
  isLoading = false,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Remove Downloaded Copy"
      maxWidth="sm"
      backdropClassName="bg-transparent backdrop-blur-none"
      testId="remove-offline-book-modal"
    >
      <div className="p-6 space-y-4" data-testid="remove-offline-book-dialog">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
            <Trash2 className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground text-sm">
              Remove {bookTitle ? `“${bookTitle}”` : 'this volume'} from offline storage?
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This will remove the downloaded text from this device to free up storage space. Your bookshelf curation, favorites, bookmarks, and notes will remain untouched. You can re-download this volume at any time.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="chip"
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="chip"
            isLoading={isLoading}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent"
            onClick={onConfirm}
          >
            Remove Download
          </Button>
        </div>
      </div>
    </Modal>
  );
};

