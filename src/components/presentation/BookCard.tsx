'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCursorTooltip } from '@/hooks/useCursorTooltip';
import { CursorTooltip } from '@/components/ui/CursorTooltip';
import { BookOpen, Download, Bookmark, Heart, Sparkles, Trash2 } from 'lucide-react';
import type { GutendexBook } from '@/types/book.types';
import { extractBookFormats, formatAuthorNames, formatDownloadCount, extractBookTags } from '@/lib/utils';
import { useHydratedBookshelf, useBookRating, useReadingStatus } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { StarRating } from '@/components/ui/StarRating';
import { ROUTES } from '@/config/routes';
import { useJurisdiction } from '@/stores/useJurisdictionStore';
import { isBookPublicDomainInJurisdiction } from '@/lib/copyright-engine';

export interface BookCardProps {
  book: GutendexBook;
  onDownloadClick?: (book: GutendexBook) => void;
  onPreviewClick?: (book: GutendexBook, rect?: { top: number; left: number; width: number; height: number }) => void;
  isPreviewActive?: boolean;
  activeView?: 'catalog' | 'bookshelf' | 'favorites' | 'notebook' | 'bookmarks';
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  onDownloadClick,
  onPreviewClick,
  isPreviewActive = false,
  activeView,
}) => {
  const router = useRouter();
  const cardRef = React.useRef<HTMLDivElement>(null);
  const [imageError, setImageError] = React.useState(false);
  const [isConfirmingRemoval, setIsConfirmingRemoval] = React.useState(false);
  const confirmTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const clearConfirmTimer = React.useCallback(() => {
    if (confirmTimerRef.current) {
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = null;
    }
  }, []);

  React.useEffect(() => {
    return () => {
      clearConfirmTimer();
    };
  }, [clearConfirmTimer]);

  const { isSaved: checkIsSaved, isFavorite: checkIsFavorite, toggleSaveBook: toggleSave, toggleFavoriteBook: toggleFavorite } = useHydratedBookshelf();
  const isSaved = checkIsSaved(book.id);
  const isFavorite = checkIsFavorite(book.id);
  const rating = useBookRating(book.id);
  const status = useReadingStatus(book.id);

  const { country } = useJurisdiction();
  const evaluation = isBookPublicDomainInJurisdiction(book, country);
  const isRestricted = !evaluation.isAllowed;

  const formats = extractBookFormats(book.formats, book.id);
  const authorNames = formatAuthorNames(book.authors) || 'Anonymous';
  const tags = extractBookTags(book.subjects, 2, 20);

  const {
    mousePos,
    showTooltip,
    hoveredAction,
    setHoveredAction,
    setShowTooltip,
    handleMouseEnter,
    handleMouseMove,
    handleMouseLeave,
  } = useCursorTooltip<'preview' | 'favorite' | 'bookshelf'>({ initialAction: 'preview' });

  const tooltipContent = React.useMemo(() => {
    if (hoveredAction === 'favorite') {
      if (isConfirmingRemoval) {
        return {
          icon: <Trash2 className="w-3 h-3 text-destructive shrink-0" />,
          text: 'Click again to remove',
        };
      }
      return {
        icon: <Heart className={`w-3 h-3 text-destructive shrink-0 ${isFavorite ? 'fill-current' : ''}`} />,
        text: isFavorite ? 'Remove from Favorites' : 'Add to Favorites',
      };
    }
    if (hoveredAction === 'bookshelf') {
      return {
        icon: <Bookmark className={`w-3 h-3 text-primary shrink-0 ${isSaved ? 'fill-current' : ''}`} />,
        text: isSaved ? 'Remove from Bookshelf' : 'Add to Bookshelf',
      };
    }
    return {
      icon: <BookOpen className="w-3 h-3 text-primary shrink-0" />,
      text: 'Click to preview quotes',
    };
  }, [hoveredAction, isConfirmingRemoval, isFavorite, isSaved]);

  const handleCoverClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (isRestricted) {
      if (onPreviewClick) {
        const cardEl = cardRef.current || ((e.currentTarget as HTMLElement).closest('[data-testid^="book-card-"]') as HTMLElement);
        onPreviewClick(book, cardEl ? cardEl.getBoundingClientRect() : undefined);
      } else {
        onDownloadClick?.(book);
      }
      return;
    }
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      if (activeView === 'favorites' || activeView === 'bookshelf') {
        if (onPreviewClick) {
          const cardEl = cardRef.current || ((e.currentTarget as HTMLElement).closest('[data-testid^="book-card-"]') as HTMLElement);
          onPreviewClick(book, cardEl ? cardEl.getBoundingClientRect() : undefined);
          return;
        }
      }
      useReaderStore.getState().openReader(book);
      router.push(ROUTES.READ(book.id));
      return;
    }
    if (onPreviewClick) {
      const cardEl = cardRef.current || ((e.currentTarget as HTMLElement).closest('[data-testid^="book-card-"]') as HTMLElement);
      if (cardEl) {
        const rect = cardEl.getBoundingClientRect();
        onPreviewClick(book, {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
        });
      }
    }
  };

  return (
    <Card
      ref={cardRef}
      variant="default"
      className={`group relative flex flex-col h-full bg-card border border-border hover:border-primary/50 shadow-booksaw hover:shadow-booksaw-hover rounded-xl overflow-hidden transition-[box-shadow,border-color,opacity,ring] duration-300 ease-out ${
        isPreviewActive
          ? 'max-lg:opacity-100 max-lg:ring-2 max-lg:ring-primary/60 max-lg:border-primary/60 lg:opacity-0 lg:pointer-events-none'
          : 'opacity-100'
      }`}
      data-testid={`book-card-${book.id}`}
    >
      {/* Top Cover Visual with Booksaw Directional Depth & Click-to-Open Affordance */}
      <div
        onClick={handleCoverClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleCoverClick(e);
          }
        }}
        onMouseEnter={onPreviewClick ? handleMouseEnter : undefined}
        onMouseMove={onPreviewClick ? handleMouseMove : undefined}
        onMouseLeave={
          onPreviewClick
            ? () => {
                handleMouseLeave();
                if (isConfirmingRemoval) {
                  clearConfirmTimer();
                  setIsConfirmingRemoval(false);
                }
              }
            : undefined
        }
        tabIndex={onPreviewClick ? 0 : undefined}
        role={onPreviewClick ? 'button' : undefined}
        aria-label={onPreviewClick ? `Click to preview quotes for ${book.title}` : undefined}
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

        {/* Unconstrained Portal Cursor Tooltip (Follows cursor exactly at 12px offset, free from any card transform or clipping) */}
        {Boolean(onPreviewClick) && (
          <CursorTooltip
            isVisible={showTooltip}
            mousePos={mousePos}
            className="hidden lg:flex"
          >
            {tooltipContent.icon}
            <span>{tooltipContent.text}</span>
          </CursorTooltip>
        )}

        {/* Quick Action Overlay Badges (Top-Right) */}
        <div className="absolute top-2.5 right-2.5 flex flex-col gap-1.5 z-20">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (activeView === 'favorites' && isFavorite) {
                if (!isConfirmingRemoval) {
                  setIsConfirmingRemoval(true);
                  clearConfirmTimer();
                  confirmTimerRef.current = setTimeout(() => {
                    setIsConfirmingRemoval(false);
                  }, 3500);
                  return;
                }
                clearConfirmTimer();
                setIsConfirmingRemoval(false);
                toggleFavorite(book);
                return;
              }
              toggleFavorite(book);
            }}
            onMouseEnter={() => {
              setHoveredAction('favorite');
              setShowTooltip(true);
            }}
            onMouseLeave={() => {
              setHoveredAction('preview');
              if (isConfirmingRemoval) {
                clearConfirmTimer();
                setIsConfirmingRemoval(false);
              }
            }}
            onBlur={() => {
              if (isConfirmingRemoval) {
                clearConfirmTimer();
                setIsConfirmingRemoval(false);
              }
            }}
            className={`p-1.5 rounded-full transition-all shadow-xs ${
              isConfirmingRemoval
                ? 'bg-destructive text-destructive-foreground scale-110 ring-2 ring-destructive/40 animate-pulse'
                : isFavorite
                ? 'bg-destructive text-destructive-foreground scale-105'
                : 'bg-card text-muted-foreground hover:text-destructive'
            }`}
            aria-label={
              isConfirmingRemoval
                ? 'Click again to confirm removal from favorites'
                : isFavorite
                ? 'Remove from favorites'
                : 'Add to favorites'
            }
          >
            {isConfirmingRemoval ? (
              <Trash2 className="w-3.5 h-3.5" />
            ) : (
              <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-current' : ''}`} />
            )}
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleSave(book);
            }}
            onMouseEnter={() => {
              setHoveredAction('bookshelf');
              setShowTooltip(true);
            }}
            onMouseLeave={() => setHoveredAction('preview')}
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
      </div>

      {/* Book Metadata Content */}
      <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-1.5">
          <div>
            <h3 className="font-serif font-bold text-foreground text-sm sm:text-base leading-snug line-clamp-2 group-hover:text-primary transition-colors text-balance">
              {book.title}
            </h3>
            <p className="text-xs text-muted-foreground font-sans line-clamp-1 mt-0.5">
              {authorNames}
            </p>
          </div>

          {/* Multiple Subject Tags */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            {tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                size="sm"
                className="bg-muted/40 text-[10px] border-border text-foreground font-mono uppercase group-hover:border-primary/60 transition-colors shadow-2xs"
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-border">
          <div
            onClick={activeView === 'favorites' || activeView === 'bookshelf' ? handleCoverClick : undefined}
            className={`flex items-center justify-between text-xs text-muted-foreground ${
              activeView === 'favorites' || activeView === 'bookshelf' ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''
            }`}
            title={activeView === 'favorites' || activeView === 'bookshelf' ? 'Click to rate or change reading status' : undefined}
          >
            {rating ? (
              <StarRating value={rating} readOnly size="sm" showLabel />
            ) : (
              <span className="font-mono text-[11px]">{formatDownloadCount(book.download_count)} reads</span>
            )}
            {status ? (
              <span className="text-[10px] font-mono font-bold uppercase text-primary">
                {status === 'currently_reading' ? '📖 Reading' : status === 'finished' ? '✓ Finished' : '🔖 Want to Read'}
              </span>
            ) : isRestricted ? (
              <span
                className="text-[10px] font-mono font-medium tracking-wider text-amber-600 dark:text-amber-400 uppercase"
                title={evaluation.reason || `Protected in ${country} under local copyright law`}
              >
                Protected ({country})
              </span>
            ) : (
              <span className="text-[10px] font-mono font-medium tracking-wider text-success uppercase">
                CC0 / Free
              </span>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {isRestricted ? (
              <Button
                variant="outline"
                size="chip"
                disabled
                className="w-full opacity-60 cursor-not-allowed text-xs"
                aria-label={`${book.title} is restricted in ${country}`}
                title={evaluation.reason || `Protected by copyright in ${country}`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Restricted</span>
              </Button>
            ) : (
              <Button
                as={Link}
                href={ROUTES.READ(book.id)}
                onClick={() => useReaderStore.getState().openReader(book)}
                variant="primary"
                size="chip"
                className="w-full"
                aria-label={`Read ${book.title}`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Read</span>
              </Button>
            )}

            <Button
              variant="outline"
              size="chip"
              onClick={() => onDownloadClick?.(book)}
              className="w-full"
              aria-label={`Download options for ${book.title}`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Get</span>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
