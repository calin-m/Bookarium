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

  it('handles signInWithOAuth success and error with /auth/callback redirect', async () => {
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
      authChangeCallback('PASSWORD_RECOVERY', {
        user: { id: 'init-user', email: 'init@bookarium.test' },
      });
      expect(useAuthStore.getState().isPasswordRecovery).toBe(true);

      authChangeCallback('SIGNED_OUT', null);
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().profile).toBeNull();
      expect(useAuthStore.getState().isPasswordRecovery).toBe(false);
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
    const resetSpeechSpy = vi.spyOn(usePreferencesStore.getState(), 'resetSpeechPreferences');
    const clearOfflineSpy = vi.spyOn(offlineStorage, 'clearAllOfflineBooks').mockResolvedValue(undefined);

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

    // Verify all local persistent stores, IndexedDB books, and session flags were wiped
    expect(clearBookshelfSpy).toHaveBeenCalled();
    expect(clearAllAnnotationsSpy).toHaveBeenCalled();
    expect(resetHabitsSpy).toHaveBeenCalled();
    expect(resetAccoladesSpy).toHaveBeenCalled();
    expect(clearFellowshipStateSpy).toHaveBeenCalled();
    expect(clearAllVolumesSpy).toHaveBeenCalled();
    expect(resetSpeechSpy).toHaveBeenCalled();
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

      expect(mockSignOut).toHaveBeenCalled();
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
  });
});