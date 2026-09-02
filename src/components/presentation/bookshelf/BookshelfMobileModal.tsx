'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Download, Bookmark, Heart, Sparkles, X } from 'lucide-react';
import type { GutendexBook } from '@/mocks/handlers';
import type { Bookshelf, BookshelfItem } from '@/types/database.types';
import { useReaderStore } from '@/stores/useReaderStore';
import { Button } from '@/components/ui/Button';
import { formatAuthorNames } from '@/lib/utils';
import { ROUTES } from '@/config/routes';

export interface BookshelfMobileModalProps {
  selectedMobileBook: GutendexBook | null;
  isClosingMobileSheet?: boolean;
  onClose: () => void;
  readingProgress?: number;
  isSaved: boolean;
  isLiked: boolean;
  onToggleSave: (book: GutendexBook) => void;
  onToggleLike: (book: GutendexBook) => void;
  onBookClick?: (book: GutendexBook) => void;
  onDownloadClick?: (book: GutendexBook) => void;
  cloudBookshelves?: Bookshelf[];
  cloudBookshelfItems?: BookshelfItem[];
  defaultShelfId?: string;
  currentActiveShelfId?: string;
  userId?: string;
  onMoveBookToShelf?: (bookId: number, targetShelfId: string, userId: string) => Promise<boolean | void>;
}

export const BookshelfMobileModal: React.FC<BookshelfMobileModalProps> = ({
  selectedMobileBook,
  onClose,
  readingProgress,
  isSaved,
  isLiked,
  onToggleSave,
  onToggleLike,
  onBookClick,
  onDownloadClick,
  cloudBookshelves = [],
  cloudBookshelfItems = [],
  defaultShelfId,
  currentActiveShelfId,
  userId,
  onMoveBookToShelf,
}) => {
  const router = useRouter();

  return (
    <AnimatePresence>
      {selectedMobileBook && (
        <>
          {/* Transparent Backdrop to capture outside taps without dimming */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-transparent z-40 sm:hidden cursor-pointer"
            onClick={onClose}
            aria-hidden="true"
            data-testid="mobile-sheet-backdrop"
          />

          <div
            className="absolute inset-0 z-50 flex items-center justify-center p-4 sm:hidden pointer-events-none"
            data-testid="mobile-book-action-sheet"
          >
            {/* Centered Floating Action Card with Fluid Scale In/Out Transition */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-5 shadow-2xl z-10 space-y-4 pointer-events-auto"
              role="dialog"
              aria-modal="true"
              aria-label={`Book actions for ${selectedMobileBook.title}`}
            >
              {/* Top Grab Handle & Header */}
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1 pr-6">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-primary">
                    <Sparkles className="w-3 h-3" />
                    <span>Public Domain</span>
                    {readingProgress !== undefined && (
                      <span className="text-muted-foreground ml-1">
                        • {Math.round(readingProgress)}% read
                      </span>
                    )}
                  </div>
                  <h3 className="font-serif font-bold text-base text-foreground line-clamp-2 leading-snug">
                    {selectedMobileBook.title}
                  </h3>
                  <p className="text-xs text-muted-foreground font-sans truncate">
                    {formatAuthorNames(selectedMobileBook.authors) || 'Anonymous'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0 cursor-pointer"
                  aria-label="Close action sheet"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Quick Actions Row */}
              <div className="flex items-center gap-2 pt-1">
                <Button
                  variant="primary"
                  size="md"
                  className="flex-1 font-mono text-xs uppercase tracking-wider font-bold gap-1.5"
                  onClick={() => {
                    const target = selectedMobileBook;
                    onClose();
                    useReaderStore.getState().openReader(target);
                    if (onBookClick) onBookClick(target);
                    else router.push(ROUTES.READ(target.id));
                  }}
                  aria-label={`Read ${selectedMobileBook.title}`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Read Volume</span>
                </Button>

                <button
                  type="button"
                  onClick={() => {
                    if (onDownloadClick) onDownloadClick(selectedMobileBook);
                    onClose();
                  }}
                  className="p-2.5 rounded-xl border border-border hover:bg-muted text-foreground transition-colors shrink-0 cursor-pointer"
                  aria-label={`Download ${selectedMobileBook.title}`}
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => onToggleSave(selectedMobileBook)}
                  className={`p-2.5 rounded-xl border transition-colors shrink-0 cursor-pointer ${
                    isSaved
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted text-foreground'
                  }`}
                  aria-label={isSaved ? 'Remove from bookshelf' : 'Save to bookshelf'}
                >
                  <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={() => onToggleLike(selectedMobileBook)}
                  className={`p-2.5 rounded-xl border transition-colors shrink-0 cursor-pointer ${
                    isLiked
                      ? 'border-destructive bg-destructive/10 text-destructive'
                      : 'border-border hover:bg-muted text-foreground'
                  }`}
                  aria-label={isLiked ? 'Unlike book' : 'Like book'}
                >
                  <Heart className={`w-4 h-4 ${isLiked ? 'fill-current' : ''}`} />
                </button>
              </div>

              {/* Move to Shelf selector for multi-shelf users */}
              {cloudBookshelves.length > 1 && onMoveBookToShelf && (
                <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                  <span className="text-xs font-mono text-muted-foreground">Shelf:</span>
                  <select
                    aria-label={`Move ${selectedMobileBook.title} to shelf`}
                    value={
                      cloudBookshelfItems.find((i) => i.book_id === selectedMobileBook.id)?.bookshelf_id ||
                      defaultShelfId ||
                      currentActiveShelfId ||
                      ''
                    }
                    onChange={async (e) => {
                      const targetShelfId = e.target.value;
                      if (targetShelfId) {
                        await onMoveBookToShelf(selectedMobileBook.id, targetShelfId, userId || '');
                      }
                    }}
                    className="text-xs font-mono bg-card text-foreground border border-border rounded-lg px-2.5 py-1 max-w-[200px] truncate cursor-pointer hover:border-primary transition-colors focus:outline-hidden"
                  >
                    {cloudBookshelves.map((shelf) => (
                      <option key={shelf.id} value={shelf.id}>
                        {shelf.is_default ? 'General (All)' : shelf.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
