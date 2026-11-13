import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GutendexBook, Book, Author } from '@/types/book.types';
import { useThemeStore, applyThemeToDocument } from './useThemeStore';
import {
  useAuthStore,
  coalesceInFlightByUser,
  shouldVerifyCloudSession,
  verifyActiveCloudSession,
} from './useAuthStore';
import { createClient } from '@/lib/supabase/client';
import { STORAGE_KEYS } from '@/config/site-config';
import { READER_FONT_CONFIG, resolveDefaultReaderFontSize } from '@/config/reader-config';
import { safeLocalStorage } from '@/lib/safe-storage';
import { useHasMounted } from '@/hooks/useHasMounted';
import { formatAuthorWithLifespan } from '@/lib/adapters/book.adapter';
import { isPlaceholderAuthor } from '@/lib/book-metadata';
import {
  type ReaderTheme,
  type ReaderFontFamily,
  type BookReadingPosition,
  hasEmbeddedLifespans,
  isGhostReadingPosition,
  isGhostCloudRow,
  decodeRemoteReadingPosition,
  extractVerifiedAuthors,
} from '@/lib/reader-cloud-sync';

export {
  type ReaderTheme,
  type ReaderFontFamily,
  type BookReadingPosition,
};

export type ReaderReadingMode = 'paginated' | 'scroll';
export type ReaderColumnWidth = 'narrow' | 'normal' | 'wide';

export interface ReaderState {
  currentBook: GutendexBook | Book | null;
  isOpen: boolean;
  fontSize: number;
  isFontSizeCustomized: boolean;
  lineHeight: number;
  fontFamily: ReaderFontFamily;
  theme: ReaderTheme;
  brightness: number;
  readingMode: ReaderReadingMode;
  columnWidth: ReaderColumnWidth;
  readingProgress: Record<number, number>;
  readingPositions: Record<number, BookReadingPosition>;
  deletedPositionBookIds: number[];
  dirtyPositionBookIds: number[];
  lastReaderSyncAt: string | null;
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
  setBrightness: (brightness: number) => void;
  setReadingMode: (mode: ReaderReadingMode) => void;
  setColumnWidth: (width: ReaderColumnWidth) => void;
  setMobileTrayOpen: (open: boolean) => void;
  toggleMobileTray: () => void;
  setProgress: (bookId: number, progress: number) => void;
  getProgress: (bookId: number) => number;
  saveReadingPosition: (
    bookId: number,
    position: BookReadingPosition,
    userId?: string,
    options?: { immediateCloudSync?: boolean }
  ) => void;
  enrichReadingPositions: (freshBooks: GutendexBook[]) => void;
  getReadingPosition: (bookId: number) => BookReadingPosition | null;
  clearReadingPosition: (bookId: number, userId?: string) => Promise<void>;
  clearAllVolumes: (userId?: string) => Promise<void>;
  resetReaderSession: () => void;
  syncReadingPositionToCloud: (bookId: number, position: BookReadingPosition, userId: string) => Promise<boolean>;
  restoreReadingPositionFromCloud: (bookId: number, userId: string) => Promise<BookReadingPosition | null>;
  syncWithCloud: (userId: string, options?: { minSyncIntervalMs?: number }) => Promise<void>;
}

const progressDebounceTimers = new Map<number, ReturnType<typeof setTimeout>>();
const inFlightReaderSyncs = new Map<string, Promise<void>>();
const dirtyReaderSyncUsers = new Set<string>();
const lastReaderSyncByUser = new Map<string, number>();

function invalidateReaderSyncCooldown(userId?: string): void {
  if (userId) {
    lastReaderSyncByUser.delete(userId);
  } else {
    lastReaderSyncByUser.clear();
  }
}

interface ReadingProgressCloudRowPair {
  basePayload: {
    user_id: string;
    book_id: number;
    book_title: string | null;
    book_authors: string[];
    cover_url: string | null;
    current_chapter_index: number;
    progress_percent: number;
    scroll_offset: number;
    last_read_at: string;
  };
  fullPayload: {
    user_id: string;
    book_id: number;
    book_title: string | null;
    book_authors: string[];
    cover_url: string | null;
    current_chapter_index: number;
    progress_percent: number;
    scroll_offset: number;
    last_read_at: string;
    bookmark_text: string | null;
  };
}

