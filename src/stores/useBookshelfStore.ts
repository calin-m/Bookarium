import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GutendexBook } from '@/mocks/handlers';

export interface BookshelfState {
  savedBooks: GutendexBook[];
  readingQueue: GutendexBook[];
  likedBooks: GutendexBook[];
  likedBookIds: number[];
  recentBooks: GutendexBook[];

  // Actions
  toggleSaveBook: (book: GutendexBook) => void;
  isBookSaved: (id: number) => boolean;
  clearSavedBooks: () => void;
  addToQueue: (book: GutendexBook) => void;
  removeFromQueue: (id: number) => void;
  isInQueue: (id: number) => boolean;
  toggleLikeBook: (bookOrId: GutendexBook | number) => void;
  isBookLiked: (id: number) => boolean;
  syncLikedBooks: (books: GutendexBook[]) => void;
  clearLikedBooks: () => void;
  addRecentBook: (book: GutendexBook) => void;
  clearBookshelf: () => void;
}

export const useBookshelfStore = create<BookshelfState>()(
  persist(
    (set, get) => ({
      savedBooks: [],
      readingQueue: [],
      likedBooks: [],
      likedBookIds: [],
      recentBooks: [],

      toggleSaveBook: (book) => {
        const { savedBooks } = get();
        const exists = savedBooks.some((b) => b.id === book.id);
        if (exists) {
          set({ savedBooks: savedBooks.filter((b) => b.id !== book.id) });
        } else {
          set({ savedBooks: [book, ...savedBooks] });
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

      toggleLikeBook: (bookOrId) => {
        const { likedBookIds, likedBooks = [] } = get();
        const isNumeric = typeof bookOrId === 'number';
        const id = isNumeric ? bookOrId : bookOrId.id;

        if (likedBookIds.includes(id) || likedBooks.some((b) => b.id === id)) {
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
        });
      },
    }),
    {
      name: 'bookarium-bookshelf-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

