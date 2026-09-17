'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/presentation/Navbar';
import { HeroSearch } from '@/components/presentation/HeroSearch';
import { StickyCatalogToolbar, type ActiveFilterChip } from '@/components/presentation/StickyCatalogToolbar';
import { AdvancedFilterDrawer } from '@/components/presentation/AdvancedFilterDrawer';
import { BookGrid } from '@/components/presentation/BookGrid';
import { EditorialQuoteSection } from '@/components/presentation/EditorialQuoteSection';
import { LiteraryQuotes } from '@/components/presentation/LiteraryQuotes';
import { DownloadDrawer } from '@/components/presentation/DownloadDrawer';
import { BookPreviewModal } from '@/components/presentation/BookPreviewModal';
import { BookshelfMobileModal } from '@/components/presentation/bookshelf/BookshelfMobileModal';
import { NotebookView } from '@/components/presentation/NotebookView';
import { BookmarksView } from '@/components/presentation/BookmarksView';
import { Modal } from '@/components/ui/Modal';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { Footer } from '@/components/presentation/Footer';
import { BackToTop } from '@/components/ui/BackToTop';
import { useBooks, usePrefetchNextPage } from '@/hooks/queries/useBooks';
import { useCatalogFilters, type CatalogView } from '@/hooks/useCatalogFilters';
import { useMobileViewSwipe } from '@/hooks/useMobileViewSwipe';
import { useScrollDirection } from '@/hooks/useScrollDirection';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import { usePreferencesStore } from '@/stores/usePreferencesStore';
import { useOfflineBooks } from '@/hooks/useOfflineBooks';
import { useCollectionAutoHeal } from '@/hooks/useCollectionAutoHeal';
import { useHasMounted } from '@/hooks/useHasMounted';
import type { GutendexBook } from '@/types/book.types';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CollectionToolbar } from '@/components/presentation/CollectionToolbar';
import { Pagination } from '@/components/ui/Pagination';
import { filterBooksSmart } from '@/lib/smart-search';
import { smartScrollToContent } from '@/lib/scroll-utils';
import {
  sortBooks,
  BOOKSHELF_SORT_OPTIONS,
  FAVORITES_SORT_OPTIONS,
  type BookshelfSortOption,
  type FavoritesSortOption,
} from '@/lib/book-sorting';
import { ROUTES } from '@/config/routes';
import { VIEW_CONTENT_CONFIG } from '@/config/views.config';