function buildReadingProgressCloudRow(
  bookId: number,
  position: BookReadingPosition,
  progress: number,
  userId: string
): ReadingProgressCloudRowPair | null {
  if (!userId || !bookId || isGhostReadingPosition(position, progress)) {
    return null;
  }
  const encodedScrollOffset =
    position.chapterPage +
    (position.bookmarkRow && position.bookmarkRow > 0
      ? Math.min(Math.round(position.bookmarkRow), 999) / 1000
      : 0);
  const basePayload = {
    user_id: userId,
    book_id: bookId,
    book_title: position.bookTitle || null,
    book_authors: position.bookAuthors || [],
    cover_url: position.coverUrl || null,
    current_chapter_index: position.chapterIndex,
    progress_percent: progress,
    scroll_offset: encodedScrollOffset,
    last_read_at: position.lastReadAt,
  };
  const resolvedBookmarkText =
    position.bookmarkRow && position.bookmarkRow > 0 && position.bookmarkText?.trim()
      ? position.bookmarkText.trim()
      : null;
  return {
    basePayload,
    fullPayload: {
      ...basePayload,
      bookmark_text: resolvedBookmarkText,
    },
  };
}

function clearUploadedDirtyPositions(
  state: Pick<ReaderState, 'dirtyPositionBookIds' | 'readingPositions'>,
  uploadedSnapshots: ReadonlyArray<{ bookId: number; lastReadAt?: string }>
): number[] {
  if (uploadedSnapshots.length === 0 || state.dirtyPositionBookIds.length === 0) {
    return state.dirtyPositionBookIds;
  }
  const snapshotMap = new Map<number, string | undefined>();
  for (const entry of uploadedSnapshots) {
    snapshotMap.set(entry.bookId, entry.lastReadAt);
  }
  return state.dirtyPositionBookIds.filter((id) => {
    if (!snapshotMap.has(id)) return true;
    const currentPos = state.readingPositions[id];
    const uploadedAt = snapshotMap.get(id);
    // Keep dirty if a newer local save arrived while the upload was in flight
    return Boolean(currentPos && uploadedAt && currentPos.lastReadAt !== uploadedAt);
  });
}

