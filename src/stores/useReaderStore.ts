import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GutendexBook, Book, Author } from '@/types/book.types';
import { useThemeStore, applyThemeToDocument } from './useThemeStore';
import { useAuthStore } from './useAuthStore';
import { createClient } from '@/lib/supabase/client';
import { STORAGE_KEYS } from '@/config/site-config';
import { READER_FONT_CONFIG } from '@/config/reader-config';
import { useHasMounted } from '@/hooks/useHasMounted';
import { formatAuthorWithLifespan } from '@/lib/adapters/book.adapter';
import { parseLifespansFromName } from '@/lib/copyright-engine';
import { isPlaceholderAuthor } from '@/lib/book-metadata';

export type ReaderTheme = 'light' | 'dark' | 'sepia';
export type ReaderFontFamily = 'serif' | 'sans' | 'mono';

export interface BookReadingPosition {
  chapterIndex: number;
  chapterPage: number;
  globalPage: number;
  bookmarkRow?: number;
  lastReadAt: string;
  bookTitle?: string;
  bookAuthors?: string[];
  coverUrl?: string | null;
}

export interface ReaderState {
  currentBook: GutendexBook | Book | null;
  isOpen: boolean;
  fontSize: number;
  lineHeight: number;
  fontFamily: ReaderFontFamily;
  theme: ReaderTheme;
  readingProgress: Record<number, number>;
  readingPositions: Record<number, BookReadingPosition>;
  deletedPositionBookIds: number[];
  isMobileTrayOpen: boolean;

  /**
   * Sets the active book identity in memory prior to navigating to /read/[id].
   * Also sets isOpen: true for compatibility.
   */
  openReader: (book: GutendexBook | Book) => void;
  /**
   * Resets active reading state flag.
   */
  closeReader: () => void;
  setFontSize: (size: number) => void;
  setLineHeight: (height: number) => void;
  setFontFamily: (family: ReaderFontFamily) => void;
  setTheme: (theme: ReaderTheme) => void;
  setMobileTrayOpen: (open: boolean) => void;
  toggleMobileTray: () => void;
  setProgress: (bookId: number, progress: number) => void;
  getProgress: (bookId: number) => number;
  saveReadingPosition: (bookId: number, position: BookReadingPosition, userId?: string) => void;
  enrichReadingPositions: (freshBooks: GutendexBook[]) => void;
  getReadingPosition: (bookId: number) => BookReadingPosition | null;
  clearReadingPosition: (bookId: number, userId?: string) => Promise<void>;
  clearAllVolumes: (userId?: string) => Promise<void>;
  resetReaderSession: () => void;
  syncReadingPositionToCloud: (bookId: number, position: BookReadingPosition, userId: string) => Promise<void>;
  restoreReadingPositionFromCloud: (bookId: number, userId: string) => Promise<BookReadingPosition | null>;
  syncWithCloud: (userId: string) => Promise<void>;
}

const progressDebounceTimers = new Map<number, ReturnType<typeof setTimeout>>();

function hasEmbeddedLifespans(authors?: string[]): boolean {
  if (!Array.isArray(authors) || authors.length === 0) return false;
  return authors.some((a) => {
    const parsed = parseLifespansFromName(a);
    return parsed.birthYear != null || parsed.deathYear != null;
  });
}

function isGhostReadingPosition(pos: BookReadingPosition, progress: number): boolean {
  return (
    progress === 0 &&
    pos.chapterIndex === 0 &&
    pos.chapterPage <= 1 &&
    pos.globalPage <= 1 &&
    (pos.bookmarkRow ?? 0) <= 0
  );
}

function isGhostCloudRow(row: Record<string, unknown>): boolean {
  return (
    Number(row.progress_percent) === 0 &&
    Number(row.current_chapter_index) === 0 &&
    Number(row.scroll_offset) <= 1
  );
}

