import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database.types';
import { ROUTES } from '@/config/routes';
import { buildAuthRedirectUrl } from '@/lib/redirect-sanitizer';

export type AuthModalView = 'sign_in' | 'sign_up' | 'magic_link' | 'forgot_password';

export interface UsernameValidationResult {
  isValid: boolean;
  error: string | null;
}

export function validateUsername(username: string): UsernameValidationResult {
  const trimmed = username.trim();
  if (!trimmed) {
    return { isValid: false, error: 'Username cannot be empty.' };
  }
  if (trimmed.length < 3) {
    return { isValid: false, error: 'Username must be at least 3 characters long.' };
  }
  if (trimmed.length > 30) {
    return { isValid: false, error: 'Username cannot exceed 30 characters.' };
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
    return { isValid: false, error: 'Username can only contain letters, numbers, underscores, and hyphens.' };
  }
  return { isValid: true, error: null };
}

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  pendingProfileUpdates: Partial<Profile> | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalView: AuthModalView;
  error: string | null;
  statusMessage: string | null;

  // Actions
  initializeAuth: () => () => void;
  openAuthModal: (view?: AuthModalView) => void;
  closeAuthModal: () => void;
  setAuthModalView: (view: AuthModalView) => void;
  setError: (error: string | null) => void;
  setStatusMessage: (statusMessage: string | null) => void;
  signInWithPassword: (email: string, password: string) => Promise<{ user?: User | null; error: AuthError | null }>;
  signUpWithPassword: (email: string, password: string, fullName?: string) => Promise<{
    user?: User | null;
    session?: Session | null;
    needsEmailConfirmation?: boolean;
    error: AuthError | null;
  }>;
  resendVerificationEmail: (email: string) => Promise<{ error: AuthError | null }>;
  signInWithOtp: (email: string) => Promise<{ error: AuthError | null }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  syncWithCloud: (userId?: string) => Promise<void>;
  updateProfile: (updates: {
    display_name?: string;
    preferred_theme?: string;
    font_size?: number;
    username?: string | null;
    bio?: string | null;
    is_public?: boolean;
    show_streak?: boolean;
    show_challenge?: boolean;
    show_bookshelves?: boolean;
    show_saved_books?: boolean;
    show_custom_shelves?: boolean;
  }) => Promise<{ error: Error | null }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  requestAccountDeletion: () => Promise<{ error: AuthError | null }>;
  deleteAccount: () => Promise<{ error: Error | null }>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      pendingProfileUpdates: null,
      isLoading: true,
      isAuthModalOpen: false,
      authModalView: 'sign_in',
      error: null,
      statusMessage: null,

  initializeAuth: () => {
    const supabase = createClient();

    if (typeof navigator !== 'undefined' && navigator.onLine === false && get().user) {
      set({ isLoading: false });
    }

    // Check active session on initialization
    supabase.auth.getUser().then(({ data: { user }, error }) => {
      if ((error || !user) && typeof navigator !== 'undefined' && navigator.onLine === false && get().user) {
        set({ isLoading: false });
        return;
      }
      set({ user: user ?? null, isLoading: false });
      if (user) {
        get().fetchProfile();
      }
    }).catch(() => {
      if (get().user) {
        set({ isLoading: false });
      } else {
        set({ user: null, profile: null, isLoading: false });
      }
    });

    // Subscribe to auth state transitions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event !== 'SIGNED_OUT' &&
        !session &&
        typeof navigator !== 'undefined' &&
        navigator.onLine === false &&
        get().user
      ) {
        set({ isLoading: false });
        return;
      }
      const user = session?.user ?? null;
      set({ user, isLoading: false });
      if (user) {
        get().fetchProfile();
      } else {
        set({ profile: null });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  },

  openAuthModal: (view = 'sign_in') => {
    set({ isAuthModalOpen: true, authModalView: view, error: null, statusMessage: null });
  },

  closeAuthModal: () => {
    set({ isAuthModalOpen: false, error: null, statusMessage: null });
  },

  setAuthModalView: (view) => {
    set({ authModalView: view, error: null, statusMessage: null });
  },

  setError: (error) => {
    set({ error });
  },

  setStatusMessage: (statusMessage) => {
    set({ statusMessage });
  },

  signInWithPassword: async (email, password) => {
    set({ error: null, statusMessage: null });
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ error: error.message });
      return { error };
    }
    set({ user: data.user, isAuthModalOpen: false, statusMessage: null });
    get().fetchProfile();
    return { error: null, user: data.user };
  },

  signUpWithPassword: async (email, password, fullName) => {
    set({ error: null, statusMessage: null });
    const supabase = createClient();
    const redirectTo = buildAuthRedirectUrl('/auth/callback');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || '',
          display_name: fullName || '',
        },
        emailRedirectTo: redirectTo,
      },
    });
    if (error) {
      set({ error: error.message });
      return { user: null, session: null, needsEmailConfirmation: false, error };
    }

    const hasSession = !!data.session;
    if (hasSession) {
      set({ user: data.user, isAuthModalOpen: false, statusMessage: null });
      get().fetchProfile();
    }
    return {
      user: data.user,
      session: data.session,
      needsEmailConfirmation: !hasSession,
      error: null,
    };
  },

  resendVerificationEmail: async (email: string) => {
    set({ error: null });
    const supabase = createClient();
    const redirectTo = buildAuthRedirectUrl('/auth/callback');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });
    if (error) {
      set({ error: error.message });
      return { error };
    }
    return { error: null };
  },

  signInWithOtp: async (email) => {
    set({ error: null, statusMessage: null });
    const supabase = createClient();
    const redirectTo = buildAuthRedirectUrl('/auth/callback');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });
    if (error) {
      set({ error: error.message });
      return { error };
    }
    return { error: null };
  },

  signInWithOAuth: async (provider) => {
    set({ error: null, statusMessage: null });
    const supabase = createClient();
    const redirectTo = buildAuthRedirectUrl('/auth/callback');
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
      },
    });
    if (error) {
      set({ error: error.message });
      return { error };
    }
    return { error: null };
  },

  signOut: async () => {
    const { user } = get();
    if (user?.id) {
      try {
        const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
        await useBookshelfStore.getState().flushOutbox(user.id);
      } catch {
        // Non-blocking fallback
      }
    }

    const supabase = createClient();
    await supabase.auth.signOut();
    set({
      user: null,
      profile: null,
      pendingProfileUpdates: null,
      isAuthModalOpen: false,
      error: null,
      statusMessage: null,
    });

    try {
      const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
      useBookshelfStore.getState().clearBookshelf();
    } catch {
      // Non-blocking fallback
    }

    try {
      const { useFellowshipStore } = await import('@/stores/useFellowshipStore');
      useFellowshipStore.getState().clearFellowshipState();
    } catch {
      // Non-blocking fallback
    }
  },

  fetchProfile: async () => {
    const { user, pendingProfileUpdates } = get();
    if (!user) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    try {
      const supabase = createClient();

      if (pendingProfileUpdates && Object.keys(pendingProfileUpdates).length > 0) {
        const { error: flushErr } = await supabase
          .from('profiles')
          .update(pendingProfileUpdates)
          .eq('id', user.id);
        if (!flushErr) {
          set({ pendingProfileUpdates: null });
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (!error && data) {
        set({ profile: data as Profile });
      }
    } catch {
      // Non-blocking fallback
    }
  },

  syncWithCloud: async (userId?: string) => {
    const targetUserId = userId || get().user?.id;
    if (!targetUserId) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    try {
      const pending = get().pendingProfileUpdates;
      if (pending && Object.keys(pending).length > 0 && targetUserId !== get().user?.id) {
        const supabase = createClient();
        const { error } = await supabase
          .from('profiles')
          .update(pending)
          .eq('id', targetUserId);
        if (!error) {
          set({ pendingProfileUpdates: null });
        }
      }
      await get().fetchProfile();
    } catch {
      // Non-blocking fallback
    }
  },

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return { error: new Error('User not logged in') };

    let normalizedUsername = updates.username;
    if (updates.username !== undefined) {
      if (updates.username === null || updates.username.trim() === '') {
        normalizedUsername = null;
      } else {
        const trimmed = updates.username.trim().toLowerCase();
        const validation = validateUsername(trimmed);
        if (!validation.isValid) {
          return { error: new Error(validation.error || 'Invalid username') };
        }
        normalizedUsername = trimmed;
      }
    }

    const payload = {
      ...updates,
      ...(updates.username !== undefined ? { username: normalizedUsername } : {}),
      updated_at: new Date().toISOString(),
    };

    const mergeProfile = (current: Profile | null): Profile =>
      ({ ...(current || { id: user.id }), ...payload }) as Profile;

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      set((state) => ({
        profile: mergeProfile(state.profile),
        pendingProfileUpdates: {
          ...(state.pendingProfileUpdates || {}),
          ...payload,
        },
        error: null,
      }));
      return { error: null };
    }

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id);

      if (error) {
        set({ error: error.message });
        return { error: new Error(error.message) };
      }

      set((state) => ({
        profile: mergeProfile(state.profile),
      }));

      if (updates.username !== undefined || updates.display_name !== undefined) {
        try {
          const { useFellowshipStore } = await import('./useFellowshipStore');
          await useFellowshipStore.getState().fetchFellowshipData(user.id);
          const { useAnnotationStore } = await import('./useAnnotationStore');
          useAnnotationStore.getState().enrichFellowAnnotations();
        } catch {
          // Non-blocking sync
        }
      }

      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  resetPasswordForEmail: async (email) => {
    set({ error: null, statusMessage: null });
    const supabase = createClient();
    const redirectTo = buildAuthRedirectUrl(ROUTES.ACCOUNT);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) {
      set({ error: error.message });
      return { error };
    }
    return { error: null };
  },

  updatePassword: async (newPassword) => {
    set({ error: null });
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      set({ error: error.message });
      return { error };
    }
    return { error: null };
  },

  requestAccountDeletion: async () => {
    const { user } = get();
    if (!user?.email) return { error: { message: 'No active user session found' } as AuthError };

    set({ error: null });
    const supabase = createClient();
    const redirectTo = buildAuthRedirectUrl('/auth/confirm-deletion');
    const { error } = await supabase.auth.signInWithOtp({
      email: user.email,
      options: {
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      set({ error: error.message });
      return { error };
    }
    return { error: null };
  },

  deleteAccount: async () => {
    const { user } = get();
    if (!user) return { error: new Error('No active user session') };

    try {
      const supabase = createClient();
      // 1. Clean up user's relational records across all 11 schema tables
      await supabase
        .from('symposium_sessions')
        .delete()
        .or(`host_id.eq.${user.id},fellow_id.eq.${user.id}`);
      await supabase
        .from('reader_circles')
        .delete()
        .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`);
      await supabase.from('user_accolades').delete().eq('user_id', user.id);
      await supabase.from('user_annotations').delete().eq('user_id', user.id);
      await supabase.from('reading_progress').delete().eq('user_id', user.id);
      await supabase.from('user_favorites').delete().eq('user_id', user.id);
      await supabase.from('user_book_curation').delete().eq('user_id', user.id);
      await supabase.from('user_reading_habits').delete().eq('user_id', user.id);
      await supabase.from('bookshelf_items').delete().eq('user_id', user.id);
      await supabase.from('bookshelves').delete().eq('user_id', user.id);
      // 2. Clean up profile
      await supabase.from('profiles').delete().eq('id', user.id);
      // 3. Attempt RPC user account deletion if configured on database
      try {
        await supabase.rpc('delete_current_user');
      } catch {
        // Non-blocking fallback if RPC is not provisioned
      }
      // 4. Terminate auth session and clear all local persisted user stores
      await supabase.auth.signOut();
      set({
        user: null,
        profile: null,
        pendingProfileUpdates: null,
        isAuthModalOpen: false,
        error: null,
        statusMessage: null,
      });

      const localCleanupTasks: Array<() => Promise<unknown>> = [
        async () => {
          const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
          useBookshelfStore.getState().clearBookshelf();
        },
        async () => {
          const { useAnnotationStore } = await import('@/stores/useAnnotationStore');
          useAnnotationStore.getState().clearAllAnnotations();
        },
        async () => {
          const { useHabitsStore } = await import('@/stores/useHabitsStore');
          useHabitsStore.getState().resetHabits();
        },
        async () => {
          const { useAccoladesStore } = await import('@/stores/useAccoladesStore');
          useAccoladesStore.getState().resetAccolades();
        },
        async () => {
          const { useFellowshipStore } = await import('@/stores/useFellowshipStore');
          useFellowshipStore.getState().clearFellowshipState();
        },
        async () => {
          const { useReaderStore } = await import('@/stores/useReaderStore');
          await useReaderStore.getState().clearAllVolumes();
        },
      ];

      await Promise.allSettled(localCleanupTasks.map((task) => task()));
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  },
}),
    {
      name: 'bookarium-auth-profile',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        pendingProfileUpdates: state.pendingProfileUpdates,
      }),
    }
  )
);