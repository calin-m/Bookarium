'use client';

import React from 'react';
import { Lock, WifiOff } from 'lucide-react';

export interface NotebookVolumeGroupData<T> {
  bookId: number;
  title: string;
  author: string;
  isRestricted?: boolean;
  country?: string;
  items: T[];
}

export interface NotebookVolumeGroupProps<T> {
  group: NotebookVolumeGroupData<T>;
  isUnavailableOffline: boolean;
  onOpenVolume: (bookId: number) => void;
  renderQuoteCard: (item: T) => React.ReactNode;
}

/**
 * Renders a grouped volume header (title, author, copyright/offline status badge,
 * and quote count) alongside its grid of marginalia quote cards in the Literary Notebook.
 */
export function NotebookVolumeGroup<T>({
  group,
  isUnavailableOffline,
  onOpenVolume,
  renderQuoteCard,
}: NotebookVolumeGroupProps<T>) {
  const isDisabled = group.isRestricted || isUnavailableOffline;

  return (
    <div className="space-y-3">
      {/* Volume Header */}
      <div className="flex items-center justify-between border-b border-border pb-2">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <h2
            className={`text-lg sm:text-xl font-serif font-bold text-foreground transition-colors ${
              isDisabled ? 'cursor-not-allowed opacity-85' : 'hover:text-primary cursor-pointer'
            }`}
            onClick={() => {
              if (isDisabled) return;
              onOpenVolume(group.bookId);
            }}
          >
            {group.title}
          </h2>
          <span className="text-xs font-mono text-muted-foreground">by {group.author}</span>
          {group.isRestricted ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
              <Lock className="w-2.5 h-2.5" />
              Protected ({group.country || 'Jurisdiction'})
            </span>
          ) : isUnavailableOffline ? (
            <span
              data-testid={`notebook-volume-offline-badge-${group.bookId}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
            >
              <WifiOff className="w-2.5 h-2.5" />
              Not Downloaded
            </span>
          ) : null}
        </div>
        <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
          {group.items.length} quote{group.items.length === 1 ? '' : 's'}
        </span>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {group.items.map((item) => renderQuoteCard(item))}
      </div>
    </div>
  );
}
