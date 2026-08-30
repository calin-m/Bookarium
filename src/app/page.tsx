'use client';

import React, { useState } from 'react';
import { Navbar } from '@/components/presentation/Navbar';
import { HeroSearch } from '@/components/presentation/HeroSearch';
import { BookGrid } from '@/components/presentation/BookGrid';
import { BookReaderModal } from '@/components/presentation/BookReaderModal';
import { DownloadDrawer } from '@/components/presentation/DownloadDrawer';
import { Footer } from '@/components/presentation/Footer';
import { useBooks } from '@/hooks/queries/useBooks';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import type { GutendexBook } from '@/mocks/handlers';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function Home() {
  const [activeView, setActiveView] = useState<'catalog' | 'bookshelf' | 'likes'>('catalog');
  const [search, setSearch] = useState('');
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDownloadBook, setSelectedDownloadBook] = useState<GutendexBook | null>(null);

  // Bookshelf store items
  const savedBooks = useBookshelfStore((s) => s.savedBooks);
  const likedBookIds = useBookshelfStore((s) => s.likedBookIds);
  const clearBookshelf = useBookshelfStore((s) => s.clearBookshelf);

  // Server Query
  const {
    data: booksData,
    isLoading,
    isError,
    refetch,
  } = useBooks({
    search,
    topic,
    languages: language,
    page,
    copyright: false,
  });

  const handleSearchChange = (val: string) => {
    setSearch(val);
    setPage(1);
  };

  const handleTopicChange = (val: string) => {
    setTopic(val);
    setPage(1);
  };

  const handleLanguageChange = (val: string) => {
    setLanguage(val);
    setPage(1);
  };

  // Derive displayed books based on active view
  let displayedBooks = booksData?.results || [];
  let isDisplayLoading = isLoading;
  let isDisplayError = isError;

  if (activeView === 'bookshelf') {
    displayedBooks = savedBooks;
    isDisplayLoading = false;
    isDisplayError = false;
  } else if (activeView === 'likes') {
    // Books matching liked IDs from current catalog or saved
    const allKnown = [...(booksData?.results || []), ...savedBooks];
    const uniqueKnown = Array.from(new Map(allKnown.map((b) => [b.id, b])).values());
    displayedBooks = uniqueKnown.filter((b) => likedBookIds.includes(b.id));
    isDisplayLoading = false;
    isDisplayError = false;
  }

  return (
    <div className="min-h-screen flex flex-col justify-between bg-paper-50/50 dark:bg-stone-950">
      <Navbar activeView={activeView} onViewChange={setActiveView} />

      <main className="flex-1">
        {activeView === 'catalog' && (
          <HeroSearch
            search={search}
            onSearchChange={handleSearchChange}
            selectedTopic={topic}
            onTopicChange={handleTopicChange}
            selectedLanguage={language}
            onLanguageChange={handleLanguageChange}
          />
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-2xl sm:text-3xl font-serif font-bold text-stone-900 dark:text-stone-100">
                  {activeView === 'catalog' && (search || topic ? 'Search Catalog' : 'Curated Library Editions')}
                  {activeView === 'bookshelf' && 'Personal Reading Shelf'}
                  {activeView === 'likes' && 'Favorite Works'}
                </h2>
                {activeView === 'catalog' && (
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300">
                    CC0 / Free
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-stone-500 font-serif italic mt-1">
                {activeView === 'catalog' &&
                  (booksData
                    ? `Displaying ${displayedBooks.length} of ${booksData.count.toLocaleString()} public domain volumes`
                    : 'Searching Project Gutenberg catalog...')}
                {activeView === 'bookshelf' &&
                  `You have ${savedBooks.length} titles preserved on your personal shelf`}
                {activeView === 'likes' &&
                  `You have ${likedBookIds.length} titles in your favorites`}
              </p>
            </div>

            {activeView === 'bookshelf' && savedBooks.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={clearBookshelf}
                className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-900/60 hover:bg-red-50 dark:hover:bg-red-950/40 gap-1.5 self-start sm:self-auto text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear Shelf
              </Button>
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
            onPageChange={activeView === 'catalog' ? setPage : undefined}
            hasNextPage={Boolean(booksData?.next)}
            onDownloadClick={(book) => setSelectedDownloadBook(book)}
            initialViewMode={activeView === 'bookshelf' ? 'shelf' : 'grid'}
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
                : 'Try adjusting your search keywords, collection facets, or clearing the language filter.'
            }
          />
        </div>
      </main>

      {/* Reader Modal */}
      <BookReaderModal />

      {/* Download Hub Drawer */}
      <DownloadDrawer
        book={selectedDownloadBook}
        isOpen={Boolean(selectedDownloadBook)}
        onClose={() => setSelectedDownloadBook(null)}
      />

      <Footer />
    </div>
  );
}
