'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/presentation/Navbar';
import { HeroSearch } from '@/components/presentation/HeroSearch';
import { StickyCatalogToolbar, type ActiveFilterChip } from '@/components/presentation/StickyCatalogToolbar';
import { AdvancedFilterDrawer } from '@/components/presentation/AdvancedFilterDrawer';
import { BookGrid } from '@/components/presentation/BookGrid';
import { LiteraryQuotes } from '@/components/presentation/LiteraryQuotes';
import { DownloadDrawer } from '@/components/presentation/DownloadDrawer';
import { Footer } from '@/components/presentation/Footer';
import { BackToTop } from '@/components/ui/BackToTop';
import { useBooks, usePrefetchNextPage } from '@/hooks/queries/useBooks';
import { useCatalogFilters } from '@/hooks/useCatalogFilters';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useReaderStore } from '@/stores/useReaderStore';
import type { GutendexBook } from '@/mocks/handlers';
import { Trash2, BookOpen, Quote, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function Home() {
  const router = useRouter();
  const [selectedDownloadBook, setSelectedDownloadBook] = useState<GutendexBook | null>(null);

  // Bookshelf store items
  const savedBooks = useBookshelfStore((s) => s.savedBooks);
  const likedBooks = useBookshelfStore((s) => s.likedBooks || []);
  const likedBookIds = useBookshelfStore((s) => s.likedBookIds);
  const clearSavedBooks = useBookshelfStore((s) => s.clearSavedBooks);

  // Auto-healing: detect any liked IDs in localStorage that lack full book metadata
  const missingLikedIds = useMemo(() => {
    const knownIds = new Set((likedBooks || []).map((b) => b.id));
    return likedBookIds.filter((id) => !knownIds.has(id));
  }, [likedBookIds, likedBooks]);

  const missingIdsParam = missingLikedIds.length > 0 ? missingLikedIds.join(',') : undefined;

  const { data: missingBooksData, isLoading: isMissingLoading } = useBooks(
    missingIdsParam ? { ids: missingIdsParam } : undefined
  );

  // Sync returned book objects into likedBooks store
  useEffect(() => {
    if (missingLikedIds.length > 0 && missingBooksData?.results && missingBooksData.results.length > 0) {
      useBookshelfStore.getState().syncLikedBooks(missingBooksData.results);
    }
  }, [missingBooksData, missingLikedIds]);

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

  // Server Query
  const {
    data: booksData,
    isLoading,
    isError,
    isFetching,
    refetch,
  } = useBooks(queryParams);

  // Predictive Next-Page Prefetching
  const prefetchNextPage = usePrefetchNextPage(queryParams, Boolean(booksData?.next));

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
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

  // Derive displayed books based on active view
  let displayedBooks = booksData?.results ? booksData.results.slice(0, pageSize) : [];
  let isDisplayLoading = isLoading;
  let isDisplayError = isError;

  if (activeView === 'bookshelf') {
    displayedBooks = savedBooks;
    isDisplayLoading = false;
    isDisplayError = false;
  } else if (activeView === 'likes') {
    const allKnown = [
      ...(likedBooks || []),
      ...(missingBooksData?.results || []),
      ...(booksData?.results || []),
      ...savedBooks,
    ];
    const uniqueKnown = Array.from(new Map(allKnown.map((b) => [b.id, b])).values());
    displayedBooks = uniqueKnown.filter((b) => likedBookIds.includes(b.id));
    isDisplayLoading = missingLikedIds.length > 0 && isMissingLoading;
    isDisplayError = false;
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-background text-foreground transition-colors duration-200">
      <Navbar activeView={activeView} onViewChange={setActiveView} />

      <main className={`flex-1 transition-all duration-300 ${isFilterDrawerOpen ? 'lg:pl-96' : 'lg:pl-0'}`}>
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
                const bookPayload: GutendexBook = {
                  id: featured.id,
                  title: featured.title,
                  authors: [{ name: featured.author, birth_year: null, death_year: null }],
                  translators: [],
                  subjects: [featured.primarySubject],
                  bookshelves: [],
                  languages: ['en'],
                  copyright: false,
                  media_type: 'Text',
                  formats: {},
                  download_count: 50000,
                };
                useReaderStore.getState().openReader(bookPayload);
                router.push(`/read/${featured.id}`);
                return;
              }
              const targetBook = displayedBooks[0];
              if (targetBook) {
                useReaderStore.getState().openReader(targetBook);
              }
              const targetId = targetBook?.id || 1342;
              router.push(`/read/${targetId}`);
            }}
          />
        )}

        {/* Sticky Sub-Header Toolbar for Catalog View */}
        {activeView === 'catalog' && (
          <StickyCatalogToolbar
            page={page}
            onPageChange={handlePageChange}
            hasNextPage={Boolean(booksData?.next)}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
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
          />
        )}

        <div id="catalog-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Booksaw Centered Section Header */}
          <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
            <div className="text-[11px] font-mono tracking-widest uppercase text-muted-foreground font-semibold">
              {activeView === 'catalog' && 'SOME QUALITY BOOKS • ZERO COPYRIGHT'}
              {activeView === 'bookshelf' && 'PERSONAL ARCHIVE • PRESERVED LOCALLY'}
              {activeView === 'likes' && 'CURATED FAVORITES'}
            </div>
            
            <div className="flex items-center justify-center gap-3">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-bold text-foreground tracking-tight">
                {activeView === 'catalog' && (search || topic || era ? 'Search Catalog' : 'Featured Public Domain Books')}
                {activeView === 'bookshelf' && 'Personal Reading Shelf'}
                {activeView === 'likes' && 'Favorite Works'}
              </h2>
            </div>

            <p className="text-xs sm:text-sm text-muted-foreground font-serif italic">
              {activeView === 'catalog' &&
                (booksData
                  ? `Displaying ${displayedBooks.length} of ${booksData.count.toLocaleString()} public domain volumes`
                  : 'Searching Project Gutenberg catalog...')}
              {activeView === 'bookshelf' &&
                `You have ${savedBooks.length} titles preserved on your personal shelf`}
              {activeView === 'likes' &&
                `You have ${likedBookIds.length} titles in your favorites`}
            </p>

            {activeView === 'bookshelf' && savedBooks.length > 0 && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearSavedBooks}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5 text-xs font-mono uppercase"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Shelf
                </Button>
              </div>
            )}

            {activeView === 'likes' && likedBookIds.length > 0 && (
              <div className="pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => useBookshelfStore.getState().clearLikedBooks()}
                  className="text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5 text-xs font-mono uppercase"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear Favorites
                </Button>
              </div>
            )}
          </div>

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
            viewMode={activeView === 'bookshelf' ? 'shelf' : viewMode}
            onViewModeChange={setViewMode}
            showViewToggle={false} // Managed by StickyToolbar
            emptyTitle={
              activeView === 'bookshelf'
                ? 'Your personal shelf is currently empty'
                : activeView === 'likes'
                ? 'No liked books yet'
                : 'No matching public domain works found'
            }
            emptyDescription={
              activeView === 'bookshelf'
                ? 'Click the bookmark ribbon on any volume to place it on your shelf for offline access.'
                : activeView === 'likes'
                ? 'Click the heart icon on any work to save it to your favorites.'
                : 'Try adjusting your search keywords, collection facets, or clearing the language/era filter.'
            }
          />
        </div>

        {/* Booksaw Editorial Quote / Best Classic Section */}
        {activeView === 'catalog' && (
          <section className="bg-muted border-t border-border py-16 transition-colors">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center bg-card rounded-2xl p-8 sm:p-12 border border-border shadow-booksaw">
                <div className="md:col-span-4 flex justify-center">
                  <div className="w-48 aspect-[2/3] rounded-lg bg-gradient-to-br from-stone-900 to-stone-800 text-white p-5 flex flex-col justify-between shadow-booksaw-hover border-r-2 border-stone-700">
                    <div className="text-[10px] font-mono uppercase tracking-widest text-primary-400">
                      Classic of the Century
                    </div>
                    <div>
                      <h4 className="font-serif font-bold text-lg leading-tight">
                        Moby Dick
                      </h4>
                      <p className="text-xs text-stone-300 font-mono mt-1">
                        Herman Melville
                      </p>
                    </div>
                    <div className="text-[10px] font-mono text-emerald-400">
                      Public Domain • 1851
                    </div>
                  </div>
                </div>

                <div className="md:col-span-8 space-y-4 text-left">
                  <Quote className="w-8 h-8 text-primary-500/40" />
                  <blockquote className="text-xl sm:text-2xl font-serif italic text-stone-900 dark:text-stone-100 leading-snug">
                    &ldquo;There is no friend as loyal as a book. A library is an infinity of voices waiting to speak across centuries.&rdquo;
                  </blockquote>
                  <p className="text-xs font-mono uppercase tracking-widest text-stone-500">
                    Ernest Hemingway • Preserved for Public Humanity
                  </p>
                  <div className="pt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        const targetId = displayedBooks[0]?.id || 2701;
                        router.push(`/read/${targetId}`);
                      }}
                      className="font-mono text-xs uppercase tracking-wider gap-2 px-5 py-2.5 rounded bg-primary-600 hover:bg-primary-700 text-white font-bold"
                    >
                      <BookOpen className="w-4 h-4" />
                      <span>Start Reading Classics</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Booksaw 3-Column Literary Quotes & Passages */}
        {activeView === 'catalog' && <LiteraryQuotes />}
      </main>

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

      <BackToTop />
      <Footer />
    </div>
  );
}
