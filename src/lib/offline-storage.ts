/**
 * Native, zero-dependency IndexedDB storage engine for offline book content.
 * Allows storing full text of classic literature beyond localStorage's 5MB quota.
 */

const DB_NAME = 'BookariumOfflineDB';
const DB_VERSION = 1;
const STORE_NAME = 'offline_books';

export interface OfflineBookMetadata {
  bookId: number;
  title: string;
  downloadedAt: string;
  byteSize: number;
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
export async function saveOfflineBook(bookId: number, title: string, text: string): Promise<void> {
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
      };

      const request = store.put(record);
      request.onsuccess = () => resolve();
      request.onerror = (e) => {
        reject(request.error || (e.target as any)?.error || new Error(`Failed to save book ${bookId} offline.`));
      };
      transaction.onerror = (e) => {
        reject(transaction.error || (e.target as any)?.error || new Error(`Transaction error saving book ${bookId}.`));
      };
    });
  };

  try {
    await putRecord(db);
  } catch (error: any) {
    // If QuotaExceededError, try emergency eviction of 20MB and retry once
    const isQuotaError =
      error?.name === 'QuotaExceededError' ||
      error?.code === 22 ||
      error?.message?.includes('quota');

    if (isQuotaError) {
      const freed = await evictOldestBooksToFreeSpace(20 * 1024 * 1024);
      if (freed > 0) {
        await putRecord(db);
        return;
      }
      throw new Error('Storage quota exceeded. Please clear some offline books.');
    }
    throw error;
  }
}

/**
 * Retrieves the full text of an offline book if cached locally.
 */
export async function getOfflineBook(bookId: number): Promise<string | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(bookId);

      request.onsuccess = () => {
        const record = request.result as OfflineBookRecord | undefined;
        resolve(record ? record.text : null);
      };
      request.onerror = () => reject(request.error || new Error(`Failed to read book ${bookId} from offline storage.`));
    });
  } catch {
    return null;
  }
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

      request.onsuccess = () => resolve();
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
        const metadataList: OfflineBookMetadata[] = records.map(({ bookId, title, downloadedAt, byteSize }) => ({
          bookId,
          title,
          downloadedAt,
          byteSize,
        }));
        resolve(metadataList);
      };
      request.onerror = () => reject(request.error || new Error('Failed to list offline books.'));
    });
  } catch {
    return [];
  }
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

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error('Failed to clear offline books.'));
    });
  } catch {
    // Non-blocking fallback
  }
}

