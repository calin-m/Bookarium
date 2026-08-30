'use client';

import React from 'react';
import { BookOpen, Download, Bookmark, Heart, Sparkles } from 'lucide-react';
import type { GutendexBook } from '@/mocks/handlers';
import { extractBookFormats, formatDownloadCount, truncate } from '@/lib/utils';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export interface BookCardProps {
  book: GutendexBook;
  onDownloadClick?: (book: GutendexBook) => void;
}

export const BookCard: React.FC<BookCardProps> = ({ book, onDownloadClick }) => {
  const isSaved = useBookshelfStore((s) => s.isBookSaved(book.id));
  const toggleSave = useBookshelfStore((s) => s.toggleSaveBook);
  const isLiked = useBookshelfStore((s) => s.isBookLiked(book.id));
  const toggleLike = useBookshelfStore((s) => s.toggleLikeBook);
  const openReader = useReaderStore((s) => s.openReader);

  const formats = extractBookFormats(book.formats);
  const authorNames = book.authors.map((a) => a.name.split(',').reverse().join(' ').trim()).join(', ') || 'Anonymous';
  const primarySubject = book.subjects[0] ? truncate(book.subjects[0].split('--')[0].trim(), 26) : 'Classic Literature';

  return (
    <Card
      variant="default"
      className="group relative flex flex-col h-full bg-white dark:bg-stone-900 border border-stone-200/90 dark:border-stone-800 hover:border-primary-500/50 dark:hover:border-primary-600/50 hover:shadow-book-hover transition-all duration-300 rounded-xl overflow-hidden"
      data-testid={`book-card-${book.id}`}
    >
      {/* Top Book Cover Visual with Left Spine Crease */}
      <div className="relative aspect-[3/4] w-full bg-paper-100 dark:bg-stone-800/80 overflow-hidden flex items-center justify-center p-3 sm:p-4 border-b border-stone-100 dark:border-stone-800/60">
        
        {/* Subtle Spine Crease Highlight on Left */}
        <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-black/10 to-transparent z-10 pointer-events-none" />

        {formats.coverImage ? (
          <div className="relative w-full h-full rounded-md overflow-hidden shadow-book group-hover:scale-[1.02] transition-transform duration-300">
            <img
              src={formats.coverImage}
              alt={`Cover of ${book.title}`}
              className="w-full h-full object-cover object-center"
              loading="lazy"
            />
            {/* Fine Page Edge Trim on Right */}
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-l from-black/20 to-transparent pointer-events-none" />
          </div>
        ) : (
          <div className="w-full h-full rounded-md bg-gradient-to-br from-primary-900 via-stone-900 to-stone-950 text-stone-100 p-4 flex flex-col justify-between shadow-book border border-amber-500/20">
            <div>
              <div className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-widest text-amber-300/90 font-semibold mb-2">
                <Sparkles className="w-3 h-3" /> Public Domain
              </div>
              <h3 className="font-serif font-bold text-sm sm:text-base line-clamp-4 leading-snug">
                {book.title}
              </h3>
            </div>
            <p className="text-xs text-stone-300 font-serif italic line-clamp-2">
              {authorNames}
            </p>
          </div>
        )}

        {/* Quick Action Badges */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-20">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleLike(book.id);
            }}
            className={`p-1.5 rounded-lg backdrop-blur-md transition-all shadow-sm ${
              isLiked
                ? 'bg-red-500 text-white scale-105'
                : 'bg-white/80 dark:bg-stone-900/80 text-stone-600 dark:text-stone-300 hover:text-red-500'
            }`}
            aria-label={isLiked ? 'Unlike book' : 'Like book'}
          >
            <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSave(book);
            }}
            className={`p-1.5 rounded-lg backdrop-blur-md transition-all shadow-sm ${
              isSaved
                ? 'bg-primary-600 text-white scale-105'
                : 'bg-white/80 dark:bg-stone-900/80 text-stone-600 dark:text-stone-300 hover:text-primary-600'
            }`}
            aria-label={isSaved ? 'Remove from bookshelf' : 'Save to bookshelf'}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Subject Pill */}
        <div className="absolute bottom-2.5 left-2.5 z-20">
          <Badge variant="outline" size="sm" className="bg-white/90 dark:bg-stone-900/90 text-[10px] backdrop-blur-md border-stone-200/80 dark:border-stone-700/80 text-stone-700 dark:text-stone-300 font-serif">
            {primarySubject}
          </Badge>
        </div>
      </div>

      {/* Book Metadata Content */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <h2 className="font-serif font-bold text-stone-900 dark:text-stone-100 text-sm sm:text-base leading-snug line-clamp-2 mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {book.title}
          </h2>
          <p className="text-xs text-stone-600 dark:text-stone-400 font-medium line-clamp-1">
            {authorNames}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-500">
          <span className="font-mono text-[11px]">{formatDownloadCount(book.download_count)} reads</span>
          <span className="text-[10px] font-mono font-medium tracking-wider text-emerald-700 dark:text-emerald-400 uppercase">
            Zero Copyright
          </span>
        </div>

        {/* Interactive Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-0.5">
          <Button
            variant="primary"
            size="sm"
            onClick={() => openReader(book)}
            className="w-full gap-1 text-xs"
            aria-label={`Read ${book.title}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Read</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownloadClick?.(book)}
            className="w-full gap-1 text-xs"
            aria-label={`Download options for ${book.title}`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Formats</span>
          </Button>
        </div>
      </div>
    </Card>
  );
};
