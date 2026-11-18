/**
 * Native, zero-dependency IndexedDB storage engine for offline book content.
 * Allows storing full text of classic literature beyond localStorage's 5MB quota.
 *
 * @module src/lib/offline-storage
 * @scope Browser IndexedDB persistence (`BookariumOfflineDB` / `offline_books` + bounded `cover_cache` LRU), `coverObjectUrlCache` reuse, background cover warming, and non-regressive author metadata healing.
 * @invariant Never overwrite authentic author metadata with placeholder names (`isPlaceholderAuthor`, e.g., `"Anonymous"`); heal missing contributor lifespans via `patchOfflineBookAuthors`.
 * @invariant Lookup cover art in-memory (`getMemoryCachedCoverUrl`) and across IndexedDB (`offline_books.coverBlob` -> non-expired `cover_cache.blob`, capped at `MAX_CACHED_COVERS` and `COVER_CACHE_TTL_MS`), populate via same-origin `/api/books/content?id=...&type=cover`, manage `coverObjectUrlCache` revocation on eviction/removal/clear, clear both stores in `clearAllOfflineBooks`, and broadcast changes through `OFFLINE_BOOKS_UPDATED_EVENT` (`bookarium:offline-updated`).
 * @rationale Cross-origin Service Worker image caching triggers CSP `connect-src`/CORS failures, whereas a bounded canonical `bookId`-keyed IndexedDB cover cache prevents repeat downloads across refreshes behind `/api/books/content?type=cover` (Cloudflare R2) while reverting offline authors to `"Anonymous"` would cause false `HTTP 451` copyright blocks outside US jurisdictions.
 * @adr ADR-020, ADR-069, ADR-070, ADR-080, ADR-082
 */

import type { Author, GutendexBook } from '@/types/book.types';
import { isPlaceholderAuthor } from '@/lib/book-metadata';
import { parseLifespansFromName } from '@/lib/copyright-engine';
import { FEATURED_HERO_BOOKS } from '@/config/featured-books';
import { API_ENDPOINTS } from '@/config/api-endpoints';

const DB_NAME = 'BookariumOfflineDB';
const DB_VERSION = 2;
const STORE_NAME = 'offline_books';
const COVER_CACHE_STORE = 'cover_cache';
export const MAX_CACHED_COVERS = 300;
export const COVER_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_COVER_CACHE_BYTES = 2 * 1024 * 1024;
const MAX_CONCURRENT_COVER_WARMS = 2;
const DEFAULT_COVER_WARM_COOLDOWN_MS = 60_000;

interface CoverCacheRecord {
  bookId: number;
  blob: Blob;
  cachedAt: number;
  byteSize: number;
}

const coverObjectUrlCache = new Map<number, { size: number; url: string }>();
const inFlightCoverWarms = new Set<number>();
const warmedCoverIds = new Set<number>();
const coverWarmQueue: number[] = [];
let activeCoverWarmCount = 0;
let coverWarmCooldownUntil = 0;

/**
 * Synchronously resolves an already-hydrated in-memory cover object URL for a book ID.
 */
export function getMemoryCachedCoverUrl(bookId: number): string | null {
  return coverObjectUrlCache.get(bookId)?.url || null;
}

/**
 * Registers (or reuses) a cached object URL for a cover blob in the shared in-memory lookup map.
 */
export function getOrCreateMemoryCoverUrl(bookId: number, blob: Blob): string | null {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function' || !blob) {
    return null;
  }
  const existing = coverObjectUrlCache.get(bookId);
  if (existing && existing.size === blob.size) {
    return existing.url;
  }
  if (existing) {
    revokeCachedCoverObjectUrl(bookId);
  }
  const url = URL.createObjectURL(blob);
  coverObjectUrlCache.set(bookId, { size: blob.size, url });
  return url;
}

