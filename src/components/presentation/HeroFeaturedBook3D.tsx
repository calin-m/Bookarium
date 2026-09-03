'use client';

import React, { useState } from 'react';
import { Sparkles, Quote, RotateCw, BookOpen } from 'lucide-react';
import type { GutendexBook } from '@/types/book.types';
import type { FeaturedHeroBook } from '@/config/featured-books';
import { Button } from '@/components/ui/Button';
import { useBookPassageShuffle } from '@/hooks/useBookPassageShuffle';
import { usePerformanceTier } from '@/hooks/usePerformanceTier';

export interface HeroFeaturedBook3DProps {
  featuredBook: FeaturedHeroBook & { rawBook?: GutendexBook };
  onReadFeaturedBook?: (book: GutendexBook | FeaturedHeroBook) => void;
}

/**
 * Standing 3D Featured Book presentation with realistic 3D open-cover hinge,
 * leaf-flip animations, and dynamic multi-chapter quote shuffling.
 */
export const HeroFeaturedBook3D: React.FC<HeroFeaturedBook3DProps> = ({
  featuredBook,
  onReadFeaturedBook,
}) => {
  const [pinState, setPinState] = useState<'auto' | 'open' | 'closed'>('auto');
  const [isHovered, setIsHovered] = useState(false);

  const {
    currentPassage,
    prevPassage,
    activePassageIndex,
    prevPassageIndex,
    isTurningLeaf,
    setIsTurningLeaf,
    shuffleNextPassage,
  } = useBookPassageShuffle({
    id: featuredBook.id,
    title: featuredBook.title,
    authors: featuredBook.rawBook?.authors || [{ name: featuredBook.author }],
    subjects: featuredBook.rawBook?.subjects || [featuredBook.primarySubject],
  });

  const isBookOpen = pinState === 'open' || (pinState === 'auto' && isHovered);

  const handleBookClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a')) {
      return;
    }
    e.stopPropagation();
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      return;
    }
    if (isBookOpen) {
      setPinState('closed');
    } else {
      setPinState('open');
    }
  };

  const handleMouseEnter = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return;
    setIsHovered(true);
    if (pinState === 'closed') {
      setPinState('auto');
    }
  };

  const handleMouseLeave = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return;
    setIsHovered(false);
    if (pinState === 'closed') {
      setPinState('auto');
    }
  };

  const { allowHeavyMotion, tier } = usePerformanceTier();

  // Static 2D Presentation for Low-Tier Hardware or Reduced-Motion Preference
  if (!allowHeavyMotion || tier === 'low') {
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

        <div className="space-y-1.5">
          <h3 className="text-xl sm:text-2xl font-serif font-bold text-foreground tracking-tight line-clamp-2">
            {featuredBook.title}
          </h3>
          <p className="text-xs sm:text-sm font-sans text-muted-foreground">
            {featuredBook.author} {featuredBook.year ? `• ${featuredBook.year}` : ''}
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-muted/50 border border-border/80 space-y-1.5">
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground uppercase">
            <Quote className="w-3 h-3 text-primary/70 shrink-0" />
            <span>Opening Line</span>
          </div>
          <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-4">
            &ldquo;{currentPassage.quoteExcerpt || featuredBook.openingLine}&rdquo;
          </p>
        </div>

        <div className="pt-1 flex items-center justify-between gap-3">
          <Button
            data-testid="hero-book-read-btn"
            onClick={() => onReadFeaturedBook?.(featuredBook.rawBook || featuredBook)}
            className="flex-1 flex items-center justify-center gap-2 h-10 text-xs font-mono tracking-wider uppercase font-bold"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Read Volume</span>
          </Button>
          <Button
            data-testid="hero-book-shuffle-btn"
            variant="outline"
            onClick={shuffleNextPassage}
            title="Next Passage"
            className="h-10 px-3 shrink-0"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`relative group cursor-pointer book-3d-stage hero-3d-stage ${
        pinState === 'open' ? 'book-open' : pinState === 'closed' ? 'book-closed' : ''
      }`}
      onClick={handleBookClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (typeof window !== 'undefined' && window.innerWidth < 1024) {
            return;
          }
          if (isBookOpen) {
            setPinState('closed');
          } else {
            setPinState('open');
          }
        }
      }}
      aria-label={isBookOpen ? 'Click to close volume' : 'Click to pin open volume'}
    >
      <div className="book-3d-rig relative">
        {/* Desktop Open Book Spread Base (Right Page: straight left spine, rounded right outer edge) */}
        <div className="hidden lg:flex absolute inset-0 rounded-r-lg rounded-l-none open-book-page-right border border-border p-6 flex-col justify-between text-foreground z-0 overflow-hidden">
          <div
            key={`right-page-base-${featuredBook.id}-${activePassageIndex}`}
            className="animate-ink-appear flex flex-col justify-between h-full relative"
          >
            <div>
              <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-muted-foreground mb-3 pb-1 border-b border-border">
                <span>{currentPassage.chapterLabel || 'Notable Passage'}</span>
                <span className="opacity-60">p. 2</span>
              </div>

              <div className="p-3.5 rounded-lg bg-card/60 border border-border shadow-xs mb-2">
                <Quote className="w-4 h-4 text-primary/60 mb-1.5 shrink-0" />
                <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-8 text-pretty">
                  &ldquo;{currentPassage.quoteExcerpt}&rdquo;
                </p>
              </div>
            </div>

            {/* Right Page Footer Actions */}
            <div className="pt-2.5 border-t border-border flex items-center justify-between gap-2">
              <Button
                variant="outline"
                size="chip"
                onClick={(e) => {
                  e.stopPropagation();
                  shuffleNextPassage(e);
                }}
                title="Shuffle to Next Passage in this Book"
                aria-label="Shuffle to Next Passage in this Book"
                data-testid="hero-book-shuffle-btn"
              >
                <RotateCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                <span>Shuffle</span>
              </Button>

              {onReadFeaturedBook && (
                <Button
                  variant="primary"
                  size="chip"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReadFeaturedBook(featuredBook.rawBook || featuredBook);
                  }}
                  aria-label="Read"
                  data-testid="hero-book-read-btn"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Read</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Physical 3D Turning Leaf (Flips Right to Left across the spine on shuffle: 0deg -> -180deg) */}
        {isTurningLeaf && (
          <div
            key={`turning-leaf-${featuredBook.id}-${activePassageIndex}`}
            className="hidden lg:block book-turning-leaf"
            onAnimationEnd={() => setIsTurningLeaf(false)}
          >
            {/* Front Face of Turning Leaf: Outgoing Right Page quote lifting away */}
            <div className="turning-leaf-face-front rounded-r-lg rounded-l-none open-book-page-right border border-border p-6 flex flex-col justify-between text-foreground overflow-hidden">
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-muted-foreground mb-3 pb-1 border-b border-border">
                  <span>{prevPassage.chapterLabel || 'Notable Passage'}</span>
                  <span className="opacity-60">p. 2</span>
                </div>

                <div className="p-3.5 rounded-lg bg-card/60 border border-border shadow-xs mb-2">
                  <Quote className="w-4 h-4 text-primary/60 mb-1.5 shrink-0" />
                  <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-8 text-pretty">
                    &ldquo;{prevPassage.quoteExcerpt}&rdquo;
                  </p>
                </div>
              </div>
            </div>

            {/* Back Face of Turning Leaf: Incoming Left Page title & quote landing onto left side */}
            <div className="turning-leaf-face-back rounded-l-lg rounded-r-none open-book-page-left border border-border p-6 flex flex-col justify-between text-foreground overflow-hidden">
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-primary font-bold mb-2.5 pb-1 border-b border-border">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Public Domain
                  </span>
                  <span>{currentPassage.chapterLabel || featuredBook.volumeNumber}</span>
                </div>

                <h3 className="text-xl sm:text-2xl font-serif font-bold leading-tight mb-1 text-foreground text-balance">
                  {featuredBook.title}
                </h3>
                <p className="text-xs font-mono italic text-muted-foreground mb-2">
                  by {featuredBook.author} ({featuredBook.year})
                </p>

                <div className="relative pl-3 border-l-2 border-primary/40 my-2">
                  <p className="text-xs sm:text-[13px] font-serif italic text-foreground/90 leading-relaxed line-clamp-8 text-pretty">
                    &ldquo;{currentPassage.openingLine}&rdquo;
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-border">
                <span className="truncate max-w-[160px]">{featuredBook.primarySubject}</span>
                <span className="opacity-60">p. 1</span>
              </div>
            </div>
          </div>
        )}

        {/* 3D Flipping Front Cover (Hinged on Left Spine) */}
        <div className="relative w-64 sm:w-72 md:w-80 aspect-[2/3] book-3d-flipper z-10">
          {/* FRONT FACE: Physical Hardcover Book (Closed State) */}
          <div className="absolute inset-0 book-3d-face-front rounded-r-lg rounded-l-sm bg-gradient-to-r from-stone-900 via-stone-800 to-stone-950 p-6 flex flex-col justify-between text-white shadow-[25px_25px_50px_rgba(0,0,0,0.18),0_10px_20px_rgba(0,0,0,0.08)] border-r-2 border-stone-700 overflow-hidden">
            {/* 3D Spine & Page Edge Accents */}
            <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-black/40 via-black/20 to-transparent rounded-l-sm pointer-events-none" />
            <div className="absolute right-0 top-1 bottom-1 w-2 bg-gradient-to-l from-white/30 to-transparent pointer-events-none" />

            <div
              key={`front-face-content-${featuredBook.id}-${activePassageIndex}`}
              className="animate-ink-appear flex flex-col justify-between h-full relative z-10"
            >
              {/* Header */}
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-primary-300 mb-3 pb-2 border-b border-white/10">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-primary-400" /> Featured Book
                  </span>
                  <span className="text-stone-400 font-mono tracking-widest text-[10px]">
                    {featuredBook.volumeNumber}
                  </span>
                </div>

                <h3 className="text-2xl sm:text-3xl font-serif font-bold text-white leading-tight mb-1.5 text-balance">
                  {featuredBook.title}
                </h3>
                <p className="text-xs font-mono uppercase tracking-wider text-stone-300">
                  {featuredBook.author} • {featuredBook.year}
                </p>
              </div>

              {/* Center Quote Excerpt */}
              <div className="my-3 p-3 rounded bg-stone-900 border border-stone-800">
                <p className="text-xs font-serif italic text-stone-200 leading-relaxed line-clamp-4 text-pretty">
                  &ldquo;{currentPassage.quoteExcerpt}&rdquo;
                </p>
              </div>

              {/* Footer */}
              <div className="pt-3 border-t border-white/10 flex items-center justify-between">
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider">
                  {featuredBook.license}
                </span>
                {onReadFeaturedBook && (
                  <Button
                    variant="primary"
                    size="chip"
                    className="lg:hidden"
                    onClick={(e) => {
                      e.stopPropagation();
                      onReadFeaturedBook(featuredBook.rawBook || featuredBook);
                    }}
                    aria-label="Read"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Read</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* BACK FACE: Inside Left Page (Visible when rotated -180deg on desktop hover) */}
          <div className="absolute inset-0 book-3d-face-back rounded-l-lg rounded-r-none open-book-page-left border border-border p-6 flex flex-col justify-between text-foreground overflow-hidden">
            <div
              key={`left-page-content-${featuredBook.id}-${isTurningLeaf ? prevPassageIndex : activePassageIndex}`}
              className="flex flex-col justify-between h-full relative"
            >
              <div>
                <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-primary font-bold mb-2.5 pb-1 border-b border-border">
                  <span className="flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Public Domain
                  </span>
                  <span>
                    {(isTurningLeaf ? prevPassage : currentPassage).chapterLabel || featuredBook.volumeNumber}
                  </span>
                </div>

                <h3 className="text-xl sm:text-2xl font-serif font-bold leading-tight mb-1 text-foreground text-balance">
                  {featuredBook.title}
                </h3>
                <p className="text-xs font-mono italic text-muted-foreground mb-2">
                  by {featuredBook.author} ({featuredBook.year})
                </p>

                <div className="relative pl-3 border-l-2 border-primary/40 my-2">
                  <p className="text-xs sm:text-[13px] font-serif italic text-foreground/90 leading-relaxed line-clamp-8 text-pretty">
                    &ldquo;{(isTurningLeaf ? prevPassage : currentPassage).openingLine}&rdquo;
                  </p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-border">
                <span className="truncate max-w-[140px]">{featuredBook.primarySubject}</span>
                <span className="opacity-60">p. 1</span>
              </div>
            </div>
          </div>
        </div>

        {/* Ambient Floor Shadow - Closed State */}
        <div
          className={`absolute -bottom-4 left-6 right-6 h-6 bg-black/15 dark:bg-black/40 rounded-full blur-xl pointer-events-none transition-opacity duration-700 ${
            pinState === 'open' ? 'opacity-0' : pinState === 'closed' ? 'opacity-100' : 'group-hover:opacity-0'
          }`}
        />
        {/* Ambient Floor Shadow - Open 2-Page Spread State */}
        <div
          className={`hidden lg:block absolute -bottom-6 -left-64 -right-8 h-8 bg-black/20 dark:bg-black/50 rounded-full blur-2xl pointer-events-none transition-opacity duration-700 ${
            pinState === 'open' ? 'opacity-100' : pinState === 'closed' ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
          }`}
        />
      </div>
    </div>
  );
};

