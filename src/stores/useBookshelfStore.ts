import { useEffect } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GutendexBook, ReadingStatus } from '@/types/book.types';
import { useHasMounted } from '@/hooks/useHasMounted';
import { createClient } from '@/lib/supabase/client';
import type { Bookshelf, BookshelfItem } from '@/types/database.types';
import { STORAGE_KEYS } from '@/config/site-config';
import { useAuthStore } from './useAuthStore';
import { useReaderStore } from './useReaderStore';
import { toCloudBookInsert } from '@/lib/adapters/book.adapter';
import {
  applyDeterministicItemOrdering,
  executeFlushOutbox,
  executeBookshelfCloudSync,
  executeMigrateLocalBooksToCloud,
  executeCreateCloudBookshelf,
  executeUpdateCloudBookshelf,
  executeUpdateBookshelfPrivacy,
  executeDeleteCloudBookshelf,
  executeMoveBookToShelf,
  type OutboxActionInput,
  type OutboxAction,
} from '@/lib/bookshelf-cloud-sync';

export { applyDeterministicItemOrdering, type OutboxActionInput, type OutboxAction };

export interface BookshelfState {
  savedBooks: GutendexBook[];
  readingQueue: GutendexBook[];
  favoriteBooks: GutendexBook[];
  favoriteBookIds: number[];
  recentBooks: GutendexBook[];

  // Personal Curation State (1-5 Star Ratings & Reading Statuses)
  bookRatings: Record<number, number>;
  bookStatuses: Record<number, ReadingStatus>;
  curationHistory: Record<number, string>;
  deletedBookIds: Record<number, string>;
  deletedFavoriteBookIds: Record<number, string>;
  lastFavoritesSyncAt: string | null;
  lastBookshelfSyncAt: string | null;

  // Cloud State
  cloudBookshelves: Bookshelf[];
  cloudBookshelfItems: BookshelfItem[];
  activeBookshelfId: string | null;
  isSyncing: boolean;
  outbox: OutboxAction[];

  // Outbox Actions
  queueOutboxAction: (action: OutboxActionInput) => void;
  flushOutbox: (userId: string) => Promise<void>;

  // Actions
  toggleSaveBook: (book: GutendexBook, userId?: string) => Promise<void>;
  isBookSaved: (id: number) => boolean;
  clearSavedBooks: () => void;
  enrichSavedBooks: (books: GutendexBook[]) => Promise<void>;
  addToQueue: (book: GutendexBook) => void;
  removeFromQueue: (id: number) => void;
  isInQueue: (id: number) => boolean;
  toggleFavoriteBook: (bookOrId: GutendexBook | number, userId?: string) => Promise<void>;
  isBookFavorite: (id: number) => boolean;
  syncFavoriteBooks: (books: GutendexBook[]) => void;
  clearFavoriteBooks: () => void;
  addRecentBook: (book: GutendexBook) => void;
  clearBookshelf: () => void;

  // Curation Actions
  setBookRating: (bookId: number, rating: number | null, userId?: string) => Promise<void>;
  setReadingStatus: (bookId: number, status: ReadingStatus | null, userId?: string) => Promise<void>;
  getBookRating: (bookId: number) => number | null;
  getReadingStatus: (bookId: number) => ReadingStatus | null;
  getBookCuration: (bookId: number) => { rating: number | null; status: ReadingStatus | null };

  // Cloud Actions
  syncWithCloud: (userId: string) => Promise<void>;
  migrateLocalBooksToCloud: (userId: string) => Promise<void>;
  createCloudBookshelf: (name: string, userId: string, isPublic?: boolean) => Promise<Bookshelf | null>;
  updateCloudBookshelf: (shelfId: string, name: string, userId: string, isPublic?: boolean) => Promise<boolean>;
  updateBookshelfPrivacy: (shelfId: string, isPublic: boolean, userId: string) => Promise<boolean>;
  deleteCloudBookshelf: (shelfId: string, userId: string) => Promise<boolean>;
  moveBookToShelf: (bookId: number, targetShelfId: string, userId: string) => Promise<boolean>;
  setActiveBookshelfId: (id: string | null) => void;
}

