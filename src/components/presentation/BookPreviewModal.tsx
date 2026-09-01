'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles, RotateCw, Quote, BookOpen, Bookmark, Heart, Download } from 'lucide-react';
import type { GutendexBook } from '@/mocks/handlers';
import { getBookPassages, BookPassage } from '@/config/featured-books';
import { extractDynamicBookPassages } from '@/lib/gutenberg-parser';
import { useBookContent } from '@/hooks/queries/useBookContent';
import { extractBookFormats, formatAuthorNames, formatPrimarySubject, formatDownloadCount } from '@/lib/utils';
import { useHydratedBookshelf } from '@/stores/useBookshelfStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export interface ElementRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface BookPreviewModalProps {
  book: GutendexBook | null;
  originRect?: ElementRect | null;
  isOpen: boolean;
  onWillClose?: () => void;
  onClose: () => void;
  onReadBook?: (book: GutendexBook) => void;
}

export const BookPreviewModal: React.FC<BookPreviewModalProps> = ({
  book,
  originRect,
  isOpen,
  onWillClose,
  onClose,
  onReadBook,
}) => {
  const [isGlidedIn, setIsGlidedIn] = useState(false);
  const [isCoverOpen, setIsCoverOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [activePassageIndex, setActivePassageIndex] = useState(0);
  const [prevPassageIndex, setPrevPassageIndex] = useState(0);
  const [prevBookId, setPrevBookId] = useState<number | null>(book?.id ?? null);
  const [isTurningLeaf, setIsTurningLeaf] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  if (book && book.id !== prevBookId) {
    setPrevBookId(book.id);
    setActivePassageIndex(0);
    setPrevPassageIndex(0);
  }

  const { isSaved: checkIsSaved, isLiked: checkIsLiked } = useHydratedBookshelf();
  const isSaved = book ? checkIsSaved(book.id) : false;
  const isLiked = book ? checkIsLiked(book.id) : false;

  // On-demand fetch of authentic book content (strictly enabled ONLY when modal is open and book is clicked)
  const targetBookId = isOpen && book?.id ? book.id : undefined;
  const { data: rawBookText } = useBookContent(undefined, targetBookId);

  const curatedPassages = useMemo(() => {
    return book
      ? getBookPassages({
          id: book.id,
          title: book.title,
          authors: book.authors,
          subjects: book.subjects,
        })
      : [];
  }, [book]);

  const dynamicPassages = useMemo(() => {
    if (book && rawBookText) {
      return extractDynamicBookPassages(rawBookText, {
        id: book.id,
        title: book.title,
        authors: book.authors,
        subjects: book.subjects,
      });
    }
    return [];
  }, [book, rawBookText]);

  // Keep index 0 rock-solid on curated opening quote so text never pops/changes mid-open,
  // while seamlessly supplying live extracted multi-chapter passages for the shuffle queue
  const passages: BookPassage[] = useMemo(() => {
    const baseFirstPassage = curatedPassages[0] || dynamicPassages[0];
    if (!baseFirstPassage) return [];

    if (dynamicPassages.length > 1) {
      return [baseFirstPassage, ...dynamicPassages.slice(1)];
    }

    return curatedPassages.length > 0 ? curatedPassages : [baseFirstPassage];
  }, [curatedPassages, dynamicPassages]);

  const currentPassage = passages[activePassageIndex] || {
    chapterLabel: 'Chapter I',
    openingLine: 'Preserved in the public domain for all readers.',
    quoteExcerpt: 'A timeless literary classic.',
  };

  const prevPassage = passages[prevPassageIndex] || currentPassage;

  // FLIP Origin Rect calculation with 1:1 Pixel-Perfect Dimensions & Continuous 450ms Fluid Landing Curve
  const flipData = React.useMemo(() => {
    if (!originRect || typeof window === 'undefined') {
      return {
        initialTransform: 'translate3d(0px, 0px, 0px)',
        targetTransform: 'translate3d(0px, 0px, 0px)',
        durationMs: 450,
        easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
        targetWidth: 320,
        targetHeight: 480,
      };
    }

    // Exact unscaled natural dimensions of the origin card in the grid
    const targetWidth = originRect.width > 0 ? Math.round(originRect.width) : 320;
    const targetHeight = originRect.height > 0 ? Math.round(originRect.height) : 480;

    // Viewport client dimensions (excluding scrollbars to prevent horizontal pop)
    const clientWidth = document.documentElement.clientWidth || window.innerWidth;
    const clientHeight = window.innerHeight;

    // The modal stage is flex-centered in the viewport
    const targetLeft = Math.round((clientWidth - targetWidth) / 2);
    const targetTop = Math.round((clientHeight - targetHeight) / 2);

    // Delta from modal center to exact origin card position in the document viewport
    const deltaX = Math.round(originRect.left - targetLeft);
    const deltaY = Math.round(originRect.top - targetTop);

    return {
      initialTransform: `translate3d(${deltaX}px, ${deltaY}px, 0px)`,
      targetTransform: 'translate3d(0px, 0px, 0px)',
      durationMs: 450,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      targetWidth,
      targetHeight,
    };
  }, [originRect]);

  // Trigger unified continuous FLIP Glide-to-Center and 3D Cover Opening on Mount
  useEffect(() => {
    if (isOpen && book) {
      let raf2: number;
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
          setIsGlidedIn(true);
          setIsCoverOpen(true);
        });
      });

      return () => {
        cancelAnimationFrame(raf1);
        if (raf2) cancelAnimationFrame(raf2);
      };
    }
  }, [isOpen, book]);

  // Exact Synchronized Reverse of Opening: Cover flips shut while stage glides back simultaneously
  const handleClose = React.useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setIsTurningLeaf(false);
    setIsCoverOpen(false); // Cover rotates -180deg -> 0deg
    setIsGlidedIn(false);  // Stage glides & scales back to card slot

    // Pre-reveal underlying card 160ms before touchdown so it's 100% solid upon modal unmount
    if (onWillClose) {
      setTimeout(() => {
        onWillClose();
      }, Math.max(0, flipData.durationMs - 160));
    }

    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, flipData.durationMs);
  }, [isClosing, onClose, onWillClose, flipData.durationMs]);

  const handleShuffle = React.useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isTurningLeaf || passages.length <= 1) return;
    setPrevPassageIndex(activePassageIndex);
    setActivePassageIndex((prev) => (prev + 1) % passages.length);
    setIsTurningLeaf(true);
  }, [isTurningLeaf, passages.length, activePassageIndex]);

  // Freeze background scrolling without modifying body dimensions or scrollbars (zero layout shift)
  useEffect(() => {
    if (!isOpen || !book) return;

    const preventScroll = (e: Event) => {
      e.preventDefault();
    };

    window.addEventListener('wheel', preventScroll, { passive: false });
    window.addEventListener('touchmove', preventScroll, { passive: false });

    return () => {
      window.removeEventListener('wheel', preventScroll);
      window.removeEventListener('touchmove', preventScroll);
    };
  }, [isOpen, book]);

  // Keyboard navigation: Escape to close, ArrowRight to shuffle
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowRight' && !isTurningLeaf) {
        handleShuffle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isTurningLeaf, handleClose, handleShuffle]);

  if (!isOpen || !book) return null;

  const authorNames = formatAuthorNames(book.authors) || 'Anonymous';
  const primarySubject = formatPrimarySubject(book.subjects, 24);
  const formats = extractBookFormats(book.formats);

  // Click on book stage: Close if not clicking interactive buttons
  const handleBookStageClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('a') || target.closest('input')) {
      return;
    }
    handleClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden select-none overscroll-none"
      onClick={handleClose}
      onWheel={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${book.title}`}
      data-testid="book-preview-modal"
    >
      {/* Soft Ambient Backdrop: Fades smoothly in on open and out on close */}
      <div
        className={`absolute inset-0 bg-background/50 dark:bg-black/60 backdrop-blur-sm pointer-events-none transition-all duration-700 ease-out ${
          isGlidedIn && !isClosing ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Modal Viewport Container */}
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl mx-auto flex flex-col items-center justify-center py-2 z-10"
      >
        {/* 3D Realistic Stage with FLIP transition */}
        <div
          className={`relative cursor-pointer book-3d-stage modal-preview-3d-stage ${
            isCoverOpen ? 'book-open' : 'book-closed'
          }`}
          style={{
            width: flipData.targetWidth ? `${flipData.targetWidth}px` : undefined,
            height: flipData.targetHeight ? `${flipData.targetHeight}px` : undefined,
            transform: isGlidedIn ? flipData.targetTransform : flipData.initialTransform,
            transition: `transform ${flipData.durationMs}ms ${flipData.easing}`,
          }}
          onClick={handleBookStageClick}
          data-testid="preview-book-stage"
          title="Click to flip open or close volume"
        >
          {/* Standing Perspective Drop Shadows */}
          <div
            className={`hidden lg:block absolute -bottom-7 -left-72 -right-12 h-10 bg-black/40 dark:bg-black/85 [html.sepia_&]:bg-black/75 rounded-full blur-2xl pointer-events-none transition-opacity duration-500 ${
              isCoverOpen ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`hidden lg:block absolute -bottom-3 left-2 right-2 h-6 bg-black/50 dark:bg-black/90 [html.sepia_&]:bg-black/80 rounded-full blur-md pointer-events-none transition-opacity duration-500 ${
              isCoverOpen ? 'opacity-100' : 'opacity-0'
            }`}
          />
          {/* Closed State Perspective Floor Shadow: Dissolves into flat card resting shadow as it docks into grid */}
          <div
            className={`absolute -bottom-4 left-6 right-6 h-6 bg-black/35 dark:bg-black/80 [html.sepia_&]:bg-black/70 rounded-full blur-xl pointer-events-none transition-opacity duration-300 ${
              isGlidedIn && !isCoverOpen ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* 3D Rig */}
          <div className="book-3d-rig relative">
            {/* Desktop Open Book Spread Base (Right Page: only visible when spread is open to prevent corner bleed on close) */}
            <div className={`hidden lg:flex absolute inset-0 rounded-r-lg rounded-l-none open-book-page-right border border-border p-6 flex-col justify-between text-foreground z-0 overflow-hidden transition-opacity duration-300 ${
              isCoverOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}>
              <div key={`right-page-base-${book.id}-${activePassageIndex}`} className="animate-ink-appear flex flex-col justify-between h-full relative">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-muted-foreground pb-1 border-b border-border">
                    <span>Notable Passages</span>
                    <span className="text-success font-bold uppercase">CC0 / Free</span>
                  </div>

                  {/* Primary Quote Box (Matches HeroSearch 1:1) */}
                  <div className="p-3.5 rounded-lg bg-card/60 border border-border shadow-xs">
                    <Quote className="w-4 h-4 text-primary/60 mb-1.5 shrink-0" />
                    <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-5 text-pretty">
                      {currentPassage.quoteExcerpt}
                    </p>
                  </div>

                  {/* Secondary Book Quote Box */}
                  {currentPassage.rightPageQuote2 && (
                    <div className="p-3.5 rounded-lg bg-card/60 border border-border shadow-xs">
                      <Quote className="w-4 h-4 text-primary/60 mb-1.5 shrink-0" />
                      <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-4 text-pretty">
                        {currentPassage.rightPageQuote2}
                      </p>
                    </div>
                  )}

                  {/* Tertiary Book Quote Box */}
                  {currentPassage.tertiaryQuote && (
                    <div className="p-3.5 rounded-lg bg-card/60 border border-border shadow-xs">
                      <Quote className="w-4 h-4 text-amber-500/70 mb-1.5 shrink-0" />
                      <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-3 text-pretty">
                        {currentPassage.tertiaryQuote}
                      </p>
                    </div>
                  )}
                </div>

                {/* Right Page Footer Actions */}
                <div className="pt-2.5 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="chip"
                    onClick={handleShuffle}
                    disabled={isTurningLeaf || passages.length <= 1}
                    title="Shuffle through passages from this volume"
                    aria-label="Shuffle passage"
                    className="group/shuf"
                  >
                    <RotateCw className={`w-3 h-3 transition-transform duration-500 ${isTurningLeaf ? 'animate-spin' : 'group-hover/shuf:rotate-180'}`} />
                    <span>Shuffle</span>
                  </Button>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground opacity-60">p. 2</span>
                    {onReadBook && (
                      <Button
                        variant="primary"
                        size="chip"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClose();
                          onReadBook(book);
                        }}
                        aria-label={`Read ${book.title}`}
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        <span>Read</span>
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Physical 3D Turning Leaf (Flips Right to Left across the spine on shuffle on desktop: 0deg -> -180deg) */}
            {isTurningLeaf && (
              <div
                key={`turning-leaf-${book.id}-${activePassageIndex}`}
                className="hidden lg:block book-turning-leaf"
                onAnimationEnd={() => setIsTurningLeaf(false)}
              >
                {/* Front Face of Turning Leaf: Outgoing Right Page quotes lifting away */}
                <div className="turning-leaf-face-front rounded-r-lg rounded-l-none open-book-page-right border border-border p-6 flex flex-col justify-between text-foreground overflow-hidden">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-muted-foreground pb-1 border-b border-border">
                      <span>Notable Passages</span>
                      <span className="text-success font-bold uppercase">CC0 / Free</span>
                    </div>

                    <div className="p-3.5 rounded-lg bg-card/60 border border-border shadow-xs">
                      <Quote className="w-4 h-4 text-primary/60 mb-1.5 shrink-0" />
                      <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-5">
                        {prevPassage.quoteExcerpt}
                      </p>
                    </div>

                    {prevPassage.rightPageQuote2 && (
                      <div className="p-3.5 rounded-lg bg-card/60 border border-border shadow-xs">
                        <Quote className="w-4 h-4 text-primary/60 mb-1.5 shrink-0" />
                        <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-4">
                          {prevPassage.rightPageQuote2}
                        </p>
                      </div>
                    )}

                    {prevPassage.tertiaryQuote && (
                      <div className="p-3.5 rounded-lg bg-card/60 border border-border shadow-xs">
                        <Quote className="w-4 h-4 text-amber-500/70 mb-1.5 shrink-0" />
                        <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-3">
                          {prevPassage.tertiaryQuote}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-end text-[10px] font-mono text-muted-foreground border-t border-border">
                    <span className="opacity-60">p. 2</span>
                  </div>
                </div>

                {/* Back Face of Turning Leaf: Incoming Left Page title & quotes landing onto left side */}
                <div className="turning-leaf-face-back rounded-l-lg rounded-r-none open-book-page-left border border-border p-6 flex flex-col justify-between text-foreground overflow-hidden">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-primary font-bold pb-1 border-b border-border">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Public Domain
                      </span>
                      <span>ID #{book.id}</span>
                    </div>

                    <div>
                      <h3 className="text-xl sm:text-2xl font-serif font-bold leading-tight mb-1 text-foreground text-balance">
                        {book.title}
                      </h3>
                      <p className="text-xs font-mono italic text-muted-foreground">
                        by {authorNames}
                      </p>
                    </div>

                    <div className="relative pl-3 border-l-2 border-primary/50 my-1">
                      <p className="text-xs sm:text-[13px] font-serif italic text-foreground/90 leading-relaxed line-clamp-5 text-pretty">
                        &ldquo;{currentPassage.openingLine}&rdquo;
                      </p>
                    </div>

                    {currentPassage.secondaryQuote && (
                      <div className="p-3.5 rounded-lg bg-card/60 border border-border shadow-xs">
                        <Quote className="w-4 h-4 text-primary/60 mb-1.5 shrink-0" />
                        <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-4">
                          {currentPassage.secondaryQuote}
                        </p>
                      </div>
                    )}

                    {currentPassage.leftPageQuote2 && (
                      <div className="p-3.5 rounded-lg bg-card/60 border border-border shadow-xs">
                        <Quote className="w-4 h-4 text-amber-500/70 mb-1.5 shrink-0" />
                        <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-3">
                          {currentPassage.leftPageQuote2}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-border">
                    <span className="truncate max-w-[160px]">{primarySubject}</span>
                    <span className="opacity-60">p. 1</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3D Flipping Front Cover (Hinged on Left Spine: 0deg -> -180deg) */}
            <div
              className="relative book-3d-flipper z-10"
              style={{
                width: flipData.targetWidth ? `${flipData.targetWidth}px` : undefined,
                height: flipData.targetHeight ? `${flipData.targetHeight}px` : undefined,
                aspectRatio: !flipData.targetHeight ? '2/3' : undefined,
              }}
            >
              
              {/* FRONT FACE: THE EXACT CARD FROM FEATURED PUBLIC DOMAIN BOOKS (Closed State) */}
              <div
                className="absolute inset-0 book-3d-face-front rounded-xl bg-card border border-border shadow-booksaw flex flex-col justify-between text-foreground overflow-hidden cursor-pointer group"
                title="Click to flip open or close volume"
              >
                {/* 3D Spine & Page Edge Accents: Dissolve smoothly into flat card as it docks into grid */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-black/40 via-black/20 to-transparent rounded-l-xl pointer-events-none z-30 transition-opacity duration-400 ${
                    isGlidedIn ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                <div
                  className={`absolute right-0 top-1 bottom-1 w-2 bg-gradient-to-l from-black/10 dark:from-white/20 to-transparent pointer-events-none z-30 transition-opacity duration-400 ${
                    isGlidedIn ? 'opacity-100' : 'opacity-0'
                  }`}
                />

                {/* Top Cover Visual with Booksaw Directional Depth */}
                <div className="relative aspect-[3/4] w-full bg-muted/60 overflow-hidden flex items-center justify-center p-2.5 sm:p-3 border-b border-border select-none">
                  {formats.coverImage ? (
                    <div className="relative w-full h-full flex items-center justify-center group-hover:scale-[1.03] transition-transform duration-300">
                      <img
                        src={formats.coverImage}
                        alt={`Cover of ${book.title}`}
                        className="max-w-full max-h-full w-auto h-auto object-contain rounded-sm shadow-md"
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

                  {/* Top-Left Hover Affordance: Click for Preview */}
                  <div className="absolute top-0 left-0 z-20 hidden lg:flex opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                    <span className="inline-flex items-center gap-1 text-[9px] font-mono font-bold bg-primary text-primary-foreground px-2.5 py-1 rounded-tl-xl rounded-br-md rounded-tr-none rounded-bl-none shadow-xs tracking-wider uppercase">
                      Click for Preview 📖
                    </span>
                  </div>

                  {/* Quick Action Overlay Badges */}
                  <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-20">
                    <div
                      className={`p-1.5 rounded-full shadow-xs ${
                        isLiked ? 'bg-destructive text-destructive-foreground scale-105' : 'bg-card text-muted-foreground'
                      }`}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isLiked ? 'fill-current' : ''}`} />
                    </div>

                    <div
                      className={`p-1.5 rounded-full shadow-xs ${
                        isSaved ? 'bg-primary text-primary-foreground scale-105' : 'bg-card text-muted-foreground'
                      }`}
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-current' : ''}`} />
                    </div>
                  </div>

                  {/* Subject Pill */}
                  <div className="absolute bottom-2.5 left-2.5 z-20 flex items-center gap-1.5">
                    <Badge variant="outline" size="sm" className="bg-card text-[10px] border-border text-foreground font-mono uppercase group-hover:border-primary/60 transition-colors">
                      {primarySubject}
                    </Badge>
                  </div>
                </div>

                {/* Book Metadata Content */}
                <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="font-serif font-bold text-foreground text-sm sm:text-base leading-snug line-clamp-2 mb-1 group-hover:text-primary transition-colors text-balance">
                      {book.title}
                    </h3>
                    <p className="text-xs text-muted-foreground font-sans line-clamp-1">
                      {authorNames}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border text-xs text-muted-foreground">
                    <span className="font-mono text-[11px]">{formatDownloadCount(book.download_count)} reads</span>
                    <span className="text-[10px] font-mono font-medium tracking-wider text-success uppercase">
                      CC0 / Free
                    </span>
                  </div>

                  {/* Action Buttons (Matches BookCard layout 1:1 via UI Button) */}
                  <div className="grid grid-cols-2 gap-2 mt-0.5 pointer-events-none">
                    <Button
                      variant="primary"
                      size="chip"
                      className="w-full"
                      tabIndex={-1}
                      aria-hidden="true"
                    >
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Read</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="chip"
                      className="w-full"
                      tabIndex={-1}
                      aria-hidden="true"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Get</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* BACK FACE OF FRONT COVER: THE LEFT OPEN PAGE (Inside Spread) */}
              <div className="absolute inset-0 book-3d-face-back rounded-l-lg rounded-r-none open-book-page-left border border-border p-6 flex flex-col justify-between text-foreground overflow-hidden">
                <div key={`left-page-content-${book.id}-${isTurningLeaf ? prevPassageIndex : activePassageIndex}`} className="flex flex-col justify-between h-full relative">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-primary font-bold pb-1 border-b border-border">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Public Domain
                      </span>
                      <span>ID #{book.id}</span>
                    </div>

                    <div>
                      <h3 className="text-xl sm:text-2xl font-serif font-bold leading-tight mb-1 text-foreground text-balance">
                        {book.title}
                      </h3>
                      <p className="text-xs font-mono italic text-muted-foreground">
                        by {authorNames}
                      </p>
                    </div>

                    <div className="relative pl-3 border-l-2 border-primary/50 my-1">
                      <p className="text-xs sm:text-[13px] font-serif italic text-foreground/90 leading-relaxed line-clamp-5 text-pretty">
                        &ldquo;{isTurningLeaf ? prevPassage.openingLine : currentPassage.openingLine}&rdquo;
                      </p>
                    </div>

                    {(isTurningLeaf ? prevPassage.secondaryQuote : currentPassage.secondaryQuote) && (
                      <div className="p-3.5 rounded-lg bg-card/60 border border-border shadow-xs">
                        <Quote className="w-4 h-4 text-primary/60 mb-1.5 shrink-0" />
                        <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-4">
                          {isTurningLeaf ? prevPassage.secondaryQuote : currentPassage.secondaryQuote}
                        </p>
                      </div>
                    )}

                    {(isTurningLeaf ? prevPassage.leftPageQuote2 : currentPassage.leftPageQuote2) && (
                      <div className="p-3.5 rounded-lg bg-card/60 border border-border shadow-xs">
                        <Quote className="w-4 h-4 text-amber-500/70 mb-1.5 shrink-0" />
                        <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-3">
                          {isTurningLeaf ? prevPassage.leftPageQuote2 : currentPassage.leftPageQuote2}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-border">
                    <span className="truncate max-w-[160px]">{primarySubject}</span>
                    <span className="opacity-60">p. 1</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

