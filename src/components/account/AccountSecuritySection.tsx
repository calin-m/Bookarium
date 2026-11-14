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
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { ConfirmActionModal } from '@/components/ui/ConfirmActionModal';
import { PasswordStrengthMeter } from '@/components/ui/PasswordStrengthMeter';
import {
  TurnstileWidget,
  getTurnstileSiteKey,
  type TurnstileWidgetHandle,
} from '@/components/auth/TurnstileWidget';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import type { PasswordStrength } from '@/lib/password';
import {
  parseSessionDevice,
  formatSessionIpAddress,
  formatSessionTimestamp,
  type ActiveUserSession,
  type SessionDeviceType,
} from '@/lib/session-device-parser';

function renderDeviceIcon(deviceType: SessionDeviceType) {
  switch (deviceType) {
    case 'mobile':
      return <Smartphone className="w-4 h-4 text-primary shrink-0" />;
    case 'tablet':
      return <Tablet className="w-4 h-4 text-primary shrink-0" />;
    case 'desktop':
      return <Monitor className="w-4 h-4 text-primary shrink-0" />;
    default:
      return <Globe className="w-4 h-4 text-muted-foreground shrink-0" />;
  }
}

type PendingSecurityConfirmAction =
  | { type: 'unlink-google' }
  | {
      type: 'revoke-session';
      session: ActiveUserSession;
      deviceLabel: string;
      maskedIp: string | null;
      lastActive: string;
    }
  | { type: 'sign-out-local' }
  | { type: 'sign-out-others' }
  | { type: 'sign-out-all' };

interface SecurityConfirmModalConfig {
  title: string;
  heading: string;
  description: string;
  confirmLabel: string;
  modalTestId: string;
  dialogTestId: string;
  cancelTestId: string;
  confirmTestId: string;
  preview?: React.ReactNode;
}

