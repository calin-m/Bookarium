import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useReaderSession } from './useReaderSession';
import { useReaderStore } from '@/stores/useReaderStore';
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

  it('allows chapter selection and restart to chapter 0 page 1', () => {
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

    act(() => {
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
});
