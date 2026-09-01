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
      />
    );

    expect(screen.getByText('Security & Password')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();

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
});

