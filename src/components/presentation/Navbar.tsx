'use client';

import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Sun, Moon, Coffee, User as UserIcon, LogOut, ShieldCheck } from 'lucide-react';
import { useHydratedBookshelfCounts } from '@/stores/useBookshelfStore';
import { useHydratedAnnotationCount } from '@/stores/useAnnotationStore';
import { useReaderStore, getActiveReadingCount } from '@/stores/useReaderStore';
import { useThemeStore, getCookieValue } from '@/stores/useThemeStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { useFellowshipStore } from '@/stores/useFellowshipStore';
import { usePerformanceTier } from '@/hooks/usePerformanceTier';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { Button } from '@/components/ui/Button';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { ROUTES } from '@/config/routes';
import { SITE_CONFIG, STORAGE_KEYS } from '@/config/site-config';
import { LIBRARY_THEMES } from '@/config/library-tokens';
import { NAV_ITEMS, NAVBAR_VIEW_CONFIG, type NavViewId, type ViewId } from '@/config/views.config';
import { useAuthHint } from '@/app/providers';
import { schedulePreferencesCloudSync } from '@/lib/preferences-sync';

export interface NavbarProps {
  activeView?: ViewId;
  onViewChange?: (view: NavViewId) => void;
  onBrandReset?: () => void;
  isVisible?: boolean;
  hasShadow?: boolean;
  initialIsAuthenticated?: boolean;
}

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export const Navbar: React.FC<NavbarProps> = ({
  activeView = 'catalog',
  onViewChange,
  onBrandReset,
  isVisible = true,
  hasShadow = true,
  initialIsAuthenticated,
}) => {
  const router = useRouter();
  const activeConfig = NAVBAR_VIEW_CONFIG[activeView] || NAVBAR_VIEW_CONFIG.catalog;
  const { savedCount, favoriteCount, hasMounted } = useHydratedBookshelfCounts();
  const { annotationCount } = useHydratedAnnotationCount();
  const activeReadingCount = useReaderStore(getActiveReadingCount);
  const theme = useThemeStore((s) => s.theme);
  const cycleTheme = useThemeStore((s) => s.cycleTheme);
  const counts = {
    savedCount,
    favoriteCount,
    annotationCount,
    activeReadingCount,
  };
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const openAuthModal = useAuthStore((s) => s.openAuthModal);
  const signOut = useAuthStore((s) => s.signOut);
  const { isOffline } = useNetworkStatus();

  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const accountMenuCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTouchPointerRef = useRef(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);

  const clearAccountMenuCloseTimer = () => {
    if (accountMenuCloseTimerRef.current) {
      clearTimeout(accountMenuCloseTimerRef.current);
      accountMenuCloseTimerRef.current = null;
    }
  };

  const handleAccountPointerDown = (e: React.PointerEvent) => {
    const pointerType = e.pointerType || (e.nativeEvent as { pointerType?: string })?.pointerType;
    isTouchPointerRef.current = pointerType === 'touch';
  };

  const handleAccountTouchStart = () => {
    isTouchPointerRef.current = true;
  };

  const handleAccountClick = (e: React.MouseEvent) => {
    if (isTouchPointerRef.current) {
      e.preventDefault();
      setIsAccountMenuOpen((prev) => !prev);
      return;
    }
    setIsAccountMenuOpen(false);
  };

  const handleAccountMouseEnter = () => {
    if (isTouchPointerRef.current) return;
    clearAccountMenuCloseTimer();
    setIsAccountMenuOpen(true);
  };

  const handleAccountMouseLeave = () => {
    clearAccountMenuCloseTimer();
    accountMenuCloseTimerRef.current = setTimeout(() => {
      setIsAccountMenuOpen(false);
    }, 150);
  };

  useEffect(() => {
    if (!isAccountMenuOpen) return;
    const handleOutsidePointer = (e: PointerEvent) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(e.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => {
      document.removeEventListener('pointerdown', handleOutsidePointer);
    };
  }, [isAccountMenuOpen]);

  useEffect(() => {
    return () => {
      if (accountMenuCloseTimerRef.current) {
        clearTimeout(accountMenuCloseTimerRef.current);
      }
    };
  }, []);

  const authHint = useAuthHint();
  const isAuthHint = initialIsAuthenticated ?? authHint;
  const hasCookieHint =
    typeof document !== 'undefined' && getCookieValue(STORAGE_KEYS.AUTH_HINT) === 'authenticated';
  const isAuth = hasMounted
    ? Boolean(
        user || (initialIsAuthenticated ?? ((isAuthHint || hasCookieHint) && isAuthLoading))
      )
    : Boolean(initialIsAuthenticated ?? (isAuthHint || hasCookieHint));

  const { allowHeavyMotion } = usePerformanceTier();
  const navRef = useRef<HTMLElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [indicatorRect, setIndicatorRect] = useState<{ left: number; width: number } | null>(null);

  const activeNavItem = NAV_ITEMS.find((item) => item.id === activeView);
  const activeTheme = activeNavItem ? LIBRARY_THEMES[activeNavItem.themeKey] : LIBRARY_THEMES.catalog;

  useIsomorphicLayoutEffect(() => {
    if (!allowHeavyMotion) return;
    if (activeView === 'account') return;

    const activeEl = tabRefs.current[activeView];
    if (!activeEl) return;
    const targetLeft = activeEl.offsetLeft;
    const targetWidth = activeEl.offsetWidth;
    if (targetWidth === 0) return;

    setIndicatorRect({ left: targetLeft, width: targetWidth });
  }, [activeView, allowHeavyMotion]);

  // Window resize and container ResizeObserver
  useEffect(() => {
    if (!allowHeavyMotion) return;

    const handleResize = () => {
      if (activeView === 'account') return;
      const activeEl = tabRefs.current[activeView];
      if (activeEl && activeEl.offsetWidth > 0) {
        setIndicatorRect({ left: activeEl.offsetLeft, width: activeEl.offsetWidth });
      }
    };

    window.addEventListener('resize', handleResize);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && navRef.current) {
      observer = new ResizeObserver(handleResize);
      observer.observe(navRef.current);
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [activeView, allowHeavyMotion]);

  const isGlidingActive = Boolean(allowHeavyMotion && indicatorRect && indicatorRect.width > 0);

  const handleThemeCycle = () => {
    cycleTheme();
    const nextTheme = useThemeStore.getState().theme;
    useReaderStore.getState().setTheme(nextTheme);
    schedulePreferencesCloudSync(0);
  };

  const handleBrandClick = () => {
    onBrandReset?.();
    if (onViewChange) {
      onViewChange('catalog');
    } else {
      router.push(ROUTES.HOME);
    }
    if (typeof window !== 'undefined') {
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch {
        // Ignore scroll errors in non-DOM environments
      }
    }
  };

  return (
    <header
      className={`sticky top-0 z-40 w-full pt-[env(safe-area-inset-top,0px)] bg-background border-b border-border ${
        hasShadow ? 'shadow-md' : 'sm:shadow-none shadow-md'
      } transition-transform duration-300 ease-in-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full pointer-events-none'
      }`}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 sm:gap-4">
        {/* Brand */}
        <div
          className="flex items-center gap-2 sm:gap-3 cursor-pointer group select-none shrink-0"
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
          <div className="w-8 h-8 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
            <BrandLogo
              idPrefix="navbar"
              className="w-8 h-8"
              testId="brand-monogram-icon"
            />
          </div>
          <div className="flex flex-col justify-center min-w-0">
            <span className="hidden min-[375px]:inline text-xs min-[440px]:text-sm sm:text-base lg:text-xl font-bold tracking-tight text-foreground font-serif whitespace-nowrap leading-tight">
              {SITE_CONFIG.LOGO_TEXT}
            </span>
            <span
              data-testid="navbar-active-view-subtitle"
              className={`hidden min-[375px]:inline lg:hidden text-[9px] min-[440px]:text-[10px] font-mono font-bold tracking-widest uppercase leading-none transition-colors ${activeConfig.activeColor}`}
            >
              {activeConfig.label}
            </span>
          </div>
        </div>

        {/* Right Navigation & Actions */}
        <div className="flex items-center gap-0.5 sm:gap-1.5 lg:gap-2 shrink-0">
          {/* Navigation Tabs */}
          <nav ref={navRef} className="relative flex items-center gap-0.5 sm:gap-1.5 lg:gap-2">
            {NAV_ITEMS.map((item) => {
              const isActive = activeView === item.id;
              const theme = LIBRARY_THEMES[item.themeKey];
              const count = item.countKey ? counts[item.countKey] : 0;
              const isFilled = Boolean(hasMounted && item.countKey && count > 0);
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    tabRefs.current[item.id] = el;
                  }}
                  type="button"
                  onClick={() => {
                    if (onViewChange) {
                      onViewChange(item.id);
                    } else {
                      router.push(ROUTES.VIEW(item.id));
                    }
                  }}
                  title={item.title}
                  className={`h-8 px-1.5 sm:px-2 lg:px-3 rounded text-xs font-mono font-medium tracking-wider uppercase flex items-center justify-center gap-1 lg:gap-1.5 border-b-2 transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isActive
                      ? `${theme.navActiveText} ${isGlidingActive ? 'border-transparent' : theme.navActiveBorder}`
                      : 'text-muted-foreground hover:text-foreground border-transparent'
                  }`}
                  aria-label={item.label}
                >
                  <Icon
                    className={`w-3.5 h-3.5 shrink-0 transition-colors duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      isFilled ? theme.navFill : 'fill-transparent'
                    }`}
                  />
                  <span className="hidden lg:inline">{item.label}</span>
                </button>
              );
            })}

            {/* Tier-Adaptive Gliding Active Underline Bar */}
            {isGlidingActive && (
              <span
                data-testid="navbar-active-indicator"
                aria-hidden="true"
                className={`absolute inset-y-0 left-0 h-8 pointer-events-none border-b-2 rounded transition-[transform,width,border-color,opacity] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                  activeView === 'account' ? 'opacity-0 scale-x-50' : 'opacity-100'
                } ${activeTheme.navActiveBorder}`}
                style={{
                  transform: `translate3d(${indicatorRect?.left ?? 0}px, 0, 0)`,
                  width: `${indicatorRect?.width ?? 0}px`,
                }}
              />
            )}
          </nav>

          <div className="h-4 w-[1px] bg-border mx-0.5 sm:mx-1" />

          {/* Right Actions: Auth, Theme */}
          {isAuth ? (
            <div
              ref={accountMenuRef}
              className="relative"
              onPointerDown={handleAccountPointerDown}
              onTouchStart={handleAccountTouchStart}
              onMouseEnter={handleAccountMouseEnter}
              onMouseLeave={handleAccountMouseLeave}
            >
              <Link
                href={ROUTES.ACCOUNT}
                onClick={handleAccountClick}
                title={isOffline ? 'User Account (Offline Mode)' : 'User Account'}
                className={`relative h-8 w-8 lg:w-auto px-0 lg:px-3 inline-flex items-center justify-center gap-1.5 rounded text-xs font-mono border transition-all cursor-pointer select-none active:scale-95 shadow-2xs ${
                  isOffline
                    ? 'border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/15 font-bold shadow-xs'
                    : activeView === 'account'
                      ? 'border-primary bg-primary/10 text-primary font-bold shadow-xs'
                      : 'border-border bg-card hover:border-primary text-foreground'
                }`}
                aria-label="User Account"
              >
                <UserIcon
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isOffline ? 'text-destructive' : 'text-primary'
                  }`}
                />
                <span className="hidden lg:inline font-mono">Account</span>
                {isOffline ? (
                  <span
                    data-testid="navbar-offline-dot"
                    className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0 animate-pulse"
                    aria-label="Offline Mode"
                  />
                ) : (
                  Boolean(user && useFellowshipStore.getState().getPendingInviteCount(user.id) > 0) && (
                    <span
                      data-testid="navbar-fellowship-dot"
                      className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-primary"
                      aria-label="Pending Reader Circle or Symposium invitations"
                    />
                  )
                )}
              </Link>

              {isAccountMenuOpen && (
                <div
                  data-testid="navbar-account-hover-menu"
                  role="menu"
                  aria-label="Account Quick Actions"
                  className="absolute right-0 top-full mt-1.5 w-52 rounded-xl border border-border bg-card shadow-xl p-1.5 z-50 animate-in fade-in duration-150"
                >
                  {(profile?.display_name || user) && (
                    <div className="px-2.5 py-2 border-b border-border mb-1">
                      <p className="text-xs font-serif font-bold text-foreground truncate">
                        {profile?.display_name ||
                          (typeof user?.user_metadata?.display_name === 'string'
                            ? user.user_metadata.display_name
                            : 'Scholar')}
                      </p>
                    </div>
                  )}

                  <Link
                    href={ROUTES.ACCOUNT}
                    role="menuitem"
                    onClick={() => setIsAccountMenuOpen(false)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono text-foreground hover:bg-muted transition-colors"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
                    <span>Account Sanctuary</span>
                  </Link>

                  <button
                    type="button"
                    role="menuitem"
                    data-testid="navbar-hover-sign-out-button"
                    onClick={async () => {
                      setIsAccountMenuOpen(false);
                      await signOut();
                      router.push(ROUTES.HOME);
                    }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer mt-0.5"
                  >
                    <LogOut className="w-3.5 h-3.5 shrink-0" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Button
              variant={!isOffline && activeView === 'account' ? 'primary' : 'outline'}
              onClick={() => (isOffline ? router.push(ROUTES.ACCOUNT) : openAuthModal('sign_in'))}
              title={isOffline ? 'Offline Account & Local Settings' : 'Sign In'}
              aria-label={isOffline ? 'Sign In (Offline Mode)' : 'Sign In'}
              className={`h-8 w-8 lg:w-auto px-0 lg:px-3 inline-flex items-center justify-center gap-1.5 font-mono text-xs font-bold ${
                isOffline
                  ? 'border-destructive/50 bg-destructive/10 text-destructive hover:bg-destructive/15'
                  : ''
              }`}
            >
              <UserIcon
                className={`w-3.5 h-3.5 shrink-0 ${
                  isOffline
                    ? 'text-destructive'
                    : activeView === 'account'
                      ? 'text-primary-foreground'
                      : 'text-primary'
                }`}
              />
              <span className="hidden lg:inline">Sign In</span>
              {isOffline && (
                <span
                  data-testid="navbar-offline-dot"
                  className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0 animate-pulse"
                  aria-label="Offline Mode"
                />
              )}
            </Button>
          )}

          {/* 3-Way Universal Theme Switcher (Light -> Sepia -> Dark) */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleThemeCycle}
            aria-label={`Current theme: ${theme}. Click to switch theme.`}
            className="h-8 w-8 rounded text-muted-foreground hover:text-foreground shrink-0"
          >
            {theme === 'light' ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : theme === 'sepia' ? (
              <Coffee className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
          </Button>

          {/* GitHub Repository Link (Visible on all screens >= 320px without colliding with logo) */}
          <a
            href={SITE_CONFIG.GITHUB_REPO}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View Bookarium repository on GitHub"
            title="View Bookarium repository on GitHub"
            className="hidden min-[320px]:inline-flex items-center justify-center h-8 w-8 ml-0.5 sm:ml-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
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
