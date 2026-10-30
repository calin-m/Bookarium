import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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
});

