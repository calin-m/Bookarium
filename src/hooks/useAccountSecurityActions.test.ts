import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useAccountSecurityActions } from './useAccountSecurityActions';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/database.types';
import type { ActiveUserSession } from '@/lib/session-device-parser';

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

  it('resolves Google-only vs dual-identity states, allows password creation without currentPassword, and handles link/unlink actions', async () => {
    const updatePassword = vi.fn().mockResolvedValue({ error: null });
    const linkOAuthIdentity = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('Link failed') })
      .mockRejectedValueOnce(new Error('Network crash'));
    const unlinkOAuthIdentity = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('Unlink failed') })
      .mockRejectedValueOnce(new Error('Network crash'));

    // 1. Google-only user (hasGoogleIdentity = true, hasPasswordIdentity = false, canUnlinkGoogle = false)
    const googleOnlyUser = {
      id: 'u-google',
      email: 'scholar@gmail.com',
      identities: [
        {
          id: 'id-google',
          provider: 'google',
          identity_data: { email: 'scholar@gmail.com' },
        },
      ],
      app_metadata: { provider: 'google', providers: ['google'] },
    } as never;

    const { result, rerender } = renderHook(
      ({ activeUser }) =>
        useAccountSecurityActions({
          user: activeUser,
          profile: null,
          isRecoveryMode: false,
          onClearRecoveryParam: vi.fn(),
          updateProfile: vi.fn().mockResolvedValue({ error: null }),
          updatePassword,
          resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
          requestAccountDeletion: vi.fn().mockResolvedValue({ error: null }),
          resendVerificationEmail: vi.fn().mockResolvedValue({ error: null }),
          linkOAuthIdentity,
          unlinkOAuthIdentity,
        }),
      { initialProps: { activeUser: googleOnlyUser } }
    );

    expect(result.current.hasGoogleIdentity).toBe(true);
    expect(result.current.hasPasswordIdentity).toBe(false);
    expect(result.current.canUnlinkGoogle).toBe(false);
    expect(result.current.googleIdentityEmail).toBe('scholar@gmail.com');

    // Anti-lockout guard on handleUnlinkGoogle when !canUnlinkGoogle
    await act(async () => {
      await result.current.handleUnlinkGoogle();
    });
    expect(result.current.identityError).toContain('Set an account password first');
    expect(unlinkOAuthIdentity).not.toHaveBeenCalled();

    // Setting password without currentPassword succeeds for Google-only user
    act(() => {
      result.current.setNewPassword('NewStrongPass123!');
      result.current.setConfirmPassword('NewStrongPass123!');
    });
    await act(async () => {
      await result.current.handleUpdatePassword({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });
    expect(updatePassword).toHaveBeenCalledWith('NewStrongPass123!');

    // 2. Dual-identity user (both email and google -> canUnlinkGoogle = true)
    const dualUser = {
      id: 'u-google',
      email: 'scholar@gmail.com',
      identities: [
        { id: 'id-email', provider: 'email' },
        { id: 'id-google', provider: 'google', identity_data: { email: 'scholar@gmail.com' } },
      ],
      app_metadata: { provider: 'email', providers: ['email', 'google'] },
    } as never;

    rerender({ activeUser: dualUser });
    expect(result.current.hasGoogleIdentity).toBe(true);
    expect(result.current.hasPasswordIdentity).toBe(true);
    expect(result.current.canUnlinkGoogle).toBe(true);

    // Link & Unlink success, error, and catch paths
    await act(async () => {
      await result.current.handleLinkGoogle();
    });
    expect(linkOAuthIdentity).toHaveBeenCalledWith('google');

    await act(async () => {
      await result.current.handleLinkGoogle();
    });
    expect(result.current.identityError).toBe('Link failed');

    await act(async () => {
      await result.current.handleLinkGoogle();
    });
    expect(result.current.identityError).toContain('Failed to initiate Google account connection');

    await act(async () => {
      await result.current.handleUnlinkGoogle();
    });
    expect(unlinkOAuthIdentity).toHaveBeenCalledWith('google');
    expect(result.current.identitySuccess).toBe('Google account disconnected.');

    await act(async () => {
      await result.current.handleUnlinkGoogle();
    });
    expect(result.current.identityError).toBe('Unlink failed');

    await act(async () => {
      await result.current.handleUnlinkGoogle();
    });
    expect(result.current.identityError).toContain('Failed to disconnect Google account');
  });

  it('forwards optional Turnstile captchaToken on password reset and verification resend while ignoring invalid tokens', async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });
    const resendVerificationEmail = vi.fn().mockResolvedValue({ error: null });

    const { result: firstHook } = renderHook(() =>
      useAccountSecurityActions({
        user: mockUser,
        profile: mockProfile,
        isRecoveryMode: false,
        onClearRecoveryParam: vi.fn(),
        updateProfile: vi.fn().mockResolvedValue({ error: null }),
        updatePassword: vi.fn().mockResolvedValue({ error: null }),
        resetPasswordForEmail,
        requestAccountDeletion: vi.fn().mockResolvedValue({ error: null }),
        resendVerificationEmail,
      })
    );

    // Non-string values (e.g. accidental click events) are ignored cleanly
    await act(async () => {
      await firstHook.current.handleResendVerification({} as unknown as string);
      await firstHook.current.handleRequestPasswordReset({} as unknown as string);
    });
    expect(resendVerificationEmail).toHaveBeenLastCalledWith('scholar@bookarium.test');
    expect(resetPasswordForEmail).toHaveBeenLastCalledWith('scholar@bookarium.test');

    // Fresh hook without active 60s cooldown forwards valid string tokens cleanly
    const { result: secondHook } = renderHook(() =>
      useAccountSecurityActions({
        user: mockUser,
        profile: mockProfile,
        isRecoveryMode: false,
        onClearRecoveryParam: vi.fn(),
        updateProfile: vi.fn().mockResolvedValue({ error: null }),
        updatePassword: vi.fn().mockResolvedValue({ error: null }),
        resetPasswordForEmail,
        requestAccountDeletion: vi.fn().mockResolvedValue({ error: null }),
        resendVerificationEmail,
      })
    );

    await act(async () => {
      await secondHook.current.handleResendVerification('turnstile-verify-token');
      await secondHook.current.handleRequestPasswordReset('turnstile-reset-token');
    });

    expect(resendVerificationEmail).toHaveBeenLastCalledWith(
      'scholar@bookarium.test',
      'turnstile-verify-token'
    );
    expect(resetPasswordForEmail).toHaveBeenLastCalledWith(
      'scholar@bookarium.test',
      'turnstile-reset-token'
    );
  });

  it('loads active sessions on Security tab, resets on user change, and handles revocation and sign-out scopes', async () => {
    const sampleSessions: ActiveUserSession[] = [
      {
        id: 'sess-current',
        userAgent: 'Mozilla/5.0 Chrome/130',
        ipAddress: '203.0.113.x',
        createdAt: '2026-11-14T10:00:00Z',
        updatedAt: '2026-11-14T10:20:00Z',
        refreshedAt: '2026-11-14T10:30:00Z',
        notAfter: null,
        isCurrent: true,
      },
      {
        id: 'sess-mobile',
        userAgent: 'Mozilla/5.0 (iPhone) Safari/604.1',
        ipAddress: '198.51.100.x',
        createdAt: '2026-11-13T09:00:00Z',
        updatedAt: '2026-11-13T11:00:00Z',
        refreshedAt: null,
        notAfter: null,
        isCurrent: false,
      },
    ];

    const listActiveSessions = vi.fn().mockResolvedValue({
      sessions: sampleSessions,
      error: null,
    });
    const revokeSession = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('Revoke RPC failed') });
    const signOut = vi.fn().mockResolvedValue(undefined);
    const signOutOtherDevices = vi
      .fn()
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error('Sign out others failed') });
    const onAfterSignOut = vi.fn();

    const { result, rerender } = renderHook(
      ({ activeUser, tab }: { activeUser: User | null; tab: string }) =>
        useAccountSecurityActions({
          user: activeUser,
          profile: mockProfile,
          isRecoveryMode: false,
          onClearRecoveryParam: vi.fn(),
          updateProfile: vi.fn().mockResolvedValue({ error: null }),
          updatePassword: vi.fn().mockResolvedValue({ error: null }),
          resetPasswordForEmail: vi.fn().mockResolvedValue({ error: null }),
          requestAccountDeletion: vi.fn().mockResolvedValue({ error: null }),
          resendVerificationEmail: vi.fn().mockResolvedValue({ error: null }),
          activeTab: tab,
          signOut,
          signOutOtherDevices,
          listActiveSessions,
          revokeSession,
          onAfterSignOut,
        }),
      { initialProps: { activeUser: mockUser, tab: 'habits' } as { activeUser: User | null; tab: string } }
    );

    // Not fetched until Security tab is active
    expect(listActiveSessions).not.toHaveBeenCalled();

    rerender({ activeUser: mockUser, tab: 'security' });
    await waitFor(() => {
      expect(listActiveSessions).toHaveBeenCalledTimes(1);
      expect(result.current.sessions).toHaveLength(2);
    });

    // Revoking another device removes it cleanly
    await act(async () => {
      await result.current.handleRevokeSession(sampleSessions[1]);
    });
    expect(revokeSession).toHaveBeenCalledWith('sess-mobile');
    expect(result.current.sessions).toHaveLength(1);
    expect(result.current.sessionsSuccess).toBe('Device session revoked.');

    // Error branch on revokeSession preserves remaining list & exposes error
    await act(async () => {
      await result.current.handleRevokeSession({ ...sampleSessions[1], id: 'sess-err' });
    });
    expect(result.current.sessionsError).toBe('Revoke RPC failed');

    // Manual refresh reloads list
    await act(async () => {
      await result.current.refreshActiveSessions();
    });
    expect(listActiveSessions).toHaveBeenCalledTimes(2);
    expect(result.current.sessions).toHaveLength(2);

    // Sign out other devices keeps current session & surfaces confirmation
    await act(async () => {
      await result.current.handleSignOutOtherDevices();
    });
    expect(signOutOtherDevices).toHaveBeenCalledTimes(1);
    expect(result.current.sessions).toEqual([sampleSessions[0]]);
    expect(result.current.sessionsSuccess).toBe('Signed out from all other devices.');

    await act(async () => {
      await result.current.handleSignOutOtherDevices();
    });
    expect(result.current.sessionsError).toBe('Sign out others failed');

    // Revoking current session delegates cleanly to local sign-out
    await act(async () => {
      await result.current.handleRevokeSession(sampleSessions[0]);
    });
    expect(signOut).toHaveBeenCalledWith('local');
    expect(onAfterSignOut).toHaveBeenCalledTimes(1);

    // Confirmation modal state + confirmed Sign Out All Devices invokes global scope
    act(() => {
      result.current.setIsSignOutAllModalOpen(true);
    });
    expect(result.current.isSignOutAllModalOpen).toBe(true);

    await act(async () => {
      await result.current.handleSignOutAllDevices();
    });
    expect(result.current.isSignOutAllModalOpen).toBe(false);
    expect(signOut).toHaveBeenCalledWith('global');
    expect(onAfterSignOut).toHaveBeenCalledTimes(2);

    // Switching / clearing user resets loaded session state cleanly
    rerender({ activeUser: null, tab: 'security' });
    expect(result.current.sessions).toEqual([]);
    expect(result.current.hasLoadedSessions).toBe(false);
  });
});

