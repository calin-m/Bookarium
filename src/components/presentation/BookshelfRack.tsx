'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Download, Bookmark, Heart, Sparkles, Plus, Edit2, Trash2, X } from 'lucide-react';
import type { GutendexBook } from '@/mocks/handlers';
import { useHydratedBookshelf } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export interface BookshelfRackProps {
  books: GutendexBook[];
  onBookClick?: (book: GutendexBook) => void;
  onDownloadClick?: (book: GutendexBook) => void;
  onBrowseCatalog?: () => void;
}

// Preset palette of classic library leather & cloth binding colors
const SPINE_PALETTES = [
  { bg: 'from-[#4a0e17] via-[#5f1320] to-[#2c080e]', text: 'spine-emboss-gold', accent: '#fef08a', name: 'oxblood' },
  { bg: 'from-[#0f1e36] via-[#162b4c] to-[#0a1322]', text: 'spine-emboss-gold', accent: '#fef08a', name: 'imperial-navy' },
  { bg: 'from-[#0d3321] via-[#14472f] to-[#082216]', text: 'spine-emboss-gold', accent: '#86efac', name: 'emerald-leather' },
  { bg: 'from-[#4e2709] via-[#66350f] to-[#301704]', text: 'spine-emboss-gold', accent: '#fde68a', name: 'amber-saddle' },
  { bg: 'from-[#3b1238] via-[#521a4e] to-[#240a22]', text: 'spine-emboss-gold', accent: '#f5d0fe', name: 'royal-plum' },
  { bg: 'from-[#27272a] via-[#3f3f46] to-[#18181b]', text: 'spine-emboss-silver', accent: '#f8fafc', name: 'aged-charcoal' },
  { bg: 'from-[#0d3b38] via-[#134e4a] to-[#082725]', text: 'spine-emboss-silver', accent: '#99f6e4', name: 'dark-teal' },
  { bg: 'from-[#2d1b14] via-[#3d241b] to-[#1a0f0c]', text: 'spine-emboss-gold', accent: '#fef08a', name: 'espresso' },
];

