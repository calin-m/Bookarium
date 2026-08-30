'use client';

import React, { useState } from 'react';
import { BookOpen, Bookmark, Heart, Sun, Moon, ShieldCheck } from 'lucide-react';
import { useBookshelfStore } from '@/stores/useBookshelfStore';
import { useHasMounted } from '@/hooks/useHasMounted';
import { Badge } from '@/components/ui/Badge';
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
    <header className="sticky top-0 z-40 w-full backdrop-blur-lg bg-white/85 dark:bg-stone-900/85 border-b border-stone-200/70 dark:border-stone-800/70 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand */}
        <div
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => onViewChange?.('catalog')}
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary-600 to-amber-500 flex items-center justify-center text-white shadow-md shadow-primary-500/20 group-hover:scale-105 transition-transform">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 font-serif">
                Bookarium
              </span>
              <Badge variant="primary" size="sm" className="hidden sm:inline-flex gap-1 text-[10px]">
                <ShieldCheck className="w-3 h-3 text-primary-600" />
                Zero-Copyright
              </Badge>
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 hidden sm:block">
              Free & Legal Public Domain Library
            </p>
          </div>
        </div>

        {/* View Switcher & Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant={activeView === 'catalog' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onViewChange?.('catalog')}
          >
            Catalog
          </Button>

          <Button
            variant={activeView === 'bookshelf' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onViewChange?.('bookshelf')}
            className="relative gap-1.5"
            aria-label="Bookshelf"
          >
            <Bookmark className="w-4 h-4" />
            <span className="hidden sm:inline">Bookshelf</span>
            {hasMounted && savedBooks.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-primary-700 text-white font-bold">
                {savedBooks.length}
              </span>
            )}
          </Button>

          <Button
            variant={activeView === 'likes' ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => onViewChange?.('likes')}
            className="relative gap-1.5"
            aria-label="Liked Books"
          >
            <Heart className="w-4 h-4 text-red-500" />
            <span className="hidden sm:inline">Liked</span>
            {hasMounted && likedBookIds.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-red-600 text-white font-bold">
                {likedBookIds.length}
              </span>
            )}
          </Button>

          <div className="h-5 w-[1px] bg-stone-200 dark:bg-stone-700 mx-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-stone-600" />}
          </Button>
        </div>
      </div>
    </header>
  );
};
