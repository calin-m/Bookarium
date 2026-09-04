import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GutendexBook, ReadingStatus } from '@/types/book.types';
import { useHasMounted } from '@/hooks/useHasMounted';
import { createClient } from '@/lib/supabase/client';
import type { Bookshelf, BookshelfItem } from '@/types/database.types';
import { STORAGE_KEYS } from '@/config/site-config';
import { useAuthStore } from './useAuthStore';

export interface OutboxAction {
  id: string;
  type: 'DELETE_BOOK' | 'INSERT_BOOK' | 'DELETE_FAVORITE' | 'UPSERT_FAVORITE' | 'UPSERT_CURATION' | 'DELETE_CURATION';
  payload: any;
  timestamp: string;
}

export interface BookshelfState {
  savedBooks: GutendexBook[];
  readingQueue: GutendexBook[];
  likedBooks: GutendexBook[];
  likedBookIds: number[];
  recentBooks: GutendexBook[];

  // Personal Curation State (1-5 Star Ratings & Reading Statuses)
  bookRatings: Record<number, number>;
  bookStatuses: Record<number, ReadingStatus>;

  // Cloud State
  cloudBookshelves: Bookshelf[];
  cloudBookshelfItems: BookshelfItem[];
  activeBookshelfId: string | null;
  isSyncing: boolean;
  outbox: OutboxAction[];

  // Outbox Actions
  queueOutboxAction: (action: Omit<OutboxAction, 'id' | 'timestamp'>) => void;
  flushOutbox: (userId: string) => Promise<void>;

  // Actions
  toggleSaveBook: (book: GutendexBook, userId?: string) => Promise<void>;
  isBookSaved: (id: number) => boolean;
  clearSavedBooks: () => void;
  addToQueue: (book: GutendexBook) => void;
  removeFromQueue: (id: number) => void;
  isInQueue: (id: number) => boolean;
  toggleLikeBook: (bookOrId: GutendexBook | number, userId?: string) => Promise<void>;
  isBookLiked: (id: number) => boolean;
  syncLikedBooks: (books: GutendexBook[]) => void;
  clearLikedBooks: () => void;
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
  createCloudBookshelf: (name: string, userId: string) => Promise<Bookshelf | null>;
  updateCloudBookshelf: (shelfId: string, name: string, userId: string) => Promise<boolean>;
  deleteCloudBookshelf: (shelfId: string, userId: string) => Promise<boolean>;
  moveBookToShelf: (bookId: number, targetShelfId: string, userId: string) => Promise<boolean>;
  setActiveBookshelfId: (id: string | null) => void;
}


