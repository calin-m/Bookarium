'use client';

import React from 'react';
import Link from 'next/link';
import { Bookmark, Heart, BookOpen } from 'lucide-react';
import { ROUTES } from '@/config/routes';

export interface AccountLibraryStatsProps {
  savedCount: number;
  likedCount: number;
  customShelvesCount: number;
}

export const AccountLibraryStats: React.FC<AccountLibraryStatsProps> = ({
  savedCount,
  likedCount,
  customShelvesCount,
}) => {
  return (
    <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-xs space-y-4">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href={ROUTES.BOOKSHELF}
          className="p-4 rounded-xl border border-border bg-muted/40 hover:bg-muted/70 hover:border-primary/40 transition-all duration-150 space-y-1 group block"
          aria-label="View Shelved Volumes in Bookshelf"
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
            <div className="flex items-center gap-2">
              <Bookmark className="w-3.5 h-3.5 text-primary" />
              <span className="group-hover:text-foreground transition-colors">Shelved Volumes</span>
            </div>
            <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
          </div>
          <p className="text-2xl font-mono font-bold text-foreground">{savedCount}</p>
        </Link>

        <Link
          href={ROUTES.LIKES}
          className="p-4 rounded-xl border border-border bg-muted/40 hover:bg-muted/70 hover:border-primary/40 transition-all duration-150 space-y-1 group block"
          aria-label="View Favorite Titles in Favorites"
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
            <div className="flex items-center gap-2">
              <Heart className="w-3.5 h-3.5 text-destructive" />
              <span className="group-hover:text-foreground transition-colors">Favorite Titles</span>
            </div>
            <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
          </div>
          <p className="text-2xl font-mono font-bold text-foreground">{likedCount}</p>
        </Link>

        <Link
          href={ROUTES.BOOKSHELF}
          className="p-4 rounded-xl border border-border bg-muted/40 hover:bg-muted/70 hover:border-primary/40 transition-all duration-150 space-y-1 group block"
          aria-label="View Custom Shelves in Bookshelf"
        >
          <div className="flex items-center justify-between text-muted-foreground text-xs font-mono">
            <div className="flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5 text-primary" />
              <span className="group-hover:text-foreground transition-colors">Custom Shelves</span>
            </div>
            <span className="text-[10px] text-primary opacity-0 group-hover:opacity-100 transition-opacity">View →</span>
          </div>
          <p data-testid="custom-shelves-count" className="text-2xl font-mono font-bold text-foreground">{customShelvesCount}</p>
        </Link>
      </div>
    </div>
  );
};

