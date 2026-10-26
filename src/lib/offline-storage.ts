/**
 * Native, zero-dependency IndexedDB storage engine for offline book content.
 * Allows storing full text of classic literature beyond localStorage's 5MB quota.
 */

import type { Author, GutendexBook } from '@/types/book.types';
import { isPlaceholderAuthor } from '@/lib/book-metadata';
import { parseLifespansFromName } from '@/lib/copyright-engine';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';

const DB_NAME = 'BookariumOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_books';

export const OFFLINE_BOOKS_UPDATED_EVENT = 'bookarium:offline-updated';

/**
 * Broadcasts an update event so all mounted useOfflineBooks() hooks re-synchronize.
 */
export function notifyOfflineStorageChanged(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent(OFFLINE_BOOKS_UPDATED_EVENT));
  }
}

export interface OfflineBookMetadata {
  bookId: number;
  title: string;
  downloadedAt: string;
  byteSize: number;
  authors?: Author[];
}

export interface StorageQuotaInfo {
  usageBytes: number;
  quotaBytes: number;
  percentUsed: number;
  isNearQuota: boolean;
}

export interface OfflineBookRecord extends OfflineBookMetadata {
  text: string;
}

/**
 * Discovers current disk storage usage and limits using navigator.storage.estimate().
 */
export async function getStorageQuota(): Promise<StorageQuotaInfo | null> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) {
    return null;
  }
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    const percentUsed = quota > 0 ? (usage / quota) * 100 : 0;
    return {
      usageBytes: usage,
      quotaBytes: quota,
      percentUsed: Math.round(percentUsed * 10) / 10,
      isNearQuota: percentUsed > 85,
    };
  } catch {
    return null;
  }
}

/**
 * Evicts least-recently downloaded books until targetBytesNeeded are freed.
 */
export async function evictOldestBooksToFreeSpace(targetBytesNeeded: number): Promise<number> {
  try {
    const books = await getAllOfflineBooks();
    if (books.length === 0) return 0;

    // Sort by downloadedAt ascending (oldest first)
    books.sort((a, b) => new Date(a.downloadedAt).getTime() - new Date(b.downloadedAt).getTime());

    let freedBytes = 0;
    for (const book of books) {
      if (freedBytes >= targetBytesNeeded) break;
      await removeOfflineBook(book.bookId);
      freedBytes += book.byteSize;
    }
    return freedBytes;
  } catch {
    return 0;
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !('indexedDB' in window)) {
      return reject(new Error('IndexedDB is not available in this environment.'));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'bookId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
  });
}

/**
 * Saves a book's full text to IndexedDB for offline reading.
 * Includes pre-emptive quota checks, LRU auto-eviction, and QuotaExceededError recovery.
 */
export async function saveOfflineBook(bookId: number, title: string, text: string, authors?: Author[]): Promise<void> {
  const db = await openDB();
  const byteSize = new Blob([text]).size;

  // Pre-emptive check: if storage estimate reports less than 10MB free buffer, evict oldest
  const quota = await getStorageQuota();
  if (quota && quota.quotaBytes > 0 && quota.quotaBytes - quota.usageBytes < byteSize + 10 * 1024 * 1024) {
    await evictOldestBooksToFreeSpace(byteSize + 15 * 1024 * 1024);
  }

  const putRecord = (database: IDBDatabase): Promise<void> => {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const record: OfflineBookRecord = {
        bookId,
        title,
        text,
        downloadedAt: new Date().toISOString(),
        byteSize,
        authors,
      };

      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = (e) => {
        const targetError = e?.target && 'error' in e.target ? (e.target as { error?: DOMException }).error : null;
        reject(request.error || targetError || new Error(`Failed to save book ${bookId} offline.`));
      };
      transaction.onerror = (e) => {
        const txnTargetError = e?.target && 'error' in e.target ? (e.target as { error?: DOMException }).error : null;
        reject(transaction.error || txnTargetError || new Error(`Transaction error saving book ${bookId}.`));
      };
    });
  };

  try {
    await putRecord(db);
    notifyOfflineStorageChanged();
  } catch (error: unknown) {
    // If QuotaExceededError, try emergency eviction of 20MB and retry once
    const errorObj = error as { name?: string; code?: number; message?: string } | null;
    const isQuotaError =
      errorObj?.name === 'QuotaExceededError' ||
      errorObj?.code === 22 ||
      errorObj?.message?.includes('quota');

    if (isQuotaError) {
      const freed = await evictOldestBooksToFreeSpace(20 * 1024 * 1024);
      if (freed > 0) {
        await putRecord(db);
        notifyOfflineStorageChanged();
        return;
      }
      throw new Error('Storage quota exceeded. Please clear some offline books.');
    }
    throw error;
  }
}

/**
 * Retrieves the complete offline book record (including authors metadata and text) if cached locally.
 */
export async function getOfflineBookRecord(bookId: number): Promise<OfflineBookRecord | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(bookId);

      request.onsuccess = () => {
        const record = (request.result as OfflineBookRecord | undefined) || null;
        resolve(record);
      };
      request.onerror = () => reject(request.error || new Error(`Failed to read book ${bookId} from offline storage.`));
    });
  } catch {
    return null;
  }
}

/**
 * Retrieves the full text of an offline book if cached locally.
 */
export async function getOfflineBook(bookId: number): Promise<string | null> {
  const record = await getOfflineBookRecord(bookId);
  return record ? record.text : null;
}

