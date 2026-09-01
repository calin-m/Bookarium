import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GutendexBook } from '@/mocks/handlers';
import { useThemeStore, applyThemeToDocument } from './useThemeStore';
import { STORAGE_KEYS } from '@/config/site-config';

export type ReaderTheme = 'light' | 'dark' | 'sepia';
export type ReaderFontFamily = 'serif' | 'sans' | 'mono';

export interface BookReadingPosition {
  chapterIndex: number;
  chapterPage: number;
  globalPage: number;
  lastReadAt: string;
}

export interface ReaderState {
  currentBook: GutendexBook | null;
  isOpen: boolean;
  fontSize: number;
  lineHeight: number;
  fontFamily: ReaderFontFamily;
  theme: ReaderTheme;
  readingProgress: Record<number, number>;
  readingPositions: Record<number, BookReadingPosition>;

  // Actions
  openReader: (book: GutendexBook) => void;
  closeReader: () => void;
  setFontSize: (size: number) => void;
  setLineHeight: (height: number) => void;
  setFontFamily: (family: ReaderFontFamily) => void;
  setTheme: (theme: ReaderTheme) => void;
  setProgress: (bookId: number, progress: number) => void;
  getProgress: (bookId: number) => number;
  saveReadingPosition: (bookId: number, position: BookReadingPosition) => void;
  getReadingPosition: (bookId: number) => BookReadingPosition | null;
  clearReadingPosition: (bookId: number) => void;
}

export const useReaderStore = create<ReaderState>()(
  persist(
    (set, get) => ({
      currentBook: null,
      isOpen: false,
      fontSize: 18,
      lineHeight: 1.75,
      fontFamily: 'serif',
      theme: 'light',
      readingProgress: {},
      readingPositions: {},

      openReader: (book) => {
        set({ currentBook: book, isOpen: true });
      },

      closeReader: () => {
        set({ isOpen: false });
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
        const clamped = Math.min(Math.max(progress, 0), 100);
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

      saveReadingPosition: (bookId, position) => {
        set((state) => ({
          readingPositions: {
            ...state.readingPositions,
            [bookId]: position,
          },
        }));
      },

      getReadingPosition: (bookId) => {
        return get().readingPositions[bookId] ?? null;
      },

      clearReadingPosition: (bookId) => {
        set((state) => {
          const next = { ...state.readingPositions };
          delete next[bookId];
          return { readingPositions: next };
        });
      },
    }),
    {
      name: STORAGE_KEYS.READER_SETTINGS,
      storage: createJSONStorage(() => localStorage),
    }
  )
);

