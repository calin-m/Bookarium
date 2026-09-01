import { create } from 'zustand';
import type { User, AuthError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types/database.types';

export type AuthModalView = 'sign_in' | 'sign_up' | 'magic_link' | 'forgot_password';

export interface AuthState {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  isAuthModalOpen: boolean;
  authModalView: AuthModalView;
  error: string | null;

  // Actions
  initializeAuth: () => () => void;
  openAuthModal: (view?: AuthModalView) => void;
  closeAuthModal: () => void;
  setAuthModalView: (view: AuthModalView) => void;
  setError: (error: string | null) => void;
  signInWithPassword: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUpWithPassword: (email: string, password: string, fullName?: string) => Promise<{
    user?: User | null;
    session?: any;
    needsEmailConfirmation?: boolean;
    error: AuthError | null;
  }>;
  signInWithOtp: (email: string) => Promise<{ error: AuthError | null }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  updateProfile: (updates: {
    display_name?: string;
    preferred_theme?: string;
    font_size?: number;
  }) => Promise<{ error: Error | null }>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  profile: null,
  isLoading: true,
  isAuthModalOpen: false,
  authModalView: 'sign_in',
  error: null,

  initializeAuth: () => {
    const supabase = createClient();

    // Check active session on initialization
    supabase.auth.getUser().then(({ data: { user } }) => {
      set({ user, isLoading: false });
      if (user) {
        get().fetchProfile();
      }
    }).catch(() => {
      set({ user: null, profile: null, isLoading: false });
    });

    // Subscribe to auth state transitions
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
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
    set({ isAuthModalOpen: true, authModalView: view, error: null });
  },

  closeAuthModal: () => {
    set({ isAuthModalOpen: false, error: null });
  },

  setAuthModalView: (view) => {
    set({ authModalView: view, error: null });
  },

  setError: (error) => {
    set({ error });
  },

  signInWithPassword: async (email, password) => {
    set({ error: null });
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ error: error.message });
      return { error };
    }
    set({ user: data.user, isAuthModalOpen: false });
    get().fetchProfile();
    return { error: null };
  },

  signUpWithPassword: async (email, password, fullName) => {
    set({ error: null });
    const supabase = createClient();
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || '',
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
      set({ user: data.user, isAuthModalOpen: false });
      get().fetchProfile();
    }
    return {
      user: data.user,
      session: data.session,
      needsEmailConfirmation: !hasSession,
      error: null,
    };
  },

  signInWithOtp: async (email) => {
    set({ error: null });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    if (error) {
      set({ error: error.message });
      return { error };
    }
    return { error: null };
  },

  signInWithOAuth: async (provider) => {
    set({ error: null });
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      },
    });
    if (error) {
      set({ error: error.message });
      return { error };
    }
    return { error: null };
  },

  signOut: async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    set({ user: null, profile: null, isAuthModalOpen: false, error: null });
  },

  fetchProfile: async () => {
    const { user } = get();
    if (!user) return;

    try {
      const supabase = createClient();
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

  updateProfile: async (updates) => {
    const { user } = get();
    if (!user) return { error: new Error('User not logged in') };

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) {
        set({ error: error.message });
        return { error: new Error(error.message) };
      }

      set((state) => ({
        profile: state.profile ? ({ ...state.profile, ...updates } as Profile) : null,
      }));
      return { error: null };
    } catch (err: any) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  },
}));