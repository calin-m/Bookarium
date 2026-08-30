'use client';

import React, { useState } from 'react';
import { BookOpen, Bookmark, Heart, Sun, Moon } from 'lucide-react';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
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
  const [isDark, setIsDark] = useState(false);
  const hasMounted = useHasMounted();

  const toggleTheme = () => {
    setIsDark(!isDark);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark');
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-paper-100/90 dark:bg-[#0e1117]/90 border-b border-stone-200/80 dark:border-stone-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between gap-4 py-3">
        {/* Brand */}
        <div
          className="flex items-center gap-3 cursor-pointer group select-none"
          onClick={() => onViewChange?.('catalog')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              onViewChange?.('catalog');
            }
          }}
        >
          <div className="w-8 h-8 rounded bg-primary-600 dark:bg-primary-500 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 font-serif">
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
                ? 'text-primary-600 dark:text-primary-400 font-bold border-b-2 border-primary-600'
                : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
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
                ? 'text-primary-600 dark:text-primary-400 font-bold border-b-2 border-primary-600'
                : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
            }`}
            aria-label="Bookshelf"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Bookshelf</span>
            {hasMounted && savedBooks.length > 0 && (
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-primary-600 text-white font-bold">
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
                ? 'text-red-600 dark:text-red-400 font-bold border-b-2 border-red-600'
                : 'text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-stone-100'
            }`}
            aria-label="Liked Books"
          >
            <Heart className="w-3.5 h-3.5 text-red-500" />
            <span className="hidden sm:inline">Favorites</span>
            {hasMounted && likedBookIds.length > 0 && (
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-red-600 text-white font-bold">
                {likedBookIds.length}
              </span>
            )}
          </button>

          <div className="h-4 w-[1px] bg-stone-300 dark:bg-stone-700 mx-1" />

          {/* Theme Switcher */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="h-8 w-8 rounded text-stone-600 dark:text-stone-300"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
          </Button>
        </nav>
      </div>
    </header>
  );
};
