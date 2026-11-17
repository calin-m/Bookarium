'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  ArrowUp,
  Award,
  Check,
  Coffee,
  Filter,
  Flame,
  Headphones,
  Lock,
  Moon,
  RefreshCw,
  ShieldCheck,
  Sliders,
  Sun,
  Trophy,
  User as UserIcon,
  Users,
  AlertTriangle,
} from 'lucide-react';
import { ACCOLADES_CATALOG, ACCOLADE_CATEGORIES } from '@/config/accolades-config';
import type { AccoladeCategory } from '@/types/accolades.types';
import type { AppTheme } from '@/stores/useThemeStore';
import { useAmbientDockScrollState } from '@/hooks/useAmbientDockScrollState';
import { AmbientCapsuleDock } from '@/components/ui/AmbientCapsuleDock';

export type AccountDockTabMode =
  | 'profile'
  | 'habits'
  | 'preferences'
  | 'security'
  | 'guest-preferences'
  | 'guest-habits'
  | 'guest';

export interface AccountBottomDockProps {
  mode: AccountDockTabMode;
  onJumpToSection?: (elementId: string) => void;
  // Scholar Profile context
  pendingInvitesCount?: number;
  // Habits & Accolades context
  accoladeCategory?: AccoladeCategory;
  onAccoladeCategoryChange?: (category: AccoladeCategory) => void;
  accoladeCategoryCounts?: Partial<Record<AccoladeCategory, number>>;
  isFilterOpen?: boolean;
  onFilterOpenChange?: (open: boolean) => void;
  // Preferences & Guest Offline context
  theme?: AppTheme;
  onCycleTheme?: () => void;
  onSwitchGuestMode?: (tab: 'preferences' | 'habits') => void;
  // Security context
  onRefreshSessions?: () => void;
  isRefreshingSessions?: boolean;
  isOffline?: boolean;
  // Scroll behavior
  onScrollToTop?: () => void;
  threshold?: number;
  idleTimeoutMs?: number;
  className?: string;
}

const DEFAULT_CATEGORY_COUNTS: Record<AccoladeCategory, number> = {
  all: ACCOLADES_CATALOG.length,
  streaks: ACCOLADES_CATALOG.filter((a) => a.category === 'streaks').length,
  immersion: ACCOLADES_CATALOG.filter((a) => a.category === 'immersion').length,
  exploration: ACCOLADES_CATALOG.filter((a) => a.category === 'exploration').length,
  scholarship: ACCOLADES_CATALOG.filter((a) => a.category === 'scholarship').length,
  curation: ACCOLADES_CATALOG.filter((a) => a.category === 'curation').length,
};

function defaultJumpToSection(elementId: string): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const el = document.getElementById(elementId);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const targetY = Math.max(0, (window.scrollY || 0) + rect.top - 88);
  window.scrollTo({ top: targetY, behavior: 'smooth' });
}

const PILL_BTN_BASE =
  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[11px] font-mono font-medium whitespace-nowrap transition-colors cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted';

/**
 * Floating ambient bottom capsule dock tailored for `/account`, exposing per-tab
 * section anchors, the Accolades category filter popover, quick Theme / Session
 * controls, offline guest workspace toggles, and Scroll-to-Top muting.
 */
