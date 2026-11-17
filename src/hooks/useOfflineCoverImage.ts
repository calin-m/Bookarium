/**
 * @module src/hooks/useOfflineCoverImage
 * @scope Local-first book cover image resolution (`coverObjectUrlCache` -> IndexedDB `offline_books`/`cover_cache`), mirror-first Gutenberg fallback, and background cache warming.
 * @invariant Resolve synchronous `getMemoryCachedCoverUrl` hits first and check IndexedDB (`getOfflineBookCover`) before trying online `resolveGutenbergCoverCandidates` (`aleph.gutenberg.org` -> `gutenberg.pglaf.org` -> `gutenberg.readingroo.ms` -> original host).
 * @invariant Trigger `warmCoverCache` on successful online `handleImageLoad` (`!blob:`) and strictly revoke only `isOwned` fallback `blob:` URLs via `URL.revokeObjectURL` on unmount while leaving shared pooled `getOrCreateMemoryCoverUrl` URLs intact.
 * @rationale Holding mirror requests while checking device IndexedDB eliminates redundant mirror downloads across catalog/shelf refreshes regardless of which Gutenberg host succeeded, and separating owned vs. pooled object URLs prevents premature image revocation across virtualized cards.
 * @adr ADR-070, ADR-080
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getOfflineBookCover,
  getMemoryCachedCoverUrl,
  getOrCreateMemoryCoverUrl,
  warmCoverCache,
} from '@/lib/offline-storage';

const GUTENBERG_COVER_MIRROR_ORIGINS = [
  'https://aleph.gutenberg.org',
  'https://gutenberg.pglaf.org',
  'https://gutenberg.readingroo.ms',
] as const;

const GUTENBERG_PRIMARY_COVER_HOSTS = new Set(['www.gutenberg.org', 'gutenberg.org']);

/**
 * Resolves an ordered, mirror-first URL cascade for Project Gutenberg cover artwork
 * (`aleph.gutenberg.org` -> `gutenberg.pglaf.org` -> `gutenberg.readingroo.ms` -> original host)
 * while leaving non-Gutenberg or custom URLs untouched as a single candidate.
 */
export function resolveGutenbergCoverCandidates(primaryUrl?: string | null): string[] {
  const trimmed = (primaryUrl || '').trim();
  if (!trimmed) return [];

  try {
    const parsed = new URL(trimmed);
    const isHttp = parsed.protocol === 'https:' || parsed.protocol === 'http:';
    if (isHttp && GUTENBERG_PRIMARY_COVER_HOSTS.has(parsed.hostname.toLowerCase())) {
      const suffix = `${parsed.pathname}${parsed.search}`;
      const ordered = [
        ...GUTENBERG_COVER_MIRROR_ORIGINS.map((origin) => `${origin}${suffix}`),
        trimmed,
      ];
      return Array.from(new Set(ordered));
    }
  } catch {
    // Non-URL / relative fixture paths preserve direct loading without mirror rewriting
  }

  return [trimmed];
}

export interface OfflineCoverImageState {
  imageError: boolean;
  offlineCoverUrl: string | null;
  activeCoverUrl: string | null;
  isCheckingLocalCache: boolean;
  handleImageError: () => Promise<void>;
  handleImageLoad: () => void;
}

/**
 * Shared hook coordinating local cover cache hydration (`coverObjectUrlCache` -> IndexedDB
 * `offline_books`/`cover_cache`), mirror-first Gutenberg online cover fallback (`aleph.gutenberg.org`
 * -> `gutenberg.pglaf.org` -> `gutenberg.readingroo.ms` -> `www.gutenberg.org`), background
 * cache warming on successful online loads, and owned `URL.revokeObjectURL` cleanup on unmount.
 * Used by `BookCard` and `BookmarkCard`.
 */