function buildSecurityConfirmConfig(
  action: PendingSecurityConfirmAction,
  options: {
    linkedGoogleEmail?: string;
    otherSessionsCount: number;
    isUnlinkingGoogle: boolean;
    isSigningOutScope: 'local' | 'others' | 'global' | null;
  }
): SecurityConfirmModalConfig {
  switch (action.type) {
    case 'unlink-google':
      return {
        title: 'Disconnect Google Sign-In',
        heading: 'Disconnect your Google account?',
        description:
          'You will no longer be able to sign in with Google unless you reconnect it later. You can still access your account with your email and password.',
        confirmLabel: options.isUnlinkingGoogle ? 'Disconnecting...' : 'Disconnect Google',
        modalTestId: 'disconnect-google-modal',
        dialogTestId: 'disconnect-google-dialog',
        cancelTestId: 'cancel-disconnect-google-button',
        confirmTestId: 'confirm-disconnect-google-button',
        preview: options.linkedGoogleEmail ? (
          <div className="mt-2 p-2.5 rounded-lg bg-muted/40 border border-border text-xs font-mono text-foreground truncate">
            Connected Google account: {options.linkedGoogleEmail}
          </div>
        ) : undefined,
      };
    case 'revoke-session':
      return {
        title: 'Revoke Device Session',
        heading: `Revoke access on ${action.deviceLabel}?`,
        description:
          'This device session credential will be revoked immediately. Any open tab on that device will sign out automatically within about a minute or on its next focus, refresh, or reload.',
        confirmLabel: 'Revoke Session',
        modalTestId: 'revoke-session-modal',
        dialogTestId: 'revoke-session-dialog',
        cancelTestId: 'cancel-revoke-session-button',
        confirmTestId: 'confirm-revoke-session-button',
        preview: (
          <div className="mt-2 p-2.5 rounded-lg bg-muted/40 border border-border text-[11px] font-mono text-muted-foreground space-y-0.5">
            <p className="text-foreground font-semibold">{action.deviceLabel}</p>
            <p>
              {action.maskedIp ? `IP: ${action.maskedIp} · ` : ''}
              Last active: {action.lastActive}
            </p>
          </div>
        ),
      };
    case 'sign-out-local':
      return {
        title: 'Sign Out This Browser',
        heading: 'Sign out from this browser?',
        description:
          'Only your current browser session will end and local account data will be cleared from this device. Your synced books, notes, and other signed-in devices remain safe.',
        confirmLabel:
          options.isSigningOutScope === 'local' ? 'Signing out...' : 'Sign Out This Browser',
        modalTestId: 'sign-out-local-modal',
        dialogTestId: 'sign-out-local-dialog',
        cancelTestId: 'cancel-sign-out-local-button',
        confirmTestId: 'confirm-sign-out-local-button',
      };
    case 'sign-out-others':
      return {
        title: 'Sign Out Other Devices',
        heading: 'Sign out from all other devices?',
        description:
          options.otherSessionsCount > 0
            ? `Every other active session (${options.otherSessionsCount} remote ${options.otherSessionsCount === 1 ? 'session' : 'sessions'}) will be revoked while this browser stays signed in. Open tabs on those devices sign out automatically within about a minute or on next focus or reload.`
            : 'Every other browser and device currently signed into your account will have its session revoked while this browser stays signed in.',
        confirmLabel:
          options.isSigningOutScope === 'others'
            ? 'Signing out others...'
            : 'Sign Out Other Devices',
        modalTestId: 'sign-out-others-modal',
        dialogTestId: 'sign-out-others-dialog',
        cancelTestId: 'cancel-sign-out-others-button',
        confirmTestId: 'confirm-sign-out-others-button',
      };
    case 'sign-out-all':
      return {
        title: 'Sign Out All Devices',
        heading: 'End sessions across every browser and device?',
        description:
          'You will be signed out from this browser as well as every other phone, tablet, or desktop currently signed into your account. Any synced cloud data stays safe.',
        confirmLabel:
          options.isSigningOutScope === 'global'
            ? 'Signing out all devices...'
            : 'Sign Out All Devices',
        modalTestId: 'sign-out-all-modal',
        dialogTestId: 'sign-out-all-dialog',
        cancelTestId: 'cancel-sign-out-all-button',
        confirmTestId: 'confirm-sign-out-all-button',
      };
  }
}

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
  onRequestPasswordReset?: (captchaToken?: string) => void | Promise<void>;
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
  sessions?: ActiveUserSession[];
  isLoadingSessions?: boolean;
  hasLoadedSessions?: boolean;
  isSessionsRpcUnavailable?: boolean;
  sessionsError?: string | null;
  sessionsSuccess?: string | null;
  revokingSessionId?: string | null;
  isSigningOutScope?: 'local' | 'others' | 'global' | null;
  isSignOutAllModalOpen?: boolean;
  onOpenSignOutAllModal?: () => void;
  onCloseSignOutAllModal?: () => void;
  onRefreshSessions?: () => Promise<void> | void;
  onRevokeSession?: (session: ActiveUserSession) => Promise<void> | void;
  onSignOutOtherDevices?: () => Promise<void> | void;
  onSignOutAllDevices?: () => Promise<void> | void;
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
  sessions = [],
  isLoadingSessions = false,
  hasLoadedSessions = false,
  isSessionsRpcUnavailable = false,
  sessionsError = null,
  sessionsSuccess = null,
  revokingSessionId = null,
  isSigningOutScope = null,
  isSignOutAllModalOpen,
  onOpenSignOutAllModal,
  onCloseSignOutAllModal,
  onRefreshSessions,
  onRevokeSession,
  onSignOutOtherDevices,
  onSignOutAllDevices,
}) => {
  const { isOffline } = useNetworkStatus();
  const turnstileSiteKey = getTurnstileSiteKey();
  const [isResetCaptchaOpen, setIsResetCaptchaOpen] = React.useState(false);
  const [turnstileError, setTurnstileError] = React.useState<string | null>(null);
  const [pendingConfirmAction, setPendingConfirmAction] =
    React.useState<PendingSecurityConfirmAction | null>(null);
  const turnstileRef = React.useRef<TurnstileWidgetHandle>(null);
  const isSubmittingResetRef = React.useRef(false);

  const parsedSessions = React.useMemo(() => {
    return sessions.map((session) => ({
      session,
      device: parseSessionDevice(session.userAgent),
      maskedIp: formatSessionIpAddress(session.ipAddress),
      lastActive: formatSessionTimestamp(
        session.refreshedAt ?? session.updatedAt ?? session.createdAt
      ),
      signedIn: formatSessionTimestamp(session.createdAt),
    }));
  }, [sessions]);

  const hasDuplicateDeviceFingerprint = React.useMemo(() => {
    if (parsedSessions.length < 2) return false;
    const seen = new Set<string>();
    for (const entry of parsedSessions) {
      const key = `${entry.device.label}::${entry.maskedIp ?? ''}`;
      if (seen.has(key)) return true;
      seen.add(key);
    }
    return false;
  }, [parsedSessions]);

  const otherSessionsCount = sessions.filter((session) => !session.isCurrent).length;
  const activeConfirmAction: PendingSecurityConfirmAction | null =
    isSignOutAllModalOpen && onSignOutAllDevices
      ? { type: 'sign-out-all' }
      : pendingConfirmAction;

  const openSignOutAllModal = () => {
    if (onOpenSignOutAllModal && isSignOutAllModalOpen !== undefined) {
      onOpenSignOutAllModal();
      return;
    }
    setPendingConfirmAction({ type: 'sign-out-all' });
    onOpenSignOutAllModal?.();
  };

  const closeConfirmModal = () => {
    if (activeConfirmAction?.type === 'sign-out-all') {
      onCloseSignOutAllModal?.();
    }
    setPendingConfirmAction(null);
  };

  const executeConfirmAction = () => {
    if (!activeConfirmAction) return;
    const action = activeConfirmAction;
    closeConfirmModal();

    switch (action.type) {
      case 'unlink-google':
        if (!isOffline && canUnlinkGoogle && !isUnlinkingGoogle) {
          onUnlinkGoogle?.();
        }
        break;
      case 'revoke-session':
        if (!isOffline && !isSigningOutScope && revokingSessionId !== action.session.id) {
          void onRevokeSession?.(action.session);
        }
        break;
      case 'sign-out-local':
        if (!isSigningOutScope) {
          void onSignOut();
        }
        break;
      case 'sign-out-others':
        if (!isOffline && !isSigningOutScope) {
          void onSignOutOtherDevices?.();
        }
        break;
      case 'sign-out-all':
        if (!isOffline && !isSigningOutScope) {
          void onSignOutAllDevices?.();
        }
        break;
    }
  };

  const confirmModalConfig = activeConfirmAction
    ? buildSecurityConfirmConfig(activeConfirmAction, {
        linkedGoogleEmail: googleIdentityEmail || userEmail,
        otherSessionsCount,
        isUnlinkingGoogle,
        isSigningOutScope,
      })
    : null;

  const disableSignOutOthers =
    isOffline ||
    Boolean(isSigningOutScope) ||
    (hasLoadedSessions && !isSessionsRpcUnavailable && otherSessionsCount === 0);

  const handleResetButtonClick = () => {
    if (!onRequestPasswordReset) return;
    if (!turnstileSiteKey) {
      void onRequestPasswordReset();
      return;
    }
    setTurnstileError(null);
    isSubmittingResetRef.current = false;
    setIsResetCaptchaOpen((prev) => !prev);
  };

  const handleResetCaptchaToken = async (token: string | null) => {
    if (!token || !onRequestPasswordReset || isSubmittingResetRef.current) return;
    isSubmittingResetRef.current = true;
    setTurnstileError(null);
    try {
      await onRequestPasswordReset(token);
      setIsResetCaptchaOpen(false);
    } finally {
      isSubmittingResetRef.current = false;
      turnstileRef.current?.reset();
    }
  };

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
              <Alert
                variant="info"
                data-testid="password-recovery-banner"
                icon={<Check className="w-3.5 h-3.5 shrink-0" />}
                className="rounded-xl gap-2 animate-in fade-in duration-150"
              >
                Email recovery link verified — enter and confirm your new password below.
              </Alert>
            ) : !hasPasswordIdentity ? (
              <Alert
                variant="info"
                data-testid="oauth-set-password-banner"
                icon={<KeyRound className="w-3.5 h-3.5 shrink-0" />}
                className="rounded-xl gap-2 animate-in fade-in duration-150"
              >
                You signed in with Google. Set a password below if you also want to sign in with email and password.
              </Alert>
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
                      onClick={handleResetButtonClick}
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
                {isResetCaptchaOpen && turnstileSiteKey && (
                  <div
                    data-testid="password-reset-turnstile-panel"
                    className="rounded-xl border border-border bg-muted/40 p-3 space-y-2 animate-in fade-in duration-150"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-mono text-muted-foreground">
                        Complete security check to email your reset link
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsResetCaptchaOpen(false);
                          setTurnstileError(null);
                        }}
                        className="text-[11px] font-mono text-muted-foreground hover:text-foreground underline cursor-pointer shrink-0"
                      >
                        Cancel
                      </button>
                    </div>
                    <TurnstileWidget
                      ref={turnstileRef}
                      active={isResetCaptchaOpen}
                      testId="account-reset-turnstile-widget"
                      onTokenChange={(token) => {
                        void handleResetCaptchaToken(token);
                      }}
                      onLoadError={setTurnstileError}
                      className="flex justify-center"
                    />
                    {turnstileError && (
                      <p className="text-[11px] font-mono text-destructive text-center">
                        {turnstileError}
                      </p>
                    )}
                  </div>
                )}
                {resetEmailSent && (
                  <Alert
                    variant="info"
                    data-testid="password-reset-sent-banner"
                    icon={<Mail className="w-3.5 h-3.5 shrink-0" />}
                    className="p-2.5 gap-2 animate-in fade-in duration-150"
                  >
                    Password reset link sent{userEmail ? ` to ${userEmail}` : ''}! Click the link in your inbox to set a new password without your current password.
                  </Alert>
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
                  onClick={() => setPendingConfirmAction({ type: 'unlink-google' })}
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

          {/* Section 2: Active Device Sessions */}
          <div className="p-5 rounded-xl border border-border bg-muted/20 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-mono font-bold text-foreground uppercase tracking-wider">
                Active Device Sessions
              </p>
              <div className="flex items-center gap-2 min-w-0">
                {userEmail && (
                  <span
                    className="text-[11px] font-mono text-muted-foreground truncate max-w-[170px]"
                    title={userEmail}
                  >
                    {userEmail}
                  </span>
                )}
                {onRefreshSessions && (
                  <button
                    type="button"
                    onClick={() => void onRefreshSessions()}
                    disabled={isOffline || isLoadingSessions}
                    aria-label="Refresh active device sessions"
                    className="p-1.5 rounded-lg border border-border bg-background/80 text-muted-foreground hover:text-foreground disabled:opacity-50 cursor-pointer transition-colors"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isLoadingSessions ? 'animate-spin' : ''}`}
                    />
                  </button>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground font-sans leading-relaxed">
              Sign out from this browser without ending your sessions elsewhere. Your synced bookshelves, bookmarks, and notes remain safely stored in your cloud account while local session data is cleared from this device.
            </p>

            {sessionsError && (
              <Alert variant="error" data-testid="sessions-error-banner" className="rounded-xl text-xs">
                {sessionsError}
              </Alert>
            )}

            {sessionsSuccess && (
              <Alert variant="success" data-testid="sessions-success-banner" className="rounded-xl text-xs">
                {sessionsSuccess}
              </Alert>
            )}

            {isOffline && (
              <Alert variant="info" data-testid="sessions-offline-banner" className="rounded-xl text-xs">
                You are offline. Viewing active devices and ending remote sessions requires an internet connection, though you can still sign out from this browser locally.
              </Alert>
            )}

            {!isOffline && isSessionsRpcUnavailable && (
              <Alert
                variant="info"
                data-testid="sessions-rpc-unavailable-banner"
                className="rounded-xl text-xs"
              >
                Per-device session listing is awaiting database RPC provisioning. You can still sign out other browsers or all devices below.
              </Alert>
            )}

            {!isOffline && !isSessionsRpcUnavailable && isLoadingSessions && sessions.length === 0 && (
              <p
                className="text-xs font-mono text-muted-foreground py-2"
                data-testid="sessions-loading-indicator"
              >
                Loading active device sessions...
              </p>
            )}

            {!isOffline &&
              !isSessionsRpcUnavailable &&
              hasLoadedSessions &&
              !isLoadingSessions &&
              sessions.length === 0 &&
              !sessionsError && (
                <p
                  className="text-xs font-mono text-muted-foreground py-1"
                  data-testid="sessions-empty-indicator"
                >
                  No active remote device records found.
                </p>
              )}

            {!isOffline && !isSessionsRpcUnavailable && sessions.length > 0 && (
              <>
                <ul className="space-y-2" aria-label="Active device sessions">
                  {parsedSessions.map(({ session, device, maskedIp, lastActive, signedIn }) => {
                    const isRevokingThis = revokingSessionId === session.id;

                    return (
                      <li
                        key={session.id}
                        data-testid={`active-session-row-${session.id}`}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 rounded-xl border border-border bg-background/70"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="p-1.5 rounded-lg bg-muted/70 border border-border mt-0.5 shrink-0">
                            {renderDeviceIcon(device.deviceType)}
                          </div>
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-xs font-medium text-foreground truncate">
                                {device.label}
                              </span>
                              {session.isCurrent && (
                                <span
                                  data-testid="current-session-badge"
                                  className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-mono font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                >
                                  This device
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] font-mono text-muted-foreground">
                              {maskedIp && (
                                <span data-testid={`session-ip-${session.id}`}>IP: {maskedIp}</span>
                              )}
                              <span>Last active: {lastActive}</span>
                              <span>Signed in: {signedIn}</span>
                            </div>
                          </div>
                        </div>

                        {!session.isCurrent && onRevokeSession && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              setPendingConfirmAction({
                                type: 'revoke-session',
                                session,
                                deviceLabel: device.label,
                                maskedIp,
                                lastActive,
                              })
                            }
                            disabled={
                              isOffline || isRevokingThis || Boolean(isSigningOutScope)
                            }
                            aria-label={`Revoke session on ${device.label}`}
                            className="shrink-0 font-mono text-[11px] text-muted-foreground hover:text-destructive hover:border-destructive/50 cursor-pointer"
                          >
                            {isRevokingThis ? 'Revoking...' : 'Revoke'}
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {hasDuplicateDeviceFingerprint && (
                  <p
                    className="text-[11px] text-muted-foreground font-sans leading-relaxed"
                    data-testid="sessions-duplicate-hint"
                  >
                    Similar sessions with matching labels and IPs can come from separate browser profiles, incognito windows, different origins, or multiple devices sharing the same network. Check timestamps and the &quot;This device&quot; badge before revoking.
                  </p>
                )}
              </>
            )}

            <div className="pt-1 space-y-2">
              <Button
                variant="outline"
                size="chip"
                onClick={() => setPendingConfirmAction({ type: 'sign-out-local' })}
                disabled={Boolean(isSigningOutScope)}
                className="w-full justify-center text-muted-foreground hover:text-foreground font-mono text-xs cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>
                  {isSigningOutScope === 'local' ? 'Signing out...' : 'Sign Out This Browser'}
                </span>
              </Button>

              {(onSignOutOtherDevices || onSignOutAllDevices) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {onSignOutOtherDevices && (
                    <Button
                      variant="outline"
                      size="chip"
                      onClick={() => setPendingConfirmAction({ type: 'sign-out-others' })}
                      disabled={disableSignOutOthers}
                      className="w-full justify-center text-muted-foreground hover:text-foreground font-mono text-xs cursor-pointer"
                    >
                      <span>
                        {isSigningOutScope === 'others'
                          ? 'Signing out others...'
                          : 'Sign Out Other Devices'}
                      </span>
                    </Button>
                  )}

                  {onSignOutAllDevices && (
                    <Button
                      variant="outline"
                      size="chip"
                      onClick={openSignOutAllModal}
                      disabled={isOffline || Boolean(isSigningOutScope)}
                      className="w-full justify-center border-destructive/40 text-destructive hover:bg-destructive/10 font-mono text-xs cursor-pointer"
                    >
                      <span>
                        {isSigningOutScope === 'global'
                          ? 'Signing out all devices...'
                          : 'Sign Out All Devices'}
                      </span>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          {confirmModalConfig && (
            <ConfirmActionModal
              isOpen={true}
              onClose={closeConfirmModal}
              onConfirm={executeConfirmAction}
              title={confirmModalConfig.title}
              heading={confirmModalConfig.heading}
              description={confirmModalConfig.description}
              confirmLabel={confirmModalConfig.confirmLabel}
              modalTestId={confirmModalConfig.modalTestId}
              dialogTestId={confirmModalConfig.dialogTestId}
              confirmTestId={confirmModalConfig.confirmTestId}
              cancelTestId={confirmModalConfig.cancelTestId}
            >
              {confirmModalConfig.preview}
            </ConfirmActionModal>
          )}

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

