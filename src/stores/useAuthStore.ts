import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { User, UserIdentity, Session, AuthError } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Profile, Json } from '@/types/database.types';
import { ROUTES } from '@/config/routes';
import { STORAGE_KEYS } from '@/config/site-config';
import { safeLocalStorage } from '@/lib/safe-storage';
import { buildAuthRedirectUrl, sanitizeRedirectPath } from '@/lib/redirect-sanitizer';
import {
  isRecoverySessionAmrVerified,
  readConsumedRecoverySentAt,
  markRecoveryConsumed,
  clearConsumedRecoveryMarker,
} from '@/lib/auth-recovery';
import type { ActiveUserSession } from '@/lib/session-device-parser';

function isSessionRpcUnavailableError(
  error: { code?: string; message?: string } | null | undefined
): boolean {
  if (!error) return false;
  const code = typeof error.code === 'string' ? error.code : '';
  if (code === 'PGRST202' || code === '42883') {
    return true;
  }
  const msg = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return (
    msg.includes('could not find the function') ||
    (msg.includes('get_active_sessions') &&
      (msg.includes('does not exist') || msg.includes('schema cache')))
  );
}

export function syncAuthCookieHint(isAuthenticated: boolean): void {
  if (typeof document === 'undefined') return;
  try {
    const value = isAuthenticated ? 'authenticated' : 'guest';
    document.cookie = `${STORAGE_KEYS.AUTH_HINT}=${value}; path=/; max-age=2592000; SameSite=Lax`;
  } catch {
    // Non-blocking
  }
}

export function hasSupabaseAuthCookie(): boolean {
  if (typeof document === 'undefined' || typeof document.cookie !== 'string') {
    return false;
  }
  return /\bsb-[^=;]+-auth-token/.test(document.cookie);
}

function hasClientIpSyncCookie(): boolean {
  if (typeof document === 'undefined' || typeof document.cookie !== 'string') {
    return false;
  }
  return document.cookie
    .split(';')
    .some((part) => part.trim() === `${STORAGE_KEYS.CLIENT_IP_SYNC}=1`);
}

