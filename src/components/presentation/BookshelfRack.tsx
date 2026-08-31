'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Download, Bookmark, Heart, Sparkles } from 'lucide-react';
import type { GutendexBook } from '@/mocks/handlers';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';

export interface BookshelfRackProps {
  books: GutendexBook[];
  onBookClick?: (book: GutendexBook) => void;
  onDownloadClick?: (book: GutendexBook) => void;
}

// Preset palette of modern studio spine colors
const SPINE_PALETTES = [
  { bg: 'from-[#334155] to-[#1e293b]', text: 'spine-emboss-silver', accent: '#94a3b8', name: 'slate' },
  { bg: 'from-[#c2410c] to-[#7c2d12]', text: 'spine-emboss-gold', accent: '#fed7aa', name: 'terracotta' },
  { bg: 'from-[#1e3a8a] to-[#0f172a]', text: 'spine-emboss-silver', accent: '#93c5fd', name: 'navy' },
  { bg: 'from-[#14532d] to-[#052e16]', text: 'spine-emboss-gold', accent: '#86efac', name: 'forest' },
  { bg: 'from-[#78350f] to-[#451a03]', text: 'spine-emboss-gold', accent: '#fde68a', name: 'amber' },
  { bg: 'from-[#3f3f46] to-[#18181b]', text: 'spine-emboss-silver', accent: '#e4e4e7', name: 'zinc' },
  { bg: 'from-[#701a75] to-[#4a044e]', text: 'spine-emboss-gold', accent: '#f5d0fe', name: 'fuchsia' },
  { bg: 'from-[#0f766e] to-[#134e4a]', text: 'spine-emboss-silver', accent: '#99f6e4', name: 'teal' },
];

export const BookshelfRack: React.FC<BookshelfRackProps> = ({
  books,
  onBookClick,
  onDownloadClick,
}) => {
  const router = useRouter();
  const isSaved = useBookshelfStore((s) => s.isBookSaved);
  const toggleSave = useBookshelfStore((s) => s.toggleSaveBook);
  const isLiked = useBookshelfStore((s) => s.isBookLiked);
  const toggleLike = useBookshelfStore((s) => s.toggleLikeBook);
  const getProgress = useReaderStore((s) => s.getProgress);

  if (books.length === 0) {
    return (
      <div className="py-16 text-center text-slate-400 font-sans">
        <p className="text-base">No books found on this shelf.</p>
      </div>
    );
  }

  // Chunk books into shelves of up to 8 books
  const SHELF_SIZE = 8;
  const shelves: GutendexBook[][] = [];
  for (let i = 0; i < books.length; i += SHELF_SIZE) {
    shelves.push(books.slice(i, i + SHELF_SIZE));
  }

  return (
    <div className="w-full space-y-12 py-6" data-testid="bookshelf-rack">
      {shelves.map((shelfBooks, shelfIndex) => (
        <div key={shelfIndex} className="relative z-10 hover:z-30">
          {/* Back wall of the shelf niche */}
          <div className="relative bg-card rounded-t-2xl p-4 sm:p-6 pb-0 border-x border-t border-border shadow-inner overflow-visible">
            
            {/* Shelf Items Row */}
            <div className="flex items-end justify-start sm:justify-center gap-2 sm:gap-3.5 overflow-visible pb-1 pt-12 min-h-[310px] px-2">
              {shelfBooks.map((book, bookIndex) => {
                const palette = SPINE_PALETTES[(book.id + bookIndex) % SPINE_PALETTES.length];
                
                // Deterministic height and thickness variation based on book id
                const heightVariance = 240 + ((book.id * 17) % 55); // 240px to 295px
                const widthVariance = 42 + ((book.id * 13) % 20); // 42px to 62px
                const authorName = book.authors[0]
                  ? book.authors[0].name.split(',')[0].trim()
                  : 'Anonymous';
                const progress = getProgress(book.id);
                const bookSaved = isSaved(book.id);
                const bookLiked = isLiked(book.id);

                return (
                  <div
                    key={book.id}
                    className="group relative shrink-0 cursor-pointer select-none transition-all duration-300 hover:z-50 focus:outline-hidden"
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
                    {/* Bookmark Ribbon Hanging Out Top */}
                    {bookSaved && (
                      <div className="absolute -top-3 right-2 w-3 h-5 bg-primary rounded-t-sm shadow-xs z-20 transition-transform group-hover:-translate-y-1" />
                    )}

                    {/* Modern Vertical Spine */}
                    <div
                      className={`relative w-full h-full rounded-t-md bg-gradient-to-r ${palette.bg} shadow-modern-sm group-hover:shadow-modern-hover group-hover:-translate-y-3.5 group-hover:scale-[1.02] transition-all duration-300 flex flex-col justify-between p-2 border-t border-x border-white/15 overflow-hidden`}
                    >
                      {/* Spine Top Line Accent */}
                      <div className="w-full h-1.5 border-y border-white/20 my-1" />

                      {/* Reading Progress Indicator Pip */}
                      {progress > 0 && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      )}

                      {/* Vertical Title */}
                      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden my-2">
                        <span
                          className={`font-serif text-xs sm:text-sm font-bold tracking-wider [writing-mode:vertical-rl] rotate-180 line-clamp-1 max-h-[160px] truncate ${palette.text}`}
                        >
                          {book.title}
                        </span>
                      </div>

                      {/* Bottom Author & Vol Seal */}
                      <div className="w-full flex flex-col items-center gap-1 border-t border-white/15 pt-1.5">
                        <span className="font-mono text-[9px] uppercase tracking-tighter text-slate-300/80 [writing-mode:vertical-rl] rotate-180 line-clamp-1 max-h-[50px]">
                          {authorName}
                        </span>
                        <div className="w-2 h-2 rounded-full border border-white/30 flex items-center justify-center">
                          <div className="w-0.5 h-0.5 rounded-full bg-white/60" />
                        </div>
                      </div>
                    </div>

                    {/* Hover Floating Card Preview / Quick Actions */}
                    <div className="absolute left-1/2 bottom-full mb-3 -translate-x-1/2 hidden group-hover:flex flex-col w-56 p-3 bg-card rounded-xl shadow-2xl border border-border z-50 text-left pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-150 ring-1 ring-black/5">
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-primary flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> Public Domain
                        </span>
                        {progress > 0 && (
                          <span className="text-[10px] font-medium text-muted-foreground">
                            {progress}% read
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
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Architectural Modern Rail Ledge */}
          <div className="shelf-wood-ledge w-full h-4 rounded-b-xl border-t border-slate-700/60 relative z-10">
            <div className="absolute right-4 -top-2 px-2 py-0.5 rounded bg-slate-900/90 border border-slate-700/80 text-[9px] font-mono uppercase tracking-widest text-slate-300 shadow-xs hidden sm:block">
              Shelf {shelfIndex + 1}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
