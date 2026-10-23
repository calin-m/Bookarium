import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveOfflineBook,
  getOfflineBook,
  isBookOffline,
  removeOfflineBook,
  getOfflineBookIds,
  getAllOfflineBooks,
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

  it('retrieves all offline books metadata without returning full text payloads', async () => {
    await saveOfflineBook(11, 'Alice in Wonderland', 'Some text');
    const list = await getAllOfflineBooks();
    expect(list).toHaveLength(1);
    expect(list[0].bookId).toBe(11);
    expect(list[0].title).toBe('Alice in Wonderland');
    expect(list[0]).not.toHaveProperty('text');
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
  });
});

