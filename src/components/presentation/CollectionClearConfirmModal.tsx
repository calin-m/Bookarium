'use client';

import React from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export interface CollectionClearConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  heading: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void> | void;
}

/**
 * Confirmation modal for clearing the user's personal Bookshelf, custom shelf,
 * Downloaded shelf, or Favorites collection.
 */
export const CollectionClearConfirmModal: React.FC<
  CollectionClearConfirmModalProps
> = ({
  isOpen,
  onClose,
  title,
  heading,
  description,
  confirmLabel,
  onConfirm,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="md"
      backdropClassName="bg-transparent backdrop-blur-none"
    >
      <div className="p-6 space-y-5" data-testid="clear-confirmation-dialog">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <p className="font-semibold text-foreground text-sm sm:text-base">
              {heading}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs font-mono uppercase"
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent text-xs font-mono uppercase gap-1.5"
            onClick={onConfirm}
          >
            <Trash2 className="w-3.5 h-3.5" />
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
