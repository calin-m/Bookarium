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
});

