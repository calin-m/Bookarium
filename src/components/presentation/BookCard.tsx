'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, Download, Bookmark, Heart, Sparkles } from 'lucide-react';
import type { GutendexBook } from '@/mocks/handlers';
import { extractBookFormats, formatDownloadCount, truncate } from '@/lib/utils';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useHasMounted } from '@/hooks/useHasMounted';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export interface BookCardProps {
  book: GutendexBook;
  onDownloadClick?: (book: GutendexBook) => void;
  onPreviewClick?: (book: GutendexBook, rect?: { top: number; left: number; width: number; height: number }) => void;
}

export const BookCard: React.FC<BookCardProps> = ({ book, onDownloadClick, onPreviewClick }) => {
  const hasMounted = useHasMounted();
  const [imageError, setImageError] = React.useState(false);
  const rawIsSaved = useBookshelfStore((s) => s.isBookSaved(book.id));
  const isSaved = hasMounted && rawIsSaved;
  const rawIsLiked = useBookshelfStore((s) => s.isBookLiked(book.id));
  const isLiked = hasMounted && rawIsLiked;
  const toggleSave = useBookshelfStore((s) => s.toggleSaveBook);
  const toggleLike = useBookshelfStore((s) => s.toggleLikeBook);

  const formats = extractBookFormats(book.formats);
  const authorNames = book.authors.map((a) => a.name.split(',').reverse().join(' ').trim()).join(', ') || 'Anonymous';
  const primarySubject = book.subjects[0] ? truncate(book.subjects[0].split('--')[0].trim(), 24) : 'Classic';

  return (
    <Card
      variant="default"
      className="group relative flex flex-col h-full bg-card border border-border hover:border-primary/50 shadow-booksaw hover:shadow-booksaw-hover hover:-translate-y-1 transition-all duration-300 rounded-xl overflow-hidden"
      data-testid={`book-card-${book.id}`}
    >
      {/* Top Cover Visual with Booksaw Directional Depth & Click-to-Open Affordance */}
      <div
        onClick={(e) => {
          if (onPreviewClick) {
            const rect = e.currentTarget.getBoundingClientRect();
            onPreviewClick(book, {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            });
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && onPreviewClick) {
            e.preventDefault();
            const rect = e.currentTarget.getBoundingClientRect();
            onPreviewClick(book, {
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            });
          }
        }}
        tabIndex={onPreviewClick ? 0 : undefined}
        role={onPreviewClick ? 'button' : undefined}
        aria-label={onPreviewClick ? `Flip open 3D preview for ${book.title}` : undefined}
        title={onPreviewClick ? `Click to flip open 3D spread for ${book.title}` : undefined}
        className={`relative aspect-[3/4] w-full bg-muted/60 overflow-hidden flex items-center justify-center p-2.5 sm:p-3 border-b border-border select-none ${
          onPreviewClick ? 'cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary' : ''
        }`}
      >
        {formats.coverImage && !imageError ? (
          <div className="relative w-full h-full flex items-center justify-center group-hover:scale-[1.03] transition-transform duration-300">
            <img
              src={formats.coverImage}
              alt={`Cover of ${book.title}`}
              className="max-w-full max-h-full w-auto h-auto object-contain rounded-sm shadow-md"
              loading="lazy"
              onError={() => setImageError(true)}
            />
          </div>
        ) : (
          <div className="w-full h-full rounded-md bg-gradient-to-br from-stone-900 via-stone-800 to-stone-950 text-white p-4 flex flex-col justify-between shadow-xs border border-stone-700">
            <div>
              <div className="flex items-center gap-1 text-[10px] uppercase font-mono tracking-widest text-primary-400 font-semibold mb-2">
                <Sparkles className="w-3 h-3" /> Public Domain
              </div>
              <h4 className="font-serif font-bold text-sm sm:text-base line-clamp-4 leading-snug">
                {book.title}
              </h4>
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
              toggleLike(book);
            }}
            className={`p-1.5 rounded-full transition-all shadow-xs ${
              isLiked
                ? 'bg-destructive text-destructive-foreground scale-105'
                : 'bg-card text-muted-foreground hover:text-destructive'
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
            className={`p-1.5 rounded-full transition-all shadow-xs ${
              isSaved
                ? 'bg-primary text-primary-foreground scale-105'
                : 'bg-card text-muted-foreground hover:text-primary'
            }`}
            aria-label={isSaved ? 'Remove from bookshelf' : 'Save to bookshelf'}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* Subject Pill / Flip Open Hover Affordance */}
        <div className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-1.5">
          <Badge variant="outline" size="sm" className="bg-card text-[10px] border-border text-foreground font-mono uppercase group-hover:border-primary/60 transition-colors">
            {primarySubject}
          </Badge>
          {onPreviewClick && (
            <span className="hidden sm:inline-flex opacity-0 group-hover:opacity-100 items-center gap-1 text-[9px] font-mono font-bold bg-primary text-primary-foreground px-1.5 py-0.5 rounded shadow-xs transition-opacity">
              Flip Open 📖
            </span>
          )}
        </div>
      </div>

      {/* Book Metadata Content */}
      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
        <div>
          <h3 className="font-serif font-bold text-foreground text-sm sm:text-base leading-snug line-clamp-2 mb-1 group-hover:text-primary transition-colors">
            {book.title}
          </h3>
          <p className="text-xs text-muted-foreground font-sans line-clamp-1">
            {authorNames}
          </p>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
          <span className="font-mono text-[11px]">{formatDownloadCount(book.download_count)} reads</span>
          <span className="text-[10px] font-mono font-medium tracking-wider text-emerald-700 dark:text-emerald-400 [html.sepia_&]:text-emerald-400 uppercase">
            CC0 / Free
          </span>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 mt-0.5">
          <Link
            href={`/read/${book.id}`}
            onClick={() => useReaderStore.getState().openReader(book)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs bg-primary hover:opacity-90 text-primary-foreground rounded font-mono uppercase tracking-wider font-bold transition-opacity shadow-xs active:scale-[0.98]"
            aria-label={`Read ${book.title}`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Read</span>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => onDownloadClick?.(book)}
            className="w-full gap-1.5 text-xs rounded border-border hover:bg-muted text-foreground font-mono uppercase tracking-wider font-medium"
            aria-label={`Download options for ${book.title}`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Get</span>
          </Button>
        </div>
      </div>
    </Card>
  );
};
