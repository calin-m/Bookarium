'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import {
  Mail,
  Calendar,
  ShieldCheck,
  Check,
  AlertTriangle,
  Library,
  Heart,
  Highlighter,
  Layers,
  Bookmark,
  PenLine,
  AtSign,
  LogOut,
} from 'lucide-react';
import type { Profile } from '@/types/database.types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  TurnstileWidget,
  getTurnstileSiteKey,
  type TurnstileWidgetHandle,
} from '@/components/auth/TurnstileWidget';
import { ROUTES } from '@/config/routes';

export interface AccountRibbonStats {
  savedCount: number;
  favoriteCount: number;
  annotationCount: number;
  customShelvesCount: number;
  bookmarksCount: number;
  readingStreak?: number;
}

export interface AccountIdentityCardProps {
  user: User;
  profile: Profile | null;
  formattedDate: string;
  displayName: string;
  onDisplayNameChange: (name: string) => void;
  onSaveProfile: (e: React.FormEvent) => void;
  isSaving: boolean;
  saveSuccess: boolean;
  saveError: string | null;
  onResendVerification?: (captchaToken?: string) => Promise<void> | void;
  isResendingVerification?: boolean;
  resendSuccess?: boolean;
  resendError?: string | null;
  resendCooldown?: number;
  stats?: AccountRibbonStats;
  onOpenLibraryBreakdown?: () => void;
  onSignOut?: () => Promise<void> | void;
}

