import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { STORAGE_KEYS } from '@/config/site-config';

export type AppTheme = 'light' | 'sepia' | 'dark';

export interface ThemeState {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  cycleTheme: () => void;
}

export function getCookieValue(cookieName: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${cookieName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getClientPersistedTheme(): AppTheme | null {
  const cookieVal = getCookieValue(STORAGE_KEYS.THEME);
  if (cookieVal === 'dark' || cookieVal === 'sepia' || cookieVal === 'light') {
    return cookieVal;
  }
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    try {
      const localVal = window.localStorage.getItem(STORAGE_KEYS.THEME);
      if (localVal) {
        const parsed = JSON.parse(localVal);
        const t = parsed?.state?.theme;
        if (t === 'dark' || t === 'sepia' || t === 'light') return t;
      }
    } catch {
      // Fallback
    }
  }
  return null;
}

export function resolveInitialTheme(): AppTheme {
  return getClientPersistedTheme() ?? 'light';
}

export function initializeTheme(initialTheme?: AppTheme): void {
  if (!initialTheme || (initialTheme !== 'dark' && initialTheme !== 'sepia' && initialTheme !== 'light')) {
    return;
  }
  const clientPersisted = getClientPersistedTheme();
  const effectiveTheme: AppTheme =
    initialTheme === 'light' && (clientPersisted === 'dark' || clientPersisted === 'sepia')
      ? clientPersisted
      : initialTheme;
  const current = useThemeStore.getState().theme;
  if (current !== effectiveTheme) {
    useThemeStore.setState({ theme: effectiveTheme });
  }
  if (typeof useThemeStore.getInitialState === 'function') {
    const initialState = useThemeStore.getInitialState();
    if (initialState) {
      initialState.theme = effectiveTheme;
    }
  }
  applyThemeToDocument(effectiveTheme);
}

export function applyThemeToDocument(theme: AppTheme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.remove('light', 'dark', 'sepia');
  if (theme === 'dark') {
    root.classList.add('dark');
  } else if (theme === 'sepia') {
    root.classList.add('sepia');
  }
  try {
    document.cookie = `${STORAGE_KEYS.THEME}=${theme}; path=/; max-age=31536000; SameSite=Lax`;
  } catch {
    // Non-blocking in environments without document.cookie
  }
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: resolveInitialTheme(),
      setTheme: (theme: AppTheme) => {
        set({ theme });
        if (typeof useThemeStore.getInitialState === 'function') {
          const initialState = useThemeStore.getInitialState();
          if (initialState) {
            initialState.theme = theme;
          }
        }
        applyThemeToDocument(theme);
      },
      cycleTheme: () => {
        const current = get().theme;
        const next: AppTheme =
          current === 'light' ? 'sepia' : current === 'sepia' ? 'dark' : 'light';
        set({ theme: next });
        if (typeof useThemeStore.getInitialState === 'function') {
          const initialState = useThemeStore.getInitialState();
          if (initialState) {
            initialState.theme = next;
          }
        }
        applyThemeToDocument(next);
      },
    }),
    {
      name: STORAGE_KEYS.THEME,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          applyThemeToDocument(state.theme);
        }
      },
    }
  )
);

