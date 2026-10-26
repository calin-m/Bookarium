import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveOfflineBook,
  getOfflineBook,
  isBookOffline,
  removeOfflineBook,
  getOfflineBookIds,
  getAllOfflineBooks,
  getAllOfflineBookMetas,
  clearAllOfflineBooks,
  type OfflineBookRecord,
} from './offline-storage';

describe('offline-storage (IndexedDB engine)', () => {
  const store = new Map<number, OfflineBookRecord>();

  beforeEach(() => {
    store.clear();

    const mockObjectStore = {
      put: vi.fn((record: OfflineBookRecord) => {
        store.set(record.bookId, record);
        const req: any = { onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
      get: vi.fn((key: number) => {
        const record = store.get(key);
        const req: any = { result: record, onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
      count: vi.fn((range: any) => {
        const hasKey = store.has(range?._key ?? range);
        const req: any = { result: hasKey ? 1 : 0, onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
      delete: vi.fn((key: number) => {
        store.delete(key);
        const req: any = { onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
      getAllKeys: vi.fn(() => {
        const req: any = { result: Array.from(store.keys()), onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
      getAll: vi.fn(() => {
        const req: any = { result: Array.from(store.values()), onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
      clear: vi.fn(() => {
        store.clear();
        const req: any = { onsuccess: null, onerror: null };
        setTimeout(() => req.onsuccess?.(), 0);
        return req;
      }),
    };

    const mockTransaction = {
      objectStore: vi.fn(() => mockObjectStore),
    };

    const mockDB = {
      transaction: vi.fn(() => mockTransaction),
      objectStoreNames: { contains: vi.fn(() => true) },
      createObjectStore: vi.fn(),
    };

    const mockOpenRequest: any = {
      result: mockDB,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };

    (globalThis as any).indexedDB = {
      open: vi.fn(() => {
        setTimeout(() => {
          if (mockOpenRequest.onupgradeneeded) {
            mockOpenRequest.onupgradeneeded({ target: mockOpenRequest });
          }
          mockOpenRequest.onsuccess?.();
        }, 0);
        return mockOpenRequest;
      }),
    };

    (globalThis as any).IDBKeyRange = {
      only: vi.fn((val: any) => ({ _key: val })),
    };
  });

  it('saves book text to offline storage', async () => {
    await saveOfflineBook(11, 'Alice in Wonderland', 'Down the rabbit hole...');
    expect(store.has(11)).toBe(true);
    expect(store.get(11)?.title).toBe('Alice in Wonderland');
    expect(store.get(11)?.text).toBe('Down the rabbit hole...');
  });

  it('retrieves offline book text correctly', async () => {
    await saveOfflineBook(84, 'Frankenstein', 'It was on a dreary night of November...');
    const content = await getOfflineBook(84);
    expect(content).toBe('It was on a dreary night of November...');
  });

  it('returns null when book is not offline', async () => {
    const content = await getOfflineBook(99999);
    expect(content).toBeNull();
  });

  it('checks if a book is offline', async () => {
    expect(await isBookOffline(1342)).toBe(false);
    await saveOfflineBook(1342, 'Pride and Prejudice', 'It is a truth universally acknowledged...');
    expect(await isBookOffline(1342)).toBe(true);
  });

  it('removes offline book', async () => {
    await saveOfflineBook(11, 'Alice in Wonderland', 'Down the rabbit hole...');
    expect(await isBookOffline(11)).toBe(true);
    await removeOfflineBook(11);
    expect(await isBookOffline(11)).toBe(false);
  });

  it('fetches all offline book IDs', async () => {
    await saveOfflineBook(11, 'Alice', 'Text 1');
    await saveOfflineBook(84, 'Frankenstein', 'Text 2');
    const ids = await getOfflineBookIds();
    expect(ids).toContain(11);
    expect(ids).toContain(84);
    expect(ids).toHaveLength(2);
  });

  it('retrieves all offline books metadata without returning full text payloads and self-heals authors', async () => {
    await saveOfflineBook(11, 'Alice in Wonderland', 'Some text');
    const list = await getAllOfflineBooks();
    expect(list).toHaveLength(1);
    expect(list[0].bookId).toBe(11);
    expect(list[0].title).toBe('Alice in Wonderland');
    expect(list[0]).not.toHaveProperty('text');

    const metas = await getAllOfflineBookMetas();
    expect(metas).toHaveLength(1);
    expect(metas[0].id).toBe(11);
    expect(metas[0].title).toBe('Alice in Wonderland');
    // Recovers authentic author from fixture rather than hardcoded Anonymous
    expect(metas[0].authors[0].name).toBe('Lewis Carroll');

    // Unknown volume without store records or fixture falls back to Anonymous
    await saveOfflineBook(999999, 'Unknown Book', 'Some text');
    const metasWithUnknown = await getAllOfflineBookMetas();
    const unknown = metasWithUnknown.find((m) => m.id === 999999);
    expect(unknown?.authors[0].name).toBe('Anonymous');

    await saveOfflineBook(12, 'Through the Looking-Glass', 'More text', [
      { name: 'Carroll, Lewis', birth_year: 1832, death_year: 1898 },
    ]);
    const metasWithAuthors = await getAllOfflineBookMetas();
    const book12 = metasWithAuthors.find((m) => m.id === 12);
    expect(book12?.authors[0].name).toBe('Carroll, Lewis');

    // Test recovering authors from useBookshelfStore (savedBooks, favoriteBooks, recentBooks)
    const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
    useBookshelfStore.setState({
      savedBooks: [
        {
          id: 101,
          title: 'Saved Title',
          authors: [{ name: 'Saved Author', birth_year: 1840, death_year: 1910 }],
          translators: [],
          subjects: [],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 5,
        },
      ],
      favoriteBooks: [
        {
          id: 102,
          title: 'Favorite Title',
          authors: [{ name: 'Favorite Author', birth_year: 1850, death_year: 1920 }],
          translators: [],
          subjects: [],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 5,
        },
      ],
      recentBooks: [
        {
          id: 103,
          title: 'Recent Title',
          authors: [{ name: 'Recent Author', birth_year: 1860, death_year: 1930 }],
          translators: [],
          subjects: [],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 5,
        },
      ],
    });

    await saveOfflineBook(101, 'Saved Title', 'Text 101', [{ name: 'Anonymous', birth_year: null, death_year: null }]);
    await saveOfflineBook(102, 'Favorite Title', 'Text 102', []);
    await saveOfflineBook(103, 'Recent Title', 'Text 103', [{ name: 'Anonymous', birth_year: null, death_year: null }]);

    // Test recovering authors from useReaderStore readingPositions
    const { useReaderStore } = await import('@/stores/useReaderStore');
    useReaderStore.setState({
      readingPositions: {
        104: {
          bookTitle: 'Position Title',
          bookAuthors: ['Position Author, 1870-1940'],
          chapterIndex: 0,
          chapterPage: 1,
          globalPage: 1,
          lastReadAt: '2026-01-01',
        },
      },
    });
    await saveOfflineBook(104, 'Position Title', 'Text 104', [{ name: 'Anonymous', birth_year: null, death_year: null }]);

    const healedMetas = await getAllOfflineBookMetas();
    expect(healedMetas.find((m) => m.id === 101)?.authors[0].name).toBe('Saved Author');
    expect(healedMetas.find((m) => m.id === 102)?.authors[0].name).toBe('Favorite Author');
    expect(healedMetas.find((m) => m.id === 103)?.authors[0].name).toBe('Recent Author');
    const meta104 = healedMetas.find((m) => m.id === 104);
    expect(meta104?.authors[0].name).toBe('Position Author, 1870-1940');
    expect(meta104?.authors[0].birth_year).toBe(1870);
    expect(meta104?.authors[0].death_year).toBe(1940);
  });

  it('clears all offline books', async () => {
    await saveOfflineBook(11, 'Alice', 'Text 1');
    await saveOfflineBook(84, 'Frankenstein', 'Text 2');
    expect(store.size).toBe(2);
    await clearAllOfflineBooks();
    expect(store.size).toBe(0);
  });

  describe('Storage Quotas & LRU Eviction', () => {
    it('returns storage quota metrics from navigator.storage.estimate', async () => {
      const originalStorage = navigator.storage;
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn().mockResolvedValue({
            usage: 25 * 1024 * 1024,
            quota: 100 * 1024 * 1024,
          }),
        },
        configurable: true,
      });

      const { getStorageQuota } = await import('./offline-storage');
      const quota = await getStorageQuota();
      expect(quota).not.toBeNull();
      expect(quota?.usageBytes).toBe(25 * 1024 * 1024);
      expect(quota?.quotaBytes).toBe(100 * 1024 * 1024);
      expect(quota?.percentUsed).toBe(25);
      expect(quota?.isNearQuota).toBe(false);

      Object.defineProperty(navigator, 'storage', {
        value: originalStorage,
        configurable: true,
      });
    });

    it('evicts oldest downloaded books first to free requested space', async () => {
      const { evictOldestBooksToFreeSpace } = await import('./offline-storage');

      store.set(1, {
        bookId: 1,
        title: 'Old Book',
        text: 'Old Text',
        downloadedAt: '2025-01-01T00:00:00.000Z',
        byteSize: 5000,
      });

      store.set(2, {
        bookId: 2,
        title: 'New Book',
        text: 'New Text',
        downloadedAt: '2026-01-01T00:00:00.000Z',
        byteSize: 5000,
      });

      const freed = await evictOldestBooksToFreeSpace(4000);
      expect(freed).toBeGreaterThanOrEqual(4000);
      expect(store.has(1)).toBe(false); // Old Book was evicted
      expect(store.has(2)).toBe(true);  // New Book remains
    });

    it('returns null from getStorageQuota when storage API is unavailable or throws', async () => {
      const { getStorageQuota } = await import('./offline-storage');
      const originalStorage = navigator.storage;

      // 1. undefined storage
      Object.defineProperty(navigator, 'storage', {
        value: undefined,
        configurable: true,
      });
      expect(await getStorageQuota()).toBeNull();

      // 2. throwing estimate()
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn().mockRejectedValue(new Error('Storage failure')),
        },
        configurable: true,
      });
      expect(await getStorageQuota()).toBeNull();

      // 3. quota === 0
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn().mockResolvedValue({ usage: 0, quota: 0 }),
        },
        configurable: true,
      });
      const zeroQuota = await getStorageQuota();
      expect(zeroQuota?.percentUsed).toBe(0);
      expect(zeroQuota?.isNearQuota).toBe(false);

      // 4. near quota (>85%)
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn().mockResolvedValue({ usage: 90 * 1024 * 1024, quota: 100 * 1024 * 1024 }),
        },
        configurable: true,
      });
      const nearQuota = await getStorageQuota();
      expect(nearQuota?.percentUsed).toBe(90);
      expect(nearQuota?.isNearQuota).toBe(true);

      Object.defineProperty(navigator, 'storage', {
        value: originalStorage,
        configurable: true,
      });
    });

    it('returns 0 freed bytes when offline store is empty or eviction fails', async () => {
      const { evictOldestBooksToFreeSpace } = await import('./offline-storage');
      store.clear();
      expect(await evictOldestBooksToFreeSpace(5000)).toBe(0);
    });

    it('triggers pre-emptive eviction during saveOfflineBook when storage buffer is low', async () => {
      const originalStorage = navigator.storage;
      Object.defineProperty(navigator, 'storage', {
        value: {
          estimate: vi.fn().mockResolvedValue({
            usage: 95 * 1024 * 1024,
            quota: 100 * 1024 * 1024, // only 5MB free, needs > 10MB buffer
          }),
        },
        configurable: true,
      });

      store.set(10, {
        bookId: 10,
        title: 'Old Book To Evict',
        text: 'Old Text',
        downloadedAt: '2024-01-01T00:00:00.000Z',
        byteSize: 100000,
      });

      await saveOfflineBook(11, 'New Low Space Book', 'New text content');
      expect(store.has(11)).toBe(true);
      expect(store.has(10)).toBe(false);

      Object.defineProperty(navigator, 'storage', {
        value: originalStorage,
        configurable: true,
      });
    });

    it('recovers from QuotaExceededError by evicting emergency space and retrying', async () => {
      store.set(1, {
        bookId: 1,
        title: 'Emergency Eviction Book',
        text: 'Old Text',
        downloadedAt: '2024-01-01T00:00:00.000Z',
        byteSize: 25 * 1024 * 1024,
      });

      let putCount = 0;
      const originalIndexedDB = (globalThis as any).indexedDB;

      const mockObjectStore = {
        put: vi.fn((record: OfflineBookRecord) => {
          putCount++;
          const req: any = { onsuccess: null, onerror: null, error: null };
          setTimeout(() => {
            if (putCount === 1) {
              const err = new Error('Quota exceeded');
              err.name = 'QuotaExceededError';
              (req as any).error = err;
              req.onerror?.({ target: req });
            } else {
              store.set(record.bookId, record);
              req.onsuccess?.();
            }
          }, 0);
          return req;
        }),
        getAll: vi.fn(() => {
          const req: any = { result: Array.from(store.values()), onsuccess: null, onerror: null };
          setTimeout(() => req.onsuccess?.(), 0);
          return req;
        }),
        delete: vi.fn((key: number) => {
          store.delete(key);
          const req: any = { onsuccess: null, onerror: null };
          setTimeout(() => req.onsuccess?.(), 0);
          return req;
        }),
      };

      const mockTransaction = {
        objectStore: vi.fn(() => mockObjectStore),
      };

      const mockDB = {
        transaction: vi.fn(() => mockTransaction),
        objectStoreNames: { contains: vi.fn(() => true) },
      };

      const mockOpenRequest: any = {
        result: mockDB,
        onsuccess: null,
        onerror: null,
      };

      (globalThis as any).indexedDB = {
        open: vi.fn(() => {
          setTimeout(() => mockOpenRequest.onsuccess?.(), 0);
          return mockOpenRequest;
        }),
      };

      await saveOfflineBook(99, 'Retry After Quota', 'Sample book text');
      expect(store.has(99)).toBe(true);
      expect(putCount).toBe(2);

      (globalThis as any).indexedDB = originalIndexedDB;
    });

    it('throws error when QuotaExceededError cannot free sufficient space', async () => {
      store.clear(); // nothing to evict

      const originalIndexedDB = (globalThis as any).indexedDB;
      const mockObjectStore = {
        put: vi.fn(() => {
          const req: any = { onsuccess: null, onerror: null, error: null };
          setTimeout(() => {
            const err = new Error('Quota exceeded');
            err.name = 'QuotaExceededError';
            req.error = err;
            req.onerror?.({ target: req });
          }, 0);
          return req;
        }),
        getAll: vi.fn(() => {
          const req: any = { result: [], onsuccess: null, onerror: null };
          setTimeout(() => req.onsuccess?.(), 0);
          return req;
        }),
      };

      const mockTransaction = {
        objectStore: vi.fn(() => mockObjectStore),
      };

      const mockDB = {
        transaction: vi.fn(() => mockTransaction),
        objectStoreNames: { contains: vi.fn(() => true) },
      };

      const mockOpenRequest: any = {
        result: mockDB,
        onsuccess: null,
      };

      (globalThis as any).indexedDB = {
        open: vi.fn(() => {
          setTimeout(() => mockOpenRequest.onsuccess?.(), 0);
          return mockOpenRequest;
        }),
      };

      await expect(saveOfflineBook(100, 'Unrecoverable Quota', 'text')).rejects.toThrow(
        /Storage quota exceeded\. Please clear some offline books\./
      );

      (globalThis as any).indexedDB = originalIndexedDB;
    });

    it('returns empty array from getOfflineBookIds when store error occurs', async () => {
      const { getOfflineBookIds } = await import('./offline-storage');
      const originalIndexedDB = (globalThis as any).indexedDB;

      (globalThis as any).indexedDB = {
        open: vi.fn(() => {
          const req: any = { onsuccess: null, onerror: null };
          setTimeout(() => {
            req.onerror?.();
          }, 0);
          return req;
        }),
      };

      const ids = await getOfflineBookIds();
      expect(ids).toEqual([]);

      (globalThis as any).indexedDB = originalIndexedDB;
    });

    it('covers database upgrade, transaction/request error handlers, and missing IndexedDB fallbacks', async () => {
      const {
        getStorageQuota,
        evictOldestBooksToFreeSpace,
        getOfflineBookRecord,
      } = await import('./offline-storage');

      // 1. getStorageQuota when estimate returns empty object {}
      const originalStorage = navigator.storage;
      Object.defineProperty(navigator, 'storage', {
        value: { estimate: vi.fn().mockResolvedValue({}) },
        configurable: true,
      });
      const emptyEst = await getStorageQuota();
      expect(emptyEst?.usageBytes).toBe(0);
      expect(emptyEst?.quotaBytes).toBe(0);
      Object.defineProperty(navigator, 'storage', { value: originalStorage, configurable: true });

      // 2. onupgradeneeded when objectStoreNames.contains returns false
      const originalIndexedDB = (globalThis as any).indexedDB;
      const createObjectStoreSpy = vi.fn();
      (globalThis as any).indexedDB = {
        open: vi.fn(() => {
          const req: any = {
            result: {
              objectStoreNames: { contains: vi.fn(() => false) },
              createObjectStore: createObjectStoreSpy,
              transaction: vi.fn(() => ({
                objectStore: vi.fn(() => ({
                  count: vi.fn(() => {
                    const r: any = { result: 0, onsuccess: null, onerror: null };
                    setTimeout(() => r.onerror?.(), 0);
                    return r;
                  }),
                  get: vi.fn(() => {
                    const r: any = { error: null, onsuccess: null, onerror: null };
                    setTimeout(() => r.onerror?.(), 0);
                    return r;
                  }),
                  delete: vi.fn(() => {
                    const r: any = { error: null, onsuccess: null, onerror: null };
                    setTimeout(() => r.onerror?.(), 0);
                    return r;
                  }),
                  getAllKeys: vi.fn(() => {
                    const r: any = { error: null, onsuccess: null, onerror: null };
                    setTimeout(() => r.onerror?.(), 0);
                    return r;
                  }),
                  getAll: vi.fn(() => {
                    const r: any = { error: null, onsuccess: null, onerror: null };
                    setTimeout(() => r.onerror?.(), 0);
                    return r;
                  }),
                  clear: vi.fn(() => {
                    const r: any = { error: null, onsuccess: null, onerror: null };
                    setTimeout(() => r.onerror?.(), 0);
                    return r;
                  }),
                })),
              })),
            },
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null,
          };
          setTimeout(() => {
            req.onupgradeneeded?.({ target: req });
            req.onsuccess?.();
          }, 0);
          return req;
        }),
      };

      expect(await isBookOffline(1)).toBe(false);
      expect(createObjectStoreSpy).toHaveBeenCalledWith('offline_books', { keyPath: 'bookId' });
      await expect(getOfflineBookRecord(1)).rejects.toThrow(/Failed to read book 1/);
      await expect(removeOfflineBook(1)).rejects.toThrow(/Failed to remove book 1/);
      await expect(getOfflineBookIds()).rejects.toThrow(/Failed to fetch offline book keys/);
      await expect(getAllOfflineBooks()).rejects.toThrow(/Failed to list offline books/);
      await expect(clearAllOfflineBooks()).rejects.toThrow(/Failed to clear offline books/);

      // 3. saveOfflineBook non-quota error and transaction error
      (globalThis as any).indexedDB = {
        open: vi.fn(() => {
          const req: any = {
            result: {
              objectStoreNames: { contains: () => true },
              transaction: vi.fn(() => {
                const txn: any = {
                  error: null,
                  onerror: null,
                  objectStore: vi.fn(() => ({
                    put: vi.fn(() => {
                      const r: any = { error: null, onsuccess: null, onerror: null };
                      setTimeout(() => txn.onerror?.({ target: { error: new Error('Txn abort') } }), 0);
                      return r;
                    }),
                  })),
                };
                return txn;
              }),
            },
            onsuccess: null,
          };
          setTimeout(() => req.onsuccess?.(), 0);
          return req;
        }),
      };
      await expect(saveOfflineBook(55, 'Txn Fail', 'Content')).rejects.toThrow('Txn abort');

      // 4. Missing indexedDB in window
      delete (window as any).indexedDB;
      expect(await isBookOffline(1)).toBe(false);
      expect(await evictOldestBooksToFreeSpace(100)).toBe(0);

      (globalThis as any).indexedDB = originalIndexedDB;
    });

    it('updates offline book authors when stored record has missing or placeholder authors', async () => {
      const { patchOfflineBookAuthors, evictOldestBooksToFreeSpace } = await import(
        './offline-storage'
      );

      // 1. Book with placeholder authors gets updated
      await saveOfflineBook(301, 'Anon Book', 'Text', [{ name: 'Anonymous', birth_year: null, death_year: null }]);
      await patchOfflineBookAuthors(301, [{ name: 'Real Author', birth_year: 1800, death_year: 1870 }]);
      expect(store.get(301)?.authors?.[0].name).toBe('Real Author');

      // 2. Book with authentic authors does NOT get overwritten
      await patchOfflineBookAuthors(301, [{ name: 'Another Author', birth_year: 1820, death_year: 1890 }]);
      expect(store.get(301)?.authors?.[0].name).toBe('Real Author');

      // 3. Book with empty authors array gets updated
      store.set(302, {
        bookId: 302,
        title: 'Empty Author Book',
        text: 'Text',
        authors: [],
        downloadedAt: new Date().toISOString(),
        byteSize: 100,
      });
      await patchOfflineBookAuthors(302, [{ name: 'Added Author', birth_year: null, death_year: null }]);
      expect(store.get(302)?.authors?.[0].name).toBe('Added Author');

      // 4. Book with undefined authors gets updated
      store.set(303, {
        bookId: 303,
        title: 'Undefined Author Book',
        text: 'Text',
        authors: undefined as any,
        downloadedAt: new Date().toISOString(),
        byteSize: 100,
      });
      await patchOfflineBookAuthors(303, [{ name: 'Defined Author', birth_year: null, death_year: null }]);
      expect(store.get(303)?.authors?.[0].name).toBe('Defined Author');

      // 5. Non-existent record does not crash
      await patchOfflineBookAuthors(99999, [{ name: 'Ghost', birth_year: null, death_year: null }]);

      // 6. evictOldestBooksToFreeSpace catch fallback
      const originalDB = (globalThis as any).indexedDB;
      (globalThis as any).indexedDB = {
        open: vi.fn(() => {
          throw new Error('DB Crash');
        }),
      };
      const freed = await evictOldestBooksToFreeSpace(500);
      expect(freed).toBe(0);
      (globalThis as any).indexedDB = originalDB;
    });
  });
});

