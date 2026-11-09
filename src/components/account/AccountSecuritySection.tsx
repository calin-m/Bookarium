'use client';

import React from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Check,
  KeyRound,
  LogOut,
  Trash2,
  Mail,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import type { PasswordStrength } from '@/lib/password';

export interface AccountSecuritySectionProps {
  currentPassword?: string;
  newPassword: string;
  confirmPassword: string;
  showPassword: boolean;
  copiedPassword: boolean;
  isUpdatingPassword: boolean;
  passwordSuccess: boolean;
  passwordError: string | null;
  strength: { score: number; label: string; color: string };
  isRecoveryMode?: boolean;
  isSendingResetEmail?: boolean;
  resetEmailSent?: boolean;
  resetEmailError?: string | null;
  resetCooldown?: number;
  onCurrentPasswordChange?: (val: string) => void;
  onNewPasswordChange: (val: string) => void;
  onConfirmPasswordChange: (val: string) => void;
  onToggleShowPassword: () => void;
  onGeneratePassword: () => void;
  onUpdatePassword: (e: React.FormEvent) => void;
  onRequestPasswordReset?: () => void;
  onSignOut: () => Promise<void>;
  onOpenDeleteModal: () => void;
  userEmail?: string;
  hasGoogleIdentity?: boolean;
  hasPasswordIdentity?: boolean;
  canUnlinkGoogle?: boolean;
  googleIdentityEmail?: string;
  isLinkingGoogle?: boolean;
  isUnlinkingGoogle?: boolean;
  identitySuccess?: string | null;
  identityError?: string | null;
  onLinkGoogle?: () => void;
  onUnlinkGoogle?: () => void;
}

