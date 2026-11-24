'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Highlighter, BookOpen, Check } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import {
  useAnnotationStore,
  useHydratedAnnotations,
  type Annotation,
} from '@/stores/useAnnotationStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useOfflineBooks } from '@/hooks/useOfflineBooks';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import {
  SCHOLAR_BIO_MAX_LENGTH,
  SCHOLAR_BIO_BOOK_TITLE_MAX_LENGTH,
  SCHOLAR_BIO_BOOK_AUTHOR_MAX_LENGTH,
} from '@/config/site-config';
import {
  cleanBookTitle,
  isPlaceholderTitle,
  isPlaceholderAuthor,
} from '@/lib/book-metadata';
import { matchesSmartSearch } from '@/lib/smart-search';
import { formatAuthorNames } from '@/lib/utils';
import type { GutendexBook } from '@/types/book.types';

export interface SelectedHighlightMotto {
  bio: string;
  bookId: number;
  bookTitle: string;
  bookAuthor: string | null;
}

export interface HighlightBioPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBio?: string;
  currentBookId?: number | null;
  onSelectHighlight: (selection: SelectedHighlightMotto) => void;
}

const EMPTY_BOOK_LIST: GutendexBook[] = [];

/**
 * Normalizes and truncates a saved highlight passage so it fits the Scholar Bio limit
 * without clipping mid-word when an ellipsis is needed.
 */
export function formatHighlightForScholarBio(
  rawText: string,
  maxLength = SCHOLAR_BIO_MAX_LENGTH
): string {
  const normalized = String(rawText || '').replace(/\s+/g, ' ').trim();
  if (!normalized || maxLength <= 0) return '';
  if (normalized.length <= maxLength) return normalized;
  if (maxLength === 1) return '…';

  const sliceLimit = maxLength - 1;
  let candidate = normalized.slice(0, sliceLimit);
  const lastSpaceIdx = candidate.lastIndexOf(' ');
  if (lastSpaceIdx >= Math.floor(sliceLimit * 0.6)) {
    candidate = candidate.slice(0, lastSpaceIdx);
  }
  return `${candidate.trimEnd()}…`;
}

/**
 * Resolves authentic non-placeholder volume title and author metadata for an annotation
 * across local bookshelves, recent history, offline cache, and bundled featured classics.
 */
export function resolveHighlightBookAttribution(
  annotation: Pick<Annotation, 'bookId' | 'bookTitle' | 'bookAuthor'>,
  pools: {
    savedBooks?: GutendexBook[];
    favoriteBooks?: GutendexBook[];
    recentBooks?: GutendexBook[];
    offlineBooks?: GutendexBook[];
  }
): { bookId: number; title: string; author: string | null } {
  const bookId = annotation.bookId;
  const candidatePools = [
    pools.savedBooks || EMPTY_BOOK_LIST,
    pools.favoriteBooks || EMPTY_BOOK_LIST,
    pools.recentBooks || EMPTY_BOOK_LIST,
    pools.offlineBooks || EMPTY_BOOK_LIST,
  ];

  let matchedBook: GutendexBook | undefined;
  for (const pool of candidatePools) {
    const found = pool.find((b) => b.id === bookId);
    if (found) {
      matchedBook = found;
      break;
    }
  }

  const featuredBook = FEATURED_HERO_BOOKS.find((b) => b.id === bookId);

  const rawAnnTitle = cleanBookTitle(annotation.bookTitle);
  const rawPoolTitle = cleanBookTitle(matchedBook?.title);
  const rawFeaturedTitle = cleanBookTitle(featuredBook?.title);

  let resolvedTitle = `Volume #${bookId}`;
  if (rawAnnTitle && !isPlaceholderTitle(rawAnnTitle)) {
    resolvedTitle = rawAnnTitle;
  } else if (rawPoolTitle && !isPlaceholderTitle(rawPoolTitle)) {
    resolvedTitle = rawPoolTitle;
  } else if (rawFeaturedTitle && !isPlaceholderTitle(rawFeaturedTitle)) {
    resolvedTitle = rawFeaturedTitle;
  }

  const rawPoolAuthor = matchedBook?.authors?.length
    ? formatAuthorNames(matchedBook.authors)
    : '';
  const rawFeaturedAuthor = featuredBook?.author || '';

  let resolvedAuthor: string | null = null;
  if (annotation.bookAuthor && !isPlaceholderAuthor(annotation.bookAuthor)) {
    resolvedAuthor = formatAuthorNames([{ name: annotation.bookAuthor }]) || annotation.bookAuthor.trim();
  } else if (rawPoolAuthor && !isPlaceholderAuthor(rawPoolAuthor)) {
    resolvedAuthor = rawPoolAuthor.trim();
  } else if (rawFeaturedAuthor && !isPlaceholderAuthor(rawFeaturedAuthor)) {
    resolvedAuthor = rawFeaturedAuthor.trim();
  }

  return {
    bookId,
    title: resolvedTitle.slice(0, SCHOLAR_BIO_BOOK_TITLE_MAX_LENGTH),
    author: resolvedAuthor ? resolvedAuthor.slice(0, SCHOLAR_BIO_BOOK_AUTHOR_MAX_LENGTH) : null,
  };
}

