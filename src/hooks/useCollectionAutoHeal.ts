import { useState, useMemo, useEffect, useRef } from 'react';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useAnnotationStore } from '@/stores/useAnnotationStore';
import { useFellowshipStore } from '@/stores/useFellowshipStore';
import { useBooks } from '@/hooks/queries/useBooks';
import { useHasMounted } from '@/hooks/useHasMounted';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import { parseLifespansFromName } from '@/lib/copyright-engine';
import { formatAuthorNames } from '@/lib/utils';
import type { GutendexBook } from '@/types/book.types';

export interface CollectionAutoHealResult {
  isHealing: boolean;
  missingFavoriteIds: number[];
  incompleteSavedIds: number[];
  totalMissingCount: number;
}

function isBookIncomplete(b: GutendexBook): boolean {
  if (!b.authors || b.authors.length === 0) return true;
  return b.authors.every((a) => {
    if (a.birth_year != null || a.death_year != null) return false;
    const parsed = parseLifespansFromName(a.name);
    return parsed.birthYear == null && parsed.deathYear == null;
  });
}

function isPositionIncomplete(bookAuthors?: string[]): boolean {
  if (!bookAuthors || bookAuthors.length === 0) return true;
  return bookAuthors.every((name) => {
    const parsed = parseLifespansFromName(name);
    return parsed.birthYear == null && parsed.deathYear == null;
  });
}

/**
 * Unified Collection Auto-Healing Hook.
 * Scans user collections (Bookshelf, Favorites, and Reading Positions) for volumes with missing or incomplete metadata,
 * performs a single deduplicated batch request to /api/books?ids=...,
 * and enriches local & cloud stores with authoritative author lifespans and book structures.
 */