export const AccountSecuritySection: React.FC<AccountSecuritySectionProps> = ({
  currentPassword = '',
  newPassword,
  confirmPassword,
  showPassword,
  copiedPassword,
  isUpdatingPassword,
  passwordSuccess,
  passwordError,
  strength,
  isRecoveryMode = false,
  isSendingResetEmail = false,
  resetEmailSent = false,
  resetEmailError = null,
  resetCooldown = 0,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onToggleShowPassword,
  onGeneratePassword,
  onUpdatePassword,
  onRequestPasswordReset,
  onSignOut,
  onOpenDeleteModal,
  userEmail,
  hasGoogleIdentity = false,
  hasPasswordIdentity = true,
  canUnlinkGoogle = false,
  googleIdentityEmail,
  isLinkingGoogle = false,
  isUnlinkingGoogle = false,
  identitySuccess = null,
  identityError = null,
  onLinkGoogle,
  onUnlinkGoogle,
}) => {
  const { isOffline } = useNetworkStatus();
  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 lg:p-7 shadow-booksaw space-y-6">
      {/* Master Card Header */}
      <div className="flex items-center gap-3 border-b border-border pb-4">
        <div className="p-2 rounded-xl bg-primary/10 text-primary border border-border shrink-0">
          <Lock className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-mono uppercase tracking-wider text-muted-foreground font-bold">
            Security & Password
          </h2>
          <p className="text-xs text-muted-foreground font-sans">
            Update your account password credentials, manage active browser sessions, and review account actions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column (7 cols): Password Form */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider text-foreground font-bold">
              {hasPasswordIdentity ? 'Update Account Password' : 'Set Account Password'}
            </h3>
            <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap">
              Minimum 6 characters
            </span>
          </div>

          <form onSubmit={onUpdatePassword} className="space-y-4">
            {isRecoveryMode ? (
              <div
                data-testid="password-recovery-banner"
                role="status"
                className="p-3 rounded-xl bg-primary/10 border border-border flex items-center gap-2 text-xs font-mono text-primary animate-in fade-in duration-150"
              >
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Email recovery link verified — enter and confirm your new password below.
                </span>
              </div>
            ) : !hasPasswordIdentity ? (
              <div
                data-testid="oauth-set-password-banner"
                role="status"
                className="p-3 rounded-xl bg-primary/10 border border-border flex items-center gap-2 text-xs font-mono text-primary animate-in fade-in duration-150"
              >
                <KeyRound className="w-3.5 h-3.5 shrink-0" />
                <span>
                  You signed in with Google. Set a password below if you also want to sign in with email and password.
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2 min-h-[1.5rem]">
                  <label
                    htmlFor="current-password"
                    className="text-xs font-mono text-foreground font-bold whitespace-nowrap"
                  >
                    Current Password
                  </label>
                  {onRequestPasswordReset && (
                    <button
                      type="button"
                      onClick={onRequestPasswordReset}
                      disabled={isOffline || isSendingResetEmail || resetCooldown > 0}
                      className="text-[11px] font-mono text-primary hover:underline disabled:opacity-50 disabled:no-underline flex items-center gap-1 whitespace-nowrap cursor-pointer select-none focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary rounded"
                    >
                      <Mail className="w-3 h-3 shrink-0" />
                      <span>
                        {isSendingResetEmail
                          ? 'Sending Reset Link...'
                          : resetCooldown > 0
                            ? `Resend Reset Link (${resetCooldown}s)`
                            : 'Forgot current password? Send reset link'}
                      </span>
                    </button>
                  )}
                </div>
                <Input
                  id="current-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => onCurrentPasswordChange?.(e.target.value)}
                  placeholder="Enter your current password"
                  className="text-xs font-mono"
                />
                {resetEmailSent && (
                  <div
                    data-testid="password-reset-sent-banner"
                    role="status"
                    className="p-2.5 rounded-lg bg-primary/10 border border-border flex items-center gap-2 text-xs font-mono text-primary animate-in fade-in duration-150"
                  >
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Password reset link sent{userEmail ? ` to ${userEmail}` : ''}! Click the link in your inbox to set a new password without your current password.
                    </span>
                  </div>
                )}
                {resetEmailError && (
                  <p className="text-xs font-mono text-destructive flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{resetEmailError}</span>
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 min-h-[1.5rem]">
                  <label htmlFor="new-password" className="text-xs font-mono text-foreground font-bold whitespace-nowrap">
                    New Password
                  </label>
                  <button
                    type="button"
                    onClick={onGeneratePassword}
                    className="text-[11px] font-mono text-primary hover:underline flex items-center gap-1 whitespace-nowrap cursor-pointer select-none focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary rounded"
                  >
                    <KeyRound className="w-3 h-3 shrink-0" />
                    <span>Suggest Strong Password</span>
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => onNewPasswordChange(e.target.value)}
                    placeholder="At least 6 characters"
                    className="text-xs font-mono pr-9"
                    required
                  />
                  <button
                    type="button"
                    onClick={onToggleShowPassword}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary rounded p-0.5"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between min-h-[1.5rem]">
                  <label htmlFor="confirm-password" className="text-xs font-mono text-foreground font-bold">
                    Confirm New Password
                  </label>
                </div>
                <Input
                  id="confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => onConfirmPasswordChange(e.target.value)}
                  placeholder="Repeat new password"
                  className="text-xs font-mono"
                  required
                />
              </div>
            </div>

            {/* Password Generator Feedback Pill */}
            {copiedPassword && (
              <div className="p-2.5 rounded-lg bg-primary/10 border border-border flex items-center gap-2 text-xs font-mono text-primary animate-in fade-in duration-150">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>Generated high-entropy password auto-filled and copied to clipboard!</span>
              </div>
            )}

            {/* Live Password Strength Meter */}
            {newPassword.length > 0 && (
              <div className="pt-1">
                <PasswordStrengthMeter strength={strength as PasswordStrength} />
              </div>
            )}

            {passwordError && (
              <p className="text-xs font-mono text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{passwordError}</span>
              </p>
            )}

            <div className="flex items-center gap-3 pt-2">
              <Button
                type="submit"
                variant="primary"
                size="chip"
                isLoading={isUpdatingPassword}
                disabled={isOffline || !newPassword || !confirmPassword}
                aria-label={hasPasswordIdentity ? 'Update Password' : 'Set Password'}
              >
                <Check className="w-3.5 h-3.5" />
                <span>{hasPasswordIdentity ? 'Update Password' : 'Set Password'}</span>
              </Button>
              {passwordSuccess && (
                <span className="inline-flex items-center gap-1 text-xs font-mono text-success animate-in fade-in duration-150">
                  <Check className="w-3.5 h-3.5" />
                  <span>Password successfully updated</span>
                </span>
              )}
            </div>
            {isOffline && (
              <p
                data-testid="security-offline-hint"
                className="text-xs font-mono text-muted-foreground"
              >
                Password updates and account deletion require an active internet connection.
              </p>
            )}
          </form>
        </div>

        {/* Right Column (5 cols): Connected Accounts, Active Device Session & Quarantined Danger Zone */}
        <div className="lg:col-span-5 space-y-6 lg:border-l lg:border-border lg:pl-8">
          {/* Section 1.5: Connected Sign-In Providers */}
          <div
            data-testid="connected-accounts-card"
            className="p-5 rounded-xl border border-border bg-muted/20 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">
                Connected Accounts
              </p>
              <span
                className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  hasGoogleIdentity
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-muted text-muted-foreground border-border'
                }`}
              >
                {hasGoogleIdentity ? 'Google Connected' : 'Not Connected'}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="flex items-center gap-2.5 min-w-0">
                <svg
                  className="w-4 h-4 shrink-0"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                <div className="min-w-0">
                  <p className="text-xs font-mono font-bold text-foreground">Google</p>
                  <p className="text-[11px] font-sans text-muted-foreground truncate">
                    {hasGoogleIdentity
                      ? googleIdentityEmail || userEmail || 'Linked for 1-click sign-in'
                      : 'Link your Google account for 1-click sign-in'}
                  </p>
                </div>
              </div>

              {hasGoogleIdentity ? (
                <Button
                  type="button"
                  variant="outline"
                  size="chip"
                  isLoading={isUnlinkingGoogle}
                  disabled={isOffline || isUnlinkingGoogle || !canUnlinkGoogle}
                  onClick={onUnlinkGoogle}
                  data-testid="disconnect-google-button"
                  className="shrink-0 font-mono text-xs cursor-pointer"
                >
                  <span>Disconnect</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="chip"
                  isLoading={isLinkingGoogle}
                  disabled={isOffline || isLinkingGoogle}
                  onClick={onLinkGoogle}
                  data-testid="connect-google-button"
                  className="shrink-0 font-mono text-xs cursor-pointer"
                >
                  <span>Connect Google</span>
                </Button>
              )}
            </div>

            {hasGoogleIdentity && !canUnlinkGoogle && (
              <p
                data-testid="google-unlink-lockout-hint"
                className="text-[11px] font-mono text-muted-foreground leading-relaxed"
              >
                Set an account password first before disconnecting Google so you keep access to your account.
              </p>
            )}

            {identitySuccess && (
              <p
                role="status"
                className="text-xs font-mono text-success flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{identitySuccess}</span>
              </p>
            )}

            {identityError && (
              <p className="text-xs font-mono text-destructive flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{identityError}</span>
              </p>
            )}
          </div>

          {/* Section 2: Active Device Session */}
          <div className="p-5 rounded-xl border border-border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">
                Active Device Session
              </p>
              {userEmail && (
                <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[170px]" title={userEmail}>
                  {userEmail}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed">
              Sign out from this browser. Your synced bookshelves, bookmarks, and notes remain safely stored in your cloud account while local session data is cleared from this device.
            </p>
            <div className="pt-1">
              <Button
                variant="outline"
                size="chip"
                onClick={onSignOut}
                className="w-full justify-center text-muted-foreground hover:text-foreground font-mono text-xs cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </Button>
            </div>
          </div>

          {/* Section 3: Danger Zone (Framed Inset Callout) */}
          <div className="rounded-xl border border-destructive/40 dark:border-destructive/50 bg-destructive/5 p-5 space-y-3">
            <div className="flex items-center gap-2 text-destructive font-mono text-xs font-bold uppercase tracking-wider">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Danger Zone: Delete Account</span>
            </div>

            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Permanent Account Deletion</p>
              <p className="text-xs text-muted-foreground font-sans leading-relaxed">
                Deleting your account permanently purges your profile, custom bookshelves, favorites, reading progress, annotations, reading streaks, accolades, and Reader Circle &amp; Symposium connections. Requires email link verification.
              </p>
            </div>

            <div className="pt-1">
              <Button
                variant="outline"
                size="chip"
                onClick={onOpenDeleteModal}
                disabled={isOffline}
                className="w-full justify-center border-destructive/50 dark:border-destructive/60 text-destructive hover:bg-destructive/10 font-mono text-xs cursor-pointer"
                aria-label="Delete Account"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Account</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

