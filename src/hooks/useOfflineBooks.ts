'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GutendexBook, Book, Author } from '@/types/book.types';
import {
  getOfflineBookIds,
  getAllOfflineBookMetas,
  saveOfflineBook,
  removeOfflineBook,
  getStorageQuota,
  type StorageQuotaInfo,
} from '@/lib/offline-storage';
import { API_ENDPOINTS } from '@/config/api-endpoints';
import { parseLifespansFromName } from '@/lib/copyright-engine';
import { isPlaceholderAuthor } from '@/lib/book-metadata';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import { useBookshelfStore } from '@/stores/useBookshelfStore';

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
  let rawList: (Author | string)[] =
    'authorDetails' in book && Array.isArray(book.authorDetails) && book.authorDetails.length > 0
      ? book.authorDetails
      : book.authors || [];

  const hasAuthentic = rawList.some((a) => {
    const name = typeof a === 'string' ? a : a?.name;
    return Boolean(name && !isPlaceholderAuthor(name));
  });

  if (!hasAuthentic && typeof window !== 'undefined') {
    try {
      const shelfState = useBookshelfStore.getState();
      const match =
        shelfState.savedBooks?.find((b) => b.id === book.id) ||
        shelfState.favoriteBooks?.find((b) => b.id === book.id) ||
        shelfState.recentBooks?.find((b) => b.id === book.id);
      if (match?.authors && match.authors.length > 0) {
        const matchAuthentic = match.authors.some((a) => a.name && !isPlaceholderAuthor(a.name));
        if (matchAuthentic) rawList = match.authors;
      }
    } catch {}
  }

  if (!hasAuthentic && (!rawList.length || rawList.every((a) => isPlaceholderAuthor(typeof a === 'string' ? a : a?.name)))) {
    const hero = FEATURED_HERO_BOOKS.find((h) => h.id === book.id);
    if (hero && hero.author && !isPlaceholderAuthor(hero.author)) {
      rawList = [
        {
          name: hero.author,
          birth_year: hero.authorBirthYear ?? null,
          death_year: hero.authorDeathYear ?? null,
        },
      ];
    }
  }

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

function areIdArraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function useOfflineBooks() {
  const [offlineBookIds, setOfflineBookIds] = useState<number[]>([]);
  const [offlineBooks, setOfflineBooks] = useState<GutendexBook[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [storageQuota, setStorageQuota] = useState<StorageQuotaInfo | null>(null);
  const [downloadingBookId, setDownloadingBookId] = useState<number | null>(null);

  const offlineIdsRef = useRef<number[]>([]);
  const offlineBooksRef = useRef<GutendexBook[]>([]);
  const storageQuotaRef = useRef<StorageQuotaInfo | null>(null);

  const updateOfflineIdsState = useCallback((ids: number[]) => {
    if (!areIdArraysEqual(offlineIdsRef.current, ids)) {
      offlineIdsRef.current = ids;
      setOfflineBookIds(ids);
    }
  }, []);

  const updateOfflineBooksState = useCallback((metas: GutendexBook[]) => {
    const formatMetaSig = (list: GutendexBook[]) =>
      list.map((b) => `${b.id}:${b.authors.map((a) => a.name).join('|')}`).join(',');
    if (formatMetaSig(offlineBooksRef.current) !== formatMetaSig(metas)) {
      offlineBooksRef.current = metas;
      setOfflineBooks(metas);
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

  const refreshOfflineMetas = useCallback(async () => {
    try {
      if (typeof getAllOfflineBookMetas === 'function') {
        const metas = await getAllOfflineBookMetas();
        if (Array.isArray(metas)) {
          updateOfflineBooksState(metas);
        }
      }
    } catch {
      // Non-blocking fallback
    }
  }, [updateOfflineBooksState]);

  const refreshOfflineIds = useCallback(async () => {
    try {
      const ids = await getOfflineBookIds();
      updateOfflineIdsState(ids);
      await refreshOfflineMetas();
      await refreshStorageQuota();
    } catch {
      // Non-blocking fallback
    }
  }, [refreshOfflineMetas, refreshStorageQuota, updateOfflineIdsState]);

  useEffect(() => {
    let isMounted = true;
    getOfflineBookIds()
      .then((ids) => {
        if (isMounted) {
          if (ids.length > 0) {
            updateOfflineIdsState(ids);
          }
          setIsLoaded(true);
        }
      })
      .catch(() => {
        if (isMounted) {
          setIsLoaded(true);
        }
      });

    if (typeof getAllOfflineBookMetas === 'function') {
      getAllOfflineBookMetas()
        .then((metas) => {
          if (isMounted && Array.isArray(metas) && metas.length > 0) {
            updateOfflineBooksState(metas);
          }
        })
        .catch(() => {});
    }

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
      if (typeof getAllOfflineBookMetas === 'function') {
        getAllOfflineBookMetas()
          .then((metas) => {
            if (isMounted && Array.isArray(metas)) {
              updateOfflineBooksState(metas);
            }
          })
          .catch(() => {});
      }
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
  }, [updateOfflineIdsState, updateOfflineBooksState, updateStorageQuotaState]);

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

        // Pre-warm lazy-loaded Reader & Modal JS bundles so offline opening never hits ChunkLoadError
        if (typeof window !== 'undefined') {
          void import('@/app/read/[id]/page').catch(() => {});
          void import('@/components/presentation/BookPreviewModal').catch(() => {});
          void import('@/components/presentation/DownloadDrawer').catch(() => {});
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
    offlineBooks,
    isLoaded,
    isBookOffline,
    downloadBook,
    removeBook,
    removeAll,
    downloadingBookId,
    storageQuota,
    refreshStorageQuota,
    refreshOfflineIds,
  };
}
