'use client';

import React from 'react';
import Link from 'next/link';
import {
  WifiOff,
  Library,
  Heart,
  Bookmark,
  Highlighter,
  User,
  HardDriveDownload,
  ArrowRight,
} from 'lucide-react';
import type { CatalogView } from '@/hooks/useCatalogFilters';
import { ROUTES } from '@/config/routes';

export interface CatalogOfflineViewProps {
  onNavigateView: (view: CatalogView) => void;
  savedCount?: number;
  favoriteCount?: number;
  bookmarksCount?: number;
  annotationsCount?: number;
}

export const CatalogOfflineView: React.FC<CatalogOfflineViewProps> = ({
  onNavigateView,
  savedCount = 0,
  favoriteCount = 0,
  bookmarksCount = 0,
  annotationsCount = 0,
}) => {
  const offlineSections: Array<{
    id: CatalogView;
    title: string;
    description: string;
    count: number;
    countLabel: string;
    icon: React.ReactNode;
  }> = [
    {
      id: 'bookshelf',
      title: 'Personal Bookshelf',
      description: 'Browse your shelved volumes, update reading statuses, and rate books offline.',
      count: savedCount,
      countLabel: savedCount === 1 ? 'volume' : 'volumes',
      icon: <Library className="w-4 h-4 text-primary shrink-0" />,
    },
    {
      id: 'favorites',
      title: 'Curated Favorites',
      description: 'Review and manage your favorite classics saved locally on this device.',
      count: favoriteCount,
      countLabel: favoriteCount === 1 ? 'favorite' : 'favorites',
      icon: <Heart className="w-4 h-4 text-rose-500 shrink-0" />,
    },
    {
      id: 'bookmarks',
      title: 'Reading Bookmarks',
      description: 'Check your active reading progress and chapter positions across volumes.',
      count: bookmarksCount,
      countLabel: bookmarksCount === 1 ? 'bookmark' : 'bookmarks',
      icon: <Bookmark className="w-4 h-4 text-emerald-500 shrink-0" />,
    },
    {
      id: 'notebook',
      title: "Scholar's Notebook",
      description: 'Read, search, edit, or export your saved highlights and personal marginalia.',
      count: annotationsCount,
      countLabel: annotationsCount === 1 ? 'note' : 'notes',
      icon: <Highlighter className="w-4 h-4 text-amber-500 shrink-0" />,
    },
  ];

  return (
    <section
      className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16"
      aria-label="Offline Catalog Sanctuary"
      data-testid="catalog-offline-view"
    >
      <div className="bg-card border border-border rounded-2xl p-6 sm:p-10 shadow-booksaw space-y-8">
        {/* Top Offline Notice Header */}
        <div className="flex flex-col items-center text-center space-y-3 max-w-2xl mx-auto">
          <div className="w-12 h-12 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive flex items-center justify-center shadow-2xs">
            <WifiOff className="w-6 h-6" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider font-bold bg-destructive/10 text-destructive border border-destructive/30">
            Offline Mode Active
          </span>

          <h1 className="text-2xl sm:text-3xl font-serif font-bold text-foreground">
            The Live Catalog Is Paused Offline
          </h1>

          <p className="text-xs sm:text-sm text-muted-foreground font-sans leading-relaxed">
            Your device is currently disconnected from the internet and you do not have any volumes saved in your browser&apos;s offline reading cache yet. When you reconnect, click{' '}
            <span className="font-mono font-semibold text-foreground inline-flex items-center gap-1">
              <HardDriveDownload className="w-3.5 h-3.5 text-primary inline" /> Get &rarr; Save Offline
            </span>{' '}
            on any book so it appears automatically in your Offline Catalog.
          </p>
        </div>

        {/* Offline-Ready Personal Sections Grid */}
        <div className="space-y-3 pt-2 border-t border-border">
          <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold text-center">
            Available Offline on This Device
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
            {offlineSections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => onNavigateView(section.id)}
                data-testid={`offline-nav-${section.id}`}
                className="group text-left p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 hover:border-primary/40 transition-all flex items-start justify-between gap-3 cursor-pointer"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {section.icon}
                    <span className="font-serif font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors">
                      {section.title}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-card border border-border text-muted-foreground">
                      {section.count} {section.countLabel}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                    {section.description}
                  </p>
                </div>

                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1 transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>

          {/* Account & Local Preferences Offline Card */}
          <div className="pt-2">
            <Link
              href={ROUTES.ACCOUNT}
              data-testid="offline-nav-account"
              className="group p-4 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 hover:border-primary/40 transition-all flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg bg-card border border-border text-primary shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-serif font-bold text-sm sm:text-base text-foreground group-hover:text-primary transition-colors block">
                    Account, Reading Streaks &amp; Preferences
                  </span>
                  <p className="text-xs text-muted-foreground font-sans truncate">
                    Adjust themes, audio narration settings, view Ex-Libris bookplates, or export local backups offline.
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary shrink-0 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};
