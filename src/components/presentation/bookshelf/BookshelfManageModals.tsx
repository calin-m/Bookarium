'use client';

import React from 'react';
import { BookOpen, Edit2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export interface BookshelfManageModalsProps {
  isCreatingShelf: boolean;
  newShelfName: string;
  onNewShelfNameChange: (name: string) => void;
  onCloseCreateShelf: () => void;
  onCreateShelf: (e: React.FormEvent) => void;
  editingShelfId: string | null;
  editingShelfName: string;
  onEditingShelfNameChange: (name: string) => void;
  onCloseRenameShelf: () => void;
  onRenameShelf: (e: React.FormEvent) => void;
  deletingShelfId: string | null;
  onCloseDeleteShelf: () => void;
  onDeleteShelf: () => void;
  isSubmitting: boolean;
}

export const BookshelfManageModals: React.FC<BookshelfManageModalsProps> = ({
  isCreatingShelf,
  newShelfName,
  onNewShelfNameChange,
  onCloseCreateShelf,
  onCreateShelf,
  editingShelfId,
  editingShelfName,
  onEditingShelfNameChange,
  onCloseRenameShelf,
  onRenameShelf,
  deletingShelfId,
  onCloseDeleteShelf,
  onDeleteShelf,
  isSubmitting,
}) => {
  return (
    <>
      {/* Create Shelf Modal */}
      {isCreatingShelf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent animate-in fade-in">
          <div
            className="fixed inset-0 bg-transparent cursor-default"
            onClick={onCloseCreateShelf}
          />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4 ring-1 ring-black/10 dark:ring-white/10 z-10 animate-in zoom-in-95 duration-150">
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
          </div>
        </div>
      )}

      {/* Rename Shelf Modal */}
      {editingShelfId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent animate-in fade-in">
          <div
            className="fixed inset-0 bg-transparent cursor-default"
            onClick={onCloseRenameShelf}
          />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4 ring-1 ring-black/10 dark:ring-white/10 z-10 animate-in zoom-in-95 duration-150">
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
          </div>
        </div>
      )}

      {/* Delete Shelf Modal */}
      {deletingShelfId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent animate-in fade-in">
          <div
            className="fixed inset-0 bg-transparent cursor-default"
            onClick={onCloseDeleteShelf}
          />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4 ring-1 ring-black/10 dark:ring-white/10 z-10 animate-in zoom-in-95 duration-150">
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
          </div>
        </div>
      )}
    </>
  );
};
