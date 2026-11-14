import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  useAuthStore,
  validateUsername,
  isDefinitiveAuthInvalidError,
  coalesceInFlightByUser,
} from './useAuthStore';

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithOtp = vi.fn();
const mockSignInWithOAuth = vi.fn();
const mockLinkIdentity = vi.fn();
const mockUnlinkIdentity = vi.fn();
const mockGetUserIdentities = vi.fn();
const mockSignOut = vi.fn();
const mockGetUser = vi.fn();
const mockOnAuthStateChange = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockUpdateUser = vi.fn();
const mockResend = vi.fn();
const mockFrom = vi.fn();

const mockRpc = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signUp: mockSignUp,
      resend: mockResend,
      signInWithOtp: mockSignInWithOtp,
      signInWithOAuth: mockSignInWithOAuth,
      linkIdentity: mockLinkIdentity,
      unlinkIdentity: mockUnlinkIdentity,
      getUserIdentities: mockGetUserIdentities,
      signOut: mockSignOut,
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
      resetPasswordForEmail: mockResetPasswordForEmail,
      updateUser: mockUpdateUser,
    },
    from: mockFrom,
    rpc: mockRpc,
  }),
}));


describe('useAuthStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      user: null,
      profile: null,
      isLoading: false,
      isAuthModalOpen: false,
      authModalView: 'sign_in',
      error: null,
      statusMessage: null,
    });
  });

  it('manages modal open, close, view, and statusMessage state transitions', () => {
    const store = useAuthStore.getState();

    store.openAuthModal('sign_up');
    expect(useAuthStore.getState().isAuthModalOpen).toBe(true);
    expect(useAuthStore.getState().authModalView).toBe('sign_up');

    store.setStatusMessage('Email verified!');
    expect(useAuthStore.getState().statusMessage).toBe('Email verified!');

    store.setAuthModalView('magic_link');
    expect(useAuthStore.getState().authModalView).toBe('magic_link');
    expect(useAuthStore.getState().statusMessage).toBeNull();

    store.setStatusMessage('Another notice');
    store.closeAuthModal();
    expect(useAuthStore.getState().isAuthModalOpen).toBe(false);
    expect(useAuthStore.getState().statusMessage).toBeNull();
  });

  it('handles signInWithPassword success and error states', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'user-123', email: 'reader@bookarium.test' } },
      error: null,
    });

    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          single: vi.fn().mockResolvedValueOnce({
            data: { id: 'user-123', display_name: 'Test Reader', preferred_theme: 'sepia', font_size: 18 },
            error: null,
          }),
        }),
      }),
    });

    const result = await useAuthStore.getState().signInWithPassword('reader@bookarium.test', 'password123');

    expect(result.error).toBeNull();
    expect(useAuthStore.getState().user?.id).toBe('user-123');
    expect(useAuthStore.getState().isAuthModalOpen).toBe(false);
  });

  it('handles sign in error and sets error message', async () => {
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });

    const result = await useAuthStore.getState().signInWithPassword('reader@bookarium.test', 'wrongpassword');

    expect(result.error?.message).toBe('Invalid login credentials');
    expect(useAuthStore.getState().error).toBe('Invalid login credentials');
  });

  it('handles signOut', async () => {
    useAuthStore.setState({ user: { id: 'user-123' } as any });
    mockSignOut.mockResolvedValueOnce({ error: null });

    await useAuthStore.getState().signOut();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().profile).toBeNull();
  });

  it('handles signUpWithPassword success (with session and unconfirmed)', async () => {
    // Unconfirmed (needs email confirmation)
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: 'new-user', email: 'new@bookarium.test' }, session: null },
      error: null,
    });

    const res1 = await useAuthStore.getState().signUpWithPassword('new@bookarium.test', 'password123', 'New User');
    expect(res1.error).toBeNull();
    expect(res1.needsEmailConfirmation).toBe(true);
    expect(mockSignUp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'new@bookarium.test',
        password: 'password123',
        options: expect.objectContaining({
          data: {
            full_name: 'New User',
            display_name: 'New User',
          },
        }),
      })
    );

    // Immediate session
    mockSignUp.mockResolvedValueOnce({
      data: { user: { id: 'new-user', email: 'new@bookarium.test' }, session: { access_token: 'abc' } },
      error: null,
    });

    const res2 = await useAuthStore.getState().signUpWithPassword('new@bookarium.test', 'password123', 'New User');
    expect(res2.error).toBeNull();
    expect(res2.needsEmailConfirmation).toBe(false);
    expect(useAuthStore.getState().user?.id).toBe('new-user');

    // Error case
    mockSignUp.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Email already registered' },
    });

    const res3 = await useAuthStore.getState().signUpWithPassword('new@bookarium.test', 'password123');
    expect(res3.error?.message).toBe('Email already registered');
    expect(useAuthStore.getState().error).toBe('Email already registered');
  });

  it('handles resendVerificationEmail success and error', async () => {
    mockResend.mockResolvedValueOnce({ error: null });
    const res1 = await useAuthStore.getState().resendVerificationEmail('reader@bookarium.org');
    expect(res1.error).toBeNull();
    expect(mockResend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'signup',
        email: 'reader@bookarium.org',
      })
    );

    mockResend.mockResolvedValueOnce({ error: { message: 'Too many requests' } });
    const res2 = await useAuthStore.getState().resendVerificationEmail('reader@bookarium.org');
    expect(res2.error?.message).toBe('Too many requests');
    expect(useAuthStore.getState().error).toBe('Too many requests');
  });

  it('handles signInWithOtp (magic link) success and error with /auth/callback redirect', async () => {
    mockSignInWithOtp.mockResolvedValueOnce({ error: null });
    const res1 = await useAuthStore.getState().signInWithOtp('reader@bookarium.org');
    expect(res1.error).toBeNull();
    expect(mockSignInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'reader@bookarium.org',
        options: expect.objectContaining({
          emailRedirectTo: expect.stringContaining('/auth/callback'),
        }),
      })
    );

    mockSignInWithOtp.mockResolvedValueOnce({ error: { message: 'Rate limit exceeded' } });
    const res2 = await useAuthStore.getState().signInWithOtp('reader@bookarium.org');
    expect(res2.error?.message).toBe('Rate limit exceeded');
    expect(useAuthStore.getState().error).toBe('Rate limit exceeded');
  });

  it('handles signInWithOAuth success, non-root next path preservation, and error with /auth/callback redirect', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ error: null });
    const res1 = await useAuthStore.getState().signInWithOAuth('google');
    expect(res1.error).toBeNull();
    expect(mockSignInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback'),
        }),
      })
    );

    // Non-root route preserves ?next=
    window.location.pathname = '/read/1342';
    mockSignInWithOAuth.mockResolvedValueOnce({ error: null });
    await useAuthStore.getState().signInWithOAuth('google');
    expect(mockSignInWithOAuth).toHaveBeenLastCalledWith(
      expect.objectContaining({
        provider: 'google',
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback?next=%2Fread%2F1342'),
        }),
      })
    );
    window.location.pathname = '/';

    mockSignInWithOAuth.mockResolvedValueOnce({ error: { message: 'OAuth failed' } });
    const res2 = await useAuthStore.getState().signInWithOAuth('github');
    expect(res2.error?.message).toBe('OAuth failed');
    expect(useAuthStore.getState().error).toBe('OAuth failed');
  });

  it('handles linkOAuthIdentity and unlinkOAuthIdentity with anti-lockout protection', async () => {
    // 1. linkOAuthIdentity success & error
    mockLinkIdentity.mockResolvedValueOnce({ error: null });
    const linkOk = await useAuthStore.getState().linkOAuthIdentity('google');
    expect(linkOk.error).toBeNull();
    expect(mockLinkIdentity).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'google',
        options: expect.objectContaining({
          redirectTo: expect.stringContaining('/auth/callback?next=%2Faccount%3Ftab%3Dsecurity'),
        }),
      })
    );

    mockLinkIdentity.mockResolvedValueOnce({ error: { message: 'Manual linking disabled' } });
    const linkErr = await useAuthStore.getState().linkOAuthIdentity('google');
    expect(linkErr.error?.message).toBe('Manual linking disabled');

    // 2. unlinkOAuthIdentity with no user
    useAuthStore.setState({ user: null });
    const noUserRes = await useAuthStore.getState().unlinkOAuthIdentity('google');
    expect(noUserRes.error?.message).toBe('No active user session found');

    // 3. Anti-lockout guard when user only has 1 identity (Google-only)
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'reader@bookarium.org',
        identities: [{ id: 'id-google', provider: 'google' }],
        app_metadata: { providers: ['google'] },
      } as never,
    });
    const lockoutRes = await useAuthStore.getState().unlinkOAuthIdentity('google');
    expect(lockoutRes.error?.message).toContain('Set an account password first');
    expect(mockUnlinkIdentity).not.toHaveBeenCalled();

    // 4. Fallback to getUserIdentities() and missing target provider branch
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'reader@bookarium.org',
        identities: [],
        app_metadata: { providers: ['email', 'google'] },
      } as never,
    });
    mockGetUserIdentities.mockResolvedValueOnce({
      data: {
        identities: [
          { id: 'id-email', provider: 'email' },
          { id: 'id-google', provider: 'google' },
        ],
      },
    });
    const missingProviderRes = await useAuthStore.getState().unlinkOAuthIdentity('github');
    expect(missingProviderRes.error?.message).toBe('No linked github account found.');

    // 5. Unlink error & success when both email and google identities exist
    useAuthStore.setState({
      user: {
        id: 'u1',
        email: 'reader@bookarium.org',
        identities: [
          { id: 'id-email', provider: 'email' },
          { id: 'id-google', provider: 'google' },
        ],
        app_metadata: { providers: ['email', 'google'] },
      } as never,
    });
    mockUnlinkIdentity.mockResolvedValueOnce({ error: { message: 'Unlink failed' } });
    const unlinkErr = await useAuthStore.getState().unlinkOAuthIdentity('google');
    expect(unlinkErr.error?.message).toBe('Unlink failed');

    mockUnlinkIdentity.mockResolvedValueOnce({ error: null });
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: 'u1',
          email: 'reader@bookarium.org',
          identities: [{ id: 'id-email', provider: 'email' }],
          app_metadata: { providers: ['email'] },
        },
      },
    });
    const unlinkOk = await useAuthStore.getState().unlinkOAuthIdentity('google');
    expect(unlinkOk.error).toBeNull();
    expect(mockUnlinkIdentity).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'id-google', provider: 'google' })
    );
    expect(useAuthStore.getState().user?.identities).toHaveLength(1);
  });

  it('hydrates user on initializeAuth when active session exists', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'init-user', email: 'init@bookarium.test' } },
    });
    mockOnAuthStateChange.mockReturnValueOnce({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    useAuthStore.getState().initializeAuth();
    expect(mockGetUser).toHaveBeenCalled();
    expect(mockOnAuthStateChange).toHaveBeenCalled();
  });

  it('short-circuits network getUser in initializeAuth when getSession reports no local session for anonymous visitors', async () => {
    const clientModule = await import('@/lib/supabase/client');
    const mockGetSession = vi
      .fn()
      .mockResolvedValueOnce({ data: { session: null }, error: null })
      .mockResolvedValueOnce({
        data: { session: { user: { id: 'session-user', email: 's@bookarium.test' } } },
        error: null,
      });

    const createClientSpy = vi.spyOn(clientModule, 'createClient').mockImplementation(
      () =>
        ({
          auth: {
            getSession: mockGetSession,
            getUser: mockGetUser,
            onAuthStateChange: mockOnAuthStateChange,
          },
          from: mockFrom,
          rpc: mockRpc,
        }) as unknown as ReturnType<typeof clientModule.createClient>
    );

    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });

    // 1. Anonymous visitor: getSession returns null -> getUser is NOT called
    useAuthStore.setState({ user: null, profile: null, isLoading: true });
    useAuthStore.getState().initializeAuth();
    await new Promise((r) => setTimeout(r, 0));
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(mockGetUser).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isLoading).toBe(false);

    // 2. Signed-in visitor: getSession returns session -> getUser IS called
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'session-user', email: 's@bookarium.test' } },
      error: null,
    });
    mockFrom.mockReturnValueOnce({
      select: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockReturnValueOnce({
          single: vi.fn().mockResolvedValueOnce({
            data: { id: 'session-user', display_name: 'Session Scholar' },
            error: null,
          }),
        }),
      }),
    });

    useAuthStore.getState().initializeAuth();
    await new Promise((r) => setTimeout(r, 0));
    expect(mockGetSession).toHaveBeenCalledTimes(2);
    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user?.id).toBe('session-user');

    createClientSpy.mockRestore();
  });

  it('updates auth state when onAuthStateChange triggers SIGNED_OUT', async () => {
    let authChangeCallback: any;
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'init-user', email: 'init@bookarium.test' } },
    });
    mockOnAuthStateChange.mockImplementationOnce((callback: any) => {
      authChangeCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    useAuthStore.getState().initializeAuth();

    useAuthStore.setState({
      user: { id: 'init-user', email: 'init@bookarium.test' } as any,
      profile: { id: 'init-user', display_name: 'Init User' } as any,
    });

    expect(authChangeCallback).toBeTypeOf('function');
    authChangeCallback('PASSWORD_RECOVERY', {
      user: { id: 'init-user', email: 'init@bookarium.test' },
    });
    expect(useAuthStore.getState().isPasswordRecovery).toBe(true);

    authChangeCallback('SIGNED_OUT', null);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().profile).toBeNull();
    expect(useAuthStore.getState().isPasswordRecovery).toBe(false);
  });

  it('clears local user stores when initializeAuth or onAuthStateChange switches from a cached user to a different user', async () => {
    const { useReaderStore } = await import('@/stores/useReaderStore');
    const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
    const resetReaderSessionSpy = vi.spyOn(useReaderStore.getState(), 'resetReaderSession');
    const clearBookshelfSpy = vi.spyOn(useBookshelfStore.getState(), 'clearBookshelf');

    let authChangeCallback: any;
    mockOnAuthStateChange.mockImplementationOnce((callback: any) => {
      authChangeCallback = callback;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    // Seed cached User A
    useAuthStore.setState({
      user: { id: 'user-a', email: 'a@bookarium.test' } as any,
      profile: { id: 'user-a', display_name: 'Reader A' } as any,
      isLoading: true,
    });

    // Server returns User B on initializeAuth
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-b', email: 'b@bookarium.test' } },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'user-b', display_name: 'Reader B' },
            error: null,
          }),
        }),
      }),
    });

    useAuthStore.getState().initializeAuth();
    // Concurrent onAuthStateChange for User B while cleanup is running
    authChangeCallback('SIGNED_IN', {
      user: { id: 'user-b', email: 'b@bookarium.test' },
    });

    await vi.waitFor(() => {
      expect(useAuthStore.getState().user?.id).toBe('user-b');
      expect(useAuthStore.getState().isLoading).toBe(false);
    });
    expect(resetReaderSessionSpy).toHaveBeenCalledTimes(1);
    expect(clearBookshelfSpy).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes cleanly when initializeAuth cleanup function is called', () => {
    const mockUnsubscribe = vi.fn();
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    mockOnAuthStateChange.mockReturnValueOnce({
      data: { subscription: { unsubscribe: mockUnsubscribe } },
    });

    const cleanup = useAuthStore.getState().initializeAuth();
    cleanup();
    expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
  });

  it('returns error when updateProfile is called while logged out', async () => {
    useAuthStore.setState({ user: null, profile: null });
    const res = await useAuthStore.getState().updateProfile({ display_name: 'New Name' });
    expect(res.error?.message).toBe('User not logged in');
  });

  it('updates profile display name in Supabase and local store when logged in', async () => {
    useAuthStore.setState({
      user: { id: 'user-123' } as any,
      profile: { id: 'user-123', display_name: 'Old Name' } as any,
    });
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ error: null }),
      }),
    });

    const res = await useAuthStore.getState().updateProfile({ display_name: 'Updated Name' });
    expect(res.error).toBeNull();
    expect(useAuthStore.getState().profile?.display_name).toBe('Updated Name');
  });

  it('handles updateProfile database failure and records error', async () => {
    useAuthStore.setState({
      user: { id: 'user-123' } as any,
      profile: { id: 'user-123', display_name: 'Old Name' } as any,
    });
    mockFrom.mockReturnValueOnce({
      update: vi.fn().mockReturnValueOnce({
        eq: vi.fn().mockResolvedValueOnce({ error: { message: 'Database error' } }),
      }),
    });

    const res = await useAuthStore.getState().updateProfile({ display_name: 'Failed Name' });
    expect(res.error?.message).toBe('Database error');
    expect(useAuthStore.getState().error).toBe('Database error');
  });

  it('handles resetPasswordForEmail success and failure with PKCE callback redirect', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });
    const res1 = await useAuthStore.getState().resetPasswordForEmail('user@bookarium.test');
    expect(res1.error).toBeNull();
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'user@bookarium.test',
      expect.objectContaining({
        redirectTo: expect.stringContaining(
          '/auth/callback?next=%2Faccount%3Ftab%3Dsecurity%26recovery%3Dtrue'
        ),
      })
    );

    mockResetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'User not found' } });
    const res2 = await useAuthStore.getState().resetPasswordForEmail('unknown@bookarium.test');
    expect(res2.error?.message).toBe('User not found');
    expect(useAuthStore.getState().error).toBe('User not found');
  });

  it('handles updatePassword in recovery mode and with currentPassword re-authentication', async () => {
    // 1. Recovery mode (no currentPassword provided)
    useAuthStore.setState({ isPasswordRecovery: true });
    mockUpdateUser.mockResolvedValueOnce({ error: null });
    const res1 = await useAuthStore.getState().updatePassword('newPassword123');
    expect(res1.error).toBeNull();
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newPassword123' });
    expect(useAuthStore.getState().isPasswordRecovery).toBe(false);

    mockUpdateUser.mockResolvedValueOnce({ error: { message: 'Password too weak' } });
    const res2 = await useAuthStore.getState().updatePassword('123');
    expect(res2.error?.message).toBe('Password too weak');
    expect(useAuthStore.getState().error).toBe('Password too weak');

    // 2. Re-authentication mode: no active user email
    useAuthStore.setState({ user: null });
    const resNoUser = await useAuthStore.getState().updatePassword('newPass123', 'oldPass123');
    expect(resNoUser.error?.message).toBe('No active user session found');

    // 3. Re-authentication mode: identical password rejection
    useAuthStore.setState({
      user: { id: 'u1', email: 'scholar@bookarium.test' } as any,
    });
    mockUpdateUser.mockClear();
    mockSignInWithPassword.mockClear();
    const resSame = await useAuthStore.getState().updatePassword('samePass123', 'samePass123');
    expect(resSame.error?.message).toBe(
      'New password must be different from your current password.'
    );
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
    expect(mockUpdateUser).not.toHaveBeenCalled();

    // 4. Re-authentication mode: incorrect current password rejection
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });
    const resWrongCurrent = await useAuthStore
      .getState()
      .updatePassword('newPass456', 'wrongCurrentPass');
    expect(resWrongCurrent.error?.message).toBe('Current password is incorrect.');
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'scholar@bookarium.test',
      password: 'wrongCurrentPass',
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();

    // 5. Re-authentication mode: valid current password -> updates password
    mockSignInWithPassword.mockResolvedValueOnce({
      data: { user: { id: 'u1', email: 'scholar@bookarium.test' }, session: {} },
      error: null,
    });
    mockUpdateUser.mockResolvedValueOnce({ error: null });
    const resReauthSuccess = await useAuthStore
      .getState()
      .updatePassword('newPass456', 'correctCurrentPass');
    expect(resReauthSuccess.error).toBeNull();
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: 'scholar@bookarium.test',
      password: 'correctCurrentPass',
    });
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newPass456' });

    // 6. clearPasswordRecovery helper
    useAuthStore.setState({ isPasswordRecovery: true });
    useAuthStore.getState().clearPasswordRecovery();
    expect(useAuthStore.getState().isPasswordRecovery).toBe(false);
  });

  it('handles requestAccountDeletion success and failure with PKCE callback redirect', async () => {
    // Logged out
    useAuthStore.setState({ user: null });
    const res1 = await useAuthStore.getState().requestAccountDeletion();
    expect(res1.error?.message).toBe('No active user session found');

    // Logged in success
    useAuthStore.setState({ user: { id: 'u1', email: 'delete@bookarium.test' } as any });
    mockSignInWithOtp.mockResolvedValueOnce({ error: null });

    const res2 = await useAuthStore.getState().requestAccountDeletion();
    expect(res2.error).toBeNull();
    expect(mockSignInWithOtp).toHaveBeenCalledWith({
      email: 'delete@bookarium.test',
      options: {
        emailRedirectTo: expect.stringContaining(
          '/auth/callback?next=%2Fauth%2Fconfirm-deletion'
        ),
      },
    });

    // Logged in failure
    mockSignInWithOtp.mockResolvedValueOnce({ error: { message: 'Auth rate limit' } });
    const res3 = await useAuthStore.getState().requestAccountDeletion();
    expect(res3.error?.message).toBe('Auth rate limit');
    expect(useAuthStore.getState().error).toBe('Auth rate limit');
  });

  it('handles deleteAccount success, 11-table database purge, IndexedDB offline purge, and local state reset', async () => {
    // Logged out
    useAuthStore.setState({ user: null });
    const res1 = await useAuthStore.getState().deleteAccount();
    expect(res1.error?.message).toBe('No active user session');

    // Logged in success
    sessionStorage.setItem('bookarium_auto_heal_attempted', '1');
    useAuthStore.setState({ user: { id: 'user-delete' } as any, profile: { id: 'user-delete' } as any });
    const mockEq = vi.fn().mockResolvedValue({ error: null });
    const mockOr = vi.fn().mockResolvedValue({ error: null });
    const mockDelete = vi.fn().mockReturnValue({
      eq: mockEq,
      or: mockOr,
    });
    mockFrom.mockReturnValue({
      delete: mockDelete,
    });
    mockSignOut.mockResolvedValueOnce({ error: null });

    const [
      { useBookshelfStore },
      { useAnnotationStore },
      { useHabitsStore },
      { useAccoladesStore },
      { useFellowshipStore },
      { useReaderStore },
      { usePreferencesStore },
      offlineStorage,
    ] = await Promise.all([
      import('@/stores/useBookshelfStore'),
      import('@/stores/useAnnotationStore'),
      import('@/stores/useHabitsStore'),
      import('@/stores/useAccoladesStore'),
      import('@/stores/useFellowshipStore'),
      import('@/stores/useReaderStore'),
      import('@/stores/usePreferencesStore'),
      import('@/lib/offline-storage'),
    ]);

    const clearBookshelfSpy = vi.spyOn(useBookshelfStore.getState(), 'clearBookshelf');
    const clearAllAnnotationsSpy = vi.spyOn(useAnnotationStore.getState(), 'clearAllAnnotations');
    const resetHabitsSpy = vi.spyOn(useHabitsStore.getState(), 'resetHabits');
    const resetAccoladesSpy = vi.spyOn(useAccoladesStore.getState(), 'resetAccolades');
    const clearFellowshipStateSpy = vi.spyOn(useFellowshipStore.getState(), 'clearFellowshipState');
    const clearAllVolumesSpy = vi.spyOn(useReaderStore.getState(), 'clearAllVolumes').mockResolvedValue(undefined);
    const resetAllPreferencesSpy = vi.spyOn(usePreferencesStore.getState(), 'resetAllPreferencesStore');
    const clearOfflineSpy = vi.spyOn(offlineStorage, 'clearAllOfflineBooks').mockResolvedValue(undefined);

    useReaderStore.setState({
      fontSize: 28,
      brightness: 60,
      theme: 'dark',
      readingMode: 'scroll',
      columnWidth: 'narrow',
    });
    usePreferencesStore.setState({
      stickyScrollEnabled: false,
      exitBookmarkReminderEnabled: false,
      speechRate: 1.5,
      customDefaults: {
        theme: 'sepia',
        stickyScrollEnabled: false,
        fontFamily: 'mono',
        fontSize: 22,
        lineHeight: 2.0,
        brightness: 80,
        readingMode: 'scroll',
        columnWidth: 'narrow',
        spoilerShieldEnabled: false,
        speechRate: 1.25,
        speechVoiceURI: null,
        speechAutoPageAdvance: false,
        speechHighlightEnabled: false,
      },
      preferencesUpdatedAt: '2026-10-31T18:00:00.000Z',
    });
    useAnnotationStore.setState({ spoilerShieldEnabled: false });

    const res2 = await useAuthStore.getState().deleteAccount();
    expect(res2.error).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().profile).toBeNull();

    // Verify all 11 relational tables were purged
    const expectedTables = [
      'symposium_sessions',
      'reader_circles',
      'user_accolades',
      'user_annotations',
      'reading_progress',
      'user_favorites',
      'user_book_curation',
      'user_reading_habits',
      'bookshelf_items',
      'bookshelves',
      'profiles',
    ];
    for (const table of expectedTables) {
      expect(mockFrom).toHaveBeenCalledWith(table);
    }
    expect(mockOr).toHaveBeenCalledWith('host_id.eq.user-delete,fellow_id.eq.user-delete');
    expect(mockOr).toHaveBeenCalledWith('requester_id.eq.user-delete,recipient_id.eq.user-delete');
    expect(mockEq).toHaveBeenCalledWith('user_id', 'user-delete');
    expect(mockEq).toHaveBeenCalledWith('id', 'user-delete');
    expect(mockRpc).toHaveBeenCalledWith('delete_current_user');
    expect(mockSignOut).toHaveBeenCalledWith({ scope: 'global' });

    // Verify all local persistent stores, IndexedDB books, reader/theme/preferences settings, and session flags were wiped
    expect(clearBookshelfSpy).toHaveBeenCalled();
    expect(clearAllAnnotationsSpy).toHaveBeenCalled();
    expect(resetHabitsSpy).toHaveBeenCalled();
    expect(resetAccoladesSpy).toHaveBeenCalled();
    expect(clearFellowshipStateSpy).toHaveBeenCalled();
    expect(clearAllVolumesSpy).toHaveBeenCalled();
    expect(resetAllPreferencesSpy).toHaveBeenCalled();
    expect(usePreferencesStore.getState().stickyScrollEnabled).toBe(true);
    expect(usePreferencesStore.getState().exitBookmarkReminderEnabled).toBe(true);
    expect(usePreferencesStore.getState().speechRate).toBe(1.0);
    expect(useReaderStore.getState().fontSize).toBe(18);
    expect(useReaderStore.getState().brightness).toBe(100);
    expect(useReaderStore.getState().theme).toBe('light');
    expect(useReaderStore.getState().readingMode).toBe('paginated');
    expect(useReaderStore.getState().columnWidth).toBe('wide');
    expect(usePreferencesStore.getState().customDefaults).toBeNull();
    expect(usePreferencesStore.getState().preferencesUpdatedAt).toBeNull();
    expect(useAnnotationStore.getState().spoilerShieldEnabled).toBe(true);
    expect(clearOfflineSpy).toHaveBeenCalled();
    expect(sessionStorage.getItem('bookarium_auto_heal_attempted')).toBeNull();
  });

  describe('validateUsername', () => {
    it('rejects empty or whitespace-only username', () => {
      expect(validateUsername('').isValid).toBe(false);
      expect(validateUsername('   ').isValid).toBe(false);
      expect(validateUsername('').error).toContain('cannot be empty');
    });

    it('rejects username shorter than 3 characters', () => {
      expect(validateUsername('ab').isValid).toBe(false);
      expect(validateUsername('a').isValid).toBe(false);
      expect(validateUsername('ab').error).toContain('at least 3 characters');
    });

    it('rejects username longer than 30 characters', () => {
      const longUsername = 'a'.repeat(31);
      expect(validateUsername(longUsername).isValid).toBe(false);
      expect(validateUsername(longUsername).error).toContain('cannot exceed 30');
    });

    it('rejects invalid characters like spaces or special symbols', () => {
      expect(validateUsername('john doe').isValid).toBe(false);
      expect(validateUsername('scholar@book').isValid).toBe(false);
      expect(validateUsername('user!name').isValid).toBe(false);
    });

    it('accepts valid alphanumeric handles with underscores and hyphens', () => {
      expect(validateUsername('jane_austen').isValid).toBe(true);
      expect(validateUsername('book-lover-42').isValid).toBe(true);
      expect(validateUsername('Scholar123').isValid).toBe(true);
      expect(validateUsername('jane_austen').error).toBeNull();
    });
  });

  describe('updateProfile with public scholar settings', () => {
    it('rejects update when username is invalid', async () => {
      useAuthStore.setState({ user: { id: 'u1' } as any });
      const res = await useAuthStore.getState().updateProfile({ username: 'ab' });
      expect(res.error).toBeDefined();
      expect(res.error?.message).toContain('at least 3 characters');
    });

    it('normalizes username to lowercase and updates public profile preferences', async () => {
      useAuthStore.setState({
        user: { id: 'user-scholar' } as any,
        profile: { id: 'user-scholar', display_name: 'Scholar One' } as any,
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      mockFrom.mockReturnValue({
        update: mockUpdate,
      });

      const res = await useAuthStore.getState().updateProfile({
        username: '  Jane_Austen  ',
        bio: 'Passionate reader of 19th-century classics.',
        is_public: true,
        show_streak: true,
        show_challenge: false,
        show_bookshelves: true,
      });

      expect(res.error).toBeNull();
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'jane_austen',
          bio: 'Passionate reader of 19th-century classics.',
          is_public: true,
          show_streak: true,
          show_challenge: false,
          show_bookshelves: true,
        })
      );

      const state = useAuthStore.getState();
      expect(state.profile?.username).toBe('jane_austen');
      expect(state.profile?.bio).toBe('Passionate reader of 19th-century classics.');
      expect(state.profile?.is_public).toBe(true);
      expect(state.profile?.show_challenge).toBe(false);
    });

    it('normalizes empty string username to null', async () => {
      useAuthStore.setState({
        user: { id: 'user-scholar' } as any,
        profile: { id: 'user-scholar', username: 'old_handle' } as any,
      });

      const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      });
      mockFrom.mockReturnValue({
        update: mockUpdate,
      });

      const res = await useAuthStore.getState().updateProfile({
        username: '',
      });

      expect(res.error).toBeNull();
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          username: null,
        })
      );
      expect(useAuthStore.getState().profile?.username).toBeNull();
    });
  });

  describe('signOut', () => {
    it('signs out from Supabase, clears user profile, flushes outboxes, and resets all 6 local user stores', async () => {
      const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
      const { useAnnotationStore } = await import('@/stores/useAnnotationStore');
      const { useHabitsStore } = await import('@/stores/useHabitsStore');
      const { useAccoladesStore } = await import('@/stores/useAccoladesStore');
      const { useFellowshipStore } = await import('@/stores/useFellowshipStore');
      const { useReaderStore } = await import('@/stores/useReaderStore');
      const flushOutboxSpy = vi.spyOn(useBookshelfStore.getState(), 'flushOutbox').mockResolvedValue(undefined);
      const flushAnnotationOutboxSpy = vi.spyOn(useAnnotationStore.getState(), 'flushOutbox').mockResolvedValue(undefined);
      const clearBookshelfSpy = vi.spyOn(useBookshelfStore.getState(), 'clearBookshelf');
      const clearAnnotationsSpy = vi.spyOn(useAnnotationStore.getState(), 'clearAllAnnotations');
      const resetHabitsSpy = vi.spyOn(useHabitsStore.getState(), 'resetHabits');
      const resetAccoladesSpy = vi.spyOn(useAccoladesStore.getState(), 'resetAccolades');
      const clearFellowshipStateSpy = vi.spyOn(useFellowshipStore.getState(), 'clearFellowshipState');
      const resetReaderSessionSpy = vi.spyOn(useReaderStore.getState(), 'resetReaderSession');

      useAuthStore.setState({
        user: { id: 'user-to-logout' } as any,
        profile: { id: 'user-to-logout', display_name: 'Logged Out User' } as any,
      });

      await useAuthStore.getState().signOut();

      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'local' });
      expect(flushOutboxSpy).toHaveBeenCalledWith('user-to-logout');
      expect(flushAnnotationOutboxSpy).toHaveBeenCalledWith('user-to-logout');
      expect(clearBookshelfSpy).toHaveBeenCalled();
      expect(clearAnnotationsSpy).toHaveBeenCalled();
      expect(resetHabitsSpy).toHaveBeenCalled();
      expect(resetAccoladesSpy).toHaveBeenCalled();
      expect(clearFellowshipStateSpy).toHaveBeenCalled();
      expect(resetReaderSessionSpy).toHaveBeenCalled();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().profile).toBeNull();
    });

    it('supports explicit global signOut, signOutOtherDevices, listActiveSessions, and revokeSession', async () => {
      mockSignOut.mockResolvedValue({ error: null });
      useAuthStore.setState({
        user: { id: 'user-sessions-1', email: 'reader@bookarium.test' } as any,
        profile: { id: 'user-sessions-1', display_name: 'Reader One' } as any,
      });

      // 1. signOutOtherDevices keeps current user intact and uses scope: 'others'
      const othersRes = await useAuthStore.getState().signOutOtherDevices();
      expect(othersRes.error).toBeNull();
      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'others' });
      expect(useAuthStore.getState().user?.id).toBe('user-sessions-1');

      mockSignOut.mockResolvedValueOnce({ error: { message: 'Others failed' } });
      const othersErrRes = await useAuthStore.getState().signOutOtherDevices();
      expect(othersErrRes.error?.message).toBe('Others failed');

      // 2. listActiveSessions maps returned rows cleanly including masked ipAddress
      mockRpc.mockResolvedValueOnce({
        data: [
          {
            id: 'sess-current',
            user_agent: 'Mozilla/5.0 Chrome/130',
            ip_address: '203.0.113.x',
            created_at: '2026-11-14T10:00:00Z',
            updated_at: '2026-11-14T10:30:00Z',
            refreshed_at: '2026-11-14T10:45:00Z',
            not_after: null,
            is_current: true,
          },
        ],
        error: null,
      });
      const listRes = await useAuthStore.getState().listActiveSessions();
      expect(mockRpc).toHaveBeenCalledWith('get_active_sessions');
      expect(listRes.error).toBeNull();
      expect(listRes.sessions).toEqual([
        {
          id: 'sess-current',
          userAgent: 'Mozilla/5.0 Chrome/130',
          ipAddress: '203.0.113.x',
          createdAt: '2026-11-14T10:00:00Z',
          updatedAt: '2026-11-14T10:30:00Z',
          refreshedAt: '2026-11-14T10:45:00Z',
          notAfter: null,
          isCurrent: true,
        },
      ]);

      // PGRST202 unavailable RPC degrades gracefully without surfacing fatal error
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST202', message: 'Could not find the function public.get_active_sessions' },
      });
      const rpcMissingRes = await useAuthStore.getState().listActiveSessions();
      expect(rpcMissingRes).toEqual({
        sessions: [],
        error: null,
        isRpcUnavailable: true,
      });

      // Unexpected RPC error surfaces error cleanly
      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { code: '50000', message: 'Database unavailable' },
      });
      const rpcErrRes = await useAuthStore.getState().listActiveSessions();
      expect(rpcErrRes.sessions).toEqual([]);
      expect(rpcErrRes.error?.message).toBe('Database unavailable');

      // 3. revokeSession invokes public.revoke_user_session RPC
      mockRpc.mockResolvedValueOnce({ data: true, error: null });
      const revokeRes = await useAuthStore.getState().revokeSession('sess-other');
      expect(mockRpc).toHaveBeenCalledWith('revoke_user_session', {
        target_session_id: 'sess-other',
      });
      expect(revokeRes.error).toBeNull();

      mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Revoke failed' } });
      const revokeErrRes = await useAuthStore.getState().revokeSession('sess-other');
      expect(revokeErrRes.error?.message).toBe('Revoke failed');

      // 4. Explicit global signOut clears user and invokes scope: 'global'
      await useAuthStore.getState().signOut('global');
      expect(mockSignOut).toHaveBeenCalledWith({ scope: 'global' });
      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('offline-first auth & profile sync', () => {
    it('preserves persisted user and profile when initializeAuth runs offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
      useAuthStore.setState({
        user: { id: 'offline-user', email: 'offline@bookarium.test' } as any,
        profile: { id: 'offline-user', display_name: 'Offline Scholar' } as any,
        isLoading: true,
      });
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Network error' } });
      mockOnAuthStateChange.mockImplementationOnce((cb: any) => {
        cb('INITIAL_SESSION', null);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      try {
        useAuthStore.getState().initializeAuth();
        await Promise.resolve();

        expect(useAuthStore.getState().user?.id).toBe('offline-user');
        expect(useAuthStore.getState().profile?.display_name).toBe('Offline Scholar');
        expect(useAuthStore.getState().isLoading).toBe(false);
      } finally {
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
      }
    });

    it('preserves session user on transient network/reload errors while online and clears only on definitive 401/session_not_found errors', async () => {
      expect(isDefinitiveAuthInvalidError(null)).toBe(false);
      expect(isDefinitiveAuthInvalidError({ message: 'Failed to fetch', status: 0 })).toBe(false);
      expect(isDefinitiveAuthInvalidError({ status: 401 })).toBe(true);
      expect(isDefinitiveAuthInvalidError({ code: 'session_not_found' })).toBe(true);
      expect(isDefinitiveAuthInvalidError({ name: 'AuthSessionMissingError' })).toBe(true);

      const clientModule = await import('@/lib/supabase/client');
      const mockGetSession = vi.fn().mockResolvedValue({
        data: { session: { user: { id: 'oauth-user', email: 'oauth@bookarium.test' } } },
        error: null,
      });

      const createClientSpy = vi.spyOn(clientModule, 'createClient').mockImplementation(
        () =>
          ({
            auth: {
              getSession: mockGetSession,
              getUser: mockGetUser,
              onAuthStateChange: mockOnAuthStateChange,
            },
            from: mockFrom,
            rpc: mockRpc,
          }) as unknown as ReturnType<typeof clientModule.createClient>
      );

      let authCallback: ((event: string, session: unknown) => void) | undefined;
      mockOnAuthStateChange.mockImplementation((cb: (event: string, session: unknown) => void) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });

      try {
        // 1. Transient error (e.g. aborted fetch during deployment reload) + INITIAL_SESSION null race
        useAuthStore.setState({
          user: { id: 'oauth-user', email: 'oauth@bookarium.test' } as never,
          profile: { id: 'oauth-user', display_name: 'OAuth Scholar' } as never,
          isLoading: true,
        });
        mockGetUser.mockResolvedValueOnce({
          data: { user: null },
          error: { name: 'AuthRetryableFetchError', message: 'Failed to fetch', status: 0 },
        });
        mockFrom.mockReturnValueOnce({
          select: vi.fn().mockReturnValueOnce({
            eq: vi.fn().mockReturnValueOnce({
              single: vi.fn().mockResolvedValueOnce({
                data: { id: 'oauth-user', display_name: 'OAuth Scholar' },
                error: null,
              }),
            }),
          }),
        });

        useAuthStore.getState().initializeAuth();
        authCallback?.('INITIAL_SESSION', null);

        await vi.waitFor(() => {
          expect(useAuthStore.getState().isLoading).toBe(false);
        });
        expect(useAuthStore.getState().user?.id).toBe('oauth-user');
        expect(useAuthStore.getState().profile?.display_name).toBe('OAuth Scholar');

        // 2. Definitive 401 session_not_found error clears the invalid session
        mockGetUser.mockResolvedValueOnce({
          data: { user: null },
          error: { status: 401, code: 'session_not_found', message: 'Session not found' },
        });

        useAuthStore.getState().initializeAuth();
        await vi.waitFor(() => {
          expect(useAuthStore.getState().user).toBeNull();
        });
        expect(useAuthStore.getState().profile).toBeNull();
      } finally {
        createClientSpy.mockRestore();
      }
    });

    it('updates profile optimistically offline and flushes pendingProfileUpdates on syncWithCloud when online', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true, writable: true });
      useAuthStore.setState({
        user: { id: 'offline-user', email: 'offline@bookarium.test' } as any,
        profile: { id: 'offline-user', display_name: 'Before Offline Edit', is_public: false } as any,
        pendingProfileUpdates: null,
      });

      const res = await useAuthStore.getState().updateProfile({
        display_name: 'Edited Offline',
        bio: 'Offline biography note',
        is_public: true,
      });

      expect(res.error).toBeNull();
      expect(useAuthStore.getState().profile?.display_name).toBe('Edited Offline');
      expect(useAuthStore.getState().profile?.bio).toBe('Offline biography note');
      expect(useAuthStore.getState().pendingProfileUpdates).toEqual(
        expect.objectContaining({
          display_name: 'Edited Offline',
          bio: 'Offline biography note',
          is_public: true,
        })
      );

      // Reconnect and syncWithCloud
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true, writable: true });
      const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
      const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });
      const mockSelectSingle = vi.fn().mockResolvedValue({
        data: {
          id: 'offline-user',
          display_name: 'Edited Offline',
          bio: 'Offline biography note',
          is_public: true,
        },
        error: null,
      });
      mockFrom.mockImplementation(() => ({
        update: mockUpdate,
        select: () => ({ eq: () => ({ single: mockSelectSingle }) }),
      }));

      await useAuthStore.getState().syncWithCloud('offline-user');

      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'Edited Offline',
          bio: 'Offline biography note',
          is_public: true,
        })
      );
      expect(useAuthStore.getState().pendingProfileUpdates).toBeNull();
    });

    it('forwards optional Cloudflare Turnstile captchaToken across auth actions', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: { user: { id: 'u-cap', email: 'cap@bookarium.test' } },
        error: null,
      });
      await useAuthStore
        .getState()
        .signInWithPassword('cap@bookarium.test', 'secret123', 'cf-token-signin');
      expect(mockSignInWithPassword).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'cap@bookarium.test',
          password: 'secret123',
          options: { captchaToken: 'cf-token-signin' },
        })
      );

      mockSignUp.mockResolvedValueOnce({
        data: { user: { id: 'u-cap' }, session: null },
        error: null,
      });
      await useAuthStore
        .getState()
        .signUpWithPassword('cap@bookarium.test', 'secret123', 'Jane', 'cf-token-signup');
      expect(mockSignUp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'cap@bookarium.test',
          options: expect.objectContaining({ captchaToken: 'cf-token-signup' }),
        })
      );

      mockResend.mockResolvedValueOnce({ error: null });
      await useAuthStore
        .getState()
        .resendVerificationEmail('cap@bookarium.test', 'cf-token-resend');
      expect(mockResend).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'cap@bookarium.test',
          options: expect.objectContaining({ captchaToken: 'cf-token-resend' }),
        })
      );

      mockSignInWithOtp.mockResolvedValueOnce({ error: null });
      await useAuthStore.getState().signInWithOtp('cap@bookarium.test', 'cf-token-otp');
      expect(mockSignInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'cap@bookarium.test',
          options: expect.objectContaining({ captchaToken: 'cf-token-otp' }),
        })
      );

      mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });
      await useAuthStore
        .getState()
        .resetPasswordForEmail('cap@bookarium.test', 'cf-token-reset');
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
        'cap@bookarium.test',
        expect.objectContaining({ captchaToken: 'cf-token-reset' })
      );
    });
  });

  describe('Auth & sync coalescing guarantees', () => {
    it('coalesces overlapping Strict-Mode initializeAuth calls onto one getUser request and resets on settle', async () => {
      let resolveUser!: (val: { data: { user: { id: string; email: string } | null }; error: null }) => void;
      const pendingGetUser = new Promise<{
        data: { user: { id: string; email: string } | null };
        error: null;
      }>((resolve) => {
        resolveUser = resolve;
      });

      mockGetUser
        .mockReturnValueOnce(pendingGetUser)
        .mockResolvedValueOnce({ data: { user: null }, error: null });
      mockOnAuthStateChange.mockImplementation(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }));
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 'strict-user', display_name: 'Strict Scholar' },
              error: null,
            }),
          }),
        }),
      });

      const unsub1 = useAuthStore.getState().initializeAuth();
      unsub1();
      useAuthStore.getState().initializeAuth();

      expect(mockGetUser).toHaveBeenCalledTimes(1);

      resolveUser({
        data: { user: { id: 'strict-user', email: 'strict@bookarium.test' } },
        error: null,
      });

      await vi.waitFor(() => {
        expect(useAuthStore.getState().isLoading).toBe(false);
        expect(useAuthStore.getState().user?.id).toBe('strict-user');
      });

      // After settlement, a subsequent sequential initializeAuth call runs normally
      useAuthStore.getState().initializeAuth();
      await vi.waitFor(() => {
        expect(mockGetUser).toHaveBeenCalledTimes(2);
      });
    });

    it('skips duplicate INITIAL_SESSION profile fetch while checkInitialUser is still pending', async () => {
      let resolveUser!: (val: { data: { user: { id: string; email: string } }; error: null }) => void;
      const pendingUser = new Promise<{
        data: { user: { id: string; email: string } };
        error: null;
      }>((resolve) => {
        resolveUser = resolve;
      });

      const profileSingleMock = vi.fn().mockResolvedValue({
        data: { id: 'init-user', display_name: 'Init Scholar' },
        error: null,
      });
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: profileSingleMock,
          }),
        }),
      });

      let capturedCallback: ((event: string, session: unknown) => void) | undefined;
      mockOnAuthStateChange.mockImplementation((cb) => {
        capturedCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      });
      mockGetUser.mockReturnValueOnce(pendingUser);

      useAuthStore.getState().initializeAuth();

      // Concurrent INITIAL_SESSION with truthy session while checkInitialUser is pending is suppressed
      capturedCallback?.('INITIAL_SESSION', {
        user: { id: 'init-user', email: 'init@bookarium.test' },
      });
      expect(profileSingleMock).not.toHaveBeenCalled();

      resolveUser({
        data: { user: { id: 'init-user', email: 'init@bookarium.test' } },
        error: null,
      });

      await vi.waitFor(() => {
        expect(profileSingleMock).toHaveBeenCalledTimes(1);
        expect(useAuthStore.getState().profile?.display_name).toBe('Init Scholar');
      });
    });

    it('coalesces concurrent fetchProfile calls per user without suppressing subsequent sequential fetches', async () => {
      let resolveSingle!: (val: { data: { id: string; display_name: string }; error: null }) => void;
      const singleMock = vi
        .fn()
        .mockReturnValueOnce(
          new Promise<{ data: { id: string; display_name: string }; error: null }>((resolve) => {
            resolveSingle = resolve;
          })
        )
        .mockResolvedValueOnce({
          data: { id: 'prof-user', display_name: 'Fresh Refetch' },
          error: null,
        });

      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: singleMock,
          }),
        }),
      });

      useAuthStore.setState({
        user: { id: 'prof-user', email: 'prof@bookarium.test' } as unknown as NonNullable<
          ReturnType<typeof useAuthStore.getState>['user']
        >,
      });

      const p1 = useAuthStore.getState().fetchProfile();
      const p2 = useAuthStore.getState().fetchProfile();
      expect(p1).toBe(p2);
      expect(singleMock).toHaveBeenCalledTimes(1);

      resolveSingle({ data: { id: 'prof-user', display_name: 'Initial Fetch' }, error: null });
      await p1;
      expect(useAuthStore.getState().profile?.display_name).toBe('Initial Fetch');

      // Sequential follow-up executes immediately without TTL suppression
      await useAuthStore.getState().fetchProfile();
      expect(singleMock).toHaveBeenCalledTimes(2);
      expect(useAuthStore.getState().profile?.display_name).toBe('Fresh Refetch');
    });

    it('coalesceInFlightByUser collapses passive callers and executes one trailing pass when marked dirty', async () => {
      const inFlight = new Map<string, Promise<void>>();
      const dirtyUsers = new Set<string>();
      let calls = 0;
      let releaseFirst!: () => void;

      const runFirst = coalesceInFlightByUser(
        inFlight,
        'u-helper',
        async () => {
          calls += 1;
          if (calls === 1) {
            await new Promise<void>((resolve) => {
              releaseFirst = resolve;
            });
          }
        },
        dirtyUsers
      );
      const runPassiveJoin = coalesceInFlightByUser(
        inFlight,
        'u-helper',
        async () => {
          calls += 1;
        },
        dirtyUsers
      );

      expect(runPassiveJoin).toBe(runFirst);
      expect(calls).toBe(1);

      // Simulate a local write arriving mid-flight
      dirtyUsers.add('u-helper');
      releaseFirst();
      await runFirst;

      expect(calls).toBe(2);
      expect(inFlight.size).toBe(0);
      expect(dirtyUsers.size).toBe(0);
    });
  });
});