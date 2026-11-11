import { useState, useEffect, useCallback } from 'react';

export interface OfflineCoverImageState {
  imageError: boolean;
  offlineCoverUrl: string | null;
  handleImageError: () => Promise<void>;
}

/**
 * Shared hook managing book cover image load fallback to IndexedDB cached cover blobs
 * (`getOfflineBookCover`) and automatic `URL.revokeObjectURL` object URL cleanup on unmount.
 * Used by `BookCard` and `BookmarkCard`.
 */
export function useOfflineCoverImage(
  bookId: number,
  isOffline?: boolean
): OfflineCoverImageState {
  const [imageError, setImageError] = useState(false);
  const [offlineCoverUrl, setOfflineCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (offlineCoverUrl && offlineCoverUrl.startsWith('blob:')) {
        URL.revokeObjectURL(offlineCoverUrl);
      }
    };
  }, [offlineCoverUrl]);

  const handleImageError = useCallback(async () => {
    if (!offlineCoverUrl && isOffline) {
      try {
        const { getOfflineBookCover } = await import('@/lib/offline-storage');
        const blob = await getOfflineBookCover(bookId);
        if (
          blob &&
          typeof URL !== 'undefined' &&
          typeof URL.createObjectURL === 'function'
        ) {
          const blobUrl = URL.createObjectURL(blob);
          setOfflineCoverUrl(blobUrl);
          return;
        }
      } catch {
        // Non-blocking fallback to typographic placeholder cover
      }
    }
    setImageError(true);
  }, [bookId, isOffline, offlineCoverUrl]);

  return {
    imageError,
    offlineCoverUrl,
    handleImageError,
  };
}
