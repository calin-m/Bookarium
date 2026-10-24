'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

export const OFFLINE_BOOKS_UPDATED_EVENT = 'bookarium:offline-updated';
export const OFFLINE_DOWNLOADING_EVENT = 'bookarium:offline-downloading';

function broadcastOfflineUpdated(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(OFFLINE_BOOKS_UPDATED_EVENT));
  }
}

function broadcastDownloadingBookId(bookId: number | null): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(OFFLINE_DOWNLOADING_EVENT, { detail: { bookId } }));
  }
}

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

function areIdArraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function useOfflineBooks() {
  const [offlineBookIds, setOfflineBookIds] = useState<number[]>([]);
  const [storageQuota, setStorageQuota] = useState<StorageQuotaInfo | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadingBookId, setDownloadingBookId] = useState<number | null>(null);
  const [downloadAllProgress, setDownloadAllProgress] = useState<OfflineProgress | null>(null);

  const offlineIdsRef = useRef<number[]>([]);
  const storageQuotaRef = useRef<StorageQuotaInfo | null>(null);

  const updateOfflineIdsState = useCallback((ids: number[]) => {
    if (!areIdArraysEqual(offlineIdsRef.current, ids)) {
      offlineIdsRef.current = ids;
      setOfflineBookIds(ids);
    }
  }, []);

  const updateStorageQuotaState = useCallback((quota: StorageQuotaInfo | null) => {
    const prev = storageQuotaRef.current;
    const changed =
      prev !== quota &&
      (prev === null ||
        quota === null ||
        prev.usageBytes !== quota.usageBytes ||
        prev.quotaBytes !== quota.quotaBytes);
    if (changed) {
      storageQuotaRef.current = quota;
      setStorageQuota(quota);
    }
  }, []);

  const refreshStorageQuota = useCallback(async () => {
    try {
      const quota = await getStorageQuota();
      updateStorageQuotaState(quota);
    } catch {
      // Non-blocking fallback
    }
  }, [updateStorageQuotaState]);

  const refreshOfflineIds = useCallback(async () => {
    try {
      const ids = await getOfflineBookIds();
      updateOfflineIdsState(ids);
      await refreshStorageQuota();
    } catch {
      // Non-blocking fallback
    }
  }, [refreshStorageQuota, updateOfflineIdsState]);

  useEffect(() => {
    let isMounted = true;
    getOfflineBookIds()
      .then((ids) => {
        if (isMounted && ids.length > 0) {
          updateOfflineIdsState(ids);
        }
      })
      .catch(() => {});

    getStorageQuota()
      .then((quota) => {
        if (isMounted && quota !== null) {
          updateStorageQuotaState(quota);
        }
      })
      .catch(() => {});

    const handleOfflineUpdated = () => {
      if (!isMounted) return;
      getOfflineBookIds()
        .then((ids) => {
          if (isMounted) {
            updateOfflineIdsState(ids);
          }
        })
        .catch(() => {});
      getStorageQuota()
        .then((quota) => {
          if (isMounted) {
            updateStorageQuotaState(quota);
          }
        })
        .catch(() => {});
    };

    const handleDownloadingEvent = (event: Event) => {
      if (!isMounted) return;
      const customEvent = event as CustomEvent<{ bookId: number | null }>;
      if (customEvent.detail && 'bookId' in customEvent.detail) {
        setDownloadingBookId(customEvent.detail.bookId);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener(OFFLINE_BOOKS_UPDATED_EVENT, handleOfflineUpdated);
      window.addEventListener(OFFLINE_DOWNLOADING_EVENT, handleDownloadingEvent);
    }

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener(OFFLINE_BOOKS_UPDATED_EVENT, handleOfflineUpdated);
        window.removeEventListener(OFFLINE_DOWNLOADING_EVENT, handleDownloadingEvent);
      }
    };
  }, [updateOfflineIdsState, updateStorageQuotaState]);

  const downloadBook = useCallback(
    async (book: GutendexBook | Book): Promise<boolean> => {
      setDownloadingBookId(book.id);
      broadcastDownloadingBookId(book.id);
      try {
        const res = await fetch(`${API_ENDPOINTS.INTERNAL_API_CONTENT}?id=${book.id}`);
        if (!res.ok) throw new Error('Failed to fetch book content');
        const text = await res.text();
        if (!text || text.trim().length === 0) throw new Error('Empty text received');
        const normalizedAuthors = normalizeOfflineAuthors(book);
        await saveOfflineBook(book.id, book.title, text, normalizedAuthors);
        await refreshOfflineIds();
        broadcastOfflineUpdated();

        try {
          const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
          const store = useBookshelfStore.getState();
          if (!store.isBookSaved(book.id)) {
            const gutendexPayload: GutendexBook =
              'formats' in book
                ? book
                : {
                    id: book.id,
                    title: book.title,
                    authors: normalizedAuthors,
                    translators: book.translators || [],
                    subjects: book.subjects || [],
                    bookshelves: [],
                    languages: book.languages || ['en'],
                    copyright: book.copyright ?? false,
                    media_type: 'Text',
                    formats: {
                      ...(book.coverUrl ? { 'image/jpeg': book.coverUrl } : {}),
                      ...(book.epubUrl ? { 'application/epub+zip': book.epubUrl } : {}),
                      ...(book.htmlUrl ? { 'text/html': book.htmlUrl } : {}),
                      ...(book.txtUrl ? { 'text/plain': book.txtUrl } : {}),
                    },
                    download_count: book.downloadCount ?? 0,
                  };
            await store.toggleSaveBook(gutendexPayload);
          }
        } catch {
          // Non-blocking fallback
        }

        return true;
      } catch {
        return false;
      } finally {
        setDownloadingBookId(null);
        broadcastDownloadingBookId(null);
      }
    },
    [refreshOfflineIds]
  );

  const removeBook = useCallback(
    async (bookId: number): Promise<void> => {
      await removeOfflineBook(bookId);
      await refreshOfflineIds();
      broadcastOfflineUpdated();
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
      broadcastOfflineUpdated();
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
      broadcastOfflineUpdated();
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
