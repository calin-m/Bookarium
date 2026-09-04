import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContinueReadingLedger } from './useContinueReadingLedger';
import { useReaderStore } from '@/stores/useReaderStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import type { GutendexBook } from '@/types/book.types';

const mockBook: GutendexBook = {
  id: 1342,
  title: 'Pride and Prejudice',
  authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
  translators: [],
  subjects: ['England -- Social life and customs -- Fiction'],
  bookshelves: ['Best Books Ever'],
  languages: ['en'],
  copyright: false,
  media_type: 'Text',
  formats: {
    'image/jpeg': 'https://www.gutenberg.org/cover1342.jpg',
    'application/epub+zip': 'https://www.gutenberg.org/epub1342.epub',
  },
  download_count: 65432,
};

describe('useContinueReadingLedger', () => {
  beforeEach(() => {
    // Reset stores
    useReaderStore.setState({
      readingProgress: {},
      readingPositions: {},
      currentBook: null,
    });
    useBookshelfStore.setState({
      savedBooks: [],
      recentBooks: [],
      bookStatuses: {},
    });
  });

  it('returns empty list when no books have reading activity or saved state', () => {
    const { result } = renderHook(() => useContinueReadingLedger());

    expect(result.current.volumes).toEqual([]);
    expect(result.current.filteredVolumes).toEqual([]);
    expect(result.current.counts).toEqual({
      all: 0,
      in_progress: 0,
      completed: 0,
      on_hold: 0,
    });
    expect(result.current.activeFilter).toBe('all');
  });

  it('aggregates reading activity and normalizes metadata into canonical Book', () => {
    act(() => {
      useBookshelfStore.setState({ savedBooks: [mockBook] });
      useReaderStore.getState().setProgress(1342, 35);
      useReaderStore.getState().saveReadingPosition(1342, {
        chapterIndex: 3,
        chapterPage: 4,
        globalPage: 28,
        lastReadAt: '2026-09-01T12:00:00Z',
      });
    });

    const { result } = renderHook(() => useContinueReadingLedger());

    expect(result.current.volumes).toHaveLength(1);
    const item = result.current.volumes[0];

    expect(item.book.id).toBe(1342);
    expect(item.book.title).toBe('Pride and Prejudice');
    expect(item.book.authors).toEqual(['Jane Austen']);
    expect(item.progressPercent).toBe(35);
    expect(item.chapterIndex).toBe(3);
    expect(item.chapterPage).toBe(4);
    expect(item.globalPage).toBe(28);
    expect(item.status).toBe('in_progress');
    expect(result.current.counts.in_progress).toBe(1);
  });

  it('filters volumes by tab (all, in_progress, completed, on_hold)', async () => {
    act(() => {
      useBookshelfStore.setState({
        savedBooks: [
          mockBook,
          { ...mockBook, id: 84, title: 'Frankenstein' },
          { ...mockBook, id: 2701, title: 'Moby Dick' },
        ],
        bookStatuses: {
          84: 'finished',
          2701: 'want_to_read',
        },
      });

      useReaderStore.getState().setProgress(1342, 50);
      useReaderStore.getState().setProgress(84, 100);
      useReaderStore.getState().setProgress(2701, 10);
    });

    const { result } = renderHook(() => useContinueReadingLedger());

    expect(result.current.counts.all).toBe(3);
    expect(result.current.counts.in_progress).toBe(1);
    expect(result.current.counts.completed).toBe(1);
    expect(result.current.counts.on_hold).toBe(1);

    // Switch to completed
    act(() => {
      result.current.setActiveFilter('completed');
    });
    expect(result.current.filteredVolumes).toHaveLength(1);
    expect(result.current.filteredVolumes[0].book.id).toBe(84);

    // Switch to on_hold
    act(() => {
      result.current.setActiveFilter('on_hold');
    });
    expect(result.current.filteredVolumes).toHaveLength(1);
    expect(result.current.filteredVolumes[0].book.id).toBe(2701);
  });

  it('updates volume status and completes progress when set to completed', async () => {
    act(() => {
      useBookshelfStore.setState({ savedBooks: [mockBook] });
      useReaderStore.getState().setProgress(1342, 20);
    });

    const { result } = renderHook(() => useContinueReadingLedger());

    await act(async () => {
      await result.current.updateVolumeStatus(1342, 'completed');
    });

    expect(useBookshelfStore.getState().bookStatuses[1342]).toBe('finished');
    expect(useReaderStore.getState().readingProgress[1342]).toBe(100);
  });

  it('clears volume progress and coordinates via clearVolumeProgress', () => {
    act(() => {
      useBookshelfStore.setState({ savedBooks: [mockBook] });
      useReaderStore.getState().setProgress(1342, 50);
      useReaderStore.getState().saveReadingPosition(1342, {
        chapterIndex: 5,
        chapterPage: 1,
        globalPage: 40,
        lastReadAt: '2026-09-01T12:00:00Z',
      });
    });

    const { result } = renderHook(() => useContinueReadingLedger());

    act(() => {
      result.current.clearVolumeProgress(1342);
    });

    expect(useReaderStore.getState().readingProgress[1342]).toBe(0);
    expect(useReaderStore.getState().readingPositions[1342]).toBeUndefined();
  });
});

