/**
 * Library Backup Schema & Defensive Validator - Bookarium
 *
 * Enforces structural integrity, prototype-pollution protection, and value sanitization
 * for untrusted Bookarium JSON backup payloads prior to store restoration.
 */

import type { BookReadingPosition } from '@/stores/useReaderStore';
import type { Annotation } from '@/stores/useAnnotationStore';
import type { GutendexBook, ReadingStatus } from '@/types/book.types';

export interface LibraryBackupShelf {
  id: string;
  name: string;
  isDefault: boolean;
  isPublic?: boolean;
  bookIds: number[];
}

export interface LibraryBackupPayload {
  version: '1.0';
  app: 'Bookarium';
  exportedAt: string;
  summary: {
    bookCount: number;
    customShelfCount: number;
    favoriteCount: number;
    annotationCount: number;
    bookmarkCount: number;
  };
  library: {
    savedBooks: GutendexBook[];
    readingQueue: GutendexBook[];
    favoriteBookIds: number[];
    likedBookIds?: number[];
    customShelves: LibraryBackupShelf[];
    bookRatings?: Record<number, number>;
    bookStatuses?: Record<number, ReadingStatus>;
  };
  reading: {
    positions: Record<number, BookReadingPosition>;
    progress: Record<number, number>;
  };
  annotations: Annotation[];
  preferences: {
    theme?: string;
    stickyScrollEnabled?: boolean;
    speech?: {
      rate: number;
      voiceURI: string | null;
      autoPageAdvance: boolean;
      highlightEnabled: boolean;
    };
    readerDisplay?: {
      fontSize: number;
      lineHeight: number;
      fontFamily: string;
      theme: string;
    };
  };
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  data?: LibraryBackupPayload;
}

