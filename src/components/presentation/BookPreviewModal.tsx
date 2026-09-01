'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Sparkles, RotateCw, Quote, BookOpen } from 'lucide-react';
import type { GutendexBook } from '@/mocks/handlers';
import { getBookPassages, BookPassage } from '@/config/featured-books';
import { extractDynamicBookPassages } from '@/lib/gutenberg-parser';
import { useBookContent } from '@/hooks/queries/useBookContent';
import { formatAuthorNames, formatPrimarySubject } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { BookCard } from './BookCard';

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
            <div className={`hidden lg:flex absolute inset-0 rounded-r-lg rounded-l-none open-book-page-right border border-border p-4 sm:p-5 flex-col justify-between text-foreground z-0 overflow-hidden transition-opacity duration-300 ${
              isCoverOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}>
              <div key={`right-page-base-${book.id}-${activePassageIndex}`} className="animate-ink-appear flex flex-col justify-between h-full relative">
                {(() => {
                  const rightQuotesCount = 1 + (currentPassage.rightPageQuote2 ? 1 : 0) + (currentPassage.tertiaryQuote ? 1 : 0);
                  return (
                    <div className="flex-1 min-h-0 flex flex-col justify-between overflow-y-auto no-scrollbar">
                      <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-muted-foreground pb-1 border-b border-border shrink-0">
                        <span>Notable Passages</span>
                        <span className="text-success font-bold uppercase">CC0 / Free</span>
                      </div>

                      <div className="flex-1 min-h-0 flex flex-col justify-around gap-2.5 py-1">
                        {/* Primary Quote Box */}
                        <div className={`rounded-lg bg-card/60 border border-border shadow-xs ${
                          rightQuotesCount === 1 ? 'p-4 sm:p-4.5' : 'p-2.5 sm:p-3'
                        }`}>
                          <Quote className={`${rightQuotesCount === 1 ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-primary/60 mb-1.5 shrink-0`} />
                          <p className={`font-serif italic text-foreground leading-relaxed text-pretty ${
                            rightQuotesCount === 1
                              ? 'text-xs sm:text-sm line-clamp-8 sm:line-clamp-9'
                              : rightQuotesCount === 2
                              ? 'text-xs sm:text-[13px] line-clamp-5'
                              : 'text-xs sm:text-[13px] line-clamp-4'
                          }`}>
                            {currentPassage.quoteExcerpt}
                          </p>
                        </div>

                        {/* Secondary Book Quote Box */}
                        {currentPassage.rightPageQuote2 && (
                          <div className={`rounded-lg bg-card/60 border border-border shadow-xs ${
                            rightQuotesCount === 2 ? 'p-3 sm:p-3.5' : 'p-2.5 sm:p-3'
                          }`}>
                            <Quote className="w-3.5 h-3.5 text-primary/60 mb-1.5 shrink-0" />
                            <p className={`font-serif italic text-foreground leading-relaxed text-pretty ${
                              rightQuotesCount === 2
                                ? 'text-xs sm:text-[13px] line-clamp-5'
                                : 'text-xs sm:text-[13px] line-clamp-3'
                            }`}>
                              {currentPassage.rightPageQuote2}
                            </p>
                          </div>
                        )}

                        {/* Tertiary Book Quote Box */}
                        {currentPassage.tertiaryQuote && (
                          <div className="p-2.5 sm:p-3 rounded-lg bg-card/60 border border-border shadow-xs">
                            <Quote className="w-3.5 h-3.5 text-amber-500/70 mb-1 shrink-0" />
                            <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-2 text-pretty">
                              {currentPassage.tertiaryQuote}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Right Page Footer Actions */}
                <div className="pt-2 border-t border-border flex items-center justify-between gap-2 mt-2 shrink-0">
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
                <div className="turning-leaf-face-front rounded-r-lg rounded-l-none open-book-page-right border border-border p-4 sm:p-5 flex flex-col justify-between text-foreground overflow-hidden">
                  {(() => {
                    const rightQuotesCount = 1 + (prevPassage.rightPageQuote2 ? 1 : 0) + (prevPassage.tertiaryQuote ? 1 : 0);
                    return (
                      <div className="flex-1 min-h-0 flex flex-col justify-between overflow-y-auto no-scrollbar">
                        <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-muted-foreground pb-1 border-b border-border shrink-0">
                          <span>Notable Passages</span>
                          <span className="text-success font-bold uppercase">CC0 / Free</span>
                        </div>

                        <div className="flex-1 min-h-0 flex flex-col justify-around gap-2.5 py-1">
                          <div className={`rounded-lg bg-card/60 border border-border shadow-xs ${
                            rightQuotesCount === 1 ? 'p-4 sm:p-4.5' : 'p-2.5 sm:p-3'
                          }`}>
                            <Quote className={`${rightQuotesCount === 1 ? 'w-4 h-4' : 'w-3.5 h-3.5'} text-primary/60 mb-1.5 shrink-0`} />
                            <p className={`font-serif italic text-foreground leading-relaxed ${
                              rightQuotesCount === 1
                                ? 'text-xs sm:text-sm line-clamp-8 sm:line-clamp-9'
                                : rightQuotesCount === 2
                                ? 'text-xs sm:text-[13px] line-clamp-5'
                                : 'text-xs sm:text-[13px] line-clamp-4'
                            }`}>
                              {prevPassage.quoteExcerpt}
                            </p>
                          </div>

                          {prevPassage.rightPageQuote2 && (
                            <div className={`rounded-lg bg-card/60 border border-border shadow-xs ${
                              rightQuotesCount === 2 ? 'p-3 sm:p-3.5' : 'p-2.5 sm:p-3'
                            }`}>
                              <Quote className="w-3.5 h-3.5 text-primary/60 mb-1.5 shrink-0" />
                              <p className={`font-serif italic text-foreground leading-relaxed ${
                                rightQuotesCount === 2
                                  ? 'text-xs sm:text-[13px] line-clamp-5'
                                  : 'text-xs sm:text-[13px] line-clamp-3'
                              }`}>
                                {prevPassage.rightPageQuote2}
                              </p>
                            </div>
                          )}

                          {prevPassage.tertiaryQuote && (
                            <div className="p-2.5 sm:p-3 rounded-lg bg-card/60 border border-border shadow-xs">
                              <Quote className="w-3.5 h-3.5 text-amber-500/70 mb-1 shrink-0" />
                              <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-2">
                                {prevPassage.tertiaryQuote}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="pt-2 flex items-center justify-end text-[10px] font-mono text-muted-foreground border-t border-border mt-2 shrink-0">
                    <span className="opacity-60">p. 2</span>
                  </div>
                </div>

                {/* Back Face of Turning Leaf: Incoming Left Page title & quotes landing onto left side */}
                <div className="turning-leaf-face-back rounded-l-lg rounded-r-none open-book-page-left border border-border p-4 sm:p-5 flex flex-col justify-between text-foreground overflow-hidden">
                  {(() => {
                    const isVeryLongTitle = book.title.length > 55;
                    const isLongTitle = book.title.length > 36;
                    const hasSecondary = Boolean(currentPassage.secondaryQuote);
                    const hasTertiary = Boolean(currentPassage.leftPageQuote2) && !isLongTitle;

                    return (
                      <div className="flex-1 min-h-0 flex flex-col justify-between overflow-y-auto no-scrollbar">
                        <div className="space-y-1.5 shrink-0">
                          <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-primary font-bold pb-1 border-b border-border">
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Public Domain
                            </span>
                            <span>ID #{book.id}</span>
                          </div>

                          <div>
                            <h3 className={`font-serif font-bold leading-snug mb-0.5 text-foreground text-balance ${
                              isVeryLongTitle ? 'text-sm sm:text-base' : isLongTitle ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'
                            }`}>
                              {book.title}
                            </h3>
                            <p className="text-xs font-mono italic text-muted-foreground">
                              by {authorNames}
                            </p>
                          </div>
                        </div>

                        <div className="flex-1 min-h-0 flex flex-col justify-around gap-2 py-0.5">
                          {/* Lead Opening Line */}
                          <div className="relative pl-2.5 sm:pl-3 border-l-2 border-primary/50">
                            <p className={`font-serif italic text-foreground/90 leading-relaxed text-pretty ${
                              !hasSecondary && !isLongTitle
                                ? 'text-xs sm:text-sm line-clamp-6 sm:line-clamp-7'
                                : isVeryLongTitle
                                ? 'text-xs line-clamp-3'
                                : isLongTitle
                                ? 'text-xs sm:text-[13px] line-clamp-4'
                                : 'text-xs sm:text-[13px] line-clamp-4'
                            }`}>
                              &ldquo;{currentPassage.openingLine}&rdquo;
                            </p>
                          </div>

                          {/* Secondary Quote Box */}
                          {currentPassage.secondaryQuote && (
                            <div className="p-2.5 sm:p-3 rounded-lg bg-card/60 border border-border shadow-xs">
                              <Quote className="w-3.5 h-3.5 text-primary/60 mb-1 shrink-0" />
                              <p className={`font-serif italic text-foreground leading-relaxed ${
                                !hasTertiary && !isLongTitle
                                  ? 'text-xs sm:text-[13px] line-clamp-4'
                                  : isLongTitle
                                  ? 'text-xs line-clamp-2'
                                  : 'text-xs sm:text-[13px] line-clamp-3'
                              }`}>
                                {currentPassage.secondaryQuote}
                              </p>
                            </div>
                          )}

                          {/* Tertiary Quote Box */}
                          {currentPassage.leftPageQuote2 && !isLongTitle && (
                            <div className="p-2.5 sm:p-3 rounded-lg bg-card/60 border border-border shadow-xs">
                              <Quote className="w-3.5 h-3.5 text-amber-500/70 mb-1 shrink-0" />
                              <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-2">
                                {currentPassage.leftPageQuote2}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-border mt-2 shrink-0">
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
              
              {/* FRONT FACE: THE EXACT SHARED CARD (Automatic Synchronized Layout) */}
              <div
                className="absolute inset-0 book-3d-face-front rounded-xl overflow-hidden cursor-pointer group"
                title="Click to flip open or close volume"
              >
                <div className="w-full h-full pointer-events-none">
                  <BookCard book={book} />
                </div>

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
              </div>

              {/* BACK FACE OF FRONT COVER: THE LEFT OPEN PAGE (Inside Spread) */}
              <div className="absolute inset-0 book-3d-face-back rounded-l-lg rounded-r-none open-book-page-left border border-border p-4 sm:p-5 flex flex-col justify-between text-foreground overflow-hidden">
                <div key={`left-page-content-${book.id}-${isTurningLeaf ? prevPassageIndex : activePassageIndex}`} className="flex flex-col justify-between h-full relative">
                  {(() => {
                    const isVeryLongTitle = book.title.length > 55;
                    const isLongTitle = book.title.length > 36;
                    const hasSecondary = Boolean(isTurningLeaf ? prevPassage.secondaryQuote : currentPassage.secondaryQuote);
                    const hasTertiary = Boolean(isTurningLeaf ? prevPassage.leftPageQuote2 : currentPassage.leftPageQuote2) && !isLongTitle;

                    return (
                      <div className="flex-1 min-h-0 flex flex-col justify-between overflow-y-auto no-scrollbar">
                        <div className="space-y-1.5 shrink-0">
                          <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-primary font-bold pb-1 border-b border-border">
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-3 h-3" /> Public Domain
                            </span>
                            <span>ID #{book.id}</span>
                          </div>

                          <div>
                            <h3 className={`font-serif font-bold leading-snug mb-0.5 text-foreground text-balance ${
                              isVeryLongTitle ? 'text-sm sm:text-base' : isLongTitle ? 'text-base sm:text-lg' : 'text-lg sm:text-xl'
                            }`}>
                              {book.title}
                            </h3>
                            <p className="text-xs font-mono italic text-muted-foreground">
                              by {authorNames}
                            </p>
                          </div>
                        </div>

                        <div className="flex-1 min-h-0 flex flex-col justify-around gap-2 py-0.5">
                          {/* Lead Opening Line */}
                          <div className="relative pl-2.5 sm:pl-3 border-l-2 border-primary/50">
                            <p className={`font-serif italic text-foreground/90 leading-relaxed text-pretty ${
                              !hasSecondary && !isLongTitle
                                ? 'text-xs sm:text-sm line-clamp-6 sm:line-clamp-7'
                                : isVeryLongTitle
                                ? 'text-xs line-clamp-3'
                                : isLongTitle
                                ? 'text-xs sm:text-[13px] line-clamp-4'
                                : 'text-xs sm:text-[13px] line-clamp-4'
                            }`}>
                              &ldquo;{isTurningLeaf ? prevPassage.openingLine : currentPassage.openingLine}&rdquo;
                            </p>
                          </div>

                          {/* Secondary Quote Box */}
                          {(isTurningLeaf ? prevPassage.secondaryQuote : currentPassage.secondaryQuote) && (
                            <div className="p-2.5 sm:p-3 rounded-lg bg-card/60 border border-border shadow-xs">
                              <Quote className="w-3.5 h-3.5 text-primary/60 mb-1 shrink-0" />
                              <p className={`font-serif italic text-foreground leading-relaxed ${
                                !hasTertiary && !isLongTitle
                                  ? 'text-xs sm:text-[13px] line-clamp-4'
                                  : isLongTitle
                                  ? 'text-xs line-clamp-2'
                                  : 'text-xs sm:text-[13px] line-clamp-3'
                              }`}>
                                {isTurningLeaf ? prevPassage.secondaryQuote : currentPassage.secondaryQuote}
                              </p>
                            </div>
                          )}

                          {/* Tertiary Quote Box */}
                          {(isTurningLeaf ? prevPassage.leftPageQuote2 : currentPassage.leftPageQuote2) && !isLongTitle && (
                            <div className="p-2.5 sm:p-3 rounded-lg bg-card/60 border border-border shadow-xs">
                              <Quote className="w-3.5 h-3.5 text-amber-500/70 mb-1 shrink-0" />
                              <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-2">
                                {isTurningLeaf ? prevPassage.leftPageQuote2 : currentPassage.leftPageQuote2}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-muted-foreground border-t border-border mt-2 shrink-0">
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

