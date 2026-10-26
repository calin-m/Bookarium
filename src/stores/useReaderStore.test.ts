import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReaderStore, getActiveReadingCount, useHydratedReader } from './useReaderStore';
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
          book_authors: ['Austen, Jane, 1775-1817'],
          cover_url: 'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg',
          progress_percent: 10,
        }),
        { onConflict: 'user_id,book_id' }
      );
    });

    it('upgrades stored readingPositions with author lifespans via enrichReadingPositions', () => {
      useReaderStore.setState({
        readingPositions: {
          1342: {
            chapterIndex: 2,
            chapterPage: 3,
            globalPage: 15,
            lastReadAt: '2026-09-01T10:00:00.000Z',
            bookTitle: 'Pride and Prejudice',
            bookAuthors: ['Austen, Jane'],
          },
        },
      });

      useReaderStore.getState().enrichReadingPositions([mockBooks[0]]);

      const enriched = useReaderStore.getState().getReadingPosition(1342);
      expect(enriched?.bookAuthors).toEqual(['Austen, Jane, 1775-1817']);
      expect(enriched?.coverUrl).toBe(
        'https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg'
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

      const mockLte = vi.fn().mockResolvedValue({ error: null });
      const mockEq3 = vi.fn().mockReturnValue({ lte: mockLte });
      const mockEq2 = vi.fn().mockReturnValue({ eq: mockEq3 });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });

      mockFrom.mockReturnValue({ select: mockSelect, delete: mockDelete });

      await useReaderStore.getState().syncWithCloud('test-user-123');

      expect(mockFrom).toHaveBeenCalledWith('reading_progress');
      expect(mockDelete).toHaveBeenCalled();
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

    it('does not upsert ghost reading position (0% progress on Page 1) to Supabase', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({ upsert: mockUpsert });

      useAuthStore.setState({
        user: { id: 'test-user-123', email: 'reader@example.com' } as any,
      });

      // Position on Page 1 with 0 progress
      const ghostPos = {
        chapterIndex: 0,
        chapterPage: 1,
        globalPage: 1,
        lastReadAt: new Date().toISOString(),
      };

      await useReaderStore.getState().syncReadingPositionToCloud(777, ghostPos, 'test-user-123');

      expect(mockUpsert).not.toHaveBeenCalled();
    });

    it('filters out remote ghost records and prunes local ghost entries during syncWithCloud', async () => {
      const mockSelect = vi.fn().mockReturnValue({
        eq: () => ({
          order: () =>
            Promise.resolve({
              data: [
                {
                  book_id: 111,
                  book_title: 'Remote Ghost Book',
                  book_authors: ['Ghost Author'],
                  cover_url: null,
                  current_chapter_index: 0,
                  progress_percent: 0,
                  scroll_offset: 1,
                  last_read_at: '2026-09-01T10:00:00.000Z',
                },
                {
                  book_id: 222,
                  book_title: 'Real Active Book',
                  book_authors: ['Real Author'],
                  cover_url: null,
                  current_chapter_index: 1,
                  progress_percent: 25,
                  scroll_offset: 3,
                  last_read_at: '2026-09-02T10:00:00.000Z',
                },
              ],
              error: null,
            }),
        }),
      });

      const mockLte = vi.fn().mockResolvedValue({ error: null });
      const mockEq3 = vi.fn().mockReturnValue({ lte: mockLte });
      const mockEq2 = vi.fn().mockReturnValue({ eq: mockEq3 });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });

      mockFrom.mockReturnValue({ select: mockSelect, delete: mockDelete });

      // Seed local with a ghost book
      useReaderStore.setState({
        readingPositions: {
          999: { chapterIndex: 0, chapterPage: 1, globalPage: 1, lastReadAt: '2026-09-01' },
        },
        readingProgress: {
          999: 0,
        },
      });

      await useReaderStore.getState().syncWithCloud('test-user-123');

      // Local ghost 999 should be pruned
      expect(useReaderStore.getState().getReadingPosition(999)).toBeNull();
      expect(useReaderStore.getState().getProgress(999)).toBe(0);

      // Remote ghost 111 should be ignored
      expect(useReaderStore.getState().getReadingPosition(111)).toBeNull();

      // Real active book 222 should be synced
      expect(useReaderStore.getState().getReadingPosition(222)).not.toBeNull();
      expect(useReaderStore.getState().getProgress(222)).toBe(25);
    });
  });

  describe('getActiveReadingCount', () => {
    it('returns 0 for null, undefined, or empty state', () => {
      expect(getActiveReadingCount(null)).toBe(0);
      expect(getActiveReadingCount(undefined)).toBe(0);
      expect(getActiveReadingCount({ readingPositions: {}, readingProgress: {} })).toBe(0);
    });

    it('returns unique volume count across positions and progress', () => {
      const state = {
        readingPositions: {
          1342: { chapterIndex: 0, chapterPage: 1, globalPage: 1, lastReadAt: '2026-09-01' },
          84: { chapterIndex: 1, chapterPage: 2, globalPage: 2, lastReadAt: '2026-09-02' },
        },
        readingProgress: {
          1342: 40,
          11: 15,
          2701: 0,
        },
      };

      expect(getActiveReadingCount(state)).toBe(3);
    });
  });

  describe('useHydratedReader', () => {
    it('provides hydration-safe reader defaults and activeReadingCount', () => {
      useReaderStore.setState({
        fontSize: 22,
        readingPositions: {
          1342: { chapterIndex: 0, chapterPage: 1, globalPage: 1, lastReadAt: '2026-09-01' },
        },
      });

      const { result } = renderHook(() => useHydratedReader());

      expect(result.current.hasMounted).toBe(true);
      expect(result.current.fontSize).toBe(22);
      expect(result.current.activeReadingCount).toBe(1);

      act(() => {
        result.current.setFontSize(24);
      });

      expect(result.current.fontSize).toBe(24);
    });

    it('covers saveReadingPosition metadata preservation, LWW conflict resolution, ghost cloud restore, and active debounce timer cancellation', async () => {
      // 1. saveReadingPosition when currentBook has authorDetails & position already has bookTitle without lifespans
      useReaderStore.setState({
        currentBook: {
          id: 1342,
          title: 'Pride and Prejudice',
          authors: ['Jane Austen'],
          authorDetails: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
          coverUrl: 'https://example.com/cover.jpg',
        } as unknown as ReturnType<typeof useReaderStore.getState>['currentBook'],
      });
      useReaderStore.getState().saveReadingPosition(1342, {
        chapterIndex: 1,
        chapterPage: 2,
        globalPage: 5,
        lastReadAt: '2026-09-10T10:00:00.000Z',
        bookTitle: 'Pride and Prejudice',
        bookAuthors: ['Jane Austen'],
      });
      expect(useReaderStore.getState().getReadingPosition(1342)?.bookAuthors).toEqual([
        'Austen, Jane, 1775-1817',
      ]);

      // 2. saveReadingPosition when currentBook is null, preserving existingPos metadata
      useReaderStore.setState({ currentBook: null });
      useReaderStore.getState().saveReadingPosition(1342, {
        chapterIndex: 2,
        chapterPage: 3,
        globalPage: 10,
        lastReadAt: '2026-09-11T10:00:00.000Z',
      });
      expect(useReaderStore.getState().getReadingPosition(1342)?.bookTitle).toBe('Pride and Prejudice');

      // 3. enrichReadingPositions early return & missing pos skip
      useReaderStore.getState().enrichReadingPositions([]);
      useReaderStore.getState().enrichReadingPositions([
        null as unknown as (typeof mockBooks)[0],
        { ...mockBooks[0], id: 99999 },
      ]);

      // 4. restoreReadingPositionFromCloud early return & ghost record ignore
      expect(await useReaderStore.getState().restoreReadingPositionFromCloud(0, '')).toBeNull();
      mockFrom.mockReturnValueOnce({
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: {
                    current_chapter_index: 0,
                    progress_percent: 0,
                    scroll_offset: 1,
                  },
                  error: null,
                }),
            }),
          }),
        }),
      });
      expect(
        await useReaderStore.getState().restoreReadingPositionFromCloud(1342, 'user-1')
      ).toBeNull();

      // 5. syncWithCloud early return & LWW preserving newer local position
      await useReaderStore.getState().syncWithCloud('');
      mockFrom.mockReturnValueOnce({
        delete: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                lte: () => Promise.resolve({ error: null }),
              }),
            }),
          }),
        }),
        select: () => ({
          eq: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  {
                    book_id: 1342,
                    book_title: 'Pride and Prejudice',
                    current_chapter_index: 1,
                    progress_percent: 10,
                    scroll_offset: 2,
                    last_read_at: '2026-09-01T00:00:00.000Z', // Older than local 2026-09-11
                  },
                ],
                error: null,
              }),
          }),
        }),
      });
      await useReaderStore.getState().syncWithCloud('user-1');
      expect(useReaderStore.getState().getReadingPosition(1342)?.chapterIndex).toBe(2);

      // 6. clearReadingPosition while a debounce timer is pending
      useReaderStore.getState().saveReadingPosition(
        1342,
        {
          chapterIndex: 3,
          chapterPage: 1,
          globalPage: 12,
          lastReadAt: '2026-09-12T00:00:00.000Z',
        },
        'user-1'
      );
      await useReaderStore.getState().clearReadingPosition(1342);
      expect(useReaderStore.getState().getReadingPosition(1342)).toBeNull();
    });

    it('preserves verified author lifespans across openReader, saveReadingPosition, enrichReadingPositions, and cloud sync', async () => {
      const { useAuthStore } = await import('./useAuthStore');
      useAuthStore.setState({ user: { id: 'user-heal-1' } as any });

      // 1. openReader with string authors containing embedded lifespans attaches authorDetails
      useReaderStore.getState().openReader({
        id: 11,
        title: "Alice's Adventures in Wonderland",
        authors: ['Carroll, Lewis, 1832-1898'],
        subjects: [],
        languages: ['en'],
        coverUrl: null,
        epubUrl: null,
        htmlUrl: null,
        txtUrl: null,
        downloadCount: 1000,
      });
      const currentAfterEmbedded = useReaderStore.getState().currentBook as any;
      expect(currentAfterEmbedded.authorDetails).toEqual([
        { name: 'Carroll, Lewis, 1832-1898', birth_year: 1832, death_year: 1898 },
      ]);

      // 2. openReader with a partial CanonicalBook lacking lifespans preserves existing verified lifespans for the same bookId
      useReaderStore.getState().openReader({
        id: 11,
        title: "Alice's Adventures in Wonderland",
        authors: ['Lewis Carroll'],
        subjects: [],
        languages: ['en'],
        coverUrl: null,
        epubUrl: null,
        htmlUrl: null,
        txtUrl: null,
        downloadCount: 1000,
      });
      expect((useReaderStore.getState().currentBook as any).authorDetails).toEqual([
        { name: 'Carroll, Lewis, 1832-1898', birth_year: 1832, death_year: 1898 },
      ]);

      // 3. openReader with a GutendexBook whose authors have null lifespans recovers lifespans from readingPositions
      useReaderStore.setState({
        currentBook: null,
        readingPositions: {
          11: {
            chapterIndex: 1,
            chapterPage: 2,
            globalPage: 5,
            lastReadAt: '2026-09-10T10:00:00.000Z',
            bookTitle: "Alice's Adventures in Wonderland",
            bookAuthors: ['Carroll, Lewis, 1832-1898'],
          },
        },
        readingProgress: { 11: 20 },
      });
      useReaderStore.getState().openReader({
        id: 11,
        title: "Alice's Adventures in Wonderland",
        authors: [{ name: 'Lewis Carroll', birth_year: null, death_year: null }],
        translators: [],
        subjects: [],
        bookshelves: [],
        languages: ['en'],
        copyright: false,
        media_type: 'Text',
        formats: {},
        download_count: 1000,
      });
      expect((useReaderStore.getState().currentBook as any).authors).toEqual([
        { name: 'Carroll, Lewis, 1832-1898', birth_year: 1832, death_year: 1898 },
      ]);

      // 4. saveReadingPosition never downgrades existingPos.bookAuthors with lifespans to plain strings
      useReaderStore.setState({ currentBook: null });
      useReaderStore.getState().saveReadingPosition(11, {
        chapterIndex: 2,
        chapterPage: 1,
        globalPage: 8,
        lastReadAt: '2026-09-11T10:00:00.000Z',
        bookTitle: "Alice's Adventures in Wonderland",
        bookAuthors: ['Lewis Carroll'],
      });
      expect(useReaderStore.getState().getReadingPosition(11)?.bookAuthors).toEqual([
        'Carroll, Lewis, 1832-1898',
      ]);

      // 5. syncWithCloud preserves local lifespan-enriched bookAuthors when remote row has plain author strings
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({
        delete: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                lte: () => Promise.resolve({ error: null }),
              }),
            }),
          }),
        }),
        select: () => ({
          eq: () => ({
            order: () =>
              Promise.resolve({
                data: [
                  {
                    book_id: 11,
                    book_title: "Alice's Adventures in Wonderland",
                    book_authors: ['Lewis Carroll'],
                    cover_url: null,
                    current_chapter_index: 3,
                    progress_percent: 45,
                    scroll_offset: 2,
                    last_read_at: '2026-09-12T10:00:00.000Z',
                  },
                ],
                error: null,
              }),
          }),
        }),
        upsert: mockUpsert,
      });

      await useReaderStore.getState().syncWithCloud('user-heal-1');
      expect(useReaderStore.getState().getReadingPosition(11)?.bookAuthors).toEqual([
        'Carroll, Lewis, 1832-1898',
      ]);
      expect(mockUpsert).toHaveBeenCalled();

      // 6. enrichReadingPositions syncs healed book_authors back to cloud when user is logged in
      useReaderStore.setState({
        readingPositions: {
          84: {
            chapterIndex: 1,
            chapterPage: 2,
            globalPage: 4,
            lastReadAt: '2026-09-12T10:00:00.000Z',
            bookTitle: 'Frankenstein',
            bookAuthors: ['Mary Shelley'],
          },
        },
        readingProgress: { 84: 30 },
      });
      mockUpsert.mockClear();
      useReaderStore.getState().enrichReadingPositions([
        {
          id: 84,
          title: 'Frankenstein',
          authors: [{ name: 'Shelley, Mary', birth_year: 1797, death_year: 1851 }],
          translators: [],
          subjects: [],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 500,
        },
      ]);
      expect(useReaderStore.getState().getReadingPosition(84)?.bookAuthors).toEqual([
        'Shelley, Mary, 1797-1851',
      ]);
      expect(mockUpsert).toHaveBeenCalled();

      // 7. enrichReadingPositions heals Anonymous author and missing coverUrl
      useReaderStore.setState({
        readingPositions: {
          85: {
            chapterIndex: 0,
            chapterPage: 1,
            globalPage: 1,
            lastReadAt: '2026-09-12T10:00:00.000Z',
            bookTitle: 'Some Book',
            bookAuthors: ['Anonymous'],
          },
        },
        readingProgress: { 85: 10 },
      });
      useReaderStore.getState().enrichReadingPositions([
        {
          id: 85,
          title: 'Some Book',
          authors: [{ name: 'Verne, Jules', birth_year: null, death_year: null }],
          translators: [],
          subjects: [],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: { 'image/jpeg': 'https://example.com/cover85.jpg' },
          download_count: 100,
        },
      ]);
      expect(useReaderStore.getState().getReadingPosition(85)?.bookAuthors).toEqual(['Verne, Jules']);
      expect(useReaderStore.getState().getReadingPosition(85)?.coverUrl).toBe('https://example.com/cover85.jpg');

      useAuthStore.setState({ user: null });
    });

    it('encodes and decodes bookmarkRow via fractional scroll_offset in cloud sync and preserves Page-1 bookmarked rows', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: {
          current_chapter_index: 0,
          progress_percent: 0,
          scroll_offset: 1.012,
          last_read_at: '2026-10-25T12:00:00.000Z',
          book_title: 'Pride and Prejudice',
          book_authors: ['Austen, Jane, 1775-1817'],
          cover_url: null,
        },
        error: null,
      });

      mockFrom.mockReturnValue({
        upsert: mockUpsert,
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: mockMaybeSingle,
            }),
          }),
        }),
      });

      const posWithRow = {
        chapterIndex: 0,
        chapterPage: 1,
        globalPage: 1,
        bookmarkRow: 12,
        lastReadAt: '2026-10-25T12:00:00.000Z',
      };

      await useReaderStore.getState().syncReadingPositionToCloud(1342, posWithRow, 'user-row-1');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          book_id: 1342,
          scroll_offset: 1.012,
        }),
        { onConflict: 'user_id,book_id' }
      );

      const restored = await useReaderStore
        .getState()
        .restoreReadingPositionFromCloud(1342, 'user-row-1');
      expect(restored?.chapterPage).toBe(1);
      expect(restored?.bookmarkRow).toBe(12);
    });

    it('syncWithCloud decodes bookmarkRow from remote row and populates readingPositions', async () => {
      const mockLte = vi.fn().mockResolvedValue({ error: null });
      const mockEq3 = vi.fn().mockReturnValue({ lte: mockLte });
      const mockEq2 = vi.fn().mockReturnValue({ eq: mockEq3 });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });

      mockFrom.mockReturnValue({
        delete: mockDelete,
        select: () => ({
          eq: () => ({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  book_id: 84,
                  book_title: 'Frankenstein',
                  book_authors: ['Mary Wollstonecraft Shelley, 1797-1851'],
                  cover_url: null,
                  current_chapter_index: 2,
                  progress_percent: 25,
                  scroll_offset: 4.015,
                  last_read_at: '2026-10-25T15:00:00.000Z',
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      await useReaderStore.getState().syncWithCloud('user-sync-row');
      const pos = useReaderStore.getState().getReadingPosition(84);
      expect(pos?.chapterIndex).toBe(2);
      expect(pos?.chapterPage).toBe(4);
      expect(pos?.bookmarkRow).toBe(15);
    });

    it('records deletedPositionBookIds tombstones when clearing a position offline and flushes deletions + local-only positions on syncWithCloud', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
      useAuthStore.setState({ user: { id: 'user-offline-sync' } as any });
      useReaderStore.setState({
        readingPositions: {
          84: {
            chapterIndex: 2,
            chapterPage: 3,
            globalPage: 10,
            lastReadAt: '2026-10-25T10:00:00.000Z',
            bookTitle: 'Frankenstein',
          },
          1342: {
            chapterIndex: 4,
            chapterPage: 2,
            globalPage: 25,
            lastReadAt: '2026-10-26T10:00:00.000Z',
            bookTitle: 'Pride and Prejudice',
          },
        },
        readingProgress: { 84: 25, 1342: 60 },
        deletedPositionBookIds: [],
      });

      await useReaderStore.getState().clearReadingPosition(84, 'user-offline-sync');
      expect(useReaderStore.getState().getReadingPosition(84)).toBeNull();
      expect(useReaderStore.getState().deletedPositionBookIds).toContain(84);

      // Reconnect and syncWithCloud
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const mockDeleteEq2 = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          lte: vi.fn().mockResolvedValue({ error: null }),
        }),
      });
      const mockDeleteEq1 = vi.fn().mockReturnValue({
        eq: mockDeleteEq2,
      });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockDeleteEq1 });

      mockFrom.mockReturnValue({
        delete: mockDelete,
        upsert: mockUpsert,
        select: () => ({
          eq: () => ({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      await useReaderStore.getState().syncWithCloud('user-offline-sync');

      expect(useReaderStore.getState().deletedPositionBookIds).toEqual([]);
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-offline-sync',
          book_id: 1342,
          progress_percent: 60,
        }),
        { onConflict: 'user_id,book_id' }
      );
      useAuthStore.setState({ user: null });
    });

    it('enriches Anonymous or missing authors in readingPositions when fresh book arrives with authentic authors without lifespans', async () => {
      useReaderStore.setState({
        readingPositions: {
          500: {
            chapterIndex: 1,
            chapterPage: 1,
            globalPage: 5,
            lastReadAt: '2026-10-01T10:00:00.000Z',
            bookTitle: 'A Study in Scarlet',
            bookAuthors: ['Anonymous'],
          },
        },
      });

      useReaderStore.getState().enrichReadingPositions([
        {
          id: 500,
          title: 'A Study in Scarlet',
          authors: [{ name: 'Doyle, Arthur Conan', birth_year: null, death_year: null }],
          translators: [],
          subjects: [],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 500,
        },
      ]);

      const updated = useReaderStore.getState().getReadingPosition(500);
      expect(updated?.bookAuthors).toEqual(['Doyle, Arthur Conan']);

      // Also verify saveReadingPosition preserves authentic author when incoming position has Anonymous
      useReaderStore.getState().saveReadingPosition(500, {
        chapterIndex: 2,
        chapterPage: 3,
        globalPage: 12,
        lastReadAt: '2026-10-02T10:00:00.000Z',
        bookTitle: 'A Study in Scarlet',
        bookAuthors: ['Anonymous'],
      });

      expect(useReaderStore.getState().getReadingPosition(500)?.bookAuthors).toEqual(['Doyle, Arthur Conan']);

      // openReader(null) early guard & saveReadingPosition with currentBook matching bookId and posAuthorsMissingOrPlaceholder
      useReaderStore.getState().openReader(null as any);
      useReaderStore.setState({
        currentBook: {
          id: 500,
          title: 'A Study in Scarlet',
          authors: [{ name: 'Doyle, Arthur Conan', birth_year: null, death_year: null }],
          formats: { 'image/jpeg': 'https://example.com/500.jpg' },
        } as any,
      });
      useReaderStore.getState().saveReadingPosition(500, {
        chapterIndex: 3,
        chapterPage: 1,
        globalPage: 15,
        lastReadAt: '2026-10-03T10:00:00.000Z',
        bookTitle: 'A Study in Scarlet',
        bookAuthors: ['Anonymous'],
      });
      expect(useReaderStore.getState().getReadingPosition(500)?.bookAuthors).toEqual(['Doyle, Arthur Conan']);
      expect(useReaderStore.getState().getReadingPosition(500)?.coverUrl).toBe('https://example.com/500.jpg');

      // clearReadingPosition when online and Supabase delete returns an error or throws -> records tombstone
      mockFrom.mockReturnValueOnce({
        delete: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ error: new Error('RLS error') }),
          }),
        }),
      });
      await useReaderStore.getState().clearReadingPosition(500, 'user-err-1');
      expect(useReaderStore.getState().deletedPositionBookIds).toContain(500);

      mockFrom.mockReturnValueOnce({
        delete: () => {
          throw new Error('Connection lost');
        },
      });
      await useReaderStore.getState().clearReadingPosition(501, 'user-err-1');
      expect(useReaderStore.getState().deletedPositionBookIds).toContain(501);

      // clearAllVolumes when Supabase delete throws
      mockFrom.mockReturnValueOnce({
        delete: () => {
          throw new Error('Delete all failed');
        },
      });
      await useReaderStore.getState().clearAllVolumes('user-err-1');
      expect(useReaderStore.getState().deletedPositionBookIds).toEqual([]);

      // SSR renderToString coverage for hydration-guarded hooks (hasMounted === false)
      const React = await import('react');
      const { renderToString } = await import('react-dom/server');
      const { useHydratedBookshelf, useSavedBooksCount, useIsBookSaved, useBookCuration } = await import('./useBookshelfStore');
      const { useHydratedAnnotations } = await import('./useAnnotationStore');
      const { useHydratedFellowship } = await import('./useFellowshipStore');

      function SsrProbe() {
        const reader = useHydratedReader();
        const shelf = useHydratedBookshelf();
        const savedCount = useSavedBooksCount();
        const isSaved = useIsBookSaved(1342);
        const curation = useBookCuration(1342);
        const anns = useHydratedAnnotations();
        const fellowship = useHydratedFellowship();
        return React.createElement(
          'div',
          null,
          `${reader.hasMounted}-${shelf.isSaved(1342)}-${shelf.isFavorite(1342)}-${savedCount}-${isSaved}-${curation.rating}-${anns.annotations.length}-${fellowship.circles.length}`
        );
      }
      const html = renderToString(React.createElement(SsrProbe));
      expect(html).toContain('false-false-false-0-false-null-0-0');
    });
  });
});