function revokeCachedCoverObjectUrl(bookId: number): void {
  const cached = coverObjectUrlCache.get(bookId);
  if (cached) {
    if (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function') {
      try {
        URL.revokeObjectURL(cached.url);
      } catch {
        // Ignore environment errors
      }
    }
    coverObjectUrlCache.delete(bookId);
  }
}

function revokeAllCachedCoverObjectUrls(): void {
  for (const bookId of Array.from(coverObjectUrlCache.keys())) {
    revokeCachedCoverObjectUrl(bookId);
  }
}

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
  coverBlob?: Blob;
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
      if (!db.objectStoreNames.contains(COVER_CACHE_STORE)) {
        db.createObjectStore(COVER_CACHE_STORE, { keyPath: 'bookId' });
      }
    };

    request.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another open tab.'));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        try {
          db.close?.();
        } catch {
          // Ignore close errors during multi-tab version upgrades
        }
      };
      resolve(db);
    };
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB.'));
  });
}

/**
 * Saves a book's full text to IndexedDB for offline reading.
 * Includes pre-emptive quota checks, LRU auto-eviction, and QuotaExceededError recovery.
 */
export async function saveOfflineBook(
  bookId: number,
  title: string,
  text: string,
  authors?: Author[],
  coverBlob?: Blob
): Promise<void> {
  const db = await openDB();
  const byteSize = new Blob([text]).size + (coverBlob ? coverBlob.size : 0);

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
        ...(coverBlob ? { coverBlob } : {}),
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

async function getCachedCoverFromStore(bookId: number): Promise<Blob | null> {
  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(COVER_CACHE_STORE)) {
      return null;
    }

    const record = await new Promise<CoverCacheRecord | null>((resolve) => {
      try {
        const transaction = db.transaction(COVER_CACHE_STORE, 'readonly');
        const store = transaction.objectStore(COVER_CACHE_STORE);
        const request = store.get(bookId);
        request.onsuccess = () => resolve((request.result as CoverCacheRecord | undefined) || null);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });

    if (!record || !record.blob) return null;

    if (Date.now() - record.cachedAt > COVER_CACHE_TTL_MS) {
      try {
        const cleanupTxn = db.transaction(COVER_CACHE_STORE, 'readwrite');
        cleanupTxn.objectStore(COVER_CACHE_STORE).delete(bookId);
      } catch {
        // Non-blocking TTL cleanup
      }
      return null;
    }

    return record.blob;
  } catch {
    return null;
  }
}

/**
 * Persists a cover image Blob in the bounded `cover_cache` LRU IndexedDB store.
 */
