'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Sparkles, Quote, RotateCw, BookOpen, X } from 'lucide-react';
import type { GutendexBook } from '@/types/book.types';
import type { FeaturedHeroBook } from '@/config/featured-books';
import { Button } from '@/components/ui/Button';
import {
  CopyBookLinkIndicator,
  handleCopyBookLinkClick,
} from '@/components/ui/CursorTooltip';
import { useBookPassageShuffle } from '@/hooks/useBookPassageShuffle';
import { useFeaturedQuotes } from '@/hooks/queries/useBooks';
import { usePerformanceTier } from '@/hooks/usePerformanceTier';
import { useTouchDevice } from '@/hooks/useTouchDevice';
import { formatCleanQuote, resolveSpreadQuoteLayout } from '@/lib/gutenberg/passages';

export interface HeroFeaturedBook3DProps {
  featuredBook: FeaturedHeroBook & { rawBook?: GutendexBook };
  onReadFeaturedBook?: (book: GutendexBook | FeaturedHeroBook) => void;
  /**
   * `false` while the shared quote pool is still resolving: quote areas stay invisible (space reserved)
   * so static fallback text is never swapped for database text in place, then reveal once.
   */
  isQuoteDataReady?: boolean;
}

/**
 * Standing 3D Featured Book presentation with realistic 3D open-cover hinge,
 * leaf-flip animations, and dynamic multi-chapter quote shuffling.
 */
