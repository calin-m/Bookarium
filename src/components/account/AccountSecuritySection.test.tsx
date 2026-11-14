import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccountSecuritySection } from './AccountSecuritySection';
import type { ActiveUserSession } from '@/lib/session-device-parser';

describe('AccountSecuritySection', () => {
  it('renders password fields, strength meter, and buttons', () => {
    const handleNewPasswordChange = vi.fn();
    const handleConfirmPasswordChange = vi.fn();
    const handleToggleShowPassword = vi.fn();
    const handleGeneratePassword = vi.fn();
    const handleUpdatePassword = vi.fn((e) => e.preventDefault());
    const handleSignOut = vi.fn();
    const handleOpenDeleteModal = vi.fn();

    render(
      <AccountSecuritySection
        newPassword="password123"
        confirmPassword="password123"
        showPassword={false}
        copiedPassword={false}
        isUpdatingPassword={false}
        passwordSuccess={false}
        passwordError={null}
        strength={{ score: 2, label: 'Moderate', color: 'bg-amber-500' }}
        onNewPasswordChange={handleNewPasswordChange}
        onConfirmPasswordChange={handleConfirmPasswordChange}
        onToggleShowPassword={handleToggleShowPassword}
        onGeneratePassword={handleGeneratePassword}
        onUpdatePassword={handleUpdatePassword}
        onSignOut={handleSignOut}
        onOpenDeleteModal={handleOpenDeleteModal}
        userEmail="scholar@bookarium.test"
      />
    );

    expect(screen.getByText('Security & Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Current Password')).toBeInTheDocument();
    expect(screen.getByText('scholar@bookarium.test')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(
      screen.getByText(/remain safely stored in your cloud account while local session data is cleared/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/accolades, and Reader Circle & Symposium connections/i)).toBeInTheDocument();

    const generateBtn = screen.getByRole('button', { name: /Suggest Strong Password/i });
    fireEvent.click(generateBtn);
    expect(handleGeneratePassword).toHaveBeenCalled();

    const updateBtn = screen.getByRole('button', { name: /Update Password/i });
    fireEvent.click(updateBtn);
    expect(handleUpdatePassword).toHaveBeenCalled();

    const deleteBtn = screen.getByRole('button', { name: /Delete Account/i });
    fireEvent.click(deleteBtn);
    expect(handleOpenDeleteModal).toHaveBeenCalled();
  });

  it('renders forgot-password email trigger, confirmation banner, and recovery mode state', () => {
    const handleRequestPasswordReset = vi.fn();
    const handleCurrentPasswordChange = vi.fn();

    const { rerender } = render(
      <AccountSecuritySection
        currentPassword=""
        newPassword="password123"
        confirmPassword="password123"
        showPassword={false}
        copiedPassword={false}
        isUpdatingPassword={false}
        passwordSuccess={false}
        passwordError={null}
        strength={{ score: 2, label: 'Moderate', color: 'bg-amber-500' }}
        isRecoveryMode={false}
        resetEmailSent={true}
        resetCooldown={45}
        onCurrentPasswordChange={handleCurrentPasswordChange}
        onNewPasswordChange={vi.fn()}
        onConfirmPasswordChange={vi.fn()}
        onToggleShowPassword={vi.fn()}
        onGeneratePassword={vi.fn()}
        onUpdatePassword={vi.fn()}
        onRequestPasswordReset={handleRequestPasswordReset}
        onSignOut={vi.fn()}
        onOpenDeleteModal={vi.fn()}
        userEmail="scholar@bookarium.test"
      />
    );

    expect(screen.getByTestId('password-reset-sent-banner')).toHaveTextContent(
      /Password reset link sent to scholar@bookarium.test/i
    );
    expect(screen.getByRole('button', { name: /Resend Reset Link \(45s\)/i })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Current Password'), {
      target: { value: 'oldSecret' },
    });
    expect(handleCurrentPasswordChange).toHaveBeenCalledWith('oldSecret');

    // Recovery mode hides Current Password and shows recovery banner
    rerender(
      <AccountSecuritySection
        currentPassword=""
        newPassword="password123"
        confirmPassword="password123"
        showPassword={false}
        copiedPassword={false}
        isUpdatingPassword={false}
        passwordSuccess={false}
        passwordError={null}
        strength={{ score: 2, label: 'Moderate', color: 'bg-amber-500' }}
        isRecoveryMode={true}
        onNewPasswordChange={vi.fn()}
        onConfirmPasswordChange={vi.fn()}
        onToggleShowPassword={vi.fn()}
        onGeneratePassword={vi.fn()}
        onUpdatePassword={vi.fn()}
        onSignOut={vi.fn()}
        onOpenDeleteModal={vi.fn()}
        userEmail="scholar@bookarium.test"
      />
    );

    expect(screen.queryByLabelText('Current Password')).not.toBeInTheDocument();
    expect(screen.getByTestId('password-recovery-banner')).toHaveTextContent(
      /Email recovery link verified — enter and confirm your new password below/i
    );
  });

  it('disables Update Password and Delete Account buttons when offline', () => {
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });

    try {
      render(
        <AccountSecuritySection
          newPassword="password123"
          confirmPassword="password123"
          showPassword={false}
          copiedPassword={false}
          isUpdatingPassword={false}
          passwordSuccess={false}
          passwordError={null}
          strength={{ score: 2, label: 'Moderate', color: 'bg-amber-500' }}
          onNewPasswordChange={vi.fn()}
          onConfirmPasswordChange={vi.fn()}
          onToggleShowPassword={vi.fn()}
          onGeneratePassword={vi.fn()}
          onUpdatePassword={vi.fn()}
          onSignOut={vi.fn()}
          onOpenDeleteModal={vi.fn()}
          userEmail="scholar@bookarium.test"
        />
      );

      expect(screen.getByRole('button', { name: /Update Password/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Delete Account/i })).toBeDisabled();
      expect(screen.getByTestId('security-offline-hint')).toHaveTextContent(
        /Password updates and account deletion require an active internet connection/i
      );
    } finally {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: originalOnLine });
    }
  });

  it('renders Connected Accounts card with Connect Google, Google-only Set Account Password mode, and Disconnect when dual-linked', () => {
    const onLinkGoogle = vi.fn();
    const onUnlinkGoogle = vi.fn();

    const { rerender } = render(
      <AccountSecuritySection
        newPassword=""
        confirmPassword=""
        showPassword={false}
        copiedPassword={false}
        isUpdatingPassword={false}
        passwordSuccess={false}
        passwordError={null}
        strength={{ score: 0, label: 'Weak', color: 'bg-destructive' }}
        onNewPasswordChange={vi.fn()}
        onConfirmPasswordChange={vi.fn()}
        onToggleShowPassword={vi.fn()}
        onGeneratePassword={vi.fn()}
        onUpdatePassword={vi.fn()}
        onSignOut={vi.fn()}
        onOpenDeleteModal={vi.fn()}
        userEmail="scholar@bookarium.test"
        hasGoogleIdentity={false}
        hasPasswordIdentity={true}
        canUnlinkGoogle={false}
        onLinkGoogle={onLinkGoogle}
        onUnlinkGoogle={onUnlinkGoogle}
      />
    );

    // 1. Email-only user: shows Connect Google
    expect(screen.getByTestId('connected-accounts-card')).toBeInTheDocument();
    const connectBtn = screen.getByTestId('connect-google-button');
    expect(connectBtn).toHaveTextContent('Connect Google');
    fireEvent.click(connectBtn);
    expect(onLinkGoogle).toHaveBeenCalledTimes(1);

    // 2. Google-only user (!hasPasswordIdentity): shows Set Account Password banner, hides Current Password, disables Disconnect
    rerender(
      <AccountSecuritySection
        newPassword="password123"
        confirmPassword="password123"
        showPassword={false}
        copiedPassword={false}
        isUpdatingPassword={false}
        passwordSuccess={false}
        passwordError={null}
        strength={{ score: 2, label: 'Moderate', color: 'bg-amber-500' }}
        onNewPasswordChange={vi.fn()}
        onConfirmPasswordChange={vi.fn()}
        onToggleShowPassword={vi.fn()}
        onGeneratePassword={vi.fn()}
        onUpdatePassword={vi.fn()}
        onSignOut={vi.fn()}
        onOpenDeleteModal={vi.fn()}
        userEmail="scholar@gmail.com"
        hasGoogleIdentity={true}
        hasPasswordIdentity={false}
        canUnlinkGoogle={false}
        googleIdentityEmail="scholar@gmail.com"
        onLinkGoogle={onLinkGoogle}
        onUnlinkGoogle={onUnlinkGoogle}
      />
    );

    expect(screen.getByText('Set Account Password')).toBeInTheDocument();
    expect(screen.getByTestId('oauth-set-password-banner')).toHaveTextContent(
      /You signed in with Google\. Set a password below/i
    );
    expect(screen.queryByLabelText('Current Password')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Set Password' })).toBeInTheDocument();
    expect(screen.getByTestId('disconnect-google-button')).toBeDisabled();
    expect(screen.getByTestId('google-unlink-lockout-hint')).toHaveTextContent(
      /Set an account password first before disconnecting Google/i
    );

    // 3. Dual-linked user (canUnlinkGoogle = true): Disconnect button enabled & displays status messages
    rerender(
      <AccountSecuritySection
        newPassword=""
        confirmPassword=""
        showPassword={false}
        copiedPassword={false}
        isUpdatingPassword={false}
        passwordSuccess={false}
        passwordError={null}
        strength={{ score: 0, label: 'Weak', color: 'bg-destructive' }}
        onNewPasswordChange={vi.fn()}
        onConfirmPasswordChange={vi.fn()}
        onToggleShowPassword={vi.fn()}
        onGeneratePassword={vi.fn()}
        onUpdatePassword={vi.fn()}
        onSignOut={vi.fn()}
        onOpenDeleteModal={vi.fn()}
        userEmail="scholar@gmail.com"
        hasGoogleIdentity={true}
        hasPasswordIdentity={true}
        canUnlinkGoogle={true}
        googleIdentityEmail="scholar@gmail.com"
        identitySuccess="Google account disconnected."
        identityError="Sample error"
        onLinkGoogle={onLinkGoogle}
        onUnlinkGoogle={onUnlinkGoogle}
      />
    );

    const disconnectBtn = screen.getByTestId('disconnect-google-button');
    expect(disconnectBtn).not.toBeDisabled();
    fireEvent.click(disconnectBtn);
    const disconnectDialog = screen.getByTestId('disconnect-google-dialog');
    expect(
      within(disconnectDialog).getByText(/Disconnect your Google account\?/i)
    ).toBeInTheDocument();
    expect(
      within(disconnectDialog).getByText(/Connected Google account: scholar@gmail\.com/i)
    ).toBeInTheDocument();
    fireEvent.click(within(disconnectDialog).getByTestId('cancel-disconnect-google-button'));
    expect(onUnlinkGoogle).not.toHaveBeenCalled();

    fireEvent.click(disconnectBtn);
    fireEvent.click(screen.getByTestId('confirm-disconnect-google-button'));
    expect(onUnlinkGoogle).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Google account disconnected.')).toBeInTheDocument();
    expect(screen.getByText('Sample error')).toBeInTheDocument();
  });

  it('reveals inline Turnstile challenge before requesting password reset when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set', async () => {
    const prevKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '0x4AAAAAAATestKey';

    let capturedOptions: {
      callback?: (token: string) => void;
      'error-callback'?: () => void;
    } = {};
    window.turnstile = {
      render: vi.fn((_el: HTMLElement, opts: typeof capturedOptions) => {
        capturedOptions = opts;
        return 'acct-reset-widget';
      }),
      reset: vi.fn(),
      remove: vi.fn(),
    };

    const handleRequestPasswordReset = vi.fn().mockResolvedValue(undefined);

    try {
      render(
        <AccountSecuritySection
          currentPassword=""
          newPassword=""
          confirmPassword=""
          showPassword={false}
          copiedPassword={false}
          isUpdatingPassword={false}
          passwordSuccess={false}
          passwordError={null}
          strength={{ score: 0, label: 'Weak', color: 'bg-destructive' }}
          onCurrentPasswordChange={vi.fn()}
          onNewPasswordChange={vi.fn()}
          onConfirmPasswordChange={vi.fn()}
          onToggleShowPassword={vi.fn()}
          onGeneratePassword={vi.fn()}
          onUpdatePassword={vi.fn()}
          onRequestPasswordReset={handleRequestPasswordReset}
          onSignOut={vi.fn()}
          onOpenDeleteModal={vi.fn()}
          userEmail="scholar@bookarium.test"
        />
      );

      // Hidden until clicked
      expect(screen.queryByTestId('password-reset-turnstile-panel')).not.toBeInTheDocument();

      fireEvent.click(
        screen.getByRole('button', { name: /Forgot current password\? Send reset link/i })
      );
      expect(screen.getByTestId('password-reset-turnstile-panel')).toBeInTheDocument();
      expect(screen.getByTestId('account-reset-turnstile-widget')).toBeInTheDocument();
      expect(handleRequestPasswordReset).not.toHaveBeenCalled();

      // Surface widget error cleanly without calling handler
      act(() => {
        capturedOptions['error-callback']?.();
      });
      expect(
        await screen.findByText(/Security verification failed to load or verify/i)
      ).toBeInTheDocument();

      // Cancel dismisses inline challenge
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByTestId('password-reset-turnstile-panel')).not.toBeInTheDocument();

      // Reopen and emit valid token
      fireEvent.click(
        screen.getByRole('button', { name: /Forgot current password\? Send reset link/i })
      );
      act(() => {
        capturedOptions.callback?.('account-reset-token-123');
      });
      await waitFor(() => {
        expect(handleRequestPasswordReset).toHaveBeenCalledWith('account-reset-token-123');
      });
    } finally {
      if (prevKey === undefined) {
        delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
      } else {
        process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = prevKey;
      }
      delete window.turnstile;
    }
  });

  it('renders active device sessions with masked IP, Revoke controls, and confirmed Sign Out All Devices dialog', () => {
    const activeSessions: ActiveUserSession[] = [
      {
        id: 'sess-local',
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
        ipAddress: '203.0.113.x',
        createdAt: '2026-11-14T10:00:00Z',
        updatedAt: '2026-11-14T10:15:00Z',
        refreshedAt: '2026-11-14T10:30:00Z',
        notAfter: null,
        isCurrent: true,
      },
      {
        id: 'sess-iphone',
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/604.1',
        ipAddress: '198.51.100.x',
        createdAt: '2026-11-13T08:00:00Z',
        updatedAt: '2026-11-13T08:00:00Z',
        refreshedAt: null,
        notAfter: null,
        isCurrent: false,
      },
    ];

    const handleSignOut = vi.fn().mockResolvedValue(undefined);
    const handleRevokeSession = vi.fn().mockResolvedValue(undefined);
    const handleSignOutOtherDevices = vi.fn().mockResolvedValue(undefined);
    const handleSignOutAllDevices = vi.fn().mockResolvedValue(undefined);
    const handleRefreshSessions = vi.fn().mockResolvedValue(undefined);

    const { rerender } = render(
      <AccountSecuritySection
        newPassword=""
        confirmPassword=""
        showPassword={false}
        copiedPassword={false}
        isUpdatingPassword={false}
        passwordSuccess={false}
        passwordError={null}
        strength={{ score: 0, label: 'Weak', color: 'bg-destructive' }}
        onNewPasswordChange={vi.fn()}
        onConfirmPasswordChange={vi.fn()}
        onToggleShowPassword={vi.fn()}
        onGeneratePassword={vi.fn()}
        onUpdatePassword={vi.fn()}
        onSignOut={handleSignOut}
        onOpenDeleteModal={vi.fn()}
        userEmail="scholar@bookarium.test"
        sessions={activeSessions}
        hasLoadedSessions
        onRefreshSessions={handleRefreshSessions}
        onRevokeSession={handleRevokeSession}
        onSignOutOtherDevices={handleSignOutOtherDevices}
        onSignOutAllDevices={handleSignOutAllDevices}
      />
    );

    expect(screen.getByText('Active Device Sessions')).toBeInTheDocument();
    expect(screen.getByText('Chrome on Windows')).toBeInTheDocument();
    expect(screen.getByText('Safari on iOS')).toBeInTheDocument();
    expect(screen.getByTestId('current-session-badge')).toHaveTextContent('This device');
    expect(screen.getByTestId('session-ip-sess-local')).toHaveTextContent('IP: 203.0.113.x');
    expect(screen.getByTestId('session-ip-sess-iphone')).toHaveTextContent('IP: 198.51.100.x');

    // Only remote sessions have a Revoke button; requires confirmation showing device & masked IP
    const revokeBtns = screen.getAllByRole('button', { name: /Revoke session/i });
    expect(revokeBtns).toHaveLength(1);
    fireEvent.click(revokeBtns[0]);
    const revokeDialog = screen.getByTestId('revoke-session-dialog');
    expect(within(revokeDialog).getByText(/Revoke access on Safari on iOS\?/i)).toBeInTheDocument();
    expect(within(revokeDialog).getByText(/198\.51\.100\.x/)).toBeInTheDocument();
    fireEvent.click(within(revokeDialog).getByTestId('cancel-revoke-session-button'));
    expect(handleRevokeSession).not.toHaveBeenCalled();

    fireEvent.click(revokeBtns[0]);
    fireEvent.click(screen.getByTestId('confirm-revoke-session-button'));
    expect(handleRevokeSession).toHaveBeenCalledWith(activeSessions[1]);

    // Refresh sessions & confirmed Sign Out Other Devices
    fireEvent.click(screen.getByRole('button', { name: /Refresh active device sessions/i }));
    expect(handleRefreshSessions).toHaveBeenCalledTimes(1);

    const otherBtn = screen.getByRole('button', { name: /Sign Out Other Devices/i });
    expect(otherBtn).not.toBeDisabled();
    fireEvent.click(otherBtn);
    const othersDialog = screen.getByTestId('sign-out-others-dialog');
    expect(
      within(othersDialog).getByText(/Sign out from all other devices\?/i)
    ).toBeInTheDocument();
    expect(within(othersDialog).getByText(/1 remote session/i)).toBeInTheDocument();
    fireEvent.click(within(othersDialog).getByTestId('cancel-sign-out-others-button'));
    expect(handleSignOutOtherDevices).not.toHaveBeenCalled();

    fireEvent.click(otherBtn);
    fireEvent.click(screen.getByTestId('confirm-sign-out-others-button'));
    expect(handleSignOutOtherDevices).toHaveBeenCalledTimes(1);

    // Local sign out requires confirmation first
    const localBtn = screen.getByRole('button', { name: /Sign Out This Browser/i });
    fireEvent.click(localBtn);
    const localDialog = screen.getByTestId('sign-out-local-dialog');
    expect(
      within(localDialog).getByText(/Sign out from this browser\?/i)
    ).toBeInTheDocument();
    fireEvent.click(within(localDialog).getByTestId('cancel-sign-out-local-button'));
    expect(handleSignOut).not.toHaveBeenCalled();

    fireEvent.click(localBtn);
    fireEvent.click(screen.getByTestId('confirm-sign-out-local-button'));
    expect(handleSignOut).toHaveBeenCalledTimes(1);

    // Sign Out All Devices opens confirmation modal first; Cancel does not execute global sign out
    fireEvent.click(screen.getByRole('button', { name: /Sign Out All Devices/i }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(/End sessions across every browser and device/i)
    ).toBeInTheDocument();
    fireEvent.click(within(dialog).getByTestId('cancel-sign-out-all-button'));
    expect(handleSignOutAllDevices).not.toHaveBeenCalled();

    // Confirming invokes onSignOutAllDevices
    fireEvent.click(screen.getByRole('button', { name: /Sign Out All Devices/i }));
    const reopenedDialog = screen.getByRole('dialog');
    fireEvent.click(within(reopenedDialog).getByTestId('confirm-sign-out-all-button'));
    expect(handleSignOutAllDevices).toHaveBeenCalledTimes(1);

    // Disables Sign Out Other Devices when only current session exists, and shows RPC fallback when unavailable
    rerender(
      <AccountSecuritySection
        newPassword=""
        confirmPassword=""
        showPassword={false}
        copiedPassword={false}
        isUpdatingPassword={false}
        passwordSuccess={false}
        passwordError={null}
        strength={{ score: 0, label: 'Weak', color: 'bg-destructive' }}
        onNewPasswordChange={vi.fn()}
        onConfirmPasswordChange={vi.fn()}
        onToggleShowPassword={vi.fn()}
        onGeneratePassword={vi.fn()}
        onUpdatePassword={vi.fn()}
        onSignOut={handleSignOut}
        onOpenDeleteModal={vi.fn()}
        userEmail="scholar@bookarium.test"
        sessions={[activeSessions[0]]}
        hasLoadedSessions
        onSignOutOtherDevices={handleSignOutOtherDevices}
        onSignOutAllDevices={handleSignOutAllDevices}
      />
    );
    expect(screen.getByRole('button', { name: /Sign Out Other Devices/i })).toBeDisabled();

    rerender(
      <AccountSecuritySection
        newPassword=""
        confirmPassword=""
        showPassword={false}
        copiedPassword={false}
        isUpdatingPassword={false}
        passwordSuccess={false}
        passwordError={null}
        strength={{ score: 0, label: 'Weak', color: 'bg-destructive' }}
        onNewPasswordChange={vi.fn()}
        onConfirmPasswordChange={vi.fn()}
        onToggleShowPassword={vi.fn()}
        onGeneratePassword={vi.fn()}
        onUpdatePassword={vi.fn()}
        onSignOut={handleSignOut}
        onOpenDeleteModal={vi.fn()}
        userEmail="scholar@bookarium.test"
        sessions={[]}
        hasLoadedSessions
        isSessionsRpcUnavailable
        onSignOutOtherDevices={handleSignOutOtherDevices}
        onSignOutAllDevices={handleSignOutAllDevices}
      />
    );
    expect(screen.getByTestId('sessions-rpc-unavailable-banner')).toBeInTheDocument();
    const fallbackOthersBtn = screen.getByRole('button', { name: /Sign Out Other Devices/i });
    expect(fallbackOthersBtn).not.toBeDisabled();
    fireEvent.click(fallbackOthersBtn);
    expect(
      screen.getByText(/Every other browser and device currently signed into your account/i)
    ).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('cancel-sign-out-others-button'));
  });

  it('allows confirmed local sign-out offline while disabling remote session and Google disconnect actions', () => {
    const originalOnLine = navigator.onLine;
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const handleSignOut = vi.fn().mockResolvedValue(undefined);
    const handleSignOutOtherDevices = vi.fn().mockResolvedValue(undefined);
    const handleSignOutAllDevices = vi.fn().mockResolvedValue(undefined);
    const handleUnlinkGoogle = vi.fn();

    try {
      render(
        <AccountSecuritySection
          newPassword=""
          confirmPassword=""
          showPassword={false}
          copiedPassword={false}
          isUpdatingPassword={false}
          passwordSuccess={false}
          passwordError={null}
          strength={{ score: 0, label: 'Weak', color: 'bg-destructive' }}
          onNewPasswordChange={vi.fn()}
          onConfirmPasswordChange={vi.fn()}
          onToggleShowPassword={vi.fn()}
          onGeneratePassword={vi.fn()}
          onUpdatePassword={vi.fn()}
          onSignOut={handleSignOut}
          onOpenDeleteModal={vi.fn()}
          userEmail="scholar@bookarium.test"
          hasGoogleIdentity
          hasPasswordIdentity
          canUnlinkGoogle
          onUnlinkGoogle={handleUnlinkGoogle}
          onSignOutOtherDevices={handleSignOutOtherDevices}
          onSignOutAllDevices={handleSignOutAllDevices}
        />
      );

      expect(screen.getByTestId('sessions-offline-banner')).toBeInTheDocument();
      expect(screen.getByTestId('disconnect-google-button')).toBeDisabled();
      expect(screen.getByRole('button', { name: /Sign Out Other Devices/i })).toBeDisabled();
      expect(screen.getByRole('button', { name: /Sign Out All Devices/i })).toBeDisabled();

      const localBtn = screen.getByRole('button', { name: /Sign Out This Browser/i });
      expect(localBtn).not.toBeDisabled();
      fireEvent.click(localBtn);
      expect(screen.getByTestId('sign-out-local-dialog')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('confirm-sign-out-local-button'));
      expect(handleSignOut).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: originalOnLine });
    }
  });
});