function clearClientIpSyncCookie(): void {
  if (typeof document === 'undefined') return;
  try {
    document.cookie = `${STORAGE_KEYS.CLIENT_IP_SYNC}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    // Non-blocking
  }
}

export interface SessionVerifiableClient {
  auth?: {
    getSession?: () => Promise<{
      data?: {
        session?: {
          access_token?: string;
          user?: { id?: string } | null;
        } | null;
      } | null;
      error?: unknown;
    }>;
  };
}

export function shouldVerifyCloudSession(
  supabase: SessionVerifiableClient | null | undefined
): boolean {
  const getSessionFn = supabase?.auth?.getSession;
  if (typeof getSessionFn !== 'function') {
    return false;
  }
  if (process.env.NODE_ENV === 'test' && !('mock' in getSessionFn)) {
    return false;
  }
  return true;
}

/**
 * Verifies that the browser Supabase client has an active, non-expired JWT session
 * matching `userId` before executing cloud store SELECT/UPSERT queries.
 * Prevents unauthenticated requests (`auth.uid() = NULL`) from returning false `data: []`
 * responses or triggering PostgreSQL `42501` RLS errors after browser cookie clearance.
 */
export async function verifyActiveCloudSession(
  supabase: SessionVerifiableClient | null | undefined,
  userId: string
): Promise<boolean> {
  if (!userId) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return false;
  }
  if (!shouldVerifyCloudSession(supabase)) {
    return true;
  }
  const getSessionFn = supabase!.auth!.getSession!;
  try {
    const { data, error } = await getSessionFn.call(supabase?.auth);
    if (error) {
      return false;
    }
    const session = data?.session;
    if (!session?.access_token || session.user?.id !== userId) {
      if (
        !session &&
        !hasSupabaseAuthCookie() &&
        useAuthStore.getState().user?.id === userId
      ) {
        syncAuthCookieHint(false);
        useAuthStore.setState({ user: null, profile: null, isLoading: false });
      }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Coalesces concurrent async operations keyed by `userId` into a single active promise.
 * When `dirtyRerunUsers` contains `userId` (set when a local mutation arrives mid-flight),
 * executes one trailing pass after the active run settles instead of dropping the write.
 */
export function coalesceInFlightByUser(
  inFlightMap: Map<string, Promise<void>>,
  userId: string,
  task: () => Promise<void>,
  dirtyRerunUsers?: Set<string>
): Promise<void> {
  const existing = inFlightMap.get(userId);
  if (existing) {
    return existing;
  }

  const run = (async () => {
    try {
      do {
        dirtyRerunUsers?.delete(userId);
        await task();
      } while (dirtyRerunUsers?.has(userId));
    } finally {
      inFlightMap.delete(userId);
      dirtyRerunUsers?.delete(userId);
    }
  })();

  inFlightMap.set(userId, run);
  return run;
}

const SESSION_VALIDITY_CHECK_COOLDOWN_MS = 10_000;
const CLIENT_IP_SYNC_COOLDOWN_MS = 10_000;

let inFlightInitialUserCheck: Promise<void> | null = null;
let inFlightSessionCheck: Promise<boolean> | null = null;
let lastSessionCheckAtMs = 0;
let inFlightClientIpSync: Promise<void> | null = null;
let lastClientIpSyncAtMs = 0;
const inFlightProfileFetchByUser = new Map<string, Promise<void>>();
const dirtyProfileSyncUsers = new Set<string>();

const DEFINITIVE_AUTH_ERROR_CODES = new Set([
  'session_not_found',
  'user_not_found',
  'user_banned',
  'refresh_token_not_found',
  'refresh_token_already_used',
  'session_expired',
  'invalid_jwt',
  'bad_jwt',
]);

/**
 * Distinguishes definitive server-side session/token rejection errors from
 * transient network, timeout, or navigation-abort errors during page reloads.
 */
export function isDefinitiveAuthInvalidError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { status?: unknown; code?: unknown; name?: unknown };
  if (
    candidate.status === 400 ||
    candidate.status === 401 ||
    candidate.status === 403
  ) {
    return true;
  }
  if (typeof candidate.code === 'string' && DEFINITIVE_AUTH_ERROR_CODES.has(candidate.code)) {
    return true;
  }
  if (candidate.name === 'AuthSessionMissingError') {
    return true;
  }
  return false;
}

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
  isPasswordRecovery: boolean;
  error: string | null;
  statusMessage: string | null;

  // Actions
  initializeAuth: () => () => void;
  verifyActiveSessionValidity: (options?: { force?: boolean }) => Promise<boolean>;
  reconcileClientSessionOrigin: () => Promise<void>;
  openAuthModal: (view?: AuthModalView) => void;
  closeAuthModal: () => void;
  setAuthModalView: (view: AuthModalView) => void;
  clearPasswordRecovery: () => void;
  verifyPasswordRecoverySession: () => Promise<boolean>;
  setError: (error: string | null) => void;
  setStatusMessage: (statusMessage: string | null) => void;
  signInWithPassword: (email: string, password: string, captchaToken?: string) => Promise<{ user?: User | null; error: AuthError | null }>;
  signUpWithPassword: (email: string, password: string, fullName?: string, captchaToken?: string) => Promise<{
    user?: User | null;
    session?: Session | null;
    needsEmailConfirmation?: boolean;
    error: AuthError | null;
  }>;
  resendVerificationEmail: (email: string, captchaToken?: string) => Promise<{ error: AuthError | null }>;
  signInWithOtp: (email: string, captchaToken?: string) => Promise<{ error: AuthError | null }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<{ error: AuthError | null }>;
  linkOAuthIdentity: (provider: 'google' | 'github') => Promise<{ error: AuthError | null }>;
  unlinkOAuthIdentity: (provider: 'google' | 'github') => Promise<{ error: AuthError | null }>;
  signOut: (scope?: 'local' | 'global') => Promise<void>;
  signOutOtherDevices: () => Promise<{ error: AuthError | Error | null }>;
  listActiveSessions: () => Promise<{
    sessions: ActiveUserSession[];
    error: Error | null;
    isRpcUnavailable?: boolean;
  }>;
  revokeSession: (sessionId: string) => Promise<{ error: Error | null }>;
  fetchProfile: () => Promise<void>;
  syncWithCloud: (userId?: string) => Promise<void>;
  updateProfile: (updates: {
    display_name?: string;
    preferred_theme?: string;
    font_size?: number;
    preferences?: Json;
    username?: string | null;
    bio?: string | null;
    is_public?: boolean;
    show_streak?: boolean;
    show_challenge?: boolean;
    show_bookshelves?: boolean;
    show_saved_books?: boolean;
    show_custom_shelves?: boolean;
  }) => Promise<{ error: Error | null }>;
  resetPasswordForEmail: (email: string, captchaToken?: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string, currentPassword?: string) => Promise<{ error: AuthError | null }>;
  requestAccountDeletion: () => Promise<{ error: AuthError | null }>;
  deleteAccount: () => Promise<{ error: Error | null }>;
}

const SIGNED_OUT_AUTH_STATE = {
  user: null,
  profile: null,
  pendingProfileUpdates: null,
  isAuthModalOpen: false,
  isPasswordRecovery: false,
  error: null,
  statusMessage: null,
} as const;

async function resetClientAuthState(
  set: (partial: Partial<AuthState>) => void,
  options: { userId?: string | null; wipeDeviceStorage: boolean }
): Promise<void> {
  lastSessionCheckAtMs = 0;
  lastClientIpSyncAtMs = 0;
  clearConsumedRecoveryMarker(options.userId ?? undefined);
  set(SIGNED_OUT_AUTH_STATE);
  syncAuthCookieHint(false);
  clearClientIpSyncCookie();
  await clearLocalUserStores({ wipeDeviceStorage: options.wipeDeviceStorage });
}

async function clearLocalUserStores(options: { wipeDeviceStorage: boolean }): Promise<void> {
  const localCleanupTasks: Array<() => Promise<unknown>> = [
    async () => {
      const { cancelPendingPreferencesCloudSync } = await import('@/lib/preferences-sync');
      cancelPendingPreferencesCloudSync();
    },
    async () => {
      const { useBookshelfStore } = await import('@/stores/useBookshelfStore');
      useBookshelfStore.getState().clearBookshelf();
    },
    async () => {
      const { useAnnotationStore } = await import('@/stores/useAnnotationStore');
      useAnnotationStore.getState().clearAllAnnotations();
      if (options.wipeDeviceStorage) {
        useAnnotationStore.getState().setSpoilerShieldEnabled(true);
      }
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
      const { resolveDefaultReaderFontSize } = await import('@/config/reader-config');
      if (options.wipeDeviceStorage) {
        await useReaderStore.getState().clearAllVolumes();
        useReaderStore.setState({
          fontSize: resolveDefaultReaderFontSize(),
          isFontSizeCustomized: false,
          lineHeight: 1.75,
          fontFamily: 'serif',
          theme: 'light',
          brightness: 100,
          readingMode: 'paginated',
          columnWidth: 'wide',
        });
      } else {
        useReaderStore.getState().resetReaderSession();
      }
    },
  ];

  if (options.wipeDeviceStorage) {
    localCleanupTasks.push(
      async () => {
        const { clearAllOfflineBooks } = await import('@/lib/offline-storage');
        await clearAllOfflineBooks();
      },
      async () => {
        const { usePreferencesStore } = await import('@/stores/usePreferencesStore');
        usePreferencesStore.getState().resetAllPreferencesStore();
      },
      async () => {
        const { useThemeStore } = await import('@/stores/useThemeStore');
        useThemeStore.getState().setTheme('light');
      },
      async () => {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('bookarium_auto_heal_attempted');
        }
      }
    );
  }

  await Promise.allSettled(localCleanupTasks.map((task) => task()));
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
      isPasswordRecovery: false,
      error: null,
      statusMessage: null,

  initializeAuth: () => {
    const supabase = createClient();

    if (typeof navigator !== 'undefined' && navigator.onLine === false && get().user) {
      set({ isLoading: false });
    }

    let lastKnownUserId: string | null = get().user?.id ?? null;
    let activeCleanupPromise: Promise<void> | null = null;

    const cleanPreviousUserStoresIfSwitched = async (nextUser: User | null): Promise<void> => {
      const nextUserId = nextUser?.id ?? null;
      const currentCachedId = get().user?.id ?? lastKnownUserId;
      if (currentCachedId && currentCachedId !== nextUserId) {
        lastKnownUserId = nextUserId;
        if (!activeCleanupPromise) {
          activeCleanupPromise = clearLocalUserStores({ wipeDeviceStorage: false }).finally(() => {
            activeCleanupPromise = null;
          });
        }
        await activeCleanupPromise;
      } else {
        lastKnownUserId = nextUserId;
        if (activeCleanupPromise) {
          await activeCleanupPromise;
        }
      }
    };

    // Check active session on initialization (short-circuiting network getUser when anonymous)
    if (!inFlightInitialUserCheck) {
      let checkSettled = false;
      const checkPromiseRef: { current: Promise<void> | null } = { current: null };
      const checkInitialUser = async () => {
        try {
          let sessionUser: User | null = null;
          if (typeof supabase.auth.getSession === 'function') {
            const { data: sessionData } = await supabase.auth.getSession();
            sessionUser = sessionData?.session?.user ?? null;
            const isOffline = typeof navigator !== 'undefined' && navigator.onLine === false;
            if (!sessionUser && (!get().user || !isOffline)) {
              await cleanPreviousUserStoresIfSwitched(null);
              syncAuthCookieHint(false);
              set({ user: null, profile: null, isLoading: false });
              return;
            }
          }
          const {
            data: { user },
            error,
          } = await supabase.auth.getUser();
          if (
            (error || !user) &&
            typeof navigator !== 'undefined' &&
            navigator.onLine === false &&
            get().user
          ) {
            set({ isLoading: false });
            return;
          }
          const resolvedUser =
            user ??
            (error && !isDefinitiveAuthInvalidError(error)
              ? (sessionUser ?? get().user)
              : null);
          await cleanPreviousUserStoresIfSwitched(resolvedUser);
          set((state) => ({
            user: resolvedUser,
            profile: resolvedUser
              ? state.profile?.id === resolvedUser.id
                ? state.profile
                : null
              : null,
            isLoading: false,
          }));
          syncAuthCookieHint(Boolean(resolvedUser));
          if (resolvedUser) {
            get().fetchProfile();
          }
        } catch {
          if (get().user) {
            set({ isLoading: false });
          } else {
            set({ user: null, profile: null, isLoading: false });
          }
        } finally {
          checkSettled = true;
          if (inFlightInitialUserCheck === checkPromiseRef.current) {
            inFlightInitialUserCheck = null;
          }
        }
      };
      checkPromiseRef.current = checkInitialUser();
      if (!checkSettled) {
        inFlightInitialUserCheck = checkPromiseRef.current;
      }
    }
    void inFlightInitialUserCheck;

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
      // Let checkInitialUser() authoritatively resolve the initial session state when online;
      // GoTrueClient._emitInitialSession can emit ('INITIAL_SESSION', null) on transient
      // network/reload aborts or duplicate ('INITIAL_SESSION', session) while bootstrap is in flight.
      if (event === 'INITIAL_SESSION' && (!session || inFlightInitialUserCheck !== null)) {
        return;
      }
      const user = session?.user ?? null;
      const currentCachedId = get().user?.id ?? lastKnownUserId;
      const needsStoreCleanup = Boolean(currentCachedId && currentCachedId !== (user?.id ?? null));

      if (event === 'SIGNED_OUT') {
        clearConsumedRecoveryMarker(currentCachedId);
      }

      syncAuthCookieHint(Boolean(user));

      if (needsStoreCleanup) {
        set((state) => ({
          user: null,
          profile: null,
          isLoading: Boolean(user),
          isPasswordRecovery:
            event === 'PASSWORD_RECOVERY'
              ? true
              : event === 'SIGNED_OUT'
                ? false
                : state.isPasswordRecovery,
        }));
        void cleanPreviousUserStoresIfSwitched(user).then(() => {
          set({ user, isLoading: false });
          if (user) {
            get().fetchProfile();
          }
        });
        return;
      }

      lastKnownUserId = user?.id ?? null;
      set((state) => ({
        user,
        isLoading: false,
        isPasswordRecovery:
          event === 'PASSWORD_RECOVERY'
            ? true
            : event === 'SIGNED_OUT'
              ? false
              : state.isPasswordRecovery,
      }));
      if (user) {
        get().fetchProfile();
        if (
          event === 'TOKEN_REFRESHED' &&
          typeof window !== 'undefined' &&
          typeof window.dispatchEvent === 'function'
        ) {
          window.dispatchEvent(
            new CustomEvent('bookarium:auth-token-refreshed', { detail: { userId: user.id } })
          );
        }
      } else {
        set({ profile: null });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  },

  verifyActiveSessionValidity: async (options) => {
    const currentUser = get().user;
    if (!currentUser?.id) return false;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      return true;
    }

    const supabase = createClient();
    const getUserFn = supabase.auth?.getUser;
    if (
      typeof getUserFn !== 'function' ||
      (process.env.NODE_ENV === 'test' && !('mock' in getUserFn))
    ) {
      return true;
    }

    const now = Date.now();
    if (
      !options?.force &&
      !inFlightSessionCheck &&
      lastSessionCheckAtMs > 0 &&
      now - lastSessionCheckAtMs < SESSION_VALIDITY_CHECK_COOLDOWN_MS
    ) {
      return true;
    }

    if (inFlightSessionCheck) {
      return inFlightSessionCheck;
    }

    lastSessionCheckAtMs = now;
    inFlightSessionCheck = (async () => {
      try {
        const result = await getUserFn.call(supabase.auth);
        const error = result?.error;
        if (error && isDefinitiveAuthInvalidError(error)) {
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          await resetClientAuthState(set, {
            userId: currentUser.id,
            wipeDeviceStorage: false,
          });
          return false;
        }
        return true;
      } catch (err: unknown) {
        if (isDefinitiveAuthInvalidError(err)) {
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
          await resetClientAuthState(set, {
            userId: currentUser.id,
            wipeDeviceStorage: false,
          });
          return false;
        }
        return true;
      } finally {
        inFlightSessionCheck = null;
      }
    })();

    return inFlightSessionCheck;
  },

  reconcileClientSessionOrigin: async () => {
    if (!hasClientIpSyncCookie()) return;
    clearClientIpSyncCookie();

    const state = get();
    if (!state.user?.id || state.isPasswordRecovery) return;
    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).has('recovery')
    ) {
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    const supabase = createClient();
    const refreshFn = supabase.auth?.refreshSession;
    if (
      typeof refreshFn !== 'function' ||
      (process.env.NODE_ENV === 'test' && !('mock' in refreshFn))
    ) {
      return;
    }

    const now = Date.now();
    if (
      !inFlightClientIpSync &&
      lastClientIpSyncAtMs > 0 &&
      now - lastClientIpSyncAtMs < CLIENT_IP_SYNC_COOLDOWN_MS
    ) {
      return;
    }
    if (inFlightClientIpSync) {
      await inFlightClientIpSync;
      return;
    }

    lastClientIpSyncAtMs = now;
    inFlightClientIpSync = (async () => {
      try {
        await refreshFn.call(supabase.auth);
      } catch {
        // Best-effort browser IP/User-Agent reconciliation; never disrupt an active login
      } finally {
        inFlightClientIpSync = null;
      }
    })();

    await inFlightClientIpSync;
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

  clearPasswordRecovery: () => {
    set({ isPasswordRecovery: false });
  },

  verifyPasswordRecoverySession: async () => {
    try {
      const supabase = createClient();
      const aalApi = supabase.auth.mfa?.getAuthenticatorAssuranceLevel;
      const aalResult =
        typeof aalApi === 'function' ? await aalApi() : null;
      const authMethods = aalResult?.data?.currentAuthenticationMethods;

      let resolvedUser = get().user;
      if (!resolvedUser?.recovery_sent_at && typeof supabase.auth.getUser === 'function') {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          resolvedUser = data.user;
          set({ user: data.user });
        }
      }

      if (!resolvedUser) {
        if (get().isPasswordRecovery) {
          set({ isPasswordRecovery: false });
        }
        return false;
      }

      const consumedSentAt = readConsumedRecoverySentAt(resolvedUser.id);
      const isVerified = isRecoverySessionAmrVerified({
        authMethods,
        recoverySentAt: resolvedUser.recovery_sent_at,
        consumedRecoverySentAt: consumedSentAt,
      });

      if (isVerified) {
        set({ isPasswordRecovery: true });
        return true;
      }

      if (get().isPasswordRecovery) {
        set({ isPasswordRecovery: false });
      }
      return false;
    } catch {
      if (get().isPasswordRecovery) {
        set({ isPasswordRecovery: false });
      }
      return false;
    }
  },

  setError: (error) => {
    set({ error });
  },

  setStatusMessage: (statusMessage) => {
    set({ statusMessage });
  },

  signInWithPassword: async (email, password, captchaToken) => {
    set({ error: null, statusMessage: null });
    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
      ...(captchaToken ? { options: { captchaToken } } : {}),
    });
    if (error) {
      set({ error: error.message });
      return { error };
    }
    set({ user: data.user, isAuthModalOpen: false, statusMessage: null });
    get().fetchProfile();
    return { error: null, user: data.user };
  },

  signUpWithPassword: async (email, password, fullName, captchaToken) => {
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
        ...(captchaToken ? { captchaToken } : {}),
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

  resendVerificationEmail: async (email: string, captchaToken?: string) => {
    set({ error: null });
    const supabase = createClient();
    const redirectTo = buildAuthRedirectUrl('/auth/callback');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: redirectTo,
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    if (error) {
      set({ error: error.message });
      return { error };
    }
    return { error: null };
  },

  signInWithOtp: async (email, captchaToken) => {
    set({ error: null, statusMessage: null });
    const supabase = createClient();
    const redirectTo = buildAuthRedirectUrl('/auth/callback');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectTo,
        ...(captchaToken ? { captchaToken } : {}),
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
    const currentPath =
      typeof window !== 'undefined'
        ? sanitizeRedirectPath(`${window.location.pathname}${window.location.search}`)
        : '/';
    const callbackPath =
      currentPath !== '/'
        ? `/auth/callback?next=${encodeURIComponent(currentPath)}`
        : '/auth/callback';
    const redirectTo = buildAuthRedirectUrl(callbackPath);
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

  linkOAuthIdentity: async (provider) => {
    set({ error: null, statusMessage: null });
    const supabase = createClient();
    const redirectTo = buildAuthRedirectUrl(
      `/auth/callback?next=${encodeURIComponent(`${ROUTES.ACCOUNT}?tab=security`)}`
    );
    const { error } = await supabase.auth.linkIdentity({
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

  unlinkOAuthIdentity: async (provider) => {
    set({ error: null, statusMessage: null });
    const supabase = createClient();
    const currentUser = get().user;
    if (!currentUser) {
      const noUserError = { message: 'No active user session found' } as AuthError;
      set({ error: noUserError.message });
      return { error: noUserError };
    }

    let identities: UserIdentity[] = currentUser.identities ?? [];
    if (identities.length === 0 && typeof supabase.auth.getUserIdentities === 'function') {
      const { data: identitiesData } = await supabase.auth.getUserIdentities();
      identities = identitiesData?.identities ?? [];
    }

    const providers = Array.isArray(currentUser.app_metadata?.providers)
      ? (currentUser.app_metadata.providers as string[])
      : [];
    const totalAuthMethods = Math.max(identities.length, providers.length);
    if (totalAuthMethods < 2) {
      const lockoutError = {
        message:
          'Set an account password first before disconnecting Google so you do not lose access to your account.',
      } as AuthError;
      set({ error: lockoutError.message });
      return { error: lockoutError };
    }

    const targetIdentity = identities.find((id) => id.provider === provider);
    if (!targetIdentity) {
      const missingError = {
        message: `No linked ${provider} account found.`,
      } as AuthError;
      set({ error: missingError.message });
      return { error: missingError };
    }

    const { error } = await supabase.auth.unlinkIdentity(targetIdentity);
    if (error) {
      set({ error: error.message });
      return { error };
    }

    const remainingIdentities = identities.filter((id) => id.provider !== provider);
    const remainingProviders = providers.filter((p) => p !== provider);
    set((state) => ({
      user: state.user
        ? {
            ...state.user,
            identities: remainingIdentities,
            app_metadata: {
              ...state.user.app_metadata,
              providers: remainingProviders,
            },
          }
        : null,
    }));

    if (typeof supabase.auth.getUser === 'function') {
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          set({ user: data.user });
        }
      } catch {
        // Non-blocking refresh
      }
    }

    return { error: null };
  },

  signOut: async (scope = 'local') => {
    const { user } = get();
    if (user?.id) {
      try {
        const [{ useBookshelfStore }, { useAnnotationStore }] = await Promise.all([
          import('@/stores/useBookshelfStore'),
          import('@/stores/useAnnotationStore'),
        ]);
        await Promise.all([
          useBookshelfStore.getState().flushOutbox(user.id),
          useAnnotationStore.getState().flushOutbox(user.id),
        ]);
      } catch {
        // Non-blocking fallback
      }
    }

    const supabase = createClient();
    await supabase.auth.signOut({ scope });
    await resetClientAuthState(set, {
      userId: user?.id,
      wipeDeviceStorage: false,
    });
  },

  signOutOtherDevices: async () => {
    const currentUser = get().user;
    if (!currentUser) {
      return { error: new Error('Not signed in.') };
    }

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signOut({ scope: 'others' });
      if (error) {
        return { error };
      }
      const isStillValid = await get().verifyActiveSessionValidity({ force: true });
      if (!isStillValid) {
        return {
          error: new Error('Your session on this device has already ended. Please sign in again.'),
        };
      }
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  listActiveSessions: async () => {
    const currentUser = get().user;
    if (!currentUser) {
      return { sessions: [], error: null };
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('get_active_sessions');
      if (error) {
        if (isSessionRpcUnavailableError(error)) {
          return { sessions: [], error: null, isRpcUnavailable: true };
        }
        return {
          sessions: [],
          error: new Error(error.message || 'Unable to load active device sessions.'),
        };
      }

      const sessions: ActiveUserSession[] = Array.isArray(data)
        ? data.map((row) => ({
            id: String(row.id),
            userAgent: typeof row.user_agent === 'string' ? row.user_agent : null,
            ipAddress: typeof row.ip_address === 'string' ? row.ip_address : null,
            createdAt: typeof row.created_at === 'string' ? row.created_at : null,
            updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
            refreshedAt: typeof row.refreshed_at === 'string' ? row.refreshed_at : null,
            notAfter: typeof row.not_after === 'string' ? row.not_after : null,
            isCurrent: Boolean(row.is_current),
          }))
        : [];

      if (sessions.length === 0 || !sessions.some((s) => s.isCurrent)) {
        const isStillValid = await get().verifyActiveSessionValidity({ force: true });
        if (!isStillValid) {
          return {
            sessions: [],
            error: new Error('Your session on this device has ended. Please sign in again.'),
          };
        }
      }

      return { sessions, error: null };
    } catch (err: unknown) {
      return {
        sessions: [],
        error: err instanceof Error ? err : new Error(String(err)),
      };
    }
  },

  revokeSession: async (sessionId: string) => {
    const currentUser = get().user;
    if (!currentUser) {
      return { error: new Error('Not signed in.') };
    }
    if (!sessionId) {
      return { error: new Error('Invalid session identifier.') };
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc('revoke_user_session', {
        target_session_id: sessionId,
      });
      if (error) {
        return { error: new Error(error.message || 'Failed to revoke device session.') };
      }
      if (data === false) {
        return {
          error: new Error('This device session had already ended. Refreshing your device list.'),
        };
      }
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  },

  fetchProfile: () => {
    const currentUser = get().user;
    if (!currentUser) return Promise.resolve();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return Promise.resolve();

    const targetUserId = currentUser.id;
    const pendingBeforeJoin = get().pendingProfileUpdates;
    if (
      inFlightProfileFetchByUser.has(targetUserId) &&
      pendingBeforeJoin &&
      Object.keys(pendingBeforeJoin).length > 0
    ) {
      dirtyProfileSyncUsers.add(targetUserId);
    }

    return coalesceInFlightByUser(
      inFlightProfileFetchByUser,
      targetUserId,
      async () => {
        const { user, pendingProfileUpdates } = get();
        if (!user || user.id !== targetUserId) return;
        if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

        try {
          const supabase = createClient();

          if (pendingProfileUpdates && Object.keys(pendingProfileUpdates).length > 0) {
            const { error: flushErr } = await supabase
              .from('profiles')
              .update(pendingProfileUpdates)
              .eq('id', user.id);
            if (!flushErr) {
              set((s) =>
                s.pendingProfileUpdates === pendingProfileUpdates
                  ? { pendingProfileUpdates: null }
                  : {}
              );
            }
          }

          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (!error && data) {
            set({ profile: data as Profile });
            try {
              const { reconcileCloudPreferencesWithLocal } = await import('@/lib/preferences-sync');
              reconcileCloudPreferencesWithLocal(data as Profile);
            } catch {
              // Non-blocking fallback
            }
          }
        } catch {
          // Non-blocking fallback
        }
      },
      dirtyProfileSyncUsers
    );
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
          set((s) =>
            s.pendingProfileUpdates === pending ? { pendingProfileUpdates: null } : {}
          );
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
      if (inFlightProfileFetchByUser.has(user.id)) {
        dirtyProfileSyncUsers.add(user.id);
      }
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

  resetPasswordForEmail: async (email, captchaToken) => {
    set({ error: null, statusMessage: null });
    const supabase = createClient();
    const redirectTo = buildAuthRedirectUrl(
      `/auth/callback?next=${encodeURIComponent(`${ROUTES.ACCOUNT}?tab=security&recovery=true`)}`
    );
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
      ...(captchaToken ? { captchaToken } : {}),
    });
    if (error) {
      set({ error: error.message });
      return { error };
    }
    clearConsumedRecoveryMarker(get().user?.id);
    return { error: null };
  },

  updatePassword: async (newPassword, currentPassword) => {
    set({ error: null });
    const supabase = createClient();
    const wasPasswordRecovery = get().isPasswordRecovery;

    if (currentPassword !== undefined) {
      const email = get().user?.email;
      if (!email) {
        const noUserError = { message: 'No active user session found' } as AuthError;
        set({ error: noUserError.message });
        return { error: noUserError };
      }
      if (currentPassword === newPassword) {
        const samePwdError = {
          message: 'New password must be different from your current password.',
        } as AuthError;
        set({ error: samePwdError.message });
        return { error: samePwdError };
      }
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (verifyError) {
        const invalidCurrentError = {
          ...verifyError,
          message: 'Current password is incorrect.',
        } as AuthError;
        set({ error: invalidCurrentError.message });
        return { error: invalidCurrentError };
      }
    }

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) {
      set({ error: error.message });
      return { error };
    }
    if (currentPassword === undefined && wasPasswordRecovery) {
      const targetUser = data?.user ?? get().user;
      markRecoveryConsumed(targetUser?.id, targetUser?.recovery_sent_at);
    }
    set((state) => {
      const baseUser = data?.user ?? state.user;
      if (!baseUser) {
        return { isPasswordRecovery: false };
      }
      const existingProviders = Array.isArray(baseUser.app_metadata?.providers)
        ? (baseUser.app_metadata.providers as string[])
        : [];
      const updatedProviders = existingProviders.includes('email')
        ? existingProviders
        : [...existingProviders, 'email'];
      return {
        isPasswordRecovery: false,
        user: {
          ...baseUser,
          app_metadata: {
            ...baseUser.app_metadata,
            providers: updatedProviders,
          },
        },
      };
    });
    return { error: null };
  },

  requestAccountDeletion: async () => {
    const { user } = get();
    if (!user?.email) return { error: { message: 'No active user session found' } as AuthError };

    set({ error: null });
    const supabase = createClient();
    const redirectTo = buildAuthRedirectUrl(
      `/auth/callback?next=${encodeURIComponent('/auth/confirm-deletion')}`
    );
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
      // 4. Terminate all auth sessions globally and clear all local persisted user stores
      await supabase.auth.signOut({ scope: 'global' });
      await resetClientAuthState(set, {
        userId: user.id,
        wipeDeviceStorage: true,
      });
      return { error: null };
    } catch (err: unknown) {
      return { error: err instanceof Error ? err : new Error(String(err)) };
    }
  },
}),
    {
      name: 'bookarium-auth-profile',
      storage: createJSONStorage(() => safeLocalStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.user) {
          syncAuthCookieHint(true);
        }
      },
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        pendingProfileUpdates: state.pendingProfileUpdates,
      }),
    }
  )
);