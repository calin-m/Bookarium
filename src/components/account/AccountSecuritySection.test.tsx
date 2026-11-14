import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AccountSecuritySection } from './AccountSecuritySection';

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
});