export async function saveCachedCoverBlob(bookId: number, blob: Blob): Promise<void> {
  if (!Number.isInteger(bookId) || bookId <= 0 || !blob || blob.size <= 0 || blob.size > MAX_COVER_CACHE_BYTES) {
    return;
  }

  getOrCreateMemoryCoverUrl(bookId, blob);

  try {
    const db = await openDB();
    if (!db.objectStoreNames.contains(COVER_CACHE_STORE)) {
      return;
    }

    await new Promise<void>((resolve) => {
      try {
        const transaction = db.transaction(COVER_CACHE_STORE, 'readwrite');
        const store = transaction.objectStore(COVER_CACHE_STORE);
        const entry: CoverCacheRecord = {
          bookId,
          blob,
          cachedAt: Date.now(),
          byteSize: blob.size,
        };
        const req = store.put(entry);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        transaction.onerror = () => resolve();
      } catch {
        resolve();
      }
    });

    // Enforce bounded LRU eviction above MAX_CACHED_COVERS entries
    const allCached = await new Promise<CoverCacheRecord[]>((resolve) => {
      try {
        const transaction = db.transaction(COVER_CACHE_STORE, 'readonly');
        const store = transaction.objectStore(COVER_CACHE_STORE);
        const req = store.getAll();
        req.onsuccess = () => resolve((req.result as CoverCacheRecord[]) || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });

    if (allCached.length > MAX_CACHED_COVERS) {
      allCached.sort((a, b) => a.cachedAt - b.cachedAt);
      const overflow = allCached.slice(0, allCached.length - MAX_CACHED_COVERS);
      const offlineBookIds = new Set(await getOfflineBookIds());

      await new Promise<void>((resolve) => {
        try {
          const transaction = db.transaction(COVER_CACHE_STORE, 'readwrite');
          const store = transaction.objectStore(COVER_CACHE_STORE);
          for (const evicted of overflow) {
            store.delete(evicted.bookId);
            if (!offlineBookIds.has(evicted.bookId)) {
              revokeCachedCoverObjectUrl(evicted.bookId);
            }
          }
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => resolve();
          // Support simplified synchronous-timeout JSDOM mocks lacking oncomplete
          setTimeout(resolve, 0);
        } catch {
          resolve();
        }
      });
    }
  } catch {
    // Non-blocking cache persistence fallback
  }
}

function drainCoverWarmQueue(): void {
  if (typeof window === 'undefined' || !navigator.onLine) {
    coverWarmQueue.length = 0;
    return;
  }

  while (
    activeCoverWarmCount < MAX_CONCURRENT_COVER_WARMS &&
    coverWarmQueue.length > 0 &&
    Date.now() >= coverWarmCooldownUntil
  ) {
    const nextId = coverWarmQueue.shift();
    if (!nextId || inFlightCoverWarms.has(nextId)) continue;

    inFlightCoverWarms.add(nextId);
    activeCoverWarmCount++;

    void (async () => {
      try {
        const existing = await getOfflineBookCover(nextId);
        if (existing) {
          getOrCreateMemoryCoverUrl(nextId, existing);
          warmedCoverIds.add(nextId);
          return;
        }

        const safeId = encodeURIComponent(String(Math.trunc(nextId)));
        const res = await fetch(`${API_ENDPOINTS.INTERNAL_API_CONTENT}?id=${safeId}&type=cover`);
        if (res.status === 429) {
          const retryAfterRaw = res.headers?.get('Retry-After');
          const retrySeconds = retryAfterRaw ? parseInt(retryAfterRaw, 10) : NaN;
          coverWarmCooldownUntil =
            Date.now() +
            (Number.isFinite(retrySeconds) && retrySeconds > 0
              ? retrySeconds * 1000
              : DEFAULT_COVER_WARM_COOLDOWN_MS);
          coverWarmQueue.length = 0;
          return;
        }
        if (res.ok) {
          const ct = (res.headers?.get('content-type') || '').toLowerCase();
          if (!ct.includes('text/html')) {
            const blob = await res.blob();
            if (blob && blob.size > 0 && blob.size <= MAX_COVER_CACHE_BYTES) {
              await saveCachedCoverBlob(nextId, blob);
              warmedCoverIds.add(nextId);
            }
          }
        }
      } catch {
        // Non-blocking background cover warming fallback
      } finally {
        inFlightCoverWarms.delete(nextId);
        activeCoverWarmCount = Math.max(0, activeCoverWarmCount - 1);
        drainCoverWarmQueue();
      }
    })();
  }
}

/**
 * Queues a deduplicated, concurrency-bounded background fetch to persist a cover Blob locally
 * into `cover_cache` so future refreshes load from IndexedDB without re-fetching `/api/books/content?type=cover`.
 */
export function warmCoverCache(bookId: number): void {
  if (
    typeof window === 'undefined' ||
    (typeof navigator !== 'undefined' && navigator.onLine === false) ||
    !Number.isInteger(bookId) ||
    bookId <= 0 ||
    Date.now() < coverWarmCooldownUntil ||
    warmedCoverIds.has(bookId) ||
    inFlightCoverWarms.has(bookId) ||
    coverWarmQueue.includes(bookId)
  ) {
    return;
  }

  coverWarmQueue.push(bookId);
  drainCoverWarmQueue();
}

/**
 * Resets internal background cover-warming queues (primarily for clean test isolation and account wipes).
 */
export function resetCoverWarmState(): void {
  warmedCoverIds.clear();
  inFlightCoverWarms.clear();
  coverWarmQueue.length = 0;
  activeCoverWarmCount = 0;
  coverWarmCooldownUntil = 0;
}

/**
 * Retrieves the stored cover image Blob for a book from `offline_books` first,
 * falling back to the bounded LRU `cover_cache` store when not downloaded as full text.
 */
export async function getOfflineBookCover(bookId: number): Promise<Blob | null> {
  const record = await getOfflineBookRecord(bookId);
  if (record?.coverBlob) {
    return record.coverBlob;
  }
  return getCachedCoverFromStore(bookId);
}

/**
 * Patches an existing offline book record with a downloaded cover Blob.
 */
export async function patchOfflineBookCover(bookId: number, coverBlob: Blob): Promise<void> {
  try {
    const db = await openDB();
    const existing = await getOfflineBookRecord(bookId);
    if (!existing) return;

    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const updated: OfflineBookRecord = {
        ...existing,
        coverBlob,
        byteSize: existing.byteSize + (coverBlob?.size || 0),
      };
      const request = store.put(updated);
      request.onsuccess = () => {
        notifyOfflineStorageChanged();
        resolve();
      };
      request.onerror = (e) => {
        const targetError = e?.target && 'error' in e.target ? (e.target as { error?: DOMException }).error : null;
        reject(request.error || targetError || new Error(`Failed to patch cover for book ${bookId}.`));
      };
    });
  } catch {
    // Non-blocking fallback
  }
}

