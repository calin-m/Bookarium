'use client';

import React from 'react';
import { BookOpen, Bookmark, Heart, Sun, Moon, Coffee } from 'lucide-react';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useHasMounted } from '@/hooks/useHasMounted';
import { Button } from '@/components/ui/Button';

export interface NavbarProps {
  activeView?: 'catalog' | 'bookshelf' | 'likes';
  onViewChange?: (view: 'catalog' | 'bookshelf' | 'likes') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView = 'catalog',
  onViewChange,
}) => {
  const savedBooks = useBookshelfStore((s) => s.savedBooks);
  const likedBookIds = useBookshelfStore((s) => s.likedBookIds);
  const theme = useThemeStore((s) => s.theme);
  const cycleTheme = useThemeStore((s) => s.cycleTheme);
  const hasMounted = useHasMounted();

  const handleBrandClick = () => {
    onViewChange?.('catalog');
    if (typeof window !== 'undefined') {
      if (window.location.pathname === '/' && !window.location.search) {
        window.location.reload();
      } else {
        window.location.href = '/';
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-background border-b border-border transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4 py-3">
        {/* Brand */}
        <div
          className="flex items-center gap-3 cursor-pointer group select-none"
          onClick={handleBrandClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleBrandClick();
            }
          }}
          title="Refresh and return to catalog"
          aria-label="Bookarium logo, click to refresh catalog"
        >
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground shadow-xs group-hover:scale-105 transition-transform">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-foreground font-serif">
              BOOKARIUM
            </span>
          </div>
        </div>

        {/* Booksaw Editorial Navigation Links */}
        <nav className="flex items-center gap-1 sm:gap-2">
          {/* Catalog */}
          <button
            type="button"
            onClick={() => onViewChange?.('catalog')}
            className={`px-3 py-1.5 rounded text-xs font-mono tracking-wider uppercase transition-all ${
              activeView === 'catalog'
                ? 'text-primary font-bold border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Catalog
          </button>

          {/* Bookshelf */}
          <button
            type="button"
            onClick={() => onViewChange?.('bookshelf')}
            className={`px-3 py-1.5 rounded text-xs font-mono tracking-wider uppercase flex items-center gap-1.5 transition-all ${
              activeView === 'bookshelf'
                ? 'text-primary font-bold border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label="Bookshelf"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Bookshelf</span>
            {hasMounted && savedBooks.length > 0 && (
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-primary text-primary-foreground font-bold">
                {savedBooks.length}
              </span>
            )}
          </button>

          {/* Favorites */}
          <button
            type="button"
            onClick={() => onViewChange?.('likes')}
            className={`px-3 py-1.5 rounded text-xs font-mono tracking-wider uppercase flex items-center gap-1.5 transition-all ${
              activeView === 'likes'
                ? 'text-destructive font-bold border-b-2 border-destructive'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label="Liked Books"
          >
            <Heart className="w-3.5 h-3.5 text-destructive" />
            <span className="hidden sm:inline">Favorites</span>
            {hasMounted && likedBookIds.length > 0 && (
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-destructive text-destructive-foreground font-bold">
                {likedBookIds.length}
              </span>
            )}
          </button>

          <div className="h-4 w-[1px] bg-border mx-1" />

          {/* 3-Way Universal Theme Switcher (Light -> Sepia -> Dark) */}
          {(() => {
            const currentTheme = hasMounted ? theme : 'light';
            return (
              <Button
                variant="ghost"
                size="icon"
                onClick={cycleTheme}
                aria-label={`Current theme: ${currentTheme}. Click to switch theme.`}
                className="h-8 w-8 rounded text-muted-foreground hover:text-foreground"
              >
                {currentTheme === 'light' ? (
                  <Sun className="w-4 h-4 text-amber-500" />
                ) : currentTheme === 'sepia' ? (
                  <Coffee className="w-4 h-4 text-amber-700" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-400" />
                )}
              </Button>
            );
          })()}
        </nav>
      </div>
    </header>
  );
};
