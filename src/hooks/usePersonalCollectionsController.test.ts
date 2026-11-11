import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersonalCollectionsController } from './usePersonalCollectionsController';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import type { GutendexBook } from '@/types/book.types';

const sampleBooks: GutendexBook[] = [
  {
    id: 1342,
    title: 'Pride and Prejudice',
    authors: [{ name: 'Austen, Jane', birth_year: 1775, death_year: 1817 }],
    translators: [],
    subjects: ['Fiction'],
    bookshelves: [],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: {},
    download_count: 50000,
  },
  {
    id: 84,
    title: 'Frankenstein',
    authors: [{ name: 'Shelley, Mary', birth_year: 1797, death_year: 1851 }],
    translators: [],
    subjects: ['Gothic'],
    bookshelves: [],
    languages: ['en'],
    copyright: false,
    media_type: 'Text',
    formats: {},
    download_count: 42000,
  },
];

describe('usePersonalCollectionsController', () => {
  beforeEach(() => {
    useBookshelfStore.setState({
      savedBooks: sampleBooks,
      favoriteBooks: [sampleBooks[0]],
      favoriteBookIds: [1342],
      activeBookshelfId: null,
      cloudBookshelves: [],
      cloudBookshelfItems: [],
    });
  });

  it('filters, sorts, paginates, and clears bookshelf and favorites collections', async () => {
    const removeAllOfflineBooks = vi.fn().mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ activeView }) =>
        usePersonalCollectionsController({
          hasMounted: true,
          activeView,
          isMobile: false,
          isOffline: false,
          isBookOffline: (id) => id === 1342,
          offlineBooks: [sampleBooks[0]],
          catalogResults: sampleBooks,
          removeAllOfflineBooks,
        }),
      {
        initialProps: {
          activeView: 'bookshelf' as 'bookshelf' | 'favorites' | 'catalog',
        },
      }
    );

    expect(result.current.isShelf).toBe(true);
    expect(result.current.collectionCount).toBe(2);
    expect(result.current.paginatedSavedBooks).toHaveLength(2);

    // Search filtering on bookshelf
    act(() => {
      result.current.setCollectionSearchQuery('Frankenstein');
    });
    expect(result.current.paginatedSavedBooks.map((b) => b.id)).toEqual([84]);

    // Toggle sort direction
    act(() => {
      result.current.setShelfSortBy('title_asc');
    });
    expect(result.current.shelfSortBase).toBe('title');
    expect(result.current.shelfSortDir).toBe('asc');

    act(() => {
      result.current.handleCollectionDirectionToggle();
    });
    expect(result.current.shelfSortDir).toBe('desc');

    // Switching view resets collection search query
    rerender({ activeView: 'favorites' });
    expect(result.current.isFavorites).toBe(true);
    expect(result.current.collectionSearchQuery).toBe('');
    expect(result.current.paginatedFavoriteBooks.map((b) => b.id)).toEqual([
      1342,
    ]);

    // Confirm clear favorites
    act(() => {
      result.current.setConfirmClearType('favorites');
    });
    expect(result.current.clearModalCopy.title).toBe('Clear Favorite Books');

    await act(async () => {
      await result.current.handleConfirmClearCollection();
    });
    expect(result.current.confirmClearType).toBeNull();
    expect(useBookshelfStore.getState().favoriteBookIds).toEqual([]);
  });
});
