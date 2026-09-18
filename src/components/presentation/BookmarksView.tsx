'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bookmark,
  Clock,
  CheckCircle2,
  PauseCircle,
  Compass,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useContinueReadingLedger, type BookmarksSortOption } from '@/hooks/reader/useContinueReadingLedger';
import { useOfflineBooks } from '@/hooks/useOfflineBooks';
import { useReaderStore } from '@/stores/useReaderStore';
import { BookmarkCard } from './BookmarkCard';
import { CollectionToolbar, type SortOption } from './CollectionToolbar';
import { smartScrollToContent } from '@/lib/scroll-utils';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Pagination } from '@/components/ui/Pagination';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ROUTES } from '@/config/routes';
import type { LedgerFilter, ActiveReadingVolume, LedgerItemStatus } from '@/types/book.types';

export interface BookmarksViewProps {
  onBrowseCatalog?: () => void;
}

const BOOKMARK_SORT_OPTIONS: SortOption[] = [
  { value: 'recent', label: 'Recently Read' },
  { value: 'title_asc', label: 'Title (A → Z)' },
  { value: 'title_desc', label: 'Title (Z → A)' },
  { value: 'author_asc', label: 'Author (A → Z)' },
  { value: 'author_desc', label: 'Author (Z → A)' },
  { value: 'progress_desc', label: 'Progress (High → Low)' },
  { value: 'progress_asc', label: 'Progress (Low → High)' },
];

const BOOKMARKS_PAGE_SIZE = 12;

