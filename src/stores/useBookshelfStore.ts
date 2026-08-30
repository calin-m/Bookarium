import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GutendexBook } from '@/mocks/handlers';

export interface BookshelfState {
  savedBooks: GutendexBook[];
  readingQueue: GutendexBook[];
  likedBookIds: number[];
  recentBooks: GutendexBook[];

  // Actions
  toggleSaveBook: (book: GutendexBook) => void;
  isBookSaved: (id: number) => boolean;
  addToQueue: (book: GutendexBook) => void;
  removeFromQueue: (id: number) => void;
  isInQueue: (id: number) => boolean;
  toggleLikeBook: (id: number) => void;
  isBookLiked: (id: number) => boolean;
  addRecentBook: (book: GutendexBook) => void;
  clearBookshelf: () => void;
}

export const useBookshelfStore = create<BookshelfState>()(
  persist(
    (set, get) => ({
      savedBooks: [],
      readingQueue: [],
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

      toggleLikeBook: (id) => {
        const { likedBookIds } = get();
        if (likedBookIds.includes(id)) {
          set({ likedBookIds: likedBookIds.filter((item) => item !== id) });
        } else {
          set({ likedBookIds: [...likedBookIds, id] });
        }
      },

      isBookLiked: (id) => {
        return get().likedBookIds.includes(id);
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

