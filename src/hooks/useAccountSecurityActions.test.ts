import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAccountSecurityActions } from './useAccountSecurityActions';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database.types';

describe('useAccountSecurityActions', () => {
  const mockUser = {
    id: 'user-1',
    email: 'scholar@bookarium.test',
    user_metadata: { display_name: 'Initial Scholar' },
  } as unknown as User;

  const mockProfile = {
    id: 'user-1',
    display_name: 'Dr. Scholar',
  } as unknown as Profile;

  it('manages profile display name updates, password validation/updates, verification resend, and account deletion state', async () => {
    const updateProfile = vi.fn().mockResolvedValue({ error: null });
    const updatePassword = vi.fn().mockResolvedValue({ error: null });
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    const requestAccountDeletion = vi.fn().mockResolvedValue({ error: null });
    const resendVerificationEmail = vi.fn().mockResolvedValue({ error: null });
    const onClearRecoveryParam = vi.fn();

    const { result } = renderHook(() =>
      useAccountSecurityActions({
        user: mockUser,
        profile: mockProfile,
        isRecoveryMode: false,
        onClearRecoveryParam,
        updateProfile,
        updatePassword,
        resetPasswordForEmail,
        requestAccountDeletion,
        resendVerificationEmail,
      })
    );

    expect(result.current.displayName).toBe('Dr. Scholar');

    act(() => {
      result.current.setCustomName('New Scholar Name');
    });
    expect(result.current.displayName).toBe('New Scholar Name');

    await act(async () => {
      await result.current.handleSaveProfile({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    expect(updateProfile).toHaveBeenCalledWith({ display_name: 'New Scholar Name' });
    expect(result.current.saveSuccess).toBe(true);

    // Password mismatch validation
    act(() => {
      result.current.setNewPassword('StrongPass123!');
      result.current.setConfirmPassword('Mismatch123!');
    });
    await act(async () => {
      await result.current.handleUpdatePassword({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    expect(result.current.passwordError).toBe('Passwords do not match.');

    // Generate strong password & update with currentPassword
    act(() => {
      result.current.generateStrongPassword();
      result.current.setCurrentPassword('OldPass123!');
    });
    await act(async () => {
      await result.current.handleUpdatePassword({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    expect(updatePassword).toHaveBeenCalled();
    expect(result.current.passwordSuccess).toBe(true);
    expect(onClearRecoveryParam).toHaveBeenCalled();

    // Resend verification & password reset emails
    await act(async () => {
      await result.current.handleResendVerification();
      await result.current.handleRequestPasswordReset();
    });
    expect(resendVerificationEmail).toHaveBeenCalledWith('scholar@bookarium.test');
    expect(resetPasswordForEmail).toHaveBeenCalledWith('scholar@bookarium.test');

    // Account deletion modal lifecycle
    act(() => {
      result.current.setIsDeleteModalOpen(true);
    });
    expect(result.current.isDeleteModalOpen).toBe(true);

    await act(async () => {
      await result.current.handleRequestDeletion();
    });
    expect(requestAccountDeletion).toHaveBeenCalled();
    expect(result.current.deletionEmailSent).toBe(true);

    act(() => {
      result.current.closeDeleteModal();
    });
    expect(result.current.isDeleteModalOpen).toBe(false);
    expect(result.current.deletionEmailSent).toBe(false);
  });
});

