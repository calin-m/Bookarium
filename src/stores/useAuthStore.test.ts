import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuthStore, validateUsername } from './useAuthStore';

const mockSignInWithPassword = vi.fn();
const mockSignUp = vi.fn();
const mockSignInWithOtp = vi.fn();
const mockSignInWithOAuth = vi.fn();
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
    });
  });

  it('manages modal open, close, and view state transitions', () => {
    const store = useAuthStore.getState();

    store.openAuthModal('sign_up');
    expect(useAuthStore.getState().isAuthModalOpen).toBe(true);
    expect(useAuthStore.getState().authModalView).toBe('sign_up');

    store.setAuthModalView('magic_link');
    expect(useAuthStore.getState().authModalView).toBe('magic_link');

    store.closeAuthModal();
    expect(useAuthStore.getState().isAuthModalOpen).toBe(false);
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

  it('handles signInWithOtp (magic link) success and error', async () => {
    mockSignInWithOtp.mockResolvedValueOnce({ error: null });
    const res1 = await useAuthStore.getState().signInWithOtp('reader@bookarium.org');
    expect(res1.error).toBeNull();

    mockSignInWithOtp.mockResolvedValueOnce({ error: { message: 'Rate limit exceeded' } });
    const res2 = await useAuthStore.getState().signInWithOtp('reader@bookarium.org');
    expect(res2.error?.message).toBe('Rate limit exceeded');
    expect(useAuthStore.getState().error).toBe('Rate limit exceeded');
  });

  it('handles signInWithOAuth success and error', async () => {
    mockSignInWithOAuth.mockResolvedValueOnce({ error: null });
    const res1 = await useAuthStore.getState().signInWithOAuth('google');
    expect(res1.error).toBeNull();

    mockSignInWithOAuth.mockResolvedValueOnce({ error: { message: 'OAuth failed' } });
    const res2 = await useAuthStore.getState().signInWithOAuth('github');
    expect(res2.error?.message).toBe('OAuth failed');
    expect(useAuthStore.getState().error).toBe('OAuth failed');
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

    if (authChangeCallback) {
      authChangeCallback('SIGNED_OUT', null);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().profile).toBeNull();
    }
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

  it('handles resetPasswordForEmail success and failure', async () => {
    mockResetPasswordForEmail.mockResolvedValueOnce({ error: null });
    const res1 = await useAuthStore.getState().resetPasswordForEmail('user@bookarium.test');
    expect(res1.error).toBeNull();
    expect(mockResetPasswordForEmail).toHaveBeenCalledWith(
      'user@bookarium.test',
      expect.objectContaining({ redirectTo: expect.stringContaining('/account') })
    );

    mockResetPasswordForEmail.mockResolvedValueOnce({ error: { message: 'User not found' } });
    const res2 = await useAuthStore.getState().resetPasswordForEmail('unknown@bookarium.test');
    expect(res2.error?.message).toBe('User not found');
    expect(useAuthStore.getState().error).toBe('User not found');
  });

  it('handles updatePassword success and failure', async () => {
    mockUpdateUser.mockResolvedValueOnce({ error: null });
    const res1 = await useAuthStore.getState().updatePassword('newPassword123');
    expect(res1.error).toBeNull();
    expect(mockUpdateUser).toHaveBeenCalledWith({ password: 'newPassword123' });

    mockUpdateUser.mockResolvedValueOnce({ error: { message: 'Password too weak' } });
    const res2 = await useAuthStore.getState().updatePassword('123');
    expect(res2.error?.message).toBe('Password too weak');
    expect(useAuthStore.getState().error).toBe('Password too weak');
  });

  it('handles requestAccountDeletion success and failure', async () => {
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
        emailRedirectTo: expect.stringContaining('/auth/confirm-deletion'),
      },
    });

    // Logged in failure
    mockSignInWithOtp.mockResolvedValueOnce({ error: { message: 'Auth rate limit' } });
    const res3 = await useAuthStore.getState().requestAccountDeletion();
    expect(res3.error?.message).toBe('Auth rate limit');
    expect(useAuthStore.getState().error).toBe('Auth rate limit');
  });

  it('handles deleteAccount success and failure', async () => {
    // Logged out
    useAuthStore.setState({ user: null });
    const res1 = await useAuthStore.getState().deleteAccount();
    expect(res1.error?.message).toBe('No active user session');

    // Logged in success
    useAuthStore.setState({ user: { id: 'user-delete' } as any, profile: { id: 'user-delete' } as any });
    const mockDelete = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFrom.mockReturnValue({
      delete: mockDelete,
    });
    mockSignOut.mockResolvedValueOnce({ error: null });

    const res2 = await useAuthStore.getState().deleteAccount();
    expect(res2.error).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().profile).toBeNull();
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
    it('signs out from Supabase, clears user profile, flushes outbox, and cleanses local bookshelf', async () => {
      const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
      const flushOutboxSpy = vi.spyOn(useBookshelfStore.getState(), 'flushOutbox').mockResolvedValue(undefined);
      const clearBookshelfSpy = vi.spyOn(useBookshelfStore.getState(), 'clearBookshelf');

      useAuthStore.setState({
        user: { id: 'user-to-logout' } as any,
        profile: { id: 'user-to-logout', display_name: 'Logged Out User' } as any,
      });

      await useAuthStore.getState().signOut();

      expect(mockSignOut).toHaveBeenCalled();
      expect(flushOutboxSpy).toHaveBeenCalledWith('user-to-logout');
      expect(clearBookshelfSpy).toHaveBeenCalled();
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().profile).toBeNull();
    });
  });
});