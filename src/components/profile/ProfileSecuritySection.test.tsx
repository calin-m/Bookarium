import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProfileSecuritySection } from './ProfileSecuritySection';

describe('ProfileSecuritySection Component', () => {
  it('renders password fields, strength meter, and actions', () => {
    const handleGenerate = vi.fn();
    const handleToggleShow = vi.fn();
    const handleUpdate = vi.fn((e) => e.preventDefault());
    const handleSignOut = vi.fn();
    const handleOpenDelete = vi.fn();

    render(
      <ProfileSecuritySection
        newPassword="SecretPassword123!"
        confirmPassword="SecretPassword123!"
        showPassword={false}
        copiedPassword={false}
        isUpdatingPassword={false}
        passwordSuccess={true}
        passwordError={null}
        strength={{ score: 3, label: 'Strong', color: 'bg-emerald-500' }}
        onNewPasswordChange={vi.fn()}
        onConfirmPasswordChange={vi.fn()}
        onToggleShowPassword={handleToggleShow}
        onGeneratePassword={handleGenerate}
        onUpdatePassword={handleUpdate}
        onSignOut={handleSignOut}
        onOpenDeleteModal={handleOpenDelete}
      />
    );

    expect(screen.getByText('Security & Password')).toBeInTheDocument();
    expect(screen.getByText('Strong')).toBeInTheDocument();
    expect(screen.getByText('Password successfully updated')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Suggest Strong Password'));
    expect(handleGenerate).toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText('Show password'));
    expect(handleToggleShow).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));
    expect(handleUpdate).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Sign Out' }));
    expect(handleSignOut).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }));
    expect(handleOpenDelete).toHaveBeenCalled();
  });
});