export function useCollectionAutoHeal(): CollectionAutoHealResult {
  const hasMounted = useHasMounted();
  const { isOffline } = useNetworkStatus();

  const favoriteBookIds = useBookshelfStore((s) => s.favoriteBookIds);
  const favoriteBooks = useBookshelfStore((s) => s.favoriteBooks || []);
  const savedBooks = useBookshelfStore((s) => s.savedBooks || []);
  const recentBooks = useBookshelfStore((s) => s.recentBooks || []);
  const readingPositions = useReaderStore((s) => s.readingPositions || {});
  const annotations = useAnnotationStore((s) => s.annotations || []);
  const fellowAnnotations = useAnnotationStore((s) => s.fellowAnnotations || []);
  const symposiums = useFellowshipStore((s) => s.symposiums || []);

  // Track book IDs queried this session to prevent infinite re-query loops on authors without known lifespans
  const [attemptedHealIds, setAttemptedHealIds] = useState<Set<number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = sessionStorage.getItem('bookarium_auto_heal_attempted');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            return new Set<number>(parsed);
          }
        }
      } catch {
        // Fallback to in-memory set on storage restriction
      }
    }
    return new Set<number>();
  });
  const [prevResults, setPrevResults] = useState<unknown>(null);

  // Fast-path synchronous healing for featured hero books from static fixtures
  useEffect(() => {
    if (!hasMounted) return;
    const candidateIds = new Set<number>();
    const existingFormats = new Map<number, Record<string, string>>();
    const existingDownloads = new Map<number, number>();

    for (const b of savedBooks) {
      if (isBookIncomplete(b)) {
        candidateIds.add(b.id);
        existingFormats.set(b.id, b.formats || {});
        existingDownloads.set(b.id, b.download_count || 0);
      }
    }
    for (const b of favoriteBooks) {
      if (isBookIncomplete(b)) {
        candidateIds.add(b.id);
        if (!existingFormats.has(b.id)) existingFormats.set(b.id, b.formats || {});
        if (!existingDownloads.has(b.id)) existingDownloads.set(b.id, b.download_count || 0);
      }
    }
    for (const [idStr, pos] of Object.entries(readingPositions)) {
      const id = Number(idStr);
      if (!Number.isNaN(id) && pos && isPositionIncomplete(pos.bookAuthors)) {
        candidateIds.add(id);
      }
    }
    for (const ann of [...annotations, ...fellowAnnotations]) {
      const id = ann?.bookId;
      if (id && id > 0 && (!ann.bookTitle || !ann.bookAuthor || isPositionIncomplete([ann.bookAuthor]))) {
        candidateIds.add(id);
      }
    }
    for (const sym of symposiums) {
      const id = sym?.book_id;
      if (id && id > 0) {
        candidateIds.add(id);
      }
    }

    if (candidateIds.size === 0) return;

    const heroBooksToEnrich: GutendexBook[] = [];
    for (const id of candidateIds) {
      const hero = FEATURED_HERO_BOOKS.find((h) => h.id === id);
      if (hero && (hero.authorBirthYear != null || hero.authorDeathYear != null)) {
        heroBooksToEnrich.push({
          id: hero.id,
          title: hero.title,
          authors: [
            {
              name: hero.author,
              birth_year: hero.authorBirthYear ?? null,
              death_year: hero.authorDeathYear ?? null,
            },
          ],
          translators: [],
          subjects: hero.primarySubject ? [hero.primarySubject] : [],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: existingFormats.get(hero.id) || {},
          download_count: existingDownloads.get(hero.id) || 0,
        });
      }
    }
    if (heroBooksToEnrich.length > 0) {
      useBookshelfStore.getState().enrichSavedBooks(heroBooksToEnrich);
      useReaderStore.getState().enrichReadingPositions(heroBooksToEnrich);
      for (const book of heroBooksToEnrich) {
        const author = book.authors ? formatAuthorNames(book.authors) : undefined;
        useAnnotationStore.getState().updateBookMetadata(book.id, book.title, author);
      }
    }
  }, [hasMounted, savedBooks, favoriteBooks, readingPositions, annotations, fellowAnnotations, symposiums]);

  // 1. Detect favorite IDs in localStorage/cloud that lack full book metadata or author lifespans
  const missingFavoriteIds = useMemo(() => {
    if (!hasMounted) return [];
    const knownIds = new Set((favoriteBooks || []).map((b) => b.id));
    const missing = new Set<number>(favoriteBookIds.filter((id) => !knownIds.has(id)));
    for (const b of favoriteBooks) {
      if (attemptedHealIds.has(b.id)) continue;
      if (isBookIncomplete(b)) {
        const hero = FEATURED_HERO_BOOKS.find((h) => h.id === b.id);
        if (hero && (hero.authorBirthYear != null || hero.authorDeathYear != null)) {
          continue;
        }
        missing.add(b.id);
      }
    }
    return Array.from(missing);
  }, [favoriteBookIds, favoriteBooks, attemptedHealIds, hasMounted]);

  // 2. Detect saved books, active bookmarks, annotations, and symposiums that lack author lifespan metadata
  const incompleteSavedIds = useMemo(() => {
    if (!hasMounted) return [];
    const ids = new Set<number>();
    const completeBookIds = new Set<number>();

    for (const b of savedBooks) {
      if (!isBookIncomplete(b)) {
        completeBookIds.add(b.id);
        continue;
      }
      if (attemptedHealIds.has(b.id)) continue;
      const hero = FEATURED_HERO_BOOKS.find((h) => h.id === b.id);
      if (hero && (hero.authorBirthYear != null || hero.authorDeathYear != null)) {
        continue; // Handled synchronously via local fixture fast-path
      }
      ids.add(b.id);
    }

    for (const b of favoriteBooks) {
      if (!isBookIncomplete(b)) completeBookIds.add(b.id);
    }
    for (const b of recentBooks) {
      if (!isBookIncomplete(b)) completeBookIds.add(b.id);
    }

    for (const [idStr, pos] of Object.entries(readingPositions)) {
      const id = Number(idStr);
      if (Number.isNaN(id) || !pos || attemptedHealIds.has(id) || completeBookIds.has(id)) continue;
      if (isPositionIncomplete(pos.bookAuthors)) {
        const hero = FEATURED_HERO_BOOKS.find((h) => h.id === id);
        if (hero && (hero.authorBirthYear != null || hero.authorDeathYear != null)) {
          continue;
        }
        ids.add(id);
      } else {
        completeBookIds.add(id);
      }
    }

    for (const ann of [...annotations, ...fellowAnnotations]) {
      const id = ann?.bookId;
      if (!id || id <= 0 || attemptedHealIds.has(id) || completeBookIds.has(id)) continue;
      if (!ann.bookTitle || !ann.bookAuthor || isPositionIncomplete([ann.bookAuthor])) {
        const hero = FEATURED_HERO_BOOKS.find((h) => h.id === id);
        if (hero && (hero.authorBirthYear != null || hero.authorDeathYear != null)) {
          continue;
        }
        ids.add(id);
      }
    }

    for (const sym of symposiums) {
      const id = sym?.book_id;
      if (!id || id <= 0 || attemptedHealIds.has(id) || completeBookIds.has(id)) continue;
      const hero = FEATURED_HERO_BOOKS.find((h) => h.id === id);
      if (hero && (hero.authorBirthYear != null || hero.authorDeathYear != null)) {
        continue;
      }
      ids.add(id);
    }

    return Array.from(ids);
  }, [
    savedBooks,
    favoriteBooks,
    recentBooks,
    readingPositions,
    annotations,
    fellowAnnotations,
    symposiums,
    attemptedHealIds,
    hasMounted,
  ]);

  // 3. Combine and deduplicate all IDs requiring fresh upstream metadata
  const combinedMissingIds = useMemo(() => {
    const set = new Set<number>([...missingFavoriteIds, ...incompleteSavedIds]);
    return Array.from(set);
  }, [missingFavoriteIds, incompleteSavedIds]);

  const missingIdsParam = combinedMissingIds.length > 0 ? combinedMissingIds.join(',') : undefined;

  // 4. Single batched query to /api/books?ids=... (dormant when combinedMissingIds is empty or offline)
  const { data: missingBooksData, isLoading: isHealing } = useBooks(
    missingIdsParam ? { ids: missingIdsParam, includeRestrictedMetadata: true } : undefined,
    { enabled: Boolean(missingIdsParam) && !isOffline }
  );

  // Adjust attempted heal session tracking during render when fresh upstream books arrive
  if (missingBooksData?.results && missingBooksData.results !== prevResults) {
    setPrevResults(missingBooksData.results);
    const freshResults = missingBooksData.results;
    const idsToRecord = [...freshResults.map((b) => b.id), ...combinedMissingIds];
    const newHealedIds = idsToRecord.filter((id) => !attemptedHealIds.has(id));
    if (newHealedIds.length > 0) {
      const next = new Set(attemptedHealIds);
      for (const id of newHealedIds) next.add(id);
      setAttemptedHealIds(next);
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem('bookarium_auto_heal_attempted', JSON.stringify(Array.from(next)));
        } catch {
          // Ignore storage quota/access errors
        }
      }
    }
  }

  // 5. Rehydrate and enrich stores when fresh books arrive (reference-guarded)
  const lastProcessedResultsRef = useRef<unknown>(null);

  useEffect(() => {
    if (!missingBooksData?.results || missingBooksData.results.length === 0) return;
    if (lastProcessedResultsRef.current === missingBooksData.results) return;
    lastProcessedResultsRef.current = missingBooksData.results;

    const freshResults = missingBooksData.results;

    // All enrichment methods are internally idempotent and self-guarded
    useBookshelfStore.getState().syncFavoriteBooks(freshResults);
    useBookshelfStore.getState().enrichSavedBooks(freshResults);
    useReaderStore.getState().enrichReadingPositions(freshResults);
    for (const book of freshResults) {
      const author = book.authors ? formatAuthorNames(book.authors) : undefined;
      useAnnotationStore.getState().updateBookMetadata(book.id, book.title, author);
    }
  }, [missingBooksData?.results]);

  return {
    isHealing: Boolean(missingIdsParam && isHealing),
    missingFavoriteIds,
    incompleteSavedIds,
    totalMissingCount: combinedMissingIds.length,
  };
}

