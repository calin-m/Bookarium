/**
 * @module src/stores/useBookshelfStore
 * @scope Personal library state (saved volumes, queue, favorites, custom named shelves, ratings, statuses), tombstone tracking, and offline outbox orchestration.
 * @invariant Preserve authentic contributor lifespans (`isPlaceholderAuthor`) and heal placeholder titles (`isPlaceholderTitle`, `"Volume #<id>"`) during `enrichSavedBooks` and `syncFavoriteBooks`, register the cycle-free in-memory lookup pool (`registerLocalBookPoolResolver`) for Reader cloud sync, sanitize persisted legacy Gutenberg covers to same-origin R2 routes locally (`sanitizeCatalogBookCover`), scrub retired bibliographic fields from persisted `outbox` and `cloudBookshelfItems` entries on rehydration (`sanitizeBookshelfOutboxAction`), and retain IndexedDB `offline_books` whenever a removed book still exists on another shelf, in `favoriteBookIds`, or in active reading progress.
 * @invariant Route all Supabase persistence through `bookshelf-cloud-sync.ts` lean relational outbox queues, tombstone filters (`deletedBookIds`, `deletedFavoriteBookIds`), and `15,000ms` passive mount cooldown invalidation (`invalidateBookshelfSyncCooldown`).
 * @rationale Scoped IndexedDB retention prevents losing downloaded chapters while organizing multiple shelves, outbox + tombstone separation keeps offline edits deterministic across multi-device syncs, and stripping retired metadata columns from persisted outboxes keeps returning offline PWAs 100% compatible.
 * @adr ADR-003, ADR-069, ADR-071, ADR-080, ADR-087
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CatalogBook, ReadingStatus } from '@/types/book.types';
import { useHasMounted } from '@/hooks/useHasMounted';
import { createClient } from '@/lib/supabase/client';
import type { Bookshelf, BookshelfItem } from '@/types/database.types';
import { STORAGE_KEYS } from '@/config/site-config';
import { safeLocalStorage } from '@/lib/safe-storage';
import { useAuthStore } from './useAuthStore';
import { useReaderStore } from './useReaderStore';
import {
  toCloudBookInsert,
  sanitizeCatalogBookCover,
} from '@/lib/adapters/book.adapter';
import { removeOfflineBook } from '@/lib/offline-storage';
import {
  hasAuthenticAuthors,
  hasAuthorLifespans,
  isPlaceholderAuthor,
  isPlaceholderTitle,
} from '@/lib/book-metadata';
import {
  extractBookPositionMetadata,
  hasAuthenticPositionAuthors,
  hasAuthenticPositionTitle,
  registerLocalBookPoolResolver,
} from '@/lib/reader-cloud-sync';

function notifyOfflineUpdated(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('bookarium:offline-updated'));
  }
}
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
  markBookshelfOutboxDirty,
  invalidateBookshelfSyncCooldown,
  sanitizeBookshelfOutboxAction,
  type OutboxActionInput,
  type OutboxAction,
} from '@/lib/bookshelf-cloud-sync';

export { applyDeterministicItemOrdering, type OutboxActionInput, type OutboxAction };

export interface BookshelfState {
  savedBooks: CatalogBook[];
  readingQueue: CatalogBook[];
  favoriteBooks: CatalogBook[];
  favoriteBookIds: number[];
  recentBooks: CatalogBook[];

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
  toggleSaveBook: (book: CatalogBook, userId?: string) => Promise<void>;
  isBookSaved: (id: number) => boolean;
  clearSavedBooks: () => void;
  enrichSavedBooks: (books: CatalogBook[]) => Promise<void>;
  addToQueue: (book: CatalogBook) => void;
  removeFromQueue: (id: number) => void;
  isInQueue: (id: number) => boolean;
  toggleFavoriteBook: (bookOrId: CatalogBook | number, userId?: string) => Promise<void>;
  isBookFavorite: (id: number) => boolean;
  syncFavoriteBooks: (books: CatalogBook[]) => void;
  clearFavoriteBooks: () => void;
  addRecentBook: (book: CatalogBook) => void;
  clearBookshelf: () => void;

  // Curation Actions
  setBookRating: (bookId: number, rating: number | null, userId?: string) => Promise<void>;
  setReadingStatus: (bookId: number, status: ReadingStatus | null, userId?: string) => Promise<void>;
  getBookRating: (bookId: number) => number | null;
  getReadingStatus: (bookId: number) => ReadingStatus | null;
  getBookCuration: (bookId: number) => { rating: number | null; status: ReadingStatus | null };

  // Cloud Actions
  syncWithCloud: (userId: string, options?: { minSyncIntervalMs?: number }) => Promise<void>;
  migrateLocalBooksToCloud: (userId: string) => Promise<void>;
  createCloudBookshelf: (name: string, userId: string, isPublic?: boolean) => Promise<Bookshelf | null>;
  updateCloudBookshelf: (shelfId: string, name: string, userId: string, isPublic?: boolean) => Promise<boolean>;
  updateBookshelfPrivacy: (shelfId: string, isPublic: boolean, userId: string) => Promise<boolean>;
  deleteCloudBookshelf: (shelfId: string, userId: string) => Promise<boolean>;
  moveBookToShelf: (bookId: number, targetShelfId: string, userId: string) => Promise<boolean>;
  clearCustomShelfBooks: (shelfId: string, userId?: string) => Promise<void>;
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
        const payloadUserId =
          'user_id' in action.payload && typeof action.payload.user_id === 'string'
            ? action.payload.user_id
            : undefined;
        markBookshelfOutboxDirty(payloadUserId || useAuthStore.getState().user?.id);
      },

      flushOutbox: async (userId: string) => executeFlushOutbox(userId, get, set),

      toggleSaveBook: async (book, userId) => {
        const currentUserId = userId || useAuthStore.getState().user?.id;
        const {
          savedBooks,
          cloudBookshelves,
          activeBookshelfId,
          cloudBookshelfItems,
          deletedBookIds,
          favoriteBookIds,
        } = get();
        const exists = savedBooks.some((b) => b.id === book.id);
        const effectiveActiveId = activeBookshelfId === '__downloaded__' ? null : activeBookshelfId;
        const targetShelfId =
          effectiveActiveId ||
          cloudBookshelves.find((s) => s.is_default)?.id ||
          cloudBookshelves[0]?.id;

        let nextItems = cloudBookshelfItems;
        if (targetShelfId) {
          if (exists) {
            nextItems = cloudBookshelfItems.filter(
              (i) => !(i.book_id === book.id && i.bookshelf_id === targetShelfId)
            );
          } else {
            nextItems = [
              ...cloudBookshelfItems,
              {
                bookshelf_id: targetShelfId,
                user_id: currentUserId || '',
                book_id: book.id,
                created_at: new Date().toISOString(),
              },
            ];
          }
        }

        const sanitizedBook = sanitizeCatalogBookCover(book);
        const remainsOnAnotherShelf = nextItems.some((i) => i.book_id === book.id);
        const nextSaved = exists
          ? remainsOnAnotherShelf
            ? savedBooks
            : savedBooks.filter((b) => b.id !== book.id)
          : [sanitizedBook, ...savedBooks];

        const nextDeleted = { ...deletedBookIds };
        if (exists && !remainsOnAnotherShelf) {
          nextDeleted[book.id] = new Date().toISOString();
        } else if (!exists) {
          delete nextDeleted[book.id];
        }

        set({ savedBooks: nextSaved, cloudBookshelfItems: nextItems, deletedBookIds: nextDeleted });

        if (exists && !remainsOnAnotherShelf) {
          const isFav = favoriteBookIds.includes(book.id);
          const hasActiveProgress = (useReaderStore.getState().readingProgress[book.id] ?? 0) > 0;
          if (!isFav && !hasActiveProgress) {
            Promise.resolve(removeOfflineBook?.(book.id))
              .then(() => notifyOfflineUpdated())
              .catch(() => {});
          }
        }

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
        const { savedBooks, deletedBookIds } = get();
        const removedIds = savedBooks.map((b) => b.id);
        const now = new Date().toISOString();
        const nextDeleted = { ...deletedBookIds };
        for (const b of savedBooks) {
          nextDeleted[b.id] = now;
        }
        set({ savedBooks: [], deletedBookIds: nextDeleted });
        if (removedIds.length > 0) {
          Promise.all(removedIds.map((id) => Promise.resolve(removeOfflineBook?.(id))))
            .then(() => notifyOfflineUpdated())
            .catch(() => {});
        }
      },

      clearCustomShelfBooks: async (shelfId: string, userId?: string) => {
        const currentUserId = userId || useAuthStore.getState().user?.id;
        const { savedBooks, cloudBookshelfItems, deletedBookIds, favoriteBookIds } = get();
        const shelfBookIds = new Set(
          cloudBookshelfItems
            .filter((item) => item.bookshelf_id === shelfId)
            .map((item) => item.book_id)
        );
        if (shelfBookIds.size === 0) return;

        const nextItems = cloudBookshelfItems.filter((item) => item.bookshelf_id !== shelfId);
        const remainingShelfBookIds = new Set(nextItems.map((item) => item.book_id));
        const nextSaved = savedBooks.filter(
          (b) => !shelfBookIds.has(b.id) || remainingShelfBookIds.has(b.id)
        );
        const nextDeleted = { ...deletedBookIds };
        const now = new Date().toISOString();
        shelfBookIds.forEach((id) => {
          if (!remainingShelfBookIds.has(id)) {
            nextDeleted[id] = now;
          }
        });

        set({ savedBooks: nextSaved, cloudBookshelfItems: nextItems, deletedBookIds: nextDeleted });

        const readingProgress = useReaderStore.getState().readingProgress;
        shelfBookIds.forEach((id) => {
          if (
            !remainingShelfBookIds.has(id) &&
            !favoriteBookIds.includes(id) &&
            !(readingProgress[id] > 0)
          ) {
            Promise.resolve(removeOfflineBook?.(id))
              .then(() => notifyOfflineUpdated())
              .catch(() => {});
          }
        });

        if (currentUserId) {
          try {
            const supabase = createClient();
            await supabase
              .from('bookshelf_items')
              .delete()
              .eq('bookshelf_id', shelfId)
              .eq('user_id', currentUserId);
          } catch {
            // Non-blocking fallback
          }
        }
      },

      enrichSavedBooks: async (freshBooks) => {
        const { savedBooks, recentBooks, favoriteBooks } = get();
        if (
          !freshBooks ||
          freshBooks.length === 0 ||
          (savedBooks.length === 0 && recentBooks.length === 0 && favoriteBooks.length === 0)
        ) {
          return;
        }

        const freshMap = new Map<number, CatalogBook>();
        for (const fb of freshBooks) {
          if (fb && typeof fb.id === 'number') {
            freshMap.set(fb.id, fb);
          }
        }

        const enrichBookItem = (item: CatalogBook, markChanged: () => void): CatalogBook => {
          const sanitizedExisting = sanitizeCatalogBookCover(item);
          const hasNormalizedCover = sanitizedExisting !== item;
          const fresh = freshMap.get(item.id);
          if (!fresh) {
            if (hasNormalizedCover) {
              markChanged();
              return sanitizedExisting;
            }
            return item;
          }

          const sanitizedFresh = sanitizeCatalogBookCover(fresh);
          const hasNewTitle =
            isPlaceholderTitle(sanitizedExisting.title) &&
            !isPlaceholderTitle(sanitizedFresh.title);
          const itemHasLifespans = Boolean(item.authors?.some((a) => a.birth_year != null || a.death_year != null));
          const freshHasLifespans = Boolean(sanitizedFresh.authors?.some((a) => a.birth_year != null || a.death_year != null));
          const itemHasAuthors = Boolean(item.authors?.some((a) => a.name && !isPlaceholderAuthor(a.name)));
          const freshHasAuthors = Boolean(sanitizedFresh.authors?.some((a) => a.name && !isPlaceholderAuthor(a.name)));
          const hasNewLifespans = freshHasLifespans && !itemHasLifespans;
          const hasNewAuthors = !itemHasAuthors && freshHasAuthors;
          const hasNewFormats =
            Boolean(sanitizedFresh.formats) &&
            Object.keys(sanitizedFresh.formats).some((key) => !sanitizedExisting.formats?.[key]);
          const hasNewTranslators = Boolean(
            sanitizedFresh.translators &&
              sanitizedFresh.translators.length > 0 &&
              (!item.translators || item.translators.length === 0)
          );
          const hasNewSubjects =
            (!item.subjects || item.subjects.length === 0) &&
            Boolean(sanitizedFresh.subjects && sanitizedFresh.subjects.length > 0);

          if (
            hasNormalizedCover ||
            hasNewTitle ||
            hasNewLifespans ||
            hasNewAuthors ||
            hasNewFormats ||
            hasNewTranslators ||
            hasNewSubjects
          ) {
            markChanged();
            return {
              ...sanitizedExisting,
              title: hasNewTitle ? sanitizedFresh.title : sanitizedExisting.title,
              authors: (hasNewLifespans || hasNewAuthors) && sanitizedFresh.authors ? sanitizedFresh.authors : sanitizedExisting.authors,
              translators: hasNewTranslators && sanitizedFresh.translators ? sanitizedFresh.translators : sanitizedExisting.translators,
              subjects: hasNewSubjects && sanitizedFresh.subjects ? sanitizedFresh.subjects : sanitizedExisting.subjects,
              bookshelves:
                (!sanitizedExisting.bookshelves || sanitizedExisting.bookshelves.length === 0) && sanitizedFresh.bookshelves
                  ? sanitizedFresh.bookshelves
                  : sanitizedExisting.bookshelves,
              languages:
                (!sanitizedExisting.languages || sanitizedExisting.languages.length === 0) && sanitizedFresh.languages
                  ? sanitizedFresh.languages
                  : sanitizedExisting.languages,
              download_count: sanitizedExisting.download_count || sanitizedFresh.download_count || 0,
              formats: { ...sanitizedExisting.formats, ...sanitizedFresh.formats },
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

        if (!hasSavedChanges && !hasRecentChanges && !hasFavoriteChanges) {
          return;
        }

        set({
          ...(hasSavedChanges ? { savedBooks: nextSaved } : {}),
          ...(hasRecentChanges ? { recentBooks: nextRecent } : {}),
          ...(hasFavoriteChanges ? { favoriteBooks: nextFavorites } : {}),
        });
      },

      addToQueue: (book) => {
        const { readingQueue } = get();
        if (!readingQueue.some((b) => b.id === book.id)) {
          set({ readingQueue: [...readingQueue, sanitizeCatalogBookCover(book)] });
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
        const { favoriteBookIds, favoriteBooks, deletedFavoriteBookIds } = get();
        const isNumeric = typeof bookOrId === 'number';
        const id = isNumeric ? bookOrId : bookOrId.id;
        const exists = favoriteBookIds.includes(id) || favoriteBooks.some((b) => b.id === id);
        const sanitizedFavorite = !isNumeric ? sanitizeCatalogBookCover(bookOrId) : null;

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
          const nextFavoriteBooks = sanitizedFavorite ? [sanitizedFavorite, ...favoriteBooks] : favoriteBooks;
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
            } else if (sanitizedFavorite) {
              const payload = toCloudBookInsert(sanitizedFavorite, currentUserId);
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
            } else if (sanitizedFavorite) {
              get().queueOutboxAction({
                type: 'UPSERT_FAVORITE',
                payload: toCloudBookInsert(sanitizedFavorite, currentUserId),
              });
            }
          }
        }
      },

      isBookFavorite: (id) => {
        return get().favoriteBookIds.includes(id);
      },

      syncFavoriteBooks: (books) => {
        const { favoriteBooks, favoriteBookIds } = get();
        const existingMap = new Map(favoriteBooks.map((b) => [b.id, b]));
        let hasChanges = false;
        const nextFavorites = [...favoriteBooks];

        for (const fresh of books) {
          if (!favoriteBookIds.includes(fresh.id)) continue;
          const sanitizedFresh = sanitizeCatalogBookCover(fresh);
          const existing = existingMap.get(sanitizedFresh.id);
          if (!existing) {
            nextFavorites.push(sanitizedFresh);
            hasChanges = true;
          } else {
            const sanitizedExisting = sanitizeCatalogBookCover(existing);
            const coverNormalized = sanitizedExisting !== existing;
            const hasNewTitle =
              isPlaceholderTitle(sanitizedExisting.title) &&
              !isPlaceholderTitle(sanitizedFresh.title);
            const existingHasDates = Boolean(
              sanitizedExisting.authors?.some((a) => a.birth_year != null || a.death_year != null)
            );
            const freshHasDates = Boolean(
              sanitizedFresh.authors?.some((a) => a.birth_year != null || a.death_year != null)
            );
            const hasNewAuthors =
              !hasAuthenticAuthors(sanitizedExisting.authors) &&
              hasAuthenticAuthors(sanitizedFresh.authors);
            if (hasNewTitle || hasNewAuthors || (freshHasDates && !existingHasDates) || coverNormalized) {
              const idx = nextFavorites.findIndex((b) => b.id === sanitizedFresh.id);
              if (idx !== -1) {
                nextFavorites[idx] = {
                  ...sanitizedExisting,
                  title: hasNewTitle ? sanitizedFresh.title : sanitizedExisting.title,
                  authors:
                    (freshHasDates && !existingHasDates) || hasNewAuthors
                      ? sanitizedFresh.authors
                      : sanitizedExisting.authors,
                  translators:
                    sanitizedFresh.translators && sanitizedFresh.translators.length > 0
                      ? sanitizedFresh.translators
                      : sanitizedExisting.translators,
                  formats: { ...sanitizedExisting.formats, ...sanitizedFresh.formats },
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
        const sanitizedBook = sanitizeCatalogBookCover(book);
        const filtered = recentBooks.filter((b) => b.id !== sanitizedBook.id);
        set({ recentBooks: [sanitizedBook, ...filtered].slice(0, 20) });
      },

      clearBookshelf: () => {
        invalidateBookshelfSyncCooldown();
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
          cloudBookshelfItems: [],
          activeBookshelfId: null,
          isSyncing: false,
          outbox: [],
        });
      },

      // Curation Actions
      setBookRating: async (bookId: number, rating: number | null, userId?: string) => {
        const currentUserId = userId || useAuthStore.getState().user?.id;
        const clamped = rating === null ? null : Math.min(Math.max(Math.round(rating), 1), 5);
        const now = new Date().toISOString();
        const { bookRatings, curationHistory } = get();

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
        const { bookStatuses, curationHistory } = get();

        const nextStatuses = { ...bookStatuses };
        if (status === null) {
          delete nextStatuses[bookId];
        } else {
          nextStatuses[bookId] = status;
        }

        const nextHistory = { ...curationHistory, [bookId]: now };
        set({ bookStatuses: nextStatuses, curationHistory: nextHistory });

        if (status === 'finished') {
          const readerState = useReaderStore.getState();
          readerState.setProgress(bookId, 100);
          const currentPos = readerState.readingPositions[bookId];
          if (
            currentPos &&
            (currentPos.bookmarkRow !== undefined || Boolean(currentPos.bookmarkText))
          ) {
            const localFallbackBook =
              get().savedBooks.find((b) => b.id === bookId) ||
              get().favoriteBooks.find((b) => b.id === bookId) ||
              get().recentBooks.find((b) => b.id === bookId);
            const fallbackMeta = localFallbackBook
              ? extractBookPositionMetadata(bookId, localFallbackBook)
              : {};
            const resolvedTitle = hasAuthenticPositionTitle(currentPos.bookTitle)
              ? currentPos.bookTitle
              : fallbackMeta.bookTitle || currentPos.bookTitle;
            const resolvedAuthors = hasAuthenticPositionAuthors(currentPos.bookAuthors)
              ? currentPos.bookAuthors
              : fallbackMeta.bookAuthors || currentPos.bookAuthors;
            const resolvedCoverUrl = currentPos.coverUrl || fallbackMeta.coverUrl;
            readerState.saveReadingPosition(
              bookId,
              {
                chapterIndex: currentPos.chapterIndex,
                chapterPage: currentPos.chapterPage,
                globalPage: currentPos.globalPage,
                lastReadAt: now,
                bookTitle: resolvedTitle,
                bookAuthors: resolvedAuthors,
                coverUrl: resolvedCoverUrl,
              },
              currentUserId
            );
          }
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
      syncWithCloud: async (userId: string, options?: { minSyncIntervalMs?: number }) =>
        executeBookshelfCloudSync(userId, get, set, options),
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
      storage: createJSONStorage(() => safeLocalStorage),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const sanitizePool = (list: CatalogBook[] | undefined) => {
          if (!Array.isArray(list) || list.length === 0) return { next: list, changed: false };
          let changed = false;
          const next = list.map((b) => {
            const clean = sanitizeCatalogBookCover(b);
            if (clean !== b) changed = true;
            return clean;
          });
          return { next: changed ? next : list, changed };
        };
        const savedRes = sanitizePool(state.savedBooks);
        const favRes = sanitizePool(state.favoriteBooks);
        const recentRes = sanitizePool(state.recentBooks);
        const queueRes = sanitizePool(state.readingQueue);
        let cloudChanged = false;
        const nextCloud = Array.isArray(state.cloudBookshelfItems)
          ? state.cloudBookshelfItems.map((item) => {
              const raw = item as unknown as Record<string, unknown>;
              if (
                'id' in raw ||
                'book_title' in raw ||
                'book_authors' in raw ||
                'cover_url' in raw ||
                'added_at' in raw
              ) {
                cloudChanged = true;
                return {
                  bookshelf_id: item.bookshelf_id,
                  user_id: item.user_id,
                  book_id: item.book_id,
                  created_at:
                    item.created_at ||
                    (typeof raw.added_at === 'string' ? raw.added_at : new Date().toISOString()),
                };
              }
              return item;
            })
          : state.cloudBookshelfItems;
        let outboxChanged = false;
        const nextOutbox = Array.isArray(state.outbox)
          ? state.outbox.map((action) => {
              const clean = sanitizeBookshelfOutboxAction(action);
              if (clean !== action) outboxChanged = true;
              return clean;
            })
          : state.outbox;
        if (savedRes.changed && savedRes.next) state.savedBooks = savedRes.next;
        if (favRes.changed && favRes.next) state.favoriteBooks = favRes.next;
        if (recentRes.changed && recentRes.next) state.recentBooks = recentRes.next;
        if (queueRes.changed && queueRes.next) state.readingQueue = queueRes.next;
        if (cloudChanged && nextCloud) state.cloudBookshelfItems = nextCloud;
        if (outboxChanged && nextOutbox) state.outbox = nextOutbox;
      },
    }
  )
);

registerLocalBookPoolResolver((bookId: number) => {
  const { savedBooks, favoriteBooks, recentBooks } = useBookshelfStore.getState();
  const candidates = [
    savedBooks.find((b) => b.id === bookId),
    favoriteBooks.find((b) => b.id === bookId),
    recentBooks.find((b) => b.id === bookId),
  ].filter(
    (b): b is CatalogBook =>
      Boolean(b && !isPlaceholderTitle(b.title) && hasAuthenticAuthors(b.authors))
  );
  if (candidates.length === 0) return undefined;
  return candidates.find((b) => hasAuthorLifespans(b.authors)) || candidates[0];
});

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

  const hydratedState = hasMounted
    ? {
        isSaved: isBookSaved,
        isFavorite: isBookFavorite,
        savedBooks,
        readingQueue,
        favoriteBooks,
        favoriteBookIds,
        recentBooks,
        bookRatings,
        bookStatuses,
        curationHistory,
        cloudBookshelves,
        cloudBookshelfItems,
        activeBookshelfId,
        isSyncing,
        savedCount: savedBooks.length,
        favoriteCount: favoriteBookIds.length,
        queueCount: readingQueue.length,
      }
    : {
        isSaved: () => false,
        isFavorite: () => false,
        savedBooks: [] as CatalogBook[],
        readingQueue: [] as CatalogBook[],
        favoriteBooks: [] as CatalogBook[],
        favoriteBookIds: [] as number[],
        recentBooks: [] as CatalogBook[],
        bookRatings: {} as Record<number, number>,
        bookStatuses: {} as Record<number, ReadingStatus>,
        curationHistory: {} as Record<number, string>,
        cloudBookshelves: [] as Bookshelf[],
        cloudBookshelfItems: [] as BookshelfItem[],
        activeBookshelfId: null as string | null,
        isSyncing: false,
        savedCount: 0,
        favoriteCount: 0,
        queueCount: 0,
      };

  return {
    hasMounted,
    ...hydratedState,
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
  const isSaved = useBookshelfStore((s) => s.savedBooks.some((b) => b.id === bookId));
  return hasMounted ? isSaved : false;
}

/**
 * Atomic selector hook checking if a specific book is in the user's favorites.
 */
export function useIsBookFavorite(bookId: number): boolean {
  const hasMounted = useHasMounted();
  const isFavorite = useBookshelfStore((s) => s.favoriteBookIds.includes(bookId));
  return hasMounted ? isFavorite : false;
}

/**
 * Atomic selector hook returning SSR-safe saved and favorite counts without subscribing to full arrays.
 */
export function useHydratedBookshelfCounts(): {
  hasMounted: boolean;
  savedCount: number;
  favoriteCount: number;
} {
  const hasMounted = useHasMounted();
  const savedCount = useBookshelfStore((s) => s.savedBooks.length);
  const favoriteCount = useBookshelfStore((s) => s.favoriteBookIds.length);
  return {
    hasMounted,
    savedCount: hasMounted ? savedCount : 0,
    favoriteCount: hasMounted ? favoriteCount : 0,
  };
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