function decodeRemoteReadingPosition(
  row: Record<string, unknown>,
  localPos?: BookReadingPosition
): { position: BookReadingPosition; progress: number; shouldKeepLocalAuthors: boolean } {
  const remoteAuthors = row.book_authors as string[] | null | undefined;
  const shouldKeepLocalAuthors =
    !hasEmbeddedLifespans(remoteAuthors ?? undefined) && hasEmbeddedLifespans(localPos?.bookAuthors);
  const rawOffset = Math.max(1, Number(row.scroll_offset));
  const decodedPage = Math.max(1, Math.floor(rawOffset));
  const decodedRow = Math.round((rawOffset - decodedPage) * 1000);
  const position: BookReadingPosition = {
    chapterIndex: Number(row.current_chapter_index),
    chapterPage: decodedPage,
    globalPage: decodedPage,
    ...(decodedRow > 0 ? { bookmarkRow: decodedRow } : {}),
    lastReadAt: String(row.last_read_at),
    bookTitle: (row.book_title as string | null) || localPos?.bookTitle,
    bookAuthors: (shouldKeepLocalAuthors ? localPos?.bookAuthors : remoteAuthors) || localPos?.bookAuthors,
    coverUrl: (row.cover_url as string | null) || localPos?.coverUrl,
  };
  const progress = Math.min(Math.max(Math.round(Number(row.progress_percent)), 0), 100);
  return { position, progress, shouldKeepLocalAuthors };
}

