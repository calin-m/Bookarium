'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Bookmark, Heart, Sun, Moon, Coffee, User as UserIcon, LogOut } from 'lucide-react';
import { useHydratedBookshelf } from '@/stores/useBookshelfStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/Button';

export interface NavbarProps {
  activeView?: 'catalog' | 'bookshelf' | 'likes';
  onViewChange?: (view: 'catalog' | 'bookshelf' | 'likes') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView = 'catalog',
  onViewChange,
}) => {
  const router = useRouter();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { savedCount, likedCount, hasMounted } = useHydratedBookshelf();
  const theme = useThemeStore((s) => s.theme);
  const cycleTheme = useThemeStore((s) => s.cycleTheme);
  const { user, profile, openAuthModal, signOut } = useAuthStore();

  const handleBrandClick = () => {
    onViewChange?.('catalog');
    if (typeof window !== 'undefined') {
      try {
        window.scrollTo({ top: 0, behavior: 'instant' });
        if (window.location.pathname === '/' && !window.location.search) {
          window.location.reload();
        } else {
          router.push('/');
        }
      } catch {
        router.push('/');
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-background border-b border-border transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
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
        <nav className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Catalog */}
          <button
            type="button"
            onClick={() => onViewChange?.('catalog')}
            className={`px-2 sm:px-3 py-1.5 rounded text-xs font-mono tracking-wider uppercase flex items-center gap-1 sm:gap-1.5 transition-all ${
              activeView === 'catalog'
                ? 'text-primary font-bold border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label="Catalog"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Catalog</span>
          </button>

          {/* Bookshelf */}
          <button
            type="button"
            onClick={() => onViewChange?.('bookshelf')}
            className={`px-2 sm:px-3 py-1.5 rounded text-xs font-mono tracking-wider uppercase flex items-center gap-1 sm:gap-1.5 transition-all ${
              activeView === 'bookshelf'
                ? 'text-primary font-bold border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label="Bookshelf"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Bookshelf</span>
            {savedCount > 0 && (
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-primary text-primary-foreground font-bold">
                {savedCount}
              </span>
            )}
          </button>

          {/* Favorites */}
          <button
            type="button"
            onClick={() => onViewChange?.('likes')}
            className={`px-2 sm:px-3 py-1.5 rounded text-xs font-mono tracking-wider uppercase flex items-center gap-1 sm:gap-1.5 transition-all ${
              activeView === 'likes'
                ? 'text-destructive font-bold border-b-2 border-destructive'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            aria-label="Liked Books"
          >
            <Heart className="w-3.5 h-3.5 text-destructive" />
            <span className="hidden sm:inline">Favorites</span>
            {likedCount > 0 && (
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-destructive text-destructive-foreground font-bold">
                {likedCount}
              </span>
            )}
          </button>

          <div className="h-4 w-[1px] bg-border mx-0.5 sm:mx-1" />

          {/* User Account / Sign In */}
          {hasMounted && (
            user ? (
              <div className="relative flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono border border-border bg-card hover:border-primary text-foreground transition-all cursor-pointer select-none active:scale-95 shadow-2xs"
                  aria-label="User Account Menu"
                >
                  <UserIcon className="w-3.5 h-3.5 text-primary" />
                  <span className="hidden md:inline max-w-[90px] truncate">
                    {profile?.display_name || user.email?.split('@')[0]}
                  </span>
                </button>

                {isUserMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border rounded-xl shadow-xl p-2 z-50 text-xs font-mono space-y-1 animate-in fade-in duration-150">
                      <div className="px-3 py-2 border-b border-border/60 text-muted-foreground truncate">
                        <p className="font-bold text-foreground truncate">{profile?.display_name || 'Reader'}</p>
                        <p className="text-[10px] opacity-80 truncate">{user.email}</p>
                      </div>
                      <Link
                        href="/profile"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-foreground hover:bg-muted transition-colors cursor-pointer text-left font-bold"
                      >
                        <UserIcon className="w-3.5 h-3.5 text-primary" />
                        <span>Profile & Account</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          signOut();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors cursor-pointer text-left font-bold"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                size="chip"
                onClick={() => openAuthModal('sign_in')}
                aria-label="Sign In"
                className="font-mono text-xs font-bold"
              >
                <UserIcon className="w-3 h-3 text-primary" />
                <span className="hidden sm:inline">Sign In</span>
              </Button>
            )
          )}

          {/* 3-Way Universal Theme Switcher (Light -> Sepia -> Dark) */}
          {(() => {
            const currentTheme = hasMounted ? theme : 'light';
            return (
              <Button
                variant="ghost"
                size="icon"
                onClick={cycleTheme}
                aria-label={`Current theme: ${currentTheme}. Click to switch theme.`}
                className="h-8 w-8 rounded text-muted-foreground hover:text-foreground shrink-0"
              >
                {currentTheme === 'light' ? (
                  <Sun className="w-4 h-4 text-amber-500" />
                ) : currentTheme === 'sepia' ? (
                  <Coffee className="w-4 h-4 text-amber-500" />
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
