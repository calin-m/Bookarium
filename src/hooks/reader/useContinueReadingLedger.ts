'use client';

import { useState, useMemo, useCallback } from 'react';
import { useReaderStore } from '@/stores/useReaderStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useHasMounted } from '@/hooks/useHasMounted';
import { toCanonicalBook } from '@/lib/adapters/book.adapter';
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
  counts: {
    all: number;
    in_progress: number;
    completed: number;
    on_hold: number;
  };
  isLoading: boolean;
  updateVolumeStatus: (bookId: number, status: LedgerItemStatus) => Promise<void>;
  clearVolumeProgress: (bookId: number) => void;
}

/**
 * Headless ledger hook aggregating active reading volumes, coordinates,
 * bookmarks, and curation statuses across local reader and bookshelf stores.
 */
export function useContinueReadingLedger(): UseContinueReadingLedgerReturn {
  const hasMounted = useHasMounted();
  const [activeFilter, setActiveFilter] = useState<LedgerFilter>('all');

  const readingProgress = useReaderStore((s) => s.readingProgress);
  const readingPositions = useReaderStore((s) => s.readingPositions);
  const clearReadingPosition = useReaderStore((s) => s.clearReadingPosition);
  const setProgress = useReaderStore((s) => s.setProgress);

  const savedBooks = useBookshelfStore((s) => s.savedBooks);
  const recentBooks = useBookshelfStore((s) => s.recentBooks);
  const bookStatuses = useBookshelfStore((s) => s.bookStatuses);
  const setReadingStatus = useBookshelfStore((s) => s.setReadingStatus);

  const volumes: ActiveReadingVolume[] = useMemo(() => {
    if (!hasMounted) return [];

    const idSet = new Set<number>();

    // Collect IDs from reading positions
    Object.keys(readingPositions).forEach((idStr) => {
      const id = parseInt(idStr, 10);
      if (!Number.isNaN(id)) idSet.add(id);
    });

    // Collect IDs from reading progress
    Object.keys(readingProgress).forEach((idStr) => {
      const id = parseInt(idStr, 10);
      if (!Number.isNaN(id) && readingProgress[id] > 0) idSet.add(id);
    });

    // Collect IDs from recent books
    recentBooks.forEach((book) => {
      if (book && typeof book.id === 'number') idSet.add(book.id);
    });

    // Collect IDs from explicitly curated currently_reading books
    Object.entries(bookStatuses).forEach(([idStr, status]) => {
      const id = parseInt(idStr, 10);
      if (!Number.isNaN(id) && status === 'currently_reading') {
        idSet.add(id);
      }
    });

    const bookDictionary = new Map<number, ReturnType<typeof toCanonicalBook>>();

    // Prioritize metadata sources: recentBooks, then savedBooks, then currentBook
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

    const items: ActiveReadingVolume[] = [];

    idSet.forEach((bookId) => {
      let book = bookDictionary.get(bookId);
      if (!book) {
        book = {
          id: bookId,
          title: `Volume #${bookId}`,
          authors: ['Public Domain Author'],
          subjects: [],
          languages: ['en'],
          coverUrl: `https://www.gutenberg.org/cache/epub/${bookId}/pg${bookId}.cover.medium.jpg`,
          epubUrl: `https://www.gutenberg.org/ebooks/${bookId}.epub3.images`,
          htmlUrl: null,
          txtUrl: null,
          downloadCount: 0,
        };
      }

      const position = readingPositions[bookId];
      const progress = Math.min(Math.max(readingProgress[bookId] ?? 0, 0), 100);
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
  }, [hasMounted, readingPositions, readingProgress, recentBooks, savedBooks, bookStatuses]);

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
    if (activeFilter === 'all') return volumes;
    return volumes.filter((vol) => vol.status === activeFilter);
  }, [volumes, activeFilter]);

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
      void setReadingStatus(bookId, null);
    },
    [clearReadingPosition, setProgress, setReadingStatus]
  );

  return {
    volumes,
    filteredVolumes,
    activeFilter,
    setActiveFilter,
    counts,
    isLoading: !hasMounted,
    updateVolumeStatus,
    clearVolumeProgress,
  };
}