export const AccountBottomDock: React.FC<AccountBottomDockProps> = ({
  mode,
  onJumpToSection = defaultJumpToSection,
  pendingInvitesCount = 0,
  accoladeCategory = 'all',
  onAccoladeCategoryChange,
  accoladeCategoryCounts,
  isFilterOpen: controlledFilterOpen,
  onFilterOpenChange,
  theme = 'light',
  onCycleTheme,
  onSwitchGuestMode,
  onRefreshSessions,
  isRefreshingSessions = false,
  isOffline = false,
  onScrollToTop,
  threshold = 200,
  idleTimeoutMs = 1600,
  className = '',
}) => {
  const [internalFilterOpen, setInternalFilterOpen] = useState(false);
  const isFilterOpen = controlledFilterOpen ?? internalFilterOpen;
  const setFilterOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved = typeof next === 'function' ? next(isFilterOpen) : next;
      onFilterOpenChange?.(resolved);
      if (controlledFilterOpen === undefined) {
        setInternalFilterOpen(resolved);
      }
    },
    [controlledFilterOpen, isFilterOpen, onFilterOpenChange]
  );

  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close Accolades filter popover on outside click or Escape key
  useEffect(() => {
    if (!isFilterOpen || mode !== 'habits') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFilterOpen(false);
      }
    };

    const handlePointerDownOutside = (e: PointerEvent | MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDownOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDownOutside);
    };
  }, [isFilterOpen, mode, setFilterOpen]);

  const {
    effectiveVisible,
    isAtTop,
    isDockDimmed,
    handlePointerEnter,
    handlePointerLeave,
    handlePointerDown,
  } = useAmbientDockScrollState({
    threshold,
    idleTimeoutMs,
    isPinnedAwake: isFilterOpen && mode === 'habits',
  });

  // Hide dock when signed-out online user is already at the top of the guest prompt
  if (mode === 'guest' && isAtTop) {
    return null;
  }

  const activeCategoryLabel =
    ACCOLADE_CATEGORIES.find((cat) => cat.id === accoladeCategory)?.label || 'All Bookplates';

  const nextThemeLabel =
    theme === 'light' ? 'Sepia' : theme === 'sepia' ? 'Dark' : 'Light';

  return (
    <AmbientCapsuleDock
      effectiveVisible={effectiveVisible}
      isDockDimmed={isDockDimmed}
      asideTestId="account-bottom-dock"
      auraTestId="account-dock-ambient-aura"
      ariaLabel="Account quick controls"
      maxWidthClass="max-w-[94vw]"
      className={className}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onPointerDown={handlePointerDown}
    >
      <div
        ref={wrapperRef}
        data-no-swipe="true"
        className="relative flex items-center gap-1 sm:gap-1.5"
      >
        {/* Upward Glassmorphic Category Popover for Habits & Accolades */}
        {mode === 'habits' && isFilterOpen && (
          <div
            role="dialog"
            aria-label="Filter accolades by category"
            data-testid="account-dock-filter-popover"
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 rounded-2xl border border-border bg-card/95 backdrop-blur-md p-2 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <div className="px-2.5 py-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground font-bold border-b border-border mb-1">
              Accolade Categories
            </div>
            <div className="space-y-0.5">
              {ACCOLADE_CATEGORIES.map((category) => {
                const isSelected = accoladeCategory === category.id;
                const count =
                  accoladeCategoryCounts?.[category.id] ?? DEFAULT_CATEGORY_COUNTS[category.id];
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => {
                      onAccoladeCategoryChange?.(category.id);
                      setFilterOpen(false);
                      onJumpToSection('account-accolades-card');
                    }}
                    data-testid={`account-dock-category-${category.id}`}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs font-mono transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-primary text-primary-foreground font-bold'
                        : 'text-foreground hover:bg-muted'
                    }`}
                  >
                    <span className="flex items-center gap-2 min-w-0 truncate">
                      {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      <span className="truncate">{category.label}</span>
                    </span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        isSelected
                          ? 'bg-primary-foreground/20 text-primary-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mode 1: Scholar Profile Quick Jumps */}
        {mode === 'profile' && (
          <>
            <button
              type="button"
              onClick={() => onJumpToSection('scholar-profile-section')}
              data-testid="account-dock-jump-identity"
              className={PILL_BTN_BASE}
              aria-label="Scholar identity section"
            >
              <UserIcon className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="hidden sm:inline">Identity</span>
            </button>

            <button
              type="button"
              onClick={() => onJumpToSection('account-symposium-section')}
              data-testid="account-dock-jump-fellowship"
              className={`relative ${PILL_BTN_BASE}`}
              aria-label="Symposiums and Reader Circle section"
            >
              <Users className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="hidden sm:inline">Fellowships</span>
              {pendingInvitesCount > 0 && (
                <span
                  data-testid="account-dock-invites-badge"
                  className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-white"
                >
                  {pendingInvitesCount}
                </span>
              )}
            </button>

            <div className="h-4 w-[1px] bg-border shrink-0" />
          </>
        )}

        {/* Mode 2: Habits & Accolades Jumps + Category Filter Popover Trigger */}
        {mode === 'habits' && (
          <>
            <button
              type="button"
              onClick={() => onJumpToSection('account-habits-card')}
              data-testid="account-dock-jump-streaks"
              className={PILL_BTN_BASE}
              aria-label="Jump to Reading Streaks and Annual Challenge"
            >
              <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="hidden sm:inline">Streaks</span>
            </button>

            <button
              type="button"
              onClick={() => onJumpToSection('account-accolades-card')}
              data-testid="account-dock-jump-accolades"
              className={PILL_BTN_BASE}
              aria-label="Jump to Accolades Compendium"
            >
              <Award className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="hidden sm:inline">Accolades</span>
            </button>

            {onAccoladeCategoryChange && (
              <button
                type="button"
                onClick={() => setFilterOpen((prev) => !prev)}
                data-testid="account-dock-filter-btn"
                aria-expanded={isFilterOpen}
                aria-label={`Filter accolades: ${activeCategoryLabel}`}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  isFilterOpen || accoladeCategory !== 'all'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/60 text-foreground hover:bg-muted'
                }`}
              >
                <Filter className="w-3.5 h-3.5 shrink-0" />
                <span className="max-w-[7.5rem] truncate">{activeCategoryLabel}</span>
              </button>
            )}

            <div className="h-4 w-[1px] bg-border shrink-0" />
          </>
        )}

        {/* Mode 3: Preferences Jumps + Quick Atmosphere Theme Cycler */}
        {mode === 'preferences' && (
          <>
            <button
              type="button"
              onClick={() => onJumpToSection('preferences-subpanel-appearance')}
              data-testid="account-dock-jump-appearance"
              className={PILL_BTN_BASE}
              aria-label="Jump to Display and Typography settings"
            >
              <Sliders className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="hidden sm:inline">Display</span>
            </button>

            <button
              type="button"
              onClick={() => onJumpToSection('preferences-subpanel-narration')}
              data-testid="account-dock-jump-narration"
              className={PILL_BTN_BASE}
              aria-label="Jump to Read-Aloud Studio"
            >
              <Headphones className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="hidden sm:inline">Read-Aloud</span>
            </button>

            {onCycleTheme && (
              <button
                type="button"
                onClick={onCycleTheme}
                data-testid="account-dock-cycle-theme-btn"
                aria-label={`Switch theme to ${nextThemeLabel}`}
                title={`Theme: ${theme} (tap for ${nextThemeLabel})`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold bg-muted/60 hover:bg-muted text-foreground transition-colors cursor-pointer whitespace-nowrap"
              >
                {theme === 'light' ? (
                  <Sun className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                ) : theme === 'sepia' ? (
                  <Coffee className="w-3.5 h-3.5 text-amber-700 dark:text-amber-500 shrink-0" />
                ) : (
                  <Moon className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                )}
                <span className="capitalize">{theme}</span>
              </button>
            )}

            <div className="h-4 w-[1px] bg-border shrink-0" />
          </>
        )}

        {/* Mode 4: Security Jumps & Live Sessions Refresh */}
        {mode === 'security' && (
          <>
            <button
              type="button"
              onClick={() => onJumpToSection('security-password-card')}
              data-testid="account-dock-jump-password"
              className={PILL_BTN_BASE}
              aria-label="Password credentials section"
            >
              <Lock className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="hidden sm:inline">Password</span>
            </button>

            <button
              type="button"
              onClick={() => onJumpToSection('security-sessions-card')}
              data-testid="account-dock-jump-sessions"
              className={PILL_BTN_BASE}
              aria-label="Active sessions section"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="hidden sm:inline">Sessions</span>
            </button>

            <button
              type="button"
              onClick={() => onJumpToSection('security-danger-card')}
              data-testid="account-dock-jump-danger"
              className={PILL_BTN_BASE}
              aria-label="Danger zone section"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
              <span className="hidden md:inline">Danger</span>
            </button>

            {onRefreshSessions && !isOffline && (
              <button
                type="button"
                onClick={onRefreshSessions}
                disabled={isRefreshingSessions}
                data-testid="account-dock-refresh-sessions-btn"
                aria-label="Refresh active sessions"
                title="Refresh active device sessions"
                className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-40"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefreshingSessions ? 'animate-spin' : ''}`}
                />
              </button>
            )}

            <div className="h-4 w-[1px] bg-border shrink-0" />
          </>
        )}

        {/* Mode 5: Guest Offline Workspace Switcher */}
        {(mode === 'guest-preferences' || mode === 'guest-habits') && onSwitchGuestMode && (
          <>
            <button
              type="button"
              onClick={() => onSwitchGuestMode('preferences')}
              data-testid="account-dock-guest-prefs-btn"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                mode === 'guest-preferences'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 shrink-0" />
              <span>Preferences</span>
            </button>

            <button
              type="button"
              onClick={() => onSwitchGuestMode('habits')}
              data-testid="account-dock-guest-habits-btn"
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                mode === 'guest-habits'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <Trophy className="w-3.5 h-3.5 shrink-0" />
              <span>Local Habits</span>
            </button>

            <div className="h-4 w-[1px] bg-border shrink-0" />
          </>
        )}

        {/* Universal Scroll to Top with context-aware muting at top */}
        <button
          type="button"
          onClick={
            isAtTop
              ? undefined
              : onScrollToTop || (() => window.scrollTo({ top: 0, behavior: 'smooth' }))
          }
          disabled={isAtTop}
          aria-disabled={isAtTop}
          data-testid="account-dock-top-btn"
          className={`p-2 rounded-full transition-all ${
            isAtTop
              ? 'opacity-25 pointer-events-none text-muted-foreground'
              : 'text-muted-foreground hover:text-primary hover:bg-muted cursor-pointer'
          }`}
          aria-label="Scroll to top"
          title={isAtTop ? 'Already at top' : 'Scroll to top'}
        >
          <ArrowUp className="w-4 h-4" />
        </button>
      </div>
    </AmbientCapsuleDock>
  );
};
