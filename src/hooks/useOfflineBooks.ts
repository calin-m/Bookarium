'use client';

import { useState, useEffect, useCallback } from 'react';
import type { GutendexBook, Book, Author } from '@/types/book.types';
import {
  getOfflineBookIds,
  saveOfflineBook,
  removeOfflineBook,
  getStorageQuota,
  type StorageQuotaInfo,
} from '@/lib/offline-storage';
import { API_ENDPOINTS } from '@/config/api-endpoints';
import { parseLifespansFromName } from '@/lib/copyright-engine';

function normalizeOfflineAuthors(book: GutendexBook | Book): Author[] {
  const rawList: (Author | string)[] =
    'authorDetails' in book && Array.isArray(book.authorDetails) && book.authorDetails.length > 0
      ? book.authorDetails
      : book.authors || [];

  return rawList.map((a) => {
    if (typeof a === 'string') {
      const parsed = parseLifespansFromName(a);
      return {
        name: a,
        birth_year: parsed.birthYear,
        death_year: parsed.deathYear,
      };
    }
    if (a.birth_year == null && a.death_year == null && a.name) {
      const parsed = parseLifespansFromName(a.name);
      return {
        ...a,
        birth_year: parsed.birthYear,
        death_year: parsed.deathYear,
      };
    }
    return a;
  });
}

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
      setStorageQuota((prev) => (prev === quota ? prev : quota));
    } catch {
      // Non-blocking fallback
    }
  }, []);

  const refreshOfflineIds = useCallback(async () => {
    try {
      const ids = await getOfflineBookIds();
      setOfflineBookIds((prev) => (prev.length === 0 && ids.length === 0 ? prev : ids));
      await refreshStorageQuota();
    } catch {
      // Non-blocking fallback
    }
  }, [refreshStorageQuota]);

  useEffect(() => {
    let isMounted = true;
    getOfflineBookIds()
      .then((ids) => {
        if (isMounted && ids.length > 0) {
          setOfflineBookIds(ids);
        }
      })
      .catch(() => {});

    getStorageQuota()
      .then((quota) => {
        if (isMounted && quota !== null) {
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
        await saveOfflineBook(book.id, book.title, text, normalizeOfflineAuthors(book));
        await refreshOfflineIds();

        try {
          const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
          const store = useBookshelfStore.getState();
          if (!store.isBookSaved(book.id)) {
            await store.toggleSaveBook(book);
          }
        } catch {
          // Non-blocking fallback
        }

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
              await saveOfflineBook(book.id, book.title, text, normalizeOfflineAuthors(book));
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
