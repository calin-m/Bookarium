import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useCollectionAutoHeal } from './useCollectionAutoHeal';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useAnnotationStore } from '@/stores/useAnnotationStore';
import { useFellowshipStore } from '@/stores/useFellowshipStore';
import type { GutendexBook } from '@/types/book.types';

// Mock useBooks hook
const mockUseBooks = vi.fn();
vi.mock('@/hooks/queries/useBooks', () => ({
  useBooks: (params: unknown, options: unknown) => mockUseBooks(params, options),
}));

let mockMounted = true;
vi.mock('@/hooks/useHasMounted', () => ({
  useHasMounted: () => mockMounted,
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const mockCompleteBook: GutendexBook = {
  id: 161,
  title: 'Sense and Sensibility',
  authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
  translators: [],
  subjects: ['Classic'],
  bookshelves: [],
  languages: ['en'],
  copyright: false,
  media_type: 'Text',
  formats: {},
  download_count: 1000,
};

const mockIncompleteBook: GutendexBook = {
  id: 21839,
  title: 'Sense and Sensibility (Incomplete)',
  authors: [{ name: 'Austen, Jane', birth_year: null, death_year: null }],
  translators: [],
  subjects: ['Classic'],
  bookshelves: [],
  languages: ['en'],
  copyright: false,
  media_type: 'Text',
  formats: {},
  download_count: 500,
};

describe('useCollectionAutoHeal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    try {
      sessionStorage.clear();
    } catch {
      // Safe fallback
    }
    useBookshelfStore.setState({
      favoriteBookIds: [],
      favoriteBooks: [],
      savedBooks: [],
      recentBooks: [],
      cloudBookshelfItems: [],
    });
    useReaderStore.setState({
      readingPositions: {},
      readingProgress: {},
      currentBook: null,
    });
    useAnnotationStore.setState({
      annotations: [],
      fellowAnnotations: [],
    });
    useFellowshipStore.setState({
      symposiums: [],
    });
    mockUseBooks.mockReturnValue({
      data: undefined,
      isLoading: false,
    });
  });

  it('stays dormant with 0 query params when all collections are healthy', () => {
    useBookshelfStore.setState({
      favoriteBookIds: [161],
      favoriteBooks: [mockCompleteBook],
      savedBooks: [mockCompleteBook],
    });

    const { result } = renderHook(() => useCollectionAutoHeal(), {
      wrapper: createWrapper(),
    });

    expect(result.current.missingFavoriteIds).toEqual([]);
    expect(result.current.incompleteSavedIds).toEqual([]);
    expect(result.current.totalMissingCount).toBe(0);
    expect(result.current.isHealing).toBe(false);

    expect(mockUseBooks).toHaveBeenCalledWith(undefined, { enabled: false });
  });

  it('detects missing favorite IDs and queries /api/books', async () => {
    useBookshelfStore.setState({
      favoriteBookIds: [161],
      favoriteBooks: [], // missing book object
      savedBooks: [mockCompleteBook],
    });

    mockUseBooks.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { result, rerender } = renderHook(() => useCollectionAutoHeal(), {
      wrapper: createWrapper(),
    });

    expect(result.current.missingFavoriteIds).toEqual([161]);
    expect(result.current.totalMissingCount).toBe(1);
    expect(mockUseBooks).toHaveBeenCalledWith(
      { ids: '161', includeRestrictedMetadata: true },
      { enabled: true }
    );

    // Simulate upstream data arrival
    mockUseBooks.mockReturnValue({
      data: { results: [mockCompleteBook] },
      isLoading: false,
    });
    rerender();

    await waitFor(() => {
      expect(useBookshelfStore.getState().favoriteBooks).toHaveLength(1);
      expect(useBookshelfStore.getState().favoriteBooks[0].id).toBe(161);
    });
  });

  it('detects incomplete saved books and enriches author lifespans', async () => {
    useBookshelfStore.setState({
      favoriteBookIds: [],
      favoriteBooks: [],
      savedBooks: [mockIncompleteBook],
    });

    mockUseBooks.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { result, rerender } = renderHook(() => useCollectionAutoHeal(), {
      wrapper: createWrapper(),
    });

    expect(result.current.incompleteSavedIds).toEqual([21839]);
    expect(result.current.totalMissingCount).toBe(1);
    expect(mockUseBooks).toHaveBeenCalledWith(
      { ids: '21839', includeRestrictedMetadata: true },
      { enabled: true }
    );

    const healedBook: GutendexBook = {
      ...mockIncompleteBook,
      authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
    };

    mockUseBooks.mockReturnValue({
      data: { results: [healedBook] },
      isLoading: false,
    });
    rerender();

    await waitFor(() => {
      const saved = useBookshelfStore.getState().savedBooks;
      expect(saved[0].authors[0].death_year).toBe(1817);
    });
  });

  it('deduplicates book IDs when a book is in both favorites and bookshelf', () => {
    useBookshelfStore.setState({
      favoriteBookIds: [21839],
      favoriteBooks: [],
      savedBooks: [mockIncompleteBook],
    });

    renderHook(() => useCollectionAutoHeal(), {
      wrapper: createWrapper(),
    });

    expect(mockUseBooks).toHaveBeenCalledWith(
      { ids: '21839', includeRestrictedMetadata: true },
      { enabled: true }
    );
  });

  it('does not loop and terminates cleanly when upstream books also lack author lifespans', async () => {
    useBookshelfStore.setState({
      favoriteBookIds: [],
      favoriteBooks: [],
      savedBooks: [mockIncompleteBook],
    });

    mockUseBooks.mockReturnValue({
      data: { results: [mockIncompleteBook] },
      isLoading: false,
    });

    const enrichSpy = vi.spyOn(useBookshelfStore.getState(), 'enrichSavedBooks');

    const { result, rerender } = renderHook(() => useCollectionAutoHeal(), {
      wrapper: createWrapper(),
    });

    rerender();
    rerender();

    expect(enrichSpy).toHaveBeenCalledTimes(1);
    expect(result.current.incompleteSavedIds).toEqual([]);
  });

  it('synchronously enriches featured hero books without firing network queries', async () => {
    const incompleteHomer: GutendexBook = {
      id: 1727,
      title: 'The Odyssey',
      authors: [{ name: 'Homer', birth_year: null, death_year: null }],
      translators: [],
      subjects: ['Epic poetry'],
      bookshelves: [],
      languages: ['en'],
      copyright: false,
      media_type: 'Text',
      formats: {},
      download_count: 500,
    };

    useBookshelfStore.setState({
      favoriteBookIds: [],
      favoriteBooks: [],
      savedBooks: [incompleteHomer],
    });

    const { result } = renderHook(() => useCollectionAutoHeal(), {
      wrapper: createWrapper(),
    });

    expect(result.current.incompleteSavedIds).toEqual([]);
    expect(result.current.totalMissingCount).toBe(0);
    expect(mockUseBooks).toHaveBeenCalledWith(undefined, { enabled: false });

    await waitFor(() => {
      const saved = useBookshelfStore.getState().savedBooks;
      expect(saved[0].authors[0].death_year).toBe(-750);
    });
  });

  it('detects incomplete books with empty authors array and queries /api/books', () => {
    const bookWithNoAuthors: GutendexBook = {
      ...mockIncompleteBook,
      id: 9999,
      authors: [],
    };

    useBookshelfStore.setState({
      savedBooks: [bookWithNoAuthors],
    });

    const { result } = renderHook(() => useCollectionAutoHeal(), {
      wrapper: createWrapper(),
    });

    expect(result.current.incompleteSavedIds).toEqual([9999]);
  });

  it('returns empty collections and does not query when not mounted', () => {
    mockMounted = false;
    useBookshelfStore.setState({
      favoriteBookIds: [161],
      savedBooks: [mockIncompleteBook],
    });

    const { result } = renderHook(() => useCollectionAutoHeal(), {
      wrapper: createWrapper(),
    });

    expect(result.current.missingFavoriteIds).toEqual([]);
    expect(result.current.incompleteSavedIds).toEqual([]);
    expect(result.current.totalMissingCount).toBe(0);
    expect(result.current.isHealing).toBe(false);

    mockMounted = true;
  });

  it('suppresses redundant network queries for book IDs already attempted in sessionStorage', () => {
    sessionStorage.setItem('bookarium_auto_heal_attempted', JSON.stringify([21839]));

    useBookshelfStore.setState({
      savedBooks: [mockIncompleteBook],
    });

    const { result } = renderHook(() => useCollectionAutoHeal(), {
      wrapper: createWrapper(),
    });

    expect(result.current.incompleteSavedIds).toEqual([]);
    expect(result.current.totalMissingCount).toBe(0);
    expect(mockUseBooks).toHaveBeenCalledWith(undefined, { enabled: false });
  });

  it('detects and heals incomplete favoriteBooks and readingPositions lacking author lifespans', async () => {
    useBookshelfStore.setState({
      favoriteBookIds: [21839],
      favoriteBooks: [mockIncompleteBook],
      savedBooks: [],
    });
    useReaderStore.setState({
      readingPositions: {
        161: {
          chapterIndex: 1,
          chapterPage: 2,
          globalPage: 10,
          lastReadAt: '2026-09-01T12:00:00Z',
          bookTitle: 'Sense and Sensibility',
          bookAuthors: ['Austen, Jane'], // lacks embedded lifespan
        },
      },
    });

    mockUseBooks.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { result, rerender } = renderHook(() => useCollectionAutoHeal(), {
      wrapper: createWrapper(),
    });

    expect(result.current.missingFavoriteIds).toEqual([21839]);
    expect(result.current.incompleteSavedIds).toEqual([161]);
    expect(result.current.totalMissingCount).toBe(2);

    const healedFavorite: GutendexBook = {
      ...mockIncompleteBook,
      authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
    };

    mockUseBooks.mockReturnValue({
      data: { results: [healedFavorite, mockCompleteBook] },
      isLoading: false,
    });
    rerender();

    await waitFor(() => {
      const favs = useBookshelfStore.getState().favoriteBooks;
      expect(favs[0].authors[0].death_year).toBe(1817);
      const pos161 = useReaderStore.getState().readingPositions[161];
      expect(pos161.bookAuthors).toEqual(['Austen, Jane, 1775-1817']);
    });
  });

  it('detects and heals incomplete fellowAnnotations and active symposiums lacking author lifespans', async () => {
    useAnnotationStore.setState({
      fellowAnnotations: [
        {
          id: 'fa-11',
          bookId: 11, // Featured hero book -> healed synchronously on mount
          chapterIndex: 0,
          chapterPage: 1,
          selectedText: 'Down the rabbit-hole',
          color: 'amber',
          createdAt: '2026-10-15T10:00:00Z',
          updatedAt: '2026-10-15T10:00:00Z',
          isFellow: true,
          fellowUsername: 'clara_v',
        },
        {
          id: 'fa-55179',
          bookId: 55179, // Non-featured book -> added to incompleteSavedIds and healed via useBooks
          chapterIndex: 0,
          chapterPage: 1,
          selectedText: 'Along the shore the cloud waves break',
          color: 'amber',
          createdAt: '2026-10-15T10:00:00Z',
          updatedAt: '2026-10-15T10:00:00Z',
          isFellow: true,
          fellowUsername: 'clara_v',
        },
      ],
    });
    useFellowshipStore.setState({
      symposiums: [
        {
          id: 'sym-161',
          book_id: 161,
          book_title: 'Sense and Sensibility',
          book_author: 'Jane Austen',
          status: 'active',
        } as any,
      ],
    });

    mockUseBooks.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { result, rerender } = renderHook(() => useCollectionAutoHeal(), {
      wrapper: createWrapper(),
    });

    // Book 11 is synchronously healed from FEATURED_HERO_BOOKS, while 55179 and 161 are queued for remote healing
    expect(result.current.incompleteSavedIds).toEqual([55179, 161]);
    expect(useAnnotationStore.getState().fellowAnnotations[0].bookTitle).toBe("Alice's Adventures in Wonderland");
    expect(useAnnotationStore.getState().fellowAnnotations[0].bookAuthor).toBe('Lewis Carroll');

    const kingInYellowBook: GutendexBook = {
      ...mockCompleteBook,
      id: 55179,
      title: 'The King in Yellow',
      authors: [{ name: 'Chambers, Robert W.', birth_year: 1865, death_year: 1933 }],
    };

    mockUseBooks.mockReturnValue({
      data: { results: [kingInYellowBook, mockCompleteBook] },
      isLoading: false,
    });
    rerender();

    await waitFor(() => {
      const fellowAnn = useAnnotationStore.getState().fellowAnnotations[1];
      expect(fellowAnn.bookTitle).toBe('The King in Yellow');
      expect(fellowAnn.bookAuthor).toBe('Robert W. Chambers');
    });
  });
});

