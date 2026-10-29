'use client';

import React from 'react';
import { Heart, Library } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

export type CollectionRemovalType = 'favorite' | 'bookshelf';

export interface RemoveCollectionBookModalProps {
  isOpen: boolean;
  collectionType: CollectionRemovalType | null;
  bookTitle?: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export const RemoveCollectionBookModal: React.FC<RemoveCollectionBookModalProps> = ({
  isOpen,
  collectionType,
  bookTitle,
  onClose,
  onConfirm,
}) => {
  const isFavoriteRemoval = collectionType === 'favorite';
  const titleLabel = bookTitle ? `“${bookTitle}”` : 'this volume';

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Modal
        isOpen={isOpen && collectionType !== null}
        onClose={onClose}
        title={isFavoriteRemoval ? 'Remove from Favorites' : 'Remove from Bookshelf'}
        maxWidth="sm"
        backdropClassName="bg-transparent backdrop-blur-none"
        testId={isFavoriteRemoval ? 'remove-favorite-modal' : 'remove-bookshelf-modal'}
      >
        <div
          className="p-6 space-y-4"
          data-testid={isFavoriteRemoval ? 'remove-favorite-dialog' : 'remove-bookshelf-dialog'}
        >
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
              {isFavoriteRemoval ? (
                <Heart className="w-5 h-5" />
              ) : (
                <Library className="w-5 h-5" />
              )}
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground text-sm">
                {isFavoriteRemoval
                  ? `Remove ${titleLabel} from favorites?`
                  : `Remove ${titleLabel} from your bookshelf?`}
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {isFavoriteRemoval
                  ? 'This will remove this volume from your Favorites collection. Your bookshelf curation, reading progress, bookmarks, and notes will remain untouched.'
                  : 'This will remove this volume from your Bookshelf collection. Your favorites, reading progress, bookmarks, and notes will remain untouched.'}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="chip"
              data-testid="cancel-remove-collection-btn"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="chip"
              data-testid="confirm-remove-collection-btn"
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent"
              onClick={onConfirm}
            >
              {isFavoriteRemoval ? 'Remove Favorite' : 'Remove from Shelf'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
