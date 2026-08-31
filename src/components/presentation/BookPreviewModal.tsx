'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ArrowRight, RotateCw, Quote, Download, BookOpen, Bookmark, Heart } from 'lucide-react';
import type { GutendexBook } from '@/mocks/handlers';
import { getBookPassages, BookPassage } from '@/config/featured-books';
import { extractBookFormats, formatDownloadCount, truncate } from '@/lib/utils';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { Badge } from '@/components/ui/Badge';

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
  onClose: () => void;
  onReadBook?: (book: GutendexBook) => void;
  onDownloadBook?: (book: GutendexBook) => void;
}

export const BookPreviewModal: React.FC<BookPreviewModalProps> = ({
  book,
  originRect: _originRect,
  isOpen,
  onClose,
  onReadBook,
  onDownloadBook,
}) => {
  const [isCoverOpen, setIsCoverOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [activePassageIndex, setActivePassageIndex] = useState(0);
  const [prevPassageIndex, setPrevPassageIndex] = useState(0);
  const [isTurningLeaf, setIsTurningLeaf] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  const isSaved = useBookshelfStore((s) => (book ? s.isBookSaved(book.id) : false));
  const isLiked = useBookshelfStore((s) => (book ? s.isBookLiked(book.id) : false));

  const passages: BookPassage[] = book
    ? getBookPassages({
        id: book.id,
        title: book.title,
        authors: book.authors,
        subjects: book.subjects,
      })
    : [];

  const currentPassage = passages[activePassageIndex] || {
    chapterLabel: 'Chapter I',
    openingLine: 'Preserved in the public domain for all readers.',
    quoteExcerpt: 'A timeless literary classic.',
  };

  const prevPassage = passages[prevPassageIndex] || currentPassage;

  // Trigger Bring-to-Front Zoom-In and 3D Cover Opening on Mount
  useEffect(() => {
    if (isOpen && book) {
      const coverTimer = setTimeout(() => {
        setIsCoverOpen(true);
      }, 50);

      return () => clearTimeout(coverTimer);
    }
  }, [isOpen, book]);

  // Smooth Closing Transition: Swing Cover shut then Zoom Back to Origin Card
  const handleClose = React.useCallback(() => {
    if (isClosing) return;
    setIsClosing(true);
    setIsCoverOpen(false); // Swing cover shut (rotateY: 0deg)

    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 500);
  }, [isClosing, onClose]);

  const handleShuffle = React.useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isTurningLeaf || passages.length <= 1) return;
    setPrevPassageIndex(activePassageIndex);
    setActivePassageIndex((prev) => (prev + 1) % passages.length);
    setIsTurningLeaf(true);
  }, [isTurningLeaf, passages.length, activePassageIndex]);

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

  const authorNames =
    book.authors.map((a: { name: string }) => a.name.split(',').reverse().join(' ').trim()).join(', ') ||
    'Anonymous';
  const primarySubject = book.subjects[0]
    ? truncate(book.subjects[0].split('--')[0].trim(), 24)
    : 'Classic';
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
      className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden transition-all duration-400 ${
        !isClosing ? 'bg-transparent opacity-100' : 'bg-transparent opacity-0 pointer-events-none'
      }`}
      onClick={handleClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Preview of ${book.title}`}
      data-testid="book-preview-modal"
    >
      {/* Modal Viewport Container */}
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl mx-auto flex flex-col items-center justify-center py-2 select-none"
      >
        {/* 3D Realistic Stage */}
        <div
          className={`relative cursor-pointer book-3d-stage modal-preview-3d-stage ${isCoverOpen ? 'book-open' : 'book-closed'}`}
          onClick={handleBookStageClick}
          data-testid="preview-book-stage"
          title="Click to flip open or close volume"
        >
          {/* Standing Perspective Drop Shadows */}
          <div
            className={`absolute -bottom-8 -left-32 -right-32 h-14 bg-black/35 dark:bg-black/75 [html.sepia_&]:bg-black/65 rounded-full blur-3xl pointer-events-none transition-opacity duration-700 ${
              isCoverOpen ? 'opacity-100' : 'opacity-0'
            }`}
          />
          <div
            className={`absolute -bottom-3 left-4 right-4 h-5 bg-black/40 dark:bg-black/85 [html.sepia_&]:bg-black/75 rounded-full blur-md pointer-events-none transition-opacity duration-700 ${
              isCoverOpen ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* 3D Rig */}
          <div className="book-3d-rig relative">
            {/* Desktop Open Book Spread Base (Right Page: straight left spine, rounded right outer edge) */}
            <div className="flex absolute inset-0 rounded-r-xl rounded-l-none open-book-page-right border border-border p-6 sm:p-7 flex-col justify-between text-foreground z-0 overflow-hidden shadow-2xl">
              <div key={`right-page-base-${book.id}-${activePassageIndex}`} className="animate-ink-appear flex flex-col justify-between h-full relative">
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-muted-foreground mb-3 pb-1 border-b border-border">
                    <span>{currentPassage.chapterLabel}</span>
                    <span className="text-emerald-700 dark:text-emerald-400 [html.sepia_&]:text-emerald-400 font-bold uppercase">
                      CC0 / Free
                    </span>
                  </div>

                  <div className="p-3.5 sm:p-4 rounded-xl bg-card/60 border border-border shadow-xs mb-2">
                    <Quote className="w-4 h-4 text-primary/70 mb-1.5 shrink-0" />
                    <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-8">
                      &ldquo;{currentPassage.quoteExcerpt}&rdquo;
                    </p>
                  </div>
                </div>

                {/* Right Page Footer Actions (Shuffle, Download, Read) */}
                <div className="pt-2.5 border-t border-border flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleShuffle}
                    disabled={isTurningLeaf || passages.length <= 1}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted transition-colors cursor-pointer disabled:opacity-50 group/shuf"
                    title="Shuffle through passages from this volume"
                    aria-label="Shuffle passage"
                  >
                    <RotateCw className={`w-3.5 h-3.5 transition-transform duration-500 ${isTurningLeaf ? 'animate-spin' : 'group-hover/shuf:rotate-180'}`} />
                    <span>Shuffle</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {onDownloadBook && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClose();
                          onDownloadBook(book);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-mono font-medium text-foreground bg-muted hover:bg-muted/80 px-2.5 py-1.5 rounded-lg border border-border transition-colors cursor-pointer"
                        aria-label="Download formats"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Get</span>
                      </button>
                    )}

                    {onReadBook && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClose();
                          onReadBook(book);
                        }}
                        className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-primary-foreground bg-primary hover:opacity-90 px-3.5 py-1.5 rounded-lg shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        aria-label={`Read ${book.title}`}
                      >
                        <span>Read Volume</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Center Spine Crease Shadow (Fades in smoothly as the book opens) */}
            <div
              className={`book-center-crease absolute left-0 top-0 bottom-0 w-6 -translate-x-1/2 z-20 pointer-events-none transition-opacity duration-700 ${
                isCoverOpen ? 'opacity-100' : 'opacity-0'
              }`}
            />

            {/* Physical 3D Turning Leaf (Flips Right to Left across the spine on shuffle: 0deg -> -180deg) */}
            {isTurningLeaf && (
              <div
                key={`turning-leaf-${book.id}-${activePassageIndex}`}
                className="block book-turning-leaf"
                onAnimationEnd={() => setIsTurningLeaf(false)}
              >
                {/* Front Face of Turning Leaf: Outgoing Right Page quote lifting away */}
                <div className="turning-leaf-face-front rounded-r-xl rounded-l-none open-book-page-right border border-border p-6 sm:p-7 flex flex-col justify-between text-foreground overflow-hidden">
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono tracking-widest uppercase text-muted-foreground mb-3 pb-1 border-b border-border">
                      <span>{prevPassage.chapterLabel}</span>
                      <span className="text-emerald-700 dark:text-emerald-400 [html.sepia_&]:text-emerald-400 font-bold uppercase">
                        CC0 / Free
                      </span>
                    </div>

                    <div className="p-3.5 sm:p-4 rounded-xl bg-card/60 border border-border shadow-xs mb-2">
                      <Quote className="w-4 h-4 text-primary/70 mb-1.5 shrink-0" />
                      <p className="text-xs sm:text-[13px] font-serif italic text-foreground leading-relaxed line-clamp-8">
                        &ldquo;{prevPassage.quoteExcerpt}&rdquo;
                      </p>
                    </div>
                  </div>
                </div>

                {/* Back Face of Turning Leaf: Incoming Left Page title & quote landing onto left side */}
                <div className="turning-leaf-face-back rounded-l-xl rounded-r-none open-book-page-left border border-border p-6 sm:p-7 flex flex-col justify-between text-foreground overflow-hidden">
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono tracking-widest uppercase text-primary font-bold mb-2 pb-1 border-b border-border">
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Public Domain
                      </span>
                      <span>ID #{book.id}</span>
                    </div>

                    <h3 className="text-lg sm:text-xl font-serif font-bold leading-tight mb-1 text-foreground line-clamp-2">
                      {book.title}
                    </h3>
                    <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2 line-clamp-1">
                      by {authorNames}
                    </p>

                    <div className="relative pl-3 border-l-2 border-primary/40 my-2">
                      <p className="text-xs sm:text-[13px] font-serif italic text-foreground/90 leading-relaxed line-clamp-8">
                        &ldquo;{currentPassage.openingLine}&rdquo;
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-muted-foreground border-t border-border">
                    <span className="truncate max-w-[160px]">{primarySubject}</span>
                    <span className="opacity-60">p. 1</span>
                  </div>
                </div>
              </div>
            )}

            {/* 3D Flipping Front Cover (Hinged on Left Spine: 0deg -> -180deg) */}
            <div className="relative w-[280px] sm:w-[330px] md:w-[370px] aspect-[2/3] book-3d-flipper z-10">
              
              {/* FRONT FACE: THE EXACT CARD FROM FEATURED PUBLIC DOMAIN BOOKS (Closed State) */}
              <div
                className="absolute inset-0 book-3d-face-front rounded-r-xl rounded-l-sm bg-card border border-border hover:border-primary/60 shadow-[30px_30px_60px_rgba(0,0,0,0.28),0_12px_24px_rgba(0,0,0,0.12)] p-4 sm:p-4.5 flex flex-col justify-between text-foreground overflow-hidden cursor-pointer group"
                title="Click to flip open or close volume"
              >
                {/* 3D Spine & Page Edge Accents */}
                <div className="absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-black/40 via-black/15 to-transparent rounded-l-sm pointer-events-none z-30" />
                <div className="absolute right-0 top-1 bottom-1 w-2 bg-gradient-to-l from-black/10 dark:from-white/20 to-transparent pointer-events-none z-30" />

                {/* Card Top Cover Visual */}
                <div className="relative aspect-[4/3] w-full bg-muted/60 rounded-lg overflow-hidden flex items-center justify-center p-2.5 border border-border select-none">
                  {/* Public Domain Badge Top-Left */}
                  <div className="absolute top-2 left-2 z-20">
                    <Badge variant="primary" size="sm" className="gap-1 font-mono text-[9px] shadow-xs">
                      <Sparkles className="w-2.5 h-2.5 text-amber-400" /> #{book.id}
                    </Badge>
                  </div>

                  {/* Bookmark & Like Ribbons Top-Right */}
                  <div className="absolute top-2 right-2 z-20 flex items-center gap-1">
                    <div
                      className={`p-1.5 rounded-full shadow-xs ${
                        isLiked ? 'bg-destructive text-destructive-foreground' : 'bg-card/90 text-muted-foreground'
                      }`}
                    >
                      <Heart className={`w-3 h-3 ${isLiked ? 'fill-current' : ''}`} />
                    </div>
                    <div
                      className={`p-1.5 rounded-full shadow-xs ${
                        isSaved ? 'bg-primary text-primary-foreground' : 'bg-card/90 text-muted-foreground'
                      }`}
                    >
                      <Bookmark className={`w-3 h-3 ${isSaved ? 'fill-current' : ''}`} />
                    </div>
                  </div>

                  {/* Cover Artwork */}
                  {formats.coverImage ? (
                    <img
                      src={formats.coverImage}
                      alt={`Cover of ${book.title}`}
                      className="max-w-full max-h-full object-contain shadow-md rounded-xs"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col justify-center items-center text-center p-3 bg-gradient-to-br from-primary/15 to-primary/5 rounded">
                      <BookOpen className="w-8 h-8 text-primary/60 mb-2" />
                      <span className="text-[10px] font-mono uppercase tracking-widest text-primary font-bold">
                        Public Domain
                      </span>
                    </div>
                  )}

                  {/* Subject Pill Bottom-Left */}
                  <div className="absolute bottom-2 left-2 z-20">
                    <Badge variant="outline" size="sm" className="bg-card/90 text-[9px] border-border text-foreground font-mono uppercase">
                      {primarySubject}
                    </Badge>
                  </div>
                </div>

                {/* Card Bottom Body */}
                <div className="pt-2 flex-1 flex flex-col justify-between gap-1.5">
                  <div>
                    <h3 className="font-serif font-bold text-foreground text-sm sm:text-base leading-tight line-clamp-2">
                      {book.title}
                    </h3>
                    <p className="text-xs text-muted-foreground font-sans line-clamp-1 mt-0.5">
                      {authorNames}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-border text-[11px] text-muted-foreground">
                    <span className="font-mono">{formatDownloadCount(book.download_count)} reads</span>
                    <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold uppercase text-[10px]">
                      CC0 Free
                    </span>
                  </div>

                  <div className="pt-1 flex items-center justify-center text-[10px] font-mono text-primary font-bold">
                    <span>{isCoverOpen ? 'Click volume to close' : 'Click to flip open'}</span>
                  </div>
                </div>
              </div>

              {/* BACK FACE OF FRONT COVER: THE LEFT OPEN PAGE (Inside Spread) */}
              <div className="absolute inset-0 book-3d-face-back rounded-l-xl rounded-r-none open-book-page-left border border-border p-6 sm:p-7 flex flex-col justify-between text-foreground overflow-hidden shadow-2xl">
                <div>
                  <div className="flex items-center justify-between text-[11px] font-mono tracking-widest uppercase text-primary font-bold mb-2 pb-1 border-b border-border">
                    <span className="flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Public Domain
                    </span>
                    <span>ID #{book.id}</span>
                  </div>

                  <h3 className="text-lg sm:text-xl font-serif font-bold leading-tight mb-1 text-foreground line-clamp-2">
                    {book.title}
                  </h3>
                  <p className="text-xs font-mono uppercase tracking-wider text-muted-foreground mb-2 line-clamp-1">
                    by {authorNames}
                  </p>

                  <div className="relative pl-3 border-l-2 border-primary/40 my-2">
                    <p className="text-xs sm:text-[13px] font-serif italic text-foreground/90 leading-relaxed line-clamp-8">
                      &ldquo;{isTurningLeaf ? prevPassage.openingLine : currentPassage.openingLine}&rdquo;
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-muted-foreground border-t border-border">
                  <span className="truncate max-w-[160px]">{primarySubject}</span>
                  <span className="opacity-60">p. 1</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

