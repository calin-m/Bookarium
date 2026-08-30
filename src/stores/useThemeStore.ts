import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type AppTheme = 'light' | 'sepia' | 'dark';

export interface ThemeState {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  cycleTheme: () => void;
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
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: 'light',
      setTheme: (theme: AppTheme) => {
        set({ theme });
        applyThemeToDocument(theme);
      },
      cycleTheme: () => {
        const current = get().theme;
        const next: AppTheme =
          current === 'light' ? 'sepia' : current === 'sepia' ? 'dark' : 'light';
        set({ theme: next });
        applyThemeToDocument(next);
      },
    }),
    {
      name: 'bookarium-theme-preference',
      storage: createJSONStorage(() => (typeof window !== 'undefined' ? localStorage : null as unknown as Storage)),
      onRehydrateStorage: () => (state) => {
        if (state?.theme) {
          applyThemeToDocument(state.theme);
        }
      },
    }
  )
);

