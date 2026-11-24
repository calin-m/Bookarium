/**
 * @module src/hooks/useOfflineCoverImage
 * @scope Local-first book cover image resolution (`coverObjectUrlCache` -> IndexedDB `offline_books`/`cover_cache` -> same-origin `/api/books/content?type=cover`) and background cache warming.
 * @invariant Resolve synchronous `getMemoryCachedCoverUrl` hits first, inspect IndexedDB (`getOfflineBookCover`) before releasing online requests, and rewrite all Project Gutenberg / mirror cover URLs (`GUTENBERG_COVER_HOSTS`) strictly to same-origin `/api/books/content?id=<bookId>&type=cover` without client-side mirror hotlinking or cascading host fallbacks.
 * @invariant Trigger `warmCoverCache` on successful online `handleImageLoad` (`!blob:`), transition directly to `imageError: true` on cover load failure so cards render their dark typographic fallback cover, and revoke only `isOwned` fallback `blob:` URLs via `URL.revokeObjectURL` on unmount while leaving shared pooled `getOrCreateMemoryCoverUrl` URLs intact.
 * @rationale Routing all online cover reads through the same-origin R2-backed endpoint eliminates external Gutenberg `<img>` hotlinking, tightens CSP `img-src` to `'self' data: blob:`, and makes missing R2 covers visibly fall back to typographic card artwork.
 * @adr ADR-070, ADR-080, ADR-082
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { API_ENDPOINTS } from '@/config/api-endpoints';
import { GUTENBERG_COVER_HOSTS } from '@/lib/adapters/book.adapter';
import {
  getOfflineBookCover,
  getMemoryCachedCoverUrl,
  getOrCreateMemoryCoverUrl,
  warmCoverCache,
} from '@/lib/offline-storage';

/**
 * Resolves a cover URL cleanly without external Project Gutenberg hotlinking:
 * Gutenberg/mirror URLs map directly to same-origin `/api/books/content?id=<bookId>&type=cover`
 * backed strictly by Cloudflare R2, while explicit `blob:`, `data:`, and non-Gutenberg paths
 * are preserved as-is.
 */
export function resolveBookCoverUrl(bookId: number, primaryUrl?: string | null): string | null {
  const trimmed = (primaryUrl || '').trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const isHttp = parsed.protocol === 'https:' || parsed.protocol === 'http:';
    if (isHttp && GUTENBERG_COVER_HOSTS.has(parsed.hostname.toLowerCase())) {
      if (!Number.isInteger(bookId) || bookId <= 0) {
        return null;
      }
      return `${API_ENDPOINTS.INTERNAL_API_CONTENT}?id=${Math.trunc(bookId)}&type=cover`;
    }
  } catch {
    // Relative paths preserve direct same-origin loading
  }

  return trimmed;
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
 * `offline_books`/`cover_cache`), same-origin R2-backed cover routing (`/api/books/content?type=cover`),
 * background cache warming on successful online loads, direct fallback-cover signaling on error,
 * and owned `URL.revokeObjectURL` cleanup on unmount. Used by `BookCard` and `BookmarkCard`.
 */
export function useOfflineCoverImage(
  bookId: number,
  isOffline?: boolean,
  primaryCoverUrl?: string | null
): OfflineCoverImageState {
  const sourceKey = `${bookId}:${primaryCoverUrl ?? ''}`;
  const resolvedRemoteUrl = useMemo(
    () => resolveBookCoverUrl(bookId, primaryCoverUrl),
    [bookId, primaryCoverUrl]
  );

  const canCheckIndexedDb =
    typeof window !== 'undefined' && typeof (window as { indexedDB?: unknown }).indexedDB !== 'undefined';
  const memoryCachedUrl =
    typeof getMemoryCachedCoverUrl === 'function' ? getMemoryCachedCoverUrl(bookId) : null;
  const isBlobPrimaryUrl = Boolean(primaryCoverUrl && primaryCoverUrl.trim().startsWith('blob:'));

  const [errorState, setErrorState] = useState<{
    key: string;
    error: boolean;
  }>({ key: sourceKey, error: false });
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

  const imageError = errorState.key === sourceKey ? errorState.error : false;
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

  const onlineCoverUrl = !isCheckingLocalCache ? resolvedRemoteUrl : null;
  const activeCoverUrl = offlineCoverUrl || onlineCoverUrl;

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
        // Non-blocking fallback to typographic placeholder cover
      }
    }

    setErrorState({
      key: sourceKey,
      error: true,
    });
  }, [bookId, isOffline, offlineCoverUrl, offlineLookupTriedKey, sourceKey]);

  return {
    imageError,
    offlineCoverUrl,
    activeCoverUrl,
    isCheckingLocalCache,
    handleImageError,
    handleImageLoad,
  };
}
