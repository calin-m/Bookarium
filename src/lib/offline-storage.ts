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

export interface OfflineBookRecord extends OfflineBookMetadata {
  text: string;
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
 */
export async function saveOfflineBook(bookId: number, title: string, text: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    const record: OfflineBookRecord = {
      bookId,
      title,
      text,
      downloadedAt: new Date().toISOString(),
      byteSize: new Blob([text]).size,
    };

    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error(`Failed to save book ${bookId} offline.`));
  });
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

