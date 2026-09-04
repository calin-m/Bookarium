import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { useReaderStore } from './useReaderStore';
import { useAuthStore } from './useAuthStore';
import { mockBooks } from '@/mocks/handlers';

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

describe('useReaderStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    useAuthStore.setState({ user: null, profile: null });
    useReaderStore.setState({
      currentBook: null,
      isOpen: false,
      fontSize: 18,
      lineHeight: 1.75,
      fontFamily: 'serif',
      theme: 'light',
      readingProgress: {},
      readingPositions: {},
    });
  });

  it('should initialize with default reader settings', () => {
    const state = useReaderStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.currentBook).toBeNull();
    expect(state.fontSize).toBe(18);
    expect(state.lineHeight).toBe(1.75);
    expect(state.fontFamily).toBe('serif');
    expect(state.theme).toBe('light');
  });

  it('should open and close reader modal with book', () => {
    const book = mockBooks[0];
    useReaderStore.getState().openReader(book);

    expect(useReaderStore.getState().isOpen).toBe(true);
    expect(useReaderStore.getState().currentBook?.title).toBe('Pride and Prejudice');

    useReaderStore.getState().closeReader();
    expect(useReaderStore.getState().isOpen).toBe(false);
  });

  it('should clamp font size between 12 and 36', () => {
    useReaderStore.getState().setFontSize(10);
    expect(useReaderStore.getState().fontSize).toBe(12);

    useReaderStore.getState().setFontSize(40);
    expect(useReaderStore.getState().fontSize).toBe(36);

    useReaderStore.getState().setFontSize(22);
    expect(useReaderStore.getState().fontSize).toBe(22);
  });

  it('should clamp line height between 1.2 and 2.6', () => {
    useReaderStore.getState().setLineHeight(0.8);
    expect(useReaderStore.getState().lineHeight).toBe(1.2);

    useReaderStore.getState().setLineHeight(3.0);
    expect(useReaderStore.getState().lineHeight).toBe(2.6);

    useReaderStore.getState().setLineHeight(1.8);
    expect(useReaderStore.getState().lineHeight).toBe(1.8);
  });

  it('should update theme and font family', () => {
    useReaderStore.getState().setTheme('sepia');
    expect(useReaderStore.getState().theme).toBe('sepia');

    useReaderStore.getState().setFontFamily('mono');
    expect(useReaderStore.getState().fontFamily).toBe('mono');
  });

  it('should record and retrieve reading progress percentage', () => {
    const bookId = 1342;
    expect(useReaderStore.getState().getProgress(bookId)).toBe(0);

    useReaderStore.getState().setProgress(bookId, 45);
    expect(useReaderStore.getState().getProgress(bookId)).toBe(45);

    useReaderStore.getState().setProgress(bookId, 1);
    expect(useReaderStore.getState().getProgress(bookId)).toBe(1);

    // clamping
    useReaderStore.getState().setProgress(bookId, 150);
    expect(useReaderStore.getState().getProgress(bookId)).toBe(100);

    // rounding
    useReaderStore.getState().setProgress(bookId, 0.578034);
    expect(useReaderStore.getState().getProgress(bookId)).toBe(1);
  });

  it('should save, retrieve, and clear exact reading positions', () => {
    const bookId = 1342;
    expect(useReaderStore.getState().getReadingPosition(bookId)).toBeNull();

    const position = {
      chapterIndex: 2,
      chapterPage: 4,
      globalPage: 12,
      lastReadAt: new Date().toISOString(),
    };

    useReaderStore.getState().saveReadingPosition(bookId, position);
    expect(useReaderStore.getState().getReadingPosition(bookId)).toEqual(position);

    useReaderStore.getState().clearReadingPosition(bookId);
    expect(useReaderStore.getState().getReadingPosition(bookId)).toBeNull();
  });

  it('should toggle and set isMobileTrayOpen', () => {
    expect(useReaderStore.getState().isMobileTrayOpen).toBe(false);

    useReaderStore.getState().toggleMobileTray();
    expect(useReaderStore.getState().isMobileTrayOpen).toBe(true);

    useReaderStore.getState().setMobileTrayOpen(false);
    expect(useReaderStore.getState().isMobileTrayOpen).toBe(false);

    useReaderStore.getState().setMobileTrayOpen(true);
    expect(useReaderStore.getState().isMobileTrayOpen).toBe(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Cloud Reading Progress Sync', () => {
    it('does not invoke Supabase in guest mode (Zero Auth / Zero Key)', () => {
      const bookId = 84;
      const position = {
        chapterIndex: 1,
        chapterPage: 2,
        globalPage: 5,
        lastReadAt: new Date().toISOString(),
      };

      useReaderStore.getState().saveReadingPosition(bookId, position);
      vi.advanceTimersByTime(3000);

      expect(mockFrom).not.toHaveBeenCalled();
      expect(useReaderStore.getState().getReadingPosition(bookId)).toEqual(position);
    });

    it('debounces cloud upsert by 2000ms when authenticated', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ upsert: mockUpsert });

      useAuthStore.setState({
        user: { id: 'test-user-123', email: 'reader@example.com' } as any,
      });

      const bookId = 84;
      const pos1 = {
        chapterIndex: 1,
        chapterPage: 1,
        globalPage: 1,
        lastReadAt: new Date().toISOString(),
      };
      const pos2 = {
        chapterIndex: 1,
        chapterPage: 2,
        globalPage: 2,
        lastReadAt: new Date().toISOString(),
      };

      useReaderStore.getState().setProgress(bookId, 25);
      useReaderStore.getState().saveReadingPosition(bookId, pos1);
      vi.advanceTimersByTime(500);

      // Fast flipping: next page within 500ms should cancel previous timer
      useReaderStore.getState().saveReadingPosition(bookId, pos2);
      expect(mockUpsert).not.toHaveBeenCalled();

      // Complete 2000ms debounce
      vi.advanceTimersByTime(2000);

      expect(mockFrom).toHaveBeenCalledWith('reading_progress');
      expect(mockUpsert).toHaveBeenCalledTimes(1);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'test-user-123',
          book_id: 84,
          current_chapter_index: 1,
          progress_percent: 25,
          scroll_offset: 2,
        }),
        { onConflict: 'user_id,book_id' }
      );
    });

    it('restores reading position and progress from cloud', async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: {
          current_chapter_index: 3,
          progress_percent: 60,
          scroll_offset: 4,
          last_read_at: '2026-09-04T12:00:00.000Z',
          book_title: 'Frankenstein',
          book_authors: ['Mary Wollstonecraft Shelley'],
          cover_url: 'https://example.com/frankenstein.jpg',
        },
        error: null,
      });

      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: mockMaybeSingle,
            }),
          }),
        }),
      });

      const restored = await useReaderStore
        .getState()
        .restoreReadingPositionFromCloud(84, 'test-user-123');

      expect(restored).toEqual({
        chapterIndex: 3,
        chapterPage: 4,
        globalPage: 4,
        lastReadAt: '2026-09-04T12:00:00.000Z',
        bookTitle: 'Frankenstein',
        bookAuthors: ['Mary Wollstonecraft Shelley'],
        coverUrl: 'https://example.com/frankenstein.jpg',
      });
      expect(useReaderStore.getState().getReadingPosition(84)).toEqual(restored);
      expect(useReaderStore.getState().getProgress(84)).toBe(60);
    });

    it('enriches cloud upsert with book metadata from currentBook', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ upsert: mockUpsert });

      useAuthStore.setState({
        user: { id: 'test-user-123', email: 'reader@example.com' } as any,
      });

      const book = mockBooks[0]; // Pride and Prejudice (id: 1342)
      useReaderStore.getState().openReader(book);

      const pos = {
        chapterIndex: 0,
        chapterPage: 1,
        globalPage: 1,
        lastReadAt: new Date().toISOString(),
      };

      useReaderStore.getState().setProgress(1342, 10);
      useReaderStore.getState().saveReadingPosition(1342, pos);

      vi.advanceTimersByTime(2000);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'test-user-123',
          book_id: 1342,
          book_title: 'Pride and Prejudice',
          book_authors: ['Austen, Jane'],
          cover_url: 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
          progress_percent: 10,
        }),
        { onConflict: 'user_id,book_id' }
      );
    });

    it('bulk synchronizes all user reading progress via syncWithCloud', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [
                {
                  book_id: 1342,
                  book_title: 'Pride and Prejudice',
                  book_authors: ['Jane Austen'],
                  cover_url: 'https://example.com/pride.jpg',
                  current_chapter_index: 5,
                  progress_percent: 50,
                  scroll_offset: 2,
                  last_read_at: '2026-09-04T10:00:00.000Z',
                },
                {
                  book_id: 84,
                  book_title: 'Frankenstein',
                  book_authors: ['Mary Shelley'],
                  cover_url: null,
                  current_chapter_index: 2,
                  progress_percent: 20,
                  scroll_offset: 1,
                  last_read_at: '2026-09-03T10:00:00.000Z',
                },
              ],
              error: null,
            }),
        }),
      });

      mockFrom.mockReturnValue({ select: mockSelect });

      await useReaderStore.getState().syncWithCloud('test-user-123');

      expect(mockFrom).toHaveBeenCalledWith('reading_progress');
      const pos1342 = useReaderStore.getState().getReadingPosition(1342);
      expect(pos1342?.bookTitle).toBe('Pride and Prejudice');
      expect(pos1342?.chapterIndex).toBe(5);
      expect(useReaderStore.getState().getProgress(1342)).toBe(50);

      const pos84 = useReaderStore.getState().getReadingPosition(84);
      expect(pos84?.bookTitle).toBe('Frankenstein');
      expect(useReaderStore.getState().getProgress(84)).toBe(20);
    });

    it('deletes from Supabase when clearReadingPosition is invoked while authenticated', async () => {
      const mockEqBook = vi.fn().mockResolvedValue({ error: null });
      const mockEqUser = vi.fn().mockReturnValue({ eq: mockEqBook });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEqUser });
      mockFrom.mockReturnValue({ delete: mockDelete });

      useAuthStore.setState({
        user: { id: 'test-user-123' } as any,
      });

      useReaderStore.setState({
        readingPositions: {
          1342: {
            chapterIndex: 1,
            chapterPage: 1,
            globalPage: 1,
            lastReadAt: new Date().toISOString(),
          },
        },
        readingProgress: { 1342: 30 },
      });

      await useReaderStore.getState().clearReadingPosition(1342);

      expect(useReaderStore.getState().getReadingPosition(1342)).toBeNull();
      expect(mockFrom).toHaveBeenCalledWith('reading_progress');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEqUser).toHaveBeenCalledWith('user_id', 'test-user-123');
      expect(mockEqBook).toHaveBeenCalledWith('book_id', 1342);
    });

    it('deletes all user records from Supabase on clearAllVolumes while authenticated', async () => {
      const mockEqUser = vi.fn().mockResolvedValue({ error: null });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEqUser });
      mockFrom.mockReturnValue({ delete: mockDelete });

      useAuthStore.setState({
        user: { id: 'test-user-123' } as any,
      });

      useReaderStore.setState({
        readingPositions: {
          1342: { chapterIndex: 1, chapterPage: 1, globalPage: 1, lastReadAt: '2026-09-01' },
          84: { chapterIndex: 2, chapterPage: 2, globalPage: 2, lastReadAt: '2026-09-02' },
        },
        readingProgress: { 1342: 30, 84: 50 },
      });

      await useReaderStore.getState().clearAllVolumes();

      expect(useReaderStore.getState().readingPositions).toEqual({});
      expect(useReaderStore.getState().readingProgress).toEqual({});
      expect(mockFrom).toHaveBeenCalledWith('reading_progress');
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEqUser).toHaveBeenCalledWith('user_id', 'test-user-123');
    });
  });
});

