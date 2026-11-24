import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePersonalCollectionsController } from './usePersonalCollectionsController';
import { DOWNLOADED_SHELF_ID } from '@/components/presentation/BookshelfRack';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import type { CatalogBook } from '@/types/book.types';

const sampleBooks: CatalogBook[] = [
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
    expect(result.current.isShelfFavoritesActive).toBe(false);
    expect(result.current.shelfFavoritesCount).toBe(1);
    expect(result.current.toolbarShelfSortBase).toBe('recent');
    expect(result.current.drawerShelfSortBase).toBe('recent');
    expect(result.current.bookshelfActiveFilterCount).toBe(0);
    expect(result.current.paginatedSavedBooks.map((b) => b.id)).toEqual([1342, 84]);

    // 1. Desktop top-bar Favorites dropdown selection keeps direction locked on toolbar,
    // while mapping drawer state cleanly to Favorites=ON + Date Added with Direction unlocked
    act(() => {
      result.current.handleToolbarShelfSortChange('favorites');
    });
    expect(result.current.shelfSortBy).toBe('favorites');
    expect(result.current.toolbarShelfSortBase).toBe('favorites');
    expect(result.current.isToolbarShelfDirDisabled).toBe(true);
    expect(result.current.drawerShelfSortBase).toBe('recent');
    expect(result.current.isDrawerShelfDirDisabled).toBe(false);
    expect(result.current.isShelfFavoritesActive).toBe(true);
    expect(result.current.bookshelfActiveFilterCount).toBe(1);
    expect(result.current.paginatedSavedBooks.map((b) => b.id)).toEqual([1342]);

    // 2. Flipping Sort Direction in the drawer promotes 'favorites' into orthogonal shelfFavoritesOnly + 'recent_asc'
    act(() => {
      result.current.handleDrawerShelfDirectionChange('asc');
    });
    expect(result.current.shelfFavoritesOnly).toBe(true);
    expect(result.current.shelfSortBy).toBe('recent_asc');
    expect(result.current.toolbarShelfSortBase).toBe('recent');
    expect(result.current.isToolbarShelfDirDisabled).toBe(false);
    expect(result.current.bookshelfActiveFilterCount).toBe(2);

    // Reset back to top-bar 'favorites' then combine in drawer with Title sorting
    act(() => {
      result.current.handleToolbarShelfSortChange('favorites');
    });
    act(() => {
      result.current.handleDrawerShelfSortChange('title');
    });
    expect(result.current.shelfFavoritesOnly).toBe(true);
    expect(result.current.shelfSortBy).toBe('title_asc');
    expect(result.current.toolbarShelfSortBase).toBe('title');
    expect(result.current.paginatedSavedBooks.map((b) => b.id)).toEqual([1342]);

    // 3. Toggling drawer Favorites switch off restores all books sorted alphabetically by Title
    act(() => {
      result.current.handleDrawerFavoritesToggle(false);
    });
    expect(result.current.isShelfFavoritesActive).toBe(false);
    expect(result.current.shelfSortBy).toBe('title_asc');
    expect(result.current.paginatedSavedBooks.map((b) => b.id)).toEqual([84, 1342]);

    // 4. Custom shelf ('Interested In', containing only Frankenstein #84) + Favorites + Downloaded sort empty states
    act(() => {
      result.current.handleDrawerFavoritesToggle(true);
      result.current.handleDrawerSelectShelf('custom-shelf');
    });
    expect(result.current.shelfFavoritesCount).toBe(0);
    expect(result.current.bookshelfActiveFilterCount).toBe(3);
    expect(result.current.paginatedSavedBooks).toEqual([]);
    expect(result.current.emptyStateCopy.title).toBe('No favorited volumes on this shelf');

    act(() => {
      result.current.handleDrawerShelfSortChange('downloaded');
    });
    expect(result.current.isDrawerShelfDirDisabled).toBe(true);
    expect(result.current.emptyStateCopy.title).toBe('No downloaded favorites on this shelf');

    // 5. Downloaded virtual tab retains offline favorited volume (#1342) and clearShelfFavoritesFilter restores cleanly
    act(() => {
      result.current.handleDrawerSelectShelf(DOWNLOADED_SHELF_ID);
    });
    expect(result.current.isViewingDownloaded).toBe(true);
    expect(result.current.paginatedSavedBooks.map((b) => b.id)).toEqual([1342]);

    act(() => {
      result.current.clearShelfFavoritesFilter();
      result.current.handleDrawerSelectShelf('all');
      result.current.handleToolbarShelfSortChange('recent');
    });
    expect(result.current.isShelfFavoritesActive).toBe(false);
    expect(result.current.paginatedSavedBooks.map((b) => b.id)).toEqual([1342, 84]);
  });

  it('handles toolbar direction promotion, favorites direction toggle, preset clear edges, page clamping, and downloaded favorites empty copy', () => {
    const removeAllOfflineBooks = vi.fn().mockResolvedValue(undefined);

    const { result, rerender } = renderHook(
      ({ activeView, offlineBookIds }) =>
        usePersonalCollectionsController({
          hasMounted: true,
          activeView,
          isMobile: false,
          isOffline: false,
          isBookOffline: (id) => offlineBookIds.includes(id),
          offlineBooks: [],
          catalogResults: sampleBooks,
          removeAllOfflineBooks,
        }),
      {
        initialProps: {
          activeView: 'bookshelf' as 'bookshelf' | 'favorites' | 'catalog',
          offlineBookIds: [] as number[],
        },
      }
    );

    // Selecting Favorites preset on toolbar, then toggling global direction promotes to orthogonal recent_asc
    act(() => {
      result.current.handleToolbarShelfSortChange('favorites');
    });
    expect(result.current.shelfSortBy).toBe('favorites');

    act(() => {
      result.current.handleCollectionDirectionToggle();
    });
    expect(result.current.shelfFavoritesOnly).toBe(true);
    expect(result.current.shelfSortBy).toBe('recent_asc');

    // Exiting toolbar Favorites-equivalent state (shelfFavoritesOnly + recent) clears shelfFavoritesOnly
    act(() => {
      result.current.handleDrawerShelfDirectionChange('desc');
    });
    expect(result.current.shelfSortBy).toBe('recent');

    act(() => {
      result.current.handleToolbarShelfSortChange('title');
    });
    expect(result.current.shelfFavoritesOnly).toBe(false);
    expect(result.current.shelfSortBy).toBe('title_asc');

    // Toggling drawer Favorites off or calling clearShelfFavoritesFilter resets preset 'favorites' to 'recent'
    act(() => {
      result.current.handleToolbarShelfSortChange('favorites');
    });
    act(() => {
      result.current.handleDrawerFavoritesToggle(false);
    });
    expect(result.current.shelfSortBy).toBe('recent');

    act(() => {
      result.current.handleToolbarShelfSortChange('favorites');
    });
    act(() => {
      result.current.clearShelfFavoritesFilter();
    });
    expect(result.current.shelfSortBy).toBe('recent');

    // Downloaded shelf + Favorites with 0 offline books yields 'No downloaded favorites yet'
    act(() => {
      result.current.handleDrawerFavoritesToggle(true);
      result.current.handleDrawerSelectShelf(DOWNLOADED_SHELF_ID);
    });
    expect(result.current.emptyStateCopy.title).toBe('No downloaded favorites yet');

    // Out-of-bounds shelfPage clamps back to totalShelfPages (1)
    act(() => {
      result.current.setShelfPage(5);
    });
    expect(result.current.shelfPage).toBe(1);

    // Favorites view direction toggle + out-of-bounds favoritesPage clamping
    rerender({ activeView: 'favorites', offlineBookIds: [] });
    act(() => {
      result.current.handleCollectionDirectionToggle();
    });
    expect(result.current.favoritesSortBy).toBe('recent_asc');

    act(() => {
      result.current.setFavoritesPage(4);
    });
    expect(result.current.favoritesPage).toBe(1);
  });
});
