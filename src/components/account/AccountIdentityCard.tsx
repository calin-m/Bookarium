'use client';

import React, { useState } from 'react';
import type { User } from '@supabase/supabase-js';
import {
  Mail,
  Calendar,
  ShieldCheck,
  AlertTriangle,
  LogOut,
} from 'lucide-react';
import type { Profile } from '@/types/database.types';
import { Button } from '@/components/ui/Button';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import {
  TurnstileWidget,
  getTurnstileSiteKey,
  type TurnstileWidgetHandle,
} from '@/components/auth/TurnstileWidget';

function resolveScholarInitials(displayName?: string | null, username?: string | null): string {
  const trimmedName = displayName?.trim();
  if (trimmedName) {
    const parts = trimmedName.split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  const trimmedHandle = username?.trim();
  if (trimmedHandle) {
    return trimmedHandle.slice(0, 2).toUpperCase();
  }
  return 'BS';
}

export interface AccountIdentityCardProps {
  user: User;
  profile: Profile | null;
  formattedDate: string;
  onResendVerification?: (captchaToken?: string) => Promise<void> | void;
  isResendingVerification?: boolean;
  resendSuccess?: boolean;
  resendError?: string | null;
  resendCooldown?: number;
  readingStreak?: number;
  onOpenLibraryBreakdown?: () => void;
  onSignOut?: () => Promise<void> | void;
}

export const AccountIdentityCard: React.FC<AccountIdentityCardProps> = ({
  user,
  profile,
  formattedDate,
  onResendVerification,
  isResendingVerification = false,
  resendSuccess = false,
  resendError = null,
  resendCooldown = 0,
  readingStreak,
  onOpenLibraryBreakdown,
  onSignOut,
}) => {
  const [isSignOutModalOpen, setIsSignOutModalOpen] = useState(false);
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

  const isEmailVerified = Boolean(
    user.email_confirmed_at ||
      ('confirmed_at' in user && typeof user.confirmed_at === 'string' && user.confirmed_at)
  );

  const rawDisplayName =
    profile?.display_name?.trim() ||
    (typeof user?.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name.trim()
      : '');
  const resolvedName = rawDisplayName || 'Reader';
  const monogram = resolveScholarInitials(rawDisplayName, profile?.username);

  return (
    <section
      aria-label="Scholar Identity"
      className="bg-card border border-border rounded-3xl p-6 sm:p-8 shadow-booksaw relative overflow-hidden"
      data-testid="scholar-identity-ribbon"
    >
      {/* Subtle illuminated ambient accent glows matching PublicProfileView */}
      <div
        aria-hidden="true"
        className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none"
      />
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl pointer-events-none"
      />

      {/* Top Row: Gradient Monogram Seal, Scholar Identity & Interactive Account Actions */}
      <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4 sm:gap-6 min-w-0">
          <div
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-amber-500/20 via-primary/15 to-muted/40 border border-border text-primary font-serif font-bold text-xl sm:text-2xl flex items-center justify-center shrink-0 shadow-inner select-none"
            aria-hidden="true"
            data-testid="identity-monogram-seal"
          >
            {monogram}
          </div>

          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1
                className="text-2xl sm:text-3xl font-serif font-bold text-foreground truncate"
                title={resolvedName}
              >
                {resolvedName}
              </h1>

              {isEmailVerified ? (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-success/10 text-success border border-border whitespace-nowrap">
                  <ShieldCheck className="w-3 h-3 shrink-0" />
                  <span>Verified Reader</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-500/10 text-amber-500 border border-border whitespace-nowrap">
                  <AlertTriangle className="w-3 h-3 shrink-0" />
                  <span>Email Unverified</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-muted-foreground">
              <span className="flex items-center gap-1.5 shrink-0">
                <Calendar className="w-3.5 h-3.5 shrink-0" />
                <span>Joined {formattedDate}</span>
              </span>
            </div>
          </div>
        </div>

        <div
          data-testid="identity-actions-row"
          className="flex flex-wrap items-center justify-between md:justify-end gap-2.5 w-full md:w-auto shrink-0"
        >
          {typeof readingStreak === 'number' && (
            <button
              type="button"
              onClick={onOpenLibraryBreakdown}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-mono font-semibold whitespace-nowrap border transition-colors cursor-pointer ${
                readingStreak > 0
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20'
                  : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground'
              }`}
              title="View reading streaks and habit telemetry"
              data-testid="identity-streak-badge"
            >
              <span>🔥 {readingStreak}d Streak</span>
            </button>
          )}

          {onSignOut && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsSignOutModalOpen(true)}
              data-testid="identity-sign-out-button"
              title="Sign out from this browser"
              className="ml-auto md:ml-0 font-mono text-xs uppercase flex items-center gap-1.5 hover:text-destructive hover:border-destructive/40 hover:bg-destructive/10"
            >
              <LogOut className="w-3.5 h-3.5 shrink-0" />
              <span>Sign Out</span>
            </Button>
          )}
        </div>
      </div>

      {/* Unverified Email Warning & Resend Banner */}
      {!isEmailVerified && (
        <div className="relative mt-6 pt-5 border-t border-border">
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
        </div>
      )}

      {onSignOut && (
        <ConfirmActionModal
          isOpen={isSignOutModalOpen}
          onClose={() => setIsSignOutModalOpen(false)}
          onConfirm={() => {
            setIsSignOutModalOpen(false);
            void onSignOut();
          }}
          title="Sign Out This Browser"
          heading="Sign out from this browser?"
          description="Only your current browser session will end and local account data will be cleared from this device. Your synced books, notes, and other signed-in devices remain safe."
          confirmLabel="Sign Out This Browser"
          modalTestId="identity-sign-out-modal"
          dialogTestId="identity-sign-out-dialog"
          confirmTestId="confirm-identity-sign-out-button"
          cancelTestId="cancel-identity-sign-out-button"
        />
      )}
    </section>
  );
};
