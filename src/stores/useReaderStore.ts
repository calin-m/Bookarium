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

          if (!position.bookTitle) {
            enrichedPosition = {
              ...position,
              bookTitle: currentBook.title || existingPos?.bookTitle,
              bookAuthors:
                authors.length > 0
                  ? authors
                  : existingPos?.bookAuthors || [],
              coverUrl: coverUrl ?? existingPos?.coverUrl ?? null,
            };
          } else if (posAuthorsMissingOrPlaceholder && (authors.length > 0 || existingPos?.bookAuthors?.length)) {
            enrichedPosition = {
              ...position,
              bookAuthors: authors.length > 0 ? authors : existingPos?.bookAuthors || [],
              coverUrl: position.coverUrl ?? coverUrl ?? existingPos?.coverUrl ?? null,
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
            ...(existingPos.bookAuthors ? { bookAuthors: existingPos.bookAuthors } : {}),
            ...(existingPos.coverUrl !== undefined ? { coverUrl: existingPos.coverUrl } : {}),
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
          deletedPositionBookIds: (state.deletedPositionBookIds || []).filter((id) => id !== bookId),
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
              bookAuthors: freshHasLifespans || needsAuthorEnrichment ? freshAuthors : pos.bookAuthors || freshAuthors,
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
        const isGhost =
          progress === 0 &&
          (position.chapterIndex ?? 0) === 0 &&
          (position.chapterPage ?? 1) <= 1 &&
          (position.globalPage ?? 1) <= 1 &&
          (position.bookmarkRow ?? 0) <= 0;

        if (isGhost) return;

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
            const isGhost =
              Number(data.progress_percent || 0) === 0 &&
              (data.current_chapter_index ?? 0) === 0 &&
              Number(data.scroll_offset || 0) <= 1;

            if (isGhost) return null;

            const existingLocal = get().readingPositions[bookId];
            const remoteAuthors: string[] | undefined = data.book_authors || undefined;
            const preservedAuthors =
              !hasEmbeddedLifespans(remoteAuthors) && hasEmbeddedLifespans(existingLocal?.bookAuthors)
                ? existingLocal.bookAuthors
                : remoteAuthors || existingLocal?.bookAuthors;

            const rawOffset = Number(data.scroll_offset) || 1;
            const decodedPage = Math.max(1, Math.floor(rawOffset));
            const decodedRow = Math.round((rawOffset - decodedPage) * 1000);

            const remotePosition: BookReadingPosition = {
              chapterIndex: data.current_chapter_index ?? 0,
              chapterPage: decodedPage,
              globalPage: decodedPage,
              ...(decodedRow > 0 ? { bookmarkRow: decodedRow } : {}),
              lastReadAt: data.last_read_at || new Date().toISOString(),
              bookTitle: data.book_title || existingLocal?.bookTitle || undefined,
              bookAuthors: preservedAuthors,
              coverUrl: data.cover_url || existingLocal?.coverUrl || undefined,
            };
            set((state) => ({
              readingPositions: {
                ...state.readingPositions,
                [bookId]: remotePosition,
              },
              readingProgress: {
                ...state.readingProgress,
                [bookId]: Math.min(Math.max(Math.round(Number(data.progress_percent) || 0), 0), 100),
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

          const pendingDeletes = [...(get().deletedPositionBookIds || [])];
          if (pendingDeletes.length > 0) {
            for (const delBookId of pendingDeletes) {
              await supabase
                .from('reading_progress')
                .delete()
                .eq('user_id', userId)
                .eq('book_id', delBookId);
            }
            set({ deletedPositionBookIds: [] });
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
              if (
                (pos.globalPage ?? 1) <= 1 &&
                (pos.chapterIndex ?? 0) === 0 &&
                (pos.chapterPage ?? 1) <= 1 &&
                (pos.bookmarkRow ?? 0) <= 0 &&
                prog === 0
              ) {
                delete nextPositions[id];
                delete nextProgress[id];
              }
            });

            data.forEach((row) => {
              const isGhost =
                Number(row.progress_percent || 0) === 0 &&
                (row.current_chapter_index ?? 0) === 0 &&
                Number(row.scroll_offset || 0) <= 1;

              if (isGhost) return;

              const bookId = row.book_id;
              remoteBookIds.add(bookId);
              const localPos = nextPositions[bookId];
              const remoteTime = new Date(row.last_read_at).getTime();
              const localTime = localPos?.lastReadAt ? new Date(localPos.lastReadAt).getTime() : 0;

              // Reconcile via Last-Write-Wins (LWW) while preserving enriched local author lifespans
              if (!localPos || remoteTime >= localTime) {
                const remoteAuthors: string[] | undefined = row.book_authors || undefined;
                const shouldKeepLocalAuthors =
                  !hasEmbeddedLifespans(remoteAuthors) &&
                  hasEmbeddedLifespans(localPos?.bookAuthors);
                const rawOffset = Number(row.scroll_offset) || 1;
                const decodedPage = Math.max(1, Math.floor(rawOffset));
                const decodedRow = Math.round((rawOffset - decodedPage) * 1000);
                const mergedPosition: BookReadingPosition = {
                  chapterIndex: row.current_chapter_index ?? 0,
                  chapterPage: decodedPage,
                  globalPage: decodedPage,
                  ...(decodedRow > 0 ? { bookmarkRow: decodedRow } : {}),
                  lastReadAt: row.last_read_at || new Date().toISOString(),
                  bookTitle: row.book_title || localPos?.bookTitle || undefined,
                  bookAuthors: shouldKeepLocalAuthors
                    ? localPos.bookAuthors
                    : remoteAuthors || localPos?.bookAuthors || undefined,
                  coverUrl: row.cover_url || localPos?.coverUrl || undefined,
                };
                nextPositions[bookId] = mergedPosition;
                nextProgress[bookId] = Math.min(
                  Math.max(Math.round(Number(row.progress_percent) || 0), 0),
                  100
                );
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
          if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            set((state) => ({
              deletedPositionBookIds: Array.from(
                new Set([...(state.deletedPositionBookIds || []), bookId])
              ),
            }));
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
              set((state) => ({
                deletedPositionBookIds: Array.from(
                  new Set([...(state.deletedPositionBookIds || []), bookId])
                ),
              }));
            }
          } catch {
            set((state) => ({
              deletedPositionBookIds: Array.from(
                new Set([...(state.deletedPositionBookIds || []), bookId])
              ),
            }));
          }
        }
      },

      clearAllVolumes: async (userId) => {
        progressDebounceTimers.forEach((timer) => clearTimeout(timer));
        progressDebounceTimers.clear();

        set({
          readingProgress: {},
          readingPositions: {},
          deletedPositionBookIds: [],
          currentBook: null,
        });

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

  const activeReadingCount = hasMounted
    ? getActiveReadingCount({ readingPositions, readingProgress })
    : 0;

  return {
    hasMounted,
    currentBook: hasMounted ? currentBook : null,
    isOpen: hasMounted ? isOpen : false,
    fontSize: hasMounted ? fontSize : 18,
    lineHeight: hasMounted ? lineHeight : 1.75,
    fontFamily: hasMounted ? fontFamily : 'serif',
    theme: hasMounted ? theme : 'light',
    readingProgress: hasMounted ? readingProgress : {},
    readingPositions: hasMounted ? readingPositions : {},
    isMobileTrayOpen: hasMounted ? isMobileTrayOpen : false,
    activeReadingCount,

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

