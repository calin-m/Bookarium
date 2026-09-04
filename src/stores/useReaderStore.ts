import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { GutendexBook, Book } from '@/types/book.types';
import { useThemeStore, applyThemeToDocument } from './useThemeStore';
import { useAuthStore } from './useAuthStore';
import { createClient } from '@/lib/supabase/client';
import { STORAGE_KEYS } from '@/config/site-config';
import { READER_FONT_CONFIG } from '@/config/reader-config';

export type ReaderTheme = 'light' | 'dark' | 'sepia';
export type ReaderFontFamily = 'serif' | 'sans' | 'mono';

export interface BookReadingPosition {
  chapterIndex: number;
  chapterPage: number;
  globalPage: number;
  lastReadAt: string;
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
  getReadingPosition: (bookId: number) => BookReadingPosition | null;
  clearReadingPosition: (bookId: number) => void;
  syncReadingPositionToCloud: (bookId: number, position: BookReadingPosition, userId: string) => Promise<void>;
  restoreReadingPositionFromCloud: (bookId: number, userId: string) => Promise<BookReadingPosition | null>;
}

const progressDebounceTimers = new Map<number, ReturnType<typeof setTimeout>>();

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
      isMobileTrayOpen: false,

      openReader: (book) => {
        set({ currentBook: book, isOpen: true });
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
        set((state) => ({
          readingPositions: {
            ...state.readingPositions,
            [bookId]: position,
          },
        }));

        const currentUserId = userId || useAuthStore.getState().user?.id;
        if (!currentUserId) return;

        const existingTimer = progressDebounceTimers.get(bookId);
        if (existingTimer) {
          clearTimeout(existingTimer);
        }

        const timer = setTimeout(() => {
          progressDebounceTimers.delete(bookId);
          get().syncReadingPositionToCloud(bookId, position, currentUserId);
        }, 2000);

        progressDebounceTimers.set(bookId, timer);
      },

      syncReadingPositionToCloud: async (bookId, position, userId) => {
        if (!userId || !bookId) return;
        try {
          const supabase = createClient();
          const progress = get().readingProgress[bookId] ?? 0;
          await supabase.from('reading_progress').upsert(
            {
              user_id: userId,
              book_id: bookId,
              current_chapter_index: position.chapterIndex,
              progress_percent: progress,
              scroll_offset: position.chapterPage,
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
            const remotePosition: BookReadingPosition = {
              chapterIndex: data.current_chapter_index ?? 0,
              chapterPage: Number(data.scroll_offset) || 1,
              globalPage: Number(data.scroll_offset) || 1,
              lastReadAt: data.last_read_at || new Date().toISOString(),
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

      getReadingPosition: (bookId) => {
        return get().readingPositions[bookId] ?? null;
      },

      clearReadingPosition: (bookId) => {
        const timer = progressDebounceTimers.get(bookId);
        if (timer) {
          clearTimeout(timer);
          progressDebounceTimers.delete(bookId);
        }
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

