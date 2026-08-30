'use client';

import React from 'react';
import { BookOpen, Download, Bookmark, Heart, Sparkles } from 'lucide-react';
import type { GutendexBook } from '@/mocks/handlers';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';

export interface BookshelfRackProps {
  books: GutendexBook[];
  onBookClick?: (book: GutendexBook) => void;
  onDownloadClick?: (book: GutendexBook) => void;
}

// Preset palette of realistic library book binding colors
const SPINE_PALETTES = [
  { bg: 'from-[#4a181d] to-[#2e0f12]', text: 'spine-emboss-gold', accent: '#d4af37', name: 'burgundy' },
  { bg: 'from-[#1a2d42] to-[#101b28]', text: 'spine-emboss-silver', accent: '#c0c0c0', name: 'navy' },
  { bg: 'from-[#233a29] to-[#152419]', text: 'spine-emboss-gold', accent: '#d4af37', name: 'forest' },
  { bg: 'from-[#5e3215] to-[#3d1f0c]', text: 'spine-emboss-gold', accent: '#f5deb3', name: 'cognac' },
  { bg: 'from-[#423321] to-[#291f14]', text: 'spine-emboss-gold', accent: '#d4af37', name: 'leather' },
  { bg: 'from-[#2a2826] to-[#171615]', text: 'spine-emboss-silver', accent: '#e0e0e0', name: 'charcoal' },
  { bg: 'from-[#4f2838] to-[#311823]', text: 'spine-emboss-gold', accent: '#f3e5ab', name: 'plum' },
  { bg: 'from-[#1f3a3d] to-[#122325]', text: 'spine-emboss-silver', accent: '#d0e0e3', name: 'teal' },
];

export const BookshelfRack: React.FC<BookshelfRackProps> = ({
  books,
  onBookClick,
  onDownloadClick,
}) => {
  const isSaved = useBookshelfStore((s) => s.isBookSaved);
  const toggleSave = useBookshelfStore((s) => s.toggleSaveBook);
  const isLiked = useBookshelfStore((s) => s.isBookLiked);
  const toggleLike = useBookshelfStore((s) => s.toggleLikeBook);
  const openReader = useReaderStore((s) => s.openReader);
  const getProgress = useReaderStore((s) => s.getProgress);

  if (books.length === 0) {
    return (
      <div className="py-16 text-center text-stone-500 font-serif">
        <p className="text-lg">No books found on this shelf.</p>
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
        <div key={shelfIndex} className="relative">
          {/* Back wall of the shelf niche */}
          <div className="relative bg-paper-200/70 dark:bg-stone-900/60 rounded-t-xl p-4 sm:p-6 pb-0 border-x border-t border-stone-300/40 dark:border-stone-800/60 shadow-inner">
            
            {/* Shelf Items Row */}
            <div className="flex items-end justify-start sm:justify-center gap-2 sm:gap-3.5 overflow-x-auto pb-1 pt-10 min-h-[300px] scrollbar-none px-2">
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
                    className="group relative shrink-0 cursor-pointer select-none transition-all duration-300 hover:z-30 focus:outline-none"
                    style={{ height: `${heightVariance}px`, width: `${widthVariance}px` }}
                    onClick={() => {
                      if (onBookClick) onBookClick(book);
                      else openReader(book);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        if (onBookClick) onBookClick(book);
                        else openReader(book);
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Read ${book.title} by ${authorName}`}
                    data-testid={`shelf-book-${book.id}`}
                  >
                    {/* Bookmark Ribbon Hanging Out Top */}
                    {bookSaved && (
                      <div className="absolute -top-3 right-2 w-3 h-5 bg-amber-600 dark:bg-amber-500 rounded-t-sm shadow-sm z-20 transition-transform group-hover:-translate-y-1" />
                    )}

                    {/* 3D Vertical Book Spine */}
                    <div
                      className={`relative w-full h-full rounded-t-md bg-gradient-to-r ${palette.bg} shadow-book group-hover:shadow-book-hover group-hover:-translate-y-3.5 group-hover:scale-[1.03] transition-all duration-300 flex flex-col justify-between p-2 border-t border-x border-white/20 overflow-hidden`}
                    >
                      {/* Spine Texture Highlights (Embossed Bands) */}
                      <div className="w-full h-2 border-y border-white/25 dark:border-white/15 my-1" />

                      {/* Reading Progress Indicator Pip */}
                      {progress > 0 && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      )}

                      {/* Vertical Title & Author */}
                      <div className="flex-1 flex flex-col items-center justify-center overflow-hidden my-2">
                        <span
                          className={`font-serif text-xs sm:text-sm font-bold tracking-wider [writing-mode:vertical-rl] rotate-180 line-clamp-1 max-h-[160px] truncate ${palette.text}`}
                        >
                          {book.title}
                        </span>
                      </div>

                      {/* Bottom Author & Vol Seal */}
                      <div className="w-full flex flex-col items-center gap-1 border-t border-white/20 pt-1.5">
                        <span className="font-mono text-[9px] uppercase tracking-tighter text-stone-300/80 [writing-mode:vertical-rl] rotate-180 line-clamp-1 max-h-[50px]">
                          {authorName}
                        </span>
                        <div className="w-2 h-2 rounded-full border border-white/30 flex items-center justify-center">
                          <div className="w-0.5 h-0.5 rounded-full bg-white/60" />
                        </div>
                      </div>
                    </div>

                    {/* Hover Floating Card Preview / Quick Actions */}
                    <div className="absolute left-1/2 bottom-full mb-3 -translate-x-1/2 hidden group-hover:flex flex-col w-56 p-3 bg-white/95 dark:bg-stone-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-stone-200 dark:border-stone-700 z-50 text-left pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-150">
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <span className="text-[10px] uppercase font-mono tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5" /> Public Domain
                        </span>
                        {progress > 0 && (
                          <span className="text-[10px] font-medium text-stone-500">
                            {progress}% read
                          </span>
                        )}
                      </div>

                      <h4 className="font-serif font-bold text-stone-900 dark:text-stone-100 text-xs line-clamp-2 leading-tight mb-1">
                        {book.title}
                      </h4>
                      <p className="text-[11px] text-stone-600 dark:text-stone-400 mb-2 truncate">
                        {authorName}
                      </p>

                      {/* Quick Action Buttons */}
                      <div className="flex items-center gap-1.5 pt-2 border-t border-stone-100 dark:border-stone-800">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openReader(book);
                          }}
                          className="flex-1 flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-[11px] font-medium transition-colors"
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
                          className="p-1 rounded-lg border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors"
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
                              ? 'border-amber-600 bg-amber-50 dark:bg-amber-950/40 text-amber-600'
                              : 'border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300'
                          }`}
                          aria-label={bookSaved ? 'Remove from bookshelf' : 'Save to bookshelf'}
                        >
                          <Bookmark className={`w-3 h-3 ${bookSaved ? 'fill-current' : ''}`} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLike(book.id);
                          }}
                          className={`p-1 rounded-lg border transition-colors ${
                            bookLiked
                              ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-500'
                              : 'border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300'
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

          {/* Realistic Wooden Shelf Ledge Base */}
          <div className="shelf-wood-ledge w-full h-4 sm:h-5 rounded-b-lg border-t border-amber-900/40 relative z-10">
            {/* Fine Brass Plaque / Shelf Label */}
            <div className="absolute right-4 -top-2 px-2 py-0.5 rounded bg-amber-950/90 border border-amber-500/40 text-[9px] font-mono uppercase tracking-widest text-amber-300/80 shadow-sm hidden sm:block">
              Shelf {shelfIndex + 1}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

