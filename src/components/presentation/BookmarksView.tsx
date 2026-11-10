'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bookmark,
  CheckCircle2,
  Compass,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { useContinueReadingLedger } from '@/hooks/reader/useContinueReadingLedger';
import { useReaderStore } from '@/stores/useReaderStore';
import { BookmarkCard } from './BookmarkCard';
import { CollectionToolbar, type SortOption } from './CollectionToolbar';
import { CollectionBottomDock } from './CollectionBottomDock';
import { CollectionFloatingSearch } from './CollectionFloatingSearch';
import { CollectionFilterDrawer } from './CollectionFilterDrawer';
import { smartScrollToContent, runPreservingScrollPosition } from '@/lib/scroll-utils';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { RemoveOfflineBookModal } from '@/components/ui/RemoveOfflineBookModal';
import { Pagination } from '@/components/ui/Pagination';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ROUTES } from '@/config/routes';
import type { LedgerFilter, ActiveReadingVolume, LedgerItemStatus, GutendexBook, Book } from '@/types/book.types';

export interface BookmarksViewProps {
  onBrowseCatalog?: () => void;
}

const BOOKMARK_SORT_FIELD_OPTIONS: SortOption[] = [
  { value: 'recent', label: 'Date Read' },
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'progress', label: 'Progress' },
];

const BOOKMARKS_PAGE_SIZE = 12;

