'use client';

import { useState, useMemo, useCallback } from 'react';
import { useReaderStore } from '@/stores/useReaderStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useHasMounted } from '@/hooks/useHasMounted';
import { useBooks } from '@/hooks/queries/useBooks';
import { toCanonicalBook } from '@/lib/adapters/book.adapter';
import { resolveBookMetadata, cleanBookTitle } from '@/lib/book-metadata';
import type {
  ActiveReadingVolume,
  LedgerFilter,
  LedgerItemStatus,
  ReadingStatus,
} from '@/types/book.types';

export interface UseContinueReadingLedgerReturn {
  volumes: ActiveReadingVolume[];
  filteredVolumes: ActiveReadingVolume[];
  activeFilter: LedgerFilter;
  setActiveFilter: (filter: LedgerFilter) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  counts: {
    all: number;
    in_progress: number;
    completed: number;
    on_hold: number;
  };
  isLoading: boolean;
  updateVolumeStatus: (bookId: number, status: LedgerItemStatus) => Promise<void>;
  clearVolumeProgress: (bookId: number) => void;
  clearAllVolumes: () => void;
}

/**
 * Headless ledger hook aggregating active reading volumes, coordinates,
 * bookmarks, and curation statuses across local reader and bookshelf stores.
 */
export function useContinueReadingLedger(): UseContinueReadingLedgerReturn {
  const hasMounted = useHasMounted();
  const [activeFilter, setActiveFilter] = useState<LedgerFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const readingProgress = useReaderStore((s) => s.readingProgress);
  const readingPositions = useReaderStore((s) => s.readingPositions);
  const clearReadingPosition = useReaderStore((s) => s.clearReadingPosition);
  const setProgress = useReaderStore((s) => s.setProgress);

  const savedBooks = useBookshelfStore((s) => s.savedBooks);
  const recentBooks = useBookshelfStore((s) => s.recentBooks);
  const bookStatuses = useBookshelfStore((s) => s.bookStatuses);
  const setReadingStatus = useBookshelfStore((s) => s.setReadingStatus);

  const allActiveIds = useMemo(() => {
    if (!hasMounted) return [];

    const idSet = new Set<number>();
    Object.keys(readingPositions).forEach((idStr) => {
      const id = parseInt(idStr, 10);
      if (!Number.isNaN(id)) idSet.add(id);
    });

    Object.keys(readingProgress).forEach((idStr) => {
      const id = parseInt(idStr, 10);
      if (!Number.isNaN(id) && readingProgress[id] > 0) idSet.add(id);
    });

    return Array.from(idSet).sort((a, b) => a - b);
  }, [hasMounted, readingPositions, readingProgress]);

  const missingIds = useMemo(() => {
    const known = new Set<number>();
    savedBooks.forEach((b) => b?.id && known.add(b.id));
    recentBooks.forEach((b) => b?.id && known.add(b.id));
    const current = useReaderStore.getState().currentBook;
    if (current?.id) known.add(current.id);

    Object.entries(readingPositions).forEach(([idStr, pos]) => {
      const id = parseInt(idStr, 10);
      if (!Number.isNaN(id) && pos?.bookTitle) {
        known.add(id);
      }
    });

    return allActiveIds.filter((id) => !known.has(id));
  }, [allActiveIds, savedBooks, recentBooks, readingPositions]);

  const idsParam = useMemo(() => missingIds.join(','), [missingIds]);
  const { data: missingBooksData, isLoading: isMissingBooksLoading } = useBooks(
    { ids: idsParam, copyright: false },
    { enabled: missingIds.length > 0 }
  );

  const volumes: ActiveReadingVolume[] = useMemo(() => {
    if (!hasMounted) return [];

    const bookDictionary = new Map<number, ReturnType<typeof toCanonicalBook>>();

    // Prioritize metadata sources: recentBooks, then savedBooks, then currentBook, then fetched missing books
    savedBooks.forEach((b) => {
      if (b && typeof b.id === 'number') {
        bookDictionary.set(b.id, toCanonicalBook(b));
      }
    });

    recentBooks.forEach((b) => {
      if (b && typeof b.id === 'number') {
        bookDictionary.set(b.id, toCanonicalBook(b));
      }
    });

    const currentBook = useReaderStore.getState().currentBook;
    if (currentBook && typeof currentBook.id === 'number') {
      bookDictionary.set(currentBook.id, toCanonicalBook(currentBook));
    }

    if (missingBooksData?.results) {
      missingBooksData.results.forEach((b) => {
        if (b && typeof b.id === 'number') {
          bookDictionary.set(b.id, toCanonicalBook(b));
        }
      });
    }

    const items: ActiveReadingVolume[] = [];

    allActiveIds.forEach((bookId) => {
      let book = bookDictionary.get(bookId);
      const position = readingPositions[bookId];

      if (!book) {
        if (position?.bookTitle) {
          book = {
            id: bookId,
            title: cleanBookTitle(position.bookTitle),
            authors: position.bookAuthors && position.bookAuthors.length > 0 ? position.bookAuthors : ['Public Domain Author'],
            subjects: [],
            languages: ['en'],
            coverUrl: position.coverUrl || `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.cover.medium.jpg`,
            epubUrl: `https://www.gutenberg.org/ebooks/${bookId}.epub3.images`,
            htmlUrl: null,
            txtUrl: null,
            downloadCount: 0,
          };
        } else {
          const resolved = resolveBookMetadata({
            id: bookId,
            currentBook: currentBook?.id === bookId ? currentBook : undefined,
          });

          book = {
            id: bookId,
            title: cleanBookTitle(resolved.title) || `Volume #${bookId}`,
            authors: resolved.author ? [resolved.author] : ['Public Domain Author'],
            subjects: resolved.primarySubject ? [resolved.primarySubject] : [],
            languages: resolved.languages || ['en'],
            coverUrl: `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.cover.medium.jpg`,
            epubUrl: `https://www.gutenberg.org/ebooks/${bookId}.epub3.images`,
            htmlUrl: null,
            txtUrl: null,
            downloadCount: 0,
          };
        }
      } else {
        book = {
          ...book,
          title: cleanBookTitle(book.title),
        };
      }

      const rawProgress = readingProgress[bookId] ?? 0;
      const progress = Math.min(Math.max(Math.round(rawProgress), 0), 100);
      const rawStatus = bookStatuses[bookId];

      let status: LedgerItemStatus = 'in_progress';
      if (rawStatus === 'finished' || progress >= 100) {
        status = 'completed';
      } else if (rawStatus === 'want_to_read') {
        status = 'on_hold';
      }

      items.push({
        book,
        progressPercent: progress,
        lastReadAt: position?.lastReadAt || new Date(0).toISOString(),
        chapterIndex: position?.chapterIndex ?? 0,
        chapterPage: position?.chapterPage ?? 1,
        globalPage: position?.globalPage ?? 1,
        status,
        bookmarksCount: position ? 1 : 0,
      });
    });

    // Sort by lastReadAt descending (most recently read first)
    items.sort((a, b) => {
      const timeA = new Date(a.lastReadAt).getTime();
      const timeB = new Date(b.lastReadAt).getTime();
      return timeB - timeA;
    });

    return items;
  }, [
    hasMounted,
    allActiveIds,
    readingPositions,
    readingProgress,
    recentBooks,
    savedBooks,
    bookStatuses,
    missingBooksData,
  ]);

  const counts = useMemo(() => {
    let inProgress = 0;
    let completed = 0;
    let onHold = 0;

    volumes.forEach((vol) => {
      if (vol.status === 'in_progress') inProgress++;
      else if (vol.status === 'completed') completed++;
      else if (vol.status === 'on_hold') onHold++;
    });

    return {
      all: volumes.length,
      in_progress: inProgress,
      completed,
      on_hold: onHold,
    };
  }, [volumes]);

  const filteredVolumes = useMemo(() => {
    let result = volumes;
    if (activeFilter !== 'all') {
      result = result.filter((vol) => vol.status === activeFilter);
    }
    const cleanQuery = searchQuery.trim().toLowerCase();
    if (!cleanQuery) return result;

    return result.filter((vol) => {
      const titleMatch = vol.book.title?.toLowerCase().includes(cleanQuery);
      const authorMatch = vol.book.authors?.some((author) =>
        author.toLowerCase().includes(cleanQuery)
      );
      const subjectMatch = vol.book.subjects?.some((subject) =>
        subject.toLowerCase().includes(cleanQuery)
      );
      return Boolean(titleMatch || authorMatch || subjectMatch);
    });
  }, [volumes, activeFilter, searchQuery]);

  const updateVolumeStatus = useCallback(
    async (bookId: number, status: LedgerItemStatus) => {
      let mappedStatus: ReadingStatus = 'currently_reading';
      if (status === 'completed') mappedStatus = 'finished';
      else if (status === 'on_hold') mappedStatus = 'want_to_read';

      await setReadingStatus(bookId, mappedStatus);

      if (status === 'completed' && (readingProgress[bookId] ?? 0) < 100) {
        setProgress(bookId, 100);
      }
    },
    [setReadingStatus, setProgress, readingProgress]
  );

  const clearVolumeProgress = useCallback(
    (bookId: number) => {
      clearReadingPosition(bookId);
      setProgress(bookId, 0);
    },
    [clearReadingPosition, setProgress]
  );

  const clearAllVolumes = useCallback(async () => {
    await useReaderStore.getState().clearAllVolumes();
  }, []);

  return {
    volumes,
    filteredVolumes,
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    counts,
    isLoading: !hasMounted || (missingIds.length > 0 && isMissingBooksLoading),
    updateVolumeStatus,
    clearVolumeProgress,
    clearAllVolumes,
  };
}