export const BookshelfRack: React.FC<BookshelfRackProps> = ({
  books,
  onBookClick,
  onDownloadClick,
  onBrowseCatalog,
}) => {
  const router = useRouter();
  const {
    isSaved: checkIsSaved,
    isLiked: checkIsLiked,
    toggleSaveBook: toggleSave,
    toggleLikeBook: toggleLike,
    cloudBookshelves,
    cloudBookshelfItems,
    activeBookshelfId,
    setActiveBookshelfId,
    createCloudBookshelf,
    updateCloudBookshelf,
    deleteCloudBookshelf,
    moveBookToShelf,
    isSyncing,
  } = useHydratedBookshelf();
  const readingProgress = useReaderStore((s) => s.readingProgress);
  const { user, openAuthModal } = useAuthStore();

  const [isCreatingShelf, setIsCreatingShelf] = useState(false);
  const [newShelfName, setNewShelfName] = useState('');
  const [editingShelfId, setEditingShelfId] = useState<string | null>(null);
  const [editingShelfName, setEditingShelfName] = useState('');
  const [deletingShelfId, setDeletingShelfId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newShelfName.trim()) return;

    setIsSubmitting(true);
    try {
      await createCloudBookshelf(newShelfName.trim(), user.id);
      setIsCreatingShelf(false);
      setNewShelfName('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRenameShelf = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingShelfId || !editingShelfName.trim()) return;

    setIsSubmitting(true);
    try {
      await updateCloudBookshelf(editingShelfId, editingShelfName.trim(), user.id);
      setEditingShelfId(null);
      setEditingShelfName('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteShelf = async () => {
    if (!user || !deletingShelfId) return;

    setIsSubmitting(true);
    try {
      await deleteCloudBookshelf(deletingShelfId, user.id);
      setDeletingShelfId(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const defaultShelf = cloudBookshelves.find((s) => s.is_default) || cloudBookshelves[0];
  const currentActiveShelfId = activeBookshelfId || defaultShelf?.id;
  const isViewingGeneral = defaultShelf ? currentActiveShelfId === defaultShelf.id : true;

  // On the 'General' master shelf, show all books across all collections.
  // On custom shelves, filter to only the books assigned to that shelf.
  const effectiveShelfBooks = useMemo(() => {
    if (cloudBookshelves.length <= 1 || isViewingGeneral) {
      return books;
    }

    const currentShelfBookIds = new Set(
      cloudBookshelfItems
        .filter((item) => item.bookshelf_id === currentActiveShelfId)
        .map((item) => item.book_id)
    );
    return books.filter((b) => currentShelfBookIds.has(b.id));
  }, [cloudBookshelves.length, isViewingGeneral, cloudBookshelfItems, currentActiveShelfId, books]);

  // Chunk books into shelves of up to 8 books
  const SHELF_SIZE = 8;
  const shelves: GutendexBook[][] = [];
  for (let i = 0; i < effectiveShelfBooks.length; i += SHELF_SIZE) {
    shelves.push(effectiveShelfBooks.slice(i, i + SHELF_SIZE));
  }

  const activeShelf = cloudBookshelves.find((s) => s.id === currentActiveShelfId) || defaultShelf;
  const activeShelfDisplayName = activeShelf?.is_default ? 'General' : (activeShelf?.name || 'General');

  return (
    <div className="w-full space-y-8 py-6" data-testid="bookshelf-rack">
      {/* Cloud Bookshelf Header & Multi-Shelf Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-2">
        <div className="flex items-center gap-2 flex-wrap">
          {user && cloudBookshelves.length > 0 ? (
            <>
              {cloudBookshelves.map((shelf) => {
                const isActive = (activeBookshelfId === shelf.id) || (!activeBookshelfId && shelf.is_default);
                const shelfDisplayName = shelf.is_default ? 'General' : shelf.name;
                return (
                  <button
                    key={shelf.id}
                    type="button"
                    onClick={() => setActiveBookshelfId(shelf.id)}
                    className={`px-3 py-1 text-xs font-mono rounded-lg border transition-all cursor-pointer ${
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary font-bold shadow-xs'
                        : 'bg-card text-foreground border-border hover:border-primary'
                    }`}
                  >
                    {shelfDisplayName}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setIsCreatingShelf(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded-lg border border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary transition-all cursor-pointer"
                aria-label="Create New Shelf"
              >
                <Plus className="w-3 h-3" />
                <span>New Shelf</span>
              </button>
            </>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                <Bookmark className="w-3.5 h-3.5 text-primary" />
                <span>General Shelf ({books.length} volumes)</span>
              </div>
              <button
                type="button"
                onClick={() => (user ? setIsCreatingShelf(true) : openAuthModal('sign_in'))}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded-lg border border-dashed border-border hover:border-primary text-muted-foreground hover:text-primary transition-all cursor-pointer"
                aria-label="Create New Shelf"
              >
                <Plus className="w-3 h-3" />
                <span>New Shelf</span>
              </button>
            </div>
          )}
        </div>

        {/* Right Toolbar Controls: Active Shelf Actions & Sync Status */}
        <div className="flex items-center gap-3">
          {/* Active Shelf Actions (Rename / Delete) */}
          {user && activeShelf && !activeShelf.is_default && (
            <div className="flex items-center gap-1.5 border-r border-border pr-3">
              <button
                type="button"
                onClick={() => {
                  setEditingShelfId(activeShelf.id);
                  setEditingShelfName(activeShelf.name);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded-md border border-border bg-card hover:border-primary text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                aria-label={`Rename ${activeShelf.name}`}
              >
                <Edit2 className="w-3 h-3 text-primary" />
                <span>Rename</span>
              </button>
              <button
                type="button"
                onClick={() => setDeletingShelfId(activeShelf.id)}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-mono rounded-md border border-border bg-card hover:border-destructive text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                aria-label={`Delete ${activeShelf.name}`}
              >
                <Trash2 className="w-3 h-3 text-destructive" />
                <span>Delete</span>
              </button>
            </div>
          )}

          {/* Sync Status Badge */}
          {user ? (
            <div className="inline-flex items-center gap-1.5 text-[11px] font-mono text-success">
              <Sparkles className="w-3 h-3" />
              <span>{isSyncing ? 'Syncing...' : 'Cloud Synced'}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('sign_in')}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              <span>Guest Mode (Local)</span>
              <span className="text-primary font-bold">• Sign in to Sync</span>
            </button>
          )}
        </div>
      </div>

      {/* Empty Shelf State */}
      {effectiveShelfBooks.length === 0 ? (
        <div className="py-16 text-center text-muted-foreground font-sans space-y-3 bg-card rounded-2xl border border-border p-8">
          <BookOpen className="w-8 h-8 text-primary mx-auto opacity-70" />
          <p className="text-base font-medium text-foreground">
            No books found on &quot;{activeShelfDisplayName}&quot;.
          </p>
          <p className="text-xs font-mono text-muted-foreground">
            {user ? 'Save books from the catalog to build this collection.' : 'Saved books are stored locally in your browser.'}
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            <Button
              variant="outline"
              size="chip"
              onClick={() => {
                if (onBrowseCatalog) {
                  onBrowseCatalog();
                } else {
                  if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    url.searchParams.delete('view');
                    window.history.pushState(null, '', url.pathname + (url.search ? url.search : ''));
                    window.dispatchEvent(new Event('popstate'));
                  }
                  router.push('/');
                }
              }}
            >
              Browse Catalog
            </Button>
            {!user && (
              <Button
                variant="primary"
                size="chip"
                onClick={() => openAuthModal('sign_in')}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sign In to Sync</span>
              </Button>
            )}
          </div>
        </div>
      ) : (
        shelves.map((shelfBooks, shelfIndex) => (
          <div key={`shelf-${shelfIndex}-${shelfBooks[0]?.id || 0}`} className="relative z-10 hover:z-30 w-full mb-8">
            {/* Unified Shelf Niche & Hardwood Rail Module */}
            <div className="relative w-full rounded-2xl border border-border shelf-ambient-niche shadow-md overflow-hidden sm:overflow-visible">
              
              {/* Shelf Items Row */}
              <div className="flex items-end justify-start sm:justify-center gap-2 sm:gap-3.5 overflow-x-auto sm:overflow-visible scrollbar-none pt-10 px-3 sm:px-6 touch-pan-x snap-x relative z-10">
                {shelfBooks.map((book, bookIndex) => {
                  const palette = SPINE_PALETTES[(book.id + bookIndex) % SPINE_PALETTES.length];
                  
                  // Deterministic height and thickness variation based on book id
                  const heightVariance = 235 + ((book.id * 17) % 45); // 235px to 280px
                  const widthVariance = 42 + ((book.id * 13) % 18); // 42px to 60px
                  const authorName = book.authors[0]
                    ? book.authors[0].name.split(',')[0].trim()
                    : 'Anonymous';
                  const rawProgress = readingProgress[book.id];
                  const progressPercent = rawProgress !== undefined ? Math.round(rawProgress) : null;
                  const bookSaved = checkIsSaved(book.id);
                  const bookLiked = checkIsLiked(book.id);

                  return (
                    <div
                      key={book.id}
                      className="group relative shrink-0 cursor-pointer select-none transition-all duration-300 hover:z-50 focus:outline-hidden origin-bottom mb-0"
                      style={{ height: `${heightVariance}px`, width: `${widthVariance}px` }}
                      onClick={() => {
                        if (onBookClick) onBookClick(book);
                        else router.push(`/read/${book.id}`);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          if (onBookClick) onBookClick(book);
                          else router.push(`/read/${book.id}`);
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-label={`Read ${book.title} by ${authorName}`}
                      data-testid={`shelf-book-${book.id}`}
                    >
                      {/* Classic Hardcover Spine */}
                      <div
                        className={`relative w-full h-full rounded-t-sm bg-gradient-to-r ${palette.bg} shadow-md origin-bottom group-hover:shadow-[0_16px_32px_-6px_rgba(0,0,0,0.65)] group-hover:scale-105 transition-all duration-300 ease-out flex flex-col justify-between p-2 sm:p-2.5 border-t border-white/25 overflow-hidden`}
                      >
                        {/* Convex 3D Specular Lighting Overlay */}
                        <div className="absolute inset-0 rounded-t-sm book-spine-convex pointer-events-none z-10" />

                        {/* Headcap Gilded Rule */}
                        <div className="w-full h-0.5 border-t border-b border-white/20 mb-1 shrink-0 z-20" />

                        {/* Vertical Foil Title */}
                        <div className="flex-1 flex flex-col items-center justify-center overflow-hidden my-1 z-20">
                          <span
                            className={`font-serif text-xs sm:text-[13px] font-bold tracking-widest [writing-mode:vertical-rl] rotate-180 line-clamp-1 max-h-[150px] truncate ${palette.text}`}
                          >
                            {book.title}
                          </span>
                        </div>

                        {/* Tailcap Author & Seal */}
                        <div className="w-full flex flex-col items-center gap-1 border-t border-white/20 pt-1.5 shrink-0 z-20">
                          <span className="font-serif text-[9px] uppercase tracking-wider text-slate-200/90 [writing-mode:vertical-rl] rotate-180 line-clamp-1 max-h-[45px]">
                            {authorName}
                          </span>
                          <div className="w-2 h-2 rounded-full border border-white/40 flex items-center justify-center">
                            <div className="w-0.5 h-0.5 rounded-full bg-white/70 shadow-xs" />
                          </div>
                        </div>
                      </div>

                      {/* Hover Floating Card Preview / Quick Actions */}
                      <div className="absolute left-1/2 bottom-full mb-3 -translate-x-1/2 hidden group-hover:flex flex-col w-56 p-3 bg-card rounded-xl shadow-2xl border border-border z-50 text-left pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/10">
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <span className="text-[10px] uppercase font-mono tracking-wider text-primary flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> Public Domain
                          </span>
                          {progressPercent !== null && (
                            <span className="text-[10px] font-medium text-muted-foreground">
                              {progressPercent}% read
                            </span>
                          )}
                        </div>

                        <h4 className="font-serif font-bold text-foreground text-xs line-clamp-2 leading-tight mb-1">
                          {book.title}
                        </h4>
                        <p className="text-[11px] text-muted-foreground mb-2 truncate">
                          {authorName}
                        </p>

                        {/* Quick Action Buttons */}
                        <div className="flex items-center gap-1.5 pt-2 border-t border-border">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              useReaderStore.getState().openReader(book);
                              if (onBookClick) onBookClick(book);
                              else router.push(`/read/${book.id}`);
                            }}
                            className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-[11px] font-medium transition-opacity"
                            aria-label={`Open reader for ${book.title}`}
                          >
                            <BookOpen className="w-3 h-3" />
                            <span>Read</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onDownloadClick) onDownloadClick(book);
                            }}
                            className="p-1 rounded-lg border border-border hover:bg-muted text-foreground transition-colors"
                            aria-label={`Download formats for ${book.title}`}
                          >
                            <Download className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSave(book);
                            }}
                            className={`p-1 rounded-lg border transition-colors ${
                              bookSaved
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:bg-muted text-foreground'
                            }`}
                            aria-label={bookSaved ? 'Remove from bookshelf' : 'Save to bookshelf'}
                          >
                            <Bookmark className={`w-3 h-3 ${bookSaved ? 'fill-current' : ''}`} />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLike(book);
                            }}
                            className={`p-1 rounded-lg border transition-colors ${
                              bookLiked
                                ? 'border-destructive bg-destructive/10 text-destructive'
                                : 'border-border hover:bg-muted text-foreground'
                            }`}
                            aria-label={bookLiked ? 'Unlike book' : 'Like book'}
                          >
                            <Heart className={`w-3 h-3 ${bookLiked ? 'fill-current' : ''}`} />
                          </button>
                        </div>

                        {/* Move to Shelf selector for multi-shelf users */}
                        {cloudBookshelves.length > 1 && (
                          <div className="pt-2 mt-2 border-t border-border flex items-center justify-between gap-1.5">
                            <span className="text-[10px] font-mono text-muted-foreground">Shelf:</span>
                            <select
                              aria-label={`Move ${book.title} to shelf`}
                              value={
                                cloudBookshelfItems.find((i) => i.book_id === book.id)?.bookshelf_id ||
                                defaultShelf?.id ||
                                currentActiveShelfId ||
                                ''
                              }
                              onChange={async (e) => {
                                e.stopPropagation();
                                const targetShelfId = e.target.value;
                                if (targetShelfId) {
                                  await moveBookToShelf(book.id, targetShelfId, user?.id || '');
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="text-[10px] font-mono bg-card text-foreground border border-border rounded px-1.5 py-0.5 max-w-[130px] truncate cursor-pointer hover:border-primary transition-colors focus:outline-none"
                            >
                              {cloudBookshelves.map((shelf) => (
                                <option key={shelf.id} value={shelf.id}>
                                  {shelf.is_default ? 'General (All)' : shelf.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Hardwood Shelf Plank Base */}
              <div className="shelf-wood-ledge w-full h-5 rounded-b-2xl relative z-20 border-t border-black/30 shadow-md" />
            </div>
          </div>
        )))}

      {/* Create Shelf Modal */}
      {isCreatingShelf && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-transparent animate-in fade-in">
          <div
            className="fixed inset-0 bg-transparent cursor-default"
            onClick={() => {
              setIsCreatingShelf(false);
              setNewShelfName('');
            }}
          />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4 ring-1 ring-black/10 dark:ring-white/10 z-10 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-sm font-mono font-bold text-foreground">
                <BookOpen className="w-4 h-4 text-primary" />
                <span>Create New Bookshelf</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingShelf(false);
                  setNewShelfName('');
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateShelf} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="shelf-name-input" className="text-xs font-mono text-foreground font-bold">
                  Shelf Name
                </label>
                <Input
                  id="shelf-name-input"
                  type="text"
                  value={newShelfName}
                  onChange={(e) => setNewShelfName(e.target.value)}
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
                  onClick={() => {
                    setIsCreatingShelf(false);
                    setNewShelfName('');
                  }}
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
            onClick={() => {
              setEditingShelfId(null);
              setEditingShelfName('');
            }}
          />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4 ring-1 ring-black/10 dark:ring-white/10 z-10 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-sm font-mono font-bold text-foreground">
                <Edit2 className="w-4 h-4 text-primary" />
                <span>Rename Bookshelf</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingShelfId(null);
                  setEditingShelfName('');
                }}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRenameShelf} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="rename-shelf-input" className="text-xs font-mono text-foreground font-bold">
                  Shelf Name
                </label>
                <Input
                  id="rename-shelf-input"
                  type="text"
                  value={editingShelfName}
                  onChange={(e) => setEditingShelfName(e.target.value)}
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
                  onClick={() => {
                    setEditingShelfId(null);
                    setEditingShelfName('');
                  }}
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
            onClick={() => setDeletingShelfId(null)}
          />
          <div className="relative w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4 ring-1 ring-black/10 dark:ring-white/10 z-10 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2 text-sm font-mono font-bold text-destructive">
                <Trash2 className="w-4 h-4 text-destructive" />
                <span>Delete Bookshelf</span>
              </div>
              <button
                type="button"
                onClick={() => setDeletingShelfId(null)}
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
                onClick={() => setDeletingShelfId(null)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="chip"
                isLoading={isSubmitting}
                onClick={handleDeleteShelf}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Shelf
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
