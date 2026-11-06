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
    const generatedPassword = result.current.newPassword;
    expect(generatedPassword.length).toBeGreaterThanOrEqual(12);
    await act(async () => {
      await result.current.handleUpdatePassword({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    expect(updatePassword).toHaveBeenCalledWith(generatedPassword, 'OldPass123!');
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

  it('enforces password validation rules, supports recovery mode without currentPassword, and propagates action errors', async () => {
    const updateProfile = vi.fn().mockResolvedValue({ error: new Error('Profile update failed') });
    const updatePassword = vi
      .fn()
      .mockResolvedValueOnce({ error: new Error('Invalid recovery token') })
      .mockResolvedValueOnce({ error: null });
    const resetPasswordForEmail = vi
      .fn()
      .mockResolvedValue({ error: new Error('Rate limit exceeded') });
    const requestAccountDeletion = vi
      .fn()
      .mockResolvedValue({ error: new Error('Deletion service unavailable') });
    const resendVerificationEmail = vi
      .fn()
      .mockResolvedValue({ error: new Error('Verification email throttled') });
    const onClearRecoveryParam = vi.fn();
    const clearPasswordRecovery = vi.fn();

    const { result, rerender } = renderHook(
      (props: { isRecoveryMode: boolean }) =>
        useAccountSecurityActions({
          user: mockUser,
          profile: mockProfile,
          isRecoveryMode: props.isRecoveryMode,
          onClearRecoveryParam,
          clearPasswordRecovery,
          updateProfile,
          updatePassword,
          resetPasswordForEmail,
          requestAccountDeletion,
          resendVerificationEmail,
        }),
      { initialProps: { isRecoveryMode: false } }
    );

    // 1. Short password rejection (< 6 chars)
    act(() => {
      result.current.setNewPassword('12345');
      result.current.setConfirmPassword('12345');
    });
    await act(async () => {
      await result.current.handleUpdatePassword({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    expect(result.current.passwordError).toBe('Password must be at least 6 characters long.');

    // 2. Missing currentPassword when not in recovery mode
    act(() => {
      result.current.setNewPassword('ValidNewPass123!');
      result.current.setConfirmPassword('ValidNewPass123!');
    });
    await act(async () => {
      await result.current.handleUpdatePassword({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    expect(result.current.passwordError).toBe(
      'Please enter your current password, or send a reset link to your email.'
    );

    // 3. Identical newPassword and currentPassword rejection
    act(() => {
      result.current.setCurrentPassword('ValidNewPass123!');
    });
    await act(async () => {
      await result.current.handleUpdatePassword({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    expect(result.current.passwordError).toBe(
      'New password must be different from your current password.'
    );

    // 4. Recovery mode bypasses currentPassword requirement and calls updatePassword(newPassword) with 1 arg
    rerender({ isRecoveryMode: true });
    act(() => {
      result.current.setCurrentPassword('');
      result.current.setNewPassword('RecoveryPass123!');
      result.current.setConfirmPassword('RecoveryPass123!');
    });
    await act(async () => {
      await result.current.handleUpdatePassword({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    expect(updatePassword).toHaveBeenCalledWith('RecoveryPass123!');
    expect(result.current.passwordError).toBe('Invalid recovery token');

    await act(async () => {
      await result.current.handleUpdatePassword({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });
    expect(result.current.passwordSuccess).toBe(true);
    expect(clearPasswordRecovery).toHaveBeenCalledTimes(1);

    // 5. Error propagation across profile, verification, reset, and deletion actions
    await act(async () => {
      await result.current.handleSaveProfile({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      await result.current.handleResendVerification();
      await result.current.handleRequestPasswordReset();
      await result.current.handleRequestDeletion();
    });
    expect(result.current.saveError).toBe('Profile update failed');
    expect(result.current.resendError).toBe('Verification email throttled');
    expect(result.current.resetEmailError).toBe('Rate limit exceeded');
    expect(result.current.deleteError).toBe('Deletion service unavailable');
  });

  it('handles cooldown timers, clipboard password copy, unauthenticated guard clauses, and unexpected exceptions', async () => {
    vi.useFakeTimers();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    const updateProfile = vi.fn().mockResolvedValueOnce({ error: null }).mockRejectedValueOnce(new Error('Crash'));
    const updatePassword = vi.fn().mockRejectedValueOnce(new Error('Crash'));
    const resetPasswordForEmail = vi.fn().mockResolvedValueOnce({ error: null }).mockRejectedValueOnce(new Error('Crash'));
    const requestAccountDeletion = vi.fn().mockRejectedValueOnce(new Error('Crash'));
    const resendVerificationEmail = vi.fn().mockResolvedValueOnce({ error: null }).mockRejectedValueOnce(new Error('Crash'));

    // 1. Unauthenticated guards (user: null)
    const { result: unauthResult } = renderHook(() =>
      useAccountSecurityActions({
        user: null,
        profile: null,
        isRecoveryMode: false,
        onClearRecoveryParam: vi.fn(),
        updateProfile,
        updatePassword,
        resetPasswordForEmail,
        requestAccountDeletion,
        resendVerificationEmail,
      })
    );

    await act(async () => {
      await unauthResult.current.handleResendVerification();
      await unauthResult.current.handleRequestPasswordReset();
      await unauthResult.current.handleSaveProfile({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      await unauthResult.current.handleUpdatePassword({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      await unauthResult.current.handleRequestDeletion();
    });
    expect(updateProfile).not.toHaveBeenCalled();

    // 2. Cooldown timers and clipboard copy with authenticated user
    const { result } = renderHook(() =>
      useAccountSecurityActions({
        user: mockUser,
        profile: mockProfile,
        isRecoveryMode: true,
        onClearRecoveryParam: vi.fn(),
        updateProfile,
        updatePassword,
        resetPasswordForEmail,
        requestAccountDeletion,
        resendVerificationEmail,
      })
    );

    act(() => {
      result.current.generateStrongPassword();
    });
    expect(writeTextMock).toHaveBeenCalledTimes(1);
    expect(result.current.copiedPassword).toBe(true);

    await act(async () => {
      await result.current.handleResendVerification();
      await result.current.handleRequestPasswordReset();
      await result.current.handleSaveProfile({ preventDefault: vi.fn() } as unknown as React.FormEvent);
    });

    expect(result.current.resendSuccess).toBe(true);
    expect(result.current.resendCooldown).toBe(60);
    expect(result.current.resetCooldown).toBe(60);

    // Advance timers by 5 seconds to trigger interval ticks and timeout resets
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.copiedPassword).toBe(false);
    expect(result.current.resendSuccess).toBe(false);
    expect(result.current.saveSuccess).toBe(false);
    expect(result.current.resendCooldown).toBe(55);
    expect(result.current.resetCooldown).toBe(55);

    // Drain remaining cooldown and test catch blocks
    act(() => {
      vi.advanceTimersByTime(55000);
    });
    expect(result.current.resendCooldown).toBe(0);
    expect(result.current.resetCooldown).toBe(0);

    await act(async () => {
      await result.current.handleResendVerification();
      await result.current.handleRequestPasswordReset();
      await result.current.handleSaveProfile({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      await result.current.handleUpdatePassword({ preventDefault: vi.fn() } as unknown as React.FormEvent);
      await result.current.handleRequestDeletion();
    });

    expect(result.current.resendError).toContain('Failed to resend');
    expect(result.current.resetEmailError).toContain('Failed to send');
    expect(result.current.saveError).toContain('unexpected error');
    expect(result.current.passwordError).toContain('unexpected error');
    expect(result.current.deleteError).toContain('unexpected error');

    vi.useRealTimers();
  });
});

