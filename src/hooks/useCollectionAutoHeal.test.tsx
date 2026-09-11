import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useCollectionAutoHeal } from './useCollectionAutoHeal';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import type { GutendexBook } from '@/types/book.types';

// Mock useBooks hook
const mockUseBooks = vi.fn();
vi.mock('@/hooks/queries/useBooks', () => ({
  useBooks: (params: unknown, options: unknown) => mockUseBooks(params, options),
}));

// Mock useHasMounted to true
vi.mock('@/hooks/useHasMounted', () => ({
  useHasMounted: () => true,
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
    useBookshelfStore.setState({
      favoriteBookIds: [],
      favoriteBooks: [],
      savedBooks: [],
      cloudBookshelfItems: [],
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
    expect(mockUseBooks).toHaveBeenCalledWith({ ids: '161' }, { enabled: true });

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
    expect(mockUseBooks).toHaveBeenCalledWith({ ids: '21839' }, { enabled: true });

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

    expect(mockUseBooks).toHaveBeenCalledWith({ ids: '21839' }, { enabled: true });
  });
});

