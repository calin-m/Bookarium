'use client';

import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { QuoteDeletePreview } from './QuoteDeletePreview';

export interface DeleteAnnotationTarget {
  selectedText: string;
  note?: string | null;
}

export interface DeleteAnnotationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  annotation: DeleteAnnotationTarget | null;
  title?: string;
  description?: string;
}

/**
 * Reusable modal for confirming the deletion of a saved annotation,
 * rendering the quote preview, warning iconography, and destructive action controls.
 */
export const DeleteAnnotationModal: React.FC<DeleteAnnotationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  annotation,
  title = 'Delete Saved Note & Highlight?',
  description = 'This will remove this highlight and any attached personal reflection from your library. This action cannot be undone.',
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="md"
    >
      <div className="p-6 space-y-5" data-testid="delete-single-note-dialog">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <p className="font-semibold text-foreground text-sm sm:text-base">
              Are you sure you want to delete this saved quote?
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
            {annotation && (
              <QuoteDeletePreview
                selectedText={annotation.selectedText}
                note={annotation.note}
              />
            )}
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
            onClick={onConfirm}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent text-xs font-mono uppercase gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Note
          </Button>
        </div>
      </div>
    </Modal>
  );
};

