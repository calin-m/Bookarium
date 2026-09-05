import React from 'react';
import Link from 'next/link';
import { Bookmark, Heart, BookOpen, Highlighter, ArrowUpRight, BookMarked } from 'lucide-react';
import { ROUTES } from '@/config/routes';
import { LIBRARY_THEMES } from '@/config/library-tokens';

export interface AccountLibraryStatsProps {
  savedCount: number;
  favoriteCount: number;
  customShelvesCount: number;
  annotationCount?: number;
  bookmarksCount?: number;
}

export const AccountLibraryStats: React.FC<AccountLibraryStatsProps> = ({
  savedCount,
  favoriteCount,
  customShelvesCount,
  annotationCount = 0,
  bookmarksCount = 0,
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 sm:p-7 shadow-booksaw space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground font-bold">
          Library
        </h2>
        <Link
          href={ROUTES.BOOKSHELF}
          className="text-xs font-mono text-primary hover:underline font-bold"
        >
          Open Bookshelf →
        </Link>
      </div>

      <div className="space-y-2.5 sm:space-y-3">
        <Link
          href={LIBRARY_THEMES.bookshelf.route}
          className={`p-3 sm:p-3.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 ${LIBRARY_THEMES.bookshelf.hoverBorder} transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xs flex items-center justify-between group block focus-visible:outline-hidden focus-visible:ring-2 ${LIBRARY_THEMES.bookshelf.focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
          aria-label="View Shelved Volumes in Bookshelf"
        >
          <div className="flex items-center gap-2.5 text-muted-foreground text-xs font-mono">
            <Bookmark className={`w-3.5 h-3.5 ${LIBRARY_THEMES.bookshelf.iconColor} shrink-0`} />
            <span className="truncate group-hover:text-foreground transition-colors font-medium">Shelved Volumes</span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-lg sm:text-xl font-mono font-bold text-foreground leading-none">{savedCount}</p>
            <ArrowUpRight className={`w-4 h-4 ${LIBRARY_THEMES.bookshelf.arrowColor} opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-150 shrink-0`} />
          </div>
        </Link>

        <Link
          href={LIBRARY_THEMES.favorites.route}
          className={`p-3 sm:p-3.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 ${LIBRARY_THEMES.favorites.hoverBorder} transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xs flex items-center justify-between group block focus-visible:outline-hidden focus-visible:ring-2 ${LIBRARY_THEMES.favorites.focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
          aria-label="View Favorite Titles in Favorites"
        >
          <div className="flex items-center gap-2.5 text-muted-foreground text-xs font-mono">
            <Heart className={`w-3.5 h-3.5 ${LIBRARY_THEMES.favorites.iconColor} shrink-0`} />
            <span className="truncate group-hover:text-foreground transition-colors font-medium">Favorite Titles</span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-lg sm:text-xl font-mono font-bold text-foreground leading-none">{favoriteCount}</p>
            <ArrowUpRight className={`w-4 h-4 ${LIBRARY_THEMES.favorites.arrowColor} opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-150 shrink-0`} />
          </div>
        </Link>

        <Link
          href={LIBRARY_THEMES.notebook.route}
          className={`p-3 sm:p-3.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 ${LIBRARY_THEMES.notebook.hoverBorder} transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xs flex items-center justify-between group block focus-visible:outline-hidden focus-visible:ring-2 ${LIBRARY_THEMES.notebook.focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
          aria-label="View Saved Notes & Quotes in Notebook"
        >
          <div className="flex items-center gap-2.5 text-muted-foreground text-xs font-mono">
            <Highlighter className={`w-3.5 h-3.5 ${LIBRARY_THEMES.notebook.iconColor} shrink-0`} />
            <span className="truncate group-hover:text-foreground transition-colors font-medium">Notes & Quotes</span>
          </div>
          <div className="flex items-center gap-2">
            <p data-testid="notes-quotes-count" className="text-lg sm:text-xl font-mono font-bold text-foreground leading-none">{annotationCount}</p>
            <ArrowUpRight className={`w-4 h-4 ${LIBRARY_THEMES.notebook.arrowColor} opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-150 shrink-0`} />
          </div>
        </Link>

        <Link
          href={LIBRARY_THEMES.customShelves.route}
          className={`p-3 sm:p-3.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 ${LIBRARY_THEMES.customShelves.hoverBorder} transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xs flex items-center justify-between group block focus-visible:outline-hidden focus-visible:ring-2 ${LIBRARY_THEMES.customShelves.focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
          aria-label="View Custom Shelves in Bookshelf"
        >
          <div className="flex items-center gap-2.5 text-muted-foreground text-xs font-mono">
            <BookOpen className={`w-3.5 h-3.5 ${LIBRARY_THEMES.customShelves.iconColor} shrink-0`} />
            <span className="truncate group-hover:text-foreground transition-colors font-medium">Custom Shelves</span>
          </div>
          <div className="flex items-center gap-2">
            <p data-testid="custom-shelves-count" className="text-lg sm:text-xl font-mono font-bold text-foreground leading-none">{customShelvesCount}</p>
            <ArrowUpRight className={`w-4 h-4 ${LIBRARY_THEMES.customShelves.arrowColor} opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-150 shrink-0`} />
          </div>
        </Link>

        <Link
          href={LIBRARY_THEMES.bookmarks.route}
          className={`p-3 sm:p-3.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 ${LIBRARY_THEMES.bookmarks.hoverBorder} transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xs flex items-center justify-between group block focus-visible:outline-hidden focus-visible:ring-2 ${LIBRARY_THEMES.bookmarks.focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
          aria-label="View Reading Bookmarks in Bookmarks"
        >
          <div className="flex items-center gap-2.5 text-muted-foreground text-xs font-mono">
            <BookMarked className={`w-3.5 h-3.5 ${LIBRARY_THEMES.bookmarks.iconColor} shrink-0`} />
            <span className="truncate group-hover:text-foreground transition-colors font-medium">Reading Bookmarks</span>
          </div>
          <div className="flex items-center gap-2">
            <p data-testid="bookmarks-count" className="text-lg sm:text-xl font-mono font-bold text-foreground leading-none">{bookmarksCount}</p>
            <ArrowUpRight className={`w-4 h-4 ${LIBRARY_THEMES.bookmarks.arrowColor} opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-150 shrink-0`} />
          </div>
        </Link>
      </div>
    </div>
  );
};

