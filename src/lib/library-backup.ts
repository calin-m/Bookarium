/**
 * Library Portability & Backup Engine - Bookarium
 *
 * Provides single-click JSON backup, CSV spreadsheet export, defensive schema validation,
 * and robust merge/replace restore strategies across books, shelves, bookmarks, and scholar annotations.
 */

import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore, type BookReadingPosition } from '@/stores/useReaderStore';
import { useAnnotationStore, type Annotation } from '@/stores/useAnnotationStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { useThemeStore } from '@/stores/useThemeStore';
import type { GutendexBook, ReadingStatus } from '@/types/book.types';
import type { Bookshelf, BookshelfItem } from '@/types/database.types';
import { formatAuthorNames } from '@/lib/utils';
import { getOfflineBookIds, removeOfflineBook } from '@/lib/offline-storage';

export interface LibraryBackupShelf {
  id: string;
  name: string;
  isDefault: boolean;
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
    likedBookIds: number[];
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

/**
 * Gathers current state across all persistent Zustand stores into a structured backup payload.
 */
export function createLibraryBackup(): LibraryBackupPayload {
  const bookshelfState = useBookshelfStore.getState();
  const readerState = useReaderStore.getState();
  const annotationState = useAnnotationStore.getState();
  const preferencesState = usePreferencesStore.getState();
  const themeState = useThemeStore.getState();

  const savedBooks = bookshelfState.savedBooks || [];
  const readingQueue = bookshelfState.readingQueue || [];
  const likedBookIds = bookshelfState.likedBookIds || [];
  const cloudShelves = bookshelfState.cloudBookshelves || [];
  const shelfItems = bookshelfState.cloudBookshelfItems || [];
  const bookRatings = bookshelfState.bookRatings || {};
  const bookStatuses = bookshelfState.bookStatuses || {};
  const positions = readerState.readingPositions || {};
  const progress = readerState.readingProgress || {};
  const annotations = annotationState.annotations || [];

  // Group items by shelf
  const customShelves: LibraryBackupShelf[] = cloudShelves.map((shelf) => ({
    id: shelf.id,
    name: shelf.name,
    isDefault: shelf.is_default,
    bookIds: shelfItems
      .filter((item) => item.bookshelf_id === shelf.id)
      .map((item) => item.book_id),
  }));

  const exportedAt = new Date().toISOString();

  return {
    version: '1.0',
    app: 'Bookarium',
    exportedAt,
    summary: {
      bookCount: savedBooks.length,
      customShelfCount: customShelves.filter((s) => !s.isDefault).length,
      favoriteCount: likedBookIds.length,
      annotationCount: annotations.length,
      bookmarkCount: Object.keys(positions).length,
    },
    library: {
      savedBooks,
      readingQueue,
      likedBookIds,
      customShelves,
      bookRatings,
      bookStatuses,
    },
    reading: {
      positions,
      progress,
    },
    annotations,
    preferences: {
      theme: themeState.theme,
      stickyScrollEnabled: preferencesState.stickyScrollEnabled,
      speech: {
        rate: preferencesState.speechRate,
        voiceURI: preferencesState.speechVoiceURI,
        autoPageAdvance: preferencesState.speechAutoPageAdvance,
        highlightEnabled: preferencesState.speechHighlightEnabled,
      },
      readerDisplay: {
        fontSize: readerState.fontSize,
        lineHeight: readerState.lineHeight,
        fontFamily: readerState.fontFamily,
        theme: readerState.theme,
      },
    },
  };
}

/**
 * Serializes the library backup to JSON and triggers an automatic browser download.
 */
export function downloadLibraryBackupJSON(backup?: LibraryBackupPayload, filename?: string): void {
  if (typeof window === 'undefined') return;
  const data = backup || createLibraryBackup();
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const dateStr = data.exportedAt ? data.exportedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = filename || `bookarium-library-backup-${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generates an RFC 4180 compliant CSV spreadsheet representing the user's reading catalog.
 */
export function exportLibraryToCSV(backup?: LibraryBackupPayload, filename?: string): string {
  const data = backup || createLibraryBackup();
  const headers = [
    'Book ID',
    'Title',
    'Authors',
    'Shelves',
    'Favorited',
    'Rating',
    'Status',
    'Reading Progress (%)',
    'Last Read At',
    'Notes Count',
  ];

  const escapeCell = (val: string | number | boolean | null | undefined): string => {
    if (val === null || val === undefined) return '""';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return `"${str}"`;
  };

  const rows: string[] = [headers.map(escapeCell).join(',')];

  // Map shelf names per book
  const shelfMap = new Map<number, string[]>();
  if (data.library.customShelves) {
    for (const shelf of data.library.customShelves) {
      for (const bookId of shelf.bookIds) {
        const existing = shelfMap.get(bookId) || [];
        existing.push(shelf.name);
        shelfMap.set(bookId, existing);
      }
    }
  }

  // Count annotations per book
  const annotationCountMap = new Map<number, number>();
  if (data.annotations) {
    for (const ann of data.annotations) {
      annotationCountMap.set(ann.bookId, (annotationCountMap.get(ann.bookId) || 0) + 1);
    }
  }

  const formatStatus = (status?: string | null): string => {
    switch (status) {
      case 'want_to_read':
        return 'Want to Read';
      case 'currently_reading':
        return 'Currently Reading';
      case 'finished':
        return 'Finished';
      default:
        return 'Unassigned';
    }
  };

  for (const book of data.library.savedBooks) {
    const authors = book.authors && book.authors.length > 0 ? formatAuthorNames(book.authors) : 'Unknown Author';
    const shelves = shelfMap.get(book.id)?.join('; ') || 'General';
    const isLiked = data.library.likedBookIds?.includes(book.id) ? 'Yes' : 'No';
    const rating = data.library.bookRatings?.[book.id] ? `${data.library.bookRatings[book.id]} / 5` : 'Unrated';
    const status = formatStatus(data.library.bookStatuses?.[book.id]);
    const progress = data.reading.progress?.[book.id] ?? 0;
    const lastRead = data.reading.positions?.[book.id]?.lastReadAt || 'Never';
    const noteCount = annotationCountMap.get(book.id) || 0;

    const row = [
      book.id,
      book.title,
      authors,
      shelves,
      isLiked,
      rating,
      status,
      `${progress}%`,
      lastRead,
      noteCount,
    ];
    rows.push(row.map(escapeCell).join(','));
  }

  const csvContent = rows.join('\r\n');

  if (typeof window !== 'undefined') {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStr = (data.exportedAt || new Date().toISOString()).slice(0, 10);
    link.href = url;
    link.download = filename || `bookarium-catalog-${dateStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return csvContent;
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function isPlainObject(val: unknown): val is Record<string, any> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

function hasPrototypePollutionKey(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_KEYS.has(key)) return true;
    if (typeof (obj as any)[key] === 'object' && hasPrototypePollutionKey((obj as any)[key])) {
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

  const obj = raw;

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
        readingQueue.push(b as GutendexBook);
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

  if (obj.library.likedBookIds && !Array.isArray(obj.library.likedBookIds)) {
    return { valid: false, error: 'Invalid backup file: likedBookIds must be an array if provided.' };
  }

  const likedBookIds: number[] = Array.isArray(obj.library.likedBookIds)
    ? obj.library.likedBookIds.filter((id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0)
    : [];

  const normalized: LibraryBackupPayload = {
    version: obj.version || '1.0',
    app: 'Bookarium',
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    summary: {
      bookCount: obj.library.savedBooks.length,
      customShelfCount: customShelves.length,
      favoriteCount: likedBookIds.length,
      annotationCount: Array.isArray(obj.annotations) ? obj.annotations.length : 0,
      bookmarkCount: isPlainObject(obj.reading?.positions) ? Object.keys(obj.reading.positions).length : 0,
    },
    library: {
      savedBooks: obj.library.savedBooks,
      readingQueue,
      likedBookIds,
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

/**
 * Restores a validated library backup into local Zustand stores with optional cloud synchronization.
 */
export async function restoreLibraryBackup(
  backup: LibraryBackupPayload,
  strategy: 'merge' | 'replace' = 'merge',
  userId?: string
): Promise<RestoreSummary> {
  const bookshelfStore = useBookshelfStore.getState();
  const readerStore = useReaderStore.getState();
  const annotationStore = useAnnotationStore.getState();
  const themeStore = useThemeStore.getState();
  const prefsStore = usePreferencesStore.getState();

  let finalBooks: GutendexBook[] = [];
  let finalLikedIds: number[] = [];
  let finalReadingQueue: GutendexBook[] = [];
  let finalRatings: Record<number, number> = {};
  let finalStatuses: Record<number, ReadingStatus> = {};
  let finalPositions: Record<number, BookReadingPosition> = {};
  let finalProgress: Record<number, number> = {};
  let finalAnnotations: Annotation[] = [];
  let finalShelves: Bookshelf[] = [];
  let finalShelfItems: BookshelfItem[] = [];

  if (strategy === 'replace') {
    finalBooks = [...backup.library.savedBooks];
    finalLikedIds = [...backup.library.likedBookIds];
    finalReadingQueue = [...backup.library.readingQueue];
    finalRatings = { ...(backup.library.bookRatings || {}) };
    finalStatuses = { ...(backup.library.bookStatuses || {}) };
    finalPositions = { ...backup.reading.positions };
    finalProgress = { ...backup.reading.progress };
    finalAnnotations = [...backup.annotations];

    if (backup.library.customShelves && backup.library.customShelves.length > 0) {
      for (const cs of backup.library.customShelves) {
        const shelf: Bookshelf = {
          id: cs.id || `shelf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          user_id: userId || 'local-guest',
          name: cs.name,
          is_default: cs.isDefault ?? false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        finalShelves.push(shelf);
        for (const bId of cs.bookIds) {
          const book = finalBooks.find((b) => b.id === bId);
          finalShelfItems.push({
            id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            bookshelf_id: shelf.id,
            user_id: userId || 'local-guest',
            book_id: bId,
            book_title: book?.title || 'Unknown Title',
            book_authors: book?.authors ? book.authors.map((a) => a.name) : [],
            cover_url: book?.formats?.['image/jpeg'] || null,
            added_at: new Date().toISOString(),
          });
        }
      }
    }

    // Clean up orphaned offline book cache in IndexedDB
    if (typeof window !== 'undefined') {
      try {
        const offlineIds = await getOfflineBookIds();
        const restoredBookIdSet = new Set(finalBooks.map((b) => b.id));
        for (const id of offlineIds) {
          if (!restoredBookIdSet.has(id)) {
            await removeOfflineBook(id);
          }
        }
      } catch {
        // Non-blocking offline storage cleanup
      }
    }
  } else {
    // MERGE STRATEGY
    const currentBooks = bookshelfStore.savedBooks || [];
    const bookMap = new Map<number, GutendexBook>();
    for (const b of currentBooks) bookMap.set(b.id, b);
    for (const b of backup.library.savedBooks) {
      if (!bookMap.has(b.id)) {
        bookMap.set(b.id, b);
      }
    }
    finalBooks = Array.from(bookMap.values());

    const currentQueue = bookshelfStore.readingQueue || [];
    const queueMap = new Map<number, GutendexBook>();
    for (const b of currentQueue) queueMap.set(b.id, b);
    for (const b of backup.library.readingQueue || []) {
      if (!queueMap.has(b.id)) {
        queueMap.set(b.id, b);
      }
    }
    finalReadingQueue = Array.from(queueMap.values());

    const likedSet = new Set<number>([
      ...(bookshelfStore.likedBookIds || []),
      ...(backup.library.likedBookIds || []),
    ]);
    finalLikedIds = Array.from(likedSet);

    finalPositions = { ...(readerStore.readingPositions || {}) };
    for (const [idStr, newPos] of Object.entries(backup.reading.positions || {})) {
      const id = Number(idStr);
      const existing = finalPositions[id];
      if (!existing || new Date(newPos.lastReadAt).getTime() > new Date(existing.lastReadAt).getTime()) {
        finalPositions[id] = newPos;
      }
    }

    finalProgress = { ...(readerStore.readingProgress || {}) };
    for (const [idStr, prog] of Object.entries(backup.reading.progress || {})) {
      const id = Number(idStr);
      finalProgress[id] = Math.max(finalProgress[id] || 0, prog || 0);
    }

    const currentAnnotations = annotationStore.annotations || [];
    const annMap = new Map<string, Annotation>();
    for (const a of currentAnnotations) annMap.set(a.id, a);
    for (const a of backup.annotations || []) {
      if (!annMap.has(a.id)) {
        annMap.set(a.id, a);
      }
    }
    finalAnnotations = Array.from(annMap.values());

    finalShelves = [...(bookshelfStore.cloudBookshelves || [])];
    finalShelfItems = [...(bookshelfStore.cloudBookshelfItems || [])];
    finalRatings = { ...(bookshelfStore.bookRatings || {}) };
    for (const [idStr, rating] of Object.entries(backup.library.bookRatings || {})) {
      finalRatings[Number(idStr)] = rating;
    }
    finalStatuses = { ...(bookshelfStore.bookStatuses || {}) };
    for (const [idStr, status] of Object.entries(backup.library.bookStatuses || {})) {
      finalStatuses[Number(idStr)] = status;
    }
    if (backup.library.customShelves) {
      for (const cs of backup.library.customShelves) {
        let targetShelf = finalShelves.find((s) => s.name.toLowerCase() === cs.name.toLowerCase());
        if (!targetShelf) {
          const newShelf: Bookshelf = {
            id: cs.id || `shelf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            user_id: userId || 'local-guest',
            name: cs.name,
            is_default: cs.isDefault ?? false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          finalShelves.push(newShelf);
          targetShelf = newShelf;
        }
        const activeShelf = targetShelf;
        for (const bId of cs.bookIds) {
          const exists = finalShelfItems.some(
            (i) => i.bookshelf_id === activeShelf.id && i.book_id === bId
          );
          if (!exists) {
            const book = finalBooks.find((b) => b.id === bId);
            finalShelfItems.push({
              id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              bookshelf_id: activeShelf.id,
              user_id: userId || 'local-guest',
              book_id: bId,
              book_title: book?.title || 'Unknown Title',
              book_authors: book?.authors ? book.authors.map((a) => a.name) : [],
              cover_url: book?.formats?.['image/jpeg'] || null,
              added_at: new Date().toISOString(),
            });
          }
        }
      }
    }
  }

  // Update store states
  useBookshelfStore.setState({
    savedBooks: finalBooks,
    readingQueue: finalReadingQueue,
    likedBookIds: finalLikedIds,
    likedBooks: finalBooks.filter((b) => finalLikedIds.includes(b.id)),
    cloudBookshelves: finalShelves,
    cloudBookshelfItems: finalShelfItems,
    bookRatings: finalRatings,
    bookStatuses: finalStatuses,
    ...(strategy === 'replace'
      ? { activeBookshelfId: finalShelves.find((s) => s.is_default)?.id || finalShelves[0]?.id || null }
      : {}),
  });

  useReaderStore.setState({
    readingPositions: finalPositions,
    readingProgress: finalProgress,
  });

  useAnnotationStore.setState({
    annotations: finalAnnotations,
  });

  if (backup.preferences) {
    if (backup.preferences.theme && ['day', 'sepia', 'dark'].includes(backup.preferences.theme)) {
      themeStore.setTheme(backup.preferences.theme as any);
    }
    if (typeof backup.preferences.stickyScrollEnabled === 'boolean') {
      prefsStore.setStickyScrollEnabled(backup.preferences.stickyScrollEnabled);
    }
    if (backup.preferences.speech) {
      if (typeof backup.preferences.speech.rate === 'number') {
        prefsStore.setSpeechRate(backup.preferences.speech.rate);
      }
      if (backup.preferences.speech.voiceURI !== undefined) {
        prefsStore.setSpeechVoiceURI(backup.preferences.speech.voiceURI);
      }
      if (typeof backup.preferences.speech.autoPageAdvance === 'boolean') {
        prefsStore.setSpeechAutoPageAdvance(backup.preferences.speech.autoPageAdvance);
      }
      if (typeof backup.preferences.speech.highlightEnabled === 'boolean') {
        prefsStore.setSpeechHighlightEnabled(backup.preferences.speech.highlightEnabled);
      }
    }
  }

  // Trigger cloud synchronization if user is authenticated
  if (userId) {
    try {
      await bookshelfStore.syncWithCloud(userId);
      await annotationStore.syncWithCloud(userId);
    } catch {
      // Offline fallback: outbox will dispatch on reconnect
    }
  }

  return {
    booksRestored: finalBooks.length,
    shelvesRestored: finalShelves.filter((s) => !s.is_default).length,
    favoritesRestored: finalLikedIds.length,
    annotationsRestored: finalAnnotations.length,
    bookmarksRestored: Object.keys(finalPositions).length,
  };
}
