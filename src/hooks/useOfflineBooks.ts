'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GutendexBook } from '@/types/book.types';
import {
  getOfflineBookIds,
  saveOfflineBook,
  removeOfflineBook,
  getStorageQuota,
  type StorageQuotaInfo,
} from '@/lib/offline-storage';
import { API_ENDPOINTS } from '@/config/api-endpoints';

export interface OfflineProgress {
  current: number;
  total: number;
}

export function useOfflineBooks() {
  const [offlineBookIds, setOfflineBookIds] = useState<number[]>([]);
  const [storageQuota, setStorageQuota] = useState<StorageQuotaInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingBookId, setDownloadingBookId] = useState<number | null>(null);
  const [downloadAllProgress, setDownloadAllProgress] = useState<OfflineProgress | null>(null);

  const refreshStorageQuota = useCallback(async () => {
    try {
      const quota = await getStorageQuota();
      setStorageQuota(quota);
    } catch {
      // Non-blocking fallback
    }
  }, []);

  const refreshOfflineIds = useCallback(async () => {
    try {
      const ids = await getOfflineBookIds();
      setOfflineBookIds(ids);
      await refreshStorageQuota();
    } catch {
      // Non-blocking fallback
    }
  }, [refreshStorageQuota]);

  useEffect(() => {
    let isMounted = true;
    getOfflineBookIds()
      .then((ids) => {
        if (isMounted) {
          setOfflineBookIds(ids);
        }
      })
      .catch(() => {});

    getStorageQuota()
      .then((quota) => {
        if (isMounted) {
          setStorageQuota(quota);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const downloadBook = useCallback(
    async (book: GutendexBook): Promise<boolean> => {
      setDownloadingBookId(book.id);
      try {
        const res = await fetch(`${API_ENDPOINTS.INTERNAL_API_CONTENT}?id=${book.id}`);
        if (!res.ok) throw new Error('Failed to fetch book content');
        const text = await res.text();
        if (!text || text.trim().length === 0) throw new Error('Empty text received');
        await saveOfflineBook(book.id, book.title, text);
        await refreshOfflineIds();
        return true;
      } catch {
        return false;
      } finally {
        setDownloadingBookId(null);
      }
    },
    [refreshOfflineIds]
  );

  const removeBook = useCallback(
    async (bookId: number): Promise<void> => {
      await removeOfflineBook(bookId);
      await refreshOfflineIds();
    },
    [refreshOfflineIds]
  );

  const downloadAll = useCallback(
    async (books: GutendexBook[]): Promise<void> => {
      if (isDownloading || books.length === 0) return;
      setIsDownloading(true);
      const missing = books.filter((b) => !offlineBookIds.includes(b.id));
      if (missing.length === 0) {
        setIsDownloading(false);
        return;
      }

      setDownloadAllProgress({ current: 0, total: missing.length });

      for (let i = 0; i < missing.length; i++) {
        const book = missing[i];
        try {
          const res = await fetch(`${API_ENDPOINTS.INTERNAL_API_CONTENT}?id=${book.id}`);
          if (res.ok) {
            const text = await res.text();
            if (text && text.trim().length > 0) {
              await saveOfflineBook(book.id, book.title, text);
            }
          }
        } catch {
          // Continue with next book
        }
        setDownloadAllProgress({ current: i + 1, total: missing.length });
      }

      await refreshOfflineIds();
      setIsDownloading(false);
      setDownloadAllProgress(null);
    },
    [isDownloading, offlineBookIds, refreshOfflineIds]
  );

  const removeAll = useCallback(
    async (books: GutendexBook[]): Promise<void> => {
      if (books.length === 0) return;
      for (const book of books) {
        await removeOfflineBook(book.id);
      }
      await refreshOfflineIds();
    },
    [refreshOfflineIds]
  );

  const isBookOffline = useCallback(
    (bookId: number) => offlineBookIds.includes(bookId),
    [offlineBookIds]
  );

  return {
    offlineBookIds,
    isBookOffline,
    downloadBook,
    removeBook,
    downloadAll,
    removeAll,
    isDownloading,
    downloadingBookId,
    downloadAllProgress,
    storageQuota,
    refreshStorageQuota,
    refreshOfflineIds,
  };
}
