import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersonalCollectionsController } from './usePersonalCollectionsController';
import { DOWNLOADED_SHELF_ID } from '@/components/presentation/BookshelfRack';
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

  it('excludes is_default shelves from bookshelfDrawerShelves and supports Favorites preset sorting in Bookshelf', () => {
    useBookshelfStore.setState({
      savedBooks: sampleBooks,
      favoriteBooks: [sampleBooks[0]],
      favoriteBookIds: [1342],
      activeBookshelfId: null,
      cloudBookshelves: [
        {
          id: 'default-shelf',
          user_id: 'u1',
          name: 'Favorites', // Simulated legacy raw DB name on default shelf
          is_default: true,
          created_at: '',
          updated_at: '',
        },
        {
          id: 'custom-shelf',
          user_id: 'u1',
          name: 'Interested In',
          is_default: false,
          created_at: '',
          updated_at: '',
        },
      ],
      cloudBookshelfItems: [
        { id: 'item-1', bookshelf_id: 'default-shelf', user_id: 'u1', book_id: 1342, book_title: 'Pride and Prejudice', book_authors: [], cover_url: null, added_at: '' },
        { id: 'item-2', bookshelf_id: 'custom-shelf', user_id: 'u1', book_id: 84, book_title: 'Frankenstein', book_authors: [], cover_url: null, added_at: '' },
      ],
    });

    const { result } = renderHook(() =>
      usePersonalCollectionsController({
        hasMounted: true,
        activeView: 'bookshelf',
        isMobile: false,
        isOffline: false,
        isBookOffline: (id) => id === 1342,
        offlineBooks: [sampleBooks[0]],
        catalogResults: sampleBooks,
      })
    );

    // Leaked is_default shelf name ('Favorites') must NOT duplicate 'All Books'
    expect(result.current.bookshelfDrawerShelves.map((s) => s.label)).toEqual([
      'All Books',
      'Downloaded',
      'Interested In',
    ]);
    expect(result.current.shelfSortBy).toBe('recent');
    expect(result.current.bookshelfActiveFilterCount).toBe(0);
    expect(result.current.paginatedSavedBooks.map((b) => b.id)).toEqual([1342, 84]);

    // Select Favorites preset via Bookshelf Sort dropdown / Sort By chips
    act(() => {
      result.current.setShelfSortBy('favorites');
    });
    expect(result.current.shelfSortBy).toBe('favorites');
    expect(result.current.shelfSortBase).toBe('favorites');
    expect(result.current.isShelfDirDisabled).toBe(true);
    expect(result.current.bookshelfActiveFilterCount).toBe(1);
    expect(result.current.paginatedSavedBooks.map((b) => b.id)).toEqual([1342]);

    // Switch to custom shelf ('Interested In', containing only Frankenstein #84 which is not favorited)
    act(() => {
      result.current.handleDrawerSelectShelf('custom-shelf');
    });
    expect(result.current.bookshelfActiveFilterCount).toBe(2);
    expect(result.current.paginatedSavedBooks).toEqual([]);
    expect(result.current.emptyStateCopy.title).toBe('No favorited volumes on this shelf');

    // Downloaded virtual tab + Favorites preset retains offline favorited volume
    act(() => {
      result.current.handleDrawerSelectShelf(DOWNLOADED_SHELF_ID);
    });
    expect(result.current.isViewingDownloaded).toBe(true);
    expect(result.current.paginatedSavedBooks.map((b) => b.id)).toEqual([1342]);

    // Resetting back to 'all' and default sort clears active filters
    act(() => {
      result.current.handleDrawerSelectShelf('all');
      result.current.setShelfSortBy('recent');
    });
    expect(result.current.paginatedSavedBooks.map((b) => b.id)).toEqual([1342, 84]);
  });
});
