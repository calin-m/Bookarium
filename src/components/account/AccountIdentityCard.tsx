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
} from 'lucide-react';
import type { Profile } from '@/types/database.types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
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
  onResendVerification?: () => Promise<void>;
  isResendingVerification?: boolean;
  resendSuccess?: boolean;
  resendError?: string | null;
  resendCooldown?: number;
  stats?: AccountRibbonStats;
  onOpenLibraryBreakdown?: () => void;
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
}) => {
  const [isEditingName, setIsEditingName] = useState(false);

  const isEmailVerified = Boolean(
    user.email_confirmed_at ||
      ('confirmed_at' in user && typeof user.confirmed_at === 'string' && user.confirmed_at)
  );

  const resolvedName =
    profile?.display_name || user?.user_metadata?.display_name || 'Reader';
  const monogram = resolvedName.trim().charAt(0).toUpperCase() || 'S';

  return (
    <div
      className="bg-card border border-border rounded-2xl p-4 sm:p-5 shadow-booksaw space-y-3.5"
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
              <h1 className="text-lg sm:text-xl font-serif font-bold text-foreground truncate">
                {resolvedName}
              </h1>
              {profile?.username && (
                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-mono bg-muted text-muted-foreground border border-border">
                  <AtSign className="w-3 h-3 text-primary" />
                  <span>{profile.username}</span>
                </span>
              )}
              <button
                type="button"
                onClick={() => setIsEditingName((prev) => !prev)}
                aria-expanded={isEditingName}
                aria-label="Toggle quick display name editor"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-mono text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              >
                <PenLine className="w-3 h-3" />
                <span>{isEditingName ? 'Close' : 'Edit Name'}</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-muted-foreground mt-0.5">
              <span
                className="flex items-center gap-1 truncate max-w-[220px]"
                title={user.email}
              >
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{user.email}</span>
              </span>
              <span className="flex items-center gap-1 shrink-0">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>{formattedDate}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
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
        </div>
      </div>

      {/* Inline Clickable Stat Strip (Replaces Tall Top-Fold Library Stack) */}
      {stats && (
        <div
          className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:items-center sm:gap-2 pt-2.5 border-t border-border"
          data-testid="identity-ribbon-stat-strip"
        >
          <Link
            href={ROUTES.BOOKSHELF}
            className="inline-flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 text-xs font-mono whitespace-nowrap min-w-0 transition-colors"
          >
            <Library className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-bold text-foreground">{stats.savedCount}</span>
            <span className="text-muted-foreground truncate">Shelved</span>
          </Link>

          <Link
            href={ROUTES.FAVORITES}
            className="inline-flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 text-xs font-mono whitespace-nowrap min-w-0 transition-colors"
          >
            <Heart className="w-3.5 h-3.5 text-rose-500 shrink-0" />
            <span className="font-bold text-foreground">{stats.favoriteCount}</span>
            <span className="text-muted-foreground truncate">Favorites</span>
          </Link>

          <Link
            href={ROUTES.VIEW('notebook')}
            className="inline-flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 text-xs font-mono whitespace-nowrap min-w-0 transition-colors"
          >
            <Highlighter className="w-3.5 h-3.5 text-amber-500 shrink-0" />
            <span className="font-bold text-foreground">{stats.annotationCount}</span>
            <span className="text-muted-foreground truncate">Notes</span>
          </Link>

          <Link
            href={ROUTES.BOOKSHELF}
            className="inline-flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 text-xs font-mono whitespace-nowrap min-w-0 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-purple-500 shrink-0" />
            <span className="font-bold text-foreground">{stats.customShelvesCount}</span>
            <span className="text-muted-foreground truncate">Shelves</span>
          </Link>

          <Link
            href={ROUTES.VIEW('bookmarks')}
            className="inline-flex items-center justify-center sm:justify-start gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-1 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 text-xs font-mono whitespace-nowrap min-w-0 transition-colors"
          >
            <Bookmark className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="font-bold text-foreground">{stats.bookmarksCount}</span>
            <span className="text-muted-foreground truncate">Bookmarks</span>
          </Link>

          <button
            type="button"
            onClick={onOpenLibraryBreakdown}
            className={`inline-flex items-center justify-center sm:justify-start gap-1 px-1.5 sm:px-2.5 py-1 rounded-xl border text-xs font-mono font-bold whitespace-nowrap min-w-0 transition-colors cursor-pointer ${
              (stats.readingStreak ?? 0) > 0
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            }`}
          >
            <span className="truncate">🔥 {stats.readingStreak ?? 0}d Streak</span>
          </button>
        </div>
      )}

      {/* Unverified Email Warning & Resend Banner */}
      {!isEmailVerified && (
        <div className="p-3.5 rounded-xl border border-amber-500/40 dark:border-amber-500/50 bg-amber-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
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
              onClick={onResendVerification}
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
      )}

      {/* Collapsible Quick Profile Editor Drawer (Zero height when collapsed) */}
      <form
        onSubmit={onSaveProfile}
        className={
          isEditingName || saveError || saveSuccess
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

        <div className="flex items-center gap-3 pt-1">
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
          {saveSuccess && (
            <span className="inline-flex items-center gap-1 text-xs font-mono text-success animate-in fade-in duration-150">
              <Check className="w-3.5 h-3.5" />
              <span>Changes saved to cloud</span>
            </span>
          )}
        </div>
      </form>
    </div>
  );
};
