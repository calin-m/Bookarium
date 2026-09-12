import { useState, useMemo, useEffect, useRef } from 'react';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useBooks } from '@/hooks/queries/useBooks';
import { useHasMounted } from '@/hooks/useHasMounted';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import type { GutendexBook } from '@/types/book.types';

export interface CollectionAutoHealResult {
  isHealing: boolean;
  missingFavoriteIds: number[];
  incompleteSavedIds: number[];
  totalMissingCount: number;
}

function isBookIncomplete(b: GutendexBook): boolean {
  if (!b.authors || b.authors.length === 0) return true;
  return b.authors.every((a) => a.birth_year == null && a.death_year == null);
}

/**
 * Unified Collection Auto-Healing Hook.
 * Scans user collections (Bookshelf & Favorites) for volumes with missing or incomplete metadata,
 * performs a single deduplicated batch request to /api/books?ids=...,
 * and enriches local & cloud stores with authoritative author lifespans and book structures.
 */
export function useCollectionAutoHeal(): CollectionAutoHealResult {
  const hasMounted = useHasMounted();

  const favoriteBookIds = useBookshelfStore((s) => s.favoriteBookIds);
  const favoriteBooks = useBookshelfStore((s) => s.favoriteBooks || []);
  const savedBooks = useBookshelfStore((s) => s.savedBooks || []);

  // Track book IDs queried this session to prevent infinite re-query loops on authors without known lifespans
  const [attemptedHealIds, setAttemptedHealIds] = useState<Set<number>>(() => new Set());
  const [prevResults, setPrevResults] = useState<unknown>(null);

  // Fast-path synchronous healing for featured hero books from static fixtures
  useEffect(() => {
    if (!hasMounted || savedBooks.length === 0) return;
    const heroBooksToEnrich: GutendexBook[] = [];
    for (const b of savedBooks) {
      if (isBookIncomplete(b)) {
        const hero = FEATURED_HERO_BOOKS.find((h) => h.id === b.id);
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
            formats: b.formats || {},
            download_count: b.download_count || 0,
          });
        }
      }
    }
    if (heroBooksToEnrich.length > 0) {
      useBookshelfStore.getState().enrichSavedBooks(heroBooksToEnrich);
    }
  }, [hasMounted, savedBooks]);

  // 1. Detect favorite IDs in localStorage/cloud that lack full book metadata
  const missingFavoriteIds = useMemo(() => {
    if (!hasMounted) return [];
    const knownIds = new Set((favoriteBooks || []).map((b) => b.id));
    return favoriteBookIds.filter((id) => !knownIds.has(id));
  }, [favoriteBookIds, favoriteBooks, hasMounted]);

  // 2. Detect saved books on the shelf that lack author lifespan metadata (both birth & death year null/undefined)
  const incompleteSavedIds = useMemo(() => {
    if (!hasMounted) return [];
    const ids: number[] = [];
    for (const b of savedBooks) {
      if (attemptedHealIds.has(b.id)) continue;
      if (isBookIncomplete(b)) {
        const hero = FEATURED_HERO_BOOKS.find((h) => h.id === b.id);
        if (hero && (hero.authorBirthYear != null || hero.authorDeathYear != null)) {
          continue; // Handled synchronously via local fixture fast-path
        }
        ids.push(b.id);
      }
    }
    return ids;
  }, [savedBooks, attemptedHealIds, hasMounted]);

  // 3. Combine and deduplicate all IDs requiring fresh upstream metadata
  const combinedMissingIds = useMemo(() => {
    const set = new Set<number>([...missingFavoriteIds, ...incompleteSavedIds]);
    return Array.from(set);
  }, [missingFavoriteIds, incompleteSavedIds]);

  const missingIdsParam = combinedMissingIds.length > 0 ? combinedMissingIds.join(',') : undefined;

  // 4. Single batched query to /api/books?ids=... (dormant when combinedMissingIds is empty)
  const { data: missingBooksData, isLoading: isHealing } = useBooks(
    missingIdsParam ? { ids: missingIdsParam, includeRestrictedMetadata: true } : undefined,
    { enabled: Boolean(missingIdsParam) }
  );

  // Adjust attempted heal session tracking during render when fresh upstream books arrive
  if (missingBooksData?.results && missingBooksData.results !== prevResults) {
    setPrevResults(missingBooksData.results);
    const freshResults = missingBooksData.results;
    const newHealedIds = freshResults.map((b) => b.id).filter((id) => !attemptedHealIds.has(id));
    if (newHealedIds.length > 0) {
      const next = new Set(attemptedHealIds);
      for (const id of newHealedIds) next.add(id);
      setAttemptedHealIds(next);
    }
  }

  // 5. Rehydrate and enrich stores when fresh books arrive (reference-guarded)
  const lastProcessedResultsRef = useRef<unknown>(null);

  useEffect(() => {
    if (!missingBooksData?.results || missingBooksData.results.length === 0) return;
    if (lastProcessedResultsRef.current === missingBooksData.results) return;
    lastProcessedResultsRef.current = missingBooksData.results;

    const freshResults = missingBooksData.results;

    // Both methods are internally idempotent and self-guarded
    useBookshelfStore.getState().syncFavoriteBooks(freshResults);
    useBookshelfStore.getState().enrichSavedBooks(freshResults);
  }, [missingBooksData?.results]);

  return {
    isHealing: Boolean(missingIdsParam && isHealing),
    missingFavoriteIds,
    incompleteSavedIds,
    totalMissingCount: combinedMissingIds.length,
  };
}

