'use client';

import React from 'react';
import { Sparkles, Quote, RotateCw, BookOpen } from 'lucide-react';
import type { GutendexBook } from '@/types/book.types';
import type { FeaturedHeroBook } from '@/config/featured-books';
import { Button } from '@/components/ui/Button';
import {
  CopyBookLinkIndicator,
  handleCopyBookLinkClick,
} from '@/components/ui/CursorTooltip';
import { formatCleanQuote } from '@/lib/gutenberg/passages';

export interface HeroFeaturedBook2DCardProps {
  featuredBook: FeaturedHeroBook & { rawBook?: GutendexBook };
  onReadFeaturedBook?: (book: GutendexBook | FeaturedHeroBook) => void;
  coverQuote?: string;
  coverLineClampClass: string;
  quoteRevealClass: string;
  isTurningLeaf: boolean;
  canShuffle: boolean;
  onShuffle: (e?: React.MouseEvent) => void;
}

/**
 * Static 2D Featured Book card presentation for low-tier hardware or reduced-motion preferences.
 */
export const HeroFeaturedBook2DCard: React.FC<
  HeroFeaturedBook2DCardProps
> = ({
  featuredBook,
  onReadFeaturedBook,
  coverQuote,
  coverLineClampClass,
  quoteRevealClass,
  isTurningLeaf,
  canShuffle,
  onShuffle,
}) => {
  return (
    <div
      data-testid="hero-featured-book-2d"
      className="w-full max-w-sm sm:max-w-md mx-auto p-5 sm:p-6 rounded-2xl bg-card border border-border shadow-md space-y-4 text-foreground transition-colors duration-theme"
    >
      <div className="flex items-center justify-between border-b border-border pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-primary">
            Featured Classic
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground uppercase">
          {featuredBook.volumeNumber}
        </span>
      </div>

      <div
        data-testid={`hero-2d-copy-meta-${featuredBook.id}`}
        data-copy-book-id={featuredBook.id}
        data-tooltip={`${featuredBook.title} — by ${featuredBook.author}`}
        onClick={(e) => handleCopyBookLinkClick(e, featuredBook.id)}
        onKeyDown={(e) => handleCopyBookLinkClick(e, featuredBook.id)}
        role="button"
        tabIndex={0}
        aria-label={`Copy link to ${featuredBook.title} by ${featuredBook.author}`}
        className="group/copy space-y-1.5 cursor-pointer rounded-md -mx-1 px-1 py-0.5 hover:bg-muted/50 transition-colors"
      >
        <h3 className="text-xl sm:text-2xl font-serif font-bold text-foreground group-hover/copy:text-primary transition-colors tracking-tight line-clamp-2">
          {featuredBook.title}
        </h3>
        <p className="text-xs sm:text-sm font-sans text-muted-foreground flex items-center min-w-0">
          <span className="truncate">
            {featuredBook.author}{' '}
            {featuredBook.year ? `• ${featuredBook.year}` : ''}
          </span>
          <CopyBookLinkIndicator bookId={featuredBook.id} />
        </p>
      </div>

      <div
        className={`p-3.5 rounded-xl bg-muted/50 border border-border space-y-1.5 ${quoteRevealClass}`}
      >
        <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground uppercase">
          <Quote className="w-3 h-3 text-primary/70 shrink-0" />
          <span>Opening Line</span>
        </div>
        <p
          className={`text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed ${coverLineClampClass}`}
        >
          &ldquo;
          {coverQuote || formatCleanQuote(featuredBook.openingLine)}
          &rdquo;
        </p>
      </div>

      <div className="pt-1 flex items-center justify-between gap-3">
        <Button
          data-testid="hero-book-read-btn"
          onClick={() =>
            onReadFeaturedBook?.(featuredBook.rawBook || featuredBook)
          }
          className="flex-1 flex items-center justify-center gap-2 h-10 text-xs font-mono tracking-wider uppercase font-bold"
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Read Volume</span>
        </Button>
        <Button
          data-testid="hero-book-shuffle-btn"
          variant="outline"
          disabled={isTurningLeaf || !canShuffle}
          onClick={onShuffle}
          title="Next Passage"
          className="h-10 px-3 shrink-0"
        >
          <RotateCw
            className={`w-3.5 h-3.5 ${isTurningLeaf ? 'animate-spin' : ''}`}
          />
        </Button>
      </div>
    </div>
  );
};
