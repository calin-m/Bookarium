import { useState, useMemo, useCallback } from 'react';
import { DOWNLOADED_SHELF_ID } from '@/components/presentation/BookshelfRack';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { useBookshelfCapacity } from '@/hooks/useBookshelfCapacity';
import { filterBooksSmart } from '@/lib/smart-search';
import { runPreservingScrollPosition } from '@/lib/scroll-utils';
import {
  sortBooks,
  mergeDownloadedShelfBooks,
  resolveBookshelfViewState,
  filterCustomShelfBooks,
  resolveBookSortKey,
  decomposeBookSortKey,
  type BookshelfSortOption,
  type FavoritesSortOption,
} from '@/lib/book-sorting';
import { VIEW_CONTENT_CONFIG } from '@/config/views.config';
import type { CatalogView } from '@/hooks/useCatalogFilters';
import type { GutendexBook } from '@/types/book.types';

export interface UsePersonalCollectionsControllerOptions {
  hasMounted: boolean;
  activeView: CatalogView;
  isMobile: boolean;
  isOffline: boolean;
  isBookOffline: (bookId: number) => boolean;
  offlineBooks: GutendexBook[];
  catalogResults?: GutendexBook[];
  removeAllOfflineBooks?: (books: GutendexBook[]) => Promise<void> | void;
}

