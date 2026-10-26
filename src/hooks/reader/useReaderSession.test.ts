import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useReaderSession } from './useReaderSession';
import { useReaderStore } from '@/stores/useReaderStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import type { ChapterSection } from '@/lib/gutenberg-parser';

describe('useReaderSession', () => {
  const mockChapters: ChapterSection[] = [
    {
      id: 1,
      title: 'Chapter 1',
      displayTitle: 'Chapter 1',
      content: 'This is the first chapter content. It has multiple words to paginate.',
      pageCount: 2,
      startPageNumber: 1,
      pages: ['Page 1 content', 'Page 2 content'],
    },
    {
      id: 2,
      title: 'Chapter 2',
      displayTitle: 'Chapter 2',
      content: 'This is the second chapter content.',
      pageCount: 1,
      startPageNumber: 3,
      pages: ['Chapter 2 page 1 content'],
    },
  ];

  beforeEach(() => {
    useReaderStore.setState({
      currentBook: null,
      fontSize: 18,
      lineHeight: 1.75,
      fontFamily: 'serif',
      theme: 'light',
      readingProgress: {},
      readingPositions: {},
    });
    useBookshelfStore.setState({
      bookStatuses: {},
      recentBooks: [],
      savedBooks: [],
    });
    vi.clearAllMocks();
  });

  it('initializes on chapter 0 and page 1', () => {
    const { result } = renderHook(() =>
      useReaderSession({
        numericId: 100,
        hasMounted: true,
        chaptersWithPagination: mockChapters,
        totalVolumePages: 3,
        fontSize: 18,
        readingMode: 'paginated',
      })
    );

    expect(result.current.activeChapterIndex).toBe(0);
    expect(result.current.currentChapterPage).toBe(1);
    expect(result.current.currentPageText).toBe('Page 1 content');
    expect(result.current.currentGlobalPage).toBe(1);
    expect(result.current.volumeProgress).toBe(0);
  });

  it('handles next and previous page transitions across chapters', () => {
    const { result } = renderHook(() =>
      useReaderSession({
        numericId: 100,
        hasMounted: true,
        chaptersWithPagination: mockChapters,
        totalVolumePages: 3,
        fontSize: 18,
        readingMode: 'paginated',
      })
    );

    // Page 1 -> Page 2 within Chapter 1
    act(() => {
      result.current.handleNextPage();
    });
    expect(result.current.activeChapterIndex).toBe(0);
    expect(result.current.currentChapterPage).toBe(2);
    expect(result.current.currentPageText).toBe('Page 2 content');

    // Page 2 Chapter 1 -> Page 1 Chapter 2
    act(() => {
      result.current.handleNextPage();
    });
    expect(result.current.activeChapterIndex).toBe(1);
    expect(result.current.currentChapterPage).toBe(1);
    expect(result.current.currentPageText).toBe('Chapter 2 page 1 content');

    // Previous page back to Chapter 1 Page 2
    act(() => {
      result.current.handlePrevPage();
    });
    expect(result.current.activeChapterIndex).toBe(0);
    expect(result.current.currentChapterPage).toBe(2);
  });

  it('allows chapter selection and restart to chapter 0 page 1', async () => {
    const { result } = renderHook(() =>
      useReaderSession({
        numericId: 100,
        hasMounted: true,
        chaptersWithPagination: mockChapters,
        totalVolumePages: 3,
        fontSize: 18,
        readingMode: 'paginated',
      })
    );

    act(() => {
      result.current.handleSelectChapter(1);
    });
    expect(result.current.activeChapterIndex).toBe(1);
    expect(result.current.currentChapterPage).toBe(1);

    await act(async () => {
      result.current.handleRestart();
    });
    expect(result.current.activeChapterIndex).toBe(0);
    expect(result.current.currentChapterPage).toBe(1);
  });

  it('jumps to target page accurately across chapters', () => {
    const { result } = renderHook(() =>
      useReaderSession({
        numericId: 100,
        hasMounted: true,
        chaptersWithPagination: mockChapters,
        totalVolumePages: 3,
        fontSize: 18,
        readingMode: 'paginated',
      })
    );

    // Page 3 falls into Chapter 2, Page 1
    act(() => {
      result.current.handlePageJump(3);
    });
    expect(result.current.activeChapterIndex).toBe(1);
    expect(result.current.currentChapterPage).toBe(1);
  });

  it('auto-resumes from stored local reading position and triggers notice', async () => {
    useReaderStore.getState().saveReadingPosition(100, {
      chapterIndex: 1,
      chapterPage: 1,
      globalPage: 3,
      lastReadAt: new Date().toISOString(),
    });

    const { result } = renderHook(() =>
      useReaderSession({
        numericId: 100,
        hasMounted: true,
        chaptersWithPagination: mockChapters,
        totalVolumePages: 3,
        fontSize: 18,
        readingMode: 'paginated',
      })
    );

    // Wait for microtask queue
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.activeChapterIndex).toBe(1);
    expect(result.current.currentChapterPage).toBe(1);
    expect(result.current.resumeNotice).toEqual({
      chapterTitle: 'Chapter 2',
      page: 3,
    });
  });

  it('restores position from cloud when authenticated and local is empty', async () => {
    useAuthStore.setState({
      user: { id: 'user-xyz', email: 'test@example.com' } as any,
    });

    const mockRestore = vi.spyOn(useReaderStore.getState(), 'restoreReadingPositionFromCloud').mockResolvedValue({
      chapterIndex: 1,
      chapterPage: 1,
      globalPage: 3,
      lastReadAt: new Date().toISOString(),
    });

    const { result } = renderHook(() =>
      useReaderSession({
        numericId: 100,
        hasMounted: true,
        chaptersWithPagination: mockChapters,
        totalVolumePages: 3,
        fontSize: 18,
        readingMode: 'paginated',
      })
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockRestore).toHaveBeenCalledWith(100, 'user-xyz');
    expect(result.current.activeChapterIndex).toBe(1);
    mockRestore.mockRestore();
  });

  it('does not overwrite readingProgress with 0 and shows completed notice when readingStatus is finished', async () => {
    useReaderStore.getState().setProgress(100, 100);
    useReaderStore.getState().saveReadingPosition(100, {
      chapterIndex: 1,
      chapterPage: 1,
      globalPage: 3,
      lastReadAt: new Date().toISOString(),
    });

    const { result } = renderHook(() =>
      useReaderSession({
        numericId: 100,
        hasMounted: true,
        chaptersWithPagination: mockChapters,
        totalVolumePages: 3,
        fontSize: 18,
        readingMode: 'paginated',
        readingStatus: 'finished',
      })
    );

    // Flush microtask queue
    await act(async () => {
      await Promise.resolve();
    });

    // Initial mount on Page 1 should NOT overwrite progress to 0
    expect(useReaderStore.getState().readingProgress[100]).toBe(100);
    expect(result.current.activeChapterIndex).toBe(0);
    expect(result.current.currentChapterPage).toBe(1);
    expect(result.current.resumeNotice).toEqual({
      chapterTitle: 'Completed Volume (100%)',
      page: 1,
    });
  });

  it('handleRestart resets progress to 0 and transitions readingStatus to currently_reading', async () => {
    useReaderStore.getState().setProgress(100, 100);
    useBookshelfStore.setState({
      bookStatuses: { 100: 'finished' },
    });

    const { result } = renderHook(() =>
      useReaderSession({
        numericId: 100,
        hasMounted: true,
        chaptersWithPagination: mockChapters,
        totalVolumePages: 3,
        fontSize: 18,
        readingMode: 'paginated',
        readingStatus: 'finished',
      })
    );

    await act(async () => {});

    await act(async () => {
      result.current.handleRestart();
    });

    expect(useReaderStore.getState().readingProgress[100]).toBe(0);
    expect(useBookshelfStore.getState().bookStatuses[100]).toBe('currently_reading');
    expect(result.current.activeChapterIndex).toBe(0);
    expect(result.current.currentChapterPage).toBe(1);
    expect(result.current.resumeNotice).toBeNull();
  });

  it('jumps directly to a specified chapter and page using jumpTo', () => {
    const { result } = renderHook(() =>
      useReaderSession({
        numericId: 100,
        hasMounted: true,
        chaptersWithPagination: mockChapters,
        totalVolumePages: 3,
        fontSize: 18,
        readingMode: 'paginated',
      })
    );

    act(() => {
      result.current.jumpTo(1, 1);
    });

    expect(result.current.activeChapterIndex).toBe(1);
    expect(result.current.currentChapterPage).toBe(1);
  });

  it('works with default internalized hasMounted when not explicitly passed', () => {
    const { result } = renderHook(() =>
      useReaderSession({
        numericId: 100,
        chaptersWithPagination: mockChapters,
        totalVolumePages: 3,
        fontSize: 18,
        readingMode: 'paginated',
      })
    );

    expect(result.current.activeChapterIndex).toBe(0);
    expect(result.current.currentChapterPage).toBe(1);
  });

  it('does not save reading position or progress on initial load when remaining on Page 1', async () => {
    useReaderStore.setState({
      readingPositions: {},
      readingProgress: {},
    });

    const { result } = renderHook(() =>
      useReaderSession({
        numericId: 200,
        hasMounted: true,
        chaptersWithPagination: mockChapters,
        totalVolumePages: 5,
        fontSize: 18,
        readingMode: 'paginated',
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.activeChapterIndex).toBe(0);
    expect(result.current.currentChapterPage).toBe(1);
    expect(useReaderStore.getState().getReadingPosition(200)).toBeNull();
    expect(useReaderStore.getState().getProgress(200)).toBe(0);
    expect(useReaderStore.getState().readingProgress[200]).toBeUndefined();
  });

  it('records reading position and progress immediately upon advancing to Page 2', async () => {
    useReaderStore.setState({
      readingPositions: {},
      readingProgress: {},
    });

    const { result } = renderHook(() =>
      useReaderSession({
        numericId: 300,
        hasMounted: true,
        chaptersWithPagination: mockChapters,
        totalVolumePages: 5,
        fontSize: 18,
        readingMode: 'paginated',
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    // Before advancing: no position saved
    expect(useReaderStore.getState().getReadingPosition(300)).toBeNull();

    // Advance to Page 2
    act(() => {
      result.current.handleNextPage();
    });

    expect(result.current.currentChapterPage).toBe(2);
    const savedPos = useReaderStore.getState().getReadingPosition(300);
    expect(savedPos).not.toBeNull();
    expect(savedPos?.chapterPage).toBe(2);
    expect(savedPos?.globalPage).toBe(2);
    expect(useReaderStore.getState().getProgress(300)).toBeGreaterThan(0);
  });

  it('restores saved bookmarkRow with line resumeNotice, persists setBookmarkRow on Page 1, and resets bookmarkRow on page turn', async () => {
    useReaderStore.setState({
      readingPositions: {
        400: {
          chapterIndex: 0,
          chapterPage: 1,
          globalPage: 1,
          bookmarkRow: 7,
          lastReadAt: '2026-10-25T10:00:00.000Z',
        },
      },
      readingProgress: {},
    });

    const { result } = renderHook(() =>
      useReaderSession({
        numericId: 400,
        hasMounted: true,
        chaptersWithPagination: mockChapters,
        totalVolumePages: 5,
        fontSize: 18,
        readingMode: 'paginated',
      })
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.bookmarkRow).toBe(7);
    expect(result.current.resumeNotice).toEqual(
      expect.objectContaining({
        page: 1,
        row: 8,
      })
    );

    // Move bookmark to row 11
    act(() => {
      result.current.setBookmarkRow(11);
    });
    expect(result.current.bookmarkRow).toBe(11);
    expect(useReaderStore.getState().getReadingPosition(400)?.bookmarkRow).toBe(11);

    // Turning to next page resets bookmarkRow to 0
    act(() => {
      result.current.handleNextPage();
    });
    expect(result.current.currentChapterPage).toBe(2);
    expect(result.current.bookmarkRow).toBe(0);
    expect(useReaderStore.getState().getReadingPosition(400)?.bookmarkRow).toBeUndefined();
  });

  it('supports initialPosition override, scroll mode content, dynamic pagination fallback, within-chapter prevPage, and dismissResumeNotice', async () => {
    vi.useFakeTimers();
    try {
      const chaptersWithoutPrecomputedPages: ChapterSection[] = [
        {
          id: 1,
          title: '',
          displayTitle: '',
          content: 'Word '.repeat(600),
          pageCount: 2,
          startPageNumber: 1,
        },
        {
          id: 2,
          title: '',
          displayTitle: '',
          content: 'Second chapter content',
          pageCount: 1,
          startPageNumber: 3,
        },
      ];

      const { result, rerender } = renderHook(
        ({ mode }: { mode: 'paginated' | 'scroll' }) =>
          useReaderSession({
            numericId: 500,
            hasMounted: true,
            chaptersWithPagination: chaptersWithoutPrecomputedPages,
            totalVolumePages: 3,
            fontSize: 18,
            readingMode: mode,
            initialPosition: { chapterIndex: 1, chapterPage: 1 },
          }),
        { initialProps: { mode: 'paginated' } }
      );

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.activeChapterIndex).toBe(1);
      expect(result.current.currentChapterPage).toBe(1);
      expect(result.current.resumeNotice).toEqual({
        chapterTitle: 'Chapter 1',
        page: 3,
      });

      // Dismiss resume notice manually
      act(() => {
        result.current.dismissResumeNotice();
      });
      expect(result.current.resumeNotice).toBeNull();

      // Switch to Chapter 0 Page 2 and test handlePrevPage within the same chapter (currentChapterPage > 1)
      act(() => {
        result.current.jumpTo(0, 2);
      });
      expect(result.current.currentChapterPage).toBe(2);
      act(() => {
        result.current.handlePrevPage();
      });
      expect(result.current.activeChapterIndex).toBe(0);
      expect(result.current.currentChapterPage).toBe(1);

      // Switch to scroll mode and verify full chapter content is returned
      rerender({ mode: 'scroll' });
      expect(result.current.currentPageText).toBe('Word '.repeat(600));

      act(() => {
        vi.advanceTimersByTime(4500);
      });
    } finally {
      vi.useRealTimers();
    }
  });
});
