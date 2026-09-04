import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useContinueReadingLedger } from './useContinueReadingLedger';
import { useReaderStore } from '@/stores/useReaderStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import type { GutendexBook } from '@/types/book.types';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  const TestWrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
  TestWrapper.displayName = 'TestWrapper';
  return { queryClient, TestWrapper };
}

function renderLedgerHook() {
  const { queryClient, TestWrapper } = createWrapper();
  const hookResult = renderHook(() => useContinueReadingLedger(), {
    wrapper: TestWrapper,
  });
  return { ...hookResult, queryClient };
}

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
    const { result } = renderLedgerHook();

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

    const { result } = renderLedgerHook();

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

    const { result } = renderLedgerHook();

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

    const { result } = renderLedgerHook();

    await act(async () => {
      await result.current.updateVolumeStatus(1342, 'completed');
    });

    expect(useBookshelfStore.getState().bookStatuses[1342]).toBe('finished');
    expect(useReaderStore.getState().readingProgress[1342]).toBe(100);
  });

  it('clears volume progress, coordinates, and recentBooks via clearVolumeProgress', () => {
    act(() => {
      useBookshelfStore.setState({ savedBooks: [mockBook], recentBooks: [mockBook] });
      useReaderStore.getState().setProgress(1342, 50);
      useReaderStore.getState().saveReadingPosition(1342, {
        chapterIndex: 5,
        chapterPage: 1,
        globalPage: 40,
        lastReadAt: '2026-09-01T12:00:00Z',
      });
    });

    const { result } = renderLedgerHook();

    act(() => {
      result.current.clearVolumeProgress(1342);
    });

    expect(useReaderStore.getState().readingProgress[1342]).toBe(0);
    expect(useReaderStore.getState().readingPositions[1342]).toBeUndefined();
    expect(useBookshelfStore.getState().recentBooks).toEqual([mockBook]);
  });

  it('filters volumes by search query across title, author, and subject', () => {
    const book2: GutendexBook = {
      ...mockBook,
      id: 84,
      title: 'Frankenstein; Or, The Modern Prometheus',
      authors: [{ name: 'Shelley, Mary Wollstonecraft', birth_year: 1797, death_year: 1851 }],
      subjects: ['Monsters -- Fiction', 'Science fiction'],
    };

    act(() => {
      useBookshelfStore.setState({ savedBooks: [mockBook, book2] });
      useReaderStore.getState().setProgress(1342, 30);
      useReaderStore.getState().setProgress(84, 75);
    });

    const { result } = renderLedgerHook();

    expect(result.current.volumes).toHaveLength(2);
    expect(result.current.filteredVolumes).toHaveLength(2);

    // Search by title keyword
    act(() => {
      result.current.setSearchQuery('Frankenstein');
    });
    expect(result.current.filteredVolumes).toHaveLength(1);
    expect(result.current.filteredVolumes[0].book.id).toBe(84);

    // Search by author name keyword
    act(() => {
      result.current.setSearchQuery('Mary');
    });
    expect(result.current.filteredVolumes).toHaveLength(1);
    expect(result.current.filteredVolumes[0].book.id).toBe(84);

    // Search by subject keyword
    act(() => {
      result.current.setSearchQuery('England');
    });
    expect(result.current.filteredVolumes).toHaveLength(1);
    expect(result.current.filteredVolumes[0].book.id).toBe(1342);

    // Clear search query
    act(() => {
      result.current.setSearchQuery('');
    });
    expect(result.current.filteredVolumes).toHaveLength(2);
  });

  it('wipes all ledger progress and coordinates via clearAllVolumes without mutating bookshelf curation', () => {
    act(() => {
      useBookshelfStore.setState({
        savedBooks: [mockBook],
        recentBooks: [mockBook],
        bookStatuses: { 1342: 'currently_reading', 999: 'finished' },
      });
      useReaderStore.getState().setProgress(1342, 40);
      useReaderStore.getState().saveReadingPosition(1342, {
        chapterIndex: 2,
        chapterPage: 3,
        globalPage: 15,
        lastReadAt: '2026-09-02T10:00:00Z',
      });
    });

    const { result } = renderLedgerHook();

    expect(result.current.volumes.length).toBe(1);

    act(() => {
      result.current.clearAllVolumes();
    });

    expect(useReaderStore.getState().readingProgress).toEqual({});
    expect(useReaderStore.getState().readingPositions).toEqual({});
    expect(useBookshelfStore.getState().recentBooks).toEqual([mockBook]);
    expect(useBookshelfStore.getState().bookStatuses[1342]).toBe('currently_reading');
    expect(useBookshelfStore.getState().bookStatuses[999]).toBe('finished');
    expect(result.current.volumes).toEqual([]);
  });

  it('rounds floating-point readingProgress to the nearest integer', () => {
    act(() => {
      useBookshelfStore.setState({ savedBooks: [mockBook] });
      useReaderStore.setState({
        readingProgress: { 1342: 0.5780346820809248 },
      });
    });

    const { result } = renderLedgerHook();

    expect(result.current.volumes).toHaveLength(1);
    expect(result.current.volumes[0].progressPercent).toBe(1);
  });

  it('excludes un-opened books that are only in recentBooks or bookStatuses with 0 progress', () => {
    act(() => {
      useBookshelfStore.setState({
        savedBooks: [mockBook],
        recentBooks: [{ ...mockBook, id: 9999 }],
        bookStatuses: { 8888: 'currently_reading' },
      });
    });

    const { result } = renderLedgerHook();

    expect(result.current.volumes).toEqual([]);
    expect(result.current.counts.all).toBe(0);
  });

  it('resolves real title and author via resolveBookMetadata when book is not in savedBooks', () => {
    act(() => {
      useReaderStore.getState().setProgress(1342, 20);
      useReaderStore.getState().saveReadingPosition(1342, {
        chapterIndex: 1,
        chapterPage: 2,
        globalPage: 10,
        lastReadAt: new Date().toISOString(),
      });
    });

    const { result } = renderLedgerHook();

    expect(result.current.volumes).toHaveLength(1);
    expect(result.current.volumes[0].book.title).toBe('Pride and Prejudice');
    expect(result.current.volumes[0].book.authors).toEqual(['Jane Austen']);
  });

  it('actively queries and hydrates missing book metadata (e.g. Volume #55179) and caches in recentBooks', async () => {
    act(() => {
      useReaderStore.getState().setProgress(55179, 42);
      useReaderStore.getState().saveReadingPosition(55179, {
        chapterIndex: 2,
        chapterPage: 3,
        globalPage: 15,
        lastReadAt: new Date().toISOString(),
      });
    });

    const { result } = renderLedgerHook();

    // Initially has 1 volume
    expect(result.current.volumes).toHaveLength(1);

    // Wait for useBooks query to resolve from MSW and hydrate metadata
    await waitFor(() => {
      expect(result.current.volumes[0].book.title).toBe('The King in Yellow');
    });

    expect(result.current.volumes[0].book.authors).toEqual(['Robert W. Chambers']);
    expect(result.current.volumes[0].progressPercent).toBe(42);
    expect(result.current.volumes[0].book.subjects).toContain('Gothic fiction');
  });
});

