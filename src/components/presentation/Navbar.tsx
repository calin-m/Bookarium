'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Bookmark, Heart, Sun, Moon, Coffee, User as UserIcon, Highlighter } from 'lucide-react';
import { useHydratedBookshelf } from '@/stores/useBookshelfStore';
import { useHydratedAnnotations } from '@/stores/useAnnotationStore';
import { useThemeStore } from '@/stores/useThemeStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { SITE_CONFIG } from '@/config/site-config';
import { LIBRARY_THEMES } from '@/config/library-tokens';

export interface NavbarProps {
  activeView?: 'catalog' | 'bookshelf' | 'likes' | 'notebook' | 'account';
  onViewChange?: (view: 'catalog' | 'bookshelf' | 'likes' | 'notebook') => void;
  isVisible?: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView = 'catalog',
  onViewChange,
  isVisible = true,
}) => {
  const router = useRouter();
  const { savedCount, likedCount, hasMounted } = useHydratedBookshelf();
  const { annotations } = useHydratedAnnotations();
  const annotationCount = annotations.length;
  const theme = useThemeStore((s) => s.theme);
  const cycleTheme = useThemeStore((s) => s.cycleTheme);
  const user = useAuthStore((s) => s.user);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);

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
          className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group select-none shrink-0"
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
          <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-primary-foreground shadow-xs group-hover:scale-105 transition-transform shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div>
            <span className="text-lg sm:text-xl font-bold tracking-tight text-foreground font-serif whitespace-nowrap">
              {SITE_CONFIG.LOGO_TEXT}
            </span>
          </div>
        </div>

        {/* Right Navigation & Actions */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-1.5 md:gap-2">
            <button
              type="button"
              onClick={() => onViewChange?.('catalog')}
              title="Catalog"
              className={`h-8 px-2 md:px-3 rounded text-xs font-mono tracking-wider uppercase flex items-center justify-center gap-1 md:gap-1.5 border-b-2 transition-all ${
                activeView === 'catalog'
                  ? `${LIBRARY_THEMES.catalog.navActiveText} font-bold ${LIBRARY_THEMES.catalog.navActiveBorder}`
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              }`}
              aria-label="Catalog"
            >
              <BookOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="hidden md:inline">Catalog</span>
            </button>

            <button
              type="button"
              onClick={() => onViewChange?.('bookshelf')}
              title="Bookshelf"
              className={`h-8 px-2 md:px-3 rounded text-xs font-mono tracking-wider uppercase flex items-center justify-center gap-1 md:gap-1.5 border-b-2 transition-all ${
                activeView === 'bookshelf'
                  ? `${LIBRARY_THEMES.bookshelf.navActiveText} font-bold ${LIBRARY_THEMES.bookshelf.navActiveBorder}`
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              }`}
              aria-label="Bookshelf"
            >
              <Bookmark
                className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                  hasMounted && savedCount > 0
                    ? LIBRARY_THEMES.bookshelf.navFill
                    : 'fill-transparent'
                }`}
              />
              <span className="hidden md:inline">Bookshelf</span>
            </button>

            <button
              type="button"
              onClick={() => onViewChange?.('likes')}
              title="Favorites"
              className={`h-8 px-2 md:px-3 rounded text-xs font-mono tracking-wider uppercase flex items-center justify-center gap-1 md:gap-1.5 border-b-2 transition-all ${
                activeView === 'likes'
                  ? `${LIBRARY_THEMES.favorites.navActiveText} font-bold ${LIBRARY_THEMES.favorites.navActiveBorder}`
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              }`}
              aria-label="Liked Books"
            >
              <Heart
                className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                  hasMounted && likedCount > 0
                    ? LIBRARY_THEMES.favorites.navFill
                    : 'fill-transparent'
                }`}
              />
              <span className="hidden md:inline">Favorites</span>
            </button>

            <button
              type="button"
              onClick={() => onViewChange?.('notebook')}
              title="Notebook"
              className={`h-8 px-2 md:px-3 rounded text-xs font-mono tracking-wider uppercase flex items-center justify-center gap-1 md:gap-1.5 border-b-2 transition-all ${
                activeView === 'notebook'
                  ? `${LIBRARY_THEMES.notebook.navActiveText} font-bold ${LIBRARY_THEMES.notebook.navActiveBorder}`
                  : 'text-muted-foreground hover:text-foreground border-transparent'
              }`}
              aria-label="Notebook"
            >
              <Highlighter
                className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                  hasMounted && annotationCount > 0
                    ? LIBRARY_THEMES.notebook.navFill
                    : 'fill-transparent'
                }`}
              />
              <span className="hidden md:inline">Notebook</span>
            </button>
          </nav>

          <div className="h-4 w-[1px] bg-border mx-0.5 sm:mx-1" />

          {/* Right Actions: Auth, Theme */}
          {!hasMounted ? (
            <div
              className="h-8 w-8 md:w-[96px] rounded border border-border/40 bg-muted/40 animate-pulse"
              aria-hidden="true"
            />
          ) : user ? (
            <Link
              href={ROUTES.ACCOUNT}
              title="User Account"
              className={`h-8 w-8 md:w-auto px-0 md:px-3 inline-flex items-center justify-center gap-1.5 rounded text-xs font-mono border transition-all cursor-pointer select-none active:scale-95 shadow-2xs ${
                activeView === 'account'
                  ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                  : 'border-border bg-card hover:border-primary text-foreground'
              }`}
              aria-label="User Account"
            >
              <UserIcon className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="hidden md:inline font-mono">Account</span>
            </Link>
          ) : (
            <Button
              variant={activeView === 'account' ? 'primary' : 'outline'}
              onClick={() => openAuthModal('sign_in')}
              title="Sign In"
              aria-label="Sign In"
              className="h-8 w-8 md:w-auto px-0 md:px-3 inline-flex items-center justify-center gap-1.5 font-mono text-xs font-bold animate-in fade-in duration-150"
            >
              <UserIcon className={`w-3.5 h-3.5 shrink-0 ${activeView === 'account' ? 'text-primary-foreground' : 'text-primary'}`} />
              <span className="hidden md:inline">Sign In</span>
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

          {/* GitHub Repository Link (Visible on all screens >= 440px without crowding website title) */}
          <a
            href={SITE_CONFIG.GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Bookarium repository on GitHub"
            title="View Bookarium repository on GitHub"
            className="hidden min-[440px]:inline-flex items-center justify-center h-8 w-8 ml-0.5 sm:ml-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <GithubIcon className="w-4 h-4" />
          </a>
        </div>
      </div>
    </header>
  );
};

const GithubIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
    />
  </svg>
);