export const AccountIdentityCard: React.FC<AccountIdentityCardProps> = ({
  user,
  profile,
  formattedDate,
  displayName,
  onDisplayNameChange,
  onSaveProfile,
  isSaving,
  saveSuccess,
  saveError,
  onResendVerification,
  isResendingVerification = false,
  resendSuccess = false,
  resendError = null,
  resendCooldown = 0,
  stats,
  onOpenLibraryBreakdown,
  onSignOut,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [prevSaveSuccess, setPrevSaveSuccess] = useState(saveSuccess);
  const turnstileSiteKey = getTurnstileSiteKey();
  const [isVerifyCaptchaOpen, setIsVerifyCaptchaOpen] = useState(false);
  const [verifyTurnstileError, setVerifyTurnstileError] = useState<string | null>(null);
  const verifyTurnstileRef = React.useRef<TurnstileWidgetHandle>(null);
  const isSubmittingVerifyRef = React.useRef(false);

  const handleResendClick = () => {
    if (!onResendVerification) return;
    if (!turnstileSiteKey) {
      void onResendVerification();
      return;
    }
    setVerifyTurnstileError(null);
    isSubmittingVerifyRef.current = false;
    setIsVerifyCaptchaOpen((prev) => !prev);
  };

  const handleVerifyCaptchaToken = async (token: string | null) => {
    if (!token || !onResendVerification || isSubmittingVerifyRef.current) return;
    isSubmittingVerifyRef.current = true;
    setVerifyTurnstileError(null);
    try {
      await onResendVerification(token);
      setIsVerifyCaptchaOpen(false);
    } finally {
      isSubmittingVerifyRef.current = false;
      verifyTurnstileRef.current?.reset();
    }
  };

  // Auto-close editor upon transition to saveSuccess during rendering (no cascading render effect)
  if (saveSuccess !== prevSaveSuccess) {
    setPrevSaveSuccess(saveSuccess);
    if (saveSuccess && isEditingName) {
      setIsEditingName(false);
    }
  }

  const isEmailVerified = Boolean(
    user.email_confirmed_at ||
      ('confirmed_at' in user && typeof user.confirmed_at === 'string' && user.confirmed_at)
  );

  const resolvedName =
    profile?.display_name || user?.user_metadata?.display_name || 'Reader';
  const monogram = resolvedName.trim().charAt(0).toUpperCase() || 'S';

  return (
    <div
      className="bg-card border border-border rounded-2xl pt-4 sm:pt-5 px-4 sm:px-5 pb-1.5 sm:pb-2 shadow-booksaw space-y-3"
      data-testid="scholar-identity-ribbon"
    >
      {/* Top Row: Monogram Seal, Scholar Identity & Verification Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          <div
            className="w-11 h-11 rounded-2xl bg-primary/10 border border-border text-primary font-serif font-bold text-lg flex items-center justify-center shrink-0 shadow-xs"
            aria-hidden="true"
          >
            {monogram}
          </div>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="text-lg sm:text-xl font-serif font-bold text-foreground truncate"
                title={resolvedName}
              >
                {resolvedName}
              </h1>
              {profile?.username && (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-muted text-muted-foreground border border-border">
                  <AtSign className="w-3 h-3 text-primary" />
                  <span>{profile.username}</span>
                </span>
              )}
              {!isEditingName && (
                <button
                  type="button"
                  onClick={() => setIsEditingName(true)}
                  aria-expanded={isEditingName}
                  aria-label="Edit display name"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  <PenLine className="w-3 h-3" />
                  <span>Edit Name</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1 shrink-0">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Joined {formattedDate}</span>
              </span>
              {saveSuccess && (
                <span className="inline-flex items-center gap-1 text-[11px] font-mono text-success animate-in fade-in duration-150">
                  <Check className="w-3.5 h-3.5" />
                  <span>Changes saved to cloud</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start sm:self-center">
          {stats && (
            <button
              type="button"
              onClick={onOpenLibraryBreakdown}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold whitespace-nowrap border transition-colors cursor-pointer ${
                (stats.readingStreak ?? 0) > 0
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                  : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
              title="View reading streaks and habit telemetry"
              data-testid="identity-streak-badge"
            >
              <span>🔥 {stats.readingStreak ?? 0}d Streak</span>
            </button>
          )}

          {isEmailVerified ? (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-success/10 text-success border border-border">
              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
              <span>Verified Reader</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-500/10 text-amber-500 border border-border">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>Email Unverified</span>
            </div>
          )}

          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              data-testid="identity-sign-out-button"
              title="Sign out from this browser"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-mono font-bold border border-border bg-muted/30 text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-3 h-3 shrink-0" />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>

      {/* Scholar Sanctuary Ledger (5 Clean Stacked Collection Counters) */}
      {stats && (
        <div
          className="grid grid-cols-5 divide-x divide-border/60 pt-2 sm:pt-2.5 border-t border-border -mx-1 sm:mx-0"
          data-testid="identity-ribbon-stat-strip"
        >
          <Link
            href={ROUTES.BOOKSHELF}
            className="flex flex-col items-center justify-center py-0.5 sm:py-1 px-0.5 sm:px-2 rounded-xl hover:bg-muted/40 transition-colors group text-center min-w-0"
          >
            <div className="inline-flex items-center justify-center gap-1 sm:gap-1.5 leading-none text-foreground group-hover:text-primary transition-colors">
              <Library className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary shrink-0" />
              <span className="font-serif font-bold text-sm sm:text-base tabular-nums leading-none tracking-tight">{stats.savedCount}</span>
            </div>
            <span className="text-[9px] sm:text-[11px] font-mono uppercase tracking-wider leading-none text-muted-foreground group-hover:text-foreground transition-colors mt-0.5 sm:mt-1 truncate max-w-full">
              Shelved
            </span>
          </Link>

          <Link
            href={ROUTES.FAVORITES}
            className="flex flex-col items-center justify-center py-0.5 sm:py-1 px-0.5 sm:px-2 rounded-xl hover:bg-muted/40 transition-colors group text-center min-w-0"
          >
            <div className="inline-flex items-center justify-center gap-1 sm:gap-1.5 leading-none text-foreground group-hover:text-rose-500 transition-colors">
              <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-500 shrink-0" />
              <span className="font-serif font-bold text-sm sm:text-base tabular-nums leading-none tracking-tight">{stats.favoriteCount}</span>
            </div>
            <span className="text-[9px] sm:text-[11px] font-mono uppercase tracking-wider leading-none text-muted-foreground group-hover:text-foreground transition-colors mt-0.5 sm:mt-1 truncate max-w-full">
              Favorites
            </span>
          </Link>

          <Link
            href={ROUTES.VIEW('notebook')}
            className="flex flex-col items-center justify-center py-0.5 sm:py-1 px-0.5 sm:px-2 rounded-xl hover:bg-muted/40 transition-colors group text-center min-w-0"
          >
            <div className="inline-flex items-center justify-center gap-1 sm:gap-1.5 leading-none text-foreground group-hover:text-amber-500 transition-colors">
              <Highlighter className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-500 shrink-0" />
              <span className="font-serif font-bold text-sm sm:text-base tabular-nums leading-none tracking-tight">{stats.annotationCount}</span>
            </div>
            <span className="text-[9px] sm:text-[11px] font-mono uppercase tracking-wider leading-none text-muted-foreground group-hover:text-foreground transition-colors mt-0.5 sm:mt-1 truncate max-w-full">
              Notes
            </span>
          </Link>

          <Link
            href={ROUTES.BOOKSHELF}
            className="flex flex-col items-center justify-center py-0.5 sm:py-1 px-0.5 sm:px-2 rounded-xl hover:bg-muted/40 transition-colors group text-center min-w-0"
          >
            <div className="inline-flex items-center justify-center gap-1 sm:gap-1.5 leading-none text-foreground group-hover:text-purple-500 transition-colors">
              <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-500 shrink-0" />
              <span className="font-serif font-bold text-sm sm:text-base tabular-nums leading-none tracking-tight">{stats.customShelvesCount}</span>
            </div>
            <span className="text-[9px] sm:text-[11px] font-mono uppercase tracking-wider leading-none text-muted-foreground group-hover:text-foreground transition-colors mt-0.5 sm:mt-1 truncate max-w-full">
              Shelves
            </span>
          </Link>

          <Link
            href={ROUTES.VIEW('bookmarks')}
            className="flex flex-col items-center justify-center py-0.5 sm:py-1 px-0.5 sm:px-2 rounded-xl hover:bg-muted/40 transition-colors group text-center min-w-0"
          >
            <div className="inline-flex items-center justify-center gap-1 sm:gap-1.5 leading-none text-foreground group-hover:text-emerald-500 transition-colors">
              <Bookmark className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-500 shrink-0" />
              <span className="font-serif font-bold text-sm sm:text-base tabular-nums leading-none tracking-tight">{stats.bookmarksCount}</span>
            </div>
            <span className="text-[9px] sm:text-[11px] font-mono uppercase tracking-wider leading-none text-muted-foreground group-hover:text-foreground transition-colors mt-0.5 sm:mt-1 truncate max-w-full">
              Bookmarks
            </span>
          </Link>
        </div>
      )}

      {/* Unverified Email Warning & Resend Banner */}
      {!isEmailVerified && (
        <div className="p-3.5 rounded-xl border border-amber-500/40 dark:border-amber-500/50 bg-amber-500/5 space-y-3 text-xs font-mono">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 min-w-0">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Please verify your email address</span>
              </p>
              <p className="text-[11px] text-muted-foreground font-sans leading-relaxed">
                Verification links expire in 1 hour. Confirm your email to secure your account.
              </p>
              {resendError && (
                <p className="text-[11px] text-destructive font-mono pt-1">{resendError}</p>
              )}
              {resendSuccess && (
                <p className="text-[11px] text-success font-mono pt-1">
                  Verification link sent! Check your inbox.
                </p>
              )}
            </div>

            {onResendVerification && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResendClick}
                disabled={isResendingVerification || resendCooldown > 0}
                className="shrink-0 text-xs font-mono cursor-pointer"
              >
                {isResendingVerification
                  ? 'Sending...'
                  : resendCooldown > 0
                    ? `Resend in ${resendCooldown}s`
                    : 'Resend Verification Link'}
              </Button>
            )}
          </div>

          {isVerifyCaptchaOpen && turnstileSiteKey && (
            <div
              data-testid="resend-verification-turnstile-panel"
              className="rounded-xl border border-border bg-card/80 p-3 space-y-2 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-muted-foreground">
                  Complete security check to resend your verification email
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsVerifyCaptchaOpen(false);
                    setVerifyTurnstileError(null);
                  }}
                  className="text-[11px] font-mono text-muted-foreground hover:text-foreground underline cursor-pointer shrink-0"
                >
                  Cancel
                </button>
              </div>
              <TurnstileWidget
                ref={verifyTurnstileRef}
                active={isVerifyCaptchaOpen}
                testId="account-verify-turnstile-widget"
                onTokenChange={(token) => {
                  void handleVerifyCaptchaToken(token);
                }}
                onLoadError={setVerifyTurnstileError}
                className="flex justify-center"
              />
              {verifyTurnstileError && (
                <p className="text-[11px] font-mono text-destructive text-center">
                  {verifyTurnstileError}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Collapsible Quick Profile Editor Drawer (Zero height when collapsed) */}
      <form
        onSubmit={onSaveProfile}
        className={
          isEditingName || saveError
            ? 'space-y-3 pt-3 border-t border-border animate-in fade-in duration-150'
            : 'hidden'
        }
      >
        <h2 className="text-xs font-mono uppercase tracking-wider text-muted-foreground font-bold">
          Account Details
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="display-name" className="text-xs font-mono text-foreground font-bold">
              Display Name
            </label>
            <Input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => onDisplayNameChange(e.target.value)}
              placeholder="Your reading pen name"
              className="text-xs font-mono"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-mono text-muted-foreground">Account Email</label>
            <Input
              type="email"
              value={user.email ?? ''}
              disabled
              className="text-xs font-mono opacity-70 bg-muted cursor-not-allowed"
            />
          </div>
        </div>

        {saveError && <p className="text-xs font-mono text-destructive">{saveError}</p>}

        <div className="flex items-center gap-2 pt-1">
          <Button
            type="submit"
            variant="primary"
            size="chip"
            isLoading={isSaving}
            aria-label="Save Changes"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Save Changes</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="chip"
            onClick={() => {
              setIsEditingName(false);
              onDisplayNameChange(profile?.display_name || user?.user_metadata?.display_name || 'Reader');
            }}
            aria-label="Cancel editing display name"
            className="text-xs font-mono text-muted-foreground hover:text-foreground"
          >
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
};