export interface RestoreSummary {
  booksRestored: number;
  shelvesRestored: number;
  favoritesRestored: number;
  annotationsRestored: number;
  bookmarksRestored: number;
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

interface RawBackupCandidate {
  version?: string;
  app?: string;
  exportedAt?: string;
  library?: {
    savedBooks?: GutendexBook[];
    customShelves?: Array<{
      id?: string;
      name?: string;
      isDefault?: boolean;
      isPublic?: boolean;
      bookIds?: number[];
    }>;
    readingQueue?: unknown[];
    bookRatings?: Record<string, unknown>;
    bookStatuses?: Record<string, unknown>;
    favoriteBookIds?: unknown[];
    likedBookIds?: unknown[];
  };
  annotations?: Annotation[];
  preferences?: Record<string, unknown>;
  reading?: {
    positions?: Record<number, BookReadingPosition>;
    progress?: Record<number, number>;
  };
}

function hasPrototypePollutionKey(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_KEYS.has(key)) return true;
    const value = record[key];
    if (typeof value === 'object' && value !== null && hasPrototypePollutionKey(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Validates untrusted raw JSON input against the Bookarium backup schema.
 */
export function validateLibraryBackup(raw: unknown): ValidationResult {
  if (!isPlainObject(raw)) {
    return { valid: false, error: 'Invalid backup file: file content must be a JSON object.' };
  }

  if (hasPrototypePollutionKey(raw)) {
    return { valid: false, error: 'Invalid backup file: forbidden prototype modification detected.' };
  }

  const obj = raw as RawBackupCandidate;

  if (obj.app && obj.app !== 'Bookarium') {
    return { valid: false, error: `Unrecognized backup application: expected Bookarium, got "${obj.app}".` };
  }

  if (!isPlainObject(obj.library)) {
    return { valid: false, error: 'Invalid backup file: missing required library section.' };
  }

  if (!Array.isArray(obj.library.savedBooks)) {
    return { valid: false, error: 'Invalid backup file: library.savedBooks must be an array.' };
  }

  // Validate all book items
  for (let i = 0; i < obj.library.savedBooks.length; i++) {
    const b = obj.library.savedBooks[i];
    if (
      !isPlainObject(b) ||
      typeof b.id !== 'number' ||
      !Number.isInteger(b.id) ||
      b.id <= 0 ||
      typeof b.title !== 'string'
    ) {
      return { valid: false, error: `Invalid backup file: volume at index ${i} is missing valid ID or title.` };
    }
  }

  // Deep validation for custom shelves
  const customShelves: LibraryBackupShelf[] = [];
  if (obj.library.customShelves !== undefined) {
    if (!Array.isArray(obj.library.customShelves)) {
      return { valid: false, error: 'Invalid backup file: customShelves must be an array if provided.' };
    }
    for (let i = 0; i < obj.library.customShelves.length; i++) {
      const s = obj.library.customShelves[i];
      if (!isPlainObject(s) || typeof s.name !== 'string' || !Array.isArray(s.bookIds)) {
        return { valid: false, error: `Invalid backup file: custom shelf at index ${i} is missing name or bookIds array.` };
      }
      const validBookIds = s.bookIds.filter(
        (id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0
      );
      customShelves.push({
        id: typeof s.id === 'string' ? s.id : `shelf-${Date.now()}-${i}`,
        name: s.name.trim() || 'Untitled Shelf',
        isDefault: Boolean(s.isDefault),
        isPublic: typeof s.isPublic === 'boolean' ? s.isPublic : true,
        bookIds: validBookIds,
      });
    }
  }

  // Validate reading queue
  const readingQueue: GutendexBook[] = [];
  if (obj.library.readingQueue !== undefined) {
    if (!Array.isArray(obj.library.readingQueue)) {
      return { valid: false, error: 'Invalid backup file: readingQueue must be an array if provided.' };
    }
    for (let i = 0; i < obj.library.readingQueue.length; i++) {
      const b = obj.library.readingQueue[i];
      if (
        isPlainObject(b) &&
        typeof b.id === 'number' &&
        Number.isInteger(b.id) &&
        b.id > 0 &&
        typeof b.title === 'string'
      ) {
        readingQueue.push(b as unknown as GutendexBook);
      }
    }
  }

  // Sanitize ratings: enforce 1-5 integer bounds
  const bookRatings: Record<number, number> = {};
  if (isPlainObject(obj.library.bookRatings)) {
    for (const [key, val] of Object.entries(obj.library.bookRatings)) {
      const bookId = Number(key);
      const rating = Number(val);
      if (Number.isInteger(bookId) && bookId > 0 && Number.isInteger(rating) && rating >= 1 && rating <= 5) {
        bookRatings[bookId] = rating;
      }
    }
  }

  // Sanitize reading statuses: enforce valid enum values
  const VALID_STATUSES = new Set<ReadingStatus>(['want_to_read', 'currently_reading', 'finished']);
  const bookStatuses: Record<number, ReadingStatus> = {};
  if (isPlainObject(obj.library.bookStatuses)) {
    for (const [key, val] of Object.entries(obj.library.bookStatuses)) {
      const bookId = Number(key);
      if (Number.isInteger(bookId) && bookId > 0 && VALID_STATUSES.has(val as ReadingStatus)) {
        bookStatuses[bookId] = val as ReadingStatus;
      }
    }
  }

  if (obj.annotations && !Array.isArray(obj.annotations)) {
    return { valid: false, error: 'Invalid backup file: annotations must be an array if provided.' };
  }

  if (obj.library.favoriteBookIds && !Array.isArray(obj.library.favoriteBookIds)) {
    return { valid: false, error: 'Invalid backup file: favoriteBookIds must be an array if provided.' };
  }

  if (obj.library.likedBookIds && !Array.isArray(obj.library.likedBookIds)) {
    return { valid: false, error: 'Invalid backup file: likedBookIds must be an array if provided.' };
  }

  const rawFavoriteIds = obj.library.favoriteBookIds ?? obj.library.likedBookIds;
  const favoriteBookIds: number[] = Array.isArray(rawFavoriteIds)
    ? rawFavoriteIds.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)
    : [];

  const normalized: LibraryBackupPayload = {
    version: (obj.version as '1.0') || '1.0',
    app: 'Bookarium',
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    summary: {
      bookCount: obj.library.savedBooks.length,
      customShelfCount: customShelves.length,
      favoriteCount: favoriteBookIds.length,
      annotationCount: Array.isArray(obj.annotations) ? obj.annotations.length : 0,
      bookmarkCount: isPlainObject(obj.reading?.positions) ? Object.keys(obj.reading.positions).length : 0,
    },
    library: {
      savedBooks: obj.library.savedBooks,
      readingQueue,
      favoriteBookIds,
      likedBookIds: favoriteBookIds,
      customShelves,
      bookRatings,
      bookStatuses,
    },
    reading: {
      positions: isPlainObject(obj.reading?.positions) ? obj.reading.positions : {},
      progress: isPlainObject(obj.reading?.progress) ? obj.reading.progress : {},
    },
    annotations: Array.isArray(obj.annotations) ? obj.annotations : [],
    preferences: isPlainObject(obj.preferences) ? obj.preferences : {},
  };

  return { valid: true, data: normalized };
}

