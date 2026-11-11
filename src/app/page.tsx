'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/presentation/Navbar';
import { HeroSearch } from '@/components/presentation/HeroSearch';
import { StickyCatalogToolbar, type ActiveFilterChip } from '@/components/presentation/StickyCatalogToolbar';
import { BookGrid } from '@/components/presentation/BookGrid';
import { EditorialQuoteSection } from '@/components/presentation/EditorialQuoteSection';
import { LiteraryQuotes } from '@/components/presentation/LiteraryQuotes';
import { BookshelfMobileModal } from '@/components/presentation/bookshelf/BookshelfMobileModal';

const AdvancedFilterDrawer = dynamic(
  () => import('@/components/presentation/AdvancedFilterDrawer').then((mod) => mod.AdvancedFilterDrawer),
  { ssr: false }
);
const DownloadDrawer = dynamic(
  () => import('@/components/presentation/DownloadDrawer').then((mod) => mod.DownloadDrawer),
  { ssr: false }
);
const BookPreviewModal = dynamic(
  () => import('@/components/presentation/BookPreviewModal').then((mod) => mod.BookPreviewModal),
  { ssr: false }
);
const loadBookReaderPage = () => import('@/app/read/[id]/page');
const BookReaderPage = React.lazy(loadBookReaderPage);
import { NotebookView } from '@/components/presentation/NotebookView';
import { BookmarksView } from '@/components/presentation/BookmarksView';
import { CatalogOfflineView } from '@/components/presentation/CatalogOfflineView';
import { CollectionBottomDock } from '@/components/presentation/CollectionBottomDock';
import { CollectionFloatingSearch } from '@/components/presentation/CollectionFloatingSearch';
import { CollectionFilterDrawer } from '@/components/presentation/CollectionFilterDrawer';
import { CollectionClearConfirmModal } from '@/components/presentation/CollectionClearConfirmModal';
import { RemoveOfflineBookModal } from '@/components/ui/RemoveOfflineBookModal';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Footer } from '@/components/presentation/Footer';
import { useBooks, usePrefetchNextPage } from '@/hooks/queries/useBooks';
import { useCatalogFilters, type CatalogView, extractReaderBookIdFromPath } from '@/hooks/useCatalogFilters';
import { useMobileViewSwipe } from '@/hooks/useMobileViewSwipe';
import { useTouchDevice } from '@/hooks/useTouchDevice';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { useReaderStore } from '@/stores/useReaderStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { useOfflineBooks } from '@/hooks/useOfflineBooks';
import { useOfflineCatalogFallback } from '@/hooks/useOfflineCatalogFallback';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { useCollectionAutoHeal } from '@/hooks/useCollectionAutoHeal';
import { usePersonalCollectionsController } from '@/hooks/usePersonalCollectionsController';
import { useHasMounted } from '@/hooks/useHasMounted';
import type { GutendexBook } from '@/types/book.types';
import { Trash2, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CollectionToolbar } from '@/components/presentation/CollectionToolbar';
import { Pagination } from '@/components/ui/Pagination';
import { smartScrollToContent, runPreservingScrollPosition } from '@/lib/scroll-utils';
import {
  BOOKSHELF_BASE_SORT_OPTIONS,
  FAVORITES_BASE_SORT_OPTIONS,
  resolveBookSortKey,
  type BookshelfSortOption,
  type FavoritesSortOption,
} from '@/lib/book-sorting';
import { featuredHeroToGutendexBook } from '@/lib/book-metadata';
import { ROUTES } from '@/config/routes';
import { VIEW_CONTENT_CONFIG } from '@/config/views.config';

