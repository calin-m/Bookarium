'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Download, Bookmark, Heart, Sparkles } from 'lucide-react';
import type { GutendexBook } from '@/types/book.types';
import type { Bookshelf, BookshelfItem } from '@/types/database.types';
import { useReaderStore } from '@/stores/useReaderStore';
import { formatAuthorNames } from '@/lib/utils';
import { ROUTES } from '@/config/routes';

export const SPINE_PALETTES = [
  { bg: 'from-[#4a0e17] via-[#5f1320] to-[#2c080e]', text: 'spine-emboss-gold', accent: '#fef08a', name: 'oxblood' },
  { bg: 'from-[#0f1e36] via-[#162b4c] to-[#0a1322]', text: 'spine-emboss-gold', accent: '#fef08a', name: 'imperial-navy' },
  { bg: 'from-[#0d3321] via-[#14472f] to-[#082216]', text: 'spine-emboss-gold', accent: '#86efac', name: 'emerald-leather' },
  { bg: 'from-[#4e2709] via-[#66350f] to-[#301704]', text: 'spine-emboss-gold', accent: '#fde68a', name: 'amber-saddle' },
  { bg: 'from-[#3b1238] via-[#521a4e] to-[#240a22]', text: 'spine-emboss-gold', accent: '#f5d0fe', name: 'royal-plum' },
  { bg: 'from-[#27272a] via-[#3f3f46] to-[#18181b]', text: 'spine-emboss-silver', accent: '#f8fafc', name: 'aged-charcoal' },
  { bg: 'from-[#0d3b38] via-[#134e4a] to-[#082725]', text: 'spine-emboss-silver', accent: '#99f6e4', name: 'dark-teal' },
  { bg: 'from-[#2d1b14] via-[#3d241b] to-[#1a0f0c]', text: 'spine-emboss-gold', accent: '#fef08a', name: 'espresso' },
];

export interface BookshelfSpineProps {
  book: GutendexBook;
  bookIndex: number;
  readingProgress?: number;
  isSaved: boolean;
  isLiked: boolean;
  onToggleSave: (book: GutendexBook) => void;
  onToggleLike: (book: GutendexBook) => void;
  onSpineClick: (book: GutendexBook) => void;
  onBookClick?: (book: GutendexBook) => void;
  onDownloadClick?: (book: GutendexBook) => void;
  cloudBookshelves?: Bookshelf[];
  cloudBookshelfItems?: BookshelfItem[];
  defaultShelfId?: string;
  currentActiveShelfId?: string;
  userId?: string;
  onMoveBookToShelf?: (bookId: number, targetShelfId: string, userId: string) => Promise<boolean | void>;
}

export const BookshelfSpine: React.FC<BookshelfSpineProps> = ({
  book,
  bookIndex,
  readingProgress,
  isSaved,
  isLiked,
  onToggleSave,
  onToggleLike,
  onSpineClick,
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
  const palette = SPINE_PALETTES[(book.id + bookIndex) % SPINE_PALETTES.length];

  // Deterministic height and thickness variation based on book id
  const heightVariance = 235 + ((book.id * 17) % 45); // 235px to 280px
  const widthVariance = 42 + ((book.id * 13) % 18); // 42px to 60px
  const authorName = book.authors[0]
    ? book.authors[0].name.split(',')[0].trim()
    : 'Anonymous';
  const progressPercent = readingProgress !== undefined ? Math.round(readingProgress) : null;

  return (
    <div
      key={book.id}
      className="group relative shrink-0 cursor-pointer select-none transition-all duration-300 hover:z-50 focus:outline-hidden origin-bottom mb-0"
      style={{ height: `${heightVariance}px`, width: `${widthVariance}px` }}
      onClick={() => onSpineClick(book)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSpineClick(book);
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

      {/* Hover Floating Card Preview / Quick Actions (Desktop Hover) */}
      <div className="absolute left-1/2 bottom-full mb-3 -translate-x-1/2 hidden sm:group-hover:flex flex-col w-56 p-3 bg-card rounded-xl shadow-2xl border border-border z-50 text-left pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/10">
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
          {formatAuthorNames(book.authors) || authorName}
        </p>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-border">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              useReaderStore.getState().openReader(book);
              if (onBookClick) onBookClick(book);
              else router.push(ROUTES.READ(book.id));
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
            className="p-1 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Download formats for ${book.title}`}
          >
            <Download className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleSave(book);
            }}
            className={`p-1 rounded-lg border transition-colors ${
              isSaved
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
            aria-label={isSaved ? 'Remove from bookshelf' : 'Save to bookshelf'}
          >
            <Bookmark className={`w-3 h-3 ${isSaved ? 'fill-current' : ''}`} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLike(book);
            }}
            className={`p-1 rounded-lg border transition-colors ${
              isLiked
                ? 'border-destructive bg-destructive/10 text-destructive'
                : 'border-border hover:bg-muted text-muted-foreground hover:text-foreground'
            }`}
            aria-label={isLiked ? 'Unlike book' : 'Like book'}
          >
            <Heart className={`w-3 h-3 ${isLiked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Move to Shelf selector for multi-shelf users */}
        {cloudBookshelves.length > 1 && onMoveBookToShelf && (
          <div className="pt-2 mt-2 border-t border-border flex items-center justify-between gap-1.5" onClick={(e) => e.stopPropagation()}>
            <span className="text-[10px] font-mono text-muted-foreground">Shelf:</span>
            <select
              aria-label={`Move ${book.title} to shelf`}
              value={
                cloudBookshelfItems.find((i) => i.book_id === book.id)?.bookshelf_id ||
                defaultShelfId ||
                currentActiveShelfId ||
                ''
              }
              onChange={async (e) => {
                const targetShelfId = e.target.value;
                if (targetShelfId) {
                  await onMoveBookToShelf(book.id, targetShelfId, userId || '');
                }
              }}
              className="text-[10px] font-mono bg-card text-foreground border border-border rounded px-1.5 py-0.5 max-w-[130px] truncate cursor-pointer hover:border-primary transition-colors focus:outline-hidden"
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
};