function HomeContent() {
  const router = useRouter();
  const hasMounted = useHasMounted();
  const stickyScrollEnabled = usePreferencesStore((s) => s.stickyScrollEnabled);
  const { isHeaderVisible, isToolbarVisible } = useScrollDirection({ enabled: stickyScrollEnabled });
  const [selectedDownloadBook, setSelectedDownloadBook] = useState<GutendexBook | null>(null);
  const [selectedPreviewBook, setSelectedPreviewBook] = useState<GutendexBook | null>(null);
  const [activePreviewBookId, setActivePreviewBookId] = useState<number | null>(null);
  const [previewOriginRect, setPreviewOriginRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  const [confirmClearType, setConfirmClearType] = useState<'shelf' | 'favorites' | null>(null);
  const [collectionSearchQuery, setCollectionSearchQuery] = useState('');

  const { isBookOffline, downloadBook, removeBook } = useOfflineBooks();
  const handleToggleOffline = async (book: GutendexBook) => {
    if (isBookOffline(book.id)) {
      await removeBook(book.id);
    } else {
      await downloadBook(book);
    }
  };

  // Bookshelf store items (hydrated safely on mount)
  const rawSavedBooks = useBookshelfStore((s) => s.savedBooks);
  const savedBooks = useMemo(() => (hasMounted ? rawSavedBooks : []), [hasMounted, rawSavedBooks]);
  const rawFavoriteBooks = useBookshelfStore((s) => s.favoriteBooks || []);
  const favoriteBooks = useMemo(() => (hasMounted ? rawFavoriteBooks : []), [hasMounted, rawFavoriteBooks]);
  const rawFavoriteBookIds = useBookshelfStore((s) => s.favoriteBookIds);
  const favoriteBookIds = useMemo(() => (hasMounted ? rawFavoriteBookIds : []), [hasMounted, rawFavoriteBookIds]);
  const clearSavedBooks = useBookshelfStore((s) => s.clearSavedBooks);
  const rawActiveBookshelfId = useBookshelfStore((s) => s.activeBookshelfId);
  const activeBookshelfId = hasMounted ? rawActiveBookshelfId : null;
  const rawCloudBookshelves = useBookshelfStore((s) => s.cloudBookshelves || []);
  const cloudBookshelves = useMemo(() => (hasMounted ? rawCloudBookshelves : []), [hasMounted, rawCloudBookshelves]);
  const rawCloudBookshelfItems = useBookshelfStore((s) => s.cloudBookshelfItems || []);
  const cloudBookshelfItems = useMemo(() => (hasMounted ? rawCloudBookshelfItems : []), [hasMounted, rawCloudBookshelfItems]);
  const rawReadingProgress = useReaderStore((s) => s.readingProgress || {});
  const readingProgress = useMemo(() => (hasMounted ? rawReadingProgress : {}), [hasMounted, rawReadingProgress]);

  // Sorting & Pagination State for Bookshelf & Favorites
  const [shelfSortBy, setShelfSortBy] = useState<BookshelfSortOption>('recent');
  const [favoritesSortBy, setFavoritesSortBy] = useState<FavoritesSortOption>('recent');
  const [shelfPage, setShelfPage] = useState(1);
  const [favoritesPage, setFavoritesPage] = useState(1);

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

  // Full-page mobile horizontal swipe navigation between header views
  const isAnyModalActive = Boolean(
    isFilterDrawerOpen ||
    selectedDownloadBook ||
    selectedPreviewBook ||
    confirmClearType
  );

  const { handleTouchStart, handleTouchEnd } = useMobileViewSwipe({
    activeView,
    onViewChange: (view) => {
      if (view === 'account') {
        router.push(ROUTES.ACCOUNT);
      } else {
        setActiveView(view as CatalogView);
      }
    },
    enabled: isMobile && !isAnyModalActive,
  });

  // Shelf resolution for general vs custom shelves
  const defaultShelf = useMemo(
    () => cloudBookshelves.find((s) => s.is_default) || cloudBookshelves[0],
    [cloudBookshelves]
  );
  const currentActiveShelfId = activeBookshelfId || defaultShelf?.id;
  const isViewingGeneral = defaultShelf ? currentActiveShelfId === defaultShelf.id : true;

  const currentShelfBooks = useMemo(() => {
    if (cloudBookshelves.length <= 1 || isViewingGeneral) {
      return savedBooks;
    }

    const currentShelfBookIds = new Set(
      cloudBookshelfItems
        .filter((item) => item.bookshelf_id === currentActiveShelfId)
        .map((item) => item.book_id)
    );
    return savedBooks.filter((b) => currentShelfBookIds.has(b.id));
  }, [cloudBookshelves.length, isViewingGeneral, cloudBookshelfItems, currentActiveShelfId, savedBooks]);

  // Reset collection search query when switching views
  const [prevActiveView, setPrevActiveView] = useState(activeView);
  if (prevActiveView !== activeView) {
    setPrevActiveView(activeView);
    setCollectionSearchQuery('');
  }

  // Reset shelf page when view, search, sort, or active shelf changes
  const [prevShelfKey, setPrevShelfKey] = useState(
    `${activeView}-${collectionSearchQuery}-${shelfSortBy}-${currentActiveShelfId}`
  );
  const currentShelfKey = `${activeView}-${collectionSearchQuery}-${shelfSortBy}-${currentActiveShelfId}`;
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

  // Server Query
  const {
    data: booksData,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useBooks(queryParams);

  // Windowed Chunk Sub-Pagination Calculations
  const subPagesPerBatch = Math.max(1, Math.floor(32 / pageSize));
  const subIndex = (page - 1) % subPagesPerBatch;
  const sliceStart = subIndex * pageSize;
  const sliceEnd = sliceStart + pageSize;
  const hasNextSubPage = Boolean(booksData?.results && sliceEnd < booksData.results.length);
  const hasNextPage = hasNextSubPage || Boolean(booksData?.next);

  // Predictive Next-Page Prefetching (triggers when approaching next upstream 32-batch)
  // - At pageSize=8 (4 sub-pages/batch): triggers on subIndex 2 (subPage 3) & 3 (subPage 4), giving ~15-25s lead time on mobile.
  // - At pageSize=16 (2 sub-pages/batch): triggers on subIndex 1 (subPage 2), giving 16 books of reading lead time.
  const isApproachingBatchEnd = subIndex >= Math.max(1, subPagesPerBatch - 2);
  const prefetchNextPage = usePrefetchNextPage(
    queryParams,
    isApproachingBatchEnd && Boolean(booksData?.next)
  );

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
      const didScroll = smartScrollToContent('book-grid-content', { offsetTop: 80 });
      if (!didScroll && !document.getElementById('book-grid-content')) {
        scrollToCatalogSection();
      }
    }
  };

  const handlePageChange = (newPage: number) => {
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

  // Responsive collection page size: 12 on mobile (2 shelves of 6), 24 on desktop (2 shelves of 12)
  const collectionPageSize = isMobile ? 12 : 24;

  // Smart filtered & sorted collection books (Bookshelf)
  const filteredSavedBooks = useMemo(
    () => filterBooksSmart(currentShelfBooks, collectionSearchQuery),
    [currentShelfBooks, collectionSearchQuery]
  );

  const sortedSavedBooks = useMemo(
    () => sortBooks(filteredSavedBooks, shelfSortBy, readingProgress),
    [filteredSavedBooks, shelfSortBy, readingProgress]
  );

  const totalShelfPages = Math.max(1, Math.ceil(sortedSavedBooks.length / collectionPageSize));
  const safeShelfPage = Math.min(shelfPage, totalShelfPages);
  if (shelfPage > totalShelfPages) {
    setShelfPage(totalShelfPages);
  }

  const paginatedSavedBooks = useMemo(() => {
    const start = (safeShelfPage - 1) * collectionPageSize;
    return sortedSavedBooks.slice(start, start + collectionPageSize);
  }, [sortedSavedBooks, safeShelfPage, collectionPageSize]);

  // Smart filtered & sorted collection books (Favorites)
  const uniqueKnownFavoriteBooks = useMemo(() => {
    const allKnown = [
      ...(favoriteBooks || []),
      ...(booksData?.results || []),
      ...savedBooks,
    ];
    const uniqueKnown = Array.from(new Map(allKnown.map((b) => [b.id, b])).values());
    return uniqueKnown.filter((b) => favoriteBookIds.includes(b.id));
  }, [favoriteBooks, booksData?.results, savedBooks, favoriteBookIds]);

  const filteredFavoriteBooks = useMemo(
    () => filterBooksSmart(uniqueKnownFavoriteBooks, collectionSearchQuery),
    [uniqueKnownFavoriteBooks, collectionSearchQuery]
  );

  const sortedFavoriteBooks = useMemo(
    () => sortBooks(filteredFavoriteBooks, favoritesSortBy),
    [filteredFavoriteBooks, favoritesSortBy]
  );

  const totalFavoritesPages = Math.max(1, Math.ceil(sortedFavoriteBooks.length / collectionPageSize));
  const safeFavoritesPage = Math.min(favoritesPage, totalFavoritesPages);
  if (favoritesPage > totalFavoritesPages) {
    setFavoritesPage(totalFavoritesPages);
  }

  const paginatedFavoriteBooks = useMemo(() => {
    const start = (safeFavoritesPage - 1) * collectionPageSize;
    return sortedFavoriteBooks.slice(start, start + collectionPageSize);
  }, [sortedFavoriteBooks, safeFavoritesPage, collectionPageSize]);

  // Derive displayed books with windowed sub-page slicing based on active view
  let displayedBooks = booksData?.results ? booksData.results.slice(sliceStart, sliceEnd) : [];
  let isDisplayLoading = isLoading || isFetching;
  let isDisplayError = isError;

  if (activeView === 'bookshelf') {
    displayedBooks = paginatedSavedBooks;
    isDisplayLoading = false;
    isDisplayError = false;
  } else if (activeView === 'favorites') {
    displayedBooks = paginatedFavoriteBooks;
    isDisplayLoading = missingFavoriteIds.length > 0 && isHealing;
    isDisplayError = false;
  }

  const viewConfig =
    VIEW_CONTENT_CONFIG[activeView as 'catalog' | 'bookshelf' | 'favorites'] ||
    VIEW_CONTENT_CONFIG.catalog;

  const isShelf = activeView === 'bookshelf';
  const isFavorites = activeView === 'favorites';
  const collectionCount = isShelf ? currentShelfBooks.length : isFavorites ? favoriteBookIds.length : 0;
  const filteredCollectionBooks = isShelf
    ? sortedSavedBooks
    : isFavorites
    ? sortedFavoriteBooks
    : [];

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground transition-colors duration-theme">
      <Navbar activeView={activeView} onViewChange={setActiveView} isVisible={isHeaderVisible} />

      <main
        className={`flex-1 transition-all duration-300 ${isFilterDrawerOpen ? 'xl:pl-96' : 'xl:pl-0'}`}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {activeView === 'catalog' && (
          <HeroSearch
            search={search}
            onSearchChange={handleSearchChange}
            selectedTopic={topic}
            onTopicChange={handleTopicChange}
            selectedLanguage={language}
            onLanguageChange={handleLanguageChange}
            onReadFeaturedBook={(featured) => {
              if (featured) {
                const authorName =
                  (featured as { rawBook?: GutendexBook }).rawBook?.authors?.[0]?.name ||
                  (featured as { author?: string }).author ||
                  'Classic Masterwork';
                const bookPayload: GutendexBook = (featured as { rawBook?: GutendexBook }).rawBook || {
                  id: featured.id,
                  title: featured.title,
                  authors: [
                    {
                      name: authorName,
                      birth_year:
                        (featured as { rawBook?: GutendexBook }).rawBook?.authors?.[0]?.birth_year ??
                        (featured as { authorBirthYear?: number }).authorBirthYear ??
                        null,
                      death_year:
                        (featured as { rawBook?: GutendexBook }).rawBook?.authors?.[0]?.death_year ??
                        (featured as { authorDeathYear?: number }).authorDeathYear ??
                        null,
                    },
                  ],
                  translators: [],
                  subjects: [(featured as { primarySubject?: string }).primarySubject || 'Classic Literature'],
                  bookshelves: [],
                  languages: ['en'],
                  copyright: false,
                  media_type: 'Text',
                  formats: {},
                  download_count: 50000,
                };
                useReaderStore.getState().openReader(bookPayload);
                router.push(ROUTES.READ(featured.id));
                return;
              }
              const targetBook = displayedBooks[0];
              if (targetBook) {
                useReaderStore.getState().openReader(targetBook);
              }
              const targetId = targetBook?.id || 1342;
              router.push(ROUTES.READ(targetId));
            }}
          />
        )}

        {/* Sticky Sub-Header Toolbar for Catalog View */}
        {activeView === 'catalog' && (
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
            isFetching={isFetching}
            onPrefetchNext={prefetchNextPage}
            latencyMs={booksData?.latencyMs}
            isError={isError}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            isHeaderVisible={isHeaderVisible}
            isVisible={isToolbarVisible}
          />
        )}

        {activeView === 'notebook' ? (
          <NotebookView onBrowseCatalog={() => setActiveView('catalog')} />
        ) : activeView === 'bookmarks' ? (
          <BookmarksView onBrowseCatalog={() => setActiveView('catalog')} />
        ) : (
          <div id="catalog-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-24 sm:pb-12">
            <div key={`view-page-turn-${activeView}`} className="animate-page-turn">
              {/* Booksaw Centered Section Header */}
              <SectionHeader
                eyebrow={viewConfig.eyebrow}
                title={viewConfig.getTitle({ search, topic, era })}
                subtitle={
                  activeView === 'bookshelf' && incompleteSavedIds.length > 0 && isHealing
                    ? `You have ${collectionCount} titles preserved on your personal shelf (verifying public domain clearance...)`
                    : viewConfig.getSubtitle({
                        count: collectionCount,
                        booksData,
                        displayedCount: displayedBooks.length,
                      })
                }
              >
                {viewConfig.clearType && collectionCount > 0 && (
                  <div className="pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setConfirmClearType(viewConfig.clearType!)}
                      className="text-destructive border-border hover:border-destructive hover:bg-destructive/10 gap-1.5 text-xs font-mono uppercase"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {viewConfig.clearButtonText}
                    </Button>
                  </div>
                )}
              </SectionHeader>

              {/* Collection Toolbar for Bookshelf & Favorites */}
              {viewConfig.collectionName && collectionCount > 0 && (
                <CollectionToolbar
                  searchQuery={collectionSearchQuery}
                  onSearchChange={setCollectionSearchQuery}
                  searchPlaceholder={viewConfig.searchPlaceholder!}
                  searchAriaLabel={`Search ${viewConfig.collectionName}`}
                  clearAriaLabel={`Clear ${viewConfig.collectionName} search`}
                  totalCount={collectionCount}
                  filteredCount={filteredCollectionBooks.length}
                  sortValue={isShelf ? shelfSortBy : favoritesSortBy}
                  onSortChange={(newSort) => {
                    if (isShelf) {
                      setShelfSortBy(newSort as BookshelfSortOption);
                    } else {
                      setFavoritesSortBy(newSort as FavoritesSortOption);
                    }
                  }}
                  sortOptions={isShelf ? BOOKSHELF_SORT_OPTIONS : FAVORITES_SORT_OPTIONS}
                  sortAriaLabel={isShelf ? 'Sort bookshelf' : 'Sort favorites'}
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
                  paginationAriaLabel={isShelf ? 'Top bookshelf pagination' : 'Top favorites pagination'}
                  itemCountLabel={
                    filteredCollectionBooks.length > 0
                      ? `${filteredCollectionBooks.length} ${
                          filteredCollectionBooks.length === 1 ? 'volume' : 'volumes'
                        }`
                      : undefined
                  }
                  className="mb-8"
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
                onPageChange={activeView === 'catalog' ? handlePageChange : undefined}
                hasNextPage={Boolean(booksData?.next)}
                onDownloadClick={(book) => setSelectedDownloadBook(book)}
                onPreviewClick={(book, rect) => {
                  setSelectedPreviewBook(book);
                  setActivePreviewBookId(book.id);
                  setPreviewOriginRect(rect || null);
                }}
                activePreviewBookId={activePreviewBookId}
                viewMode={activeView === 'bookshelf' ? 'shelf' : viewMode}
                onViewModeChange={handleViewModeChange}
                showViewToggle={false} // Managed by StickyToolbar
                onBrowseCatalog={() => setActiveView('catalog')}
                searchQuery={collectionSearchQuery}
                onClearSearch={collectionSearchQuery.trim() ? () => setCollectionSearchQuery('') : undefined}
                activeView={activeView}
                totalBooksCount={savedBooks.length}
                emptyTitle={
                  collectionSearchQuery.trim()
                    ? `No volumes found matching "${collectionSearchQuery}"`
                    : viewConfig.emptyTitle
                }
                emptyDescription={
                  collectionSearchQuery.trim()
                    ? 'Try adjusting your search terms, author name, or clear the search query.'
                    : viewConfig.emptyDescription
                }
              />

              {/* Pagination for Bookshelf & Favorites (Threshold-based, hides when <= 12 items on mobile or <= 24 on PC) */}
              {isShelf && (
                <Pagination
                  currentPage={safeShelfPage}
                  totalPages={totalShelfPages}
                  onPageChange={(newPage) => {
                    setShelfPage(newPage);
                    scrollToCollectionContent();
                  }}
                  totalItems={sortedSavedBooks.length}
                  pageSize={collectionPageSize}
                  className="mt-8"
                />
              )}

              {isFavorites && (
                <Pagination
                  currentPage={safeFavoritesPage}
                  totalPages={totalFavoritesPages}
                  onPageChange={(newPage) => {
                    setFavoritesPage(newPage);
                    scrollToCollectionContent();
                  }}
                  totalItems={sortedFavoriteBooks.length}
                  pageSize={collectionPageSize}
                  className="mt-8"
                />
              )}
            </div>
          </div>
        )}

        {/* Booksaw Editorial Classic of the Day Section */}
        {activeView === 'catalog' && <EditorialQuoteSection />}

        {/* Booksaw 3-Column Literary Quotes & Passages */}
        {activeView === 'catalog' && <LiteraryQuotes />}
      </main>

      {/* Desktop 3D Open Book Preview Spread Modal (>= 1024px) */}
      <div className="hidden lg:contents">
        <BookPreviewModal
          book={selectedPreviewBook}
          originRect={previewOriginRect}
          isOpen={Boolean(selectedPreviewBook)}
          activeView={activeView}
          onWillClose={() => {
            setActivePreviewBookId(null);
          }}
          onClose={() => {
            setSelectedPreviewBook(null);
            setActivePreviewBookId(null);
            setPreviewOriginRect(null);
          }}
          onReadBook={(book) => {
            setSelectedPreviewBook(null);
            setActivePreviewBookId(null);
            setPreviewOriginRect(null);
            useReaderStore.getState().openReader(book);
            router.push(ROUTES.READ(book.id));
          }}
        />
      </div>

      {/* Mobile/Tablet Touch-Friendly Book Action & Curation Sheet (< 1024px) */}
      <BookshelfMobileModal
        className="lg:hidden"
        selectedMobileBook={selectedPreviewBook}
          onClose={() => {
            setSelectedPreviewBook(null);
            setActivePreviewBookId(null);
            setPreviewOriginRect(null);
          }}
          activeView={activeView}
          onBookClick={(book) => {
            setSelectedPreviewBook(null);
            setActivePreviewBookId(null);
            setPreviewOriginRect(null);
            useReaderStore.getState().openReader(book);
            router.push(ROUTES.READ(book.id));
          }}
          onDownloadClick={(book) => {
            setSelectedPreviewBook(null);
            setActivePreviewBookId(null);
            setPreviewOriginRect(null);
            setSelectedDownloadBook(book);
          }}
          isOffline={selectedPreviewBook ? isBookOffline(selectedPreviewBook.id) : false}
          onToggleOffline={handleToggleOffline}
        />

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

      {/* Clear Shelf / Favorites Confirmation Modal */}
      <Modal
        isOpen={confirmClearType !== null}
        onClose={() => setConfirmClearType(null)}
        title={confirmClearType === 'shelf' ? 'Clear Personal Bookshelf' : 'Clear Favorite Books'}
        maxWidth="md"
      >
        <div className="p-6 space-y-5" data-testid="clear-confirmation-dialog">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground text-sm sm:text-base">
                {confirmClearType === 'shelf'
                  ? 'Are you sure you want to clear your bookshelf?'
                  : 'Are you sure you want to clear your favorites?'}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                {confirmClearType === 'shelf'
                  ? `This will remove all ${savedBooks.length} titles currently preserved on your personal reading shelf. This action cannot be undone.`
                  : `This will remove all ${favoriteBookIds.length} titles from your curated favorites list. This action cannot be undone.`}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmClearType(null)}
              className="text-xs font-mono uppercase"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent text-xs font-mono uppercase gap-1.5"
              onClick={() => {
                if (confirmClearType === 'shelf') {
                  clearSavedBooks();
                } else if (confirmClearType === 'favorites') {
                  useBookshelfStore.getState().clearFavoriteBooks();
                }
                setConfirmClearType(null);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              {confirmClearType === 'shelf' ? 'Yes, Clear Shelf' : 'Yes, Clear Favorites'}
            </Button>
          </div>
        </div>
      </Modal>

      <Footer />
      <BackToTop className={activeView === 'catalog' ? 'hidden sm:block' : ''} />
    </div>
  );
}

export default function Home() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomeContent />
    </React.Suspense>
  );
}
