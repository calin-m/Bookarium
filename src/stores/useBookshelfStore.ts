import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GutendexBook } from '@/mocks/handlers';
import { useHasMounted } from '@/hooks/useHasMounted';
import { createClient } from '@/lib/supabase/client';
import type { Bookshelf, BookshelfItem } from '@/types/database.types';
import { STORAGE_KEYS } from '@/config/site-config';

export interface BookshelfState {
  savedBooks: GutendexBook[];
  readingQueue: GutendexBook[];
  likedBooks: GutendexBook[];
  likedBookIds: number[];
  recentBooks: GutendexBook[];

  // Cloud State
  cloudBookshelves: Bookshelf[];
  cloudBookshelfItems: BookshelfItem[];
  activeBookshelfId: string | null;
  isSyncing: boolean;

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
      cloudBookshelves: [],
      cloudBookshelfItems: [],
      activeBookshelfId: null,
      isSyncing: false,

      toggleSaveBook: async (book, userId) => {
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
                user_id: userId || '',
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
        if (userId && targetShelfId) {
          try {
            const supabase = createClient();
            if (exists) {
              await supabase
                .from('bookshelf_items')
                .delete()
                .eq('bookshelf_id', targetShelfId)
                .eq('book_id', book.id);
            } else {
              await supabase.from('bookshelf_items').insert({
                bookshelf_id: targetShelfId,
                user_id: userId,
                book_id: book.id,
                book_title: book.title,
                book_authors: book.authors?.map((a) => a.name) || [],
                cover_url: book.formats?.['image/jpeg'] || null,
              });
            }
          } catch {
            // Non-blocking offline fallback
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

        // If user is authenticated, we could mirror to default  Favorites shelf
        if (userId && !isNumeric) {
          const book = bookOrId as GutendexBook;
          get().toggleSaveBook(book, userId);
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
          cloudBookshelves: [],
          activeBookshelfId: null,
          isSyncing: false,
        });
      },

      // Cloud Actions
      syncWithCloud: async (userId: string) => {
        if (!userId) return;
        set({ isSyncing: true });

        try {
          const supabase = createClient();

          // 1. Fetch user shelves
          const { data: shelves } = await supabase
            .from('bookshelves')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

          if (shelves && shelves.length > 0) {
            set({ cloudBookshelves: shelves as Bookshelf[] });
            const defaultShelf = shelves.find((s) => s.is_default) || shelves[0];
            set({ activeBookshelfId: defaultShelf.id });

            // 2. Fetch items for shelves
            const { data: items } = await supabase
              .from('bookshelf_items')
              .select('*')
              .eq('user_id', userId);

            set({
              cloudBookshelves: shelves as Bookshelf[],
              cloudBookshelfItems: (items || []) as BookshelfItem[],
            });

            if (items && items.length > 0) {
              const reconstructedBooks: GutendexBook[] = items.map((item: BookshelfItem) => ({
                id: item.book_id,
                title: item.book_title,
                authors: (item.book_authors || []).map((name) => ({ name, birth_year: null, death_year: null })),
                translators: [],
                subjects: [],
                bookshelves: [],
                languages: ['en'],
                copyright: false,
                media_type: 'Text',
                formats: (item.cover_url ? { 'image/jpeg': item.cover_url } : {}) as Record<string, string>,
                download_count: 1000,
              }));

              // Merge unique books
              const localSaved = get().savedBooks;
              const merged = [...reconstructedBooks];
              for (const lb of localSaved) {
                if (!merged.some((b) => b.id === lb.id)) {
                  merged.push(lb);
                }
              }
              set({ savedBooks: merged });
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
              set({
                cloudBookshelves: [newDefault as Bookshelf],
                activeBookshelfId: newDefault.id,
                cloudBookshelfItems: [],
              });
            }
          }
        } catch {
          // Graceful offline fallback
        } finally {
          set({ isSyncing: false });
        }
      },

      migrateLocalBooksToCloud: async (userId: string) => {
        const { savedBooks, cloudBookshelves } = get();
        if (!userId || savedBooks.length === 0) return;

        try {
          const supabase = createClient();
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
        } catch {
          // Non-blocking fallback
        }
      },

      createCloudBookshelf: async (name: string, userId: string) => {
        if (!name.trim() || !userId) return null;

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