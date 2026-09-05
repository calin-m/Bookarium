'use client';

import React, { useState } from 'react';
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
import { useContinueReadingLedger } from '@/hooks/reader/useContinueReadingLedger';
import { useOfflineBooks } from '@/hooks/useOfflineBooks';
import { useReaderStore } from '@/stores/useReaderStore';
import { BookmarkCard } from './BookmarkCard';
import { CollectionSearchBar } from './CollectionSearchBar';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { SectionHeader } from '@/components/ui/SectionHeader';
import { ROUTES } from '@/config/routes';
import type { LedgerFilter } from '@/types/book.types';

export interface BookmarksViewProps {
  onBrowseCatalog?: () => void;
}

export const BookmarksView: React.FC<BookmarksViewProps> = ({ onBrowseCatalog }) => {
  const router = useRouter();
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const { isBookOffline } = useOfflineBooks();

  const {
    filteredVolumes,
    activeFilter,
    setActiveFilter,
    searchQuery,
    setSearchQuery,
    counts,
    updateVolumeStatus,
    clearVolumeProgress,
    clearAllVolumes,
  } = useContinueReadingLedger();

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
      <div key="view-page-turn-bookmarks" className="animate-page-turn">
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

      {/* Smart Collection Search Bar for Bookmarks */}
      {counts.all > 0 && (
        <CollectionSearchBar
          query={searchQuery}
          onQueryChange={setSearchQuery}
          placeholder="Search your reading bookmarks by title, author, or subject..."
          totalCount={activeFilter === 'all' ? counts.all : counts[activeFilter]}
          filteredCount={filteredVolumes.length}
          collectionName="bookmarks"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVolumes.map((vol) => (
              <BookmarkCard
                key={vol.book.id}
                volume={vol}
                isOffline={isBookOffline(vol.book.id)}
                onResume={handleResume}
                onStatusChange={updateVolumeStatus}
                onClear={clearVolumeProgress}
              />
            ))}
          </div>
        )}
      </div>
    </div>

    {/* Clear Bookmarks Confirmation Modal */}
      <Modal
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        title="Clear Reading Bookmarks"
        maxWidth="md"
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
    </section>
  );
};

