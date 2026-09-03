import React from 'react';
import Link from 'next/link';
import { Bookmark, Heart, BookOpen, Highlighter, ArrowUpRight } from 'lucide-react';
import { ROUTES } from '@/config/routes';

export interface AccountLibraryStatsProps {
  savedCount: number;
  likedCount: number;
  customShelvesCount: number;
  annotationCount?: number;
}

export const AccountLibraryStats: React.FC<AccountLibraryStatsProps> = ({
  savedCount,
  likedCount,
  customShelvesCount,
  annotationCount = 0,
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

      <div className="grid grid-cols-2 gap-3 sm:gap-3.5">
        <Link
          href={ROUTES.BOOKSHELF}
          className="p-3.5 sm:p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/50 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xs flex flex-col justify-between gap-3 group block focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="View Shelved Volumes in Bookshelf"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
            <Bookmark className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate group-hover:text-foreground transition-colors">Shelved Volumes</span>
          </div>
          <div className="flex items-end justify-between">
            <p className="text-xl sm:text-2xl font-mono font-bold text-foreground leading-none">{savedCount}</p>
            <ArrowUpRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-150 shrink-0" />
          </div>
        </Link>

        <Link
          href={ROUTES.LIKES}
          className="p-3.5 sm:p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/50 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xs flex flex-col justify-between gap-3 group block focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="View Favorite Titles in Favorites"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
            <Heart className="w-3.5 h-3.5 text-destructive shrink-0" />
            <span className="truncate group-hover:text-foreground transition-colors">Favorite Titles</span>
          </div>
          <div className="flex items-end justify-between">
            <p className="text-xl sm:text-2xl font-mono font-bold text-foreground leading-none">{likedCount}</p>
            <ArrowUpRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-150 shrink-0" />
          </div>
        </Link>

        <Link
          href={ROUTES.NOTEBOOK}
          className="p-3.5 sm:p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 hover:border-amber-500/50 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xs flex flex-col justify-between gap-3 group block focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="View Saved Notes & Quotes in Notebook"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
            <Highlighter className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="truncate group-hover:text-foreground transition-colors">Notes & Quotes</span>
          </div>
          <div className="flex items-end justify-between">
            <p data-testid="notes-quotes-count" className="text-xl sm:text-2xl font-mono font-bold text-foreground leading-none">{annotationCount}</p>
            <ArrowUpRight className="w-4 h-4 text-amber-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-150 shrink-0" />
          </div>
        </Link>

        <Link
          href={ROUTES.BOOKSHELF}
          className="p-3.5 sm:p-4 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/50 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-xs flex flex-col justify-between gap-3 group block focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          aria-label="View Custom Shelves in Bookshelf"
        >
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-mono">
            <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="truncate group-hover:text-foreground transition-colors">Custom Shelves</span>
          </div>
          <div className="flex items-end justify-between">
            <p data-testid="custom-shelves-count" className="text-xl sm:text-2xl font-mono font-bold text-foreground leading-none">{customShelvesCount}</p>
            <ArrowUpRight className="w-4 h-4 text-primary opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-150 shrink-0" />
          </div>
        </Link>
      </div>
    </div>
  );
};

