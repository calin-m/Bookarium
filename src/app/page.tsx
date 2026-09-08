'use client';

import React, { useState, useMemo, useEffect } from 'react';
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
import { useHasMounted } from '@/hooks/useHasMounted';
import type { GutendexBook } from '@/types/book.types';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { CollectionSearchBar } from '@/components/presentation/CollectionSearchBar';
import { filterBooksSmart } from '@/lib/smart-search';
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

  // Auto-healing: detect any favorite IDs in localStorage that lack full book metadata
  const missingFavoriteIds = useMemo(() => {
    if (!hasMounted) return [];
    const knownIds = new Set((favoriteBooks || []).map((b) => b.id));
    return favoriteBookIds.filter((id) => !knownIds.has(id));
  }, [favoriteBookIds, favoriteBooks, hasMounted]);

  const missingIdsParam = missingFavoriteIds.length > 0 ? missingFavoriteIds.join(',') : undefined;

  const { data: missingBooksData, isLoading: isMissingLoading } = useBooks(
    missingIdsParam ? { ids: missingIdsParam } : undefined,
    { enabled: Boolean(missingIdsParam) }
  );

  // Sync returned book objects into favoriteBooks store
  useEffect(() => {
    if (missingFavoriteIds.length > 0 && missingBooksData?.results && missingBooksData.results.length > 0) {
      useBookshelfStore.getState().syncFavoriteBooks(missingBooksData.results);
    }
  }, [missingBooksData, missingFavoriteIds]);

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

  // Reset collection search query when switching views
  const [prevActiveView, setPrevActiveView] = useState(activeView);
  if (prevActiveView !== activeView) {
    setPrevActiveView(activeView);
    setCollectionSearchQuery('');
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

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    if (typeof window !== 'undefined') {
      const el = document.getElementById('catalog-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const handleViewModeChange = (mode: 'grid' | 'shelf') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      const el = document.getElementById('catalog-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Convert chips for toolbar interface
  const toolbarChips: ActiveFilterChip[] = activeFilterChips.map((chip) => ({
    id: chip.id,
    label: chip.label,
    onRemove: () => removeFilterChip(chip.id),
  }));

  // Smart filtered collection books (order-independent search)
  const filteredSavedBooks = useMemo(
    () => filterBooksSmart(savedBooks, collectionSearchQuery),
    [savedBooks, collectionSearchQuery]
  );

  const uniqueKnownFavoriteBooks = useMemo(() => {
    const allKnown = [
      ...(favoriteBooks || []),
      ...(missingBooksData?.results || []),
      ...(booksData?.results || []),
      ...savedBooks,
    ];
    const uniqueKnown = Array.from(new Map(allKnown.map((b) => [b.id, b])).values());
    return uniqueKnown.filter((b) => favoriteBookIds.includes(b.id));
  }, [favoriteBooks, missingBooksData?.results, booksData?.results, savedBooks, favoriteBookIds]);

  const filteredFavoriteBooks = useMemo(
    () => filterBooksSmart(uniqueKnownFavoriteBooks, collectionSearchQuery),
    [uniqueKnownFavoriteBooks, collectionSearchQuery]
  );

  // Derive displayed books with windowed sub-page slicing based on active view
  let displayedBooks = booksData?.results ? booksData.results.slice(sliceStart, sliceEnd) : [];
  let isDisplayLoading = isLoading;
  let isDisplayError = isError;

  if (activeView === 'bookshelf') {
    displayedBooks = filteredSavedBooks;
    isDisplayLoading = false;
    isDisplayError = false;
  } else if (activeView === 'favorites') {
    displayedBooks = filteredFavoriteBooks;
    isDisplayLoading = missingFavoriteIds.length > 0 && isMissingLoading;
    isDisplayError = false;
  }

  const viewConfig =
    VIEW_CONTENT_CONFIG[activeView as 'catalog' | 'bookshelf' | 'favorites'] ||
    VIEW_CONTENT_CONFIG.catalog;

  const isShelf = activeView === 'bookshelf';
  const isFavorites = activeView === 'favorites';
  const collectionCount = isShelf ? savedBooks.length : isFavorites ? favoriteBookIds.length : 0;
  const filteredCollectionBooks = isShelf
    ? filteredSavedBooks
    : isFavorites
    ? filteredFavoriteBooks
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
                  authors: [{ name: authorName, birth_year: null, death_year: null }],
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
            onClearAllFilters={handleResetAllFilters}
            isFetching={isFetching}
            onPrefetchNext={prefetchNextPage}
            latencyMs={booksData?.latencyMs}
            isError={isError}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            isHeaderVisible={isHeaderVisible}
            isVisible={isToolbarVisible}
          />
        )}

        {activeView === 'notebook' ? (
          <NotebookView onBrowseCatalog={() => setActiveView('catalog')} />
        ) : activeView === 'bookmarks' ? (
          <BookmarksView onBrowseCatalog={() => setActiveView('catalog')} />
        ) : (
          <div id="catalog-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div key={`view-page-turn-${activeView}`} className="animate-page-turn">
              {/* Booksaw Centered Section Header */}
              <SectionHeader
                eyebrow={viewConfig.eyebrow}
                title={viewConfig.getTitle({ search, topic, era })}
                subtitle={viewConfig.getSubtitle({
                  count: collectionCount,
                  booksData,
                  displayedCount: displayedBooks.length,
                })}
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

              {/* Smart Collection Search Bar for Bookshelf & Favorites */}
              {viewConfig.collectionName && collectionCount > 0 && (
                <CollectionSearchBar
                  query={collectionSearchQuery}
                  onQueryChange={setCollectionSearchQuery}
                  placeholder={viewConfig.searchPlaceholder!}
                  totalCount={collectionCount}
                  filteredCount={filteredCollectionBooks.length}
                  collectionName={viewConfig.collectionName}
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
        onResetAll={handleResetAllFilters}
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

      <BackToTop />
      <Footer />
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