export function useOfflineCoverImage(
  bookId: number,
  isOffline?: boolean,
  primaryCoverUrl?: string | null
): OfflineCoverImageState {
  const sourceKey = `${bookId}:${primaryCoverUrl ?? ''}`;
  const candidates = useMemo(
    () => resolveGutenbergCoverCandidates(primaryCoverUrl),
    [primaryCoverUrl]
  );

  const canCheckIndexedDb =
    typeof window !== 'undefined' && typeof (window as { indexedDB?: unknown }).indexedDB !== 'undefined';
  const memoryCachedUrl =
    typeof getMemoryCachedCoverUrl === 'function' ? getMemoryCachedCoverUrl(bookId) : null;
  const isBlobPrimaryUrl = Boolean(primaryCoverUrl && primaryCoverUrl.trim().startsWith('blob:'));

  const [mirrorState, setMirrorState] = useState<{
    key: string;
    index: number;
    error: boolean;
  }>({ key: sourceKey, index: 0, error: false });
  const [offlineState, setOfflineState] = useState<{
    bookId: number;
    url: string;
    isOwned: boolean;
  } | null>(null);
  const [localLookupState, setLocalLookupState] = useState<{
    key: string;
    url: string | null;
    isOwned: boolean;
  }>({ key: '', url: null, isOwned: false });
  const [offlineLookupTriedKey, setOfflineLookupTriedKey] = useState<string | null>(null);

  useEffect(() => {
    if (
      !canCheckIndexedDb ||
      memoryCachedUrl ||
      isBlobPrimaryUrl ||
      localLookupState.key === sourceKey ||
      typeof getOfflineBookCover !== 'function'
    ) {
      return;
    }

    let cancelled = false;

    void Promise.resolve(getOfflineBookCover(bookId))
      .then((blob) => {
        if (cancelled) return;
        if (
          blob &&
          typeof URL !== 'undefined' &&
          typeof URL.createObjectURL === 'function'
        ) {
          const sharedUrl =
            typeof getOrCreateMemoryCoverUrl === 'function'
              ? getOrCreateMemoryCoverUrl(bookId, blob)
              : null;
          if (sharedUrl) {
            setLocalLookupState({ key: sourceKey, url: sharedUrl, isOwned: false });
            return;
          }
          const ownedUrl = URL.createObjectURL(blob);
          setLocalLookupState({ key: sourceKey, url: ownedUrl, isOwned: true });
          return;
        }
        setLocalLookupState({ key: sourceKey, url: null, isOwned: false });
      })
      .catch(() => {
        if (!cancelled) {
          setLocalLookupState({ key: sourceKey, url: null, isOwned: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [bookId, canCheckIndexedDb, memoryCachedUrl, isBlobPrimaryUrl, localLookupState.key, sourceKey]);

  const effectiveIndex = mirrorState.key === sourceKey ? mirrorState.index : 0;
  const imageError = mirrorState.key === sourceKey ? mirrorState.error : false;
  const matchedLocalUrl =
    localLookupState.key === sourceKey ? localLookupState.url : null;
  const offlineCoverUrl =
    (offlineState && offlineState.bookId === bookId ? offlineState.url : null) ||
    memoryCachedUrl ||
    matchedLocalUrl;

  const isCheckingLocalCache =
    !offlineCoverUrl &&
    !isBlobPrimaryUrl &&
    canCheckIndexedDb &&
    localLookupState.key !== sourceKey;

  const currentCandidateUrl =
    !isCheckingLocalCache && candidates.length > 0 && effectiveIndex < candidates.length
      ? candidates[effectiveIndex]
      : null;
  const activeCoverUrl = offlineCoverUrl || currentCandidateUrl;

  useEffect(() => {
    const ownedOfflineUrl =
      offlineState && offlineState.bookId === bookId && offlineState.isOwned
        ? offlineState.url
        : null;
    const ownedLocalUrl =
      localLookupState.key === sourceKey && localLookupState.isOwned
        ? localLookupState.url
        : null;

    return () => {
      if (ownedOfflineUrl && ownedOfflineUrl.startsWith('blob:')) {
        URL.revokeObjectURL(ownedOfflineUrl);
      }
      if (ownedLocalUrl && ownedLocalUrl !== ownedOfflineUrl && ownedLocalUrl.startsWith('blob:')) {
        URL.revokeObjectURL(ownedLocalUrl);
      }
    };
  }, [bookId, offlineState, localLookupState, sourceKey]);

  const handleImageLoad = useCallback(() => {
    if (
      activeCoverUrl &&
      !activeCoverUrl.startsWith('blob:') &&
      typeof warmCoverCache === 'function'
    ) {
      warmCoverCache(bookId);
    }
  }, [activeCoverUrl, bookId]);

  const handleImageError = useCallback(async () => {
    if (
      !offlineCoverUrl &&
      isOffline &&
      offlineLookupTriedKey !== sourceKey &&
      typeof getOfflineBookCover === 'function'
    ) {
      setOfflineLookupTriedKey(sourceKey);
      try {
        const blob = await getOfflineBookCover(bookId);
        if (
          blob &&
          typeof URL !== 'undefined' &&
          typeof URL.createObjectURL === 'function'
        ) {
          const blobUrl = URL.createObjectURL(blob);
          setOfflineState({ bookId, url: blobUrl, isOwned: true });
          return;
        }
      } catch {
        // Non-blocking fallback to remaining mirrors or typographic placeholder cover
      }
    }

    if (effectiveIndex + 1 < candidates.length) {
      setMirrorState({
        key: sourceKey,
        index: effectiveIndex + 1,
        error: false,
      });
      return;
    }

    setMirrorState({
      key: sourceKey,
      index: effectiveIndex,
      error: true,
    });
  }, [bookId, isOffline, offlineCoverUrl, offlineLookupTriedKey, sourceKey, effectiveIndex, candidates.length]);

  return {
    imageError,
    offlineCoverUrl,
    activeCoverUrl,
    isCheckingLocalCache,
    handleImageError,
    handleImageLoad,
  };
}