interface HighlightPickerEntry {
  annotation: Annotation;
  formattedBio: string;
  wasTruncated: boolean;
  title: string;
  author: string | null;
}

export const HighlightBioPickerModal: React.FC<HighlightBioPickerModalProps> = ({
  isOpen,
  onClose,
  currentBio,
  currentBookId,
  onSelectHighlight,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { annotations } = useHydratedAnnotations();
  const savedBooks = useBookshelfStore((s) => s.savedBooks);
  const favoriteBooks = useBookshelfStore((s) => s.favoriteBooks);
  const recentBooks = useBookshelfStore((s) => s.recentBooks);
  const { offlineBooks = EMPTY_BOOK_LIST } = useOfflineBooks();
  const { isOffline } = useNetworkStatus();
  const userId = useAuthStore((s) => s.user?.id);

  // If opened online on a fresh device before annotations hydrated, passively sync with cooldown
  useEffect(() => {
    if (!isOpen || isOffline || !userId || annotations.length > 0) return;
    const syncFn = useAnnotationStore.getState?.().syncWithCloud;
    if (typeof syncFn === 'function') {
      syncFn(userId, { minSyncIntervalMs: 15_000 }).catch(() => {});
    }
  }, [isOpen, isOffline, userId, annotations.length]);

  const handleClose = () => {
    setSearchQuery('');
    onClose();
  };

  const entries = useMemo<HighlightPickerEntry[]>(() => {
    const pools = { savedBooks, favoriteBooks, recentBooks, offlineBooks };
    return [...annotations]
      .filter(
        (ann) =>
          Number.isInteger(ann.bookId) &&
          ann.bookId > 0 &&
          typeof ann.selectedText === 'string' &&
          ann.selectedText.trim().length > 0
      )
      .sort((a, b) => {
        const tsA = Date.parse(a.updatedAt || a.createdAt || '') || 0;
        const tsB = Date.parse(b.updatedAt || b.createdAt || '') || 0;
        return tsB - tsA;
      })
      .map((annotation) => {
        const normalizedRaw = annotation.selectedText.replace(/\s+/g, ' ').trim();
        const formattedBio = formatHighlightForScholarBio(
          annotation.selectedText,
          SCHOLAR_BIO_MAX_LENGTH
        );
        const attribution = resolveHighlightBookAttribution(annotation, pools);
        return {
          annotation,
          formattedBio,
          wasTruncated: normalizedRaw.length > SCHOLAR_BIO_MAX_LENGTH,
          title: attribution.title,
          author: attribution.author,
        };
      });
  }, [annotations, savedBooks, favoriteBooks, recentBooks, offlineBooks]);

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    return entries.filter((entry) =>
      matchesSmartSearch(
        entry,
        searchQuery,
        (item) =>
          `${item.annotation.selectedText} ${item.title} ${item.author || ''} ${item.annotation.note || ''}`
      )
    );
  }, [entries, searchQuery]);

  const normalizedCurrentBio = (currentBio || '').trim();

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Choose a Highlight as Literary Motto"
      maxWidth="xl"
      testId="highlight-bio-picker-modal"
    >
      <div className="p-4 sm:p-6 space-y-4">
        <p className="text-xs text-muted-foreground font-sans leading-relaxed">
          Feature a passage from your saved highlights as your public motto. Visitors on your
          sanctuary will also see a <span className="font-semibold text-foreground">Read Book</span> link
          to the volume. Private margin notes are never shared.
        </p>

        <div className="space-y-2">
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClear={() => setSearchQuery('')}
            placeholder="Search highlights by quote, book title, author, or note..."
            aria-label="Search saved highlights"
            icon={<Search className="w-4 h-4" />}
            className="text-sm"
          />

          {entries.length > 0 && (
            <div className="flex items-center justify-between text-[11px] font-mono text-muted-foreground px-1">
              <span>
                Showing {filteredEntries.length} of {entries.length}{' '}
                {entries.length === 1 ? 'highlight' : 'highlights'}
              </span>
              <span>Max {SCHOLAR_BIO_MAX_LENGTH} chars</span>
            </div>
          )}
        </div>

        {entries.length === 0 ? (
          <div
            data-testid="highlight-picker-empty"
            className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center space-y-2"
          >
            <Highlighter className="w-7 h-7 text-muted-foreground mx-auto" aria-hidden="true" />
            <p className="text-sm font-serif font-bold text-foreground">No saved highlights yet</p>
            <p className="text-xs text-muted-foreground font-sans max-w-sm mx-auto">
              Select passages while reading any volume in Bookarium to save highlights to your
              Commonplace Notebook and feature them here.
            </p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div
            data-testid="highlight-picker-no-matches"
            className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center space-y-3"
          >
            <p className="text-sm font-serif font-bold text-foreground">
              No highlights match your search
            </p>
            <p className="text-xs text-muted-foreground font-sans">
              Try different keywords from the quote, book title, or author.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="font-mono text-xs"
            >
              Clear Search
            </Button>
          </div>
        ) : (
          <ul
            role="list"
            aria-label="Saved highlights list"
            className="space-y-3 max-h-[50dvh] overflow-y-auto pr-1"
          >
            {filteredEntries.map((entry) => {
              const isSelected =
                Boolean(currentBookId) &&
                currentBookId === entry.annotation.bookId &&
                normalizedCurrentBio === entry.formattedBio;

              return (
                <li
                  key={entry.annotation.id}
                  className={`rounded-2xl border p-4 transition-colors space-y-3 ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-muted/15 hover:bg-muted/30'
                  }`}
                >
                  <p className="font-serif italic text-sm text-foreground leading-relaxed">
                    &ldquo;{entry.formattedBio}&rdquo;
                  </p>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-border">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-xs font-serif font-bold text-foreground flex items-center gap-1.5 min-w-0">
                        <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
                        <span className="truncate">{entry.title}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] font-sans text-muted-foreground">
                        {entry.author && <span className="truncate">by {entry.author}</span>}
                        {entry.wasTruncated && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted border border-border text-[10px] font-mono">
                            Trimmed to {SCHOLAR_BIO_MAX_LENGTH} chars
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant={isSelected ? 'outline' : 'primary'}
                      size="sm"
                      onClick={() => {
                        onSelectHighlight({
                          bio: entry.formattedBio,
                          bookId: entry.annotation.bookId,
                          bookTitle: entry.title,
                          bookAuthor: entry.author,
                        });
                        handleClose();
                      }}
                      className="font-mono text-xs shrink-0 self-end sm:self-center"
                    >
                      {isSelected ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-success" aria-hidden="true" />
                          <span>Selected</span>
                        </>
                      ) : (
                        <span>Use Highlight</span>
                      )}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
};