export const BookmarksView: React.FC<BookmarksViewProps> = ({ onBrowseCatalog }) => {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [volumeToDelete, setVolumeToDelete] = useState<ActiveReadingVolume | null>(null);
  const [volumeToFinish, setVolumeToFinish] = useState<ActiveReadingVolume | null>(null);
  const { isBookOffline } = useOfflineBooks();

  const {
    filteredVolumes,
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    counts,
    updateVolumeStatus,
    clearVolumeProgress,
    clearAllVolumes,
  } = useContinueReadingLedger();

  // Reset page to 1 when filters, search query, or sorting change
  const [prevFilterKey, setPrevFilterKey] = useState(`${activeFilter}-${searchQuery}-${sortBy}`);
  const filterKey = `${activeFilter}-${searchQuery}-${sortBy}`;
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  const totalPages = Math.ceil(filteredVolumes.length / BOOKMARKS_PAGE_SIZE);
  const paginatedVolumes = useMemo(() => {
    const start = (currentPage - 1) * BOOKMARKS_PAGE_SIZE;
    return filteredVolumes.slice(start, start + BOOKMARKS_PAGE_SIZE);
  }, [filteredVolumes, currentPage]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    if (typeof window !== 'undefined') {
      const didScroll = smartScrollToContent('bookmarks-grid-content', { offsetTop: 80 });
      if (!didScroll && !document.getElementById('bookmarks-grid-content')) {
        const section = document.getElementById('bookmarks-ledger-section');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  };

  const handleStatusChange = (bookId: number, newStatus: LedgerItemStatus) => {
    const targetVolume = filteredVolumes.find((v) => v.book.id === bookId);
    if (!targetVolume) return;

    if (newStatus === 'completed' && targetVolume.progressPercent < 100) {
      setVolumeToFinish(targetVolume);
      return;
    }

    updateVolumeStatus(bookId, newStatus);
  };

  const handleResume = (bookId: number) => {
    const matchedVolume = filteredVolumes.find((v) => v.book.id === bookId);
    if (matchedVolume?.book) {
      useReaderStore.getState().openReader(matchedVolume.book);
    }
    router.push(ROUTES.READ(bookId));
  };

  const filterTabs: Array<{ id: LedgerFilter; label: string; count: number; icon: React.ReactNode }> = [
    { id: 'all', label: 'All Volumes', count: counts.all, icon: <Bookmark className="w-3.5 h-3.5" /> },
    { id: 'in_progress', label: 'In Progress', count: counts.in_progress, icon: <Clock className="w-3.5 h-3.5" /> },
    { id: 'completed', label: 'Completed', count: counts.completed, icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    { id: 'on_hold', label: 'On Hold', count: counts.on_hold, icon: <PauseCircle className="w-3.5 h-3.5" /> },
  ];

  return (
    <section
      id="bookmarks-ledger-section"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
      aria-label="Bookmarks and Continue Reading Ledger"
    >
      {/* Centered Editorial Header */}
      <SectionHeader
        eyebrow="READING LEDGER • PROGRESSIVE RESUME"
        title="Continue Reading & Bookmarks"
        subtitle="Pick up right where you left off across all your active public domain volumes."
      >
        {/* Clear Bookmarks Button */}
        {counts.all > 0 && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsClearConfirmOpen(true)}
              className="text-destructive border-border hover:border-destructive hover:bg-destructive/10 gap-1.5 text-xs font-mono uppercase"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear Bookmarks
            </Button>
          </div>
        )}
      </SectionHeader>

      {/* Smart Collection Toolbar for Bookmarks */}
      {counts.all > 0 && (
        <CollectionToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search your reading bookmarks by title, author, or subject..."
          searchAriaLabel="Search bookmarks"
          clearAriaLabel="Clear bookmarks search"
          totalCount={activeFilter === 'all' ? counts.all : counts[activeFilter]}
          filteredCount={filteredVolumes.length}
          sortValue={sortBy}
          onSortChange={(newSort) => setSortBy(newSort as BookmarksSortOption)}
          sortOptions={BOOKMARK_SORT_OPTIONS}
          sortAriaLabel="Sort bookmarks"
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={handlePageChange}
          paginationAriaLabel="Top bookmarks pagination"
          itemCountLabel={
            filteredVolumes.length > 0
              ? `${filteredVolumes.length} ${filteredVolumes.length === 1 ? 'volume' : 'volumes'}`
              : undefined
          }
          className="mb-8"
        />
      )}

      {/* Filter Navigation Tabs */}
      <div className="flex items-center justify-center mb-8 border-b border-border">
        <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-px" aria-label="Reading ledger filters">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                aria-pressed={isActive}
                aria-label={`${tab.label} (${tab.count} volumes)`}
                title={`${tab.label} (${tab.count} volumes)`}
                data-testid={`bookmarks-tab-${tab.id}`}
                className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 md:px-4 py-2 sm:py-2.5 text-xs font-mono uppercase tracking-wider font-semibold border-b-2 transition-all duration-200 cursor-pointer select-none shrink-0 ${
                  isActive
                    ? 'border-primary text-primary font-bold'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {tab.icon}
                <span className={isActive ? 'inline' : 'hidden md:inline'}>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Ledger Content */}
      <div key={`bookmarks-filter-${activeFilter}`} className="animate-page-turn">
        {filteredVolumes.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center max-w-lg mx-auto shadow-xs">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
              <Bookmark className="w-8 h-8" />
            </div>

            <h3 className="font-serif font-bold text-xl text-foreground mb-2">
              {searchQuery.trim()
                ? `No bookmarks matching "${searchQuery}"`
                : activeFilter === 'all'
                ? 'No active reading volumes yet'
                : `No volumes marked as ${activeFilter.replace('_', ' ')}`}
            </h3>

            <p className="text-sm text-muted-foreground font-serif leading-relaxed mb-6">
              {searchQuery.trim()
                ? 'Try adjusting your search terms, author name, or clear the search query.'
                : 'Volumes you begin reading or place bookmarks in will appear in this ledger with exact coordinates, completion percentages, and one-click chapter resume.'}
            </p>

            {searchQuery.trim() ? (
              <Button
                variant="outline"
                size="md"
                onClick={() => setSearchQuery('')}
                className="gap-2 font-mono text-xs uppercase tracking-wider font-bold mx-auto"
              >
                <span>Clear Search</span>
              </Button>
            ) : activeFilter !== 'all' ? (
              <Button
                variant="outline"
                size="md"
                onClick={() => setActiveFilter('all')}
                className="gap-2 font-mono text-xs uppercase tracking-wider font-bold mx-auto"
              >
                <span>View All Volumes</span>
              </Button>
            ) : (
              <Button
                variant="primary"
                size="md"
                onClick={onBrowseCatalog}
                className="gap-2 font-mono text-xs uppercase tracking-wider font-bold mx-auto"
              >
                <Compass className="w-4 h-4" />
                <span>Browse Library Catalog</span>
              </Button>
            )}
          </div>
        ) : (
          <>
            <div id="bookmarks-grid-content" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedVolumes.map((vol) => (
                <BookmarkCard
                  key={vol.book.id}
                  volume={vol}
                  isOffline={isBookOffline(vol.book.id)}
                  onResume={handleResume}
                  onStatusChange={handleStatusChange}
                  onClear={() => setVolumeToDelete(vol)}
                />
              ))}
            </div>

            {/* Pagination Controls (shown when > 12 items) */}
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              totalItems={filteredVolumes.length}
              pageSize={BOOKMARKS_PAGE_SIZE}
              className="mt-8"
            />
          </>
        )}
      </div>

    {/* Clear Bookmarks Confirmation Modal */}
      <Modal
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        title="Clear Reading Bookmarks"
        maxWidth="md"
        backdropClassName="bg-transparent backdrop-blur-none"
      >
        <div className="p-6 space-y-5" data-testid="clear-bookmarks-dialog">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground text-sm sm:text-base">
                Are you sure you want to clear your reading bookmarks?
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                This will reset your reading progress, exact coordinates, and reading positions across all{' '}
                <strong className="font-semibold text-foreground">{counts.all}</strong> active volumes in your ledger.
                This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsClearConfirmOpen(false)}
              className="text-xs font-mono uppercase"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent text-xs font-mono uppercase gap-1.5"
              onClick={() => {
                clearAllVolumes();
                setIsClearConfirmOpen(false);
              }}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Yes, Clear Bookmarks
            </Button>
          </div>
        </div>
      </Modal>

      {/* Remove Single Bookmark Confirmation Modal */}
      <Modal
        isOpen={Boolean(volumeToDelete)}
        onClose={() => setVolumeToDelete(null)}
        title="Remove Bookmark"
        maxWidth="sm"
        backdropClassName="bg-transparent backdrop-blur-none"
      >
        <div className="p-6 space-y-4" data-testid="remove-bookmark-dialog">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-destructive/10 text-destructive shrink-0">
              <Trash2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground text-sm">
                Remove &ldquo;{volumeToDelete?.book.title}&rdquo; from reading ledger?
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This will reset your saved reading progress and position for this book. This action cannot be undone.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="chip"
              onClick={() => setVolumeToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="chip"
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground border-transparent"
              onClick={() => {
                if (volumeToDelete) {
                  clearVolumeProgress(volumeToDelete.book.id);
                  setVolumeToDelete(null);
                }
              }}
            >
              Remove Bookmark
            </Button>
          </div>
        </div>
      </Modal>

      {/* Mark as Finished Confirmation Modal */}
      <Modal
        isOpen={Boolean(volumeToFinish)}
        onClose={() => setVolumeToFinish(null)}
        title="Mark as Finished"
        maxWidth="sm"
        backdropClassName="bg-transparent backdrop-blur-none"
      >
        <div className="p-6 space-y-4" data-testid="finish-bookmark-dialog">
          <div className="flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 sepia:text-emerald-400 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold text-foreground text-sm">
                Mark &ldquo;{volumeToFinish?.book.title}&rdquo; as finished?
              </p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                This will advance your recorded reading progress from{' '}
                <strong className="font-semibold text-foreground">
                  {Math.round(volumeToFinish?.progressPercent ?? 0)}%
                </strong>{' '}
                to <strong className="font-semibold text-foreground">100%</strong> and mark the volume as completed.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="outline"
              size="chip"
              onClick={() => setVolumeToFinish(null)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="chip"
              onClick={() => {
                if (volumeToFinish) {
                  updateVolumeStatus(volumeToFinish.book.id, 'completed');
                  setVolumeToFinish(null);
                }
              }}
            >
              Mark as Finished
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
};