export const useBookshelfStore = create<BookshelfState>()(
  persist(
    (set, get) => ({
      savedBooks: [],
      readingQueue: [],
      favoriteBooks: [],
      favoriteBookIds: [],
      recentBooks: [],
      bookRatings: {},
      bookStatuses: {},
      curationHistory: {},
      deletedBookIds: {},
      deletedFavoriteBookIds: {},
      lastFavoritesSyncAt: null,
      lastBookshelfSyncAt: null,
      cloudBookshelves: [],
      cloudBookshelfItems: [],
      activeBookshelfId: null,
      isSyncing: false,
      outbox: [],

      queueOutboxAction: (action) => {
        const item: OutboxAction = {
          ...action,
          id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
          timestamp: new Date().toISOString(),
        };
        set((state) => ({ outbox: [...state.outbox, item] }));
      },

      flushOutbox: async (userId: string) => executeFlushOutbox(userId, get, set),

      toggleSaveBook: async (book, userId) => {
        const currentUserId = userId || useAuthStore.getState().user?.id;
        const { savedBooks, cloudBookshelves, activeBookshelfId, cloudBookshelfItems, deletedBookIds = {} } = get();
        const exists = savedBooks.some((b) => b.id === book.id);
        const nextSaved = exists ? savedBooks.filter((b) => b.id !== book.id) : [book, ...savedBooks];
        const targetShelfId = activeBookshelfId || cloudBookshelves.find((s) => s.is_default)?.id || cloudBookshelves[0]?.id;

        const nextDeleted = { ...deletedBookIds };
        if (exists) {
          nextDeleted[book.id] = new Date().toISOString();
        } else {
          delete nextDeleted[book.id];
        }

        let nextItems = cloudBookshelfItems;
        if (targetShelfId) {
          if (exists) {
            nextItems = cloudBookshelfItems.filter((i) => !(i.book_id === book.id && i.bookshelf_id === targetShelfId));
          } else {
            const insertPayload = toCloudBookInsert(book, currentUserId || '', targetShelfId);
            nextItems = [
              ...cloudBookshelfItems,
              {
                id: `local-${book.id}-${targetShelfId}`,
                bookshelf_id: targetShelfId,
                user_id: currentUserId || '',
                book_id: book.id,
                book_title: book.title,
                book_authors: insertPayload.book_authors,
                cover_url: insertPayload.cover_url,
                created_at: new Date().toISOString(),
                added_at: new Date().toISOString(),
              },
            ];
          }
        }

        set({ savedBooks: nextSaved, cloudBookshelfItems: nextItems, deletedBookIds: nextDeleted });

        // Cloud sync if authenticated
        if (currentUserId && targetShelfId) {
          try {
            const supabase = createClient();
            if (exists) {
              const { error } = await supabase
                .from('bookshelf_items')
                .delete()
                .eq('bookshelf_id', targetShelfId)
                .eq('book_id', book.id);
              if (error) throw error;
            } else {
              const insertPayload = toCloudBookInsert(book, currentUserId, targetShelfId);
              const { error } = await supabase.from('bookshelf_items').insert(insertPayload);
              if (error) throw error;
            }
          } catch {
            // Queue to outbox for offline sync retry
            if (exists) {
              get().queueOutboxAction({
                type: 'DELETE_BOOK',
                payload: { bookshelf_id: targetShelfId, book_id: book.id },
              });
            } else {
              const insertPayload = toCloudBookInsert(book, currentUserId, targetShelfId);
              get().queueOutboxAction({
                type: 'INSERT_BOOK',
                payload: insertPayload,
              });
            }
          }
        }
      },

      isBookSaved: (id) => {
        return get().savedBooks.some((b) => b.id === id);
      },

      clearSavedBooks: () => {
        const { savedBooks, deletedBookIds = {} } = get();
        const now = new Date().toISOString();
        const nextDeleted = { ...deletedBookIds };
        for (const b of savedBooks) {
          nextDeleted[b.id] = now;
        }
        set({ savedBooks: [], deletedBookIds: nextDeleted });
      },

      enrichSavedBooks: async (freshBooks) => {
        const { savedBooks, recentBooks, favoriteBooks = [], cloudBookshelfItems } = get();
        if (
          !freshBooks ||
          freshBooks.length === 0 ||
          (savedBooks.length === 0 && recentBooks.length === 0 && favoriteBooks.length === 0)
        ) {
          return;
        }

        const freshMap = new Map<number, GutendexBook>();
        for (const fb of freshBooks) {
          if (fb && typeof fb.id === 'number') {
            freshMap.set(fb.id, fb);
          }
        }

        const enrichBookItem = (item: GutendexBook, markChanged: () => void): GutendexBook => {
          const fresh = freshMap.get(item.id);
          if (!fresh) return item;

          const itemHasLifespans = Boolean(item.authors?.some((a) => a.birth_year != null || a.death_year != null));
          const freshHasLifespans = Boolean(fresh.authors?.some((a) => a.birth_year != null || a.death_year != null));
          const hasNewLifespans = freshHasLifespans && !itemHasLifespans;
          const hasNewFormats = Boolean(fresh.formats) && Object.keys(fresh.formats).some((key) => !item.formats?.[key]);
          const hasNewTranslators = Boolean(
            fresh.translators &&
              fresh.translators.length > 0 &&
              (!item.translators || item.translators.length === 0)
          );

          if (hasNewLifespans || hasNewFormats || hasNewTranslators) {
            markChanged();
            return {
              ...item,
              authors: hasNewLifespans && fresh.authors ? fresh.authors : item.authors,
              translators: hasNewTranslators && fresh.translators ? fresh.translators : item.translators,
              formats: { ...item.formats, ...fresh.formats },
            };
          }
          return item;
        };

        let hasSavedChanges = false;
        const nextSaved = savedBooks.map((sb) =>
          enrichBookItem(sb, () => {
            hasSavedChanges = true;
          })
        );

        let hasRecentChanges = false;
        const nextRecent = recentBooks.map((rb) =>
          enrichBookItem(rb, () => {
            hasRecentChanges = true;
          })
        );

        let hasFavoriteChanges = false;
        const nextFavorites = favoriteBooks.map((fb) =>
          enrichBookItem(fb, () => {
            hasFavoriteChanges = true;
          })
        );

        if (!hasSavedChanges && !hasRecentChanges && !hasFavoriteChanges) return;

        const nextItems = cloudBookshelfItems.map((item) => {
          const fresh = freshMap.get(item.book_id);
          if (!fresh) return item;
          const payload = toCloudBookInsert(fresh, item.user_id, item.bookshelf_id);
          return {
            ...item,
            book_authors: payload.book_authors,
            cover_url: payload.cover_url || item.cover_url,
          };
        });

        set({
          ...(hasSavedChanges ? { savedBooks: nextSaved } : {}),
          ...(hasRecentChanges ? { recentBooks: nextRecent } : {}),
          ...(hasFavoriteChanges ? { favoriteBooks: nextFavorites } : {}),
          ...(hasSavedChanges ? { cloudBookshelfItems: nextItems } : {}),
        });

        const userId = useAuthStore.getState().user?.id;
        if (userId) {
          try {
            const supabase = createClient();
            const updates = nextItems
              .filter((item) => freshMap.has(item.book_id))
              .map((item) =>
                supabase
                  .from('bookshelf_items')
                  .update({
                    book_authors: item.book_authors,
                    cover_url: item.cover_url,
                  })
                  .eq('id', item.id)
                  .eq('user_id', userId)
              );
            await Promise.allSettled(updates);
          } catch {
            // Non-blocking background persistence
          }
        }
      },

      addToQueue: (book) => {
        const { readingQueue } = get();
        if (!readingQueue.some((b) => b.id === book.id)) {
          set({ readingQueue: [...readingQueue, book] });
        }
      },

      removeFromQueue: (id) => {
        set({ readingQueue: get().readingQueue.filter((b) => b.id !== id) });
      },

      isInQueue: (id) => {
        return get().readingQueue.some((b) => b.id === id);
      },

      toggleFavoriteBook: async (bookOrId, userId) => {
        const currentUserId = userId || useAuthStore.getState().user?.id;
        const { favoriteBookIds, favoriteBooks = [], deletedFavoriteBookIds = {} } = get();
        const isNumeric = typeof bookOrId === 'number';
        const id = isNumeric ? bookOrId : bookOrId.id;
        const exists = favoriteBookIds.includes(id) || favoriteBooks.some((b) => b.id === id);

        const nextDeletedFavorites = { ...deletedFavoriteBookIds };
        if (exists) {
          nextDeletedFavorites[id] = new Date().toISOString();
          set({
            favoriteBookIds: favoriteBookIds.filter((item) => item !== id),
            favoriteBooks: favoriteBooks.filter((b) => b.id !== id),
            deletedFavoriteBookIds: nextDeletedFavorites,
          });
        } else {
          delete nextDeletedFavorites[id];
          const nextFavoriteBooks = isNumeric ? favoriteBooks : [bookOrId, ...favoriteBooks];
          set({
            favoriteBookIds: [...favoriteBookIds, id],
            favoriteBooks: nextFavoriteBooks,
            deletedFavoriteBookIds: nextDeletedFavorites,
          });
        }

        // Cloud sync if authenticated
        if (currentUserId) {
          try {
            const supabase = createClient();
            if (exists) {
              const { error } = await supabase
                .from('user_favorites')
                .delete()
                .eq('user_id', currentUserId)
                .eq('book_id', id);
              if (error) throw error;
            } else if (!isNumeric) {
              const book = bookOrId as GutendexBook;
              const payload = toCloudBookInsert(book, currentUserId);
              const { error } = await supabase.from('user_favorites').upsert(payload);
              if (error) throw error;
            }
          } catch {
            // Queue to outbox for offline sync retry
            if (exists) {
              get().queueOutboxAction({
                type: 'DELETE_FAVORITE',
                payload: { user_id: currentUserId, book_id: id },
              });
            } else if (!isNumeric) {
              const book = bookOrId as GutendexBook;
              get().queueOutboxAction({
                type: 'UPSERT_FAVORITE',
                payload: toCloudBookInsert(book, currentUserId),
              });
            }
          }
        }
      },

      isBookFavorite: (id) => {
        return get().favoriteBookIds.includes(id);
      },

      syncFavoriteBooks: (books) => {
        const { favoriteBooks = [], favoriteBookIds } = get();
        const existingMap = new Map(favoriteBooks.map((b) => [b.id, b]));
        let hasChanges = false;
        const nextFavorites = [...favoriteBooks];

        for (const fresh of books) {
          if (!favoriteBookIds.includes(fresh.id)) continue;
          const existing = existingMap.get(fresh.id);
          if (!existing) {
            nextFavorites.push(fresh);
            hasChanges = true;
          } else {
            const existingHasDates = Boolean(
              existing.authors?.some((a) => a.birth_year != null || a.death_year != null)
            );
            const freshHasDates = Boolean(
              fresh.authors?.some((a) => a.birth_year != null || a.death_year != null)
            );
            if (freshHasDates && !existingHasDates) {
              const idx = nextFavorites.findIndex((b) => b.id === fresh.id);
              if (idx !== -1) {
                nextFavorites[idx] = {
                  ...existing,
                  authors: fresh.authors,
                  translators:
                    fresh.translators && fresh.translators.length > 0
                      ? fresh.translators
                      : existing.translators,
                  formats: { ...existing.formats, ...fresh.formats },
                };
                hasChanges = true;
              }
            }
          }
        }

        if (!hasChanges) return;
        set({ favoriteBooks: nextFavorites });
      },

      clearFavoriteBooks: () => {
        set({
          favoriteBooks: [],
          favoriteBookIds: [],
          deletedFavoriteBookIds: {},
          lastFavoritesSyncAt: new Date().toISOString(),
        });
      },

      addRecentBook: (book) => {
        const { recentBooks } = get();
        const filtered = recentBooks.filter((b) => b.id !== book.id);
        set({ recentBooks: [book, ...filtered].slice(0, 20) });
      },

      clearBookshelf: () => {
        set({
          savedBooks: [],
          readingQueue: [],
          favoriteBooks: [],
          favoriteBookIds: [],
          recentBooks: [],
          bookRatings: {},
          bookStatuses: {},
          curationHistory: {},
          deletedBookIds: {},
          deletedFavoriteBookIds: {},
          lastFavoritesSyncAt: null,
          lastBookshelfSyncAt: null,
          cloudBookshelves: [],
          activeBookshelfId: null,
          isSyncing: false,
        });
      },

      // Curation Actions
      setBookRating: async (bookId: number, rating: number | null, userId?: string) => {
        const currentUserId = userId || useAuthStore.getState().user?.id;
        const clamped = rating === null ? null : Math.min(Math.max(Math.round(rating), 1), 5);
        const now = new Date().toISOString();
        const { bookRatings, curationHistory = {} } = get();

        const nextRatings = { ...bookRatings };
        if (clamped === null) {
          delete nextRatings[bookId];
        } else {
          nextRatings[bookId] = clamped;
        }

        const nextHistory = { ...curationHistory, [bookId]: now };
        set({ bookRatings: nextRatings, curationHistory: nextHistory });

        if (currentUserId) {
          const currentStatus = get().bookStatuses[bookId] || null;
          if (clamped === null && currentStatus === null) {
            try {
              const supabase = createClient();
              const { error } = await supabase
                .from('user_book_curation')
                .delete()
                .eq('user_id', currentUserId)
                .eq('book_id', bookId);
              if (error) throw error;
            } catch {
              get().queueOutboxAction({
                type: 'DELETE_CURATION',
                payload: { user_id: currentUserId, book_id: bookId },
              });
            }
          } else {
            const payload = {
              user_id: currentUserId,
              book_id: bookId,
              rating: clamped,
              reading_status: currentStatus,
              updated_at: now,
            };
            try {
              const supabase = createClient();
              const { error } = await supabase
                .from('user_book_curation')
                .upsert(payload, { onConflict: 'user_id,book_id' });
              if (error) throw error;
            } catch {
              get().queueOutboxAction({
                type: 'UPSERT_CURATION',
                payload,
              });
            }
          }
        }
      },

      setReadingStatus: async (bookId: number, status: ReadingStatus | null, userId?: string) => {
        const currentUserId = userId || useAuthStore.getState().user?.id;
        const now = new Date().toISOString();
        const { bookStatuses, curationHistory = {} } = get();

        const nextStatuses = { ...bookStatuses };
        if (status === null) {
          delete nextStatuses[bookId];
        } else {
          nextStatuses[bookId] = status;
        }

        const nextHistory = { ...curationHistory, [bookId]: now };
        set({ bookStatuses: nextStatuses, curationHistory: nextHistory });

        if (status === 'finished') {
          useReaderStore.getState().setProgress(bookId, 100);
        }

        if (currentUserId) {
          const currentRating = get().bookRatings[bookId] ?? null;
          if (status === null && currentRating === null) {
            try {
              const supabase = createClient();
              const { error } = await supabase
                .from('user_book_curation')
                .delete()
                .eq('user_id', currentUserId)
                .eq('book_id', bookId);
              if (error) throw error;
            } catch {
              get().queueOutboxAction({
                type: 'DELETE_CURATION',
                payload: { user_id: currentUserId, book_id: bookId },
              });
            }
          } else {
            const payload = {
              user_id: currentUserId,
              book_id: bookId,
              rating: currentRating,
              reading_status: status,
              updated_at: now,
            };
            try {
              const supabase = createClient();
              const { error } = await supabase
                .from('user_book_curation')
                .upsert(payload, { onConflict: 'user_id,book_id' });
              if (error) throw error;
            } catch {
              get().queueOutboxAction({
                type: 'UPSERT_CURATION',
                payload,
              });
            }
          }
        }
      },

      getBookRating: (bookId: number) => {
        return get().bookRatings[bookId] ?? null;
      },

      getReadingStatus: (bookId: number) => {
        return get().bookStatuses[bookId] ?? null;
      },

      getBookCuration: (bookId: number) => {
        const { bookRatings, bookStatuses } = get();
        return {
          rating: bookRatings[bookId] ?? null,
          status: bookStatuses[bookId] ?? null,
        };
      },

      // Cloud Actions (delegated to bookshelf-cloud-sync engine)
      syncWithCloud: async (userId: string) => executeBookshelfCloudSync(userId, get, set),
      migrateLocalBooksToCloud: async (userId: string) => executeMigrateLocalBooksToCloud(userId, get, set),
      createCloudBookshelf: async (name: string, userId: string, isPublic = true) =>
        executeCreateCloudBookshelf(name, userId, isPublic, get, set),
      updateCloudBookshelf: async (shelfId: string, name: string, userId: string, isPublic?: boolean) =>
        executeUpdateCloudBookshelf(shelfId, name, userId, isPublic, get, set),
      updateBookshelfPrivacy: async (shelfId: string, isPublic: boolean, userId: string) =>
        executeUpdateBookshelfPrivacy(shelfId, isPublic, userId, get, set),
      deleteCloudBookshelf: async (shelfId: string, userId: string) =>
        executeDeleteCloudBookshelf(shelfId, userId, get, set),
      moveBookToShelf: async (bookId: number, targetShelfId: string, userId: string) =>
        executeMoveBookToShelf(bookId, targetShelfId, userId, get, set),

      setActiveBookshelfId: (id) => {
        set({ activeBookshelfId: id });
      },
    }),
    {
      name: STORAGE_KEYS.BOOKSHELF,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

/**
 * SSR-safe, hydration-guarded hook for accessing bookshelf state without hydration mismatches.
 */
export function useHydratedBookshelf() {
  const hasMounted = useHasMounted();
  const isBookSaved = useBookshelfStore((s) => s.isBookSaved);
  const isBookFavorite = useBookshelfStore((s) => s.isBookFavorite);
  const savedBooks = useBookshelfStore((s) => s.savedBooks);
  const readingQueue = useBookshelfStore((s) => s.readingQueue);
  const favoriteBooks = useBookshelfStore((s) => s.favoriteBooks);
  const favoriteBookIds = useBookshelfStore((s) => s.favoriteBookIds);
  const recentBooks = useBookshelfStore((s) => s.recentBooks);
  const cloudBookshelves = useBookshelfStore((s) => s.cloudBookshelves);
  const cloudBookshelfItems = useBookshelfStore((s) => s.cloudBookshelfItems);
  const activeBookshelfId = useBookshelfStore((s) => s.activeBookshelfId);
  const isSyncing = useBookshelfStore((s) => s.isSyncing);
  const toggleSaveBook = useBookshelfStore((s) => s.toggleSaveBook);
  const toggleFavoriteBook = useBookshelfStore((s) => s.toggleFavoriteBook);
  const addToQueue = useBookshelfStore((s) => s.addToQueue);
  const removeFromQueue = useBookshelfStore((s) => s.removeFromQueue);
  const clearBookshelf = useBookshelfStore((s) => s.clearBookshelf);
  const setBookRating = useBookshelfStore((s) => s.setBookRating);
  const setReadingStatus = useBookshelfStore((s) => s.setReadingStatus);
  const getBookRating = useBookshelfStore((s) => s.getBookRating);
  const getReadingStatus = useBookshelfStore((s) => s.getReadingStatus);
  const getBookCuration = useBookshelfStore((s) => s.getBookCuration);
  const bookRatings = useBookshelfStore((s) => s.bookRatings);
  const bookStatuses = useBookshelfStore((s) => s.bookStatuses);
  const curationHistory = useBookshelfStore((s) => s.curationHistory);
  const syncWithCloud = useBookshelfStore((s) => s.syncWithCloud);
  const createCloudBookshelf = useBookshelfStore((s) => s.createCloudBookshelf);
  const updateCloudBookshelf = useBookshelfStore((s) => s.updateCloudBookshelf);
  const updateBookshelfPrivacy = useBookshelfStore((s) => s.updateBookshelfPrivacy);
  const deleteCloudBookshelf = useBookshelfStore((s) => s.deleteCloudBookshelf);
  const moveBookToShelf = useBookshelfStore((s) => s.moveBookToShelf);
  const setActiveBookshelfId = useBookshelfStore((s) => s.setActiveBookshelfId);
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (hasMounted && user?.id) {
      syncWithCloud(user.id).catch(() => {});
    }
  }, [hasMounted, user?.id, syncWithCloud]);

  return {
    hasMounted,
    isSaved: (id: number) => (hasMounted ? isBookSaved(id) : false),
    isFavorite: (id: number) => (hasMounted ? isBookFavorite(id) : false),
    savedBooks: hasMounted ? savedBooks : [],
    readingQueue: hasMounted ? readingQueue : [],
    favoriteBooks: hasMounted ? favoriteBooks : [],
    favoriteBookIds: hasMounted ? favoriteBookIds : [],
    recentBooks: hasMounted ? recentBooks : [],
    bookRatings: hasMounted ? bookRatings : {},
    bookStatuses: hasMounted ? bookStatuses : {},
    curationHistory: hasMounted ? (curationHistory || {}) : {},
    cloudBookshelves: hasMounted ? cloudBookshelves : [],
    cloudBookshelfItems: hasMounted ? cloudBookshelfItems : [],
    activeBookshelfId: hasMounted ? activeBookshelfId : null,
    isSyncing: hasMounted ? isSyncing : false,
    savedCount: hasMounted ? savedBooks.length : 0,
    favoriteCount: hasMounted ? favoriteBookIds.length : 0,
    queueCount: hasMounted ? readingQueue.length : 0,
    toggleSaveBook,
    toggleFavoriteBook,
    addToQueue,
    removeFromQueue,
    clearBookshelf,
    setBookRating,
    setReadingStatus,
    getBookRating,
    getReadingStatus,
    getBookCuration,
    syncWithCloud,
    createCloudBookshelf,
    updateCloudBookshelf,
    updateBookshelfPrivacy,
    deleteCloudBookshelf,
    moveBookToShelf,
    setActiveBookshelfId,
  };
}

/**
 * Atomic selector hook returning the count of saved books without oversubscribing to other properties.
 */
export function useSavedBooksCount(): number {
  const hasMounted = useHasMounted();
  const count = useBookshelfStore((s) => s.savedBooks.length);
  return hasMounted ? count : 0;
}

/**
 * Atomic selector hook checking if a specific book is saved.
 */
export function useIsBookSaved(bookId: number): boolean {
  const hasMounted = useHasMounted();
  const isSaved = useBookshelfStore((s) => s.isBookSaved(bookId));
  return hasMounted ? isSaved : false;
}

/**
 * Atomic selector hook returning a specific book's 1-5 star rating.
 */
export function useBookRating(bookId: number): number | null {
  const hasMounted = useHasMounted();
  const rating = useBookshelfStore((s) => s.bookRatings[bookId]);
  return hasMounted && rating !== undefined ? rating : null;
}

/**
 * Atomic selector hook returning a specific book's reading status.
 */
export function useReadingStatus(bookId: number): ReadingStatus | null {
  const hasMounted = useHasMounted();
  const status = useBookshelfStore((s) => s.bookStatuses[bookId]);
  return hasMounted && status !== undefined ? status : null;
}

/**
 * Atomic selector hook returning both rating and reading status for a book.
 */
export function useBookCuration(bookId: number): { rating: number | null; status: ReadingStatus | null } {
  const hasMounted = useHasMounted();
  const rating = useBookshelfStore((s) => s.bookRatings[bookId] ?? null);
  const status = useBookshelfStore((s) => s.bookStatuses[bookId] ?? null);
  return {
    rating: hasMounted ? rating : null,
    status: hasMounted ? status : null,
  };
}