export const BookmarksView: React.FC<BookmarksViewProps> = ({ onBrowseCatalog }) => {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [activeBookId, setActiveBookId] = useState<number | null>(null);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [volumeToDelete, setVolumeToDelete] = useState<ActiveReadingVolume | null>(null);
  const [volumeToFinish, setVolumeToFinish] = useState<ActiveReadingVolume | null>(null);
  const [bookToRemoveOffline, setBookToRemoveOffline] = useState<GutendexBook | Book | null>(null);
  const [isBottomSearchOpen, setIsBottomSearchOpen] = useState(false);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);

  const {
    filteredVolumes,
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    sortBy,
    setSortBy,
    counts,
    isBookOffline,
    downloadBook,
    removeBook,
    downloadingBookId,
    updateVolumeStatus,
    clearVolumeProgress,
    clearAllVolumes,
  } = useContinueReadingLedger();

  const handleToggleOffline = async (book: GutendexBook | Book) => {
    if (isBookOffline(book.id)) {
      setBookToRemoveOffline(book);
    } else {
      await downloadBook(book);
    }
  };

  // Reset page to 1 when filters, search query, or sorting change
  const [prevFilterKey, setPrevFilterKey] = useState(`${activeFilter}-${searchQuery}-${sortBy}`);
  const filterKey = `${activeFilter}-${searchQuery}-${sortBy}`;
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  const totalPages = Math.ceil(filteredVolumes.length / BOOKMARKS_PAGE_SIZE);
  const safeCurrentPage = Math.min(currentPage, Math.max(1, totalPages));
  const paginatedVolumes = useMemo(() => {
    const start = (safeCurrentPage - 1) * BOOKMARKS_PAGE_SIZE;
    return filteredVolumes.slice(start, start + BOOKMARKS_PAGE_SIZE);
  }, [filteredVolumes, safeCurrentPage]);

  // Single-column mobile scroll focus zone (< 1024px) and tactile dismissal
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleScrollOrResize = () => {
      if (window.innerWidth >= 1024) return;
      const grid = document.getElementById('bookmarks-grid-content');
      if (!grid) return;
      const cardEls = Array.from(grid.querySelectorAll<HTMLElement>('[data-bookmark-card-id]'));
      if (cardEls.length === 0) return;

      // Top boundary: near page top
      if (window.scrollY <= 32) {
        const firstId = Number(cardEls[0].getAttribute('data-bookmark-card-id'));
        if (firstId) {
          setActiveBookId(firstId);
          return;
        }
      }

      // Bottom boundary: near page bottom
      const isAtBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 32;
      if (isAtBottom) {
        const lastId = Number(cardEls[cardEls.length - 1].getAttribute('data-bookmark-card-id'));
        if (lastId) {
          setActiveBookId(lastId);
          return;
        }
      }

      // Viewport central focus band: ~45% from top
      const targetY = window.innerHeight * 0.45;
      let closestId: number | null = null;
      let minDistance = Infinity;

      for (const el of cardEls) {
        const rect = el.getBoundingClientRect();
        if (rect.bottom >= 0 && rect.top <= window.innerHeight) {
          const cardCenterY = rect.top + rect.height / 2;
          const dist = Math.abs(cardCenterY - targetY);
          if (dist < minDistance) {
            minDistance = dist;
            const id = Number(el.getAttribute('data-bookmark-card-id'));
            if (id) {
              closestId = id;
            }
          }
        }
      }

      if (closestId !== null) {
        setActiveBookId(closestId);
      }
    };

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(handleScrollOrResize);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    handleScrollOrResize();

    // Tap outside cards clears active state
    const handleDocumentPointerDown = (e: PointerEvent | MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && !target.closest('[data-bookmark-card-id]')) {
        setActiveBookId(null);
      }
    };

    document.addEventListener('pointerdown', handleDocumentPointerDown, { passive: true });

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      document.removeEventListener('pointerdown', handleDocumentPointerDown);
    };
  }, [paginatedVolumes]);

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

    const hasPlacedBookmark =
      (targetVolume.bookmarkRow !== undefined && targetVolume.bookmarkRow > 0) ||
      Boolean(targetVolume.bookmarkText);

    if (newStatus === 'completed' && (targetVolume.progressPercent < 100 || hasPlacedBookmark)) {
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

  const sortField = useMemo(() => {
    if (sortBy.startsWith('title_')) return 'title';
    if (sortBy.startsWith('author_')) return 'author';
    if (sortBy.startsWith('progress_')) return 'progress';
    return 'recent';
  }, [sortBy]);

  const sortDirection: 'asc' | 'desc' = useMemo(() => {
    if (sortBy.endsWith('asc')) return 'asc';
    return 'desc';
  }, [sortBy]);

  const isDirectionDisabled = sortBy === 'downloaded';

  const handleSortFieldChange = (newField: string) => {
    if (newField === 'title') {
      setSortBy('title_asc');
    } else if (newField === 'author') {
      setSortBy('author_asc');
    } else if (newField === 'progress') {
      setSortBy('progress_desc');
    } else {
      setSortBy('recent');
    }
  };

  const handleDirectionToggle = () => {
    runPreservingScrollPosition(() => {
      if (sortField === 'title') {
        setSortBy(sortBy === 'title_asc' ? 'title_desc' : 'title_asc');
      } else if (sortField === 'author') {
        setSortBy(sortBy === 'author_asc' ? 'author_desc' : 'author_asc');
      } else if (sortField === 'progress') {
        setSortBy(sortBy === 'progress_desc' ? 'progress_asc' : 'progress_desc');
      } else if (sortField === 'recent') {
        setSortBy(sortBy === 'recent' ? 'recent_asc' : 'recent');
      }
    });
  };

  const directionAriaLabel = useMemo(() => {
    if (isDirectionDisabled) return 'Sorting direction is fixed';
    if (sortField === 'title') {
      return sortDirection === 'asc'
        ? 'Title A to Z (click to sort Z to A)'
        : 'Title Z to A (click to sort A to Z)';
    }
    if (sortField === 'author') {
      return sortDirection === 'asc'
        ? 'Author A to Z (click to sort Z to A)'
        : 'Author Z to A (click to sort A to Z)';
    }
    if (sortField === 'progress') {
      return sortDirection === 'desc'
        ? 'Progress High to Low (click to sort Low to High)'
        : 'Progress Low to High (click to sort High to Low)';
    }
    if (sortField === 'recent') {
      return sortDirection === 'desc'
        ? 'Most recently read (click to sort least recently read)'
        : 'Least recently read (click to sort most recently read)';
    }
    return sortDirection === 'asc'
      ? 'Sort Ascending (click to sort Descending)'
      : 'Sort Descending (click to sort Ascending)';
  }, [isDirectionDisabled, sortField, sortDirection]);

  const filterOptions: SortOption[] = useMemo(
    () => [
      { value: 'all', label: `All Volumes (${counts.all})` },
      { value: 'in_progress', label: `In Progress (${counts.in_progress})` },
      { value: 'completed', label: `Completed (${counts.completed})` },
      { value: 'on_hold', label: `On Hold (${counts.on_hold})` },
      { value: 'downloaded', label: `Downloaded (${counts.downloaded})` },
    ],
    [counts]
  );

  const drawerStatusOptions = useMemo(
    () => [
      { id: 'all', label: 'All Volumes', count: counts.all },
      { id: 'in_progress', label: 'In Progress', count: counts.in_progress },
      { id: 'completed', label: 'Completed', count: counts.completed },
      { id: 'on_hold', label: 'On Hold', count: counts.on_hold },
      { id: 'downloaded', label: 'Downloaded', count: counts.downloaded },
    ],
    [counts]
  );

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (activeFilter !== 'all') count++;
    if (sortField !== 'recent') count++;
    if (searchQuery.trim().length > 0) count++;
    return count;
  }, [activeFilter, sortField, searchQuery]);

  return (
    <section
      id="bookmarks-ledger-section"
      className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12 [overflow-anchor:none]"
      aria-label="Bookmarks and Continue Reading Ledger"
    >
      {/* Centered Editorial Header */}
      <SectionHeader
        eyebrow="READING LEDGER • PROGRESSIVE RESUME"
        title="Bookmarks"
        subtitle="Pick up right where you left off across all your volumes."
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
          totalCount={counts[activeFilter] ?? counts.all}
          filteredCount={filteredVolumes.length}
          filterValue={activeFilter}
          onFilterChange={(newFilter) => setActiveFilter(newFilter as LedgerFilter)}
          filterOptions={filterOptions}
          filterAriaLabel="Filter bookmarks by status"
          sortValue={sortField}
          onSortChange={handleSortFieldChange}
          sortOptions={BOOKMARK_SORT_FIELD_OPTIONS}
          sortAriaLabel="Sort bookmarks"
          sortDirection={sortDirection}
          onDirectionToggle={handleDirectionToggle}
          isDirectionDisabled={isDirectionDisabled}
          directionAriaLabel={directionAriaLabel}
          hiddenOnMobile={true}
          className="mb-8"
        />
      )}

      {/* Main Ledger Content */}
      <div>
        {filteredVolumes.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border p-12 text-center max-w-lg mx-auto shadow-xs">
            <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
              <Bookmark className="w-8 h-8" />
            </div>

            <h3 className="font-serif font-bold text-xl text-foreground mb-2">
              {searchQuery.trim()
                ? `No bookmarks matching "${searchQuery}"`
                : activeFilter === 'downloaded' || sortBy === 'downloaded'
                ? 'No downloaded volumes'
                : activeFilter === 'all'
                ? 'No active reading volumes yet'
                : `No volumes marked as ${activeFilter.replace('_', ' ')}`}
            </h3>

            <p className="text-sm text-muted-foreground font-serif leading-relaxed mb-6">
              {searchQuery.trim()
                ? 'Try adjusting your search terms, author name, or clear the search query.'
                : activeFilter === 'downloaded' || sortBy === 'downloaded'
                ? 'Volumes saved for offline reading will appear here.'
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
                onClick={() => {
                  setActiveFilter('all');
                  if (sortBy === 'downloaded') setSortBy('recent');
                }}
                className="gap-2 font-mono text-xs uppercase tracking-wider font-bold mx-auto"
              >
                <span>View All Volumes</span>
              </Button>
            ) : sortBy === 'downloaded' ? (
              <Button
                variant="outline"
                size="md"
                onClick={() => setSortBy('recent')}
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
            <div id="bookmarks-grid-content" className="grid grid-cols-1 lg:grid-cols-2 gap-4 [overflow-anchor:none]">
              {paginatedVolumes.map((vol) => (
                <BookmarkCard
                  key={vol.book.id}
                  volume={vol}
                  isOffline={isBookOffline(vol.book.id)}
                  isDownloadingOffline={downloadingBookId === vol.book.id}
                  isActive={activeBookId === vol.book.id}
                  onActivate={(bookId) => setActiveBookId(bookId)}
                  onDeactivate={(bookId) => setActiveBookId((prev) => (prev === bookId ? null : prev))}
                  onToggleOffline={handleToggleOffline}
                  onResume={handleResume}
                  onStatusChange={handleStatusChange}
                  onClear={() => setVolumeToDelete(vol)}
                />
              ))}
            </div>

            {/* Pagination Controls (shown when > 12 items) */}
            <Pagination
              currentPage={safeCurrentPage}
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
            <div className="space-y-1.5">
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
              {((volumeToFinish?.bookmarkRow !== undefined && volumeToFinish.bookmarkRow > 0) ||
                Boolean(volumeToFinish?.bookmarkText)) && (
                <div
                  data-testid="finish-bookmark-reset-notice"
                  className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300 sepia:text-amber-400"
                >
                  <Bookmark className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Your placed bookmark
                    {volumeToFinish?.bookmarkRow && volumeToFinish.bookmarkRow > 0
                      ? ` on Line ${volumeToFinish.bookmarkRow + 1} (Page ${volumeToFinish.globalPage || 1})`
                      : ''}{' '}
                    will also be reset.
                  </span>
                </div>
              )}
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

      {/* Remove Single Offline Copy Confirmation Modal */}
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

      {/* Mobile Floating Search */}
      <CollectionFloatingSearch
        isOpen={isBottomSearchOpen}
        onClose={() => setIsBottomSearchOpen(false)}
        searchQuery={searchQuery}
        onSearchChange={(q) => {
          setSearchQuery(q);
          if (q) {
            smartScrollToContent('bookmarks-grid-content', { offsetTop: 80 });
          }
        }}
        searchPlaceholder="Search bookmarks by title or author..."
        searchAriaLabel="Search bookmarks"
        clearAriaLabel="Clear bookmarks search"
      />

      {/* Mobile Filter & Sort Drawer */}
      <CollectionFilterDrawer
        isOpen={isFilterDrawerOpen}
        onClose={() => setIsFilterDrawerOpen(false)}
        title="Bookmarks Filters & Sort"
        subtitle={activeFilterCount > 0 ? `${activeFilterCount} active filters` : 'Reading status and sort order'}
        activeFilterCount={activeFilterCount}
        shelfOptions={drawerStatusOptions}
        selectedShelfId={activeFilter}
        onSelectShelf={(id) => setActiveFilter(id as LedgerFilter)}
        shelfSectionTitle="Reading Status"
        sortOptions={BOOKMARK_SORT_FIELD_OPTIONS}
        selectedSort={sortField}
        onSortChange={handleSortFieldChange}
        sortSectionTitle="Sort By"
        sortDirection={sortDirection}
        onDirectionToggle={handleDirectionToggle}
        onDirectionChange={(dir) => {
          runPreservingScrollPosition(() => {
            if (sortField === 'title') {
              setSortBy(dir === 'asc' ? 'title_asc' : 'title_desc');
            } else if (sortField === 'author') {
              setSortBy(dir === 'asc' ? 'author_asc' : 'author_desc');
            } else if (sortField === 'progress') {
              setSortBy(dir === 'asc' ? 'progress_asc' : 'progress_desc');
            } else if (sortField === 'recent') {
              setSortBy(dir === 'asc' ? 'recent_asc' : 'recent');
            }
          });
        }}
        isDirectionDisabled={isDirectionDisabled}
        onResetAll={() => {
          setActiveFilter('all');
          handleSortFieldChange('recent');
          setSearchQuery('');
        }}
      />

      {/* Mobile Capsule Bottom Dock */}
      {counts.all > 0 && (
        <CollectionBottomDock
          searchQuery={searchQuery}
          isSearchOpen={isBottomSearchOpen}
          onSearchToggle={() => setIsBottomSearchOpen((prev) => !prev)}
          activeFilterCount={activeFilterCount}
          isFiltersOpen={isFilterDrawerOpen}
          onOpenFilters={() => setIsFilterDrawerOpen((prev) => !prev)}
          modeType="direction"
          sortDirection={sortDirection}
          onDirectionToggle={handleDirectionToggle}
          isDirectionDisabled={isDirectionDisabled}
        />
      )}
    </section>
  );
};