async function upsertReadingProgressBatch(
  supabase: ReturnType<typeof createClient>,
  rows: ReadingProgressCloudRowPair[]
): Promise<boolean> {
  if (rows.length === 0) return true;
  const fullArg = rows.length === 1 ? rows[0].fullPayload : rows.map((r) => r.fullPayload);
  const upsertResult = await supabase
    .from('reading_progress')
    .upsert(fullArg, { onConflict: 'user_id,book_id' });
  if (!upsertResult?.error) {
    return true;
  }
  if (/bookmark_text/i.test(String(upsertResult.error.message || ''))) {
    const baseArg = rows.length === 1 ? rows[0].basePayload : rows.map((r) => r.basePayload);
    const fallbackResult = await supabase.from('reading_progress').upsert(baseArg, {
      onConflict: 'user_id,book_id',
    });
    return !fallbackResult?.error;
  }
  return false;
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set, get) => ({
      currentBook: null,
      isOpen: false,
      fontSize: READER_FONT_CONFIG.DEFAULT_SIZE,
      isFontSizeCustomized: false,
      lineHeight: READER_FONT_CONFIG.DEFAULT_LINE_HEIGHT,
      fontFamily: 'serif',
      theme: 'light',
      brightness: READER_FONT_CONFIG.DEFAULT_BRIGHTNESS,
      readingMode: 'paginated',
      columnWidth: 'wide',
      readingProgress: {},
      readingPositions: {},
      deletedPositionBookIds: [],
      dirtyPositionBookIds: [],
      lastReaderSyncAt: null,
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
        set({ fontSize: clamped, isFontSizeCustomized: true });
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

      setBrightness: (brightness) => {
        const clamped = Math.min(
          Math.max(Math.round(brightness), READER_FONT_CONFIG.MIN_BRIGHTNESS),
          READER_FONT_CONFIG.MAX_BRIGHTNESS
        );
        set({ brightness: clamped });
      },

      setReadingMode: (readingMode) => {
        set({ readingMode: readingMode === 'scroll' ? 'scroll' : 'paginated' });
      },

      setColumnWidth: (columnWidth) => {
        const validWidth: ReaderColumnWidth =
          columnWidth === 'narrow' || columnWidth === 'normal' ? columnWidth : 'wide';
        set({ columnWidth: validWidth });
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

      saveReadingPosition: (bookId, position, userId, options) => {
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

        const currentUserId = userId || useAuthStore.getState().user?.id;
        set((state) => {
          const isGhost = isGhostReadingPosition(
            enrichedPosition,
            state.readingProgress[bookId] ?? 0
          );
          const nextDirty = !currentUserId
            ? state.dirtyPositionBookIds
            : isGhost
              ? state.dirtyPositionBookIds.filter((id) => id !== bookId)
              : state.dirtyPositionBookIds.includes(bookId)
                ? state.dirtyPositionBookIds
                : [...state.dirtyPositionBookIds, bookId];

          return {
            readingPositions: {
              ...state.readingPositions,
              [bookId]: enrichedPosition,
            },
            deletedPositionBookIds: state.deletedPositionBookIds.filter((id) => id !== bookId),
            dirtyPositionBookIds: nextDirty,
          };
        });

        if (!currentUserId) return;

        const existingTimer = progressDebounceTimers.get(bookId);
        if (existingTimer) {
          clearTimeout(existingTimer);
          progressDebounceTimers.delete(bookId);
        }

        if (options?.immediateCloudSync) {
          void get().syncReadingPositionToCloud(bookId, enrichedPosition, currentUserId);
          return;
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
          const currentUserId = useAuthStore.getState().user?.id;
          set({ readingPositions: nextPositions });
          if (currentUserId) {
            if (enrichedBookIds.length === 1) {
              const bId = enrichedBookIds[0];
              set((state) => ({
                dirtyPositionBookIds: state.dirtyPositionBookIds.includes(bId)
                  ? state.dirtyPositionBookIds
                  : [...state.dirtyPositionBookIds, bId],
              }));
              void get().syncReadingPositionToCloud(bId, nextPositions[bId], currentUserId);
            } else if (enrichedBookIds.length > 1) {
              const progressMap = get().readingProgress;
              const uploadedSnapshots: Array<{ bookId: number; lastReadAt?: string }> = [];
              const batchRows = enrichedBookIds
                .map((bId) => {
                  const built = buildReadingProgressCloudRow(
                    bId,
                    nextPositions[bId],
                    progressMap[bId] ?? 0,
                    currentUserId
                  );
                  if (built) {
                    uploadedSnapshots.push({
                      bookId: bId,
                      lastReadAt: nextPositions[bId].lastReadAt,
                    });
                  }
                  return built;
                })
                .filter((row): row is ReadingProgressCloudRowPair => row !== null);
              if (batchRows.length > 0) {
                const batchBookIds = uploadedSnapshots.map((entry) => entry.bookId);
                set((state) => ({
                  dirtyPositionBookIds: Array.from(
                    new Set([...state.dirtyPositionBookIds, ...batchBookIds])
                  ),
                }));
                void (async () => {
                  try {
                    const supabase = createClient();
                    if (
                      shouldVerifyCloudSession(supabase) &&
                      !(await verifyActiveCloudSession(supabase, currentUserId))
                    ) {
                      return;
                    }
                    const uploaded = await upsertReadingProgressBatch(supabase, batchRows);
                    if (uploaded) {
                      set((state) => ({
                        dirtyPositionBookIds: clearUploadedDirtyPositions(
                          state,
                          uploadedSnapshots
                        ),
                      }));
                    }
                  } catch {
                    // Silent non-blocking fallback; dirtyPositionBookIds retains enriched IDs for next sync
                  }
                })();
              }
            }
          }
        }
      },

      syncReadingPositionToCloud: async (bookId, position, userId) => {
        if (!userId || !bookId) return false;
        const progress = get().readingProgress[bookId] ?? 0;
        const row = buildReadingProgressCloudRow(bookId, position, progress, userId);
        if (!row) {
          if (get().dirtyPositionBookIds.includes(bookId)) {
            set((state) => ({
              dirtyPositionBookIds: clearUploadedDirtyPositions(state, [
                { bookId, lastReadAt: position.lastReadAt },
              ]),
            }));
          }
          return false;
        }

        try {
          const supabase = createClient();
          if (
            shouldVerifyCloudSession(supabase) &&
            !(await verifyActiveCloudSession(supabase, userId))
          ) {
            return false;
          }
          const uploaded = await upsertReadingProgressBatch(supabase, [row]);
          if (uploaded) {
            set((state) => ({
              dirtyPositionBookIds: clearUploadedDirtyPositions(state, [
                { bookId, lastReadAt: position.lastReadAt },
              ]),
            }));
          }
          return uploaded;
        } catch {
          // Silent non-blocking fallback for offline/network loss
          return false;
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
            const remoteTime = remotePosition.lastReadAt
              ? new Date(remotePosition.lastReadAt).getTime()
              : 0;
            const localTime = existingLocal?.lastReadAt
              ? new Date(existingLocal.lastReadAt).getTime()
              : 0;
            const shouldAdoptRemote =
              !existingLocal ||
              remoteTime >= localTime ||
              (!existingLocal.bookmarkText && Boolean(remotePosition.bookmarkText));

            if (shouldAdoptRemote) {
              const pendingTimer = progressDebounceTimers.get(bookId);
              if (pendingTimer) {
                clearTimeout(pendingTimer);
                progressDebounceTimers.delete(bookId);
              }
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
            }
            return remotePosition;
          }
        } catch {
          // Non-blocking fallback
        }
        return null;
      },

      syncWithCloud: (userId: string, options?: { minSyncIntervalMs?: number }) => {
        if (!userId) return Promise.resolve();
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve();

        const minSyncIntervalMs = options?.minSyncIntervalMs ?? 0;
        if (
          minSyncIntervalMs > 0 &&
          !inFlightReaderSyncs.has(userId) &&
          !dirtyReaderSyncUsers.has(userId) &&
          get().deletedPositionBookIds.length === 0 &&
          get().dirtyPositionBookIds.length === 0
        ) {
          const lastSyncAt = lastReaderSyncByUser.get(userId);
          if (lastSyncAt !== undefined && Date.now() - lastSyncAt < minSyncIntervalMs) {
            return Promise.resolve();
          }
        }

        if (
          inFlightReaderSyncs.has(userId) &&
          (get().deletedPositionBookIds.length > 0 || get().dirtyPositionBookIds.length > 0)
        ) {
          dirtyReaderSyncUsers.add(userId);
        }

        return coalesceInFlightByUser(
          inFlightReaderSyncs,
          userId,
          async () => {
            if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
            try {
              const supabase = createClient();
              if (
                shouldVerifyCloudSession(supabase) &&
                !(await verifyActiveCloudSession(supabase, userId))
              ) {
                return;
              }

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

              const syncSnapshotStartedAtMs = Date.now();
              const { data, error } = await supabase
                .from('reading_progress')
                .select('*')
                .eq('user_id', userId)
                .order('last_read_at', { ascending: false });

              if (error || !data) return;

              // Cloud sanitization: purge legacy 0% Page-1 orphaned records only when present
              if (data.some((row) => isGhostCloudRow(row))) {
                await supabase
                  .from('reading_progress')
                  .delete()
                  .eq('user_id', userId)
                  .eq('progress_percent', 0)
                  .eq('current_chapter_index', 0)
                  .lte('scroll_offset', 1);
              }

              const healedInCloud: Array<{ bookId: number; position: BookReadingPosition }> = [];
              const remoteBookIds = new Set<number>();
              let maxRemoteTimeMs = 0;

              set((state) => {
                const nextPositions = { ...state.readingPositions };
                const nextProgress = { ...state.readingProgress };

                const prunedGhostSnapshots: Array<{ bookId: number; lastReadAt?: string }> = [];

                // Prune local ghost entries
                Object.entries(nextPositions).forEach(([idStr, pos]) => {
                  const id = Number(idStr);
                  const prog = nextProgress[id] ?? 0;
                  if (isGhostReadingPosition(pos, prog)) {
                    const pendingTimer = progressDebounceTimers.get(id);
                    if (pendingTimer) {
                      clearTimeout(pendingTimer);
                      progressDebounceTimers.delete(id);
                    }
                    delete nextPositions[id];
                    delete nextProgress[id];
                    prunedGhostSnapshots.push({ bookId: id, lastReadAt: pos.lastReadAt });
                  }
                });

                const currentTombstones = new Set(state.deletedPositionBookIds);
                const dirtySet = new Set(state.dirtyPositionBookIds);
                const parsedSyncTime = state.lastReaderSyncAt
                  ? new Date(state.lastReaderSyncAt).getTime()
                  : 0;
                const lastSyncTime = Number.isFinite(parsedSyncTime) ? parsedSyncTime : 0;
                const hasAuthoritativeSync = lastSyncTime > 0;
                const syncedRemoteSnapshots: Array<{ bookId: number; lastReadAt?: string }> = [];

                data.forEach((row) => {
                  if (isGhostCloudRow(row)) return;

                  const bookId = row.book_id;
                  if (currentTombstones.has(bookId)) return;
                  remoteBookIds.add(bookId);
                  const localPos = nextPositions[bookId];
                  const rawRemoteTime = row.last_read_at ? new Date(row.last_read_at).getTime() : 0;
                  const remoteTime = Number.isFinite(rawRemoteTime) ? rawRemoteTime : 0;
                  if (remoteTime > maxRemoteTimeMs) {
                    maxRemoteTimeMs = remoteTime;
                  }
                  const rawLocalTime = localPos?.lastReadAt
                    ? new Date(localPos.lastReadAt).getTime()
                    : 0;
                  const localTime = Number.isFinite(rawLocalTime) ? rawLocalTime : 0;

                  // Reconcile via Last-Write-Wins (LWW) while preserving enriched local author lifespans
                  if (!localPos || remoteTime >= localTime) {
                    const pendingTimer = progressDebounceTimers.get(bookId);
                    if (pendingTimer) {
                      clearTimeout(pendingTimer);
                      progressDebounceTimers.delete(bookId);
                    }
                    const { position: mergedPosition, progress, shouldKeepLocalAuthors } =
                      decodeRemoteReadingPosition(row, localPos);
                    nextPositions[bookId] = mergedPosition;
                    nextProgress[bookId] = progress;
                    syncedRemoteSnapshots.push({ bookId, lastReadAt: localPos?.lastReadAt });
                    if (shouldKeepLocalAuthors) {
                      healedInCloud.push({ bookId, position: mergedPosition });
                    }
                  } else {
                    // Local position is newer than remote (e.g. read offline) -> push local to cloud
                    healedInCloud.push({ bookId, position: localPos });
                  }
                });

                // Reconcile local-only positions: upload on initial sync or when unsynced local edits exist,
                // otherwise prune bookmarks deleted on another device since the last authoritative sync.
                Object.entries(nextPositions).forEach(([idStr, pos]) => {
                  const id = Number(idStr);
                  if (!remoteBookIds.has(id)) {
                    const rawLocalTime = pos.lastReadAt ? new Date(pos.lastReadAt).getTime() : 0;
                    const localTime = Number.isFinite(rawLocalTime) ? rawLocalTime : 0;
                    const hasUnsyncedLocalEdit =
                      !hasAuthoritativeSync ||
                      dirtySet.has(id) ||
                      progressDebounceTimers.has(id) ||
                      localTime > lastSyncTime;

                    if (hasUnsyncedLocalEdit) {
                      healedInCloud.push({ bookId: id, position: pos });
                    } else {
                      delete nextPositions[id];
                      delete nextProgress[id];
                    }
                  }
                });

                return {
                  readingPositions: nextPositions,
                  readingProgress: nextProgress,
                  dirtyPositionBookIds: clearUploadedDirtyPositions(state, [
                    ...syncedRemoteSnapshots,
                    ...prunedGhostSnapshots,
                  ]),
                };
              });

              let healedUploadSucceeded = true;
              if (healedInCloud.length === 1) {
                const single = healedInCloud[0];
                healedUploadSucceeded = await get().syncReadingPositionToCloud(
                  single.bookId,
                  single.position,
                  userId
                );
              } else if (healedInCloud.length > 1) {
                const progressMap = get().readingProgress;
                const uploadedSnapshots: Array<{ bookId: number; lastReadAt?: string }> = [];
                const batchRows = healedInCloud
                  .map((item) => {
                    const built = buildReadingProgressCloudRow(
                      item.bookId,
                      item.position,
                      progressMap[item.bookId] ?? 0,
                      userId
                    );
                    if (built) {
                      uploadedSnapshots.push({
                        bookId: item.bookId,
                        lastReadAt: item.position.lastReadAt,
                      });
                    }
                    return built;
                  })
                  .filter((row): row is ReadingProgressCloudRowPair => row !== null);
                if (batchRows.length > 0) {
                  healedUploadSucceeded = await upsertReadingProgressBatch(supabase, batchRows);
                  if (healedUploadSucceeded) {
                    set((state) => ({
                      dirtyPositionBookIds: clearUploadedDirtyPositions(state, uploadedSnapshots),
                    }));
                  }
                }
              }

              if (healedUploadSucceeded) {
                const syncAnchorIso = new Date(
                  Math.max(syncSnapshotStartedAtMs, maxRemoteTimeMs)
                ).toISOString();
                set((state) => ({
                  lastReaderSyncAt:
                    !state.lastReaderSyncAt || syncAnchorIso > state.lastReaderSyncAt
                      ? syncAnchorIso
                      : state.lastReaderSyncAt,
                }));
                lastReaderSyncByUser.set(userId, Date.now());
              }
            } catch {
              // Silent non-blocking fallback for offline/network loss
            }
          },
          dirtyReaderSyncUsers
        );
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
          return {
            readingPositions: nextPositions,
            dirtyPositionBookIds: state.dirtyPositionBookIds.filter((id) => id !== bookId),
          };
        });

        const currentUserId = userId || useAuthStore.getState().user?.id;
        if (currentUserId) {
          invalidateReaderSyncCooldown(currentUserId);
          const recordTombstone = () => {
            set((state) => ({
              deletedPositionBookIds: Array.from(
                new Set([...state.deletedPositionBookIds, bookId])
              ),
            }));
            if (inFlightReaderSyncs.has(currentUserId)) {
              dirtyReaderSyncUsers.add(currentUserId);
            }
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
        invalidateReaderSyncCooldown();
        progressDebounceTimers.forEach((timer) => clearTimeout(timer));
        progressDebounceTimers.clear();

        set({
          readingProgress: {},
          readingPositions: {},
          deletedPositionBookIds: [],
          dirtyPositionBookIds: [],
          lastReaderSyncAt: null,
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
      storage: createJSONStorage(() => safeLocalStorage),
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
  const isFontSizeCustomized = useReaderStore((s) => s.isFontSizeCustomized);
  const lineHeight = useReaderStore((s) => s.lineHeight);
  const fontFamily = useReaderStore((s) => s.fontFamily);
  const theme = useReaderStore((s) => s.theme);
  const brightness = useReaderStore((s) => s.brightness);
  const readingMode = useReaderStore((s) => s.readingMode);
  const columnWidth = useReaderStore((s) => s.columnWidth);
  const readingProgress = useReaderStore((s) => s.readingProgress);
  const readingPositions = useReaderStore((s) => s.readingPositions);
  const isMobileTrayOpen = useReaderStore((s) => s.isMobileTrayOpen);

  const openReader = useReaderStore((s) => s.openReader);
  const closeReader = useReaderStore((s) => s.closeReader);
  const setFontSize = useReaderStore((s) => s.setFontSize);
  const setLineHeight = useReaderStore((s) => s.setLineHeight);
  const setFontFamily = useReaderStore((s) => s.setFontFamily);
  const setTheme = useReaderStore((s) => s.setTheme);
  const setBrightness = useReaderStore((s) => s.setBrightness);
  const setReadingMode = useReaderStore((s) => s.setReadingMode);
  const setColumnWidth = useReaderStore((s) => s.setColumnWidth);
  const setMobileTrayOpen = useReaderStore((s) => s.setMobileTrayOpen);
  const toggleMobileTray = useReaderStore((s) => s.toggleMobileTray);
  const setProgress = useReaderStore((s) => s.setProgress);
  const getProgress = useReaderStore((s) => s.getProgress);
  const saveReadingPosition = useReaderStore((s) => s.saveReadingPosition);
  const getReadingPosition = useReaderStore((s) => s.getReadingPosition);
  const clearReadingPosition = useReaderStore((s) => s.clearReadingPosition);
  const clearAllVolumes = useReaderStore((s) => s.clearAllVolumes);
  const syncWithCloud = useReaderStore((s) => s.syncWithCloud);

  const effectiveFontSize =
    hasMounted && !isFontSizeCustomized ? resolveDefaultReaderFontSize() : fontSize;

  const hydratedState = hasMounted
    ? {
        currentBook,
        isOpen,
        fontSize: effectiveFontSize,
        lineHeight,
        fontFamily,
        theme,
        brightness,
        readingMode,
        columnWidth,
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
        brightness: READER_FONT_CONFIG.DEFAULT_BRIGHTNESS,
        readingMode: 'paginated' as ReaderReadingMode,
        columnWidth: 'wide' as ReaderColumnWidth,
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
    setBrightness,
    setReadingMode,
    setColumnWidth,
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

