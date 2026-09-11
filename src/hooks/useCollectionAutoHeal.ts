import { useMemo, useEffect } from 'react';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useBooks } from '@/hooks/queries/useBooks';
import { useHasMounted } from '@/hooks/useHasMounted';

export interface CollectionAutoHealResult {
  isHealing: boolean;
  missingFavoriteIds: number[];
  incompleteSavedIds: number[];
  totalMissingCount: number;
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
      if (
        !b.authors ||
        b.authors.length === 0 ||
        b.authors.every((a) => a.birth_year == null && a.death_year == null)
      ) {
        ids.push(b.id);
      }
    }
    return ids;
  }, [savedBooks, hasMounted]);

  // 3. Combine and deduplicate all IDs requiring fresh upstream metadata
  const combinedMissingIds = useMemo(() => {
    const set = new Set<number>([...missingFavoriteIds, ...incompleteSavedIds]);
    return Array.from(set);
  }, [missingFavoriteIds, incompleteSavedIds]);

  const missingIdsParam = combinedMissingIds.length > 0 ? combinedMissingIds.join(',') : undefined;

  // 4. Single batched query to /api/books?ids=... (dormant when combinedMissingIds is empty)
  const { data: missingBooksData, isLoading: isHealing } = useBooks(
    missingIdsParam ? { ids: missingIdsParam } : undefined,
    { enabled: Boolean(missingIdsParam) }
  );

  // 5. Rehydrate and enrich stores when fresh books arrive
  useEffect(() => {
    if (!missingBooksData?.results || missingBooksData.results.length === 0) return;

    const freshResults = missingBooksData.results;

    // A. Sync missing favorites
    if (missingFavoriteIds.length > 0) {
      useBookshelfStore.getState().syncFavoriteBooks(freshResults);
    }

    // B. Enrich saved books missing lifespans
    if (incompleteSavedIds.length > 0) {
      useBookshelfStore.getState().enrichSavedBooks(freshResults);
    }
  }, [missingBooksData, missingFavoriteIds, incompleteSavedIds]);

  return {
    isHealing: Boolean(missingIdsParam && isHealing),
    missingFavoriteIds,
    incompleteSavedIds,
    totalMissingCount: combinedMissingIds.length,
  };
}

