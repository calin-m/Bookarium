import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useContinueReadingLedger } from './useContinueReadingLedger';
import { useReaderStore } from '@/stores/useReaderStore';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import type { GutendexBook } from '@/types/book.types';

let mockOfflineBookIds: number[] = [];
let mockOfflineBooks: GutendexBook[] = [];
vi.mock('@/hooks/useOfflineBooks', () => ({
  useOfflineBooks: () => ({
    offlineBookIds: mockOfflineBookIds,
    offlineBooks: mockOfflineBooks,
    isBookOffline: (id: number) => mockOfflineBookIds.includes(id),
  }),
}));

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
    mockOfflineBookIds = [];
    useReaderStore.setState({
      readingProgress: {},
      readingPositions: {},
      currentBook: null,
    });
    useBookshelfStore.setState({
      savedBooks: [],
      favoriteBooks: [],
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

  it('allows transitioning completed volume back to in_progress with clean progress reset for re-reading', async () => {
    act(() => {
      useBookshelfStore.setState({
        savedBooks: [mockBook],
        bookStatuses: { 1342: 'finished' },
      });
      useReaderStore.getState().setProgress(1342, 100);
      useReaderStore.getState().saveReadingPosition(1342, {
        chapterIndex: 10,
        chapterPage: 5,
        globalPage: 120,
        lastReadAt: new Date().toISOString(),
      });
    });

    const { result } = renderLedgerHook();
    expect(result.current.volumes[0].status).toBe('completed');

    await act(async () => {
      await result.current.updateVolumeStatus(1342, 'in_progress');
    });

    expect(useBookshelfStore.getState().bookStatuses[1342]).toBe('currently_reading');
    expect(useReaderStore.getState().readingProgress[1342]).toBe(0);
    expect(result.current.volumes[0].status).toBe('in_progress');
  });

  it('allows transitioning completed volume to on_hold without getting trapped in completed', async () => {
    act(() => {
      useBookshelfStore.setState({
        savedBooks: [mockBook],
        bookStatuses: { 1342: 'finished' },
      });
      useReaderStore.getState().setProgress(1342, 100);
      useReaderStore.getState().saveReadingPosition(1342, {
        chapterIndex: 10,
        chapterPage: 5,
        globalPage: 120,
        lastReadAt: new Date().toISOString(),
      });
    });

    const { result } = renderLedgerHook();
    expect(result.current.volumes[0].status).toBe('completed');

    await act(async () => {
      await result.current.updateVolumeStatus(1342, 'on_hold');
    });

    expect(useBookshelfStore.getState().bookStatuses[1342]).toBe('want_to_read');
    expect(result.current.volumes[0].status).toBe('on_hold');

    // Update to in_progress when progress is 100% (resets position and progress to 0)
    act(() => {
      useReaderStore.getState().setProgress(1342, 100);
    });
    await act(async () => {
      await result.current.updateVolumeStatus(1342, 'in_progress');
    });
    expect(useReaderStore.getState().readingProgress[1342]).toBe(0);
    expect(useReaderStore.getState().readingPositions[1342].chapterPage).toBe(1);

    // Update to completed when progress is < 100% (sets progress to 100 and resets bookmarkRow/bookmarkText)
    act(() => {
      useReaderStore.getState().setProgress(1342, 50);
      useReaderStore.getState().saveReadingPosition(1342, {
        chapterIndex: 2,
        chapterPage: 3,
        globalPage: 20,
        bookmarkRow: 4,
        bookmarkText: 'It is a truth universally acknowledged',
        lastReadAt: new Date().toISOString(),
      });
    });
    expect(result.current.volumes[0].bookmarkRow).toBe(4);
    expect(result.current.volumes[0].bookmarkText).toBe('It is a truth universally acknowledged');

    await act(async () => {
      await result.current.updateVolumeStatus(1342, 'completed');
    });
    expect(useReaderStore.getState().readingProgress[1342]).toBe(100);
    expect(useReaderStore.getState().readingPositions[1342].bookmarkRow).toBeUndefined();
    expect(useReaderStore.getState().readingPositions[1342].bookmarkText).toBeUndefined();
    expect(result.current.volumes[0].bookmarkRow).toBeUndefined();
    expect(result.current.volumes[0].bookmarkText).toBeUndefined();
  });

  it('infers completed status when progress is 100% on uncurated volume', () => {
    act(() => {
      useBookshelfStore.setState({ savedBooks: [mockBook], bookStatuses: {} });
      useReaderStore.getState().setProgress(1342, 100);
    });

    const { result } = renderLedgerHook();
    expect(result.current.volumes[0].status).toBe('completed');
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

  it('immediately renders volumes using cloud-restored bookTitle and authors on readingPosition without calling useBooks', () => {
    act(() => {
      useReaderStore.getState().setProgress(7777, 65);
      useReaderStore.getState().saveReadingPosition(7777, {
        chapterIndex: 4,
        chapterPage: 2,
        globalPage: 45,
        lastReadAt: '2026-09-04T12:00:00Z',
        bookTitle: 'Cloud Restored Volume',
        bookAuthors: ['Archival Author'],
        coverUrl: 'https://example.com/cover7777.jpg',
      });
    });

    const { result } = renderLedgerHook();

    expect(result.current.volumes).toHaveLength(1);
    const volume = result.current.volumes[0];
    expect(volume.book.id).toBe(7777);
    expect(volume.book.title).toBe('Cloud Restored Volume');
    expect(volume.book.authors).toEqual(['Archival Author']);
    expect(volume.book.coverUrl).toBe('https://example.com/cover7777.jpg');
    expect(volume.progressPercent).toBe(65);
  });

  it('clears individual volume progress and all volumes via store methods', async () => {
    act(() => {
      useReaderStore.getState().setProgress(1342, 50);
      useReaderStore.getState().saveReadingPosition(1342, {
        chapterIndex: 1,
        chapterPage: 1,
        globalPage: 1,
        lastReadAt: new Date().toISOString(),
        bookTitle: 'Pride and Prejudice',
      });
    });

    const { result } = renderLedgerHook();
    expect(result.current.volumes).toHaveLength(1);

    await act(async () => {
      await result.current.clearVolumeProgress(1342);
    });

    expect(result.current.volumes).toHaveLength(0);

    act(() => {
      useReaderStore.getState().setProgress(84, 80);
      useReaderStore.getState().saveReadingPosition(84, {
        chapterIndex: 2,
        chapterPage: 2,
        globalPage: 2,
        lastReadAt: new Date().toISOString(),
        bookTitle: 'Frankenstein',
      });
    });

    expect(result.current.volumes).toHaveLength(1);

    await act(async () => {
      await result.current.clearAllVolumes();
    });

    expect(result.current.volumes).toHaveLength(0);
  });

  it('resolves authorDetails and lifespans for featured volumes without savedBooks or API data', () => {
    act(() => {
      useReaderStore.getState().setProgress(1727, 20);
      useReaderStore.getState().saveReadingPosition(1727, {
        chapterIndex: 2,
        chapterPage: 1,
        globalPage: 15,
        lastReadAt: new Date().toISOString(),
      });
    });

    const { result } = renderLedgerHook();
    expect(result.current.volumes).toHaveLength(1);
    const item = result.current.volumes[0];

    expect(item.book.id).toBe(1727);
    expect(item.book.title).toBe('The Odyssey');
    expect(item.book.authors).toEqual(['Homer']);
    expect(item.book.authorDetails).toEqual([
      { name: 'Homer', birth_year: -800, death_year: -750 },
    ]);
  });

  it('excludes legacy 0% Page-1 books from volumes unless they advance or have curation status', () => {
    act(() => {
      useReaderStore.setState({
        readingPositions: {
          999: {
            chapterIndex: 0,
            chapterPage: 1,
            globalPage: 1,
            lastReadAt: new Date().toISOString(),
            bookTitle: 'Ghost Preview Book',
          },
          1342: {
            chapterIndex: 0,
            chapterPage: 2,
            globalPage: 2,
            lastReadAt: new Date().toISOString(),
            bookTitle: 'Pride and Prejudice',
          },
        },
        readingProgress: {
          999: 0,
          1342: 5,
        },
      });
    });

    const { result } = renderLedgerHook();

    // 999 is excluded because it only reached page 1 with 0 progress
    // 1342 is included because it reached page 2
    expect(result.current.volumes).toHaveLength(1);
    expect(result.current.volumes[0].book.id).toBe(1342);
    expect(result.current.counts.all).toBe(1);
  });

  it('supports multi-attribute sorting by title, author, and progress', () => {
    act(() => {
      useReaderStore.setState({
        readingPositions: {
          1: {
            chapterIndex: 1,
            chapterPage: 2,
            globalPage: 5,
            lastReadAt: '2026-09-01T10:00:00.000Z',
            bookTitle: 'Zeno of Elea',
            bookAuthors: ['Parmenides'],
          },
          2: {
            chapterIndex: 2,
            chapterPage: 2,
            globalPage: 10,
            lastReadAt: '2026-09-03T10:00:00.000Z',
            bookTitle: 'Alice in Wonderland',
            bookAuthors: ['Lewis Carroll'],
          },
          3: {
            chapterIndex: 3,
            chapterPage: 2,
            globalPage: 15,
            lastReadAt: '2026-09-02T10:00:00.000Z',
            bookTitle: 'Middlemarch',
            bookAuthors: ['George Eliot'],
          },
        },
        readingProgress: {
          1: 10,
          2: 80,
          3: 45,
        },
      });
    });

    const { result } = renderLedgerHook();

    // Default: recent (lastReadAt descending: 2 (Sep 3), 3 (Sep 2), 1 (Sep 1))
    expect(result.current.filteredVolumes.map((v) => v.book.id)).toEqual([2, 3, 1]);

    // Sort: title_asc (Alice in Wonderland, Middlemarch, Zeno of Elea)
    act(() => {
      result.current.setSortBy('title_asc');
    });
    expect(result.current.filteredVolumes.map((v) => v.book.id)).toEqual([2, 3, 1]);

    // Sort: author_asc (George Eliot, Lewis Carroll, Parmenides)
    act(() => {
      result.current.setSortBy('author_asc');
    });
    expect(result.current.filteredVolumes.map((v) => v.book.id)).toEqual([3, 2, 1]);

    // Sort: progress_desc (80% (2), 45% (3), 10% (1))
    act(() => {
      result.current.setSortBy('progress_desc');
    });
    expect(result.current.filteredVolumes.map((v) => v.book.id)).toEqual([2, 3, 1]);

    // Sort: progress_asc (10% (1), 45% (3), 80% (2))
    act(() => {
      result.current.setSortBy('progress_asc');
    });
    expect(result.current.filteredVolumes.map((v) => v.book.id)).toEqual([1, 3, 2]);

    // Sort: title_desc & author_desc
    act(() => {
      result.current.setSortBy('title_desc');
    });
    expect(result.current.filteredVolumes.map((v) => v.book.id)).toEqual([1, 3, 2]);

    act(() => {
      result.current.setSortBy('author_desc');
    });
    expect(result.current.filteredVolumes.map((v) => v.book.id)).toEqual([1, 2, 3]);
  });

  it('enriches savedBooks lacking lifespans using posAuthorDetails or resolveBookMetadata', () => {
    act(() => {
      useBookshelfStore.setState({
        savedBooks: [
          {
            ...mockBook,
            id: 1342,
            authors: [{ name: 'Jane Austen', birth_year: null, death_year: null }],
          },
          {
            ...mockBook,
            id: 1727,
            title: 'The Odyssey',
            authors: [{ name: 'Homer', birth_year: null, death_year: null }],
          },
        ],
      });
      useReaderStore.setState({
        readingPositions: {
          1342: {
            chapterIndex: 1,
            chapterPage: 2,
            globalPage: 5,
            lastReadAt: '2026-09-05T12:00:00Z',
            bookTitle: 'Pride and Prejudice',
            bookAuthors: ['Austen, Jane, 1775-1817'],
          },
          1727: {
            chapterIndex: 1,
            chapterPage: 2,
            globalPage: 5,
            lastReadAt: '2026-09-04T12:00:00Z',
          },
        },
        readingProgress: { 1342: 20, 1727: 30 },
      });
    });

    const { result } = renderLedgerHook();
    expect(result.current.volumes).toHaveLength(2);
    expect(result.current.volumes[0].book.authorDetails?.[0].death_year).toBe(1817);
    expect(result.current.volumes[1].book.authorDetails?.[0].death_year).toBe(-750);
  });

  it('extracts authorDetails lifespans and normalizes display names from embedded dates in readingPosition.bookAuthors', () => {
    act(() => {
      useReaderStore.setState({
        readingPositions: {
          7777: {
            chapterIndex: 2,
            chapterPage: 3,
            globalPage: 12,
            lastReadAt: '2026-09-05T12:00:00Z',
            bookTitle: 'Persuasion',
            bookAuthors: ['Austen, Jane, 1775-1817'],
          },
        },
        readingProgress: {
          7777: 25,
        },
      });
    });

    const { result } = renderLedgerHook();

    expect(result.current.volumes).toHaveLength(1);
    const vol = result.current.volumes[0];
    expect(vol.book.authors).toEqual(['Jane Austen']);
    expect(vol.book.authorDetails).toEqual([
      {
        name: 'Austen, Jane, 1775-1817',
        birth_year: 1775,
        death_year: 1817,
      },
    ]);
  });

  it('preserves verified authorDetails lifespans from favoriteBooks/savedBooks when currentBook is a partial book', () => {
    act(() => {
      useBookshelfStore.setState({
        favoriteBooks: [mockBook],
      });
      useReaderStore.setState({
        currentBook: {
          id: 1342,
          title: 'Pride and Prejudice',
          authors: ['Jane Austen'],
          coverUrl: null,
          epubUrl: null,
          htmlUrl: null,
          txtUrl: null,
          downloadCount: 0,
          subjects: [],
          languages: ['en'],
        },
        readingProgress: { 1342: 50 },
      });
    });

    const { result } = renderLedgerHook();

    expect(result.current.volumes).toHaveLength(1);
    expect(result.current.volumes[0].book.authorDetails).toEqual([
      { name: 'Austen, Jane', birth_year: 1775, death_year: 1817 },
    ]);
  });

  it('filters volumes to only downloaded books when sortBy is "downloaded"', async () => {
    const bookOffline = { ...mockBook, id: 1342 };
    const bookNotOffline = { ...mockBook, id: 84, title: 'Frankenstein' };

    mockOfflineBookIds = [1342];

    act(() => {
      useBookshelfStore.setState({ savedBooks: [bookOffline, bookNotOffline] });
      useReaderStore.setState({
        readingProgress: { 1342: 40, 84: 80 },
      });
    });

    const { result } = renderLedgerHook();

    expect(result.current.filteredVolumes).toHaveLength(2);

    act(() => {
      result.current.setSortBy('downloaded');
    });

    await waitFor(() => {
      expect(result.current.filteredVolumes).toHaveLength(1);
      expect(result.current.filteredVolumes[0].book.id).toBe(1342);
    });
  });

  it('resolves volume metadata directly from offlineBooks when book is not in savedBooks or favoriteBooks', () => {
    mockOfflineBookIds = [1342];
    mockOfflineBooks = [mockBook];

    act(() => {
      useBookshelfStore.setState({ savedBooks: [], favoriteBooks: [], recentBooks: [] });
      useReaderStore.setState({
        readingProgress: { 1342: 65 },
      });
    });

    const { result } = renderLedgerHook();

    expect(result.current.volumes).toHaveLength(1);
    expect(result.current.volumes[0].book.title).toBe('Pride and Prejudice');
    expect(result.current.volumes[0].book.authors).toEqual(['Jane Austen']);

    mockOfflineBooks = [];
  });

  it('never overwrites authentic authors with Anonymous from offlineBooks in setOrMergeBook', () => {
    mockOfflineBookIds = [1342];
    mockOfflineBooks = [
      {
        ...mockBook,
        authors: [{ name: 'Anonymous', birth_year: null, death_year: null }],
      },
    ];

    act(() => {
      useBookshelfStore.setState({ savedBooks: [mockBook] });
      useReaderStore.setState({
        readingProgress: { 1342: 45 },
      });
    });

    const { result } = renderLedgerHook();

    expect(result.current.volumes).toHaveLength(1);
    expect(result.current.volumes[0].book.authors).toEqual(['Jane Austen']);
    expect(result.current.volumes[0].book.authorDetails).toBeDefined();

    mockOfflineBooks = [];
    mockOfflineBookIds = [];
  });

  it('heals Anonymous authors when readingPosition has authentic bookAuthors', () => {
    mockOfflineBookIds = [1342];
    mockOfflineBooks = [
      {
        ...mockBook,
        authors: [{ name: 'Anonymous', birth_year: null, death_year: null }],
      },
    ];

    act(() => {
      useBookshelfStore.setState({ savedBooks: [], favoriteBooks: [], recentBooks: [] });
      useReaderStore.setState({
        readingPositions: {
          1342: {
            bookTitle: 'Pride and Prejudice',
            bookAuthors: ['Austen, Jane'],
            chapterIndex: 1,
            chapterPage: 2,
            globalPage: 10,
            lastReadAt: '2026-10-01T12:00:00Z',
          },
        },
        readingProgress: { 1342: 30 },
      });
    });

    const { result } = renderLedgerHook();

    expect(result.current.volumes).toHaveLength(1);
    expect(result.current.volumes[0].book.authors).toEqual(['Jane Austen']);

    mockOfflineBooks = [];
    mockOfflineBookIds = [];
  });

  it('handles setOrMergeBook lifespan preservation, translator merging, and currentBook in missingIds', () => {
    // 1. Current book in useReaderStore recognized in known set
    act(() => {
      useReaderStore.setState({
        currentBook: {
          id: 55179,
          title: 'Current Volume',
          authors: [{ name: 'Current Author', birth_year: 1850, death_year: 1910 }],
          translators: [{ name: 'Translator 1', birth_year: 1860, death_year: 1920 }],
          subjects: ['Subject'],
          bookshelves: [],
          languages: ['en'],
          copyright: false,
          media_type: 'Text',
          formats: {},
          download_count: 50,
        },
        readingProgress: { 55179: 25 },
      });
      useBookshelfStore.setState({
        favoriteBooks: [
          {
            id: 55179,
            title: 'Current Volume',
            authors: [{ name: 'Current Author', birth_year: null, death_year: null }],
            translators: [],
            subjects: [],
            bookshelves: [],
            languages: ['en'],
            copyright: false,
            media_type: 'Text',
            formats: {},
            download_count: 50,
          },
        ],
      });
    });

    const { result } = renderLedgerHook();
    expect(result.current.volumes.find((v) => v.book.id === 55179)).toBeDefined();
    const vol = result.current.volumes.find((v) => v.book.id === 55179)!;
    expect(vol.book.authorDetails?.[0].birth_year).toBe(1850);
    expect(vol.book.translators?.length).toBeGreaterThan(0);
  });

  it('heals authorDetails from readingPositions with embedded lifespans when book has empty authors', () => {
    act(() => {
      useBookshelfStore.setState({ savedBooks: [], favoriteBooks: [], recentBooks: [] });
      useReaderStore.setState({
        readingPositions: {
          444: {
            bookTitle: 'Lifespan Book',
            bookAuthors: ['Doyle, Arthur Conan, 1859-1930'],
            chapterIndex: 0,
            chapterPage: 1,
            globalPage: 1,
            lastReadAt: '2026-10-01T12:00:00Z',
          },
        },
        readingProgress: { 444: 15 },
      });
    });

    const { result } = renderLedgerHook();
    const vol = result.current.volumes.find((v) => v.book.id === 444);
    expect(vol).toBeDefined();
    expect(vol?.book.authors).toEqual(['Arthur Conan Doyle']);
    expect(vol?.book.authorDetails?.[0].birth_year).toBe(1859);
    expect(vol?.book.authorDetails?.[0].death_year).toBe(1930);
  });

  it('preserves existing authors and translators when candidate from offline has anonymous author and empty translators', () => {
    act(() => {
      useBookshelfStore.setState({
        savedBooks: [
          {
            id: 8881,
            title: 'Translated Work',
            authors: [{ name: 'Original Author', birth_year: 1820, death_year: 1890 }],
            translators: [{ name: 'Renowned Translator', birth_year: 1850, death_year: 1910 }],
            subjects: [],
            bookshelves: [],
            languages: ['en'],
            copyright: false,
            media_type: 'Text',
            formats: {},
            download_count: 100,
          },
        ],
        favoriteBooks: [],
        recentBooks: [],
      });
      useReaderStore.setState({
        readingPositions: {
          8881: {
            bookTitle: 'Translated Work',
            bookAuthors: ['Anonymous'],
            chapterIndex: 0,
            chapterPage: 1,
            globalPage: 2,
            lastReadAt: '2026-10-01T12:00:00Z',
          },
        },
        readingProgress: { 8881: 25 },
      });
    });

    const { result } = renderLedgerHook();
    const vol = result.current.volumes.find((v) => v.book.id === 8881);
    expect(vol).toBeDefined();
    expect(vol?.book.authors).toEqual(['Original Author']);
    expect(vol?.book.translators).toEqual([
      { name: 'Renowned Translator', birth_year: 1850, death_year: 1910 },
    ]);
  });

  it('covers bookmarkRow inclusion at 0% progress, position authorDetails healing on anonymous book, and Public Domain Author fallbacks', () => {
    mockOfflineBookIds = [1342];
    mockOfflineBooks = [
      {
        ...mockBook,
        id: 1342,
        authors: [{ name: 'Anonymous', birth_year: null, death_year: null }],
      },
    ];

    act(() => {
      useBookshelfStore.setState({ savedBooks: [], favoriteBooks: [], recentBooks: [] });
      useReaderStore.setState({
        readingPositions: {
          // 1. 0% progress on page 1, but has bookmarkRow > 0 AND heals anonymous offline book with lifespan
          1342: {
            chapterIndex: 0,
            chapterPage: 1,
            globalPage: 1,
            bookmarkRow: 14,
            lastReadAt: '2026-10-05T12:00:00Z',
            bookTitle: 'Pride and Prejudice',
            bookAuthors: ['Austen, Jane, 1775-1817'],
          },
          // 2. Unknown book with position.bookTitle but empty bookAuthors -> falls back to Public Domain Author
          999991: {
            chapterIndex: 1,
            chapterPage: 2,
            globalPage: 5,
            lastReadAt: '2026-10-04T12:00:00Z',
            bookTitle: 'Mystery Codex',
            bookAuthors: [],
          },
          // 3. Unknown book without position.bookTitle -> falls back to Volume #id and Public Domain Author
          999992: {
            chapterIndex: 1,
            chapterPage: 2,
            globalPage: 5,
            lastReadAt: '2026-10-03T12:00:00Z',
          },
        },
        readingProgress: {
          1342: 0,
          999991: 10,
          999992: 20,
        },
      });
    });

    const { result } = renderLedgerHook();
    const vol1342 = result.current.volumes.find((v) => v.book.id === 1342);
    expect(vol1342?.bookmarkRow).toBe(14);
    expect(vol1342?.book.authorDetails?.[0].death_year).toBe(1817);

    const vol999991 = result.current.volumes.find((v) => v.book.id === 999991);
    expect(vol999991?.book.title).toBe('Mystery Codex');
    expect(vol999991?.book.authors).toEqual(['Public Domain Author']);

    const vol999992 = result.current.volumes.find((v) => v.book.id === 999992);
    expect(vol999992?.book.authors).toEqual(['Public Domain Author']);

    mockOfflineBooks = [];
    mockOfflineBookIds = [];
  });
});