export function usePersonalCollectionsController({
  hasMounted,
  activeView,
  isMobile,
  isOffline,
  isBookOffline,
  offlineBooks,
  catalogResults,
  removeAllOfflineBooks,
}: UsePersonalCollectionsControllerOptions) {
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');
  const [shelfSortBy, setShelfSortBy] = useState<BookshelfSortOption>('recent');
  const [favoritesSortBy, setFavoritesSortBy] =
    useState<FavoritesSortOption>('recent');
  const [shelfPage, setShelfPage] = useState(1);
  const [favoritesPage, setFavoritesPage] = useState(1);
  const [isCollectionSearchOpen, setIsCollectionSearchOpen] = useState(false);
  const [isCollectionFilterDrawerOpen, setIsCollectionFilterDrawerOpen] =
    useState(false);
  const [confirmClearType, setConfirmClearType] = useState<
    'shelf' | 'favorites' | null
  >(null);

  // Bookshelf store items (hydrated safely on mount)
  const rawSavedBooks = useBookshelfStore((s) => s.savedBooks);
  const rawFavoriteBooks = useBookshelfStore((s) => s.favoriteBooks);
  const rawFavoriteBookIds = useBookshelfStore((s) => s.favoriteBookIds);
  const clearSavedBooks = useBookshelfStore((s) => s.clearSavedBooks);
  const rawActiveBookshelfId = useBookshelfStore((s) => s.activeBookshelfId);
  const setActiveBookshelfId = useBookshelfStore((s) => s.setActiveBookshelfId);
  const rawCloudBookshelves = useBookshelfStore((s) => s.cloudBookshelves);
  const rawCloudBookshelfItems = useBookshelfStore(
    (s) => s.cloudBookshelfItems
  );
  const rawReadingProgress = useReaderStore((s) => s.readingProgress);

  const {
    savedBooks,
    favoriteBooks,
    favoriteBookIds,
    activeBookshelfId,
    cloudBookshelves,
    cloudBookshelfItems,
    readingProgress,
  } = hasMounted
    ? {
        savedBooks: rawSavedBooks,
        favoriteBooks: rawFavoriteBooks,
        favoriteBookIds: rawFavoriteBookIds,
        activeBookshelfId: rawActiveBookshelfId,
        cloudBookshelves: rawCloudBookshelves,
        cloudBookshelfItems: rawCloudBookshelfItems,
        readingProgress: rawReadingProgress,
      }
    : {
        savedBooks: [] as GutendexBook[],
        favoriteBooks: [] as GutendexBook[],
        favoriteBookIds: [] as number[],
        activeBookshelfId: null as string | null,
        cloudBookshelves: [] as typeof rawCloudBookshelves,
        cloudBookshelfItems: [] as typeof rawCloudBookshelfItems,
        readingProgress: {} as Record<number, number>,
      };

  // Shelf resolution for general vs custom shelves
  const {
    currentActiveShelfId,
    activeShelf,
    isViewingDownloaded,
    isViewingGeneral,
  } = useMemo(
    () =>
      resolveBookshelfViewState({
        cloudBookshelves,
        activeBookshelfId,
        downloadedShelfId: DOWNLOADED_SHELF_ID,
      }),
    [cloudBookshelves, activeBookshelfId]
  );

  const resolvedOfflineBooks = useMemo(() => {
    return mergeDownloadedShelfBooks(savedBooks, offlineBooks, isBookOffline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    savedBooks,
    offlineBooks,
    isBookOffline,
    isViewingDownloaded,
    isOffline,
  ]);

  const currentShelfBooks = useMemo(() => {
    if (isViewingDownloaded) {
      return resolvedOfflineBooks;
    }
    if (cloudBookshelves.length <= 1 || isViewingGeneral) {
      return savedBooks;
    }
    return filterCustomShelfBooks(
      savedBooks,
      cloudBookshelfItems,
      currentActiveShelfId
    );
  }, [
    isViewingDownloaded,
    resolvedOfflineBooks,
    cloudBookshelves.length,
    isViewingGeneral,
    cloudBookshelfItems,
    currentActiveShelfId,
    savedBooks,
  ]);

  // Reset collection search query when switching views
  const [prevActiveView, setPrevActiveView] = useState(activeView);
  if (prevActiveView !== activeView) {
    setPrevActiveView(activeView);
    setCollectionSearchQuery('');
  }

  // Reset shelf page when view, search, sort, or active shelf changes
  const effectiveShelfKeyId = isViewingGeneral
    ? 'general'
    : currentActiveShelfId || 'general';
  const [prevShelfKey, setPrevShelfKey] = useState(
    `${activeView}-${collectionSearchQuery}-${shelfSortBy}-${effectiveShelfKeyId}`
  );
  const currentShelfKey = `${activeView}-${collectionSearchQuery}-${shelfSortBy}-${effectiveShelfKeyId}`;
  if (currentShelfKey !== prevShelfKey) {
    setPrevShelfKey(currentShelfKey);
    setShelfPage(1);
  }

  // Reset favorites page when view, search, or sort changes
  const [prevFavoritesKey, setPrevFavoritesKey] = useState(
    `${activeView}-${collectionSearchQuery}-${favoritesSortBy}`
  );
  const currentFavoritesKey = `${activeView}-${collectionSearchQuery}-${favoritesSortBy}`;
  if (currentFavoritesKey !== prevFavoritesKey) {
    setPrevFavoritesKey(currentFavoritesKey);
    setFavoritesPage(1);
  }

  const currentDrawerShelfId = isViewingDownloaded
    ? DOWNLOADED_SHELF_ID
    : isViewingGeneral
    ? 'all'
    : currentActiveShelfId || 'all';

  const bookshelfDrawerShelves = useMemo(() => {
    const standard = [
      { id: 'all', label: 'All Books', count: savedBooks.length },
      {
        id: DOWNLOADED_SHELF_ID,
        label: 'Downloaded',
        count: resolvedOfflineBooks.length,
      },
    ];
    const custom = cloudBookshelves.map((shelf) => ({
      id: shelf.id,
      label: shelf.name,
      count: cloudBookshelfItems.filter((item) => item.bookshelf_id === shelf.id)
        .length,
    }));
    return [...standard, ...custom];
  }, [
    savedBooks.length,
    resolvedOfflineBooks.length,
    cloudBookshelves,
    cloudBookshelfItems,
  ]);

  const bookshelfActiveFilterCount = useMemo(() => {
    let count = 0;
    if (!isViewingGeneral) count++;
    if (shelfSortBy !== 'recent') count++;
    if (collectionSearchQuery.trim().length > 0) count++;
    return count;
  }, [isViewingGeneral, shelfSortBy, collectionSearchQuery]);

  const favoritesActiveFilterCount = useMemo(() => {
    let count = 0;
    if (favoritesSortBy !== 'recent') count++;
    if (collectionSearchQuery.trim().length > 0) count++;
    return count;
  }, [favoritesSortBy, collectionSearchQuery]);

  const {
    baseField: shelfSortBase,
    direction: shelfSortDir,
    isDirectionDisabled: isShelfDirDisabled,
  } = decomposeBookSortKey(shelfSortBy);

  const {
    baseField: favoritesSortBase,
    direction: favoritesSortDir,
    isDirectionDisabled: isFavoritesDirDisabled,
  } = decomposeBookSortKey(favoritesSortBy);

  const handleCollectionDirectionToggle = useCallback(() => {
    runPreservingScrollPosition(() => {
      const isCurrentShelf = activeView === 'bookshelf';
      if (isCurrentShelf) {
        const { baseField, direction, isDirectionDisabled } =
          decomposeBookSortKey(shelfSortBy);
        if (!isDirectionDisabled) {
          const nextDir = direction === 'asc' ? 'desc' : 'asc';
          setShelfSortBy(
            resolveBookSortKey(baseField, nextDir) as BookshelfSortOption
          );
        }
      } else {
        const { baseField, direction, isDirectionDisabled } =
          decomposeBookSortKey(favoritesSortBy);
        if (!isDirectionDisabled) {
          const nextDir = direction === 'asc' ? 'desc' : 'asc';
          setFavoritesSortBy(
            resolveBookSortKey(baseField, nextDir) as FavoritesSortOption
          );
        }
      }
    });
  }, [activeView, shelfSortBy, favoritesSortBy]);

  const handleDrawerSelectShelf = useCallback(
    (shelfId: string) => {
      if (shelfId === 'all') {
        setActiveBookshelfId(null);
      } else {
        setActiveBookshelfId(shelfId);
      }
    },
    [setActiveBookshelfId]
  );

  // Dynamic 2-shelf capacity for Bookshelf rack (2 shelves x capacity)
  const shelfCapacity = useBookshelfCapacity();
  const bookshelfPageSize = shelfCapacity * 2;
  // Responsive grid page size for Favorites (2/3/4-column card grid alignment: 12 on mobile, 24 on desktop)
  const favoritesPageSize = isMobile ? 12 : 24;

  // Smart filtered & sorted collection books (Bookshelf)
  const baseShelfBooks = useMemo(() => {
    if (shelfSortBy === 'downloaded') {
      return currentShelfBooks.filter((b) => isBookOffline(b.id));
    }
    return currentShelfBooks;
  }, [currentShelfBooks, shelfSortBy, isBookOffline]);

  const filteredSavedBooks = useMemo(
    () => filterBooksSmart(baseShelfBooks, collectionSearchQuery),
    [baseShelfBooks, collectionSearchQuery]
  );

  const sortedSavedBooks = useMemo(
    () => sortBooks(filteredSavedBooks, shelfSortBy, readingProgress),
    [filteredSavedBooks, shelfSortBy, readingProgress]
  );

  const totalShelfPages = Math.max(
    1,
    Math.ceil(sortedSavedBooks.length / bookshelfPageSize)
  );
  const safeShelfPage = Math.min(shelfPage, totalShelfPages);
  if (shelfPage > totalShelfPages) {
    setShelfPage(totalShelfPages);
  }

  const paginatedSavedBooks = useMemo(() => {
    const start = (safeShelfPage - 1) * bookshelfPageSize;
    return sortedSavedBooks.slice(start, start + bookshelfPageSize);
  }, [sortedSavedBooks, safeShelfPage, bookshelfPageSize]);

  // Smart filtered & sorted collection books (Favorites)
  const uniqueKnownFavoriteBooks = useMemo(() => {
    const allKnown = [
      ...favoriteBooks,
      ...offlineBooks,
      ...(catalogResults || []),
      ...savedBooks,
    ];
    const uniqueKnown = Array.from(
      new Map(allKnown.map((b) => [b.id, b])).values()
    );
    return uniqueKnown.filter((b) => favoriteBookIds.includes(b.id));
  }, [
    favoriteBooks,
    offlineBooks,
    catalogResults,
    savedBooks,
    favoriteBookIds,
  ]);

  const baseFavoriteBooks = useMemo(() => {
    if (favoritesSortBy === 'downloaded') {
      return uniqueKnownFavoriteBooks.filter((b) => isBookOffline(b.id));
    }
    return uniqueKnownFavoriteBooks;
  }, [uniqueKnownFavoriteBooks, favoritesSortBy, isBookOffline]);

  const filteredFavoriteBooks = useMemo(
    () => filterBooksSmart(baseFavoriteBooks, collectionSearchQuery),
    [baseFavoriteBooks, collectionSearchQuery]
  );

  const sortedFavoriteBooks = useMemo(
    () => sortBooks(filteredFavoriteBooks, favoritesSortBy),
    [filteredFavoriteBooks, favoritesSortBy]
  );

  const totalFavoritesPages = Math.max(
    1,
    Math.ceil(sortedFavoriteBooks.length / favoritesPageSize)
  );
  const safeFavoritesPage = Math.min(favoritesPage, totalFavoritesPages);
  if (favoritesPage > totalFavoritesPages) {
    setFavoritesPage(totalFavoritesPages);
  }

  const paginatedFavoriteBooks = useMemo(() => {
    const start = (safeFavoritesPage - 1) * favoritesPageSize;
    return sortedFavoriteBooks.slice(start, start + favoritesPageSize);
  }, [sortedFavoriteBooks, safeFavoritesPage, favoritesPageSize]);

  const viewConfig =
    VIEW_CONTENT_CONFIG[activeView as 'catalog' | 'bookshelf' | 'favorites'] ||
    VIEW_CONTENT_CONFIG.catalog;

  const isShelf = activeView === 'bookshelf';
  const isFavorites = activeView === 'favorites';
  const collectionCount = isShelf
    ? currentShelfBooks.length
    : isFavorites
    ? favoriteBookIds.length
    : 0;
  const totalCollectionCount = isShelf
    ? savedBooks.length
    : isFavorites
    ? favoriteBookIds.length
    : 0;
  const filteredCollectionBooks = isShelf
    ? sortedSavedBooks
    : isFavorites
    ? sortedFavoriteBooks
    : [];

  const emptyStateCopy = collectionSearchQuery.trim()
    ? {
        title: `No volumes found matching "${collectionSearchQuery}"`,
        description:
          'Try adjusting your search terms, author name, or clear the search query.',
      }
    : isShelf && (shelfSortBy === 'downloaded' || isViewingDownloaded)
    ? {
        title: 'No downloaded volumes',
        description: 'Volumes saved for offline reading will appear here.',
      }
    : isFavorites && favoritesSortBy === 'downloaded'
    ? {
        title: 'No downloaded favorites',
        description:
          'Favorite volumes saved for offline reading will appear here.',
      }
    : {
        title: viewConfig.emptyTitle,
        description: viewConfig.emptyDescription,
      };

  const clearModalCopy =
    confirmClearType === 'favorites'
      ? {
          title: 'Clear Favorite Books',
          heading: 'Are you sure you want to clear your favorites?',
          description: `This will remove all ${favoriteBookIds.length} titles from your curated favorites list. This action cannot be undone.`,
          confirmLabel: 'Yes, Clear Favorites',
        }
      : isViewingDownloaded
      ? {
          title: 'Clear Downloaded Books',
          heading: 'Are you sure you want to clear your downloaded shelf?',
          description: `This will remove the offline copies for all ${currentShelfBooks.length} downloaded titles to free up device storage. Your books will remain preserved on your personal bookshelf.`,
          confirmLabel: 'Yes, Clear Downloads',
        }
      : !isViewingGeneral && activeShelf && !activeShelf.is_default
      ? {
          title: `Clear "${activeShelf.name}" Bookshelf`,
          heading: `Are you sure you want to clear your "${activeShelf.name}" shelf?`,
          description: `This will remove all ${currentShelfBooks.length} titles currently on "${activeShelf.name}" from your bookshelf. Titles on your other shelves will not be affected. This action cannot be undone.`,
          confirmLabel: `Yes, Clear "${activeShelf.name}"`,
        }
      : {
          title: 'Clear Personal Bookshelf',
          heading: 'Are you sure you want to clear your bookshelf?',
          description: `This will remove all ${savedBooks.length} titles currently preserved across your personal reading shelves. This action cannot be undone.`,
          confirmLabel: 'Yes, Clear Shelf',
        };

  const handleConfirmClearCollection = useCallback(async () => {
    if (confirmClearType === 'shelf') {
      if (isViewingDownloaded && removeAllOfflineBooks) {
        await removeAllOfflineBooks(currentShelfBooks);
      } else if (!isViewingGeneral && activeShelf && !activeShelf.is_default) {
        await useBookshelfStore.getState().clearCustomShelfBooks(activeShelf.id);
      } else {
        clearSavedBooks();
      }
    } else if (confirmClearType === 'favorites') {
      useBookshelfStore.getState().clearFavoriteBooks();
    }
    setConfirmClearType(null);
  }, [
    confirmClearType,
    isViewingDownloaded,
    removeAllOfflineBooks,
    currentShelfBooks,
    isViewingGeneral,
    activeShelf,
    clearSavedBooks,
  ]);

  return {
    savedBooks,
    favoriteBookIds,
    clearSavedBooks,
    setActiveBookshelfId,
    resolvedOfflineBooks,
    currentShelfBooks,
    activeShelf,
    isViewingDownloaded,
    isViewingGeneral,
    collectionSearchQuery,
    setCollectionSearchQuery,
    shelfSortBy,
    setShelfSortBy,
    favoritesSortBy,
    setFavoritesSortBy,
    shelfPage,
    setShelfPage,
    favoritesPage,
    setFavoritesPage,
    isCollectionSearchOpen,
    setIsCollectionSearchOpen,
    isCollectionFilterDrawerOpen,
    setIsCollectionFilterDrawerOpen,
    safeShelfPage,
    safeFavoritesPage,
    totalShelfPages,
    totalFavoritesPages,
    bookshelfPageSize,
    favoritesPageSize,
    paginatedSavedBooks,
    paginatedFavoriteBooks,
    currentDrawerShelfId,
    bookshelfDrawerShelves,
    bookshelfActiveFilterCount,
    favoritesActiveFilterCount,
    shelfSortBase,
    shelfSortDir,
    isShelfDirDisabled,
    favoritesSortBase,
    favoritesSortDir,
    isFavoritesDirDisabled,
    handleCollectionDirectionToggle,
    handleDrawerSelectShelf,
    viewConfig,
    isShelf,
    isFavorites,
    collectionCount,
    totalCollectionCount,
    filteredCollectionBooks,
    emptyStateCopy,
    confirmClearType,
    setConfirmClearType,
    clearModalCopy,
    handleConfirmClearCollection,
  };
}