/**
 * Checks if a book is downloaded locally for offline reading.
 */
export async function isBookOffline(bookId: number): Promise<boolean> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.count(IDBKeyRange.only(bookId));

      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
}

/**
 * Removes an offline book record from IndexedDB.
 */
export async function removeOfflineBook(bookId: number): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(bookId);

      request.onsuccess = () => {
        notifyOfflineStorageChanged();
        resolve();
      };
      request.onerror = () => reject(request.error || new Error(`Failed to remove book ${bookId}.`));
    });
  } catch {
    // Non-blocking fallback
  }
}

/**
 * Returns all book IDs currently stored in offline storage.
 */
export async function getOfflineBookIds(): Promise<number[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAllKeys();

      request.onsuccess = () => {
        const keys = request.result as (number | string)[];
        resolve(keys.map(Number).filter((k) => !isNaN(k)));
      };
      request.onerror = () => reject(request.error || new Error('Failed to fetch offline book keys.'));
    });
  } catch {
    return [];
  }
}

/**
 * Returns metadata (without large text payload) for all offline books.
 */
export async function getAllOfflineBooks(): Promise<OfflineBookMetadata[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records = (request.result || []) as OfflineBookRecord[];
        const metadataList: OfflineBookMetadata[] = records.map(({ bookId, title, downloadedAt, byteSize, authors }) => ({
          bookId,
          title,
          downloadedAt,
          byteSize,
          authors,
        }));
        resolve(metadataList);
      };
      request.onerror = () => reject(request.error || new Error('Failed to list offline books.'));
    });
  } catch {
    return [];
  }
}

async function resolveLocalAuthorsForBook(bookId: number): Promise<Author[] | null> {
  if (typeof window === 'undefined') return null;

  try {
    const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
    const shelfState = useBookshelfStore.getState();
    const match =
      shelfState.savedBooks?.find((b) => b.id === bookId) ||
      shelfState.favoriteBooks?.find((b) => b.id === bookId) ||
      shelfState.recentBooks?.find((b) => b.id === bookId);
    if (match?.authors && match.authors.length > 0) {
      const hasAuth = match.authors.some((a) => a.name && !isPlaceholderAuthor(a.name));
      if (hasAuth) return match.authors;
    }
  } catch {}

  try {
    const { useReaderStore } = await import('@/stores/useReaderStore');
    const pos = useReaderStore.getState().readingPositions?.[bookId];
    if (pos?.bookAuthors && pos.bookAuthors.length > 0) {
      const valid = pos.bookAuthors.filter((name) => name && !isPlaceholderAuthor(name));
      if (valid.length > 0) {
        return valid.map((name) => {
          const parsed = parseLifespansFromName(name);
          return {
            name,
            birth_year: parsed.birthYear,
            death_year: parsed.deathYear,
          };
        });
      }
    }
  } catch {}

  const hero = FEATURED_HERO_BOOKS.find((h) => h.id === bookId);
  if (hero && hero.author && !isPlaceholderAuthor(hero.author)) {
    return [
      {
        name: hero.author,
        birth_year: hero.authorBirthYear ?? null,
        death_year: hero.authorDeathYear ?? null,
      },
    ];
  }

  return null;
}

export async function patchOfflineBookAuthors(bookId: number, authors: Author[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const getReq = store.get(bookId);
      getReq.onsuccess = () => {
        const record = getReq.result as OfflineBookRecord | undefined;
        if (
          record &&
          (!record.authors ||
            record.authors.length === 0 ||
            record.authors.every((a) => isPlaceholderAuthor(a.name)))
        ) {
          record.authors = authors;
          const putReq = store.put(record);
          putReq.onsuccess = () => resolve();
          putReq.onerror = () => resolve();
        } else {
          resolve();
        }
      };
      getReq.onerror = () => resolve();
      transaction.onerror = () => resolve();
    });
  } catch {
    // Non-blocking fallback
  }
}

/**
 * Reconstructs GutendexBook objects from IndexedDB offline metadata records.
 */
export async function getAllOfflineBookMetas(): Promise<GutendexBook[]> {
  const records = await getAllOfflineBooks();
  const metas: GutendexBook[] = [];

  for (const rec of records) {
    let authors = rec.authors;
    const hasValidAuthors =
      authors && authors.length > 0 && !authors.every((a) => isPlaceholderAuthor(a.name));

    if (!hasValidAuthors) {
      const recovered = await resolveLocalAuthorsForBook(rec.bookId);
      if (recovered && recovered.length > 0) {
        authors = recovered;
        void patchOfflineBookAuthors(rec.bookId, recovered);
      }
    }

    metas.push({
      id: rec.bookId,
      title: rec.title,
      authors:
        authors && authors.length > 0
          ? authors
          : [{ name: 'Anonymous', birth_year: null, death_year: null }],
      translators: [],
      subjects: [],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {
        'image/jpeg': `https://www.gutenberg.org/cache/epub/${rec.bookId}/pg${rec.bookId}.cover.medium.jpg`,
        'application/epub+zip': `https://www.gutenberg.org/ebooks/${rec.bookId}.epub3.images`,
      },
      download_count: 0,
    });
  }

  return metas;
}

/**
 * Purges all offline downloaded books.
 */
export async function clearAllOfflineBooks(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        notifyOfflineStorageChanged();
        resolve();
      };
      request.onerror = () => reject(request.error || new Error('Failed to clear offline books.'));
    });
  } catch {
    // Non-blocking fallback
  }
}