export const HeroFeaturedBook3D: React.FC<HeroFeaturedBook3DProps> = ({
  featuredBook,
  onReadFeaturedBook,
  isQuoteDataReady = true,
}) => {
  const [pinState, setPinState] = useState<'auto' | 'open' | 'closed'>('auto');
  const [isHovered, setIsHovered] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const [kinematics, setKinematics] = useState<{ scale: number; tx: number }>({
    scale: 0.70,
    tx: 75,
  });

  // Dynamically compute fluid scale and centering translation across arbitrary tablet/desktop resolutions
  useEffect(() => {
    const updateKinematics = () => {
      if (typeof window === 'undefined') return;
      const width = window.innerWidth;
      if (width < 1024) return;
      // On wide desktop (2xl: 1536px+), HeroSearch switches to 2xl:justify-end with generous desktop margins
      if (width >= 1536) {
        setKinematics({ scale: 0.84, tx: 115 });
        return;
      }
      // Container max-w-7xl (80rem = 1280px) minus 64px padding = 1216px max content
      const contWidth = Math.min(width - 64, 1216);
      const fr = Math.max(0, (contWidth - 616) / 12);
      const colWidth = 5 * fr + 224;
      // Guarantee >= 20px clearance inside the right screen edge and > 40px clearance from left search text
      const targetScale = Math.min(0.84, Math.max(0.60, (colWidth / 2 + 12) / 320));
      // T shifts the spine rightward so the open 2-page spread remains centered around the closed card
      const targetTx = Math.round(160 * targetScale * 0.75);
      setKinematics({
        scale: Number(targetScale.toFixed(2)),
        tx: targetTx,
      });
    };

    updateKinematics();
    window.addEventListener('resize', updateKinematics, { passive: true });
    return () => window.removeEventListener('resize', updateKinematics);
  }, []);

  const existingQuotes = featuredBook.quotes || featuredBook.rawBook?.quotes;
  const hasExistingQuotes = Array.isArray(existingQuotes) && existingQuotes.length >= 2;
  const { data: featuredQuotesMap } = useFeaturedQuotes([featuredBook.id], {
    enabled: !hasExistingQuotes,
  });
  const supabaseBookQuotes = useMemo(() => {
    const dbQuotes = featuredQuotesMap?.[featuredBook.id];
    if (Array.isArray(dbQuotes) && dbQuotes.length > 0 && !hasExistingQuotes) {
      const firstStaticSpread = {
        chapterLabel: 'Chapter I • The Opening Incipit',
        openingLine: featuredBook.openingLine,
        secondaryQuote: `“In the unfolding story of ${featuredBook.title}, ${featuredBook.author} explores timeless truths across ${featuredBook.primarySubject.toLowerCase()}.”`,
        quoteExcerpt: featuredBook.quoteExcerpt,
        commentary: `Preserved in complete unabridged form in the worldwide public domain (${featuredBook.year}).`,
      };
      return [firstStaticSpread, ...dbQuotes];
    }
    return existingQuotes;
  }, [featuredQuotesMap, featuredBook, existingQuotes, hasExistingQuotes]);

  const {
    passages,
    currentPassage,
    prevPassage,
    activePassageIndex,
    prevPassageIndex,
    isTurningLeaf,
    setIsTurningLeaf,
    shuffleNextPassage: hookShuffleNextPassage,
  } = useBookPassageShuffle({
    id: featuredBook.id,
    title: featuredBook.title,
    authors: featuredBook.rawBook?.authors || [{ name: featuredBook.author }],
    subjects: featuredBook.rawBook?.subjects || [featuredBook.primarySubject],
    supabaseQuotes: supabaseBookQuotes,
    enabled: false,
  });

  // The ink-appear transition is reserved for user-initiated page turns; initial paint stays static.
  const [hasShuffled, setHasShuffled] = useState(false);
  const shuffleNextPassage = (e?: React.MouseEvent) => {
    setHasShuffled(true);
    hookShuffleNextPassage(e);
  };
  const inkWrapperClass = hasShuffled ? 'animate-ink-appear' : '';
  // Quote areas: on initial paint with isQuoteDataReady=true, render statically without delay.
  // If isQuoteDataReady is explicitly false (e.g. while a custom book is loading), hold invisible at opacity-0.
  const [initialReady] = useState(isQuoteDataReady);
  const quoteRevealClass = !isQuoteDataReady
    ? 'opacity-0'
    : hasShuffled
    ? ''
    : initialReady
    ? ''
    : 'animate-ink-appear';

  const currentLayout = resolveSpreadQuoteLayout(currentPassage, {
    title: featuredBook.title,
    hasCommentary: Boolean(currentPassage.commentary),
  });

  const isBookOpen = pinState === 'open' || (pinState === 'auto' && isHovered);

  // Close open book when clicking or tapping anywhere outside the 3D book stage
  useEffect(() => {
    if (!isBookOpen) return;

    const handlePointerDownOutside = (e: MouseEvent | TouchEvent | PointerEvent) => {
      const target = e.target as Node | null;
      if (stageRef.current && target && !stageRef.current.contains(target)) {
        setPinState('closed');
      }
    };

    document.addEventListener('pointerdown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside, { passive: true });

    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
    };
  }, [isBookOpen]);

  const togglePinState = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      return;
    }
    setPinState(isBookOpen ? 'closed' : 'open');
  };

  const handleBookClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('button') ||
      target.closest('a') ||
      target.closest('[data-copy-book-id]')
    ) {
      return;
    }
    e.stopPropagation();
    togglePinState();
  };

  const isTouchDevice = useTouchDevice();

  const handleHoverChange = (hovered: boolean) => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) return;
    if (isTouchDevice) return;
    setIsHovered(hovered);
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
              {featuredBook.author} {featuredBook.year ? `• ${featuredBook.year}` : ''}
            </span>
            <CopyBookLinkIndicator bookId={featuredBook.id} />
          </p>
        </div>

        <div className={`p-3.5 rounded-xl bg-muted/50 border border-border space-y-1.5 ${quoteRevealClass}`}>
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground uppercase">
            <Quote className="w-3 h-3 text-primary/70 shrink-0" />
            <span>Opening Line</span>
          </div>
          <p className={`text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed ${currentLayout.coverLineClampClass}`}>
            &ldquo;{currentLayout.coverQuote || formatCleanQuote(featuredBook.openingLine)}&rdquo;
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
            disabled={isTurningLeaf || passages.length <= 1}
            onClick={shuffleNextPassage}
            title="Next Passage"
            className="h-10 px-3 shrink-0"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isTurningLeaf ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
    );
  }

  const isVeryLongTitle = featuredBook.title.length > 55;
  const isLongTitle = featuredBook.title.length > 36;

  const renderLeftPageContent = (passage: typeof currentPassage, maxWidthClass: string) => {
    const { leftQuotes, leftLineClampClass } = resolveSpreadQuoteLayout(passage, {
      title: featuredBook.title,
      hasCommentary: Boolean(passage.commentary),
    });
    const cleanOpening = leftQuotes[0] || '';
    const cleanSecondary = leftQuotes[1];
    const cleanTertiary = leftQuotes[2];
    const hasSecondary = Boolean(cleanSecondary);

    return (
      <>
        <div
          data-testid="hero-book-left-page-body"
          className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden"
        >
          <div className="shrink-0">
            <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-primary font-bold mb-1.5 pb-1 border-b border-border">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Public Domain
              </span>
              <span>{passage.chapterLabel || featuredBook.volumeNumber}</span>
            </div>

            <div
              data-testid={`hero-3d-copy-meta-${featuredBook.id}`}
              data-copy-book-id={featuredBook.id}
              data-tooltip={`${featuredBook.title} — by ${featuredBook.author}`}
              onClick={(e) => handleCopyBookLinkClick(e, featuredBook.id)}
              onKeyDown={(e) => handleCopyBookLinkClick(e, featuredBook.id)}
              role="button"
              tabIndex={0}
              aria-label={`Copy link to ${featuredBook.title} by ${featuredBook.author}`}
              className="group/copy cursor-pointer rounded-md px-1 py-0.5 mb-1.5 hover:bg-muted/40 transition-colors"
            >
              <h3
                className={`font-serif font-bold leading-snug mb-0.5 text-foreground group-hover/copy:text-primary transition-colors text-balance ${
                  isVeryLongTitle
                    ? 'text-sm sm:text-base'
                    : isLongTitle
                    ? 'text-base sm:text-lg'
                    : 'text-lg sm:text-xl'
                }`}
              >
                {featuredBook.title}
              </h3>
              <p className="text-xs font-mono italic text-muted-foreground flex items-center min-w-0">
                <span className="truncate">
                  by {featuredBook.author} ({featuredBook.year})
                </span>
                <CopyBookLinkIndicator bookId={featuredBook.id} />
              </p>
            </div>
          </div>

          <div
            data-testid="hero-book-left-quotes"
            className={`flex-1 min-h-0 flex flex-col justify-around gap-2 py-0.5 overflow-hidden ${quoteRevealClass}`}
          >
            <div className="relative pl-2.5 sm:pl-3 border-l-2 border-primary/40">
              <p
                className={`font-serif italic text-foreground/90 leading-relaxed text-pretty ${
                  !hasSecondary && !isLongTitle
                    ? 'text-xs sm:text-sm'
                    : isVeryLongTitle
                    ? 'text-xs'
                    : 'text-xs sm:text-[13px]'
                } ${leftLineClampClass}`}
              >
                &ldquo;{cleanOpening}&rdquo;
              </p>
            </div>

            {cleanSecondary && (
              <div
                data-testid="hero-book-secondary-quote"
                className="p-2.5 sm:p-3 rounded-lg bg-card/60 border border-border shadow-xs"
              >
                <Quote className="w-3.5 h-3.5 text-primary/60 mb-1 shrink-0" />
                <p
                  className={`font-serif italic text-foreground leading-relaxed text-pretty ${
                    isLongTitle ? 'text-xs' : 'text-xs sm:text-[13px]'
                  } ${leftLineClampClass}`}
                >
                  &ldquo;{cleanSecondary}&rdquo;
                </p>
              </div>
            )}

            {cleanTertiary && (
              <div
                data-testid="hero-book-tertiary-quote"
                className="p-2.5 sm:p-3 rounded-lg bg-card/60 border border-border shadow-xs"
              >
                <Quote className="w-3.5 h-3.5 text-amber-500/70 mb-1 shrink-0" />
                <p
                  className={`text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed text-pretty ${leftLineClampClass}`}
                >
                  &ldquo;{cleanTertiary}&rdquo;
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-border mt-2 shrink-0">
          <span className={`truncate ${maxWidthClass}`} title={featuredBook.primarySubject}>
            {featuredBook.primarySubject}
          </span>
          <span className="opacity-60">p. 1</span>
        </div>
      </>
    );
  };

  const renderRightPageBody = (passage: typeof currentPassage) => {
    const { rightQuotes, rightLineClampClass } = resolveSpreadQuoteLayout(passage, {
      title: featuredBook.title,
      hasCommentary: Boolean(passage.commentary),
    });
    const cleanPrimary = rightQuotes[0] || '';
    const cleanSecond = rightQuotes[1];
    const cleanThird = rightQuotes[2];

    return (
      <div
        data-testid="hero-book-right-page-body"
        className={`flex-1 min-h-0 flex flex-col justify-around gap-2 py-0.5 overflow-hidden ${quoteRevealClass}`}
      >
        <div className="p-2.5 sm:p-3 rounded-lg bg-card/60 border border-border shadow-xs">
          <Quote className="w-3.5 h-3.5 text-primary/60 mb-1 shrink-0" />
          <p
            className={`text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed text-pretty ${rightLineClampClass}`}
          >
            &ldquo;{cleanPrimary}&rdquo;
          </p>
        </div>

        {cleanSecond && (
          <div
            data-testid="hero-book-right-quote-2"
            className="p-2.5 sm:p-3 rounded-lg bg-card/60 border border-border shadow-xs"
          >
            <Quote className="w-3.5 h-3.5 text-primary/60 mb-1 shrink-0" />
            <p className={`text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed text-pretty ${rightLineClampClass}`}>
              &ldquo;{cleanSecond}&rdquo;
            </p>
          </div>
        )}

        {cleanThird && (
          <div
            data-testid="hero-book-right-quote-3"
            className="p-2.5 sm:p-3 rounded-lg bg-card/60 border border-border shadow-xs"
          >
            <Quote className="w-3.5 h-3.5 text-amber-500/70 mb-1 shrink-0" />
            <p className={`text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed text-pretty ${rightLineClampClass}`}>
              &ldquo;{cleanThird}&rdquo;
            </p>
          </div>
        )}

        {passage.commentary && (
          <p
            data-testid="hero-book-commentary"
            className="text-[11px] font-serif italic text-muted-foreground leading-snug px-1 line-clamp-2"
          >
            {passage.commentary}
          </p>
        )}
      </div>
    );
  };

  return (
    <div
      ref={stageRef}
      style={{
        '--hero-open-scale': kinematics.scale,
        '--hero-open-tx': `${kinematics.tx}px`,
      } as React.CSSProperties}
      className={`relative group cursor-pointer book-3d-stage hero-3d-stage ${
        pinState === 'open' ? 'book-open' : pinState === 'closed' ? 'book-closed' : ''
      }`}
      onClick={handleBookClick}
      onMouseEnter={() => handleHoverChange(true)}
      onMouseLeave={() => handleHoverChange(false)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          togglePinState();
        } else if (e.key === 'ArrowRight' && isBookOpen && !isTurningLeaf) {
          e.preventDefault();
          shuffleNextPassage();
        }
      }}
      aria-label={isBookOpen ? 'Click to close volume' : 'Click to pin open volume'}
    >
      <div className="book-3d-rig relative">
        {/* Desktop Open Book Spread Base (Right Page: straight left spine, rounded right outer edge) */}
        <div className="hidden lg:flex absolute inset-0 rounded-r-lg rounded-l-none open-book-page-right border border-border p-6 flex-col justify-between text-foreground z-0 overflow-hidden">
          <div
            key={`right-page-base-${featuredBook.id}-${activePassageIndex}`}
            className={`${inkWrapperClass} flex flex-col justify-between h-full relative`}
          >
            <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-muted-foreground mb-2 pb-1 border-b border-border shrink-0">
              <span className="truncate pr-2">{currentPassage.chapterLabel || 'Notable Passage'}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="opacity-60">p. 2</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setPinState('closed');
                  }}
                  className="p-0.5 -mr-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  aria-label="Close volume"
                  title="Close volume"
                  data-testid="hero-book-close-btn"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {renderRightPageBody(currentPassage)}

            {/* Right Page Footer Actions */}
            <div className="pt-2.5 mt-1 border-t border-border flex items-center justify-between gap-2 shrink-0">
              <Button
                variant="outline"
                size="chip"
                disabled={isTurningLeaf || passages.length <= 1}
                onClick={(e) => {
                  e.stopPropagation();
                  shuffleNextPassage(e);
                }}
                title="Shuffle to Next Passage in this Book"
                aria-label="Shuffle to Next Passage in this Book"
                data-testid="hero-book-shuffle-btn"
                className="group/shuf"
              >
                <RotateCw
                  className={`w-3 h-3 transition-transform duration-500 ${
                    isTurningLeaf ? 'animate-spin' : 'group-hover/shuf:rotate-180'
                  }`}
                />
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
              <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-muted-foreground mb-2 pb-1 border-b border-border shrink-0">
                <span className="truncate pr-2">{prevPassage.chapterLabel || 'Notable Passage'}</span>
                <span className="opacity-60 shrink-0">p. 2</span>
              </div>

              {renderRightPageBody(prevPassage)}
            </div>

            {/* Back Face of Turning Leaf: Incoming Left Page title & quote landing onto left side */}
            <div className="turning-leaf-face-back rounded-l-lg rounded-r-none open-book-page-left border border-border p-6 flex flex-col justify-between text-foreground overflow-hidden">
              {renderLeftPageContent(currentPassage, 'max-w-[160px]')}
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
              className={`${inkWrapperClass} flex flex-col justify-between h-full relative z-10`}
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
              <div className={`my-3 p-3 rounded bg-stone-900 border border-stone-800 ${quoteRevealClass}`}>
                <p
                  data-testid="hero-book-cover-quote"
                  className={`text-xs font-serif italic text-stone-200 leading-relaxed text-pretty ${currentLayout.coverLineClampClass}`}
                >
                  &ldquo;{currentLayout.coverQuote}&rdquo;
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
              {renderLeftPageContent(isTurningLeaf ? prevPassage : currentPassage, 'max-w-[140px]')}
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
          className={`hidden lg:block absolute -bottom-6 -left-52 -right-12 h-8 bg-black/20 dark:bg-black/50 rounded-full blur-2xl pointer-events-none transition-opacity duration-700 ${
            pinState === 'open' ? 'opacity-100' : pinState === 'closed' ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'
          }`}
        />
      </div>
    </div>
  );
};