/**
 * Non-blocking background fetch & patch for an offline book's cover image when online.
 */
export async function fetchAndPatchOfflineCover(bookId: number): Promise<void> {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  try {
    const coverUrl = `${API_ENDPOINTS.INTERNAL_API_CONTENT}?id=${bookId}&type=cover`;
    const res = await fetch(coverUrl);
    if (res.ok) {
      const blob = await res.blob();
      if (blob && blob.size > 0) {
        await patchOfflineBookCover(bookId, blob);
      }
    }
  } catch {
    // Non-blocking background fetch
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
  revokeCachedCoverObjectUrl(bookId);
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
        const metadataList: OfflineBookMetadata[] = records.map(({ bookId, title, downloadedAt, byteSize, authors, coverBlob }) => ({
          bookId,
          title,
          downloadedAt,
          byteSize,
          authors,
          coverBlob,
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

    let coverUrl = `https://www.gutenberg.org/cache/epub/${rec.bookId}/pg${rec.bookId}.cover.medium.jpg`;
    if (rec.coverBlob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
      const cached = coverObjectUrlCache.get(rec.bookId);
      if (cached && cached.size === rec.coverBlob.size) {
        coverUrl = cached.url;
      } else {
        if (cached) {
          revokeCachedCoverObjectUrl(rec.bookId);
        }
        coverUrl = URL.createObjectURL(rec.coverBlob);
        coverObjectUrlCache.set(rec.bookId, {
          size: rec.coverBlob.size,
          url: coverUrl,
        });
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
        'image/jpeg': coverUrl,
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
  resetCoverWarmState();
  revokeAllCachedCoverObjectUrls();
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => reject(request.error || new Error('Failed to clear offline books.'));
    });

    if (db.objectStoreNames.contains(COVER_CACHE_STORE)) {
      await new Promise<void>((resolve) => {
        try {
          const coverTxn = db.transaction(COVER_CACHE_STORE, 'readwrite');
          const coverStore = coverTxn.objectStore(COVER_CACHE_STORE);
          const clearReq = coverStore.clear();
          clearReq.onsuccess = () => resolve();
          clearReq.onerror = () => resolve();
          coverTxn.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }

    notifyOfflineStorageChanged();
  } catch (error) {
    if (error instanceof Error && error.message.includes('Failed to clear offline books')) {
      throw error;
    }
    // Non-blocking fallback
  }
}