const EMPTY_OFFLINE_BOOKS: GutendexBook[] = [];

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dirParam = searchParams.get('dir');
  const initialSwipeDir = dirParam === 'forward' || dirParam === 'backward' ? dirParam : null;
  const hasMounted = useHasMounted();
  const stickyScrollEnabled = usePreferencesStore((s) => s.stickyScrollEnabled);
  const { isHeaderVisible, isToolbarVisible, isDocked } = useScrollDirection({
    enabled: stickyScrollEnabled,
  });
  const [selectedDownloadBook, setSelectedDownloadBook] = useState<GutendexBook | null>(null);
  const [selectedPreviewBook, setSelectedPreviewBook] = useState<GutendexBook | null>(null);
  const [activePreviewBookId, setActivePreviewBookId] = useState<number | null>(null);
  const [previewOriginRect, setPreviewOriginRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [isCatalogSearchOpen, setIsCatalogSearchOpen] = useState(false);

  const { isOffline } = useNetworkStatus();
  const {
    isBookOffline,
    downloadBook,
    removeBook,
    removeAll,
    downloadingBookId,
    offlineBookIds,
    offlineBooks = EMPTY_OFFLINE_BOOKS,
  } = useOfflineBooks();
  const [bookToRemoveOffline, setBookToRemoveOffline] = useState<GutendexBook | null>(null);
  const handleToggleOffline = async (book: GutendexBook) => {
    if (isBookOffline(book.id)) {
      setBookToRemoveOffline(book);
    } else {
      await downloadBook(book);
    }
  };

  // Proactively warm Reader JS chunks into the Service Worker cache if offline books exist
  useEffect(() => {
    if (hasMounted && offlineBookIds.length > 0) {
      void loadBookReaderPage().catch(() => {});
    }
  }, [hasMounted, offlineBookIds.length]);

  // Detect if the App Shell was served as offline fallback for a /read/[id] route
  const [offlineReaderBookId, setOfflineReaderBookId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return extractReaderBookIdFromPath(window.location.pathname);
    }
    return null;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const checkPath = () => {
      setOfflineReaderBookId(extractReaderBookIdFromPath(window.location.pathname));
    };
    checkPath();
    window.addEventListener('popstate', checkPath);
    return () => window.removeEventListener('popstate', checkPath);
  }, []);

  // Unified collection auto-healing pipeline (Bookshelf & Favorites metadata enrichment)
  const { isHealing, missingFavoriteIds, incompleteSavedIds } = useCollectionAutoHeal();

  // Centralized Catalog Filters Hook
  const {
    activeView,
    search,
    topic,
    language,
    era,
    sort,
    format,
    page,
    pageSize,
    viewMode,
    isFilterDrawerOpen,
    queryParams,
    activeFilterChips,
    isMobile,
    setActiveView,
    setPage,
    setPageSize,
    setViewMode,
    setIsFilterDrawerOpen,
    handleSearchChange,
    handleTopicChange,
    handleLanguageChange,
    handleEraChange,
    handleSortChange,
    handleFormatChange,
    handleApplyFilters,
    handleResetAllFilters,
    removeFilterChip,
  } = useCatalogFilters();

  // Server Query
  const {
    data: booksData,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useBooks(queryParams, {
    enabled: !isOffline && (activeView === 'catalog' || activeView === 'favorites'),
  });

  // Personal Collections Controller (Bookshelf & Favorites sorting, filtering, pagination & clear state)
  const {
    savedBooks,
    setActiveBookshelfId,
    collectionSearchQuery,
    setCollectionSearchQuery,
    setShelfSortBy,
    setFavoritesSortBy,
    setShelfPage,
    setFavoritesPage,
    isCollectionSearchOpen,
    setIsCollectionSearchOpen,
    isCollectionFilterDrawerOpen,
    setIsCollectionFilterDrawerOpen,
    confirmClearType,
    setConfirmClearType,
    activeShelf,
    isViewingDownloaded,
    isViewingGeneral,
    resolvedOfflineBooks,
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
    bookshelfPageSize,
    favoritesPageSize,
    totalShelfPages,
    safeShelfPage,
    paginatedSavedBooks,
    totalFavoritesPages,
    safeFavoritesPage,
    paginatedFavoriteBooks,
    isShelf,
    isFavorites,
    collectionCount,
    totalCollectionCount,
    filteredCollectionBooks,
    emptyStateCopy,
    clearModalCopy,
    handleConfirmClearCollection,
  } = usePersonalCollectionsController({
    hasMounted,
    activeView,
    isMobile,
    isOffline,
    isBookOffline,
    offlineBooks,
    catalogResults: booksData?.results,
    removeAllOfflineBooks: removeAll,
  });

  // Full-page mobile horizontal swipe navigation between header views
  const isAnyModalActive = Boolean(
    isFilterDrawerOpen ||
    selectedDownloadBook ||
    selectedPreviewBook ||
    confirmClearType ||
    bookToRemoveOffline
  );

  const [swipeDirection, setSwipeDirection] = useState<'forward' | 'backward' | null>(initialSwipeDir);
  const [isTransitioning, setIsTransitioning] = useState(true);
  const [prevViewForTransition, setPrevViewForTransition] = useState(activeView);
  const [prevDirParam, setPrevDirParam] = useState<string | null>(dirParam);

  if (prevViewForTransition !== activeView) {
    setPrevViewForTransition(activeView);
    setIsTransitioning(true);
  }

  if (dirParam !== prevDirParam) {
    setPrevDirParam(dirParam);
    if (dirParam === 'forward' || dirParam === 'backward') {
      setSwipeDirection(dirParam);
      setIsTransitioning(true);
    }
  }

  const isTouchDevice = useTouchDevice();
  const isSwipeEnabled = (isMobile || isTouchDevice) && !isAnyModalActive;

  const { handleTouchStart, handleTouchEnd, handleTouchCancel } = useMobileViewSwipe({
    activeView,
    onViewChange: (view) => {
      if (view === 'account') {
        const dir = activeView === 'catalog' ? 'backward' : 'forward';
        router.push(`${ROUTES.ACCOUNT}?dir=${dir}`);
      } else {
        setActiveView(view as CatalogView);
      }
    },
    onSwipeDirection: setSwipeDirection,
    enabled: isSwipeEnabled,
  });

  // Local offline catalog filtering & sorting when device is offline and downloaded books exist
  const {
    filteredOfflineCatalogBooks,
    paginatedOfflineCatalogBooks,
    hasNextOfflinePage,
  } = useOfflineCatalogFallback({
    isOffline,
    resolvedOfflineBooks,
    search,
    topic,
    language,
    authorYearStart: queryParams.authorYearStart,
    authorYearEnd: queryParams.authorYearEnd,
    sort,
    page,
    pageSize,
  });

  // Windowed Chunk Sub-Pagination Calculations
  const subPagesPerBatch = Math.max(1, Math.floor(32 / pageSize));
  const subIndex = (page - 1) % subPagesPerBatch;
  const sliceStart = subIndex * pageSize;
  const sliceEnd = sliceStart + pageSize;
  const hasNextSubPage = Boolean(booksData?.results && sliceEnd < booksData.results.length);
  const hasNextPage = isOffline
    ? hasNextOfflinePage
    : hasNextSubPage || Boolean(booksData?.next);

  // Predictive Next-Page Prefetching (triggers when approaching next upstream 32-batch)
  const isApproachingBatchEnd = subIndex >= Math.max(1, subPagesPerBatch - 2);
  const prefetchNextPage = usePrefetchNextPage(
    queryParams,
    !isOffline && activeView === 'catalog' && isApproachingBatchEnd && Boolean(booksData?.next)
  );

  const pendingPageScrollRef = React.useRef<number | null>(null);
  const pendingSortScrollLockRef = React.useRef<number | null>(null);

  const scrollToCatalogSection = () => {
    if (typeof window !== 'undefined') {
      const el = document.getElementById('catalog-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const scrollToCollectionContent = () => {
    if (typeof window !== 'undefined') {
      const didScroll = smartScrollToContent('catalog-section', { offsetTop: 80 });
      if (!didScroll) {
        scrollToCatalogSection();
      }
    }
  };

  const handlePageChange = (newPage: number) => {
    pendingPageScrollRef.current = newPage;
    setPage(newPage);
    scrollToCatalogSection();
  };

  const handleViewModeChange = (mode: 'grid' | 'shelf') => {
    setViewMode(mode);
    scrollToCatalogSection();
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    scrollToCatalogSection();
  };

  const handleApplyFiltersWithScroll = (filters: Parameters<typeof handleApplyFilters>[0]) => {
    handleApplyFilters(filters);
    scrollToCatalogSection();
  };

  const handleResetAllFiltersWithScroll = () => {
    handleResetAllFilters();
    scrollToCatalogSection();
  };

  // Convert chips for toolbar interface
  const toolbarChips: ActiveFilterChip[] = activeFilterChips.map((chip) => ({
    id: chip.id,
    label: chip.label,
    onRemove: () => {
      removeFilterChip(chip.id);
      scrollToCatalogSection();
    },
  }));

  // Derive displayed books with windowed sub-page slicing based on active view
  let displayedBooks = isOffline
    ? paginatedOfflineCatalogBooks
    : (booksData?.results || []).slice(sliceStart, sliceEnd);
  let isDisplayLoading = isOffline ? false : isLoading || isFetching;
  let isDisplayError = isOffline ? false : isError;

  if (activeView === 'bookshelf') {
    displayedBooks = paginatedSavedBooks;
    isDisplayLoading = false;
    isDisplayError = false;
  } else if (activeView === 'favorites') {
    displayedBooks = paginatedFavoriteBooks;
    isDisplayLoading = missingFavoriteIds.length > 0 && isHealing;
    isDisplayError = false;
  }

  useEffect(() => {
    if (!isDisplayLoading && pendingPageScrollRef.current !== null) {
      if (pendingPageScrollRef.current === page) {
        scrollToCatalogSection();
      }
      pendingPageScrollRef.current = null;
    }
  }, [isDisplayLoading, page]);

  useEffect(() => {
    if (pendingSortScrollLockRef.current !== null && !isDisplayLoading) {
      const targetY = pendingSortScrollLockRef.current;
      pendingSortScrollLockRef.current = null;
      requestAnimationFrame(() => {
        if (typeof window !== 'undefined' && Math.abs((window.scrollY || 0) - targetY) > 2) {
          window.scrollTo({ top: targetY, behavior: 'instant' as ScrollBehavior });
        }
      });
    }
  }, [isDisplayLoading, booksData]);

  const viewConfig =
    VIEW_CONTENT_CONFIG[activeView as 'catalog' | 'bookshelf' | 'favorites'] ||
    VIEW_CONTENT_CONFIG.catalog;

  if (offlineReaderBookId) {
    return (
      <React.Suspense fallback={<div className="min-h-dvh bg-background" />}>
        <BookReaderPage />
      </React.Suspense>
    );
  }

  return (
    <div
      className="min-h-dvh flex flex-col justify-between bg-background text-foreground transition-colors duration-theme touch-pan-y overflow-x-clip"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <Navbar
        activeView={activeView}
        onBrandReset={() => {
          handleResetAllFilters();
          setCollectionSearchQuery('');
          setShelfPage(1);
          setFavoritesPage(1);
        }}
        onViewChange={(view) => {
          setSwipeDirection(null);
          if (view === activeView) {
            // User clicked the already-active view tab in navbar: reset page to 1 & scroll to top
            if (view === 'catalog') {
              setPage(1);
            } else if (view === 'bookshelf') {
              setShelfPage(1);
            } else if (view === 'favorites') {
              setFavoritesPage(1);
            }
            if (typeof window !== 'undefined') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }
            return;
          }
          setActiveView(view);
        }}
        isVisible={isHeaderVisible}
        hasShadow={
          !(
            activeView === 'catalog' &&
            (!isOffline || resolvedOfflineBooks.length > 0) &&
            isDocked
          )
        }
      />

      <main
        className="flex-1 transition-all duration-300 touch-pan-y overflow-x-clip"
      >
        {activeView === 'catalog' && (!isOffline || resolvedOfflineBooks.length > 0) && (
          <HeroSearch
            search={search}
            onSearchChange={handleSearchChange}
            selectedTopic={topic}
            onTopicChange={handleTopicChange}
            selectedLanguage={language}
            onLanguageChange={handleLanguageChange}
            featuredBook={isOffline && resolvedOfflineBooks.length > 0 ? resolvedOfflineBooks[0] : undefined}
            onReadFeaturedBook={(featured) => {
              if (featured) {
                const featuredMeta = featured as {
                  rawBook?: GutendexBook;
                  authors?: GutendexBook['authors'];
                  author?: string;
                  authorBirthYear?: number;
                  authorDeathYear?: number;
                  primarySubject?: string;
                };
                const isDirectGutendexBook =
                  Array.isArray(featuredMeta.authors) && !featuredMeta.rawBook;
                const bookPayload: GutendexBook = isDirectGutendexBook
                  ? (featured as GutendexBook)
                  : featuredMeta.rawBook ||
                    featuredHeroToGutendexBook(
                      {
                        id: featured.id,
                        title: featured.title,
                        author: featuredMeta.author,
                        authorBirthYear: featuredMeta.authorBirthYear,
                        authorDeathYear: featuredMeta.authorDeathYear,
                        primarySubject: featuredMeta.primarySubject,
                      },
                      { formats: {}, downloadCount: 50000 }
                    );
                useReaderStore.getState().openReader(bookPayload);
                router.push(ROUTES.READ(featured.id));
                return;
              }
              const targetBook = displayedBooks[0];
              if (targetBook) {
                useReaderStore.getState().openReader(targetBook);
              }
              router.push(ROUTES.READ(targetBook?.id || 1342));
            }}
          />
        )}

        {/* Sticky Sub-Header Toolbar for Catalog View */}
        {activeView === 'catalog' && (!isOffline || resolvedOfflineBooks.length > 0) && (
          <StickyCatalogToolbar
            page={page}
            onPageChange={handlePageChange}
            hasNextPage={hasNextPage}
            viewMode={viewMode}
            onViewModeChange={handleViewModeChange}
            onOpenFilters={() => setIsFilterDrawerOpen((prev) => !prev)}
            isFiltersOpen={isFilterDrawerOpen}
            activeFilterCount={toolbarChips.length}
            activeFilterChips={toolbarChips}
            onClearAllFilters={handleResetAllFiltersWithScroll}
            isFetching={isOffline ? false : isFetching}
            onPrefetchNext={prefetchNextPage}
            latencyMs={booksData?.latencyMs}
            catalogSource={booksData?.source}
            isError={isDisplayError}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            isHeaderVisible={isHeaderVisible}
            isVisible={isToolbarVisible}
            isDocked={isDocked}
            isSearchOpen={isCatalogSearchOpen}
            onSearchToggle={() => setIsCatalogSearchOpen((prev) => !prev)}
            searchQuery={search}
            currentSort={sort}
            onSortToggle={() => {
              if (typeof window !== 'undefined') {
                pendingSortScrollLockRef.current = window.scrollY || window.pageYOffset || 0;
              }
              handleSortChange(sort === 'popular' ? 'descending' : 'popular');
            }}
          />
        )}

        <div
          key={`view-transition-${activeView}`}
          data-view-transition-stage="true"
          className={
            isTransitioning
              ? swipeDirection === 'forward'
                ? 'animate-view-slide-left'
                : swipeDirection === 'backward'
                ? 'animate-view-slide-right'
                : 'animate-page-turn'
              : ''
          }
          onAnimationEnd={(e) => {
            if (e.target !== e.currentTarget) return;
            setIsTransitioning(false);
            setSwipeDirection(null);
            if (typeof window !== 'undefined' && searchParams.has('dir')) {
              const url = new URL(window.location.href);
              url.searchParams.delete('dir');
              window.history.replaceState(null, '', url.toString());
            }
          }}
        >
          {activeView === 'notebook' ? (
            <NotebookView
              onBrowseCatalog={() => {
                setSwipeDirection(null);
                setActiveView('catalog');
              }}
            />
          ) : activeView === 'bookmarks' ? (
            <BookmarksView
              onBrowseCatalog={() => {
                setSwipeDirection(null);
                setActiveView('catalog');
              }}
            />
          ) : activeView === 'catalog' && isOffline && resolvedOfflineBooks.length === 0 ? (
            <CatalogOfflineView
              onNavigateView={(view) => {
                setSwipeDirection(null);
                setActiveView(view);
              }}
            />
          ) : (
            <div id="catalog-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-12 pb-8 sm:pb-12 scroll-mt-16 sm:scroll-mt-20 [overflow-anchor:none]">
              {activeView === 'catalog' && isOffline && (
                <div
                  data-testid="catalog-offline-downloaded-banner"
                  className="mb-6 flex items-center justify-center gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-400"
                >
                  <WifiOff className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    Offline Mode — Browsing your {resolvedOfflineBooks.length} downloaded{' '}
                    {resolvedOfflineBooks.length === 1 ? 'volume' : 'volumes'}
                  </span>
                </div>
              )}

              {/* Booksaw Centered Section Header */}
              <SectionHeader
                eyebrow={viewConfig.eyebrow}
                title={viewConfig.getTitle({ search, topic, era })}
                subtitle={
                  activeView === 'bookshelf' && incompleteSavedIds.length > 0 && isHealing
                    ? `You have ${collectionCount} titles preserved on your personal shelf (verifying public domain clearance...)`
                    : viewConfig.getSubtitle({
                        count: collectionCount,
                        booksData:
                          activeView === 'catalog' && isOffline
                            ? {
                                count: filteredOfflineCatalogBooks.length,
                                next: null,
                                previous: null,
                                results: filteredOfflineCatalogBooks,
                              }
                            : booksData,
                        displayedCount: displayedBooks.length,
                      })
                }
              >
                {viewConfig.clearType && totalCollectionCount > 0 && (
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isShelf ? collectionCount === 0 : false}
                      onClick={() => setConfirmClearType(viewConfig.clearType!)}
                      className="text-destructive border-border hover:border-destructive hover:bg-destructive/10 gap-1.5 text-xs font-mono uppercase disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {isShelf
                        ? isViewingDownloaded
                          ? 'Clear Downloaded Shelf'
                          : !isViewingGeneral && activeShelf && !activeShelf.is_default
                          ? `Clear "${activeShelf.name}" Shelf`
                          : viewConfig.clearButtonText
                        : viewConfig.clearButtonText}
                    </Button>
                  </div>
                )}
              </SectionHeader>

              {/* Collection Toolbar for Bookshelf & Favorites */}
              {viewConfig.collectionName && totalCollectionCount > 0 && (
                <CollectionToolbar
                  searchQuery={collectionSearchQuery}
                  onSearchChange={setCollectionSearchQuery}
                  searchPlaceholder={viewConfig.searchPlaceholder!}
                  searchAriaLabel={`Search ${viewConfig.collectionName}`}
                  clearAriaLabel={`Clear ${viewConfig.collectionName} search`}
                  totalCount={collectionCount}
                  filteredCount={filteredCollectionBooks.length}
                  sortValue={isShelf ? shelfSortBase : favoritesSortBase}
                  onSortChange={(newBase) => {
                    const defaultDir = newBase === 'title' || newBase === 'author' ? 'asc' : 'desc';
                    if (isShelf) {
                      setShelfSortBy(resolveBookSortKey(newBase, defaultDir) as BookshelfSortOption);
                    } else {
                      setFavoritesSortBy(resolveBookSortKey(newBase, defaultDir) as FavoritesSortOption);
                    }
                  }}
                  sortOptions={isShelf ? BOOKSHELF_BASE_SORT_OPTIONS : FAVORITES_BASE_SORT_OPTIONS}
                  sortAriaLabel={isShelf ? 'Sort bookshelf' : 'Sort favorites'}
                  sortDirection={isShelf ? shelfSortDir : favoritesSortDir}
                  onDirectionToggle={handleCollectionDirectionToggle}
                  isDirectionDisabled={isShelf ? isShelfDirDisabled : isFavoritesDirDisabled}
                  singleRowOnMobile={true}
                  hiddenOnMobile={true}
                  className="mb-4 sm:mb-6"
                />
              )}

              {/* Book Catalog / Bookshelf Grid */}
              <BookGrid
                key={activeView}
                books={displayedBooks}
                isLoading={isDisplayLoading}
                isError={isDisplayError}
                onRetry={refetch}
                page={page}
                pageSize={pageSize}
                onPageChange={activeView === 'catalog' ? handlePageChange : undefined}
                hasNextPage={hasNextPage}
                onDownloadClick={(book) => setSelectedDownloadBook(book)}
                onPreviewClick={(book, rect) => {
                  setSelectedPreviewBook(book);
                  setActivePreviewBookId(book.id);
                  setPreviewOriginRect(rect || null);
                }}
                activePreviewBookId={activePreviewBookId}
                viewMode={activeView === 'bookshelf' ? 'shelf' : activeView === 'favorites' ? 'grid' : viewMode}
                onViewModeChange={handleViewModeChange}
                showViewToggle={false} // Managed by StickyToolbar
                onBrowseCatalog={() => setActiveView('catalog')}
                searchQuery={collectionSearchQuery}
                onClearSearch={collectionSearchQuery.trim() ? () => setCollectionSearchQuery('') : undefined}
                activeView={activeView}
                totalBooksCount={savedBooks.length}
                onTopicClick={(topicName) => {
                  handleTopicChange(topicName);
                  if (activeView !== 'catalog') {
                    setActiveView('catalog');
                  }
                }}
                emptyTitle={emptyStateCopy.title}
                emptyDescription={emptyStateCopy.description}
              />

              {/* Pagination for Bookshelf & Favorites (Threshold-based, hides when <= 12 items on mobile or <= 24 on PC) */}
              {(isShelf || isFavorites) && (
                <Pagination
                  currentPage={isShelf ? safeShelfPage : safeFavoritesPage}
                  totalPages={isShelf ? totalShelfPages : totalFavoritesPages}
                  onPageChange={(newPage) => {
                    if (isShelf) {
                      setShelfPage(newPage);
                    } else {
                      setFavoritesPage(newPage);
                    }
                    scrollToCollectionContent();
                  }}
                  totalItems={filteredCollectionBooks.length}
                  pageSize={isShelf ? bookshelfPageSize : favoritesPageSize}
                  className="mt-8"
                />
              )}
            </div>
          )}
        </div>

        {/* Booksaw Editorial Classic of the Day Section */}
        {activeView === 'catalog' && !isOffline && <EditorialQuoteSection />}

        {/* Booksaw 3-Column Literary Quotes & Passages */}
        {activeView === 'catalog' && !isOffline && <LiteraryQuotes />}
      </main>

      {/* Desktop 3D Open Book Preview Spread Modal (>= 1024px) & Mobile Sheet (< 1024px) */}
      {(() => {
        const isPreviewOffline = Boolean(selectedPreviewBook && isBookOffline(selectedPreviewBook.id));
        const isPreviewDownloading = Boolean(
          selectedPreviewBook && downloadingBookId === selectedPreviewBook.id
        );
        const closePreview = () => {
          setSelectedPreviewBook(null);
          setActivePreviewBookId(null);
          setPreviewOriginRect(null);
        };
        const readPreviewBook = (book: GutendexBook) => {
          closePreview();
          useReaderStore.getState().openReader(book);
          router.push(ROUTES.READ(book.id));
        };
        return (
          <>
            <div className="hidden lg:contents">
              <BookPreviewModal
                book={selectedPreviewBook}
                originRect={previewOriginRect}
                isOpen={Boolean(selectedPreviewBook)}
                activeView={activeView}
                isOffline={isPreviewOffline}
                isDownloadingOffline={isPreviewDownloading}
                onToggleOffline={handleToggleOffline}
                onWillClose={() => setActivePreviewBookId(null)}
                onClose={closePreview}
                onReadBook={readPreviewBook}
              />
            </div>

            <BookshelfMobileModal
              className="lg:hidden"
              selectedMobileBook={selectedPreviewBook}
              onClose={closePreview}
              activeView={activeView}
              onBookClick={readPreviewBook}
              onDownloadClick={(book) => {
                closePreview();
                setSelectedDownloadBook(book);
              }}
              isOffline={isPreviewOffline}
              isDownloadingOffline={isPreviewDownloading}
              onToggleOffline={handleToggleOffline}
            />
          </>
        );
      })()}

      {/* Download Hub Drawer */}
      <DownloadDrawer
        book={selectedDownloadBook}
        isOpen={Boolean(selectedDownloadBook)}
        onClose={() => setSelectedDownloadBook(null)}
      />

      {/* Advanced Filter Drawer */}
      <AdvancedFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        selectedEra={era}
        onEraChange={handleEraChange}
        selectedSort={sort}
        onSortChange={handleSortChange}
        selectedTopic={topic}
        onTopicChange={handleTopicChange}
        selectedLanguage={language}
        onLanguageChange={handleLanguageChange}
        selectedFormat={format}
        onFormatChange={handleFormatChange}
        onApplyFilters={handleApplyFiltersWithScroll}
        onResetAll={handleResetAllFiltersWithScroll}
        activeFilterCount={toolbarChips.length}
      />

      {/* Floating Search for Catalog */}
      {activeView === 'catalog' && (
        <CollectionFloatingSearch
          isOpen={isCatalogSearchOpen}
          onClose={() => setIsCatalogSearchOpen(false)}
          searchQuery={search}
          onSearchChange={handleSearchChange}
          submitOnEnter={true}
          contentAnchorId="catalog-section"
          onSubmit={(query) => {
            if (query) {
              scrollToCatalogSection();
            }
          }}
          searchPlaceholder="Search 70,000+ books by title or author..."
          searchAriaLabel="Search catalog"
          clearAriaLabel="Clear catalog search"
        />
      )}

      {/* Mobile Floating Search for Bookshelf & Favorites */}
      {(activeView === 'bookshelf' || activeView === 'favorites') && (
        <CollectionFloatingSearch
          isOpen={isCollectionSearchOpen}
          onClose={() => setIsCollectionSearchOpen(false)}
          searchQuery={collectionSearchQuery}
          onSearchChange={setCollectionSearchQuery}
          contentAnchorId="catalog-section"
          searchPlaceholder={viewConfig.searchPlaceholder || 'Search collection...'}
          searchAriaLabel={`Search ${viewConfig.collectionName}`}
          clearAriaLabel={`Clear ${viewConfig.collectionName} search`}
        />
      )}

      {/* Mobile Filter & Sort Drawer for Bookshelf & Favorites */}
      {(activeView === 'bookshelf' || activeView === 'favorites') && (
        <CollectionFilterDrawer
          isOpen={isCollectionFilterDrawerOpen}
          onClose={() => setIsCollectionFilterDrawerOpen(false)}
          title={isShelf ? 'Bookshelf Filters & Sort' : 'Favorites Filters & Sort'}
          subtitle={
            (isShelf ? bookshelfActiveFilterCount : favoritesActiveFilterCount) > 0
              ? `${isShelf ? bookshelfActiveFilterCount : favoritesActiveFilterCount} active filters`
              : 'Customize shelf view'
          }
          activeFilterCount={isShelf ? bookshelfActiveFilterCount : favoritesActiveFilterCount}
          shelfOptions={isShelf ? bookshelfDrawerShelves : undefined}
          selectedShelfId={isShelf ? currentDrawerShelfId : undefined}
          onSelectShelf={isShelf ? handleDrawerSelectShelf : undefined}
          shelfSectionTitle="Bookshelves"
          sortOptions={isShelf ? BOOKSHELF_BASE_SORT_OPTIONS : FAVORITES_BASE_SORT_OPTIONS}
          selectedSort={isShelf ? shelfSortBase : favoritesSortBase}
          onSortChange={(newBase) => {
            const defaultDir = newBase === 'title' || newBase === 'author' ? 'asc' : 'desc';
            if (isShelf) {
              setShelfSortBy(resolveBookSortKey(newBase, defaultDir) as BookshelfSortOption);
            } else {
              setFavoritesSortBy(resolveBookSortKey(newBase, defaultDir) as FavoritesSortOption);
            }
          }}
          sortSectionTitle="Sort By"
          sortDirection={isShelf ? shelfSortDir : favoritesSortDir}
          onDirectionToggle={handleCollectionDirectionToggle}
          onDirectionChange={(newDir) => {
            runPreservingScrollPosition(() => {
              if (isShelf) {
                setShelfSortBy(resolveBookSortKey(shelfSortBase, newDir) as BookshelfSortOption);
              } else {
                setFavoritesSortBy(resolveBookSortKey(favoritesSortBase, newDir) as FavoritesSortOption);
              }
            });
          }}
          isDirectionDisabled={isShelf ? isShelfDirDisabled : isFavoritesDirDisabled}
          onResetAll={() => {
            setCollectionSearchQuery('');
            if (isShelf) {
              setActiveBookshelfId(null);
              setShelfSortBy('recent');
            } else {
              setFavoritesSortBy('recent');
            }
          }}
        />
      )}

      {/* Mobile Capsule Bottom Dock for Bookshelf & Favorites */}
      {(activeView === 'bookshelf' || activeView === 'favorites') && totalCollectionCount > 0 && (
        <CollectionBottomDock
          searchQuery={collectionSearchQuery}
          isSearchOpen={isCollectionSearchOpen}
          onSearchToggle={() => setIsCollectionSearchOpen((prev) => !prev)}
          activeFilterCount={isShelf ? bookshelfActiveFilterCount : favoritesActiveFilterCount}
          isFiltersOpen={isCollectionFilterDrawerOpen}
          onOpenFilters={() => setIsCollectionFilterDrawerOpen((prev) => !prev)}
          modeType="direction"
          sortDirection={isShelf ? shelfSortDir : favoritesSortDir}
          onDirectionToggle={handleCollectionDirectionToggle}
          isDirectionDisabled={isShelf ? isShelfDirDisabled : isFavoritesDirDisabled}
        />
      )}

      {/* Clear Shelf / Favorites Confirmation Modal */}
      <CollectionClearConfirmModal
        isOpen={confirmClearType !== null}
        title={clearModalCopy.title}
        heading={clearModalCopy.heading}
        description={clearModalCopy.description}
        confirmLabel={clearModalCopy.confirmLabel}
        onClose={() => setConfirmClearType(null)}
        onConfirm={handleConfirmClearCollection}
      />

      <RemoveOfflineBookModal
        isOpen={Boolean(bookToRemoveOffline)}
        bookTitle={bookToRemoveOffline?.title}
        onClose={() => setBookToRemoveOffline(null)}
        onConfirm={async () => {
          if (bookToRemoveOffline) {
            await removeBook(bookToRemoveOffline.id);
            setBookToRemoveOffline(null);
          }
        }}
      />

      <Footer />
    </div>
  );
}

export default function Home() {
  return (
    <React.Suspense fallback={<div className="min-h-dvh bg-background" />}>
      <HomeContent />
    </React.Suspense>
  );
}