function extractVerifiedAuthors(
  book: GutendexBook | Book | null | undefined,
  pos?: BookReadingPosition
): Author[] | undefined {
  if (book) {
    if ('authorDetails' in book && Array.isArray(book.authorDetails)) {
      const withDates = book.authorDetails.filter(
        (a) => a.birth_year != null || a.death_year != null
      );
      if (withDates.length > 0) return book.authorDetails;
    }
    if (Array.isArray(book.authors) && book.authors.length > 0) {
      const parsedAuthors: Author[] = [];
      let hasDates = false;
      for (const a of book.authors) {
        if (typeof a === 'string') {
          const parsed = parseLifespansFromName(a);
          if (parsed.birthYear != null || parsed.deathYear != null) hasDates = true;
          parsedAuthors.push({
            name: a,
            birth_year: parsed.birthYear,
            death_year: parsed.deathYear,
          });
        } else if (a && typeof a === 'object' && 'name' in a) {
          const parsed =
            a.birth_year == null && a.death_year == null && a.name
              ? parseLifespansFromName(a.name)
              : { birthYear: a.birth_year ?? null, deathYear: a.death_year ?? null };
          if (parsed.birthYear != null || parsed.deathYear != null) hasDates = true;
          parsedAuthors.push({
            ...a,
            birth_year: parsed.birthYear,
            death_year: parsed.deathYear,
          });
        }
      }
      if (hasDates) return parsedAuthors;
    }
  }
  if (pos?.bookAuthors && hasEmbeddedLifespans(pos.bookAuthors)) {
    return pos.bookAuthors.map((raw) => {
      const parsed = parseLifespansFromName(raw);
      return {
        name: raw,
        birth_year: parsed.birthYear,
        death_year: parsed.deathYear,
      };
    });
  }
  return undefined;
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set, get) => ({
      currentBook: null,
      isOpen: false,
      fontSize: READER_FONT_CONFIG.DEFAULT_SIZE,
      lineHeight: READER_FONT_CONFIG.DEFAULT_LINE_HEIGHT,
      fontFamily: 'serif',
      theme: 'light',
      readingProgress: {},
      readingPositions: {},
      deletedPositionBookIds: [],
      isMobileTrayOpen: false,

      openReader: (book) => {
        set((state) => {
          if (!book) return { currentBook: book, isOpen: true };
          const incomingVerified = extractVerifiedAuthors(book);
          if (incomingVerified) {
            if (
              Array.isArray(book.authors) &&
              (book.authors.length === 0 || typeof book.authors[0] === 'string') &&
              !('authorDetails' in book && book.authorDetails?.some((a) => a.birth_year != null || a.death_year != null))
            ) {
              return {
                currentBook: { ...book, authorDetails: incomingVerified },
                isOpen: true,
              };
            }
            return { currentBook: book, isOpen: true };
          }

          const existingBook = state.currentBook?.id === book.id ? state.currentBook : null;
          const preservedAuthors = extractVerifiedAuthors(
            existingBook,
            state.readingPositions[book.id]
          );

          if (preservedAuthors) {
            const isCanonical =
              Array.isArray(book.authors) &&
              (book.authors.length === 0 || typeof book.authors[0] === 'string');
            if (isCanonical) {
              return {
                currentBook: { ...(book as Book), authorDetails: preservedAuthors },
                isOpen: true,
              };
            }
            return {
              currentBook: { ...(book as GutendexBook), authors: preservedAuthors },
              isOpen: true,
            };
          }

          return { currentBook: book, isOpen: true };
        });
      },

      closeReader: () => {
        set({ isOpen: false });
      },

      setMobileTrayOpen: (open) => {
        set({ isMobileTrayOpen: open });
      },

      toggleMobileTray: () => {
        set((state) => ({ isMobileTrayOpen: !state.isMobileTrayOpen }));
      },

      setFontSize: (size) => {
        const clamped = Math.min(Math.max(size, 12), 36);
        set({ fontSize: clamped });
      },

      setLineHeight: (height) => {
        const clamped = Math.min(Math.max(height, 1.2), 2.6);
        set({ lineHeight: clamped });
      },

      setFontFamily: (fontFamily) => {
        set({ fontFamily });
      },

      setTheme: (theme) => {
        set({ theme });
        useThemeStore.getState().setTheme(theme);
        applyThemeToDocument(theme);
      },

      setProgress: (bookId, progress) => {
        const clamped = Math.min(Math.max(Math.round(progress), 0), 100);
        set((state) => ({
          readingProgress: {
            ...state.readingProgress,
            [bookId]: clamped,
          },
        }));
      },

      getProgress: (bookId) => {
        return get().readingProgress[bookId] ?? 0;
      },

      saveReadingPosition: (bookId, position, userId) => {
        const currentBook = get().currentBook;
        const existingPos = get().readingPositions[bookId];
        let enrichedPosition: BookReadingPosition = position;

        if (currentBook && currentBook.id === bookId) {
          const rawAuthorSources: (string | Author)[] =
            (currentBook as Book).authorDetails && (currentBook as Book).authorDetails!.length > 0
              ? (currentBook as Book).authorDetails!
              : (currentBook.authors || []);
          const authors = rawAuthorSources
            .map((a) => formatAuthorWithLifespan(a))
            .filter((name) => Boolean(name && name !== 'Anonymous'));
          const bookWithCover = currentBook as { formats?: Record<string, string>; coverUrl?: string | null };
          const coverUrl =
            bookWithCover.formats?.['image/jpeg'] ||
            bookWithCover.coverUrl ||
            null;

          const posAuthorsMissingOrPlaceholder =
            !position.bookAuthors ||
            position.bookAuthors.length === 0 ||
            position.bookAuthors.every(isPlaceholderAuthor);
          const resolvedAuthors = authors.length > 0 ? authors : existingPos?.bookAuthors || [];
          const resolvedCoverUrl = position.coverUrl ?? coverUrl ?? existingPos?.coverUrl ?? null;

          if (!position.bookTitle) {
            enrichedPosition = {
              ...position,
              bookTitle: currentBook.title || existingPos?.bookTitle,
              bookAuthors: resolvedAuthors,
              coverUrl: resolvedCoverUrl,
            };
          } else if (posAuthorsMissingOrPlaceholder && resolvedAuthors.length > 0) {
            enrichedPosition = {
              ...position,
              bookAuthors: resolvedAuthors,
              coverUrl: resolvedCoverUrl,
            };
          } else if (
            !hasEmbeddedLifespans(position.bookAuthors) &&
            hasEmbeddedLifespans(authors)
          ) {
            enrichedPosition = {
              ...position,
              bookAuthors: authors,
              coverUrl: position.coverUrl ?? coverUrl,
            };
          }
        } else if (!position.bookTitle && existingPos?.bookTitle) {
          enrichedPosition = {
            ...position,
            bookTitle: existingPos.bookTitle,
            bookAuthors: existingPos.bookAuthors ?? position.bookAuthors,
            coverUrl: existingPos.coverUrl ?? position.coverUrl,
          };
        }

        if (
          !hasEmbeddedLifespans(enrichedPosition.bookAuthors) &&
          hasEmbeddedLifespans(existingPos?.bookAuthors)
        ) {
          enrichedPosition = {
            ...enrichedPosition,
            bookAuthors: existingPos!.bookAuthors,
          };
        } else if (
          (!enrichedPosition.bookAuthors ||
            enrichedPosition.bookAuthors.length === 0 ||
            enrichedPosition.bookAuthors.every(isPlaceholderAuthor)) &&
          existingPos?.bookAuthors &&
          existingPos.bookAuthors.length > 0 &&
          !existingPos.bookAuthors.every(isPlaceholderAuthor)
        ) {
          enrichedPosition = {
            ...enrichedPosition,
            bookAuthors: existingPos.bookAuthors,
          };
        }

        set((state) => ({
          readingPositions: {
            ...state.readingPositions,
            [bookId]: enrichedPosition,
          },
          deletedPositionBookIds: state.deletedPositionBookIds.filter((id) => id !== bookId),
        }));

        const currentUserId = userId || useAuthStore.getState().user?.id;
        if (!currentUserId) return;

        const existingTimer = progressDebounceTimers.get(bookId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
          progressDebounceTimers.delete(bookId);
          get().syncReadingPositionToCloud(bookId, enrichedPosition, currentUserId);
        }, 2000);

        progressDebounceTimers.set(bookId, timer);
      },

      enrichReadingPositions: (freshBooks) => {
        if (!freshBooks || freshBooks.length === 0) return;
        const { readingPositions } = get();
        let hasChanges = false;
        const nextPositions = { ...readingPositions };
        const enrichedBookIds: number[] = [];

        for (const fresh of freshBooks) {
          if (!fresh || typeof fresh.id !== 'number') continue;
          const pos = nextPositions[fresh.id];
          if (!pos) continue;

          const freshAuthors = (fresh.authors || [])
            .map((a) => formatAuthorWithLifespan(a))
            .filter((name) => Boolean(name && !isPlaceholderAuthor(name)));
          const posHasLifespans = hasEmbeddedLifespans(pos.bookAuthors);
          const freshHasLifespans = hasEmbeddedLifespans(freshAuthors);
          const posHasAuthenticAuthors =
            Array.isArray(pos.bookAuthors) &&
            pos.bookAuthors.length > 0 &&
            !pos.bookAuthors.every(isPlaceholderAuthor);
          const freshHasAuthenticAuthors = freshAuthors.length > 0;
          const needsAuthorEnrichment = !posHasAuthenticAuthors && freshHasAuthenticAuthors;
          const freshCover = fresh.formats?.['image/jpeg'] || null;

          if (
            (!pos.bookTitle && fresh.title) ||
            (!posHasLifespans && freshHasLifespans) ||
            needsAuthorEnrichment ||
            (!pos.coverUrl && freshCover)
          ) {
            hasChanges = true;
            enrichedBookIds.push(fresh.id);
            nextPositions[fresh.id] = {
              ...pos,
              bookTitle: pos.bookTitle || fresh.title,
              bookAuthors: freshHasLifespans || needsAuthorEnrichment ? freshAuthors : pos.bookAuthors,
              coverUrl: pos.coverUrl || freshCover,
            };
          }
        }

        if (hasChanges) {
          set({ readingPositions: nextPositions });
          const currentUserId = useAuthStore.getState().user?.id;
          if (currentUserId) {
            for (const bookId of enrichedBookIds) {
              void get().syncReadingPositionToCloud(bookId, nextPositions[bookId], currentUserId);
            }
          }
        }
      },

      syncReadingPositionToCloud: async (bookId, position, userId) => {
        if (!userId || !bookId) return;
        const progress = get().readingProgress[bookId] ?? 0;
        if (isGhostReadingPosition(position, progress)) return;

        const encodedScrollOffset =
          position.chapterPage +
          (position.bookmarkRow && position.bookmarkRow > 0
            ? Math.min(Math.round(position.bookmarkRow), 999) / 1000
            : 0);

        try {
          const supabase = createClient();
          await supabase.from('reading_progress').upsert(
            {
              user_id: userId,
              book_id: bookId,
              book_title: position.bookTitle || null,
              book_authors: position.bookAuthors || [],
              cover_url: position.coverUrl || null,
              current_chapter_index: position.chapterIndex,
              progress_percent: progress,
              scroll_offset: encodedScrollOffset,
              last_read_at: position.lastReadAt,
            },
            { onConflict: 'user_id,book_id' }
          );
        } catch {
          // Silent non-blocking fallback for offline/network loss
        }
      },

      restoreReadingPositionFromCloud: async (bookId, userId) => {
        if (!userId || !bookId) return null;
        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('reading_progress')
            .select('*')
            .eq('user_id', userId)
            .eq('book_id', bookId)
            .maybeSingle();

          if (data && !error) {
            if (isGhostCloudRow(data)) return null;

            const existingLocal = get().readingPositions[bookId];
            const { position: remotePosition, progress } = decodeRemoteReadingPosition(
              data,
              existingLocal
            );
            set((state) => ({
              readingPositions: {
                ...state.readingPositions,
                [bookId]: remotePosition,
              },
              readingProgress: {
                ...state.readingProgress,
                [bookId]: progress,
              },
            }));
            return remotePosition;
          }
        } catch {
          // Non-blocking fallback
        }
        return null;
      },

      syncWithCloud: async (userId: string) => {
        if (!userId) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
        try {
          const supabase = createClient();

          const pendingDeletes = [...get().deletedPositionBookIds];
          if (pendingDeletes.length > 0) {
            const flushedDeleteIds = new Set<number>();
            for (const delBookId of pendingDeletes) {
              const delResult = await supabase
                .from('reading_progress')
                .delete()
                .eq('user_id', userId)
                .eq('book_id', delBookId);
              if (!delResult?.error) {
                flushedDeleteIds.add(delBookId);
              }
            }
            if (flushedDeleteIds.size > 0) {
              set((state) => ({
                deletedPositionBookIds: state.deletedPositionBookIds.filter(
                  (id) => !flushedDeleteIds.has(id)
                ),
              }));
            }
          }

          // Cloud sanitization: purge legacy 0% Page-1 orphaned records
          await supabase
            .from('reading_progress')
            .delete()
            .eq('user_id', userId)
            .eq('progress_percent', 0)
            .eq('current_chapter_index', 0)
            .lte('scroll_offset', 1);

          const { data, error } = await supabase
            .from('reading_progress')
            .select('*')
            .eq('user_id', userId)
            .order('last_read_at', { ascending: false });

          if (error || !data) return;

          const healedInCloud: Array<{ bookId: number; position: BookReadingPosition }> = [];
          const remoteBookIds = new Set<number>();

          set((state) => {
            const nextPositions = { ...state.readingPositions };
            const nextProgress = { ...state.readingProgress };

            // Prune local ghost entries
            Object.entries(nextPositions).forEach(([idStr, pos]) => {
              const id = Number(idStr);
              const prog = nextProgress[id] ?? 0;
              if (isGhostReadingPosition(pos, prog)) {
                delete nextPositions[id];
                delete nextProgress[id];
              }
            });

            const currentTombstones = new Set(state.deletedPositionBookIds);

            data.forEach((row) => {
              if (isGhostCloudRow(row)) return;

              const bookId = row.book_id;
              if (currentTombstones.has(bookId)) return;
              remoteBookIds.add(bookId);
              const localPos = nextPositions[bookId];
              const remoteTime = new Date(row.last_read_at).getTime();
              const localTime = localPos?.lastReadAt ? new Date(localPos.lastReadAt).getTime() : 0;

              // Reconcile via Last-Write-Wins (LWW) while preserving enriched local author lifespans
              if (!localPos || remoteTime >= localTime) {
                const { position: mergedPosition, progress, shouldKeepLocalAuthors } =
                  decodeRemoteReadingPosition(row, localPos);
                nextPositions[bookId] = mergedPosition;
                nextProgress[bookId] = progress;
                if (shouldKeepLocalAuthors) {
                  healedInCloud.push({ bookId, position: mergedPosition });
                }
              } else {
                // Local position is newer than remote (e.g. read offline) -> push local to cloud
                healedInCloud.push({ bookId, position: localPos });
              }
            });

            // Push any non-ghost local positions that do not yet exist in cloud
            Object.entries(nextPositions).forEach(([idStr, pos]) => {
              const id = Number(idStr);
              if (!remoteBookIds.has(id)) {
                healedInCloud.push({ bookId: id, position: pos });
              }
            });

            return {
              readingPositions: nextPositions,
              readingProgress: nextProgress,
            };
          });

          for (const item of healedInCloud) {
            void get().syncReadingPositionToCloud(item.bookId, item.position, userId);
          }
        } catch {
          // Silent non-blocking fallback for offline/network loss
        }
      },

      getReadingPosition: (bookId) => {
        return get().readingPositions[bookId] ?? null;
      },

      clearReadingPosition: async (bookId, userId) => {
        const timer = progressDebounceTimers.get(bookId);
        if (timer) {
          clearTimeout(timer);
          progressDebounceTimers.delete(bookId);
        }
        set((state) => {
          const nextPositions = { ...state.readingPositions };
          delete nextPositions[bookId];
          return { readingPositions: nextPositions };
        });

        const currentUserId = userId || useAuthStore.getState().user?.id;
        if (currentUserId) {
          const recordTombstone = () => {
            set((state) => ({
              deletedPositionBookIds: Array.from(
                new Set([...state.deletedPositionBookIds, bookId])
              ),
            }));
          };
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            recordTombstone();
            return;
          }
          try {
            const supabase = createClient();
            const { error } = await supabase
              .from('reading_progress')
              .delete()
              .eq('user_id', currentUserId)
              .eq('book_id', bookId);
            if (error) {
              recordTombstone();
            }
          } catch {
            recordTombstone();
          }
        }
      },

      resetReaderSession: () => {
        progressDebounceTimers.forEach((timer) => clearTimeout(timer));
        progressDebounceTimers.clear();

        set({
          readingProgress: {},
          readingPositions: {},
          deletedPositionBookIds: [],
          currentBook: null,
        });
      },

      clearAllVolumes: async (userId) => {
        get().resetReaderSession();

        const currentUserId = userId || useAuthStore.getState().user?.id;
        if (currentUserId) {
          try {
            const supabase = createClient();
            await supabase
              .from('reading_progress')
              .delete()
              .eq('user_id', currentUserId);
          } catch {
            // Non-blocking fallback
          }
        }
      },
    }),
    {
      name: STORAGE_KEYS.READER_SETTINGS,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/**
 * Computes the count of distinct active reading volumes across positions and progress.
 */
export function getActiveReadingCount(
  state: Pick<ReaderState, 'readingPositions' | 'readingProgress'> | null | undefined
): number {
  if (!state) return 0;
  const activeIds = new Set<number>();
  Object.keys(state.readingPositions || {}).forEach((id) => {
    const num = Number(id);
    if (!Number.isNaN(num)) activeIds.add(num);
  });
  Object.entries(state.readingProgress || {}).forEach(([id, progress]) => {
    const num = Number(id);
    if (!Number.isNaN(num) && progress > 0) activeIds.add(num);
  });
  return activeIds.size;
}

/**
 * SSR-safe, hydration-guarded hook for accessing reader state without hydration mismatches.
 */
export function useHydratedReader() {
  const hasMounted = useHasMounted();
  const currentBook = useReaderStore((s) => s.currentBook);
  const isOpen = useReaderStore((s) => s.isOpen);
  const fontSize = useReaderStore((s) => s.fontSize);
  const lineHeight = useReaderStore((s) => s.lineHeight);
  const fontFamily = useReaderStore((s) => s.fontFamily);
  const theme = useReaderStore((s) => s.theme);
  const readingProgress = useReaderStore((s) => s.readingProgress);
  const readingPositions = useReaderStore((s) => s.readingPositions);
  const isMobileTrayOpen = useReaderStore((s) => s.isMobileTrayOpen);

  const openReader = useReaderStore((s) => s.openReader);
  const closeReader = useReaderStore((s) => s.closeReader);
  const setFontSize = useReaderStore((s) => s.setFontSize);
  const setLineHeight = useReaderStore((s) => s.setLineHeight);
  const setFontFamily = useReaderStore((s) => s.setFontFamily);
  const setTheme = useReaderStore((s) => s.setTheme);
  const setMobileTrayOpen = useReaderStore((s) => s.setMobileTrayOpen);
  const toggleMobileTray = useReaderStore((s) => s.toggleMobileTray);
  const setProgress = useReaderStore((s) => s.setProgress);
  const getProgress = useReaderStore((s) => s.getProgress);
  const saveReadingPosition = useReaderStore((s) => s.saveReadingPosition);
  const getReadingPosition = useReaderStore((s) => s.getReadingPosition);
  const clearReadingPosition = useReaderStore((s) => s.clearReadingPosition);
  const clearAllVolumes = useReaderStore((s) => s.clearAllVolumes);
  const syncWithCloud = useReaderStore((s) => s.syncWithCloud);

  const hydratedState = hasMounted
    ? {
        currentBook,
        isOpen,
        fontSize,
        lineHeight,
        fontFamily,
        theme,
        readingProgress,
        readingPositions,
        isMobileTrayOpen,
        activeReadingCount: getActiveReadingCount({ readingPositions, readingProgress }),
      }
    : {
        currentBook: null as GutendexBook | Book | null,
        isOpen: false,
        fontSize: 18,
        lineHeight: 1.75,
        fontFamily: 'serif' as ReaderFontFamily,
        theme: 'light' as ReaderTheme,
        readingProgress: {} as Record<number, number>,
        readingPositions: {} as Record<number, BookReadingPosition>,
        isMobileTrayOpen: false,
        activeReadingCount: 0,
      };

  return {
    hasMounted,
    ...hydratedState,

    openReader,
    closeReader,
    setFontSize,
    setLineHeight,
    setFontFamily,
    setTheme,
    setMobileTrayOpen,
    toggleMobileTray,
    setProgress,
    getProgress,
    saveReadingPosition,
    getReadingPosition,
    clearReadingPosition,
    clearAllVolumes,
    syncWithCloud,
  };
}

