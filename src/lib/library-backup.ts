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

/**
 * Validates untrusted raw JSON input against the Bookarium backup schema.
 */
export function validateLibraryBackup(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: 'Invalid backup file: file content must be a JSON object.' };
  }

  const obj = raw as Record<string, any>;

  if (obj.app && obj.app !== 'Bookarium') {
    return { valid: false, error: `Unrecognized backup application: expected Bookarium, got "${obj.app}".` };
  }

  if (!obj.library || typeof obj.library !== 'object') {
    return { valid: false, error: 'Invalid backup file: missing required library section.' };
  }

  if (!Array.isArray(obj.library.savedBooks)) {
    return { valid: false, error: 'Invalid backup file: library.savedBooks must be an array.' };
  }

  // Validate book items
  for (let i = 0; i < Math.min(obj.library.savedBooks.length, 50); i++) {
    const b = obj.library.savedBooks[i];
    if (!b || typeof b.id !== 'number' || typeof b.title !== 'string') {
      return { valid: false, error: `Invalid backup file: volume at index ${i} is missing valid ID or title.` };
    }
  }

  if (obj.annotations && !Array.isArray(obj.annotations)) {
    return { valid: false, error: 'Invalid backup file: annotations must be an array if provided.' };
  }

  if (obj.library.likedBookIds && !Array.isArray(obj.library.likedBookIds)) {
    return { valid: false, error: 'Invalid backup file: likedBookIds must be an array if provided.' };
  }

  const normalized: LibraryBackupPayload = {
    version: obj.version || '1.0',
    app: 'Bookarium',
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    summary: {
      bookCount: obj.library.savedBooks.length,
      customShelfCount: Array.isArray(obj.library.customShelves) ? obj.library.customShelves.length : 0,
      favoriteCount: Array.isArray(obj.library.likedBookIds) ? obj.library.likedBookIds.length : 0,
      annotationCount: Array.isArray(obj.annotations) ? obj.annotations.length : 0,
      bookmarkCount: obj.reading && obj.reading.positions ? Object.keys(obj.reading.positions).length : 0,
    },
    library: {
      savedBooks: obj.library.savedBooks,
      readingQueue: Array.isArray(obj.library.readingQueue) ? obj.library.readingQueue : [],
      likedBookIds: Array.isArray(obj.library.likedBookIds) ? obj.library.likedBookIds : [],
      customShelves: Array.isArray(obj.library.customShelves) ? obj.library.customShelves : [],
      bookRatings: obj.library.bookRatings && typeof obj.library.bookRatings === 'object' ? obj.library.bookRatings : {},
      bookStatuses: obj.library.bookStatuses && typeof obj.library.bookStatuses === 'object' ? obj.library.bookStatuses : {},
    },
    reading: {
      positions: obj.reading && typeof obj.reading.positions === 'object' && obj.reading.positions !== null ? obj.reading.positions : {},
      progress: obj.reading && typeof obj.reading.progress === 'object' && obj.reading.progress !== null ? obj.reading.progress : {},
    },
    annotations: Array.isArray(obj.annotations) ? obj.annotations : [],
    preferences: obj.preferences && typeof obj.preferences === 'object' ? obj.preferences : {},
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
    likedBookIds: finalLikedIds,
    likedBooks: finalBooks.filter((b) => finalLikedIds.includes(b.id)),
    cloudBookshelves: finalShelves,
    cloudBookshelfItems: finalShelfItems,
    bookRatings: finalRatings,
    bookStatuses: finalStatuses,
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
