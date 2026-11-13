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
    useReaderStore.getState().resetReaderSession();
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
      deletedPositionBookIds: [],
      dirtyPositionBookIds: [],
      lastReaderSyncAt: null,
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

  it('should set and clamp page brightness between 30 and 100', () => {
    expect(useReaderStore.getState().brightness).toBe(100);

    useReaderStore.getState().setBrightness(75);
    expect(useReaderStore.getState().brightness).toBe(75);

    useReaderStore.getState().setBrightness(10);
    expect(useReaderStore.getState().brightness).toBe(30);

    useReaderStore.getState().setBrightness(150);
    expect(useReaderStore.getState().brightness).toBe(100);
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

      const restoreEqBook = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const restoreEqUser = vi.fn().mockReturnValue({ eq: restoreEqBook });

      mockFrom.mockReturnValue({
        select: () => ({
          eq: restoreEqUser,
        }),
      });

      const restored = await useReaderStore
        .getState()
        .restoreReadingPositionFromCloud(84, 'test-user-123');

      expect(restoreEqUser).toHaveBeenCalledWith('user_id', 'test-user-123');
      expect(restoreEqBook).toHaveBeenCalledWith('book_id', 84);
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
      const mockOrder = vi.fn().mockResolvedValue({
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
      });
      const mockSelectEq = vi.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = vi.fn().mockReturnValue({
        eq: mockSelectEq,
      });

      const mockLte = vi.fn().mockResolvedValue({ error: null });
      const mockEq3 = vi.fn().mockReturnValue({ lte: mockLte });
      const mockEq2 = vi.fn().mockReturnValue({ eq: mockEq3 });
      const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
      const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });

      mockFrom.mockReturnValue({ select: mockSelect, delete: mockDelete });

      await useReaderStore.getState().syncWithCloud('test-user-123');

      expect(mockFrom).toHaveBeenCalledWith('reading_progress');
      expect(mockDelete).not.toHaveBeenCalled();
      expect(mockSelectEq).toHaveBeenCalledWith('user_id', 'test-user-123');
      expect(mockOrder).toHaveBeenCalledWith('last_read_at', { ascending: false });
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

      // Remote ghost cleanup delete must trigger only when SELECT observed a ghost record
      expect(mockDelete).toHaveBeenCalled();
      expect(mockEq1).toHaveBeenCalledWith('user_id', 'test-user-123');
      expect(mockEq2).toHaveBeenCalledWith('progress_percent', 0);
      expect(mockEq3).toHaveBeenCalledWith('current_chapter_index', 0);
      expect(mockLte).toHaveBeenCalledWith('scroll_offset', 1);
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
        bookmarkText: 'It is a truth universally acknowledged, that a single man in possession',
        lastReadAt: '2026-10-25T12:00:00.000Z',
      };

      await useReaderStore.getState().syncReadingPositionToCloud(1342, posWithRow, 'user-row-1');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          book_id: 1342,
          scroll_offset: 1.012,
          bookmark_text: 'It is a truth universally acknowledged, that a single man in possession',
        }),
        { onConflict: 'user_id,book_id' }
      );

      mockMaybeSingle.mockResolvedValueOnce({
        data: {
          current_chapter_index: 0,
          progress_percent: 0,
          scroll_offset: 1.012,
          bookmark_text: 'It is a truth universally acknowledged, that a single man in possession',
          last_read_at: '2026-10-25T12:00:00.000Z',
          book_title: 'Pride and Prejudice',
          book_authors: ['Austen, Jane, 1775-1817'],
          cover_url: null,
        },
        error: null,
      });

      const restored = await useReaderStore
        .getState()
        .restoreReadingPositionFromCloud(1342, 'user-row-1');
      expect(restored?.chapterPage).toBe(1);
      expect(restored?.bookmarkRow).toBe(12);
      expect(restored?.bookmarkText).toBe(
        'It is a truth universally acknowledged, that a single man in possession'
      );

      // Verify pre-migration fallback if bookmark_text column does not exist yet
      mockUpsert.mockClear();
      mockUpsert
        .mockResolvedValueOnce({
          error: { message: 'column "bookmark_text" of relation "reading_progress" does not exist' },
        })
        .mockResolvedValueOnce({ error: null });

      await useReaderStore.getState().syncReadingPositionToCloud(1342, posWithRow, 'user-row-1');
      expect(mockUpsert).toHaveBeenCalledTimes(2);
      expect(mockUpsert.mock.calls[1][0]).not.toHaveProperty('bookmark_text');
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
      expect(mockDeleteEq1).toHaveBeenCalledWith('user_id', 'user-offline-sync');
      expect(mockDeleteEq2).toHaveBeenCalledWith('book_id', 84);
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
      const { useHydratedAnnotations, useHydratedAnnotationCount } = await import('./useAnnotationStore');
      const { useHydratedFellowship } = await import('./useFellowshipStore');

      function SsrProbe() {
        const reader = useHydratedReader();
        const shelf = useHydratedBookshelf();
        const savedCount = useSavedBooksCount();
        const isSaved = useIsBookSaved(1342);
        const curation = useBookCuration(1342);
        const anns = useHydratedAnnotations();
        const annCount = useHydratedAnnotationCount();
        const fellowship = useHydratedFellowship();
        return React.createElement(
          'div',
          null,
          `${reader.hasMounted}-${shelf.isSaved(1342)}-${shelf.isFavorite(1342)}-${savedCount}-${isSaved}-${curation.rating}-${anns.annotations.length}-${annCount.annotationCount}-${fellowship.circles.length}`
        );
      }
      const html = renderToString(React.createElement(SsrProbe));
      expect(html).toContain('false-false-false-0-false-null-0-0-0');

      // setReadingMode and setColumnWidth persist and validate layout modes
      useReaderStore.getState().setReadingMode('scroll');
      expect(useReaderStore.getState().readingMode).toBe('scroll');
      useReaderStore.getState().setReadingMode('paginated');
      expect(useReaderStore.getState().readingMode).toBe('paginated');

      useReaderStore.getState().setColumnWidth('narrow');
      expect(useReaderStore.getState().columnWidth).toBe('narrow');
      useReaderStore.getState().setColumnWidth('normal');
      expect(useReaderStore.getState().columnWidth).toBe('normal');
      useReaderStore.getState().setColumnWidth('wide');
      expect(useReaderStore.getState().columnWidth).toBe('wide');

      // Device-adaptive default font size resolution when isFontSizeCustomized is false
      const originalInnerWidth = window.innerWidth;
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: 390,
      });
      useReaderStore.setState({ fontSize: 18, isFontSizeCustomized: false });
      const { result: hydratedMobile } = renderHook(() => useHydratedReader());
      expect(hydratedMobile.current.fontSize).toBe(15);

      act(() => {
        hydratedMobile.current.setFontSize(20);
      });
      expect(hydratedMobile.current.fontSize).toBe(20);
      expect(useReaderStore.getState().isFontSizeCustomized).toBe(true);

      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        writable: true,
        value: originalInnerWidth,
      });
    });

    it('batches multiple healedInCloud and enrichReadingPositions rows into a single reading_progress upsert with bookmark_text fallback', async () => {
      useAuthStore.setState({ user: { id: 'user-batch-1' } as any });
      useReaderStore.setState({
        readingPositions: {
          1342: {
            chapterIndex: 2,
            chapterPage: 3,
            globalPage: 10,
            bookmarkRow: 4,
            bookmarkText: 'It is a truth universally acknowledged',
            lastReadAt: '2026-11-10T10:00:00.000Z',
            bookTitle: 'Pride and Prejudice',
            bookAuthors: ['Jane Austen'],
          },
          84: {
            chapterIndex: 1,
            chapterPage: 2,
            globalPage: 5,
            lastReadAt: '2026-11-10T11:00:00.000Z',
            bookTitle: 'Frankenstein',
            bookAuthors: ['Mary Shelley'],
          },
        },
        readingProgress: { 1342: 40, 84: 25 },
        deletedPositionBookIds: [],
      });

      const mockUpsert = vi
        .fn()
        .mockResolvedValueOnce({
          error: { message: 'Could not find bookmark_text column in schema cache' },
        })
        .mockResolvedValue({ error: null });

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
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
        upsert: mockUpsert,
      });

      await useReaderStore.getState().syncWithCloud('user-batch-1');

      // 1st call attempts fullPayload batch of 2 rows; 2nd call falls back to basePayload batch of 2 rows
      expect(mockUpsert).toHaveBeenCalledTimes(2);
      const firstBatchArg = mockUpsert.mock.calls[0][0];
      expect(Array.isArray(firstBatchArg)).toBe(true);
      expect(firstBatchArg).toHaveLength(2);

      // Also verify multi-book enrichReadingPositions batches into 1 upsert call
      mockUpsert.mockClear();
      useReaderStore.getState().enrichReadingPositions([
        {
          ...mockBooks[0],
          id: 1342,
          authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
        },
        {
          ...mockBooks[1],
          id: 84,
          authors: [{ name: 'Shelley, Mary', birth_year: 1797, death_year: 1851 }],
        },
      ]);

      await vi.waitFor(() => {
        expect(mockUpsert).toHaveBeenCalledTimes(1);
      });
      expect(Array.isArray(mockUpsert.mock.calls[0][0])).toBe(true);
      expect(mockUpsert.mock.calls[0][0]).toHaveLength(2);
      useAuthStore.setState({ user: null });
    });

    it('skips passive syncWithCloud within 15s cooldown unless tombstones exist or interval elapsed', async () => {
      useReaderStore.getState().resetReaderSession();
      const selectSpy = vi.fn().mockReturnValue({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      });
      mockFrom.mockReturnValue({
        select: selectSpy,
        delete: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        }),
      });

      await useReaderStore.getState().syncWithCloud('user-cd', { minSyncIntervalMs: 15_000 });
      expect(selectSpy).toHaveBeenCalledTimes(1);

      await useReaderStore.getState().syncWithCloud('user-cd', { minSyncIntervalMs: 15_000 });
      expect(selectSpy).toHaveBeenCalledTimes(1);

      // Pending tombstone bypasses passive cooldown
      useReaderStore.setState({ deletedPositionBookIds: [1342] });
      await useReaderStore.getState().syncWithCloud('user-cd', { minSyncIntervalMs: 15_000 });
      expect(selectSpy).toHaveBeenCalledTimes(2);

      // Advancing past 15s allows passive sync again
      vi.advanceTimersByTime(15_001);
      await useReaderStore.getState().syncWithCloud('user-cd', { minSyncIntervalMs: 15_000 });
      expect(selectSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('Authoritative Bookmark Deletion Sync & Dirty Protection', () => {
    type StoreUser = NonNullable<ReturnType<typeof useAuthStore.getState>['user']>;
    const makeTestUser = (id: string): StoreUser =>
      ({
        id,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '',
      }) as StoreUser;

    it('prunes locally cached bookmarks deleted on another device while preserving standalone Finished curation', async () => {
      useAuthStore.setState({ user: makeTestUser('user-del-sync') });
      useReaderStore.setState({
        lastReaderSyncAt: '2026-11-13T18:00:00.000Z',
        dirtyPositionBookIds: [],
        readingPositions: {
          1342: {
            chapterIndex: 3,
            chapterPage: 5,
            globalPage: 42,
            lastReadAt: '2026-11-13T17:00:00.000Z',
            bookTitle: 'Pride and Prejudice',
          },
          84: {
            chapterIndex: 1,
            chapterPage: 2,
            globalPage: 8,
            lastReadAt: '2026-11-13T17:30:00.000Z',
            bookTitle: 'Frankenstein',
          },
        },
        readingProgress: { 1342: 45, 84: 20, 999: 100 },
      });

      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({
        upsert: mockUpsert,
        select: () => ({
          eq: () => ({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  book_id: 84,
                  book_title: 'Frankenstein',
                  book_authors: ['Shelley, Mary'],
                  cover_url: null,
                  current_chapter_index: 1,
                  progress_percent: 20,
                  scroll_offset: 2,
                  last_read_at: '2026-11-13T17:30:00.000Z',
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      await useReaderStore.getState().syncWithCloud('user-del-sync');

      // Deleted #1342 must be pruned locally instead of re-uploaded
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(useReaderStore.getState().readingPositions[1342]).toBeUndefined();
      expect(useReaderStore.getState().readingProgress[1342]).toBeUndefined();
      expect(useReaderStore.getState().readingPositions[84]?.bookTitle).toBe('Frankenstein');
      // Standalone curation-only Finished progress without a readingPosition must stay intact
      expect(useReaderStore.getState().readingProgress[999]).toBe(100);
      expect(useReaderStore.getState().lastReaderSyncAt).not.toBeNull();
    });

    it('preserves offline/debounced edits via dirtyPositionBookIds, guards mid-flight saves, and bypasses passive cooldown when dirty', async () => {
      const userId = 'user-dirty-flow';
      useAuthStore.setState({ user: makeTestUser(userId) });
      useReaderStore.setState({
        lastReaderSyncAt: '2026-11-13T18:00:00.000Z',
        dirtyPositionBookIds: [],
      });

      // 1. Offline saveReadingPosition marks book dirty without duplicating IDs, and clearReadingPosition clears dirty flag
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
      useReaderStore.getState().saveReadingPosition(1342, {
        chapterIndex: 2,
        chapterPage: 1,
        globalPage: 15,
        lastReadAt: '2026-11-13T17:50:00.000Z',
      });
      useReaderStore.getState().saveReadingPosition(1342, {
        chapterIndex: 2,
        chapterPage: 2,
        globalPage: 16,
        lastReadAt: '2026-11-13T17:51:00.000Z',
      });
      useReaderStore.setState((s) => ({
        readingProgress: { ...s.readingProgress, 1342: 30, 555: 10 },
        dirtyPositionBookIds: [...s.dirtyPositionBookIds, 555],
      }));
      expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([1342, 555]);

      await useReaderStore.getState().clearReadingPosition(555, userId);
      expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([1342]);

      // 2. Reconnect before debounce timer fires: syncWithCloud uploads local edit instead of deleting it
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
      const mockUpsert = vi.fn().mockResolvedValue({ error: null });
      const selectSpy = vi.fn().mockReturnValue({
        eq: () => ({
          order: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });
      mockFrom.mockReturnValue({
        delete: () => ({
          eq: () => ({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
        upsert: mockUpsert,
        select: selectSpy,
      });

      await useReaderStore.getState().syncWithCloud(userId, { minSyncIntervalMs: 15_000 });
      expect(mockUpsert).toHaveBeenCalledTimes(1);
      expect(useReaderStore.getState().readingPositions[1342]?.globalPage).toBe(16);
      expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([]);

      // 3. Within 15s cooldown: clean sync skips, dirty sync bypasses cooldown
      await useReaderStore.getState().syncWithCloud(userId, { minSyncIntervalMs: 15_000 });
      expect(selectSpy).toHaveBeenCalledTimes(1);

      useReaderStore.setState({ dirtyPositionBookIds: [84] });
      await useReaderStore.getState().syncWithCloud(userId, { minSyncIntervalMs: 15_000 });
      expect(selectSpy).toHaveBeenCalledTimes(2);

      // 4. Mid-flight newer edit during syncReadingPositionToCloud keeps book dirty
      let resolveUpsert!: (res: { error: null }) => void;
      const deferredUpsert = new Promise<{ error: null }>((resolve) => {
        resolveUpsert = resolve;
      });
      mockFrom.mockReturnValue({
        upsert: vi.fn().mockReturnValueOnce(deferredUpsert),
      });

      const posT1 = {
        chapterIndex: 1,
        chapterPage: 1,
        globalPage: 5,
        lastReadAt: '2026-11-13T18:01:00.000Z',
      };
      useReaderStore.setState({
        readingPositions: { 77: posT1 },
        readingProgress: { 77: 12 },
        dirtyPositionBookIds: [77],
      });

      const uploadPromise = useReaderStore
        .getState()
        .syncReadingPositionToCloud(77, posT1, userId);

      // Newer save lands while upload is still in flight
      useReaderStore.getState().saveReadingPosition(77, {
        chapterIndex: 1,
        chapterPage: 2,
        globalPage: 6,
        lastReadAt: '2026-11-13T18:02:00.000Z',
      });

      resolveUpsert({ error: null });
      const uploadOk = await uploadPromise;
      expect(uploadOk).toBe(true);
      expect(useReaderStore.getState().dirtyPositionBookIds).toContain(77);

      // 5. Partial dirty clear: clears uploaded book #12 while preserving unrelated dirty #84,
      // plus syncReadingPositionToCloud missing params / active session verification failure returning false
      expect(await useReaderStore.getState().syncReadingPositionToCloud(0, posT1, userId)).toBe(false);
      mockFrom.mockReturnValueOnce({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });
      useReaderStore.setState({
        dirtyPositionBookIds: [12, 84],
        readingPositions: { ...useReaderStore.getState().readingPositions, 12: posT1 },
        readingProgress: { ...useReaderStore.getState().readingProgress, 12: 20 },
      });
      expect(await useReaderStore.getState().syncReadingPositionToCloud(12, posT1, userId)).toBe(true);
      expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([84]);
    });

    it('handles upsert/fallback failure booleans, retains unsynced items on failed healedInCloud upload, and aborts on SELECT error', async () => {
      const userId = 'user-failures';
      useAuthStore.setState({ user: makeTestUser(userId) });

      // 1. Primary non-bookmark_text failure returns false
      useReaderStore.setState({
        readingPositions: {
          1342: {
            chapterIndex: 2,
            chapterPage: 1,
            globalPage: 10,
            lastReadAt: '2026-11-13T18:00:00.000Z',
          },
        },
        readingProgress: { 1342: 20 },
        dirtyPositionBookIds: [1342],
      });
      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValueOnce({ error: { message: 'RLS violation' } }),
      });

      const primaryFailed = await useReaderStore
        .getState()
        .syncReadingPositionToCloud(1342, useReaderStore.getState().readingPositions[1342], userId);
      expect(primaryFailed).toBe(false);
      expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([1342]);

      // 2. bookmark_text fallback failure returns false, then fallback success returns true and clears dirty
      mockFrom.mockReturnValue({
        upsert: vi
          .fn()
          .mockResolvedValueOnce({ error: { message: 'column "bookmark_text" does not exist' } })
          .mockResolvedValueOnce({ error: { message: 'timeout' } }),
      });
      const fallbackFailed = await useReaderStore
        .getState()
        .syncReadingPositionToCloud(1342, useReaderStore.getState().readingPositions[1342], userId);
      expect(fallbackFailed).toBe(false);

      mockFrom.mockReturnValue({
        upsert: vi
          .fn()
          .mockResolvedValueOnce({ error: { message: 'column "bookmark_text" does not exist' } })
          .mockResolvedValueOnce({ error: null }),
      });
      const fallbackSucceeded = await useReaderStore
        .getState()
        .syncReadingPositionToCloud(1342, useReaderStore.getState().readingPositions[1342], userId);
      expect(fallbackSucceeded).toBe(true);
      expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([]);

      // 3. Batch healedInCloud failure must NOT advance lastReaderSyncAt
      useReaderStore.setState({
        lastReaderSyncAt: null,
        dirtyPositionBookIds: [1342, 84],
        readingPositions: {
          1342: {
            chapterIndex: 2,
            chapterPage: 1,
            globalPage: 10,
            lastReadAt: '2026-11-13T18:00:00.000Z',
          },
          84: {
            chapterIndex: 3,
            chapterPage: 4,
            globalPage: 22,
            lastReadAt: '2026-11-13T18:01:00.000Z',
          },
        },
        readingProgress: { 1342: 20, 84: 40 },
      });
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: { message: 'network drop' } }),
      });

      await useReaderStore.getState().syncWithCloud(userId);
      expect(useReaderStore.getState().lastReaderSyncAt).toBeNull();
      expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([1342, 84]);

      // Retry succeeds: now both clear dirty and watermark is stamped
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });
      await useReaderStore.getState().syncWithCloud(userId);
      expect(useReaderStore.getState().lastReaderSyncAt).not.toBeNull();
      expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([]);

      // 4. Failed single-book healedInCloud leaves previous lastReaderSyncAt untouched
      useReaderStore.setState({
        lastReaderSyncAt: '2026-11-13T17:00:00.000Z',
        dirtyPositionBookIds: [1342],
        readingPositions: {
          1342: {
            chapterIndex: 2,
            chapterPage: 1,
            globalPage: 10,
            lastReadAt: '2026-11-13T18:00:00.000Z',
          },
        },
        readingProgress: { 1342: 20 },
      });
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
        upsert: vi.fn().mockResolvedValue({ error: { message: 'single-book fail' } }),
      });
      await useReaderStore.getState().syncWithCloud(userId);
      expect(useReaderStore.getState().lastReaderSyncAt).toBe('2026-11-13T17:00:00.000Z');
      expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([1342]);

      // 5. SELECT failure and invalid timestamp strings leave state and watermark safe
      const savedSyncAt = useReaderStore.getState().lastReaderSyncAt;
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            order: vi.fn().mockResolvedValue({ data: null, error: { message: '503 unavailable' } }),
          }),
        }),
      });
      await useReaderStore.getState().syncWithCloud(userId);
      expect(useReaderStore.getState().lastReaderSyncAt).toBe(savedSyncAt);
      expect(useReaderStore.getState().readingPositions[1342]).toBeDefined();
    });

    it('guards against cross-device clock skew, handles enrichReadingPositions batch dirty recovery, and resets session watermark on resetReaderSession', async () => {
      const userId = 'user-skew';
      useAuthStore.setState({ user: makeTestUser(userId) });

      // 1. Remote device clock is ahead (+4 years): lastReaderSyncAt anchors to remoteTime so later cloud deletion still prunes cleanly
      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
        select: () => ({
          eq: () => ({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  book_id: 84,
                  book_title: 'Frankenstein',
                  book_authors: ['Shelley, Mary'],
                  cover_url: null,
                  current_chapter_index: 2,
                  progress_percent: 35,
                  scroll_offset: 3,
                  last_read_at: '2030-01-01T00:00:00.000Z',
                },
              ],
              error: null,
            }),
          }),
        }),
      });

      await useReaderStore.getState().syncWithCloud(userId);
      expect(useReaderStore.getState().lastReaderSyncAt).toBe('2030-01-01T00:00:00.000Z');
      expect(useReaderStore.getState().readingPositions[84]).toBeDefined();

      // Now even if #84 has that 2030 timestamp locally, deleting #84 on cloud prunes it locally
      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
        select: () => ({
          eq: () => ({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });
      await useReaderStore.getState().syncWithCloud(userId);
      expect(useReaderStore.getState().readingPositions[84]).toBeUndefined();
      // Monotonic guard preserves 2030 watermark instead of regressing to current local clock
      expect(useReaderStore.getState().lastReaderSyncAt).toBe('2030-01-01T00:00:00.000Z');

      // 2. Dirty local edit with older clock gets superseded safely when remoteTime >= localTime wins LWW
      useReaderStore.setState({
        readingPositions: {
          11: {
            chapterIndex: 1,
            chapterPage: 1,
            globalPage: 4,
            lastReadAt: '2026-11-13T10:00:00.000Z',
          },
        },
        readingProgress: { 11: 15 },
        dirtyPositionBookIds: [11],
      });
      mockFrom.mockReturnValue({
        select: () => ({
          eq: () => ({
            order: vi.fn().mockResolvedValue({
              data: [
                {
                  book_id: 11,
                  book_title: "Alice's Adventures in Wonderland",
                  book_authors: ['Carroll, Lewis (1832-1898)'],
                  cover_url: null,
                  current_chapter_index: 4,
                  progress_percent: 55,
                  scroll_offset: 2,
                  last_read_at: '2026-11-13T12:00:00.000Z',
                },
              ],
              error: null,
            }),
          }),
        }),
      });
      await useReaderStore.getState().syncWithCloud(userId);
      expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([]);
      expect(useReaderStore.getState().readingProgress[11]).toBe(55);

      // 3. enrichReadingPositions retains dirty IDs on failure and clears them on batch and single-book success
      useReaderStore.setState({
        readingPositions: {
          1342: { chapterIndex: 1, chapterPage: 1, globalPage: 2, lastReadAt: '2026-11-13T18:00:00.000Z' },
          84: { chapterIndex: 1, chapterPage: 1, globalPage: 2, lastReadAt: '2026-11-13T18:00:00.000Z' },
        },
        readingProgress: { 1342: 10, 84: 10 },
        dirtyPositionBookIds: [],
      });
      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: 'offline' } }),
      });
      useReaderStore.getState().enrichReadingPositions([
        { ...mockBooks[0], id: 1342, authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }] },
        { ...mockBooks[1], id: 84, authors: [{ name: 'Shelley, Mary', birth_year: 1797, death_year: 1851 }] },
      ]);
      await vi.waitFor(() => {
        expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([1342, 84]);
      });

      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      });
      useReaderStore.setState({
        readingPositions: {
          1342: { chapterIndex: 1, chapterPage: 1, globalPage: 2, lastReadAt: '2026-11-13T18:00:00.000Z' },
          84: { chapterIndex: 1, chapterPage: 1, globalPage: 2, lastReadAt: '2026-11-13T18:00:00.000Z' },
        },
      });
      useReaderStore.getState().enrichReadingPositions([
        { ...mockBooks[0], id: 1342, authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }] },
        { ...mockBooks[1], id: 84, authors: [{ name: 'Shelley, Mary', birth_year: 1797, death_year: 1851 }] },
      ]);
      await vi.waitFor(() => {
        expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([]);
      });

      // Single-book enrichReadingPositions dedupes already-dirty ID and clears on success
      useReaderStore.setState({
        readingPositions: {
          1342: { chapterIndex: 1, chapterPage: 1, globalPage: 2, lastReadAt: '2026-11-13T18:00:00.000Z' },
        },
        dirtyPositionBookIds: [1342],
      });
      useReaderStore.getState().enrichReadingPositions([
        { ...mockBooks[0], id: 1342, authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }] },
      ]);
      await vi.waitFor(() => {
        expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([]);
      });

      // Non-dirty local entry with localTime > lastSyncTime is uploaded instead of pruned
      useReaderStore.setState({
        lastReaderSyncAt: '2026-11-13T18:00:00.000Z',
        dirtyPositionBookIds: [],
        readingPositions: {
          1342: { chapterIndex: 5, chapterPage: 1, globalPage: 50, lastReadAt: '2026-11-13T19:00:00.000Z' },
        },
        readingProgress: { 1342: 75 },
      });
      const newerUpsert = vi.fn().mockResolvedValue({ error: null });
      mockFrom.mockReturnValue({
        upsert: newerUpsert,
        select: () => ({
          eq: () => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        }),
      });
      await useReaderStore.getState().syncWithCloud(userId);
      expect(newerUpsert).toHaveBeenCalledTimes(1);
      expect(useReaderStore.getState().readingPositions[1342]).toBeDefined();

      // 4. Overlapping syncWithCloud while dirtyPositionBookIds > 0 triggers dirty follow-up pass
      let releaseFirstSelect!: (res: { data: unknown[]; error: null }) => void;
      const deferredSelect = new Promise<{ data: unknown[]; error: null }>((resolve) => {
        releaseFirstSelect = resolve;
      });
      const overlapSelectSpy = vi
        .fn()
        .mockReturnValueOnce({ eq: () => ({ order: () => deferredSelect }) })
        .mockReturnValueOnce({
          eq: () => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        });
      mockFrom.mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
        select: overlapSelectSpy,
      });

      const firstFlight = useReaderStore.getState().syncWithCloud(userId);
      useReaderStore.setState({ dirtyPositionBookIds: [1342] });
      const secondFlight = useReaderStore.getState().syncWithCloud(userId);
      expect(secondFlight).toBe(firstFlight);
      releaseFirstSelect({ data: [], error: null });
      await firstFlight;
      expect(overlapSelectSpy).toHaveBeenCalledTimes(2);

      // Reset clears watermark and dirty tracking completely (Rule 9 teardown parity)
      useReaderStore.getState().resetReaderSession();
      expect(useReaderStore.getState().lastReaderSyncAt).toBeNull();
      expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([]);
    });

    it('scrubs 0% Page-1 ghost positions from dirtyPositionBookIds across save, restart debounce, and early syncWithCloud while protecting concurrent real edits', async () => {
      vi.useFakeTimers();
      try {
        const userId = 'user-ghost-clean';
        useAuthStore.setState({ user: makeTestUser(userId) });

        // 1. Saving a 0% Page-1 ghost directly omits and strips that book from dirtyPositionBookIds without affecting other books or guest mode
        useReaderStore.setState({
          dirtyPositionBookIds: [1342, 84],
          readingProgress: { 1342: 0, 84: 25 },
        });
        useReaderStore.getState().saveReadingPosition(
          1342,
          {
            chapterIndex: 0,
            chapterPage: 1,
            globalPage: 1,
            lastReadAt: '2026-11-13T19:00:00.000Z',
          },
          userId
        );
        expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([84]);

        // Guest/offline save without userId leaves dirtyPositionBookIds untouched
        useAuthStore.setState({ user: null });
        useReaderStore.getState().saveReadingPosition(999, {
          chapterIndex: 0,
          chapterPage: 1,
          globalPage: 1,
          lastReadAt: '2026-11-13T19:00:30.000Z',
        });
        expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([84]);

        // 2. Two-step restart sequence: saveReadingPosition(Page 1) while progress > 0 -> setProgress(0) -> debounce flush
        useAuthStore.setState({ user: makeTestUser(userId) });
        const restartSelectSpy = vi.fn().mockReturnValue({
          eq: () => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) }),
        });
        const restartUpsertSpy = vi.fn().mockResolvedValue({ error: null });
        mockFrom.mockReturnValue({
          select: restartSelectSpy,
          upsert: restartUpsertSpy,
        });

        useReaderStore.setState({
          dirtyPositionBookIds: [],
          readingProgress: { 1342: 45 },
        });
        const ghostRestartPos = {
          chapterIndex: 0,
          chapterPage: 1,
          globalPage: 1,
          lastReadAt: '2026-11-13T19:01:00.000Z',
        };
        useReaderStore.getState().saveReadingPosition(1342, ghostRestartPos, userId);
        expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([1342]);
        useReaderStore.getState().setProgress(1342, 0);

        // Debounced flush skips Supabase upload (returns false) and scrubs ghost #1342 from dirtyPositionBookIds
        await vi.advanceTimersByTimeAsync(2000);
        expect(restartUpsertSpy).not.toHaveBeenCalled();
        expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([]);

        // Subsequent passive syncWithCloud honors 15s cooldown (0 extra Supabase calls after first sync)
        await useReaderStore.getState().syncWithCloud(userId, { minSyncIntervalMs: 15_000 });
        await useReaderStore.getState().syncWithCloud(userId, { minSyncIntervalMs: 15_000 });
        expect(restartSelectSpy).toHaveBeenCalledTimes(1);

        // 3. Direct syncReadingPositionToCloud with ghost preserves dirty flag if a newer real save superseded lastReadAt mid-flight
        useReaderStore.setState({
          dirtyPositionBookIds: [77],
          readingProgress: { 77: 0 },
          readingPositions: {
            77: {
              chapterIndex: 2,
              chapterPage: 3,
              globalPage: 12,
              lastReadAt: '2026-11-13T19:02:00.000Z',
            },
          },
        });
        expect(await useReaderStore.getState().syncReadingPositionToCloud(77, ghostRestartPos, userId)).toBe(false);
        expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([77]);

        // 4. Early syncWithCloud before restart timer fires prunes the ghost, cancels its pending timer, and scrubs dirtyPositionBookIds
        useReaderStore.setState({
          readingPositions: {},
          dirtyPositionBookIds: [],
          readingProgress: { 500: 50 },
        });
        useReaderStore.getState().saveReadingPosition(
          500,
          {
            chapterIndex: 0,
            chapterPage: 1,
            globalPage: 1,
            lastReadAt: '2026-11-13T19:03:00.000Z',
          },
          userId
        );
        useReaderStore.getState().setProgress(500, 0);
        expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([500]);

        await useReaderStore.getState().syncWithCloud(userId);
        expect(useReaderStore.getState().readingPositions[500]).toBeUndefined();
        expect(useReaderStore.getState().readingProgress[500]).toBeUndefined();
        expect(useReaderStore.getState().dirtyPositionBookIds).toEqual([]);
        await vi.advanceTimersByTimeAsync(2500);
        expect(restartUpsertSpy).not.toHaveBeenCalled();
      } finally {
        vi.useRealTimers();
      }
    });
  });
});

