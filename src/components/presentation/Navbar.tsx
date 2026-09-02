'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Bookmark, Heart, Sun, Moon, Coffee, User as UserIcon } from 'lucide-react';
import { useHydratedBookshelf } from '@/stores/useBookshelfStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { SITE_CONFIG } from '@/config/site-config';

export interface NavbarProps {
  activeView?: 'catalog' | 'bookshelf' | 'likes' | 'account';
  onViewChange?: (view: 'catalog' | 'bookshelf' | 'likes') => void;
  isVisible?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView = 'catalog',
  onViewChange,
  isVisible = true,
}) => {
  const router = useRouter();
  const { savedCount, likedCount, hasMounted } = useHydratedBookshelf();
  const theme = useThemeStore((s) => s.theme);
  const cycleTheme = useThemeStore((s) => s.cycleTheme);
  const { user, openAuthModal } = useAuthStore();

  const handleBrandClick = () => {
    onViewChange?.('catalog');
    if (typeof window !== 'undefined') {
      try {
        window.scrollTo({ top: 0, behavior: 'instant' });
        if (window.location.pathname === ROUTES.HOME && !window.location.search) {
          window.location.reload();
        } else {
          router.push(ROUTES.HOME);
        }
      } catch {
        router.push(ROUTES.HOME);
      }
    }
  };

  return (
    <header
      className={`sticky top-0 z-30 w-full bg-background border-b border-border shadow-md transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full pointer-events-none'
      }`}
    >
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
              {SITE_CONFIG.LOGO_TEXT}
            </span>
          </div>
        </div>

        {/* Right Navigation & Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
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
              <Bookmark
                className={`w-3.5 h-3.5 transition-colors ${
                  hasMounted && savedCount > 0
                    ? 'fill-primary text-primary'
                    : 'fill-transparent'
                }`}
              />
              <span className="hidden sm:inline">Bookshelf</span>
            </button>

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
              <Heart
                className={`w-3.5 h-3.5 transition-colors ${
                  hasMounted && likedCount > 0
                    ? 'fill-destructive text-destructive'
                    : 'fill-transparent'
                }`}
              />
              <span className="hidden sm:inline">Favorites</span>
            </button>
          </nav>

          <div className="h-4 w-[1px] bg-border mx-0.5 sm:mx-1" />

          {/* Right Actions: Auth, Theme */}
          {!hasMounted ? (
            <div
              className="h-8 w-8 sm:w-[96px] rounded border border-border/40 bg-muted/40 animate-pulse"
              aria-hidden="true"
            />
          ) : user ? (
            <Link
              href={ROUTES.ACCOUNT}
              className={`h-8 w-8 sm:w-auto px-0 sm:px-3 inline-flex items-center justify-center gap-1.5 rounded text-xs font-mono border transition-all cursor-pointer select-none active:scale-95 shadow-2xs ${
                activeView === 'account'
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                  : 'border-border bg-card hover:border-primary text-foreground'
              }`}
              aria-label="User Account"
            >
              <UserIcon className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="hidden sm:inline font-mono">Account</span>
            </Link>
          ) : (
            <Button
              variant={activeView === 'account' ? 'primary' : 'outline'}
              onClick={() => openAuthModal('sign_in')}
              aria-label="Sign In"
              className="h-8 w-8 sm:w-auto px-0 sm:px-3 inline-flex items-center justify-center gap-1.5 font-mono text-xs font-bold animate-in fade-in duration-150"
            >
              <UserIcon className={`w-3.5 h-3.5 shrink-0 ${activeView === 'account' ? 'text-primary-foreground' : 'text-primary'}`} />
              <span className="hidden sm:inline">Sign In</span>
            </Button>
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
        </div>
      </div>
    </header>
  );
};
