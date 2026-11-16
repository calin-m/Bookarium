import { useState, useEffect, useCallback, useMemo } from 'react';

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
  handleImageError: () => Promise<void>;
}

/**
 * Shared hook coordinating mirror-first Gutenberg online cover fallback (`aleph.gutenberg.org`
 * -> `gutenberg.pglaf.org` -> `gutenberg.readingroo.ms` -> `www.gutenberg.org`), IndexedDB
 * offline cover blob hydration (`getOfflineBookCover`), and automatic `URL.revokeObjectURL`
 * cleanup on unmount. Used by `BookCard` and `BookmarkCard`.
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

  const [mirrorState, setMirrorState] = useState<{
    key: string;
    index: number;
    error: boolean;
  }>({ key: sourceKey, index: 0, error: false });
  const [offlineState, setOfflineState] = useState<{
    bookId: number;
    url: string;
  } | null>(null);
  const [offlineLookupTriedKey, setOfflineLookupTriedKey] = useState<string | null>(null);

  const effectiveIndex = mirrorState.key === sourceKey ? mirrorState.index : 0;
  const imageError = mirrorState.key === sourceKey ? mirrorState.error : false;
  const offlineCoverUrl = offlineState && offlineState.bookId === bookId ? offlineState.url : null;
  const currentCandidateUrl =
    candidates.length > 0 && effectiveIndex < candidates.length
      ? candidates[effectiveIndex]
      : null;
  const activeCoverUrl = offlineCoverUrl || currentCandidateUrl;

  useEffect(() => {
    const urlToRevoke = offlineCoverUrl;
    return () => {
      if (urlToRevoke && urlToRevoke.startsWith('blob:')) {
        URL.revokeObjectURL(urlToRevoke);
      }
    };
  }, [offlineCoverUrl]);

  const handleImageError = useCallback(async () => {
    if (!offlineCoverUrl && isOffline && offlineLookupTriedKey !== sourceKey) {
      setOfflineLookupTriedKey(sourceKey);
      try {
        const { getOfflineBookCover } = await import('@/lib/offline-storage');
        const blob = await getOfflineBookCover(bookId);
        if (
          blob &&
          typeof URL !== 'undefined' &&
          typeof URL.createObjectURL === 'function'
        ) {
          const blobUrl = URL.createObjectURL(blob);
          setOfflineState({ bookId, url: blobUrl });
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
    handleImageError,
  };
}
