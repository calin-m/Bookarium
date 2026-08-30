'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, Download, Bookmark, Heart, Sparkles } from 'lucide-react';
import type { GutendexBook } from '@/mocks/handlers';
import { extractBookFormats, formatDownloadCount, truncate } from '@/lib/utils';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
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

  const formats = extractBookFormats(book.formats);
  const authorNames = book.authors.map((a) => a.name.split(',').reverse().join(' ').trim()).join(', ') || 'Anonymous';
  const primarySubject = book.subjects[0] ? truncate(book.subjects[0].split('--')[0].trim(), 24) : 'Classic';

  return (
    <Card
      variant="default"
      className="group relative flex flex-col h-full bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 hover:border-primary-500/50 dark:hover:border-primary-500/50 shadow-booksaw hover:shadow-booksaw-hover hover:-translate-y-1 transition-all duration-300 rounded-xl overflow-hidden"
      data-testid={`book-card-${book.id}`}
    >
      {/* Top Cover Visual with Booksaw Directional Depth */}
      <div className="relative aspect-[3/4] w-full bg-paper-200/60 dark:bg-stone-800/60 overflow-hidden flex items-center justify-center p-3 sm:p-4 border-b border-stone-100 dark:border-stone-800/60">
        {formats.coverImage ? (
          <div className="relative w-full h-full rounded-md overflow-hidden shadow-sm group-hover:scale-[1.02] transition-transform duration-300">
            <img
              src={formats.coverImage}
              alt={`Cover of ${book.title}`}
              className="w-full h-full object-cover object-center"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="w-full h-full rounded-md bg-gradient-to-br from-stone-900 via-stone-800 to-stone-950 text-white p-4 flex flex-col justify-between shadow-sm border border-stone-700">
            <div>
              <div className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-widest text-primary-400 font-semibold mb-2">
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

        {/* Quick Action Overlay Badges */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-20">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleLike(book.id);
            }}
            className={`p-1.5 rounded-full backdrop-blur-md transition-all shadow-xs ${
              isLiked
                ? 'bg-red-500 text-white scale-105'
                : 'bg-white/90 dark:bg-stone-900/90 text-stone-600 dark:text-stone-300 hover:text-red-500'
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
            className={`p-1.5 rounded-full backdrop-blur-md transition-all shadow-xs ${
              isSaved
                ? 'bg-primary-600 text-white scale-105'
                : 'bg-white/90 dark:bg-stone-900/90 text-stone-600 dark:text-stone-300 hover:text-primary-600'
            }`}
            aria-label={isSaved ? 'Remove from bookshelf' : 'Save to bookshelf'}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Subject Pill */}
        <div className="absolute bottom-2.5 left-2.5 z-20">
          <Badge variant="outline" size="sm" className="bg-white/95 dark:bg-stone-900/95 text-[10px] backdrop-blur-md border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-mono uppercase">
            {primarySubject}
          </Badge>
        </div>
      </div>

      {/* Book Metadata Content */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <h2 className="font-serif font-bold text-stone-900 dark:text-stone-100 text-sm sm:text-base leading-snug line-clamp-2 mb-1 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
            {book.title}
          </h2>
          <p className="text-xs text-stone-500 dark:text-stone-400 font-sans line-clamp-1">
            {authorNames}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-stone-100 dark:border-stone-800 text-xs text-stone-400">
          <span className="font-mono text-[11px]">{formatDownloadCount(book.download_count)} reads</span>
          <span className="text-[10px] font-mono font-medium tracking-wider text-emerald-700 dark:text-emerald-400 uppercase">
            CC0 / Free
          </span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-0.5">
          <Link
            href={`/read/${book.id}`}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-primary-600 hover:bg-primary-700 text-white rounded font-mono uppercase tracking-wider font-bold transition-colors shadow-xs active:scale-[0.98]"
            aria-label={`Read ${book.title}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Read</span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownloadClick?.(book)}
            className="w-full gap-1.5 text-xs rounded border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 font-mono uppercase tracking-wider font-medium"
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