export const useBookshelfStore = create<BookshelfState>()(
  persist(
    (set, get) => ({
      savedBooks: [],
      readingQueue: [],
      likedBooks: [],
      likedBookIds: [],
      recentBooks: [],
      bookRatings: {},
      bookStatuses: {},
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

      flushOutbox: async (userId: string) => {
        const { outbox } = get();
        if (outbox.length === 0 || !userId) return;

        const supabase = createClient();
        const remaining: OutboxAction[] = [];

        for (const action of outbox) {
          try {
            if (action.type === 'DELETE_BOOK') {
              const { error } = await supabase
                .from('bookshelf_items')
                .delete()
                .eq('bookshelf_id', action.payload.bookshelf_id)
                .eq('book_id', action.payload.book_id);
              if (error) throw error;
            } else if (action.type === 'DELETE_FAVORITE') {
              const { error } = await supabase
                .from('user_favorites')
                .delete()
                .eq('user_id', action.payload.user_id)
                .eq('book_id', action.payload.book_id);
              if (error) throw error;
            } else if (action.type === 'INSERT_BOOK') {
              const { error } = await supabase
                .from('bookshelf_items')
                .upsert(action.payload, { onConflict: 'bookshelf_id,book_id' });
              if (error) throw error;
            } else if (action.type === 'UPSERT_FAVORITE') {
              const { error } = await supabase
                .from('user_favorites')
                .upsert(action.payload, { onConflict: 'user_id,book_id' });
              if (error) throw error;
            } else if (action.type === 'UPSERT_CURATION') {
              const { error } = await supabase
                .from('user_book_curation')
                .upsert(action.payload, { onConflict: 'user_id,book_id' });
              if (error) throw error;
            } else if (action.type === 'DELETE_CURATION') {
              const { error } = await supabase
                .from('user_book_curation')
                .delete()
                .eq('user_id', action.payload.user_id)
                .eq('book_id', action.payload.book_id);
              if (error) throw error;
            }
          } catch {
            remaining.push(action);
          }
        }
        set({ outbox: remaining });
      },

      toggleSaveBook: async (book, userId) => {
        const currentUserId = userId || useAuthStore.getState().user?.id;
        const { savedBooks, cloudBookshelves, activeBookshelfId, cloudBookshelfItems } = get();
        const exists = savedBooks.some((b) => b.id === book.id);
        const nextSaved = exists ? savedBooks.filter((b) => b.id !== book.id) : [book, ...savedBooks];
        const targetShelfId = activeBookshelfId || cloudBookshelves.find((s) => s.is_default)?.id || cloudBookshelves[0]?.id;

        let nextItems = cloudBookshelfItems;
        if (targetShelfId) {
          if (exists) {
            nextItems = cloudBookshelfItems.filter((i) => !(i.book_id === book.id && i.bookshelf_id === targetShelfId));
          } else {
            nextItems = [
              ...cloudBookshelfItems,
              {
                id: `local-${book.id}-${targetShelfId}`,
                bookshelf_id: targetShelfId,
                user_id: currentUserId || '',
                book_id: book.id,
                book_title: book.title,
                book_authors: book.authors?.map((a) => a.name) || [],
                cover_url: book.formats?.['image/jpeg'] || null,
                added_at: new Date().toISOString(),
              },
            ];
          }
        }

        set({ savedBooks: nextSaved, cloudBookshelfItems: nextItems });

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
              const { error } = await supabase.from('bookshelf_items').insert({
                bookshelf_id: targetShelfId,
                user_id: currentUserId,
                book_id: book.id,
                book_title: book.title,
                book_authors: book.authors?.map((a) => a.name) || [],
                cover_url: book.formats?.['image/jpeg'] || null,
              });
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
              get().queueOutboxAction({
                type: 'INSERT_BOOK',
                payload: {
                  bookshelf_id: targetShelfId,
                  user_id: currentUserId,
                  book_id: book.id,
                  book_title: book.title,
                  book_authors: book.authors?.map((a) => a.name) || [],
                  cover_url: book.formats?.['image/jpeg'] || null,
                },
              });
            }
          }
        }
      },

      isBookSaved: (id) => {
        return get().savedBooks.some((b) => b.id === id);
      },

      clearSavedBooks: () => {
        set({ savedBooks: [] });
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

      toggleLikeBook: async (bookOrId, userId) => {
        const currentUserId = userId || useAuthStore.getState().user?.id;
        const { likedBookIds, likedBooks = [] } = get();
        const isNumeric = typeof bookOrId === 'number';
        const id = isNumeric ? bookOrId : bookOrId.id;
        const exists = likedBookIds.includes(id) || likedBooks.some((b) => b.id === id);

        if (exists) {
          set({
            likedBookIds: likedBookIds.filter((item) => item !== id),
            likedBooks: likedBooks.filter((b) => b.id !== id),
          });
        } else {
          const nextLikedBooks = isNumeric ? likedBooks : [bookOrId, ...likedBooks];
          set({
            likedBookIds: [...likedBookIds, id],
            likedBooks: nextLikedBooks,
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
              const { error } = await supabase.from('user_favorites').upsert({
                user_id: currentUserId,
                book_id: book.id,
                book_title: book.title,
                book_authors: book.authors?.map((a) => a.name) || [],
                cover_url: book.formats?.['image/jpeg'] || null,
              });
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
                payload: {
                  user_id: currentUserId,
                  book_id: book.id,
                  book_title: book.title,
                  book_authors: book.authors?.map((a) => a.name) || [],
                  cover_url: book.formats?.['image/jpeg'] || null,
                },
              });
            }
          }
        }
      },

      isBookLiked: (id) => {
        return get().likedBookIds.includes(id);
      },

      syncLikedBooks: (books) => {
        const { likedBooks = [], likedBookIds } = get();
        const existingIds = new Set(likedBooks.map((b) => b.id));
        const newBooks = books.filter((b) => likedBookIds.includes(b.id) && !existingIds.has(b.id));
        if (newBooks.length === 0) return;
        set({ likedBooks: [...likedBooks, ...newBooks] });
      },

      clearLikedBooks: () => {
        set({ likedBooks: [], likedBookIds: [] });
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
          likedBooks: [],
          likedBookIds: [],
          recentBooks: [],
          bookRatings: {},
          bookStatuses: {},
          cloudBookshelves: [],
          activeBookshelfId: null,
          isSyncing: false,
        });
      },

      // Curation Actions
      setBookRating: async (bookId: number, rating: number | null, userId?: string) => {
        const currentUserId = userId || useAuthStore.getState().user?.id;
        const clamped = rating === null ? null : Math.min(Math.max(Math.round(rating), 1), 5);
        const { bookRatings, bookStatuses } = get();

        const nextRatings = { ...bookRatings };
        if (clamped === null) {
          delete nextRatings[bookId];
        } else {
          nextRatings[bookId] = clamped;
        }
        set({ bookRatings: nextRatings });

        if (currentUserId) {
          const currentStatus = bookStatuses[bookId] || null;
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
              updated_at: new Date().toISOString(),
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
        const { bookStatuses, bookRatings } = get();

        const nextStatuses = { ...bookStatuses };
        if (status === null) {
          delete nextStatuses[bookId];
        } else {
          nextStatuses[bookId] = status;
        }
        set({ bookStatuses: nextStatuses });

        if (currentUserId) {
          const currentRating = bookRatings[bookId] ?? null;
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
              updated_at: new Date().toISOString(),
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


      // Cloud Actions
      syncWithCloud: async (userId: string) => {
        if (!userId) return;
        set({ isSyncing: true });

        // Flush any pending offline mutations first
        await get().flushOutbox(userId);

        try {
          const supabase = createClient();

          // 1. Fetch user shelves
          const { data: shelves } = await supabase
            .from('bookshelves')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

          let currentDefaultShelf: Bookshelf | undefined;

          if (shelves && shelves.length > 0) {
            const uniqueMap = new Map<string, Bookshelf>();
            for (const s of shelves as Bookshelf[]) {
              if (!uniqueMap.has(s.id)) {
                uniqueMap.set(s.id, s);
              }
            }
            const dedupedShelves = Array.from(uniqueMap.values());
            set({ cloudBookshelves: dedupedShelves });
            currentDefaultShelf = dedupedShelves.find((s) => s.is_default) || dedupedShelves[0];
            set({ activeBookshelfId: currentDefaultShelf.id });

            // 2. Fetch items for shelves
            const { data: items } = await supabase
              .from('bookshelf_items')
              .select('*')
              .eq('user_id', userId);

            set({
              cloudBookshelves: dedupedShelves,
              cloudBookshelfItems: (items || []) as BookshelfItem[],
            });

            const reconstructedBooks: GutendexBook[] = (items || []).map((item: BookshelfItem) => ({
              id: item.book_id,
              title: item.book_title,
              authors: (item.book_authors || []).map((name) => ({ name, birth_year: null, death_year: null })),
              translators: [],
              subjects: [],
              bookshelves: [],
              languages: ['en'],
              copyright: false,
              media_type: 'Text',
              formats: {
                ...(item.cover_url ? { 'image/jpeg': item.cover_url } : {}),
                'application/epub+zip': `https://www.gutenberg.org/ebooks/${item.book_id}.epub3.images`,
                'text/html': `https://www.gutenberg.org/ebooks/${item.book_id}.html.images`,
                'text/plain; charset=utf-8': `https://www.gutenberg.org/ebooks/${item.book_id}.txt.utf-8`,
                'application/x-mobipocket-ebook': `https://www.gutenberg.org/ebooks/${item.book_id}.kindle.images`,
              } as Record<string, string>,
              download_count: 1000,
            }));

            // Merge unique books
            const localSaved = get().savedBooks;
            const merged = [...reconstructedBooks];
            const unSyncedLocalBooks: GutendexBook[] = [];

            for (const lb of localSaved) {
              if (!merged.some((b) => b.id === lb.id)) {
                merged.push(lb);
                unSyncedLocalBooks.push(lb);
              }
            }
            set({ savedBooks: merged });

            // Bidirectional Sync: push local books missing from cloud to the database
            if (unSyncedLocalBooks.length > 0 && currentDefaultShelf?.id) {
              const inserts = unSyncedLocalBooks.map((b) => ({
                bookshelf_id: currentDefaultShelf!.id,
                user_id: userId,
                book_id: b.id,
                book_title: b.title,
                book_authors: b.authors?.map((a) => a.name) || [],
                cover_url: b.formats?.['image/jpeg'] || null,
              }));

              await supabase.from('bookshelf_items').upsert(inserts, {
                onConflict: 'bookshelf_id,book_id',
              });

              const { data: updatedItems } = await supabase
                .from('bookshelf_items')
                .select('*')
                .eq('user_id', userId);
              if (updatedItems) {
                set({ cloudBookshelfItems: updatedItems as BookshelfItem[] });
              }
            }
          } else {
            // Create default 'General' shelf for user
            const { data: newDefault } = await supabase
              .from('bookshelves')
              .insert({
                user_id: userId,
                name: 'General',
                is_default: true,
              })
              .select()
              .single();

            if (newDefault) {
              currentDefaultShelf = newDefault as Bookshelf;
              set({
                cloudBookshelves: [currentDefaultShelf],
                activeBookshelfId: currentDefaultShelf.id,
                cloudBookshelfItems: [],
              });

              const localSaved = get().savedBooks;
              if (localSaved.length > 0) {
                const inserts = localSaved.map((b) => ({
                  bookshelf_id: currentDefaultShelf!.id,
                  user_id: userId,
                  book_id: b.id,
                  book_title: b.title,
                  book_authors: b.authors?.map((a) => a.name) || [],
                  cover_url: b.formats?.['image/jpeg'] || null,
                }));

                await supabase.from('bookshelf_items').upsert(inserts, {
                  onConflict: 'bookshelf_id,book_id',
                });

                const { data: updatedItems } = await supabase
                  .from('bookshelf_items')
                  .select('*')
                  .eq('user_id', userId);
                if (updatedItems) {
                  set({ cloudBookshelfItems: updatedItems as BookshelfItem[] });
                }
              }
            }
          }

          // 3. Fetch user favorites
          const { data: favorites } = await supabase
            .from('user_favorites')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          const reconstructedFavorites: GutendexBook[] = (favorites || []).map((item) => ({
            id: item.book_id,
            title: item.book_title,
            authors: (item.book_authors || []).map((name: string) => ({ name, birth_year: null, death_year: null })),
            translators: [],
            subjects: [],
            bookshelves: [],
            languages: ['en'],
            copyright: false,
            media_type: 'Text',
            formats: {
              ...(item.cover_url ? { 'image/jpeg': item.cover_url } : {}),
              'application/epub+zip': `https://www.gutenberg.org/ebooks/${item.book_id}.epub3.images`,
              'text/html': `https://www.gutenberg.org/ebooks/${item.book_id}.html.images`,
              'text/plain; charset=utf-8': `https://www.gutenberg.org/ebooks/${item.book_id}.txt.utf-8`,
              'application/x-mobipocket-ebook': `https://www.gutenberg.org/ebooks/${item.book_id}.kindle.images`,
            } as Record<string, string>,
            download_count: 1000,
          }));

          // Merge unique favorites
          const localLiked = get().likedBooks || [];
          const mergedLiked = [...reconstructedFavorites];
          const unSyncedFavorites: GutendexBook[] = [];

          for (const lb of localLiked) {
            if (!mergedLiked.some((b) => b.id === lb.id)) {
              mergedLiked.push(lb);
              unSyncedFavorites.push(lb);
            }
          }
          const mergedLikedIds = Array.from(new Set([...mergedLiked.map((b) => b.id), ...get().likedBookIds]));
          set({ likedBooks: mergedLiked, likedBookIds: mergedLikedIds });

          // Bidirectional Sync: push local favorites missing from cloud to the database
          if (unSyncedFavorites.length > 0) {
            const favoriteInserts = unSyncedFavorites.map((b) => ({
              user_id: userId,
              book_id: b.id,
              book_title: b.title,
              book_authors: b.authors?.map((a) => a.name) || [],
              cover_url: b.formats?.['image/jpeg'] || null,
            }));

            await supabase.from('user_favorites').upsert(favoriteInserts, {
              onConflict: 'user_id,book_id',
            });
          }

          // 4. Fetch user curation (ratings & statuses)
          const { data: curations } = await supabase
            .from('user_book_curation')
            .select('*')
            .eq('user_id', userId);

          const remoteRatings: Record<number, number> = {};
          const remoteStatuses: Record<number, ReadingStatus> = {};

          for (const item of (curations || [])) {
            if (item.rating !== null && item.rating !== undefined) {
              remoteRatings[item.book_id] = item.rating;
            }
            if (item.reading_status) {
              remoteStatuses[item.book_id] = item.reading_status as ReadingStatus;
            }
          }

          // Merge: remote takes precedence, but preserve local guest ratings/statuses that don't exist remotely
          const localRatings = get().bookRatings || {};
          const localStatuses = get().bookStatuses || {};

          const mergedRatings = { ...localRatings, ...remoteRatings };
          const mergedStatuses = { ...localStatuses, ...remoteStatuses };

          set({ bookRatings: mergedRatings, bookStatuses: mergedStatuses });

          // Bidirectional Sync: push local guest curations missing from cloud to the database
          const unSyncedCurations: Array<{
            user_id: string;
            book_id: number;
            rating: number | null;
            reading_status: ReadingStatus | null;
            updated_at: string;
          }> = [];

          const allCurationBookIds = Array.from(new Set([...Object.keys(localRatings), ...Object.keys(localStatuses)]).values()).map(Number);
          for (const bId of allCurationBookIds) {
            const hasRemote = curations?.some((c: any) => c.book_id === bId);
            if (!hasRemote) {
              unSyncedCurations.push({
                user_id: userId,
                book_id: bId,
                rating: localRatings[bId] ?? null,
                reading_status: localStatuses[bId] ?? null,
                updated_at: new Date().toISOString(),
              });
            }
          }

          if (unSyncedCurations.length > 0) {
            await supabase.from('user_book_curation').upsert(unSyncedCurations, {
              onConflict: 'user_id,book_id',
            });
          }
        } catch {
          // Graceful offline fallback
        } finally {
          set({ isSyncing: false });
        }
      },

      migrateLocalBooksToCloud: async (userId: string) => {
        const { savedBooks, likedBooks = [], cloudBookshelves } = get();
        if (!userId) return;

        try {
          const supabase = createClient();

          // 1. Migrate saved books
          if (savedBooks.length > 0) {
            const targetShelfId = cloudBookshelves.find((s) => s.is_default)?.id || cloudBookshelves[0]?.id;
            if (targetShelfId) {
              const inserts = savedBooks.map((b) => ({
                bookshelf_id: targetShelfId,
                user_id: userId,
                book_id: b.id,
                book_title: b.title,
                book_authors: b.authors?.map((a) => a.name) || [],
                cover_url: b.formats?.['image/jpeg'] || null,
              }));

              await supabase.from('bookshelf_items').upsert(inserts, {
                onConflict: 'bookshelf_id,book_id',
              });
            }
          }

          // 2. Migrate liked books / favorites
          if (likedBooks.length > 0) {
            const favoriteInserts = likedBooks.map((b) => ({
              user_id: userId,
              book_id: b.id,
              book_title: b.title,
              book_authors: b.authors?.map((a) => a.name) || [],
              cover_url: b.formats?.['image/jpeg'] || null,
            }));

            await supabase.from('user_favorites').upsert(favoriteInserts, {
              onConflict: 'user_id,book_id',
            });
          }
        } catch {
          // Non-blocking fallback
        }
      },

      createCloudBookshelf: async (name: string, userId: string) => {
        const trimmed = name.trim();
        if (!trimmed || !userId || trimmed.toLowerCase() === 'general') return null;

        try {
          const supabase = createClient();
          const { data, error } = await supabase
            .from('bookshelves')
            .insert({
              user_id: userId,
              name: name.trim(),
              is_default: false,
            })
            .select()
            .single();

          if (!error && data) {
            const newShelf = data as Bookshelf;
            set({
              cloudBookshelves: [...get().cloudBookshelves, newShelf],
              activeBookshelfId: newShelf.id,
            });
            return newShelf;
          }
        } catch {
          // Non-blocking fallback
        }
        return null;
      },

      updateCloudBookshelf: async (shelfId: string, name: string, userId: string) => {
        if (!shelfId || !name.trim() || !userId) return false;

        try {
          const supabase = createClient();
          const { error } = await supabase
            .from('bookshelves')
            .update({ name: name.trim() })
            .eq('id', shelfId)
            .eq('user_id', userId);

          if (!error) {
            set({
              cloudBookshelves: get().cloudBookshelves.map((s) =>
                s.id === shelfId ? { ...s, name: name.trim() } : s
              ),
            });
            return true;
          }
        } catch {
          // Non-blocking fallback
        }
        return false;
      },

      deleteCloudBookshelf: async (shelfId: string, userId: string) => {
        if (!shelfId || !userId) return false;

        try {
          const supabase = createClient();
          const nextShelves = get().cloudBookshelves.filter((s) => s.id !== shelfId);
          const defaultShelf = nextShelves.find((s) => s.is_default) || nextShelves[0];

          // 1. Auto-reassign books on deleted shelf to default shelf so books are never lost
          if (defaultShelf) {
            await supabase
              .from('bookshelf_items')
              .update({ bookshelf_id: defaultShelf.id })
              .eq('bookshelf_id', shelfId)
              .eq('user_id', userId);
          } else {
            await supabase
              .from('bookshelf_items')
              .delete()
              .eq('bookshelf_id', shelfId)
              .eq('user_id', userId);
          }

          // 2. Delete the custom shelf
          const { error } = await supabase
            .from('bookshelves')
            .delete()
            .eq('id', shelfId)
            .eq('user_id', userId);

          if (!error) {
            set({
              cloudBookshelves: nextShelves,
              activeBookshelfId: defaultShelf?.id || null,
              cloudBookshelfItems: get().cloudBookshelfItems.map((item) =>
                item.bookshelf_id === shelfId && defaultShelf
                  ? { ...item, bookshelf_id: defaultShelf.id }
                  : item
              ),
            });
            return true;
          }
        } catch {
          // Non-blocking fallback
        }
        return false;
      },

      moveBookToShelf: async (bookId: number, targetShelfId: string, userId: string) => {
        if (!bookId || !targetShelfId) return false;

        const { cloudBookshelfItems, savedBooks } = get();
        const existingItem = cloudBookshelfItems.find((i) => i.book_id === bookId);
        const bookObj = savedBooks.find((b) => b.id === bookId);

        let nextItems: BookshelfItem[];
        if (existingItem) {
          nextItems = cloudBookshelfItems.map((item) =>
            item.book_id === bookId ? { ...item, bookshelf_id: targetShelfId } : item
          );
        } else {
          nextItems = [
            ...cloudBookshelfItems,
            {
              id: `item-${bookId}-${targetShelfId}`,
              bookshelf_id: targetShelfId,
              user_id: userId || '',
              book_id: bookId,
              book_title: bookObj?.title || '',
              book_authors: bookObj?.authors?.map((a) => a.name) || [],
              cover_url: bookObj?.formats?.['image/jpeg'] || null,
              added_at: new Date().toISOString(),
            },
          ];
        }

        // Instant local update
        set({ cloudBookshelfItems: nextItems });

        if (userId) {
          try {
            const supabase = createClient();
            const { error } = await supabase
              .from('bookshelf_items')
              .update({ bookshelf_id: targetShelfId })
              .eq('book_id', bookId)
              .eq('user_id', userId);

            if (error) {
              await supabase.from('bookshelf_items').insert({
                bookshelf_id: targetShelfId,
                user_id: userId,
                book_id: bookId,
                book_title: bookObj?.title || '',
                book_authors: bookObj?.authors?.map((a) => a.name) || [],
                cover_url: bookObj?.formats?.['image/jpeg'] || null,
              });
            }
          } catch {
            // Non-blocking fallback
          }
        }
        return true;
      },

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
  const isBookLiked = useBookshelfStore((s) => s.isBookLiked);
  const savedBooks = useBookshelfStore((s) => s.savedBooks);
  const readingQueue = useBookshelfStore((s) => s.readingQueue);
  const likedBooks = useBookshelfStore((s) => s.likedBooks);
  const likedBookIds = useBookshelfStore((s) => s.likedBookIds);
  const recentBooks = useBookshelfStore((s) => s.recentBooks);
  const cloudBookshelves = useBookshelfStore((s) => s.cloudBookshelves);
  const cloudBookshelfItems = useBookshelfStore((s) => s.cloudBookshelfItems);
  const activeBookshelfId = useBookshelfStore((s) => s.activeBookshelfId);
  const isSyncing = useBookshelfStore((s) => s.isSyncing);
  const toggleSaveBook = useBookshelfStore((s) => s.toggleSaveBook);
  const toggleLikeBook = useBookshelfStore((s) => s.toggleLikeBook);
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
  const syncWithCloud = useBookshelfStore((s) => s.syncWithCloud);
  const createCloudBookshelf = useBookshelfStore((s) => s.createCloudBookshelf);
  const updateCloudBookshelf = useBookshelfStore((s) => s.updateCloudBookshelf);
  const deleteCloudBookshelf = useBookshelfStore((s) => s.deleteCloudBookshelf);
  const moveBookToShelf = useBookshelfStore((s) => s.moveBookToShelf);
  const setActiveBookshelfId = useBookshelfStore((s) => s.setActiveBookshelfId);

  return {
    hasMounted,
    isSaved: (id: number) => (hasMounted ? isBookSaved(id) : false),
    isLiked: (id: number) => (hasMounted ? isBookLiked(id) : false),
    savedBooks: hasMounted ? savedBooks : [],
    readingQueue: hasMounted ? readingQueue : [],
    likedBooks: hasMounted ? likedBooks : [],
    likedBookIds: hasMounted ? likedBookIds : [],
    recentBooks: hasMounted ? recentBooks : [],
    bookRatings: hasMounted ? bookRatings : {},
    bookStatuses: hasMounted ? bookStatuses : {},
    cloudBookshelves: hasMounted ? cloudBookshelves : [],
    cloudBookshelfItems: hasMounted ? cloudBookshelfItems : [],
    activeBookshelfId: hasMounted ? activeBookshelfId : null,
    isSyncing: hasMounted ? isSyncing : false,
    savedCount: hasMounted ? savedBooks.length : 0,
    likedCount: hasMounted ? likedBookIds.length : 0,
    queueCount: hasMounted ? readingQueue.length : 0,
    toggleSaveBook,
    toggleLikeBook,
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