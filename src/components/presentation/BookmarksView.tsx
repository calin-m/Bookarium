'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { BookMarked, Clock, CheckCircle2, PauseCircle, Compass } from 'lucide-react';
import { useContinueReadingLedger } from '@/hooks/reader/useContinueReadingLedger';
import { BookmarkCard } from './BookmarkCard';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import type { LedgerFilter } from '@/types/book.types';

export interface BookmarksViewProps {
  onBrowseCatalog?: () => void;
}

export const BookmarksView: React.FC<BookmarksViewProps> = ({ onBrowseCatalog }) => {
  const router = useRouter();
  const {
    filteredVolumes,
    activeFilter,
    setActiveFilter,
    counts,
    updateVolumeStatus,
    clearVolumeProgress,
  } = useContinueReadingLedger();

  const handleResume = (bookId: number) => {
    router.push(ROUTES.READ(bookId));
  };

  const filterTabs: Array<{ id: LedgerFilter; label: string; count: number; icon: React.ReactNode }> = [
    { id: 'all', label: 'All Volumes', count: counts.all, icon: <BookMarked className="w-3.5 h-3.5" /> },
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
      <div className="text-center max-w-2xl mx-auto mb-10 space-y-2">
        <div className="text-[11px] font-mono tracking-widest uppercase text-muted-foreground font-semibold">
          READING LEDGER • PROGRESSIVE RESUME
        </div>

        <div className="flex items-center justify-center gap-3">
          <div className="h-[1px] w-12 bg-border" />
          <h2 className="text-3xl sm:text-4xl font-serif font-bold text-foreground tracking-tight">
            Continue Reading & Bookmarks
          </h2>
          <div className="h-[1px] w-12 bg-border" />
        </div>

        <p className="text-sm text-muted-foreground font-serif italic max-w-lg mx-auto">
          Pick up right where you left off across all your active public domain volumes.
        </p>

        {/* Global Stats Summary Badges */}
        <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-muted/80 text-foreground border border-border">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <strong className="font-bold">{counts.in_progress}</strong> In Progress
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-muted/80 text-foreground border border-border">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <strong className="font-bold">{counts.completed}</strong> Completed
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-muted/80 text-foreground border border-border">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <strong className="font-bold">{counts.on_hold}</strong> On Hold
          </span>
        </div>
      </div>

      {/* Filter Navigation Tabs */}
      <div className="flex items-center justify-center mb-8 border-b border-border">
        <nav className="flex items-center gap-2 overflow-x-auto pb-px" aria-label="Reading ledger filters">
          {filterTabs.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveFilter(tab.id)}
                aria-pressed={isActive}
                className={`flex items-center gap-2 px-4 py-2.5 text-xs font-mono uppercase tracking-wider font-semibold border-b-2 transition-all cursor-pointer select-none ${
                  isActive
                    ? 'border-primary text-primary font-bold'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
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
      {filteredVolumes.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-12 text-center max-w-lg mx-auto shadow-xs">
          <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <BookMarked className="w-8 h-8" />
          </div>

          <h3 className="font-serif font-bold text-xl text-foreground mb-2">
            {activeFilter === 'all'
              ? 'No active reading volumes yet'
              : `No volumes marked as ${activeFilter.replace('_', ' ')}`}
          </h3>

          <p className="text-sm text-muted-foreground font-serif leading-relaxed mb-6">
            Volumes you begin reading or place bookmarks in will appear in this ledger with exact coordinates,
            completion percentages, and one-click chapter resume.
          </p>

          <Button
            variant="primary"
            size="md"
            onClick={onBrowseCatalog}
            className="gap-2 font-mono text-xs uppercase tracking-wider font-bold mx-auto"
          >
            <Compass className="w-4 h-4" />
            <span>Browse Library Catalog</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVolumes.map((vol) => (
            <BookmarkCard
              key={vol.book.id}
              volume={vol}
              onResume={handleResume}
              onStatusChange={updateVolumeStatus}
              onClear={clearVolumeProgress}
            />
          ))}
        </div>
      )}
    </section>
  );
};
