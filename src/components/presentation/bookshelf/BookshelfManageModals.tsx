'use client';

import React from 'react';
import { BookOpen, Edit2, Trash2, X, Globe, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

export interface BookshelfManageModalsProps {
  isCreatingShelf: boolean;
  newShelfName: string;
  newShelfIsPublic?: boolean;
  onNewShelfNameChange: (name: string) => void;
  onNewShelfIsPublicChange?: (isPublic: boolean) => void;
  onCloseCreateShelf: () => void;
  onCreateShelf: (e: React.FormEvent) => void;
  editingShelfId: string | null;
  editingShelfName: string;
  editingShelfIsPublic?: boolean;
  onEditingShelfNameChange: (name: string) => void;
  onEditingShelfIsPublicChange?: (isPublic: boolean) => void;
  onCloseRenameShelf: () => void;
  onRenameShelf: (e: React.FormEvent) => void;
  deletingShelfId: string | null;
  onCloseDeleteShelf: () => void;
  onDeleteShelf: () => void;
  isClearingOfflineShelf?: boolean;
  onCloseClearOfflineShelf?: () => void;
  onConfirmClearOfflineShelf?: () => void;
  isSubmitting: boolean;
}

export const BookshelfManageModals: React.FC<BookshelfManageModalsProps> = ({
  isCreatingShelf,
  newShelfName,
  newShelfIsPublic = true,
  onNewShelfNameChange,
  onNewShelfIsPublicChange,
  onCloseCreateShelf,
  onCreateShelf,
  editingShelfId,
  editingShelfName,
  editingShelfIsPublic = true,
  onEditingShelfNameChange,
  onEditingShelfIsPublicChange,
  onCloseRenameShelf,
  onRenameShelf,
  deletingShelfId,
  onCloseDeleteShelf,
  onDeleteShelf,
  isClearingOfflineShelf = false,
  onCloseClearOfflineShelf,
  onConfirmClearOfflineShelf,
  isSubmitting,
}) => {
  return (
    <>
      {/* Create Shelf Modal */}
      <Modal
        isOpen={isCreatingShelf}
        onClose={onCloseCreateShelf}
        maxWidth="sm"
        showCloseButton={false}
        className="p-6 space-y-4 ring-1 ring-black/10 dark:ring-white/10"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-sm font-mono font-bold text-foreground">
            <BookOpen className="w-4 h-4 text-primary" />
            <span>Create New Bookshelf</span>
          </div>
          <button
            type="button"
            onClick={onCloseCreateShelf}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onCreateShelf} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="shelf-name-input" className="text-xs font-mono text-foreground font-bold">
              Shelf Name
            </label>
            <Input
              id="shelf-name-input"
              type="text"
              value={newShelfName}
              onChange={(e) => onNewShelfNameChange(e.target.value)}
              placeholder="e.g. Philosophy & Logic"
              className="text-xs font-mono"
              autoFocus
              required
            />
          </div>

          <div className="pt-2 border-t border-border">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={newShelfIsPublic}
                onChange={(e) => onNewShelfIsPublicChange?.(e.target.checked)}
                className="mt-0.5 rounded border-border text-primary focus:ring-primary/20"
              />
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs font-mono font-bold text-foreground flex items-center gap-1.5">
                  {newShelfIsPublic ? (
                    <>
                      <Globe className="w-3.5 h-3.5 text-success" />
                      <span>Public Shelf</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Private Shelf</span>
                    </>
                  )}
                </span>
                <p className="text-[11px] text-muted-foreground font-sans leading-tight">
                  {newShelfIsPublic
                    ? 'Visible on your public scholar profile when custom shelves are enabled.'
                    : 'Private to you only. Never visible to visitors on your public profile.'}
                </p>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="chip"
              onClick={onCloseCreateShelf}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="chip"
              isLoading={isSubmitting}
              disabled={!newShelfName.trim()}
            >
              Create Shelf
            </Button>
          </div>
        </form>
      </Modal>

      {/* Rename Shelf Modal */}
      <Modal
        isOpen={Boolean(editingShelfId)}
        onClose={onCloseRenameShelf}
        maxWidth="sm"
        showCloseButton={false}
        className="p-6 space-y-4 ring-1 ring-black/10 dark:ring-white/10"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-sm font-mono font-bold text-foreground">
            <Edit2 className="w-4 h-4 text-primary" />
            <span>Rename Bookshelf</span>
          </div>
          <button
            type="button"
            onClick={onCloseRenameShelf}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onRenameShelf} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="edit-shelf-name-input" className="text-xs font-mono text-foreground font-bold">
              New Shelf Name
            </label>
            <Input
              id="edit-shelf-name-input"
              type="text"
              value={editingShelfName}
              onChange={(e) => onEditingShelfNameChange(e.target.value)}
              placeholder="Shelf Name"
              className="text-xs font-mono"
              autoFocus
              required
            />
          </div>

          <div className="pt-2 border-t border-border">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={editingShelfIsPublic}
                onChange={(e) => onEditingShelfIsPublicChange?.(e.target.checked)}
                className="mt-0.5 rounded border-border text-primary focus:ring-primary/20"
              />
              <div className="space-y-0.5 min-w-0">
                <span className="text-xs font-mono font-bold text-foreground flex items-center gap-1.5">
                  {editingShelfIsPublic ? (
                    <>
                      <Globe className="w-3.5 h-3.5 text-success" />
                      <span>Public Shelf</span>
                    </>
                  ) : (
                    <>
                      <Lock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Private Shelf</span>
                    </>
                  )}
                </span>
                <p className="text-[11px] text-muted-foreground font-sans leading-tight">
                  {editingShelfIsPublic
                    ? 'Visible on your public scholar profile when custom shelves are enabled.'
                    : 'Private to you only. Never visible to visitors on your public profile.'}
                </p>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="chip"
              onClick={onCloseRenameShelf}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="chip"
              isLoading={isSubmitting}
              disabled={!editingShelfName.trim()}
            >
              Save
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Shelf Modal */}
      <Modal
        isOpen={Boolean(deletingShelfId)}
        onClose={onCloseDeleteShelf}
        maxWidth="sm"
        showCloseButton={false}
        className="p-6 space-y-4 ring-1 ring-black/10 dark:ring-white/10"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-sm font-mono font-bold text-destructive">
            <Trash2 className="w-4 h-4 text-destructive" />
            <span>Delete Bookshelf</span>
          </div>
          <button
            type="button"
            onClick={onCloseDeleteShelf}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed font-sans">
          Are you sure you want to delete this custom shelf? All books on this shelf will be removed from this collection.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="chip"
            onClick={onCloseDeleteShelf}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="chip"
            isLoading={isSubmitting}
            onClick={onDeleteShelf}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete Shelf
          </Button>
        </div>
      </Modal>

      {/* Clear Offline Shelf Modal */}
      <Modal
        isOpen={isClearingOfflineShelf}
        onClose={onCloseClearOfflineShelf || (() => {})}
        testId="clear-offline-shelf-modal"
        maxWidth="sm"
        showCloseButton={false}
        backdropClassName="bg-transparent backdrop-blur-none"
        className="p-6 space-y-4 ring-1 ring-black/10 dark:ring-white/10"
      >
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2 text-sm font-mono font-bold text-destructive">
            <Trash2 className="w-4 h-4 text-destructive" />
            <span>Clear Offline Shelf</span>
          </div>
          <button
            type="button"
            onClick={onCloseClearOfflineShelf}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed font-sans">
          Are you sure you want to remove all offline downloads for this shelf? You can always download them again whenever you are online.
        </p>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="chip"
            onClick={onCloseClearOfflineShelf}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="chip"
            isLoading={isSubmitting}
            onClick={onConfirmClearOfflineShelf}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Clear Offline Downloads
          </Button>
        </div>
      </Modal>
    </>
  );
};
